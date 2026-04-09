const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { createApp } = require("../src/app");

function makeConfig(tempDir) {
  return {
    appPort: 0,
    appOrigin: "http://127.0.0.1:3001",
    sessionSecret: "test-secret",
    adminUsername: "admin",
    adminPassword: "admin-pass",
    trustProxy: false,
    dataFile: path.join(tempDir, "db.json"),
    cookies: {
      secure: false
    },
    vpn: {
      serverEndpoint: "vpn.example.com:51820",
      serverPublicKey: "server-public-key",
      serverInterfaceAddress: "10.20.0.1/24",
      clientDns: "1.1.1.1",
      allowedIps: "0.0.0.0/0",
      clientSubnetBase: "10.20.0.",
      clientSubnetStart: 10,
      interfaceName: "wg0",
      serverConfigPath: "",
      autoApplyPeers: false,
      reloadMode: "manual"
    }
  };
}

function parseSetCookie(headers) {
  const values = headers.getSetCookie ? headers.getSetCookie() : [headers.get("set-cookie")].filter(Boolean);
  return values.map((entry) => entry.split(";")[0]);
}

function joinCookies(existing) {
  return existing.join("; ");
}

async function run() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vpn-service-"));
  const config = makeConfig(tempDir);
  const { app } = createApp({
    config,
    keyProvider: () => ({
      privateKey: "client-private-key",
      publicKey: "client-public-key",
      presharedKey: "client-preshared-key"
    })
  });

  const server = app.listen(0);
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    let cookies = [];

    const loginPage = await fetch(`${baseUrl}/admin/login`, { redirect: "manual" });
    assert.equal(loginPage.status, 200);
    cookies = parseSetCookie(loginPage.headers);
    const csrfCookie = cookies.find((item) => item.startsWith("csrf="));
    assert.ok(csrfCookie, "csrf cookie missing");
    const csrfToken = csrfCookie.split("=")[1];

    const loginResponse = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: joinCookies(cookies)
      },
      body: new URLSearchParams({
        _csrf: csrfToken,
        username: "admin",
        password: "admin-pass"
      })
    });

    assert.equal(loginResponse.status, 302);
    cookies = parseSetCookie(loginResponse.headers).concat(cookies.filter((item) => !item.startsWith("session=")));
    assert.ok(cookies.find((item) => item.startsWith("session=")), "session cookie missing");

    const createInviteResponse = await fetch(`${baseUrl}/admin/invites`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: joinCookies(cookies)
      },
      body: new URLSearchParams({
        _csrf: csrfToken,
        note: "test invite",
        maxUses: "1",
        expiresAt: ""
      })
    });

    assert.equal(createInviteResponse.status, 200);
    const adminHtml = await createInviteResponse.text();
    const match = adminHtml.match(/\/register\/([a-f0-9]+)/);
    assert.ok(match, "invite link missing");
    const token = match[1];

    const registerPage = await fetch(`${baseUrl}/register/${token}`);
    assert.equal(registerPage.status, 200);
    const registerCookies = parseSetCookie(registerPage.headers);
    const registerCsrfCookie = registerCookies.find((item) => item.startsWith("csrf="));
    assert.ok(registerCsrfCookie, "register csrf cookie missing");
    const registerCsrf = registerCsrfCookie.split("=")[1];

    const registerResponse = await fetch(`${baseUrl}/register/${token}`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: joinCookies(registerCookies)
      },
      body: new URLSearchParams({
        _csrf: registerCsrf,
        name: "Test User",
        email: "user@example.com"
      })
    });

    assert.equal(registerResponse.status, 200);
    const registerHtml = await registerResponse.text();
    const downloadMatch = registerHtml.match(/\/download\/([a-f0-9]+)/);
    assert.ok(downloadMatch, "download link missing");

    const downloadResponse = await fetch(`${baseUrl}/download/${downloadMatch[1]}`);
    assert.equal(downloadResponse.status, 200);
    const configText = await downloadResponse.text();
    assert.match(configText, /\[Interface]/);
    assert.match(configText, /client-private-key/);

    console.log("Smoke test passed");
  } finally {
    await new Promise((resolve) => server.close(resolve));
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // Windows may keep a short-lived handle on the JSON file after shutdown.
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

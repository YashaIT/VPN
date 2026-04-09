const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");

const { JsonStore } = require("./store");
const {
  createPasswordHash,
  verifyPassword,
  signSession,
  readSession,
  parseCookies,
  createCsrfToken,
  verifyCsrfToken
} = require("./auth");
const {
  validateEmail,
  validateName,
  validateInviteForm,
  normalizeText
} = require("./validation");
const {
  generateKeyPair,
  makeClientAddress,
  buildConfig,
  buildPeerSnippet,
  makeDownloadFileName,
  buildQrCodeDataUrl
} = require("./vpn");
const { WireGuardManager } = require("./wireguard");
const { createSecurityMiddleware, createRateLimiter } = require("./security");
const {
  adminLoginPage,
  adminDashboardPage,
  inviteInvalidPage,
  registerPage,
  registrationSuccessPage
} = require("./views");

function createApp({ config, store = null, keyProvider = generateKeyPair, wireGuardManager = null } = {}) {
  const app = express();
  const dataStore = store || new JsonStore(config.dataFile);
  const wgManager = wireGuardManager || new WireGuardManager(config);
  const publicDir = path.join(process.cwd(), "public");

  fs.mkdirSync(publicDir, { recursive: true });
  app.set("trust proxy", config.trustProxy);

  dataStore.ensureAdmin({
    username: config.adminUsername,
    passwordHash: createPasswordHash(config.adminPassword)
  });

  app.use(express.urlencoded({ extended: false, limit: "10kb" }));
  app.use(createSecurityMiddleware(config));
  app.use(express.static(publicDir));

  const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 });
  const registerLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 20 });

  function setSessionCookie(res, payload) {
    const token = signSession(payload, config.sessionSecret);
    const flags = [
      `session=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${60 * 60 * 12}`
    ];

    if (config.cookies.secure) {
      flags.push("Secure");
    }

    res.append("Set-Cookie", flags.join("; "));
  }

  function clearSessionCookie(res) {
    const flags = ["session=", "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];
    if (config.cookies.secure) {
      flags.push("Secure");
    }
    res.append("Set-Cookie", flags.join("; "));
  }

  function setCsrfCookie(res, token) {
    const flags = [`csrf=${encodeURIComponent(token)}`, "Path=/", "SameSite=Lax", `Max-Age=${60 * 60 * 12}`];
    if (config.cookies.secure) {
      flags.push("Secure");
    }
    res.append("Set-Cookie", flags.join("; "));
  }

  function getSession(req) {
    const cookies = parseCookies(req);
    return readSession(cookies.session, config.sessionSecret);
  }

  function issueCsrf(res) {
    const token = createCsrfToken();
    setCsrfCookie(res, token);
    return token;
  }

  function getCsrf(req, res) {
    const cookies = parseCookies(req);
    return cookies.csrf || issueCsrf(res);
  }

  function requireAdmin(req, res, next) {
    const session = getSession(req);
    if (!session?.username) {
      return res.redirect("/admin/login");
    }
    req.admin = session;
    next();
  }

  function requireCsrf(req, res, next) {
    const cookies = parseCookies(req);
    const token = req.body?._csrf || req.headers["x-csrf-token"];
    if (!verifyCsrfToken(token, cookies.csrf || "")) {
      return res.status(403).send("CSRF validation failed");
    }
    next();
  }

  function readInviteState(invite) {
    if (!invite) {
      return { ok: false, message: "Приглашение не найдено." };
    }
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      return { ok: false, message: "Срок действия приглашения истек." };
    }
    if (invite.usedCount >= invite.maxUses) {
      return { ok: false, message: "Приглашение уже использовано максимальное число раз." };
    }
    return { ok: true };
  }

  function renderAdmin(req, res, options = {}) {
    const csrfToken = getCsrf(req, res);
    res.send(
      adminDashboardPage({
        appOrigin: config.appOrigin,
        invites: dataStore.listInvites(),
        users: dataStore.listUsers(),
        csrfToken,
        vpnConfigPath: config.vpn.serverConfigPath,
        autoApplyPeers: config.vpn.autoApplyPeers,
        ...options
      })
    );
  }

  app.get("/", (req, res) => {
    res.redirect("/admin/login");
  });

  app.get("/admin/login", (req, res) => {
    const session = getSession(req);
    if (session?.username) {
      return res.redirect("/admin");
    }
    res.send(adminLoginPage(undefined, getCsrf(req, res)));
  });

  app.post("/admin/login", loginLimiter, requireCsrf, (req, res) => {
    const username = normalizeText(req.body.username, 64);
    const password = String(req.body.password || "");
    const admin = dataStore.findAdminByUsername(username);

    if (!admin || !verifyPassword(password, admin.passwordHash)) {
      return res.status(401).send(adminLoginPage("Неверный логин или пароль.", getCsrf(req, res)));
    }

    setSessionCookie(res, {
      id: admin.id,
      username: admin.username,
      issuedAt: Date.now()
    });

    return res.redirect("/admin");
  });

  app.post("/admin/logout", requireCsrf, (req, res) => {
    clearSessionCookie(res);
    res.redirect("/admin/login");
  });

  app.get("/admin", requireAdmin, (req, res) => {
    renderAdmin(req, res);
  });

  app.post("/admin/invites", requireAdmin, requireCsrf, (req, res) => {
    const input = validateInviteForm(req.body);
    if (!input.ok) {
      return renderAdmin(req, res, { error: input.error });
    }

    dataStore.createInvite({
      createdBy: req.admin.username,
      maxUses: input.maxUses,
      expiresAt: input.expiresAt,
      note: input.note
    });

    return renderAdmin(req, res, { message: "Ссылка приглашения создана." });
  });

  app.get("/register/:token", (req, res) => {
    const invite = dataStore.findInviteByToken(req.params.token);
    const state = readInviteState(invite);

    if (!state.ok) {
      return res.status(404).send(inviteInvalidPage(state.message));
    }

    return res.send(registerPage({ invite, csrfToken: getCsrf(req, res) }));
  });

  app.post("/register/:token", registerLimiter, requireCsrf, async (req, res) => {
    const invite = dataStore.findInviteByToken(req.params.token);
    const state = readInviteState(invite);

    if (!state.ok) {
      return res.status(400).send(inviteInvalidPage(state.message));
    }

    const name = normalizeText(req.body.name, 120);
    const email = normalizeText(req.body.email, 160).toLowerCase();

    const nameError = validateName(name);
    if (nameError) {
      return res.status(400).send(registerPage({ invite, error: nameError, values: { name, email }, csrfToken: getCsrf(req, res) }));
    }

    const emailError = validateEmail(email);
    if (emailError) {
      return res.status(400).send(registerPage({ invite, error: emailError, values: { name, email }, csrfToken: getCsrf(req, res) }));
    }

    if (dataStore.findUserByEmail(email)) {
      return res
        .status(400)
        .send(registerPage({ invite, error: "Пользователь с таким email уже существует.", values: { name, email }, csrfToken: getCsrf(req, res) }));
    }

    try {
      const keys = await Promise.resolve(keyProvider());
      const octet = dataStore.getNextClientOctet(config.vpn.clientSubnetStart);
      const address = makeClientAddress(config.vpn.clientSubnetBase, octet);
      const client = { name, email, address };
      const configText = buildConfig({ client, keys, vpnConfig: config.vpn });
      const peerSnippet = buildPeerSnippet({ client, keys });
      let wireGuardStatus = "manual";
      let wireGuardMessage = "Peer нужно добавить на сервер вручную.";

      if (config.vpn.autoApplyPeers) {
        const result = wgManager.appendPeer(userSafeComment(client), peerSnippet);
        wireGuardStatus = result.ok ? "applied" : "failed";
        wireGuardMessage = result.message;
      }

      const user = dataStore.createUser({
        inviteId: invite.id,
        name,
        email,
        address,
        configText,
        peerSnippet,
        downloadName: makeDownloadFileName(name),
        downloadToken: crypto.randomBytes(24).toString("hex"),
        publicKey: keys.publicKey,
        configChecksum: crypto.createHash("sha256").update(configText).digest("hex"),
        wireGuardStatus,
        wireGuardMessage
      });

      dataStore.markInviteUsed(invite.token);

      return res.send(registrationSuccessPage({
        user,
        qrCodeDataUrl: await buildQrCodeDataUrl(configText)
      }));
    } catch (error) {
      return res.status(500).send(registerPage({
        invite,
        error: `Не удалось завершить регистрацию. ${error.message}`,
        values: { name, email },
        csrfToken: getCsrf(req, res)
      }));
    }
  });

  app.get("/download/:userId", (req, res) => {
    const user = dataStore.findUserByDownloadToken(req.params.userId);
    if (!user) {
      return res.status(404).send("Not found");
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${user.downloadName}"`);
    res.send(user.configText);
  });

  app.get("/admin/users/:id/peer", requireAdmin, (req, res) => {
    const user = dataStore.findUserById(req.params.id);
    if (!user) {
      return res.status(404).send("Not found");
    }

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(user.peerSnippet);
  });

  app.get("/health", (req, res) => {
    res.json({ ok: true });
  });

  return { app, store: dataStore };
}

function userSafeComment(client) {
  return `${client.name} <${client.email}>`;
}

module.exports = {
  createApp
};

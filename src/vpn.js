const crypto = require("crypto");
const { spawnSync } = require("child_process");
const QRCode = require("qrcode");

function slugifyName(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function runWireGuardCommand(command, input) {
  const result = spawnSync("wg", command, {
    input,
    encoding: "utf8"
  });

  if (result.status !== 0) {
    throw new Error(`WireGuard command failed: ${result.stderr || result.stdout || "unknown error"}`);
  }

  return result.stdout.trim();
}

function generateKeyPair() {
  const privateKey = runWireGuardCommand(["genkey"]);
  const publicKey = runWireGuardCommand(["pubkey"], privateKey);
  const presharedKey = runWireGuardCommand(["genpsk"]);

  return {
    privateKey,
    publicKey,
    presharedKey
  };
}

function makeClientAddress(base, octet) {
  return `${base}${octet}/32`;
}

function buildConfig({ client, keys, vpnConfig }) {
  return [
    "[Interface]",
    `PrivateKey = ${keys.privateKey}`,
    `Address = ${client.address}`,
    `DNS = ${vpnConfig.clientDns}`,
    "",
    "[Peer]",
    `PublicKey = ${vpnConfig.serverPublicKey}`,
    `PresharedKey = ${keys.presharedKey}`,
    `AllowedIPs = ${vpnConfig.allowedIps}`,
    `Endpoint = ${vpnConfig.serverEndpoint}`,
    "PersistentKeepalive = 25",
    ""
  ].join("\n");
}

function buildPeerSnippet({ client, keys }) {
  return [
    `# ${client.name} <${client.email}>`,
    "[Peer]",
    `PublicKey = ${keys.publicKey}`,
    `PresharedKey = ${keys.presharedKey}`,
    `AllowedIPs = ${client.address.replace("/32", "/32")}`,
    ""
  ].join("\n");
}

function makeDownloadFileName(name) {
  const safeName = slugifyName(name) || crypto.randomUUID();
  return `${safeName}.conf`;
}

function buildQrCodeDataUrl(configText) {
  return QRCode.toDataURL(configText, {
    type: "image/png",
    margin: 1,
    errorCorrectionLevel: "M",
    width: 320
  });
}

module.exports = {
  generateKeyPair,
  makeClientAddress,
  buildConfig,
  buildPeerSnippet,
  makeDownloadFileName,
  buildQrCodeDataUrl
};

require("dotenv").config();

const path = require("path");

const dataDir = path.join(process.cwd(), "data");

function required(name, fallback = "") {
  const value = process.env[name] || fallback;
  if (!value) {
    throw new Error(`Environment variable ${name} is required`);
  }
  return value;
}

module.exports = {
  appPort: Number(process.env.PORT || 3000),
  appOrigin: process.env.APP_ORIGIN || "http://localhost:3000",
  sessionSecret: required("SESSION_SECRET", "change-this-secret"),
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPassword: required("ADMIN_PASSWORD", "change-me-now"),
  trustProxy: process.env.TRUST_PROXY === "true",
  dataDir,
  dataFile: path.join(dataDir, "db.json"),
  cookies: {
    secure: process.env.COOKIE_SECURE === "true"
  },
  vpn: {
    serverEndpoint: required("VPN_SERVER_ENDPOINT", "vpn.example.com:51820"),
    serverPublicKey: required("VPN_SERVER_PUBLIC_KEY", "replace-me"),
    serverInterfaceAddress: process.env.VPN_SERVER_INTERFACE_ADDRESS || "10.20.0.1/24",
    clientDns: process.env.VPN_CLIENT_DNS || "1.1.1.1, 8.8.8.8",
    allowedIps: process.env.VPN_ALLOWED_IPS || "0.0.0.0/0, ::/0",
    clientSubnetBase: process.env.VPN_CLIENT_SUBNET_BASE || "10.20.0.",
    clientSubnetStart: Number(process.env.VPN_CLIENT_SUBNET_START || 10),
    interfaceName: process.env.VPN_INTERFACE_NAME || "wg0",
    serverConfigPath: process.env.VPN_SERVER_CONFIG_PATH || "",
    autoApplyPeers: process.env.VPN_AUTO_APPLY_PEERS === "true",
    reloadMode: process.env.VPN_RELOAD_MODE || "manual"
  }
};

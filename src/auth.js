const crypto = require("crypto");

function createPasswordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedValue) {
  const [salt, hash] = storedValue.split(":");
  if (!salt || !hash) {
    return false;
  }

  const calculated = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(calculated, "hex"));
}

function signSession(payload, secret) {
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json, "utf8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

function readSession(token, secret) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encoded, signature] = token.split(".");
  const expected = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");

  if (signature.length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  const pairs = cookieHeader.split(";").map((item) => item.trim()).filter(Boolean);
  const result = {};

  for (const pair of pairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }
    const key = pair.slice(0, separatorIndex);
    const value = pair.slice(separatorIndex + 1);
    result[key] = decodeURIComponent(value);
  }

  return result;
}

function createCsrfToken() {
  return crypto.randomBytes(24).toString("hex");
}

function verifyCsrfToken(received, expected) {
  if (!received || !expected || received.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
}

module.exports = {
  createPasswordHash,
  verifyPassword,
  signSession,
  readSession,
  parseCookies,
  createCsrfToken,
  verifyCsrfToken
};

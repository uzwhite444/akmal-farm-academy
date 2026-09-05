// Ichki yordamchi: admin sessiyasi (imzolangan cookie) va parol tekshiruvi.
// Tashqi kutubxonasiz (Node crypto) — loyihaning "zero-dependency" uslubiga mos.

const crypto = require("crypto");

const COOKIE_NAME = "admin_session";
const SESSION_TTL_SEC = 12 * 60 * 60; // 12 soat

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromB64url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64");
}

function sign(payloadObj) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error("ADMIN_SESSION_SECRET sozlanmagan");
  const payload = b64url(JSON.stringify(payloadObj));
  const sig = b64url(crypto.createHmac("sha256", secret).update(payload).digest());
  return payload + "." + sig;
}

function verify(token) {
  try {
    const secret = process.env.ADMIN_SESSION_SECRET;
    if (!secret || !token) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payload, sig] = parts;
    const expected = b64url(crypto.createHmac("sha256", secret).update(payload).digest());
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const data = JSON.parse(fromB64url(payload).toString("utf8"));
    if (!data.exp || Date.now() / 1000 > data.exp) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function issueCookie(username) {
  const now = Math.floor(Date.now() / 1000);
  const token = sign({ u: username, iat: now, exp: now + SESSION_TTL_SEC });
  return `${COOKIE_NAME}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SEC}`;
}

function clearCookie() {
  return `${COOKIE_NAME}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function readCookie(req) {
  const raw = req.headers.cookie || "";
  const m = raw.match(new RegExp("(?:^|; )" + COOKIE_NAME + "=([^;]+)"));
  return m ? decodeURIComponent(m[1]) : null;
}

// req'dagi sessiyani tekshiradi; yaroqli bo'lsa payload, aks holda null.
function requireSession(req) {
  const token = readCookie(req);
  if (!token) return null;
  return verify(token);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return salt + ":" + hash;
}

function verifyPassword(password, stored) {
  try {
    const [salt, hashHex] = String(stored || "").split(":");
    if (!salt || !hashHex) return false;
    const candidate = crypto.scryptSync(password, salt, 64);
    const expected = Buffer.from(hashHex, "hex");
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch (e) {
    return false;
  }
}

module.exports = { issueCookie, clearCookie, requireSession, hashPassword, verifyPassword, COOKIE_NAME };

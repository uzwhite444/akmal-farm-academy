// Akmal Farm — Taklifnoma :: admin login
// Login/parolni env'dagi qiymatlar bilan solishtiradi (parol scrypt hash
// sifatida saqlanadi, ochiq matnda hech qayerda yo'q). IP bo'yicha
// rate-limit bilan himoyalangan.

const { verifyPassword, issueCookie } = require("../_lib/auth");
const { isLocked, recordAttempt } = require("../_lib/rateLimit");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  try {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    body = body || {};

    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    const { locked, hash } = await isLocked(req);
    if (locked) {
      return res.status(429).json({ error: "too_many_attempts" });
    }

    const expectedUser = process.env.ADMIN_USERNAME || "";
    const expectedHash = process.env.ADMIN_PASSWORD_HASH || "";
    const ok = username && expectedUser && username === expectedUser && verifyPassword(password, expectedHash);

    await recordAttempt(hash, username, !!ok);

    if (!ok) {
      // Login yoki parol — qaysi biri xato ekanini aytmaymiz.
      return res.status(401).json({ error: "invalid_credentials" });
    }

    res.setHeader("Set-Cookie", issueCookie(username));
    return res.status(200).json({ ok: true, username });
  } catch (e) {
    console.error("admin login handler failed:", e.message);
    return res.status(500).json({ error: "server_error" });
  }
};

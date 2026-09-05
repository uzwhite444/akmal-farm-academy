// Ichki yordamchi: login urinishlari uchun IP bo'yicha rate-limit (bruteforce himoyasi).

const crypto = require("crypto");
const { sbSelect, sbInsert } = require("./supabase");
const { clientIp } = require("./net");

const WINDOW_MIN = 15;
const MAX_FAILS = 8;

function ipHash(req) {
  return crypto.createHash("sha256").update(clientIp(req) + "|" + (process.env.IP_SALT || "akmal")).digest("hex");
}

// Diqqat: agar baza/jadval vaqtincha ishlamasa, "fail open" qilamiz —
// login urinishi asosiy tekshiruvga (parol) o'tadi, faqat qo'shimcha
// himoya qatlami vaqtincha o'chadi. Aks holda baza uzilishi butun CMS'ni
// login qilib bo'lmaydigan holga keltiradi.
async function isLocked(req) {
  const hash = ipHash(req);
  try {
    const since = new Date(Date.now() - WINDOW_MIN * 60000).toISOString();
    const rows = await sbSelect(
      "admin_login_attempts",
      `select=id&ip_hash=eq.${hash}&success=eq.false&created_at=gte.${encodeURIComponent(since)}&limit=${MAX_FAILS + 1}`
    );
    return { locked: Array.isArray(rows) && rows.length >= MAX_FAILS, hash };
  } catch (e) {
    console.error("rate-limit check failed, failing open:", e.message);
    return { locked: false, hash };
  }
}

async function recordAttempt(hash, username, success) {
  try {
    await sbInsert("admin_login_attempts", { ip_hash: hash, username: username || null, success: !!success });
  } catch (e) {
    console.error("rate-limit log failed:", e);
  }
}

module.exports = { isLocked, recordAttempt, ipHash };

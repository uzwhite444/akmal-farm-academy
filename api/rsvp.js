// Akmal Farm — Taklifnoma :: RSVP backend (Vercel Serverless Function)
// Guest javobini Supabase'ga yozadi va admin'ga Telegram xabar yuboradi.
// Bog'liqliksiz (global fetch + crypto) — npm install kerak emas.
//
// Vercel → Project Settings → Environment Variables da sozlang:
//   SUPABASE_URL                 (Supabase → Settings → API → Project URL)
//   SUPABASE_SERVICE_ROLE_KEY    (Supabase → Settings → API → service_role — MAXFIY)
//   TELEGRAM_BOT_TOKEN           (BotFather — MAXFIY)
//   TELEGRAM_ADMIN_CHAT_ID       (admin chat_id — @userinfobot orqali oling)
//   IP_SALT                      (ixtiyoriy)

const crypto = require("crypto");
const { clientIp } = require("./_lib/net");

// Anti-spam sozlamalari
const MIN_FILL_MS = 2500;      // < 2.5s to'ldirish = bot
const IP_WINDOW_MIN = 10;      // 10 daqiqa oynasi
const IP_MAX_IN_WINDOW = 5;    // bitta IP dan 10 daqiqada maks. 5 ta
const PHONE_DEDUPE_SEC = 45;   // bir xil telefon 45s ichida takror = rad

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end("ok");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  let raw = req.body;
  if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = {}; } }
  raw = raw || {};

  // Anti-spam #1: honeypot
  if (String(raw.company || "").trim() !== "") return res.status(200).json({ ok: true, skipped: "honeypot" });
  // Anti-spam #2: vaqt tuzog'i
  const elapsed = Number(raw.elapsed || 0);
  if (elapsed > 0 && elapsed < MIN_FILL_MS) return res.status(200).json({ ok: true, skipped: "too_fast" });

  // Validatsiya
  const name = String(raw.name || "").trim().slice(0, 120);
  const phone = String(raw.phone || "").trim().slice(0, 40);
  const attending = Boolean(raw.attending);
  const message = String(raw.message || "").trim().slice(0, 1000);
  let guests = parseInt(String(raw.guests || "0"), 10);
  if (!Number.isFinite(guests) || guests < 0) guests = 0;
  if (guests > 50) guests = 50;
  if (!attending) guests = 0;
  if (name.length < 2) return res.status(400).json({ error: "name_required" });
  if (phone.replace(/\D/g, "").length < 7) return res.status(400).json({ error: "phone_required" });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !KEY) return res.status(500).json({ error: "server_not_configured" });
  const base = SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rsvps";
  const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };

  const ipHash = sha256(clientIp(req) + "|" + (process.env.IP_SALT || "akmal"));

  try {
    // Anti-spam #3: IP rate-limit
    const sinceIp = new Date(Date.now() - IP_WINDOW_MIN * 60000).toISOString();
    const ipRes = await fetch(`${base}?select=id&ip_hash=eq.${ipHash}&created_at=gte.${encodeURIComponent(sinceIp)}&limit=6`, { headers: H });
    const ipRows = await ipRes.json();
    if (Array.isArray(ipRows) && ipRows.length >= IP_MAX_IN_WINDOW) return res.status(429).json({ error: "rate_limited" });

    // Anti-spam #4: telefon dedupe
    const sinceP = new Date(Date.now() - PHONE_DEDUPE_SEC * 1000).toISOString();
    const pRes = await fetch(`${base}?select=id&phone=eq.${encodeURIComponent(phone)}&created_at=gte.${encodeURIComponent(sinceP)}&limit=1`, { headers: H });
    const pRows = await pRes.json();
    if (Array.isArray(pRows) && pRows.length > 0) return res.status(200).json({ ok: true, skipped: "duplicate" });

    // Joriy tadbir lokatsiyasi (hisobot uchun har bir javobga muhrlanadi)
    let locationName = "Qoʻrgʻontepa filiali";
    try {
      const cRes = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/site_content?select=data&id=eq.1&limit=1`, { headers: H });
      if (cRes.ok) {
        const cRows = await cRes.json();
        const ln = cRows && cRows[0] && cRows[0].data && cRows[0].data.event && cRows[0].data.event.location_name;
        if (typeof ln === "string" && ln.trim()) locationName = ln.trim();
      }
    } catch (e) { /* default lokatsiya */ }

    // Bazaga yozish (location bilan; agar 0003 migratsiya hali ishlamagan
    // bo'lsa — location ustunisiz qayta urinamiz, RSVP hech qachon buzilmaydi)
    const rowBase = { name, phone, attending, guests, message: message || null, ip_hash: ipHash };
    async function tryInsert(row) {
      const r = await fetch(base, { method: "POST", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(row) });
      return { ok: r.ok, r };
    }
    let ins = await tryInsert({ ...rowBase, location: locationName });
    if (!ins.ok) {
      const t = await ins.r.text();
      if (/location/i.test(t)) {
        ins = await tryInsert(rowBase);
      } else {
        console.error("insert failed:", t);
        return res.status(500).json({ error: "db_error" });
      }
    }
    if (!ins.ok) {
      console.error("insert failed (retry):", await ins.r.text());
      return res.status(500).json({ error: "db_error" });
    }
    const inserted = await ins.r.json();
    const id = Array.isArray(inserted) && inserted[0] ? inserted[0].id : null;

    // Telegram bildirishnomasi
    const BOT = process.env.TELEGRAM_BOT_TOKEN;
    // Bir nechta qabul qiluvchi: TELEGRAM_ADMIN_CHAT_ID = "id1,id2,id3"
    const CHATS = String(process.env.TELEGRAM_ADMIN_CHAT_ID || "")
      .split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    if (BOT && CHATS.length) {
      const st = attending ? "✅ KELADI / ПРИДЁТ" : "❌ KELMAYDI / НЕ ПРИДЁТ";
      const text = [
        "🎉 <b>Yangi javob — Akmal Farm ochilishi</b>", "", st,
        `📍 ${esc(locationName)}`,
        `👤 <b>${esc(name)}</b>`, `📞 ${esc(phone)}`,
        attending ? `👥 Mehmonlar / Гостей: <b>${guests}</b>` : "",
        message ? `💬 ${esc(message)}` : "",
      ].filter(Boolean).join("\n");
      await Promise.all(CHATS.map(function (chat_id) {
        return fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chat_id, text: text, parse_mode: "HTML", disable_web_page_preview: true }),
        })
          .then(function (tg) { if (!tg.ok) return tg.text().then(function (t) { console.error("telegram failed for " + chat_id + ":", t); }); })
          .catch(function (e) { console.error("telegram error for " + chat_id + ":", e); });
      }));
    } else {
      console.warn("TELEGRAM_BOT_TOKEN / TELEGRAM_ADMIN_CHAT_ID sozlanmagan");
    }

    return res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error("handler error:", e);
    return res.status(500).json({ error: "server_error" });
  }
};

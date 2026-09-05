// Akmal Farm — Taklifnoma :: joriy sayt kontenti (PUBLIC, faqat o'qish)
// Ochiq sayt (app.js) shu yerdan matnlarni oladi. Maxfiy ma'lumot yo'q —
// autentifikatsiya shart emas, lekin yozish (PUT) faqat /api/admin/content'da.

const { sbSelect } = require("./_lib/supabase");
const { DEFAULT_CONTENT } = require("./_lib/contentSchema");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  try {
    const rows = await sbSelect("site_content", "select=data,updated_at&id=eq.1&limit=1");
    const data = Array.isArray(rows) && rows[0] ? rows[0].data : null;
    return res.status(200).json({ ok: true, data: data || DEFAULT_CONTENT, source: data ? "db" : "default" });
  } catch (e) {
    console.error("content fetch failed, serving defaults:", e.message);
    return res.status(200).json({ ok: true, data: DEFAULT_CONTENT, source: "fallback" });
  }
};

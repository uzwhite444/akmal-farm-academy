// Akmal Farm — Taklifnoma :: admin kontent o'qish/yozish (AUTH SHART)
// GET  -> joriy kontentni (tahrirlash uchun) qaytaradi
// PUT  -> qat'iy validatsiyadan o'tkazib, bazani yangilaydi

const { requireSession } = require("../_lib/auth");
const { sbSelect, sbUpsert } = require("../_lib/supabase");
const { DEFAULT_CONTENT, validateAndClean, deepMerge } = require("../_lib/contentSchema");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const session = requireSession(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });

  if (req.method === "GET") {
    try {
      const rows = await sbSelect("site_content", "select=data,updated_at,updated_by&id=eq.1&limit=1");
      const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
      return res.status(200).json({ ok: true, data: row ? row.data : DEFAULT_CONTENT, updated_at: row && row.updated_at, updated_by: row && row.updated_by });
    } catch (e) {
      console.error("admin content GET failed:", e);
      return res.status(500).json({ error: "db_error" });
    }
  }

  if (req.method === "PUT") {
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    const { value, error } = validateAndClean(body || {});
    if (error) return res.status(400).json({ error });

    try {
      const existingRows = await sbSelect("site_content", "select=data&id=eq.1&limit=1");
      const existing = Array.isArray(existingRows) && existingRows[0] ? existingRows[0].data : DEFAULT_CONTENT;
      const merged = deepMerge(existing, value);
      const saved = await sbUpsert(
        "site_content",
        { id: 1, data: merged, updated_at: new Date().toISOString(), updated_by: session.u },
        "id"
      );
      const row = Array.isArray(saved) && saved[0] ? saved[0] : { data: merged };
      return res.status(200).json({ ok: true, data: row.data });
    } catch (e) {
      console.error("admin content PUT failed:", e);
      return res.status(500).json({ error: "db_error" });
    }
  }

  return res.status(405).json({ error: "method_not_allowed" });
};

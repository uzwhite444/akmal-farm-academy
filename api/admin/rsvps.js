// Akmal Farm — Taklifnoma :: RSVP hisoboti (AUTH SHART)
// GET                -> JSON: barcha javoblar + lokatsiyalar bo'yicha jamlanma
// GET ?format=xlsx   -> haqiqiy Excel fayl (.xlsx, kirill buzilmaydi)
// GET ?format=doc    -> Word hujjat (.doc, HTML jadval)
// GET ?format=csv    -> CSV (UTF-8 BOM, ; ajratgich) — zaxira

const { requireSession } = require("../_lib/auth");
const { sbSelect } = require("../_lib/supabase");
const { buildXlsx } = require("../_lib/xlsx");

async function fetchRows() {
  // Eng yangi birinchi; katta ziyofat uchun ham yetarli chegara.
  try {
    return await sbSelect(
      "rsvps",
      "select=name,phone,attending,guests,message,location,created_at&order=created_at.desc&limit=10000"
    );
  } catch (e) {
    // location ustuni yo'q bo'lsa (0003 migratsiya hali ishlamagan) — usiz olamiz,
    // shunda hisobot baribir ishlaydi (lokatsiya "—" bo'lib ko'rinadi).
    if (/location/i.test(e.message || "")) {
      return sbSelect(
        "rsvps",
        "select=name,phone,attending,guests,message,created_at&order=created_at.desc&limit=10000"
      );
    }
    throw e;
  }
}

function summarize(rows) {
  const byLocation = {};
  const totals = { responses: 0, coming_responses: 0, notcoming_responses: 0, coming_people: 0 };
  for (const r of rows) {
    const loc = (r.location && String(r.location).trim()) || "—";
    if (!byLocation[loc]) byLocation[loc] = { location: loc, coming_responses: 0, notcoming_responses: 0, coming_people: 0, total_responses: 0 };
    const g = byLocation[loc];
    g.total_responses++;
    totals.responses++;
    if (r.attending) {
      g.coming_responses++;
      totals.coming_responses++;
      const guests = Number(r.guests) || 0;
      g.coming_people += guests;
      totals.coming_people += guests;
    } else {
      g.notcoming_responses++;
      totals.notcoming_responses++;
    }
  }
  const locations = Object.values(byLocation).sort((a, b) => b.total_responses - a.total_responses);
  return { totals, locations };
}

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  // ; ajratgich, shuning uchun ; " va yangi qatorlarni qo'shtirnoq bilan ekranlaymiz
  if (/[";\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const HEADER = ["Lokatsiya / Локация", "Ism / Имя", "Telefon / Телефон", "Holat / Статус", "Mehmonlar / Гостей", "Izoh / Комментарий", "Sana / Дата"];
function fmtDt(iso) {
  try { return new Date(iso).toLocaleString("ru-RU", { timeZone: "Asia/Tashkent" }); } catch (e) { return String(iso || ""); }
}
function rowToArr(r) {
  return [
    r.location || "—",
    r.name || "",
    r.phone || "",
    r.attending ? "Придёт / Keladi" : "Не придёт / Kelmaydi",
    r.attending ? String(Number(r.guests) || 0) : "0",
    r.message || "",
    fmtDt(r.created_at),
  ];
}
const htmlEsc = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function toCsv(rows) {
  const lines = [HEADER.map(csvCell).join(";")];
  for (const r of rows) lines.push(rowToArr(r).map(csvCell).join(";"));
  // \r\n va UTF-8 BOM
  return "﻿" + lines.join("\r\n") + "\r\n";
}

function toDoc(rows) {
  const s = summarize(rows);
  const body = rows.map((r) => {
    const a = rowToArr(r);
    return "<tr>" + a.map((c, i) => `<td${i === 4 ? ' align="center"' : ""}>${htmlEsc(c)}</td>`).join("") + "</tr>";
  }).join("");
  return "﻿<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Akmal Farm — Hisobot</title>" +
    "<style>body{font-family:Arial,sans-serif;color:#15243c}h1{color:#15315a;font-size:20px;margin:0 0 4px}" +
    ".sub{color:#5b6b85;font-size:12px;margin:0 0 14px}table{border-collapse:collapse;width:100%}" +
    "th,td{border:1px solid #b9c4d6;padding:6px 9px;font-size:12px;text-align:left;vertical-align:top}" +
    "th{background:#15315a;color:#fff;font-size:11px}</style></head><body>" +
    "<h1>Akmal Farm — Javoblar hisoboti</h1>" +
    `<p class="sub">Jami javob: <b>${s.totals.responses}</b> &nbsp;·&nbsp; Keladi (mehmon): <b>${s.totals.coming_people}</b> &nbsp;·&nbsp; Kela olmaydi: <b>${s.totals.notcoming_responses}</b></p>` +
    "<table><tr>" + HEADER.map((h) => `<th>${htmlEsc(h)}</th>`).join("") + "</tr>" + body + "</table></body></html>";
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const session = requireSession(req);
  if (!session) return res.status(401).json({ error: "unauthorized" });
  if (req.method !== "GET") return res.status(405).json({ error: "method_not_allowed" });

  let rows;
  try {
    rows = await fetchRows();
    if (!Array.isArray(rows)) rows = [];
  } catch (e) {
    console.error("rsvps report fetch failed:", e.message);
    return res.status(500).json({ error: "db_error" });
  }

  const format = req.query && req.query.format;
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "xlsx") {
    const buf = buildXlsx([HEADER, ...rows.map(rowToArr)], { sheetName: "Javoblar", widths: [26, 24, 20, 22, 12, 34, 20] });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="akmal-rsvp-${stamp}.xlsx"`);
    return res.status(200).send(buf);
  }
  if (format === "doc") {
    res.setHeader("Content-Type", "application/msword; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="akmal-rsvp-${stamp}.doc"`);
    return res.status(200).send(toDoc(rows));
  }
  if (format === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="akmal-rsvp-${stamp}.csv"`);
    return res.status(200).send(toCsv(rows));
  }

  return res.status(200).json({ ok: true, rows, summary: summarize(rows) });
};

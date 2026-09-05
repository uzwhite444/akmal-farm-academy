// Ichki yordamchi: kontent uchun zaxira (default) qiymatlar + validatsiya.
// Zaxira migratsiyadagi seed bilan bir xil — baza vaqtincha ishlamasa ham
// sayt bo'sh qolmaydi.

const DEFAULT_CONTENT = {
  hero: {
    title_uz: "AKMAL FARM ACADEMY",
    title_ru: "AKMAL FARM ACADEMY",
    lead_uz: "Hurmatli mehmon! Sizni «Akmal Farm Academy»ning yangi Gʻishtxona filiali tantanali ochilish marosimiga taklif etamiz.",
    lead_ru: "Уважаемый гость! Приглашаем Вас на торжественное открытие нового филиала «Akmal Farm Academy» (Ғиштхона филиали).",
  },
  event: {
    location_name: "Ғиштхона филиали",
    date_uz: "7-sentabr 2026",
    date_ru: "7 сентября 2026",
    time_uz: "soat 14:00",
    time_ru: "14:00",
    countdown_target_iso: "2026-09-07T14:00:00+05:00",
    address_uz: "Andijon shahar, Milliy Tiklanish koʻchasi, 77-uy. Moʻljal: 42-maktab koʻchasining boshiga yetmay va 1-damas yoʻnalishida. Ish vaqti: 08:00 - 00:00 (dam olish kunlarisiz).",
    address_ru: "г. Андижан, ул. Миллий Тикланиш, д. 77. Ориентир: недоезжая начала улицы 42-й школы, на пути 1-го дамаса. Время работы: 08:00 - 00:00 (без выходных).",
    map_url: "https://maps.google.com/maps?q=40.778966,72.376469&ll=40.778966,72.376469&z=16",
  },
  footer: {
    sign_uz: "HURMAT BILAN, AKMAL FARM ACADEMY",
    sign_ru: "С уважением, AKMAL FARM ACADEMY",
    phone: "+998-91-290-88-00",
    site: "akmalfarm.uz",
  },
  meta: {
    page_title: "Akmal Farm Academy — Taklifnoma",
  },
};

// har bir maydon uchun: turi + maksimal uzunlik (yoki maxsus tekshiruv)
const FIELDS = {
  "hero.title_uz": { max: 120 }, "hero.title_ru": { max: 120 },
  "hero.lead_uz": { max: 400 }, "hero.lead_ru": { max: 400 },
  "event.location_name": { max: 120 },
  "event.date_uz": { max: 60 }, "event.date_ru": { max: 60 },
  "event.time_uz": { max: 40 }, "event.time_ru": { max: 40 },
  "event.countdown_target_iso": { max: 40, iso: true },
  "event.address_uz": { max: 300 }, "event.address_ru": { max: 300 },
  "event.map_url": { max: 500, url: true },
  "footer.sign_uz": { max: 120 }, "footer.sign_ru": { max: 120 },
  "footer.phone": { max: 40 }, "footer.site": { max: 80 },
  "meta.page_title": { max: 120 },
};

function get(obj, path) {
  return path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);
}
function set(obj, path, value) {
  const keys = path.split(".");
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (typeof cur[keys[i]] !== "object" || cur[keys[i]] === null) cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

// Kiruvchi obyektni qat'iy tekshiradi: faqat ma'lum maydonlar, satr turi,
// uzunlik chegarasi, va URL/ISO-sana formatlari. Notoʻgʻri bo'lsa xato qaytaradi.
function validateAndClean(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "invalid_payload" };
  }
  const out = {};
  for (const path of Object.keys(FIELDS)) {
    const rule = FIELDS[path];
    const raw = get(input, path);
    if (raw === undefined) continue; // qisman yangilashga ruxsat
    if (typeof raw !== "string") return { error: "field_must_be_string:" + path };
    const value = raw.trim().slice(0, rule.max);
    if (!value) return { error: "field_empty:" + path };
    if (rule.url && !/^https:\/\/[^\s"'<>]+$/i.test(value)) return { error: "field_invalid_url:" + path };
    if (rule.iso && Number.isNaN(Date.parse(value))) return { error: "field_invalid_date:" + path };
    set(out, path, value);
  }
  if (Object.keys(out).length === 0) return { error: "no_fields" };
  return { value: out };
}

function deepMerge(base, patch) {
  const result = JSON.parse(JSON.stringify(base));
  (function merge(dst, src) {
    for (const k of Object.keys(src || {})) {
      if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k])) {
        dst[k] = dst[k] && typeof dst[k] === "object" ? dst[k] : {};
        merge(dst[k], src[k]);
      } else {
        dst[k] = src[k];
      }
    }
  })(result, patch);
  return result;
}

module.exports = { DEFAULT_CONTENT, FIELDS, validateAndClean, deepMerge };

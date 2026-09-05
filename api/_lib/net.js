// Ichki yordamchi: mijoz IP manzilini ishonchli olish.
// `x-forwarded-for`ning birinchi qiymatini xom holda ishlatish xavfli —
// ba'zi platformalarda mijoz shu header'ni o'zi yuborib, uni "soxta" qilishi
// mumkin. `x-real-ip` / `x-vercel-forwarded-for` — platforma tomonidan
// qo'yiladigan, mijoz o'zgartira olmaydigan qiymatlar, shuning uchun
// ularga ustuvorlik beramiz; xom `x-forwarded-for` faqat oxirgi chora.
function clientIp(req) {
  const h = req.headers;
  return (
    h["x-real-ip"] ||
    h["x-vercel-forwarded-for"] ||
    String(h["x-forwarded-for"] || "").split(",")[0].trim() ||
    "unknown"
  );
}

module.exports = { clientIp };

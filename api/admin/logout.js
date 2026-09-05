const { clearCookie } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  res.setHeader("Set-Cookie", clearCookie());
  return res.status(200).json({ ok: true });
};

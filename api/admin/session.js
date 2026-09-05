const { requireSession } = require("../_lib/auth");

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const session = requireSession(req);
  if (!session) return res.status(401).json({ ok: false });
  return res.status(200).json({ ok: true, username: session.u, exp: session.exp });
};

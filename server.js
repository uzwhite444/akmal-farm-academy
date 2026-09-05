const express = require("express");
const path = require("path");

const app = express();
const PORT = 3000;

// Middleware to parse incoming JSON and URL-encoded request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Load Vercel serverless function handlers
const apiContent = require("./api/content");
const apiRsvp = require("./api/rsvp");
const apiAdminContent = require("./api/admin/content");
const apiAdminLogin = require("./api/admin/login");
const apiAdminLogout = require("./api/admin/logout");
const apiAdminRsvps = require("./api/admin/rsvps");
const apiAdminSession = require("./api/admin/session");

// Helper wrapper to handle async errors in Vercel handlers
const handle = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Mount API routes
app.all("/api/content", handle(apiContent));
app.all("/api/rsvp", handle(apiRsvp));
app.all("/api/admin/content", handle(apiAdminContent));
app.all("/api/admin/login", handle(apiAdminLogin));
app.all("/api/admin/logout", handle(apiAdminLogout));
app.all("/api/admin/rsvps", handle(apiAdminRsvps));
app.all("/api/admin/session", handle(apiAdminSession));

// Serve static assets from the root directory
// This will automatically serve index.html for "/", /app.js, /assets/*, and /admin/index.html for "/admin/"
app.use(express.static(path.join(__dirname)));

// Route mapping for clean URLs without .html
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin", "index.html"));
});

// General Error Handler
app.use((err, req, res, next) => {
  console.error("Express Error:", err);
  res.status(500).json({ error: "internal_server_error", message: err.message });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

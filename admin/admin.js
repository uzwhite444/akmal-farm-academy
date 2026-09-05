// Akmal Farm — Boshqaruv paneli :: admin.js (CSP-mos, tashqi skript)
(function () {
  "use strict";

  var gate = document.getElementById("gate");
  var app = document.getElementById("app");
  var loginForm = document.getElementById("loginForm");
  var gateStatus = document.getElementById("gateStatus");
  var loginBtn = document.getElementById("loginBtn");
  var contentForm = document.getElementById("contentForm");
  var saveBtn = document.getElementById("saveBtn");
  var saveStatus = document.getElementById("saveStatus");
  var savebarMeta = document.getElementById("savebarMeta");
  var topbarUser = document.getElementById("topbarUser");
  var logoutBtn = document.getElementById("logoutBtn");
  var mapCheckLink = document.getElementById("mapCheckLink");
  var toastEl = document.getElementById("toast");
  var statRow = document.getElementById("statRow");
  var reportLoc = document.getElementById("reportLoc");
  var reportTbody = document.getElementById("reportTbody");
  var reportNote = document.getElementById("reportNote");
  var reportRefresh = document.getElementById("reportRefresh");
  var exportPng = document.getElementById("exportPng");
  var lastReport = null;

  var TZ_SUFFIX = ":00+05:00"; // butun sayt Toshkent (UTC+5) ni qattiq qabul qiladi

  function toast(msg, isErr) {
    toastEl.textContent = msg;
    toastEl.className = "toast show" + (isErr ? " err" : "");
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () { toastEl.className = "toast"; }, 3200);
  }

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ "Content-Type": "application/json" }, opts.headers || {});
    opts.credentials = "same-origin";
    return fetch(path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (body) {
        return { status: r.status, ok: r.ok, body: body };
      });
    });
  }

  function get(obj, path) {
    return path.split(".").reduce(function (o, k) { return o && typeof o === "object" ? o[k] : undefined; }, obj);
  }

  // XSS-xavfsiz: foydalanuvchi kiritgan matnni HTML sifatida emas, matn sifatida chiqaradi.
  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function isoToLocalInput(iso) {
    if (!iso || typeof iso !== "string") return "";
    var m = iso.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/);
    return m ? m[1] : "";
  }
  function localInputToIso(val) {
    if (!val) return "";
    return val + TZ_SUFFIX;
  }

  function updateCounters(form) {
    form.querySelectorAll("[data-max]").forEach(function (el) {
      var max = el.getAttribute("data-max");
      var input = el.closest(".field").querySelector("input,textarea");
      if (input) el.textContent = input.value.length + "/" + max;
    });
  }

  function fillForm(data) {
    contentForm.querySelectorAll("[name]").forEach(function (el) {
      var name = el.getAttribute("name");
      if (name === "event.countdown_target_local") {
        el.value = isoToLocalInput(get(data, "event.countdown_target_iso"));
      } else {
        var v = get(data, name);
        el.value = typeof v === "string" ? v : "";
      }
    });
    updateCounters(contentForm);
    if (mapCheckLink) mapCheckLink.href = get(data, "event.map_url") || "#";
  }

  function collectForm() {
    var out = {};
    contentForm.querySelectorAll("[name]").forEach(function (el) {
      var name = el.getAttribute("name");
      var value = el.value.trim();
      if (name === "event.countdown_target_local") {
        setPath(out, "event.countdown_target_iso", localInputToIso(value));
      } else if (value) {
        setPath(out, name, value);
      }
    });
    return out;
  }
  function setPath(obj, path, value) {
    var keys = path.split(".");
    var cur = obj;
    for (var i = 0; i < keys.length - 1; i++) {
      if (typeof cur[keys[i]] !== "object") cur[keys[i]] = {};
      cur = cur[keys[i]];
    }
    cur[keys[keys.length - 1]] = value;
  }

  function showApp() {
    gate.hidden = true;
    app.hidden = false;
  }
  function showGate() {
    app.hidden = true;
    gate.hidden = false;
    var f = loginForm.querySelector('[name="username"]');
    if (f) f.focus();
  }

  function fmtDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("uz-UZ", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch (e) { return iso; }
  }

  function loadContent() {
    return api("/api/admin/content").then(function (res) {
      if (!res.ok) { showGate(); return; }
      fillForm(res.body.data || {});
      var who = res.body.updated_by ? " · " + res.body.updated_by : "";
      savebarMeta.textContent = res.body.updated_at
        ? "Oxirgi yangilanish: " + fmtDate(res.body.updated_at) + who
        : "Hali saqlanmagan";
      if (topbarUser) topbarUser.textContent = "";
      api("/api/admin/session").then(function (s) {
        if (s.ok && topbarUser) topbarUser.textContent = s.body.username || "";
      });
    });
  }

  function renderReport(body) {
    lastReport = body;
    var sum = body.summary || { totals: {}, locations: [] };
    var t = sum.totals || {};
    statRow.innerHTML =
      '<div class="stat total"><b>' + (t.responses || 0) + '</b><span class="sub">Jami javob &middot; Всего ответов</span></div>' +
      '<div class="stat coming"><b>' + (t.coming_people || 0) + '</b><span class="sub">Keladi (mehmon) &middot; Придут (чел.) — ' + (t.coming_responses || 0) + ' javob</span></div>' +
      '<div class="stat notcoming"><b>' + (t.notcoming_responses || 0) + '</b><span class="sub">Kela olmaydi &middot; Не придут</span></div>';

    reportLoc.innerHTML = (sum.locations || []).map(function (l) {
      return '<div class="loc-row"><div class="loc-name">' + esc(l.location) + '</div>' +
        '<div class="loc-badges">' +
        '<span class="loc-badge yes">✓ ' + l.coming_responses + '</span>' +
        '<span class="loc-badge ppl">' + l.coming_people + ' чел.</span>' +
        '<span class="loc-badge no">✕ ' + l.notcoming_responses + '</span>' +
        '</div></div>';
    }).join("");

    var rows = body.rows || [];
    reportTbody.innerHTML = rows.map(function (r) {
      return "<tr>" +
        '<td class="muted">' + esc(r.location || "—") + "</td>" +
        "<td>" + esc(r.name) + "</td>" +
        "<td>" + esc(r.phone) + "</td>" +
        '<td><span class="pill ' + (r.attending ? "yes" : "no") + '">' + (r.attending ? "Придёт" : "Не придёт") + "</span></td>" +
        '<td class="num">' + (r.attending ? (Number(r.guests) || 0) : "—") + "</td>" +
        '<td class="muted">' + esc(fmtDate(r.created_at)) + "</td>" +
        "</tr>";
    }).join("");

    if (!rows.length) { reportNote.hidden = false; reportNote.className = "report-note"; reportNote.textContent = "Hozircha javoblar yo'q · Пока нет ответов"; }
    else { reportNote.hidden = true; }
  }

  function loadReport() {
    if (!statRow) return;
    return api("/api/admin/rsvps").then(function (res) {
      if (res.status === 401) { showGate(); return; }
      if (!res.ok) {
        statRow.innerHTML = ""; reportLoc.innerHTML = ""; reportTbody.innerHTML = "";
        reportNote.hidden = false; reportNote.className = "report-note";
        reportNote.textContent = "Hisobotni yuklab bo'lmadi. Supabase'da 0002 va 0003 migratsiyalar bajarilganini tekshiring.";
        return;
      }
      renderReport(res.body);
    }).catch(function () {
      if (reportNote) { reportNote.hidden = false; reportNote.textContent = "Tarmoq xatosi"; }
    });
  }

  // ── PNG: hisobot xulosasini rasm qilib yuklab beradi (sof canvas, CSP-mos) ──
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function fitText(ctx, s, maxw) {
    s = String(s == null ? "" : s);
    if (ctx.measureText(s).width <= maxw) return s;
    while (s.length > 1 && ctx.measureText(s + "…").width > maxw) s = s.slice(0, -1);
    return s + "…";
  }
  function generatePng() {
    if (!lastReport) { toast("Avval hisobot yuklansin", true); return; }
    var sum = lastReport.summary || { totals: {}, locations: [] };
    var t = sum.totals || {};
    var locs = sum.locations || [];
    var dpr = 2, W = 760, pad = 32, headerH = 92, statH = 116, statGap = 16;
    var locStart = headerH + 26 + statH + 30;
    var H = locStart + 16 + Math.max(1, locs.length) * 54 + 24;
    var cv = document.createElement("canvas");
    cv.width = W * dpr; cv.height = H * dpr;
    var g = cv.getContext("2d"); g.scale(dpr, dpr);

    g.fillStyle = "#f3f5f9"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#15315a"; g.fillRect(0, 0, W, headerH);
    g.fillStyle = "#fff"; g.font = "800 25px Arial"; g.fillText("Akmal Farm", pad, 40);
    g.fillStyle = "#a9bcd8"; g.font = "400 14px Arial"; g.fillText("Javoblar hisoboti · Отчёт", pad, 62);
    g.fillStyle = "#ff8a95"; g.font = "700 12px Arial"; g.textAlign = "right";
    var ds = ""; try { ds = new Date().toLocaleString("ru-RU"); } catch (e) { }
    g.fillText(ds, W - pad, 40); g.textAlign = "left";

    var sy = headerH + 26, cw = (W - pad * 2 - statGap * 2) / 3;
    function stat(cx, val, label, color, bg) {
      g.fillStyle = bg; roundRect(g, cx, sy, cw, statH, 14); g.fill();
      g.fillStyle = color; g.font = "800 38px Arial"; g.fillText(String(val), cx + 18, sy + 58);
      g.fillStyle = "#5b6b85"; g.font = "600 12px Arial"; g.fillText(fitText(g, label, cw - 30), cx + 18, sy + 90);
    }
    stat(pad, t.responses || 0, "Jami · Всего", "#15315a", "#eef2fb");
    stat(pad + cw + statGap, t.coming_people || 0, "Придут (чел.)", "#1c9c5b", "#eafaf1");
    stat(pad + 2 * (cw + statGap), t.notcoming_responses || 0, "Не придут", "#c41d30", "#fdeef0");

    var ly = locStart;
    g.fillStyle = "#15315a"; g.font = "700 14px Arial"; g.fillText("Lokatsiyalar · По локациям", pad, ly); ly += 16;
    locs.forEach(function (l) {
      g.fillStyle = "#fff"; roundRect(g, pad, ly, W - pad * 2, 46, 10); g.fill();
      g.strokeStyle = "#e3e8f0"; g.lineWidth = 1; roundRect(g, pad, ly, W - pad * 2, 46, 10); g.stroke();
      g.fillStyle = "#15315a"; g.font = "700 13px Arial";
      g.fillText(fitText(g, l.location, W - pad * 2 - 250), pad + 14, ly + 28);
      var bx = W - pad - 12;
      function badge(txt, col, bg) {
        g.font = "700 12px Arial"; var w = g.measureText(txt).width + 18;
        bx -= w; g.fillStyle = bg; roundRect(g, bx, ly + 12, w, 22, 7); g.fill();
        g.fillStyle = col; g.fillText(txt, bx + 9, ly + 27); bx -= 7;
      }
      badge("✕ " + l.notcoming_responses, "#c41d30", "#fdeef0");
      badge(l.coming_people + " чел.", "#15315a", "#eef2fb");
      badge("✓ " + l.coming_responses, "#1c9c5b", "#e8f8ef");
      ly += 54;
    });

    cv.toBlob(function (blob) {
      if (!blob) { toast("PNG yaratib bo'lmadi", true); return; }
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "akmal-hisobot.png";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
      toast("PNG yuklab olindi");
    }, "image/png");
  }

  function checkSession() {
    return api("/api/admin/session").then(function (res) {
      if (res.ok) { showApp(); loadContent(); loadReport(); }
      else { showGate(); }
    });
  }

  loginForm.addEventListener("submit", function (e) {
    e.preventDefault();
    var username = loginForm.username.value.trim();
    var password = loginForm.password.value;
    gateStatus.className = "gate-status";
    gateStatus.textContent = "";
    loginBtn.disabled = true;
    api("/api/admin/login", { method: "POST", body: JSON.stringify({ username: username, password: password }) })
      .then(function (res) {
        loginBtn.disabled = false;
        if (res.ok) {
          gateStatus.className = "gate-status ok";
          gateStatus.textContent = "Kirildi ✓";
          loginForm.password.value = "";
          showApp();
          loadContent();
          loadReport();
        } else if (res.status === 429) {
          gateStatus.textContent = "Juda ko'p urinish. Birozdan so'ng qayta urining.";
        } else {
          gateStatus.textContent = "Login yoki parol noto'g'ri.";
        }
      })
      .catch(function () {
        loginBtn.disabled = false;
        gateStatus.textContent = "Tarmoq xatosi. Qayta urinib ko'ring.";
      });
  });

  logoutBtn.addEventListener("click", function () {
    api("/api/admin/logout", { method: "POST" }).then(function () { showGate(); });
  });

  if (reportRefresh) reportRefresh.addEventListener("click", function () {
    reportRefresh.disabled = true;
    Promise.resolve(loadReport()).then(function () { reportRefresh.disabled = false; });
  });

  if (exportPng) exportPng.addEventListener("click", generatePng);

  contentForm.addEventListener("input", function (e) {
    if (e.target.hasAttribute("maxlength")) updateCounters(contentForm);
    if (e.target.name === "event.map_url" && mapCheckLink) mapCheckLink.href = e.target.value || "#";
  });

  contentForm.addEventListener("submit", function (e) {
    e.preventDefault();
    saveBtn.disabled = true;
    saveStatus.className = "save-status load";
    saveStatus.textContent = "Saqlanmoqda…";
    var payload = collectForm();
    api("/api/admin/content", { method: "PUT", body: JSON.stringify(payload) }).then(function (res) {
      saveBtn.disabled = false;
      if (res.ok) {
        saveStatus.className = "save-status ok";
        saveStatus.textContent = "Saqlandi ✓";
        toast("O'zgarishlar saqlandi va saytda darhol ko'rinadi");
        fillForm(res.body.data || {});
        savebarMeta.textContent = "Oxirgi yangilanish: hozir";
      } else if (res.status === 401) {
        saveStatus.className = "save-status err";
        saveStatus.textContent = "Sessiya tugagan";
        toast("Sessiya tugagan, qayta kiring", true);
        showGate();
      } else {
        saveStatus.className = "save-status err";
        saveStatus.textContent = "Xatolik";
        toast("Saqlashda xatolik yuz berdi", true);
      }
    }).catch(function () {
      saveBtn.disabled = false;
      saveStatus.className = "save-status err";
      saveStatus.textContent = "Tarmoq xatosi";
      toast("Tarmoq xatosi", true);
    });
  });

  checkSession();
})();

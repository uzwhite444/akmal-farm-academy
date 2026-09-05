// Ichki yordamchi: Supabase REST'ga service_role kalit bilan murojaat.
// Agar Supabase sozlanmagan bo'lsa yoki ulanishda xatolik bo'lsa,
// avtomatik ravishda mahalliy JSON faylga (supabase_local.json) yozib/o'qiydi.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { DEFAULT_CONTENT } = require("./contentSchema");

const DB_PATH = path.join(process.cwd(), "supabase_local.json");

function initLocalDb() {
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      site_content: [
        {
          id: 1,
          data: DEFAULT_CONTENT,
          updated_at: new Date().toISOString(),
          updated_by: "seed"
        }
      ],
      rsvps: [],
      admin_login_attempts: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initial, null, 2), "utf8");
  }
}

function readLocalDb() {
  initLocalDb();
  try {
    const content = fs.readFileSync(DB_PATH, "utf8");
    return JSON.parse(content);
  } catch (e) {
    console.error("Local database o'qishda xatolik, tiklanmoqda:", e);
    const initial = {
      site_content: [
        {
          id: 1,
          data: DEFAULT_CONTENT,
          updated_at: new Date().toISOString(),
          updated_by: "seed"
        }
      ],
      rsvps: [],
      admin_login_attempts: []
    };
    return initial;
  }
}

function writeLocalDb(db) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch (e) {
    console.error("Local database yozishda xatolik:", e);
  }
}

async function localSelect(table, queryStr) {
  const db = readLocalDb();
  if (!db[table]) db[table] = [];
  
  let filtered = [...db[table]];
  
  if (queryStr) {
    const params = {};
    queryStr.split("&").forEach(part => {
      const idx = part.indexOf("=");
      if (idx !== -1) {
        const k = part.slice(0, idx);
        const v = part.slice(idx + 1);
        params[k] = decodeURIComponent(v);
      }
    });
    
    // Apply filters
    for (const [k, v] of Object.entries(params)) {
      if (["select", "limit", "order"].includes(k)) continue;
      
      if (v.startsWith("eq.")) {
        const val = v.slice(3);
        filtered = filtered.filter(row => {
          const rowVal = row[k];
          if (typeof rowVal === "boolean") {
            return String(rowVal) === val;
          }
          return String(rowVal) === val;
        });
      } else if (v.startsWith("gte.")) {
        const val = v.slice(4);
        filtered = filtered.filter(row => row[k] >= val);
      } else if (v.startsWith("lte.")) {
        const val = v.slice(4);
        filtered = filtered.filter(row => row[k] <= val);
      }
    }
    
    // Apply sorting
    if (params.order) {
      const parts = params.order.split(".");
      const col = parts[0];
      const dir = parts[1] || "asc";
      filtered.sort((a, b) => {
        if (a[col] < b[col]) return dir === "desc" ? 1 : -1;
        if (a[col] > b[col]) return dir === "desc" ? -1 : 1;
        return 0;
      });
    }
    
    // Apply limit
    if (params.limit) {
      const lim = parseInt(params.limit, 10);
      if (!isNaN(lim)) {
        filtered = filtered.slice(0, lim);
      }
    }
  }
  
  return filtered;
}

async function localInsert(table, row) {
  const db = readLocalDb();
  if (!db[table]) db[table] = [];
  
  const newRow = Object.assign({
    id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2),
    created_at: new Date().toISOString()
  }, row);
  
  db[table].push(newRow);
  writeLocalDb(db);
  return [newRow];
}

async function localUpsert(table, row, onConflict) {
  const db = readLocalDb();
  if (!db[table]) db[table] = [];
  
  const val = row[onConflict];
  const idx = db[table].findIndex(item => item[onConflict] === val);
  
  const updatedRow = Object.assign({
    created_at: new Date().toISOString()
  }, row);
  
  if (idx !== -1) {
    db[table][idx] = Object.assign({}, db[table][idx], updatedRow);
  } else {
    if (!updatedRow.id && onConflict !== "id") {
      updatedRow.id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    }
    db[table].push(updatedRow);
  }
  
  writeLocalDb(db);
  return [updatedRow];
}

let isSupabaseHealthy = true;

function hasCredentials() {
  if (!isSupabaseHealthy) return false;
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return false;

  const urlLower = url.toLowerCase().trim();
  const keyLower = key.toLowerCase().trim();

  // Screen out default placeholder values or incomplete configurations
  if (
    urlLower === "" ||
    urlLower.includes("your-") ||
    urlLower.includes("your_") ||
    urlLower.includes("placeholder") ||
    urlLower.includes("example") ||
    !urlLower.startsWith("http")
  ) {
    return false;
  }

  if (
    keyLower === "" ||
    keyLower.includes("your-") ||
    keyLower.includes("your_") ||
    keyLower.includes("placeholder") ||
    keyLower.includes("example")
  ) {
    return false;
  }

  return true;
}

function baseUrl() {
  const url = process.env.SUPABASE_URL || "";
  return url.replace(/\/$/, "") + "/rest/v1";
}

function headers(extra) {
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return Object.assign({ apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, extra || {});
}

// GET bitta resurs (masalan site_content, id=1)
async function sbSelect(table, query) {
  if (!hasCredentials()) {
    return localSelect(table, query);
  }
  try {
    const r = await fetch(`${baseUrl()}/${table}?${query}`, { headers: headers() });
    if (!r.ok) throw new Error(table + " select failed: " + (await r.text()));
    return await r.json();
  } catch (e) {
    isSupabaseHealthy = false;
    console.warn(`Supabase select failed (${e.message}). Falling back to local JSON database (supabase_local.json) for high performance.`);
    return localSelect(table, query);
  }
}

async function sbInsert(table, row) {
  if (!hasCredentials()) {
    return localInsert(table, row);
  }
  try {
    const r = await fetch(`${baseUrl()}/${table}`, {
      method: "POST",
      headers: headers({ Prefer: "return=representation" }),
      body: JSON.stringify(row),
    });
    if (!r.ok) throw new Error(table + " insert failed: " + (await r.text()));
    return await r.json();
  } catch (e) {
    isSupabaseHealthy = false;
    console.warn(`Supabase insert failed (${e.message}). Bypassing to local JSON database (supabase_local.json).`);
    return localInsert(table, row);
  }
}

async function sbUpsert(table, row, onConflict) {
  if (!hasCredentials()) {
    return localUpsert(table, row, onConflict);
  }
  try {
    const r = await fetch(`${baseUrl()}/${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(row),
    });
    if (!r.ok) throw new Error(table + " upsert failed: " + (await r.text()));
    return await r.json();
  } catch (e) {
    isSupabaseHealthy = false;
    console.warn(`Supabase upsert failed (${e.message}). Bypassing to local JSON database (supabase_local.json).`);
    return localUpsert(table, row, onConflict);
  }
}

module.exports = { sbSelect, sbInsert, sbUpsert };


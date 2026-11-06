// pickLog.js - a permanent record of our picks in YOUR Supabase (optional).
// Each pick is saved BEFORE kick-off and never changed, then settled when the match finishes.
// Needs two environment variables on the SportyPredictz service in Render:
//   SUPABASE_URL          e.g. https://abcdxyz.supabase.co
//   SUPABASE_SERVICE_KEY  the Secret key (sb_secret_...) or the old service_role key (keep it secret, it never goes into any page)
// Without them the site still works and keeps a short record in memory instead.

import { topPick, judge } from "./logic.js";

const BASE = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "";
export const LOG_ON = !!(BASE && KEY);
const TABLE = `${BASE}/rest/v1/pick_log`;

async function sb(url, opt = {}) {
  const r = await fetch(url, {
    ...opt,
    headers: { apikey: KEY, ...(KEY.startsWith("sb_") ? {} : { authorization: `Bearer ${KEY}` }), "content-type": "application/json", ...(opt.headers || {}) },
    signal: AbortSignal.timeout(8000)
  });
  if (!r.ok) throw new Error(`supabase answered ${r.status}`);
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

const logged = new Set();
const settled = new Set();
let lastSettle = 0;
let cached = { at: 0, v: null };

export const status = { on: LOG_ON, lastError: null, logged: 0 };

// Save the pick for every match that has not kicked off yet (first save wins, so it can never be edited later).
export async function logPicks(matches) {
  if (!LOG_ON) return;
  const rows = [];
  for (const m of matches) {
    if (logged.has(m.id) || m.ts <= Date.now() || (m.res && m.res.state !== "pre")) continue;

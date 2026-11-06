// store.js - keeps a copy of matches and results in YOUR Supabase, so pages keep working when odds-api is
// asleep, slow or down. Uses the same SUPABASE_URL and SUPABASE_SERVICE_KEY as pickLog.js.
// Without them this file does nothing and the site behaves exactly as before.

import { dayKey } from "./logic.js";

const BASE = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "";
export const STORE_ON = !!(BASE && KEY);
const TABLE = `${BASE}/rest/v1/match_store`;
const KEEP_DAYS = Number(process.env.STORE_KEEP_DAYS || 14);

export const storeStatus = { on: STORE_ON, saved: 0, loaded: 0, lastSaved: null, lastError: null };

// Once a match's full-time score is saved, a later pre-match copy must never overwrite it.
const finalSaved = new Set();

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

const rowOf = (m, final) => ({
  id: Number(m.id),
  day: dayKey(m.ts),
  kickoff: new Date(m.ts).toISOString(),
  final,
  data: m,
  updated_at: new Date().toISOString()
});

async function upsert(list, final) {
  const rows = list.filter((m) => m && m.id != null && m.ts).map((m) => rowOf(m, final));
  for (let i = 0; i < rows.length; i += 100) {
    await sb(`${TABLE}?on_conflict=id`, {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows.slice(i, i + 100))
    });
  }
  storeStatus.saved += rows.length;
  storeStatus.lastSaved = new Date().toISOString();
  storeStatus.lastError = null;
}

// Upcoming and live matches (the board, and single matches fetched from odds-api).
export async function saveMatches(list) {
  if (!STORE_ON) return;
  const todo = (list || []).filter((m) => m && !finalSaved.has(Number(m.id)));
  try { await upsert(todo, false); } catch (e) { storeStatus.lastError = e.message; console.error("Store save:", e.message); }
}

// Finished matches with their full-time score (odds-api /v1/results).
export async function saveResults(list) {
  if (!STORE_ON) return;
  const done = (list || []).filter((m) => m && m.id != null);
  try {
    await upsert(done, true);
    done.forEach((m) => finalSaved.add(Number(m.id)));
  } catch (e) { storeStatus.lastError = e.message; console.error("Store save results:", e.message); }
}

const rowsToMatches = (rows) => (rows || []).map((r) => r.data).filter(Boolean);

// Matches whose kick-off day is between two dates (inclusive). Used to warm the board on a cold start.
export async function loadMatchesBetween(fromKey, toKey) {
  if (!STORE_ON) return [];
  try {
    const rows = await sb(`${TABLE}?and=(day.gte.${fromKey},day.lte.${toKey})&select=data&order=kickoff.asc&limit=1000`);
    const list = rowsToMatches(rows);
    storeStatus.loaded += list.length;
    return list;
  } catch (e) { storeStatus.lastError = e.message; return []; }
}

// One match by id, used when odds-api no longer knows it.
export async function loadMatch(id) {
  if (!STORE_ON) return null;
  try {
    const rows = await sb(`${TABLE}?id=eq.${Number(id)}&select=data&limit=1`);
    return rowsToMatches(rows)[0] || null;
  } catch (e) { storeStatus.lastError = e.message; return null; }
}

// Finished matches from the last few days. Cached for a minute, and the old copy is kept if Supabase is slow.
let finCache = { at: 0, v: [] };
export async function loadFinished(days = 3) {
  if (!STORE_ON) return [];
  if (Date.now() - finCache.at < 60 * 1000) return finCache.v;
  try {
    const from = dayKey(Date.now() - days * 864e5);
    const rows = await sb(`${TABLE}?final=eq.true&day=gte.${from}&select=data&order=kickoff.desc&limit=200`);
    finCache = { at: Date.now(), v: rowsToMatches(rows) };
    return finCache.v;
  } catch (e) { storeStatus.lastError = e.message; return finCache.v; }
}

// Removes rows older than STORE_KEEP_DAYS so the table stays small.
export async function pruneStore() {
  if (!STORE_ON) return;
  try {
    const cut = dayKey(Date.now() - KEEP_DAYS * 864e5);
    await sb(`${TABLE}?day=lt.${cut}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  } catch (e) { storeStatus.lastError = e.message; }
}

export function startStoreJanitor() {
  if (!STORE_ON) return;
  setTimeout(pruneStore, 60 * 1000).unref?.();
  setInterval(pruneStore, 6 * 3600 * 1000).unref?.();
}

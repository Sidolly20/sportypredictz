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
    const tp = topPick(m);
    if (!tp) continue;
    rows.push({ match_id: m.id, kickoff: new Date(m.ts).toISOString(), league: m.league.name, home: m.home.name, away: m.away.name, pick_k: tp.k, pick_label: tp.label, pick_pct: tp.pct, pick_odd: tp.odd });
  }
  if (!rows.length) return;
  try {
    await sb(`${TABLE}?on_conflict=match_id`, { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify(rows) });
    rows.forEach((r) => logged.add(r.match_id));
    status.logged += rows.length;
    status.lastError = null;
  } catch (e) { status.lastError = e.message; console.error("Pick log:", e.message); }
}

// When a match has finished, work out whether the saved pick won and store the score.
export async function settleFinished(matches) {
  if (!LOG_ON || Date.now() - lastSettle < 60 * 1000) return;
  const done = new Map(matches.filter((m) => m.res && m.res.state === "ft").map((m) => [m.id, m]));
  if (!done.size) return;
  lastSettle = Date.now();
  try {
    const open = await sb(`${TABLE}?result=is.null&select=match_id,pick_k&limit=300`);
    for (const r of open || []) {
      const m = done.get(Number(r.match_id));
      if (!m || settled.has(m.id)) continue;
      const result = judge(r.pick_k, m.res.h, m.res.a, true);
      if (!result) continue;
      await sb(`${TABLE}?match_id=eq.${r.match_id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ home_goals: m.res.h, away_goals: m.res.a, result }) });
      settled.add(m.id);
      cached = { at: 0, v: null };
    }
    status.lastError = null;
  } catch (e) { status.lastError = e.message; console.error("Pick settle:", e.message); }
}

const GROUP = (k) => (["1", "X", "2"].includes(k) ? "Match result" : ["1X", "X2", "12"].includes(k) ? "Double chance" : ["GG", "NG"].includes(k) ? "Both teams to score" : "Goals");

// list items look like { m, pick:{k,label,pct,odd}, h, a, state }
export function summarise(list) {
  const won = list.filter((r) => r.state === "won").length;
  const by = new Map();
  for (const r of list) {
    const g = GROUP(r.pick.k);
    const x = by.get(g) || { name: g, won: 0, total: 0 };
    x.total++; if (r.state === "won") x.won++;
    by.set(g, x);
  }
  return {
    list, won, total: list.length, rate: list.length ? Math.round((won / list.length) * 100) : null,
    groups: [...by.values()].map((x) => ({ ...x, rate: Math.round((x.won / x.total) * 100) })).sort((a, b) => b.total - a.total)
  };
}

export async function fetchRecord(days = 14) {
  if (!LOG_ON) return null;
  if (cached.v && Date.now() - cached.at < 60 * 1000) return cached.v;
  try {
    const since = new Date(Date.now() - days * 864e5).toISOString();
    const rows = await sb(`${TABLE}?kickoff=gte.${since}&result=not.is.null&select=*&order=kickoff.desc&limit=500`);
    const list = (rows || []).map((r) => ({
      m: { id: Number(r.match_id), ts: Date.parse(r.kickoff), kickoff: r.kickoff, league: { name: r.league }, home: { name: r.home }, away: { name: r.away } },
      pick: { k: r.pick_k, label: r.pick_label, pct: Number(r.pick_pct), odd: r.pick_odd === null ? null : Number(r.pick_odd) },
      h: r.home_goals, a: r.away_goals, state: r.result
    }));
    cached = { at: Date.now(), v: summarise(list) };
    return cached.v;
  } catch (e) { status.lastError = e.message; return null; }
}

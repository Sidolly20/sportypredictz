// accas.js - one accumulator per bet size per day.
// - Built automatically (and never gives up: see buildAccaSure in logic.js).
// - Kept steady: once any leg has kicked off, the legs are frozen so scores and results show on the card.
// - Can be set by hand from /admin. A hand-made slip always wins over the automatic one.
// Saved in Supabase table acca_slips when SUPABASE_URL and SUPABASE_SERVICE_KEY are set. Without them it lives in memory
// only, so a restart of the site forgets it (the automatic slip is simply rebuilt).

import { buildAccaSure, marketsOf, pickState, todayKey, dayKey, addDays } from "./logic.js";

const BASE = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || "";
const ON = !!(BASE && KEY);
const TABLE = `${BASE}/rest/v1/acca_slips`;
export const accaStatus = { on: ON, loaded: 0, saved: 0, lastError: null };

const state = new Map(); // "day|slug" -> { day, slug, mode, frozen, tier, legs }
let latest = new Map();  // board matches by id (with live score and result attached)
let scoreFn = (m) => m;

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

export async function loadAccas() {
  if (!ON) return;
  try {
    const t = todayKey();
    const rows = await sb(`${TABLE}?day=in.(${t},${addDays(t, 1)})&select=*`);
    for (const r of rows || []) state.set(`${r.day}|${r.slug}`, { day: r.day, slug: r.slug, mode: r.mode, frozen: !!r.frozen, tier: r.tier || 0, legs: r.legs || [] });
    accaStatus.loaded = (rows || []).length;
    accaStatus.lastError = null;
  } catch (e) { accaStatus.lastError = e.message; }
}

function persist(rec) {
  if (!ON) return;
  sb(`${TABLE}?on_conflict=day,slug`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ day: rec.day, slug: rec.slug, mode: rec.mode, frozen: rec.frozen, tier: rec.tier || 0, legs: rec.legs, updated_at: new Date().toISOString() }])
  }).then(() => { accaStatus.saved++; accaStatus.lastError = null; }).catch((e) => { accaStatus.lastError = e.message; });
}
function unpersist(day, slug) {
  if (!ON) return;
  sb(`${TABLE}?day=eq.${encodeURIComponent(day)}&slug=eq.${encodeURIComponent(slug)}`, { method: "DELETE" }).catch((e) => { accaStatus.lastError = e.message; });
}

// Called on every page request with the current board (live scores and results already attached).
export function setAccaContext({ matches, scoresFor }) {
  latest = new Map((matches || []).map((m) => [Number(m.id), m]));
  if (typeof scoresFor === "function") scoreFn = scoresFor;
}

const slimMatch = (m) => ({ id: m.id, ts: m.ts, kickoff: m.kickoff || null, home: m.home, away: m.away, league: m.league });
const slimLeg = (l) => ({ id: l.m.id, k: l.k, label: l.label, pct: l.pct, odd: l.odd, calc: !!l.calc, type: l.type || "pick", snap: slimMatch(l.m) });

// A stored leg back into a leg with the live match attached. Prices refresh while the match has not started.
function hydrate(leg) {
  const m = latest.get(Number(leg.id)) || scoreFn(leg.snap);
  let { pct, odd, label, calc } = leg;
  if (!m.res || m.res.state === "pre") {
    const d = Object.values(marketsOf(m)).flat().find((x) => x.k === leg.k);
    if (d && Number(d.odd) > 1) { odd = d.odd; if (Number.isFinite(Number(d.pct))) pct = d.pct; label = d.pick || label; calc = !!d.calc; }
  }
  return { m, k: leg.k, label, pct, odd, calc, type: leg.type };
}

function pack(rec) {
  const legs = rec.legs.map(hydrate).sort((a, b) => a.m.ts - b.m.ts);
  if (!legs.length) return null;
  const total = legs.reduce((p, l) => p * Number(l.odd), 1);
  const states = legs.map((l) => pickState(l.m, l.k));
  const settled = legs.every((l) => l.m.res && l.m.res.state === "ft");
  const result = states.includes("lost") ? "lost" : settled && states.every((s) => s === "won") ? "won" : null;
  const days = new Set(legs.map((l) => dayKey(l.m.ts)));
  return { legs, total, day: days.size === 1 ? [...days][0] : null, tier: rec.tier || 0, manual: rec.mode === "manual", result };
}

const keyOf = (slug, day = todayKey()) => `${day}|${slug}`;
const sig = (legs) => legs.map((l) => `${l.id}:${l.k}`).join(",");

// The slip to show for one bet size. `upcoming` = matches that have not kicked off.
export function resolveAcca(cat, upcoming) {
  const key = keyOf(cat.slug);
  let rec = state.get(key);
  if (rec && (rec.mode === "manual" || rec.frozen)) return pack(rec);
  // A leg counts as started if the board says so, or if its kick-off time has passed and the board no longer lists it.
  const started = (l) => { const m = latest.get(Number(l.id)); return m ? !!(m.res && m.res.state !== "pre") : !!(l.snap && l.snap.ts && l.snap.ts <= Date.now()); };
  if (rec && rec.legs.some(started)) {
    rec.frozen = true;
    persist(rec);
    return pack(rec);
  }
  const built = buildAccaSure(upcoming, cat.acca.target, cat.acca.legs);
  if (built) {
    const legs = built.legs.map(slimLeg);
    if (!rec || sig(rec.legs) !== sig(legs)) {
      rec = { day: todayKey(), slug: cat.slug, mode: "auto", frozen: false, tier: built.tier, legs };
      state.set(key, rec);
      persist(rec);
    } else rec.tier = built.tier;
    return pack(rec);
  }
  return rec ? pack(rec) : null;
}

export const recordFor = (slug) => state.get(keyOf(slug)) || null;

// ---------- hand-made slips (admin) ----------
function seedLegs(cat, upcoming) {
  const rec = state.get(keyOf(cat.slug));
  if (rec) return rec.legs.slice();
  const a = resolveAcca(cat, upcoming);
  return a ? a.legs.map(slimLeg) : [];
}
function saveManual(cat, legs) {
  const key = keyOf(cat.slug);
  if (!legs.length) { state.delete(key); unpersist(todayKey(), cat.slug); return; }
  const rec = { day: todayKey(), slug: cat.slug, mode: "manual", frozen: true, tier: 0, legs };
  state.set(key, rec);
  persist(rec);
}
export function addLeg(cat, upcoming, match, k) {
  const d = Object.values(marketsOf(match)).flat().find((x) => x.k === k && Number(x.odd) > 1);
  if (!d) return false;
  const legs = seedLegs(cat, upcoming).filter((l) => Number(l.id) !== Number(match.id));
  if (legs.length >= 20) return false;
  legs.push({ id: match.id, k: d.k, label: d.pick, pct: Number.isFinite(Number(d.pct)) ? Number(d.pct) : 0, odd: Number(d.odd), calc: !!d.calc, type: "pick", snap: slimMatch(match) });
  saveManual(cat, legs);
  return true;
}
export function removeLeg(cat, upcoming, matchId) {
  const legs = seedLegs(cat, upcoming);
  const next = legs.filter((l) => Number(l.id) !== Number(matchId));
  if (next.length === legs.length) return false;
  saveManual(cat, next);
  return true;
}
// Back to the automatic slip.
export function resetAuto(cat) {
  state.delete(keyOf(cat.slug));
  unpersist(todayKey(), cat.slug);
}

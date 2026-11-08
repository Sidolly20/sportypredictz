// logic.js - shared helpers: dates, formatting, markets, and the prediction categories.

export const SITE_TZ = process.env.SITE_TZ || "Africa/Lagos";

// ---------- small helpers ----------
export const num = (v) => (v === null || v === undefined || v === "" || Number.isNaN(Number(v)) ? null : Number(v));

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const fmtOdd = (v) => {
  const n = num(v);
  return n && n > 1 ? n.toFixed(2) : "–";
};
export const pctTxt = (v) => (num(v) === null ? "–" : `${Math.round(num(v))}%`);

export function slugify(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70) || "match";
}

export const initials = (name) =>
  String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

// ---------- dates (all in the site's timezone) ----------
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: SITE_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const clockFmt = new Intl.DateTimeFormat("en-GB", { timeZone: SITE_TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const longFmt = new Intl.DateTimeFormat("en-GB", { timeZone: SITE_TZ, weekday: "long", day: "numeric", month: "long" });
const shortFmt = new Intl.DateTimeFormat("en-GB", { timeZone: SITE_TZ, weekday: "short", day: "numeric", month: "short" });

export const dayKey = (ts) => dayFmt.format(new Date(ts));
export const clock = (ts) => clockFmt.format(new Date(ts));
export const longDate = (ts) => longFmt.format(new Date(ts));
export const shortDate = (ts) => shortFmt.format(new Date(ts));
// Date and time for match cards: "Sat 8 Nov · 20:00" (West Africa Time), so finished, live and upcoming games are all dated.
export const kickLabel = (ts) => `${shortDate(ts)} · ${clock(ts)}`;
export const todayKey = () => dayKey(Date.now());
export const addDays = (key, n) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const keyToTs = (key) => new Date(`${key}T12:00:00Z`).getTime();

// Kickoff strings can arrive without a timezone. Treat those as UTC.
export function kickDate(s) {
  if (!s) return null;
  let t = String(s).trim().replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(t)) t += "Z";
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function normMatch(m) {
  const k = kickDate(m.kickoff);
  return {
    ...m,
    id: Number(m.id),
    ts: k ? k.getTime() : 0,
    kickoff: k ? k.toISOString() : m.kickoff || null,
    league: { id: m.league?.id ?? null, name: m.league?.name || "Other football", logo: m.league?.logo || null },
    home: { id: m.home?.id ?? null, name: m.home?.name || "Home", logo: m.home?.logo || null },
    away: { id: m.away?.id ?? null, name: m.away?.name || "Away", logo: m.away?.logo || null }
  };
}

// ---------- paths ----------
export const matchPath = (m) => `/match/${m.id}/${slugify(`${m.home.name} vs ${m.away.name}`)}`;
export const leaguePath = (lg) => `/leagues/${slugify(lg.name)}-${lg.id}`;
export const parseLeagueSlug = (slug) => {
  const x = /-(\d+)$/.exec(slug || "");
  return x ? Number(x[1]) : null;
};

// ---------- league ordering (big leagues first) ----------
const RANKS = [
  [/^(english |england )?premier league$/i, 1],
  [/champions league/i, 2],
  [/^(la ?liga|laliga|primera division)$/i, 3],
  [/^serie a$/i, 4],
  [/^bundesliga$/i, 5],
  [/^ligue 1$/i, 6],
  [/europa league/i, 7],
  [/conference league/i, 8],
  [/eredivisie/i, 9],
  [/primeira liga/i, 10],
  [/brasileir/i, 11],
  [/major league soccer|^mls$/i, 12],
  [/championship$/i, 13],
  [/npfl|nigeria/i, 14],
  [/world cup|nations league|european championship|africa cup|afcon|copa /i, 15]
];
export function leagueRank(name) {
  const n = String(name || "");
  for (const [re, r] of RANKS) if (re.test(n)) return r;
  return 100;
}
export const byLeague = (a, b) => leagueRank(a.name) - leagueRank(b.name) || String(a.name).localeCompare(String(b.name));

export function groupByLeague(list) {
  const map = new Map();
  for (const m of list) {
    const key = m.league.id ?? m.league.name;
    if (!map.has(key)) map.set(key, { league: m.league, matches: [] });
    map.get(key).matches.push(m);
  }
  const groups = [...map.values()];
  groups.forEach((g) => g.matches.sort((a, b) => a.ts - b.ts));
  return groups.sort((a, b) => byLeague(a.league, b.league));
}

// ---------- model maths ----------
export const edgeOf = (pct, odd) => {
  const p = num(pct), o = num(odd);
  return p !== null && o && o > 1 ? (p / 100) * o - 1 : null;
};

export function bestSide(m) {
  const p = m.prediction;
  if (!p) return null;
  const c = [
    { k: "1", pct: num(p.home_win_pct), label: `${m.home.name} to win`, odd: num(m.odds?.home_win) },
    { k: "X", pct: num(p.draw_pct), label: "Draw", odd: num(m.odds?.draw) },
    { k: "2", pct: num(p.away_win_pct), label: `${m.away.name} to win`, odd: num(m.odds?.away_win) }
  ].filter((x) => x.pct !== null);
  return c.length ? c.reduce((a, b) => (b.pct > a.pct ? b : a)) : null;
}

// One pick for every match, if the model is confident enough. Order: match result (45%+),
// then goals / both teams score (55%+), then double chance (70%+). Otherwise there is no pick.
export const PICK_MIN = { side: 45, goals: 55, btts: 55, dc: 70 };
export function topPick(m) {
  const p = m.prediction;
  if (!p || !m.odds) return null;
  const mk = marketsOf(m);
  const ok = (d, min) => d && num(d.pct) !== null && num(d.odd) > 1 && d.pct >= min;
  const mk1 = mk["1x2"].filter((d) => ok(d, PICK_MIN.side)).sort((a, b) => b.pct - a.pct)[0];
  const others = [
    ...mk.goals.filter((d) => ["O2.5", "U2.5"].includes(d.k) && ok(d, PICK_MIN.goals)),
    ...mk.btts.filter((d) => d.k === "GG" && ok(d, PICK_MIN.btts) || d.k === "NG" && ok(d, PICK_MIN.btts + 5))
  ].sort((a, b) => b.pct - a.pct)[0];
  const dcs = mk.dc.filter((d) => ok(d, PICK_MIN.dc)).sort((a, b) => b.pct - a.pct)[0];
  const d = mk1 || others || dcs;
  return d ? { k: d.k, label: d.pick, pct: d.pct, odd: num(d.odd), calc: !!d.calc } : null;
}

const inv = (...odds) => {
  const xs = odds.map(num);
  return xs.every((x) => x && x > 1) ? 1 / xs.reduce((s, x) => s + 1 / x, 0) : null;
};

// The market buttons shown on every match row, grouped by tab.
export function marketsOf(m) {
  const o = m.odds || {};
  const p = m.prediction || {};
  const h = m.home.name, a = m.away.name;
  // Over 3.5 must be clearly dearer and less likely than Over 2.5. If the feed says otherwise, the number is not trusted.
  const o35ok = num(o.over_35_goals) !== null && o.over_35_goals >= 1.8 && (num(o.over_25_goals) === null || o.over_35_goals >= o.over_25_goals + 0.25) && (num(p.over_35_pct) === null || num(p.over_25_pct) === null || p.over_35_pct < p.over_25_pct);
  const dc = (x, y) => { const v = inv(x, y); return v && v > 1 ? +v.toFixed(2) : null; };
  return {
    "1x2": [
      { k: "1", label: "1", odd: o.home_win, pick: `${h} to win`, pct: p.home_win_pct },
      { k: "X", label: "X", odd: o.draw, pick: "Draw", pct: p.draw_pct },
      { k: "2", label: "2", odd: o.away_win, pick: `${a} to win`, pct: p.away_win_pct }
    ],
    goals: [
      { k: "O1.5", label: "Over 1.5", odd: o.over_15_goals, pick: "Over 1.5 goals", pct: p.over_15_pct },
      { k: "O2.5", label: "Over 2.5", odd: o.over_25_goals, pick: "Over 2.5 goals", pct: p.over_25_pct },
      { k: "U2.5", label: "Under 2.5", odd: o.under_25_goals, pick: "Under 2.5 goals", pct: num(p.over_25_pct) === null ? null : 100 - p.over_25_pct },
      { k: "O3.5", label: "Over 3.5", odd: o35ok ? o.over_35_goals : null, pick: "Over 3.5 goals", pct: o35ok ? p.over_35_pct : null },
      { k: "U3.5", label: "Under 3.5", odd: o.under_35_goals ?? null, pick: "Under 3.5 goals", pct: num(p.over_35_pct) === null ? null : 100 - p.over_35_pct }
    ],
    btts: [
      { k: "GG", label: "Both score", odd: o.btts_yes, pick: "Both teams to score", pct: p.btts_yes_pct },
      { k: "NG", label: "One or none", odd: o.btts_no, pick: "Both teams to score: No", pct: num(p.btts_yes_pct) === null ? null : 100 - p.btts_yes_pct }
    ],
    dc: [
      { k: "1X", label: "1X", odd: dc(o.home_win, o.draw), pick: `${h} or draw`, calc: true, pct: num(p.home_win_pct) === null ? null : p.home_win_pct + p.draw_pct },
      { k: "12", label: "12", odd: dc(o.home_win, o.away_win), pick: `${h} or ${a}`, calc: true, pct: num(p.home_win_pct) === null ? null : p.home_win_pct + p.away_win_pct },
      { k: "X2", label: "X2", odd: dc(o.draw, o.away_win), pick: `Draw or ${a}`, calc: true, pct: num(p.away_win_pct) === null ? null : p.away_win_pct + p.draw_pct }
    ]
  };
}

export const MARKET_TABS = [
  { id: "1x2", name: "Match result" },
  { id: "goals", name: "Goals" },
  { id: "btts", name: "Both teams score" },
  { id: "dc", name: "Double chance" }
];

// The market's own chance for a pick after taking the bookmaker margin out (in percent).
export function fairOf(m, k) {
  const o = m.odds || {};
  const pair = (a, b) => { const x = num(a), y = num(b); return x > 1 && y > 1 ? (1 / x) / (1 / x + 1 / y) * 100 : null; };
  if (k === "1" || k === "X" || k === "2") {
    const h = num(o.home_win), d = num(o.draw), a = num(o.away_win);
    if (!(h > 1 && d > 1 && a > 1)) return null;
    const t = 1 / h + 1 / d + 1 / a;
    return (1 / ({ "1": h, X: d, "2": a }[k])) / t * 100;
  }
  if (k === "O2.5") return pair(o.over_25_goals, o.under_25_goals);
  if (k === "U2.5") return pair(o.under_25_goals, o.over_25_goals);
  if (k === "GG") return pair(o.btts_yes, o.btts_no);
  if (k === "NG") return pair(o.btts_no, o.btts_yes);
  return null;
}

// ---------- live scores, full time and "did the pick win?" ----------
const FINISHED = /finish|ended|^ft$|full.?time|after/i;
const HALFTIME = /half.?time|^ht$|break/i;
const scoreOfRaw = (x) => (x && x.score ? [num(x.score.home), num(x.score.away)] : [null, null]);
const liveLabel = (x) => (HALFTIME.test(`${x.status || ""} ${x.period || ""}`) ? "HT" : x.minute !== null && x.minute !== undefined && x.minute !== "" ? `${x.minute}'` : "LIVE");

// state: pre (not started) | live | ft | wait (kick-off time passed, no score yet)
// When each live match's minute last changed. If the minute has not moved for a while, the feed has likely stalled,
// so the label says so instead of looking live.
const minuteSeen = new Map();
const STALE_MIN = 4;

// No match stays "live" longer than this after kick-off, whatever a feed still says (stale data protection).
const LIVE_MAX_MS = 2.75 * 3600e3;

export function scoreInfo(m, lv, rs, now = Date.now()) {
  const kick = m.ts || (lv && lv.ts) || 0;
  if (lv && !FINISHED.test(String(lv.status || "")) && !(kick && now - kick > LIVE_MAX_MS)) {
    const [h, a] = scoreOfRaw(lv);
    const base = liveLabel(lv);
    const key = String(lv.id ?? m.id), min = String(lv.minute ?? "");
    const seen = minuteSeen.get(key);
    let stale = 0;
    if (!seen || seen.min !== min) minuteSeen.set(key, { min, at: now });
    else stale = Math.floor((now - seen.at) / 60000);
    const label = base !== "HT" && stale >= STALE_MIN ? `${base} · no update ${stale}m` : base;
    return { state: "live", h, a, label, stale };
  }
  const done = rs || (lv && FINISHED.test(String(lv.status || "")) ? lv : null);
  if (done) {
    const [h, a] = scoreOfRaw(done);
    if (h !== null && a !== null) return { state: "ft", h, a, label: "FT" };
  }
  if (m.ts && m.ts <= now) return { state: "wait", h: null, a: null, label: now - m.ts < LIVE_MAX_MS ? "Started" : "Pending" };
  return { state: "pre", h: null, a: null, label: "" };
}

export function annotate(matches, liveList, resultList, now = Date.now()) {
  const L = new Map((liveList || []).map((x) => [Number(x.id), x]));
  const R = new Map((resultList || []).map((x) => [Number(x.id), x]));
  return matches.map((m) => ({ ...m, res: scoreInfo(m, L.get(m.id), R.get(m.id), now) }));
}

export const scoreMap = (matches) => Object.fromEntries(matches.filter((m) => m.res && m.res.state !== "pre").map((m) => [m.id, [m.res.state, m.res.h, m.res.a, m.res.label]]));

// Did a pick win? final=true at full time. While live: on/off = winning/losing right now, wait = undecided.
export function judge(k, h, a, final) {
  if (h === null || h === undefined || a === null || a === undefined) return null;
  const t = h + a, draw = h === a;
  const side = { "1": h > a, X: draw, "2": a > h, "1X": h >= a, X2: a >= h, "12": !draw }[k];
  if (side !== undefined) return final ? (side ? "won" : "lost") : (side ? "on" : "off");
  const line = { "O1.5": 1.5, "O2.5": 2.5, "O3.5": 3.5, "U2.5": 2.5 }[k];
  if (line !== undefined) {
    if (k[0] === "O") return t > line ? "won" : final ? "lost" : "wait";
    return t > line ? "lost" : final ? "won" : "wait";
  }
  if (k === "GG") return h > 0 && a > 0 ? "won" : final ? "lost" : "wait";
  if (k === "NG") return h > 0 && a > 0 ? "lost" : final ? "won" : "wait";
  return null;
}
export const PICK_TXT = { won: "Won", lost: "Lost", on: "Winning", off: "Losing", wait: "In play" };
export function pickState(m, k) {
  const r = m.res;
  if (!k || !r || (r.state !== "live" && r.state !== "ft")) return null;
  return judge(k, r.h, r.a, r.state === "ft");
}

// ---------- prediction categories ----------
const item = (m, k, label, pct, odd, calc = false) => ({
  m, k, label, pct: num(pct), odd: num(odd), calc, edge: calc ? null : edgeOf(pct, odd)
});

// Best "model above market" pick in a match. min = smallest gap (model chance / fair market chance - 1) to count.
function valuePick(m, min) {
  const o = m.odds, p = m.prediction;
  if (!o || !p) return null;
  const cands = [
    ["1", `${m.home.name} to win`, p.home_win_pct, o.home_win],
    ["X", "Draw", p.draw_pct, o.draw],
    ["2", `${m.away.name} to win`, p.away_win_pct, o.away_win],
    ["O2.5", "Over 2.5 goals", p.over_25_pct, o.over_25_goals],
    ["U2.5", "Under 2.5 goals", num(p.over_25_pct) === null ? null : 100 - p.over_25_pct, o.under_25_goals],
    ["GG", "Both teams to score", p.btts_yes_pct, o.btts_yes],
    ["NG", "Both teams to score: No", num(p.btts_yes_pct) === null ? null : 100 - p.btts_yes_pct, o.btts_no]
  ].map(([k, label, pct, odd]) => {
    const it = item(m, k, label, pct, odd);
    const fair = fairOf(m, k);
    it.edge = fair && it.pct !== null ? it.pct / fair - 1 : null;
    it.vs = fair;
    return it;
  }).filter((x) => x.pct !== null && x.odd && x.odd <= 6 && x.pct >= 30 && x.edge !== null && x.edge >= min);
  return cands.length ? cands.reduce((a, b) => (b.edge > a.edge ? b : a)) : null;
}

export const PICKERS = {
  "banker-picks": (m) => {
    const b = bestSide(m);
    return b && b.pct >= 62 ? item(m, b.k, b.label, b.pct, b.odd) : null;
  },
  "home-wins": (m) => {
    const pct = num(m.prediction?.home_win_pct);
    return pct !== null && pct >= 50 ? item(m, "1", `${m.home.name} to win`, pct, m.odds?.home_win) : null;
  },
  "away-wins": (m) => {
    const pct = num(m.prediction?.away_win_pct);
    return pct !== null && pct >= 42 ? item(m, "2", `${m.away.name} to win`, pct, m.odds?.away_win) : null;
  },
  "draws": (m) => {
    const pct = num(m.prediction?.draw_pct);
    return pct !== null && pct >= 28 ? item(m, "X", "Draw", pct, m.odds?.draw) : null;
  },
  "over-2-5-goals": (m) => {
    const pct = num(m.prediction?.over_25_pct);
    return pct !== null && pct >= 55 ? item(m, "O2.5", "Over 2.5 goals", pct, m.odds?.over_25_goals) : null;
  },
  "under-2-5-goals": (m) => {
    const o = num(m.prediction?.over_25_pct);
    return o !== null && 100 - o >= 55 ? item(m, "U2.5", "Under 2.5 goals", 100 - o, m.odds?.under_25_goals) : null;
  },
  "both-teams-to-score": (m) => {
    const pct = num(m.prediction?.btts_yes_pct);
    return pct !== null && pct >= 55 ? item(m, "GG", "Both teams to score", pct, m.odds?.btts_yes) : null;
  },
  "double-chance": (m) => {
    const p = m.prediction;
    if (!p || num(p.home_win_pct) === null) return null;
    const hx = p.home_win_pct + p.draw_pct;
    const xa = p.away_win_pct + p.draw_pct;
    const useHome = hx >= xa;
    const pct = useHome ? hx : xa;
    if (pct < 72) return null;
    const mk = marketsOf(m).dc.find((x) => x.k === (useHome ? "1X" : "X2"));
    return item(m, mk.k, mk.pick, pct, mk.odd, true);
  },
  "over-1-5-goals": (m) => {
    const pct = num(m.prediction?.over_15_pct);
    return pct !== null && pct >= 78 ? item(m, "O1.5", "Over 1.5 goals", pct, m.odds?.over_15_goals) : null;
  },
  "under-3-5-goals": (m) => {
    const pct = num(m.prediction?.over_35_pct);
    const pc = pct === null ? null : 100 - pct;
    const d = marketsOf(m).goals.find((x) => x.k === "U3.5");
    return d && d.odd && pc !== null && pc >= 60 ? item(m, "U3.5", "Under 3.5 goals", pc, d.odd) : null;
  },
  "over-3-5-goals": (m) => {
    const pct = num(m.prediction?.over_35_pct);
    const d35 = marketsOf(m).goals.find((x) => x.k === "O3.5");
    return d35 && d35.odd && pct !== null && pct >= 38 ? item(m, "O3.5", "Over 3.5 goals", pct, d35.odd) : null;
  },
  "both-teams-not-to-score": (m) => {
    const y = num(m.prediction?.btts_yes_pct);
    return y !== null && 100 - y >= 58 ? item(m, "NG", "Both teams not to score", 100 - y, m.odds?.btts_no) : null;
  },
  "double-chance-1x": (m) => dcPick(m, "1X", 75),
  "double-chance-x2": (m) => dcPick(m, "X2", 70),
  "double-chance-12": (m) => dcPick(m, "12", 80),
  "value-bets": (m) => valuePick(m, 0.03)
};

function dcPick(m, k, min) {
  const d = marketsOf(m).dc.find((x) => x.k === k);
  return d && num(d.pct) !== null && d.pct >= min ? item(m, k, d.pick, d.pct, d.odd, true) : null;
}

export function rankPicks(slug, matches) {
  const fn = PICKERS[slug];
  if (!fn) return [];
  const out = [];
  for (const m of matches) {
    const it = fn(m);
    if (it) out.push(it);
  }
  out.sort(slug === "value-bets" ? (a, b) => b.edge - a.edge : (a, b) => b.pct - a.pct || a.m.ts - b.m.ts);
  if (slug === "value-bets" && !out.length) {
    // Nothing clearly beats the market. Show the closest ones, and say so on the page.
    const near = [];
    for (const m of matches) if (!m.res || m.res.state === "pre") { const it = valuePick(m, -0.05); if (it) { it.weak = true; near.push(it); } }
    return near.sort((a, b) => b.edge - a.edge).slice(0, 10);
  }
  return out;
}

// Accumulator builder: stack the most likely picks until the total odds reach the target.
// One match can offer several kinds of safe pick. The acca mixes the kinds so it does not hang on straight wins only.
const ACCA_KINDS = [
  { type: "win", min: 55, pick: (m) => { const b = bestSide(m); return b && b.pct >= 55 && b.odd ? { k: b.k, label: b.label, pct: b.pct, odd: b.odd } : null; } },
  { type: "dc", min: 75, pick: (m) => { const x = ["1X", "X2"].map((k) => marketsOf(m).dc.find((d) => d.k === k)).filter((d) => d && num(d.pct) !== null && d.pct >= 75 && d.odd).sort((u, v) => v.pct - u.pct)[0]; return x ? { k: x.k, label: x.pick, pct: x.pct, odd: x.odd, calc: true } : null; } },
  { type: "goals", pick: (m) => { const g = marketsOf(m).goals; const o15 = g.find((d) => d.k === "O1.5"); const o25 = g.find((d) => d.k === "O2.5"); if (o15 && num(o15.pct) !== null && o15.pct >= 80 && o15.odd) return { k: "O1.5", label: o15.pick, pct: o15.pct, odd: o15.odd }; return o25 && num(o25.pct) !== null && o25.pct >= 62 && o25.odd ? { k: "O2.5", label: o25.pick, pct: o25.pct, odd: o25.odd } : null; } },
  { type: "btts", pick: (m) => { const d = marketsOf(m).btts.find((x) => x.k === "GG"); return d && num(d.pct) !== null && d.pct >= 60 && d.odd ? { k: "GG", label: d.pick, pct: d.pct, odd: d.odd } : null; } }
];
function accaFrom(matches, target, cap) {
  const cands = [];
  for (const m of matches) for (const kd of ACCA_KINDS) {
    const c = kd.pick(m);
    if (c && c.odd >= 1.08 && c.odd <= 3) cands.push({ m, type: kd.type, ...c });
  }
  const legs = [];
  const usedMatch = new Set();
  const perLeague = new Map();
  const perType = {};
  let total = 1;
  while (legs.length < cap && total < target) {
    let best = null, bestScore = -1e9;
    for (const c of cands) {
      if (usedMatch.has(c.m.id) || (perLeague.get(c.m.league.id) || 0) >= 2) continue;
      const score = c.pct - 7 * (perType[c.type] || 0);
      if (score > bestScore) { best = c; bestScore = score; }
    }
    if (!best) break;
    legs.push({ m: best.m, k: best.k, label: best.label, pct: best.pct, odd: best.odd, calc: !!best.calc, type: best.type });
    usedMatch.add(best.m.id);
    perLeague.set(best.m.league.id, (perLeague.get(best.m.league.id) || 0) + 1);
    perType[best.type] = (perType[best.type] || 0) + 1;
    total *= best.odd;
  }
  if (legs.length < 2 || total < target * 0.9) return null;
  legs.sort((x, y) => x.m.ts - y.m.ts);
  return { legs, total };
}
// Builds one acca. It tries to keep every leg on the SAME day (earliest day first); only if no single
// day has enough strong picks does it mix days, and then every leg shows its date.
export function buildAcca(matches, target, maxLegs) {
  const cap = Math.max(maxLegs || 0, target <= 2 ? 4 : target <= 3 ? 5 : target <= 5 ? 7 : 12);
  const days = [...new Set(matches.map((m) => dayKey(m.ts)))].sort();
  for (const d of days) {
    const r = accaFrom(matches.filter((m) => dayKey(m.ts) === d), target, cap);
    if (r) return { ...r, day: d };
  }
  const r = accaFrom(matches, target, cap);
  return r ? { ...r, day: null } : null;
}

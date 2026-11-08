// slip-engine.js - builds guided AI slips from the model read and bookmaker prices.
// Pure functions: no network, no language model. Runs in the browser and in Node (for tests).
//
// Each match gives legs across the markets the feed carries (match result, double chance,
// goals and both teams to score). A leg only counts if the model gives it at least the
// threshold chance (80%, falling back to 75%). One leg per match. Leagues and markets are spread.

export const TARGETS = { 2: { lo: 1.9, hi: 2.3 }, 3: { lo: 2.8, hi: 3.6 }, 5: { lo: 4.6, hi: 6.2 } };
// How many matches each combo style uses: [fewest, most], and the preferred number.
export const LEGS = {
  more:  { 2: [2, 5], 3: [3, 7], 5: [5, 10], pref: { 2: 4, 3: 6, 5: 8 } },
  fewer: { 2: [1, 2], 3: [2, 3], 5: [3, 5], pref: { 2: 1, 3: 2, 5: 3 } }
};
// Minimum model chance per game. More combo keeps games strong (80%, then 75%).
// Fewer combo takes bigger risks per game, so it accepts lower chances and still picks the strongest first.
export const THRESHOLDS_BY_MODE = { more: [80, 75], fewer: [65, 60, 55] };
export const thresholdsFor = (mode) => THRESHOLDS_BY_MODE[mode];
export const MODE_TEXT = {
  more: { title: "More combo", sub: "More games, safer each" },
  fewer: { title: "Fewer combo", sub: "Fewer games, higher odds each" }
};

const num = (x) => (x === null || x === undefined || x === "" || Number.isNaN(+x) ? null : +x);
const good = (x) => x !== null && Number.isFinite(x);
const fairShare = (prices) => {
  const inv = prices.map((p) => 1 / p);
  const s = inv.reduce((a, b) => a + b, 0);
  return inv.map((v) => (100 * v) / s);
};
const GROUP = { "1": "1x2", X: "1x2", "2": "1x2", "1X": "dc", "12": "dc", X2: "dc", "O1.5": "goals", "O2.5": "goals", "U2.5": "goals", "O3.5": "goals", "U3.5": "goals", GG: "btts", NG: "btts" };

// Every leg a match offers, with model chance (pct), bookmaker price (odd) and the market's own chance (fair).
export function legsOf(m) {
  const o = m.o || {}, p = m.p || {};
  const h = m.h, a = m.a;
  const out = [];
  const add = (k, label, pick, odd, pct, fair) => {
    odd = num(odd); pct = num(pct);
    if (!good(odd) || odd < 1.2 || odd > 6 || !good(pct) || pct <= 0) return;
    out.push({ id: m.id, k, label, pick, odd: +odd.toFixed(2), pct: Math.round(pct), fair: good(fair) ? Math.round(fair) : null, mk: GROUP[k] });
  };

  const h1 = num(o.home_win), hx = num(o.draw), h2 = num(o.away_win);
  let f1 = null, fx = null, f2 = null;
  if (good(h1) && good(hx) && good(h2) && h1 > 1 && hx > 1 && h2 > 1) [f1, fx, f2] = fairShare([h1, hx, h2]);
  add("1", "1", `${h} to win`, h1, p.home_win_pct, f1);
  add("X", "X", "Draw", hx, p.draw_pct, fx);
  add("2", "2", `${a} to win`, h2, p.away_win_pct, f2);

  const dc = (x, y) => (good(x) && good(y) && x > 1 && y > 1 ? +(1 / (1 / x + 1 / y)).toFixed(2) : null);
  const pct = (x, y) => (good(num(x)) && good(num(y)) ? num(x) + num(y) : null);
  add("1X", "1X", `${h} or draw`, dc(h1, hx), pct(p.home_win_pct, p.draw_pct), f1 !== null ? f1 + fx : null);
  add("12", "12", `${h} or ${a}`, dc(h1, h2), pct(p.home_win_pct, p.away_win_pct), f1 !== null ? f1 + f2 : null);
  add("X2", "X2", `Draw or ${a}`, dc(hx, h2), pct(p.away_win_pct, p.draw_pct), f2 !== null ? f2 + fx : null);

  const o15 = num(o.over_15_goals), o25 = num(o.over_25_goals), u25 = num(o.under_25_goals);
  const o35 = num(o.over_35_goals), u35 = num(o.under_35_goals);
  const p25 = num(p.over_25_pct), p35 = num(p.over_35_pct);
  add("O1.5", "O1.5", "Over 1.5 goals", o15, p.over_15_pct, null);
  const f25 = good(o25) && good(u25) && o25 > 1 && u25 > 1 ? fairShare([o25, u25]) : null;
  add("O2.5", "O2.5", "Over 2.5 goals", o25, p25, f25 ? f25[0] : null);
  add("U2.5", "U2.5", "Under 2.5 goals", u25, good(p25) ? 100 - p25 : null, f25 ? f25[1] : null);
  // Over 3.5 only when the feed's prices and chances agree (the same check the site uses).
  const o35ok = good(o35) && o35 >= 1.8 && (!good(o25) || o35 >= o25 + 0.25) && (!good(p35) || !good(p25) || p35 < p25);
  if (o35ok) {
    const f35 = good(u35) && u35 > 1 ? fairShare([o35, u35]) : null;
    add("O3.5", "O3.5", "Over 3.5 goals", o35, p35, f35 ? f35[0] : null);
    add("U3.5", "U3.5", "Under 3.5 goals", u35, good(p35) ? 100 - p35 : null, f35 ? f35[1] : null);
  }

  const by = num(o.btts_yes), bn = num(o.btts_no);
  const fb = good(by) && good(bn) && by > 1 && bn > 1 ? fairShare([by, bn]) : null;
  add("GG", "GG", "Both teams to score", by, p.btts_yes_pct, fb ? fb[0] : null);
  add("NG", "NG", "Both teams not to score", bn, good(num(p.btts_yes_pct)) ? 100 - p.btts_yes_pct : null, fb ? fb[1] : null);
  return out;
}

// Matches on the chosen day(s), each with its legs that clear the threshold, best first.
export function poolFor(matches, { day, today, tomorrow, thr }) {
  const want = (d) => (day === "both" ? d === today || d === tomorrow : d === (day === "tomorrow" ? tomorrow : today));
  return matches
    .filter((m) => want(m.d))
    .map((m) => {
      const legs = legsOf(m).filter((l) => l.pct >= thr).sort((x, y) => y.pct - x.pct || y.odd - x.odd).slice(0, 3);
      return { id: m.id, lg: m.lg || "", m, legs, top: legs.length ? legs[0].pct : 0 };
    })
    .filter((x) => x.legs.length)
    .sort((x, y) => y.top - x.top);
}

// Beam search over matches. Keeps the most likely combined chance while the total odds
// stay inside the target band and the leg count stays inside the style's range.
export function solve(pool, { mode, target, keep = [], exclude = new Set(), noise = 0, rng = Math.random, beam = 700 }) {
  const T = TARGETS[target], R = LEGS[mode][target], pref = LEGS[mode].pref[target];
  const lnLo = Math.log(T.lo), lnHi = Math.log(T.hi), lnMid = (lnLo + lnHi) / 2;
  const maxN = R[1], minN = R[0];
  const maxPerMarket = Math.max(2, Math.ceil(maxN * 0.6));
  const cands = pool.filter((x) => !exclude.has(x.id)).slice(0, 60);

  const lpOf = (l) => Math.log(l.pct / 100);
  const loOf = (l) => Math.log(l.odd);
  const stateFrom = (legs) => {
    const s = { legs: [], ids: new Set(), lo: 0, lp: 0, lg: {}, mk: {} };
    for (const l of legs) {
      const c = pool.find((x) => x.id === l.id);
      s.legs.push(l); s.ids.add(l.id);
      s.lo += loOf(l); s.lp += lpOf(l);
      const lg = c ? c.lg : (l.lg || ""); s.lg[lg] = (s.lg[lg] || 0) + 1;
      s.mk[l.mk] = (s.mk[l.mk] || 0) + 1;
    }
    return s;
  };
  const extend = (s, c, leg) => {
    const ns = { legs: [...s.legs, leg], ids: new Set(s.ids), lo: s.lo + loOf(leg), lp: s.lp + lpOf(leg), lg: { ...s.lg }, mk: { ...s.mk } };
    ns.ids.add(c.id); ns.lg[c.lg] = (ns.lg[c.lg] || 0) + 1; ns.mk[leg.mk] = (ns.mk[leg.mk] || 0) + 1;
    return ns;
  };
  const minLp = (s) => Math.min(...s.legs.map(lpOf));
  const beamScore = (s) => s.lp - 1.2 * Math.abs(s.lo - lnMid) - 0.3 * Math.abs(s.legs.length - pref) + noise * rng();
  const finalScore = (s) => s.lp + 0.25 * minLp(s) - 0.3 * Math.abs(s.legs.length - pref) - 0.4 * Math.abs(s.lo - lnMid) + noise * rng();
  const inBand = (s) => s.lo >= lnLo && s.lo <= lnHi && s.legs.length >= minN && s.legs.length <= maxN;

  const start = stateFrom(keep);
  if (start.legs.length > maxN) return null;
  let frontier = [start];
  let best = null, bestScore = -Infinity;
  const seen = new Set();
  const consider = (s) => {
    if (!inBand(s)) return;
    const sc = finalScore(s);
    if (sc > bestScore) { best = s; bestScore = sc; }
  };
  consider(start);

  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      if (s.legs.length >= maxN) continue;
      for (const c of cands) {
        if (s.ids.has(c.id) || (s.lg[c.lg] || 0) >= 2) continue;
        for (const leg of c.legs) {
          if (s.lo + loOf(leg) > lnHi) continue;
          if ((s.mk[leg.mk] || 0) >= maxPerMarket) continue;
          const ns = extend(s, c, leg);
          const key = [...ns.ids].sort().join("|") + "#" + ns.legs.map((l) => l.k).join(",");
          if (seen.has(key)) continue;
          seen.add(key);
          next.push(ns);
        }
      }
    }
    next.sort((a, b) => beamScore(b) - beamScore(a));
    frontier = next.slice(0, beam);
    frontier.forEach(consider);
  }

  if (!best) return null;
  const byId = new Map(pool.map((x) => [x.id, x]));
  const legs = best.legs.map((l) => {
    const c = byId.get(l.id);
    const m = c ? c.m : l.m;
    return { ...l, lg: c ? c.lg : l.lg, match: m ? { id: m.id, h: m.h, a: m.a, lg: m.lg, t: m.t, d: m.d } : l.match };
  });
  const total = Math.exp(best.lo);
  return { legs, total: +total.toFixed(2), chance: +(Math.exp(best.lp) * 100).toFixed(1), mode, target, day: null };
}

// Full build: tries the strict threshold first, then the 75% fallback.
export function buildSlip(matches, opts) {
  const levels = thresholdsFor(opts.mode);
  for (const thr of levels) {
    const pool = poolFor(matches, { ...opts, thr });
    const r = solve(pool, { ...opts });
    if (r) return { ...r, thr, fallback: thr !== levels[0], day: opts.day };
  }
  return null;
}

// Swap one game: keep every other leg, find a different match that still lands the odds.
export function swapLeg(matches, slip, legId, opts) {
  const keep = slip.legs.filter((l) => l.id !== legId).map(stripMatch);
  const levels = thresholdsFor(opts.mode);
  for (const thr of [slip.thr, ...levels.filter((t) => t < slip.thr)]) {
    const pool = poolFor(matches, { ...opts, thr });
    const r = solve(pool, { ...opts, keep, exclude: new Set([legId]) });
    if (r) return { ...r, thr, fallback: thr !== levels[0], day: opts.day };
  }
  return null;
}

// Shuffle: rebuild with some randomness, preferring a slip that differs from the current one.
export function shuffleSlip(matches, slip, opts, rng = Math.random) {
  const current = new Set(slip.legs.map((l) => `${l.id}:${l.k}`));
  let fallbackHit = null;
  for (let i = 0; i < 6; i++) {
    const r = buildSlip(matches, { ...opts, noise: 0.5 + i * 0.1, rng });
    if (!r) continue;
    fallbackHit = fallbackHit || r;
    if (!r.legs.every((l) => current.has(`${l.id}:${l.k}`))) return r;
  }
  return fallbackHit;
}

const stripMatch = (l) => ({ id: l.id, k: l.k, label: l.label, pick: l.pick, odd: l.odd, pct: l.pct, fair: l.fair, mk: l.mk, lg: l.lg });

// Honest wording for the result: the combined chance is roughly 1 divided by the total odds.
export function oneIn(total) { return total ? Math.round(total) : null; }
export function priceNote(leg) {
  if (!good(leg.fair)) return "The price is listed without a market comparison.";
  const gap = leg.pct - leg.fair;
  if (gap >= 4) return "The model rates this higher than the bookmaker's price suggests.";
  if (gap <= -4) return "The bookmaker's price is more generous than the model's chance.";
  return "The model and the bookmaker's price agree closely.";
}

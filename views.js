// views.js - turns data into HTML pages (rendered on the server, so Google and phones get real content at once).

import {
  esc, num, fmtOdd, pctTxt, initials, clock, longDate, shortDate, dayKey, todayKey, addDays, keyToTs,
  matchPath, leaguePath, marketsOf, fairOf, MARKET_TABS, groupByLeague, bestSide, edgeOf, rankPicks, buildAcca, byLeague, leagueRank, pickState, PICK_TXT, topPick, PLAY_MS
, kickLabel} from "./logic.js";
import { CATEGORIES, CAT_BY_SLUG, HOME, PAGES, SITE_NAME, analysis, TEAMS, CONTACT } from "./content.js";
import { sponsorFor, MEDIA_KIT, PLACEMENTS } from "./sponsors.js";
import { resolveAcca } from "./accas.js";

// Optional analytics (GoatCounter: no cookies, counts visits only). Off unless GOATCOUNTER_CODE is set in Render.
const GC_CODE = /^[a-z0-9-]{2,40}$/i.test(process.env.GOATCOUNTER_CODE || "") ? process.env.GOATCOUNTER_CODE : "";

// ---------- v5 helpers: the rule, sponsor slots, time bits ----------
const clamp = (v) => Math.max(0, Math.min(100, Number(v) || 0));
const TZ_LABEL = (process.env.SITE_TZ || "Africa/Lagos") === "Africa/Lagos" ? "WAT" : (process.env.SITE_TZ || "");
// The rule: a hairline from 0 to 100. The brass bar is our chance; a hollow tick marks the market's own chance when we have it.
const rule = (pct, vs = null) => `<span class="rule" role="img" aria-label="Our chance ${Math.round(pct)} percent${vs !== null && vs !== undefined ? `, market chance ${Math.round(vs)} percent` : ""}"><i class="rule-fill" style="width:${clamp(pct).toFixed(1)}%"></i>${vs !== null && vs !== undefined ? `<i class="rule-vs" style="left:${clamp(vs).toFixed(1)}%"></i>` : ""}</span>`;
function whenBit(m) {
  const r = resOf(m);
  if (r.state !== "pre") return `<span class="fx-when live"><span class="w-top">${esc(r.label)}</span></span>`;
  const day = dayKey(m.ts) === todayKey() ? "" : `<span class="fx-day">${esc(shortDate(m.ts))}</span>`;
  return `<span class="fx-when">${day}<time class="w-top" datetime="${esc(m.kickoff || "")}" data-t="hm">${clock(m.ts)}</time></span>`;
}
const SLOT_COPY = {
  top: "Put your brand in front of football fans before kick-off.",
  feed: "A card between the fixtures people are reading.",
  side: "Beside today's strongest picks.",
  match: "On the page people open just before kick-off."
};
// A sponsor slot. Booked sponsors are labelled and use rel="sponsored". Open slots invite brands to get in touch.
function sponsorSlot(slot) {
  const s = sponsorFor(slot);
  if (s) {
    return `<aside class="ad ad-${slot}" data-slot="${slot}" aria-label="Sponsored"><a class="ad-link" href="${esc(s.url)}" target="_blank" rel="sponsored nofollow noopener">${s.logo ? `<img class="ad-logo" src="${esc(s.logo)}" alt="${esc(s.name)}" loading="lazy" width="96" height="48">` : ""}<span class="ad-copy"><b>${esc(s.name)}</b><span>${esc(s.tagline || "")}</span></span><span class="ad-cta">${esc(s.cta || "Visit")}</span></a><span class="ad-tag">Sponsored</span></aside>`;
  }
  if (!process.env.SHOW_AD_SLOTS) return ""; // open slots stay hidden until you switch them on
  return `<aside class="ad ad-open ad-${slot}" data-slot="${slot}" aria-label="Advertising space"><a class="ad-link" href="/advertise"><span class="ad-copy"><b>Partner with SportyPredictz</b><span>${SLOT_COPY[slot] || ""}</span></span><span class="ad-cta">See placements</span></a><span class="ad-tag">Your brand here</span></aside>`;
}
const MKX_LBL = { "1x2": "Match result", goals: "Goals", btts: "Both teams to score", dc: "Double chance" };

// ---------- small pieces ----------
const crest = (t) => {
  const fb = esc(initials(t.name));
  return `<span class="crest">${t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy" width="24" height="24" data-fb="${fb}">` : fb}</span>`;
};
const lgIcon = (lg) => {
  const fb = esc(initials(lg.name));
  return lg.logo ? `<img class="lgi" src="${esc(lg.logo)}" alt="" loading="lazy" width="22" height="22" data-fb="${fb}">` : `<span class="lg-fb">${fb}</span>`;
};
const timeEl = (m, cls = "when") => `<time class="${cls}" datetime="${esc(m.kickoff || "")}" data-t="hm">${kickLabel(m.ts)}</time>`;

// Score + status helpers. state: pre | live | ft | wait. The browser keeps these fresh (see app.js).
const RES0 = { state: "pre", h: null, a: null, label: "" };
const resOf = (m) => m.res || RES0;
const scNum = (m, side) => { const v = resOf(m)[side]; return v === null || v === undefined ? "–" : v; };
const scEl = (m, side) => `<b class="sc" data-side="${side}">${scNum(m, side)}</b>`;
const pstEl = (m, k) => {
  if (!k) return "";
  const ps = pickState(m, k);
  return `<span class="pst ${ps || "pend"}">${ps ? PICK_TXT[ps] : resOf(m).state === "wait" ? (resOf(m).label === "LIVE" ? "In play" : "Score updating") : "Pending"}</span>`;
};
function whenEl(m, k, withChip = true) {
  const r = resOf(m);
  const top = r.state === "pre"
    ? `<time class="w-top" datetime="${esc(m.kickoff || "")}" data-t="hm">${kickLabel(m.ts)}</time>`
    : `<span class="w-top">${esc(r.label)}</span>`;
  return `<span class="when">${top}${withChip ? pstEl(m, k) : ""}</span>`;
}
const rowAttrs = (m, k) => `data-sc="${m.id}" data-state="${resOf(m).state}" data-pk="${esc(k || "")}"`;

function oddBtn(m, d, extra = "") {
  const odd = num(d.odd);
  const ok = odd && odd > 1;
  if (!ok) return "";  // no price for this market: show nothing, not an empty box
  return `<button type="button" class="odd${extra}" data-mid="${m.id}" data-k="${esc(d.k)}" data-odd="${ok ? odd.toFixed(2) : ""}" data-pick="${esc(d.pick)}" data-teams="${esc(m.home.name)} v ${esc(m.away.name)}"${d.calc ? ' data-calc="1"' : ""}${ok ? "" : " disabled"} aria-label="${esc(d.pick)} ${ok ? odd.toFixed(2) : "no price"}"><small>${esc(d.label)}</small><b>${d.calc && ok ? "~" : ""}${fmtOdd(odd)}</b></button>`;
}

const starBtn = (m) => `<button type="button" class="star" data-fav data-mid="${m.id}" data-home="${esc(m.home.name)}" data-away="${esc(m.away.name)}" data-league="${esc(m.league.name)}" data-ts="${m.ts}" data-path="${esc(matchPath(m))}" aria-label="Save ${esc(m.home.name)} v ${esc(m.away.name)}" aria-pressed="false">☆</button>`;

// The model's split between home, draw and away as one segmented bar (the shares add up to 100).
function splitBar(mk) {
  const sp = (mk["1x2"] || []).filter((d) => ["1", "X", "2"].includes(d.k) && num(d.pct) !== null && d.pct > 0);
  if (!sp.length) return "";
  const tot = sp.reduce((t, d) => t + Number(d.pct), 0) || 1;
  const cls = { "1": "h", X: "d", "2": "a" };
  return `<span class="split" aria-hidden="true" title="Model: ${sp.map((d) => `${d.k === "X" ? "Draw" : d.k === "1" ? "Home" : "Away"} ${Math.round(d.pct)}%`).join(" · ")}">${sp.map((d) => `<i class="sp-${cls[d.k]}" style="width:${((Number(d.pct) / tot) * 100).toFixed(1)}%"></i>`).join("")}</span>`;
}

// Spotlight card: the strongest model picks of the day.
function spotCard(m) {
  const tp = topPick(m);
  const vs = fairOf(m, tp.k);
  return `<a class="spot" href="${matchPath(m)}" ${rowAttrs(m, tp.k)} data-card>
    <span class="spot-lg">${esc(m.league.name)}</span>
    <span class="spot-m"><span>${esc(m.home.name)}</span><i>v</i><span>${esc(m.away.name)}</span></span>
    <span class="spot-row"><span class="spot-pick"><small>Our pick</small><b>${esc(tp.label)}</b></span><b class="spot-pct">${Math.round(tp.pct)}<i>%</i></b></span>
    ${rule(tp.pct, vs)}
    <span class="spot-foot">${whenBit(m)}${tp.odd ? `<em>Odds ${tp.calc ? "~" : ""}${fmtOdd(tp.odd)}</em>` : ""}${pstEl(m, tp.k)}</span>
  </a>`;
}

// Fixture card: one match, one pick. Win shares on the teams, the rule underneath, odds on the right, every market one tap away.
export function matchRow(m, { league = false } = {}) {
  const mk = marketsOf(m);
  const tp = topPick(m);
  const pk = tp ? tp.k : null;
  const ps = pk ? pickState(m, pk) : null;
  const hl = ps === "won" || ps === "lost" ? ` ${ps}` : "";
  const x2 = mk["1x2"] || [];
  const pc = (k) => { const d = x2.find((q) => q.k === k); return d && num(d.pct) !== null ? Math.round(d.pct) : null; };
  const ph = pc("1"), pd = pc("X"), pa = pc("2");
  const top = Math.max(ph ?? -1, pd ?? -1, pa ?? -1);
  const team = (t, side, p) => `<span class="fx-t">${crest(t)}<span class="nm">${esc(t.name)}</span>${scEl(m, side)}${p !== null ? `<b class="fx-p${p === top ? " lead" : ""}">${p}%</b>` : ""}</span>`;
  const pd2 = pk ? Object.values(mk).flat().find((d) => d.k === pk) : null;
  const pick = tp
    ? `<span class="fx-pick"><span class="fx-k">Our pick</span><b>${esc(tp.label)}</b><i>${Math.round(tp.pct)}%</i>${pstEl(m, pk)}</span>`
    : `<span class="fx-pick none"><span class="fx-k">Our pick</span><b>No clear pick yet</b></span>`;
  const mks = Object.entries(mk).map(([id, list]) => {
    const btns = list.map((d) => oddBtn(m, d, pk && d.k === pk ? ` mp${hl}` : "")).join("");
    return btns ? `<div class="mkx mk-${id}"><span class="mkx-l">${MKX_LBL[id] || id}</span><div class="mkx-b">${btns}</div></div>` : "";
  }).join("");
  return `<article class="fx" ${rowAttrs(m, pk)} data-search="${esc(`${m.home.name} ${m.away.name} ${m.league.name}`.toLowerCase())}">
    <div class="fx-top">${whenBit(m)}${league ? `<span class="fx-lg">${lgIcon(m.league)}<span>${esc(m.league.name)}</span></span>` : ""}${starBtn(m)}</div>
    <a class="fx-teams" href="${matchPath(m)}">${team(m.home, "h", ph)}${team(m.away, "a", pa)}</a>
    ${ph !== null || pa !== null ? `<div class="fx-rule">${splitBar(mk)}${pd !== null ? `<span class="fx-draw">Draw ${pd}%</span>` : ""}</div>` : ""}
    <div class="fx-foot">${pick}<span class="fx-act">${pd2 ? oddBtn(m, pd2, ` mp${hl}`) : ""}<button type="button" class="more" aria-expanded="false" aria-label="All odds for ${esc(m.home.name)} v ${esc(m.away.name)}"><span>All odds</span></button></span></div>
    <div class="mks">${mks}<a class="mks-go" href="${matchPath(m)}">Full prediction and analysis</a></div>
  </article>`;
}

// A finished match with the pick we made and whether it won.
function recCard(r) {
  const m = r.m;
  return `<a class="rec ${r.state}" href="${matchPath(m)}">
    <span class="rec-lg">${esc(m.league.name)}</span>
    <span class="rec-m"><span>${esc(m.home.name)}</span><b>${r.h}<i>–</i>${r.a}</b><span>${esc(m.away.name)}</span></span>
    <span class="rec-p"><span class="pkline"><small>Pick</small><b>${esc(r.pick.label)}</b><i>${Math.round(r.pick.pct)}%</i></span><span class="pst ${r.state}">${PICK_TXT[r.state] || ""}</span></span>
  </a>`;
}
const recStrip = (rec) => rec.total ? `<div class="recbar"><b>${rec.won}<i>/${rec.total}</i></b><span>picks won on finished matches${rec.rate !== null ? ` · <em>${rec.rate}% hit rate</em>` : ""}</span></div>` : "";

const MK_LABELS = { "1x2": ["1", "X", "2"], goals: ["O1.5", "O2.5", "U2.5", "O3.5"], btts: ["GG", "NG"], dc: ["1X", "12", "X2"] };
const mkHeader = () => `<span class="mkh">${Object.entries(MK_LABELS).map(([id, l]) => `<span class="mkh-${id}" style="--n:${l.length}">${l.map((x) => `<i>${x}</i>`).join("")}</span>`).join("")}</span>`;


// ---------- live SEO copy: rewritten from the real data on every page load ----------
const plural = (n, w) => `${n} ${n === 1 ? w : w === "match" ? "matches" : w + "s"}`;
const avgPct = (items) => items.length ? Math.round(items.reduce((a, b) => a + b.pct, 0) / items.length) : null;
function leagueFacts(league, matches, ctx, standings) {
  const name = league.name;
  const playing = (m) => resOf(m).state === "live" || (resOf(m).state === "wait" && m.ts && Date.now() - m.ts < PLAY_MS);
  const now = matches.filter(playing);
  const checking = matches.filter((m) => resOf(m).state === "wait" && !playing(m));
  const done = matches.filter((m) => resOf(m).state === "ft");
  const ahead = matches.filter((m) => resOf(m).state === "pre");
  const today = ahead.filter((m) => dayKey(m.ts) === todayKey());
  const best = rankPicks("banker-picks", ahead)[0] || null;
  const o25 = rankPicks("over-2-5-goals", ahead);
  const bt = rankPicks("both-teams-to-score", ahead);
  const recs = ((ctx.record && ctx.record.list) || []).filter((r) => r.m.league.name === name);
  const won = recs.filter((r) => r.state === "won").length;
  const lead = standings && standings.groups && standings.groups[0] && standings.groups[0].rows[0];
  return { name, now, checking, done, ahead, today, best, o25, bt, recs, won, lead };
}
// Same facts, different wording: the variant is picked from a seed (league + day + what is happening),
// so a page reads the same on every refresh but differs between leagues and between days.
const hash = (str) => { let h = 7; for (const c of String(str)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const say = (seed, list) => list[hash(seed) % list.length];
const vs = (m) => `${m.home.name} v ${m.away.name}`;
const scoreTxt = (m) => `${m.home.name} ${scNum(m, "h")}–${scNum(m, "a")} ${m.away.name}`;
const joinAnd = (arr) => arr.length < 2 ? arr.join("") : `${arr.slice(0, -1).join(", ")} and ${arr[arr.length - 1]}`;

// Each candidate paragraph has a score for how much it matters on THIS page. The highest scores lead,
// so two leagues (or the same league on two days) open with different angles. Ties break on a seed.
function leagueStory(league, matches, ctx, standings) {
  const f = leagueFacts(league, matches, ctx, standings);
  const n = f.name;
  const seed = `${league.id}|${todayKey()}`;
  const jitter = (k) => (hash(seed + k) % 100) / 1000; // 0 to 0.099, only breaks near-ties
  const plural = (x, w) => `${x} ${w}${x === 1 ? "" : "s"}`;
  const rows = ((standings && standings.groups && standings.groups[0] && standings.groups[0].rows) || []).filter((r) => r.p && r.pts !== null);
  const sorted = [...rows].sort((a, b) => a.pos - b.pos);
  const C = []; // { score, key, text }
  const add = (key, score, text) => { if (text) C.push({ key, score: score + jitter(key), text }); };

  if (sorted.length >= 6) {
    const top = sorted[0], second = sorted[1], fourth = sorted[3];
    const tail = sorted[sorted.length - 1], safe = sorted[sorted.length - 4];
    const gapTop = top.pts - second.pts, gapFour = top.pts - fourth.pts, gapSafe = safe.pts - tail.pts;
    add("title", gapTop <= 2 ? 9 : gapTop >= 8 ? 3 : 5,
      gapTop <= 2
        ? `The title race is still open: ${top.team} lead on ${top.pts} points, only ${plural(gapTop, "point")} ahead of ${second.team} after ${top.p} games.`
        : `${top.team} lead the ${n} on ${top.pts} points, ${plural(gapTop, "point")} clear of ${second.team} after ${top.p} games.`);
    add("top4", gapFour <= 4 ? 7 : 2,
      `${gapFour <= 4 ? "The top four is close" : "The chasing pack is already well back"}: fourth-placed ${fourth.team} are ${plural(gapFour, "point")} behind the leaders.`);
    add("relegation", gapSafe <= 3 ? 8 : 3,
      `At the bottom, ${tail.team} have ${tail.pts} points from ${tail.p} games. ${safe.team}, three places above them, have ${safe.pts}, so the gap to safety is ${plural(gapSafe, "point")}.`);
  }

  if (rows.length >= 6 && rows.every((r) => Number.isFinite(r.gf) && Number.isFinite(r.ga))) {
    const played = rows.reduce((s, r) => s + r.p, 0);
    const perGame = rows.reduce((s, r) => s + r.gf, 0) / (played / 2);
    const attack = [...rows].sort((a, b) => b.gf / b.p - a.gf / a.p)[0];
    const leak = [...rows].sort((a, b) => a.ga / a.p - b.ga / b.p)[0];
    const extreme = perGame >= 2.9 || perGame <= 2.2;
    add("goals", extreme ? 7 : 3,
      `${perGame >= 2.8 ? "A high-scoring league" : perGame <= 2.2 ? "A low-scoring league" : "Goals are about average"}: ${perGame.toFixed(2)} a game across the table. ${attack.team === leak.team
        ? `${attack.team} have both the most goals per game (${(attack.gf / attack.p).toFixed(2)}) and the fewest conceded (${(leak.ga / leak.p).toFixed(2)}).`
        : `${attack.team} score the most per game (${(attack.gf / attack.p).toFixed(2)}), while ${leak.team} have conceded the fewest (${(leak.ga / leak.p).toFixed(2)} a game).`}`);
  } else if (rows.length >= 6 && rows.every((r) => Number.isFinite(r.gd))) {
    const perGd = rows.map((r) => ({ r, v: r.gd / r.p })).sort((a, b) => b.v - a.v);
    const f1 = (v) => (v > 0 ? `+${v.toFixed(2)}` : v.toFixed(2));
    add("gdpg", 4, `Goal difference per game tells the story so far: ${perGd[0].r.team} lead on ${f1(perGd[0].v)} a game, and ${perGd[perGd.length - 1].r.team} are at the bottom on ${f1(perGd[perGd.length - 1].v)}.`);
  }

  if (rows.length >= 6 && rows.every((r) => Number.isFinite(r.gd))) {
    const byGd = [...rows].sort((a, b) => b.gd - a.gd);
    const gdPos = (r) => byGd.indexOf(r) + 1;
    const big = rows.map((r) => ({ r, diff: gdPos(r) - r.pos })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
    if (big && Math.abs(big.diff) >= 3) {
      const gd = big.r.gd > 0 ? `+${big.r.gd}` : `${big.r.gd}`;
      add("mismatch", 7, big.diff > 0
        ? `${big.r.team} are ${ord(big.r.pos)} on points but only ${ord(gdPos(big.r))} on goal difference (${gd}). Their position may be ahead of how they have played.`
        : `${big.r.team} are only ${ord(big.r.pos)} on points despite ${ord(gdPos(big.r))} on goal difference (${gd}), so they could climb if the results follow the underlying play.`);
    }
  }

  const formed = rows.filter((r) => typeof r.form === "string" && /^[WDL]{3,}$/i.test(r.form));
  if (formed.length >= 6) {
    const last5 = (s) => s.slice(-5).toUpperCase();
    const pts = (s) => [...last5(s)].reduce((t, c) => t + (c === "W" ? 3 : c === "D" ? 1 : 0), 0);
    const hot = [...formed].sort((a, b) => pts(b.form) - pts(a.form))[0];
    const cold = [...formed].sort((a, b) => pts(a.form) - pts(b.form))[0];
    add("form", pts(hot.form) - pts(cold.form) >= 8 ? 7 : 3,
      `On recent form, ${hot.team} are the side to watch: ${pts(hot.form)} points from their last five (${last5(hot.form)}). ${cold.team} have managed ${pts(cold.form)} from theirs (${last5(cold.form)}).`);
  }

  const finished = f.done.filter((m) => Number.isFinite(resOf(m).h) && Number.isFinite(resOf(m).a));
  if (finished.length >= 3) {
    const totals = finished.map((m) => resOf(m).h + resOf(m).a);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const over = totals.filter((t) => t > 2.5).length;
    const homeW = finished.filter((m) => resOf(m).h > resOf(m).a).length;
    const awayW = finished.filter((m) => resOf(m).a > resOf(m).h).length;
    add("finished", finished.length >= 5 && (avg >= 3.5 || avg <= 2) ? 6 : 3,
      `From the ${plural(finished.length, "finished game")} we have full scores for, the average is ${avg.toFixed(1)} goals, ${Math.round((100 * over) / finished.length)}% went over 2.5, and home sides have won ${homeW} to ${awayW} for away sides.`);
  }

  const withP = f.ahead.filter((m) => m.prediction);
  if (withP.length >= 3) {
    const read = withP.map((m) => {
      const p = m.prediction;
      const opts = [[m.home.name, num(p.home_win_pct)], ["a draw", num(p.draw_pct)], [m.away.name, num(p.away_win_pct)]].filter((x) => x[1] !== null);
      const best = [...opts].sort((a, b) => b[1] - a[1])[0];
      return { m, side: best ? best[0] : null, pct: best ? best[1] : null };
    }).filter((x) => x.pct !== null);
    const strong = read.filter((x) => x.pct >= 60).length;
    const toss = read.filter((x) => x.pct < 45).length;
    const sharp = [...read].sort((a, b) => b.pct - a.pct)[0];
    const close = [...read].sort((a, b) => a.pct - b.pct)[0];
    add("model", strong >= 2 || toss >= 2 ? 6 : 3,
      `Still to come, the model sees ${plural(strong, "game")} where one side is at 60% or better, and ${plural(toss, "game")} that look like a coin toss (no side above 45%). The most one-sided on our numbers is ${vs(sharp.m)}, and the closest is ${vs(close.m)}.`);
  }

  if (f.recs.length >= 3) {
    const rate = f.won / f.recs.length;
    add("record", rate >= 0.6 || rate <= 0.3 ? 5 : 2, `Our picks in the ${n} so far: ${f.won} of ${f.recs.length} came in.`);
  }

  C.sort((a, b) => b.score - a.score);
  const ps = C.slice(0, 6).map((c) => c.text);
  const lead = C[0] ? C[0].key : null;

  // Opening line: what is happening right now (short; the angle follows it)
  if (f.now.length) ps.unshift(`${plural(f.now.length, "game")} in the ${n} ${f.now.length === 1 ? "is" : "are"} live right now.`);
  else if (f.today.length) ps.unshift(`${plural(f.today.length, "game")} still to come in the ${n} today, starting with ${vs(f.today[0])} at ${clock(f.today[0].ts)}.`);
  else if (f.ahead.length) ps.unshift(`No ${n} football today. Next up: ${vs(f.ahead[0])} on ${shortDate(f.ahead[0].ts)} at ${clock(f.ahead[0].ts)}.`);

  return { ps, f, lead };
}

// Match page angle: the single most notable thing about THIS match, chosen the same way as the league page.
function matchAngle(m, standings) {
  const p = m.prediction, o = m.odds || {};
  const C = [];
  const seed = String(m.id);
  const jit = (k) => (hash(seed + k) % 100) / 1000;
  const h = m.home.name, a = m.away.name;
  if (p && num(p.home_win_pct) !== null && num(o.home_win)) {
    const mk = (price) => (1 / price) * 100;
    const gapH = num(p.home_win_pct) - mk(o.home_win), gapA = num(p.away_win_pct) - (num(o.away_win) ? mk(o.away_win) : 0);
    const side = Math.abs(gapH) >= Math.abs(gapA) ? { t: h, g: gapH, pct: num(p.home_win_pct), price: o.home_win } : { t: a, g: gapA, pct: num(p.away_win_pct), price: o.away_win };
    if (Math.abs(side.g) >= 4) C.push({ score: 8 + jit("value"), text: `${side.t}: model ${Math.round(side.pct)}% vs price ${Math.round(mk(side.price))}%, a ${Math.abs(Math.round(side.g))}-point ${side.g > 0 ? "edge" : "shortfall"}.` });
  }
  const xg = p && p.expected_goals;
  if (xg && num(xg.home) !== null && num(xg.away) !== null) {
    const total = num(xg.home) + num(xg.away);
    if (total >= 3 || total <= 2.1) C.push({ score: 6 + jit("goals"), text: `Model expects ${total.toFixed(1)} goals: ${total >= 3 ? "an open game" : "a tight, low-scoring game"}.` });
  }
  if (p && num(p.draw_pct) !== null && Math.max(num(p.home_win_pct) || 0, num(p.away_win_pct) || 0, num(p.draw_pct)) < 45) {
    C.push({ score: 6 + jit("toss"), text: `No side above 45% on our numbers: a genuine coin toss.` });
  }
  const rows = ((standings && standings.groups && standings.groups[0] && standings.groups[0].rows) || []).filter((r) => r.p && r.pts !== null);
  if (rows.length >= 6) {
    const sorted = [...rows].sort((x, y) => x.pos - y.pos);
    const hr = sorted.find((r) => r.team === h), ar = sorted.find((r) => r.team === a);
    const fourth = sorted[3], safe = sorted[sorted.length - 4];
    if (hr && ar) {
      const near = [[hr, "Home"], [ar, "Away"]].map(([r, lab]) => ({ r, lab, d: Math.min(Math.abs(r.pts - fourth.pts), Math.abs(r.pts - safe.pts)) })).sort((x, y) => x.d - y.d)[0];
      if (near.d <= 3) C.push({ score: 7 + jit("stakes"), text: `${near.r.team} sit ${ord(near.r.pos)} on ${near.r.pts} points, ${near.d} from a key line.` });
    }
  }
  C.sort((x, y) => y.score - x.score);
  return C[0] ? C[0].text : null;
}

const storyHtml = (st) => `<section class="story" aria-label="${esc(st.f.name)} update"><h2>${esc(st.f.name)} update</h2>${st.ps.map((p) => `<p>${esc(p)}</p>`).join("")}<small class="mono">Written from live data · refreshed ${esc(clock(Date.now()))}</small></section>`;
const lgNote = (g) => {
  const f = leagueFacts(g.league, g.matches, { record: null }, null);
  const bits = [];
  if (f.now.length) bits.push(`<b class="hot">${f.now.length} live</b>`);
  if (f.done.length) bits.push(`${f.done.length} finished`);
  if (f.checking.length) bits.push(`${f.checking.length} awaiting result`);
  if (f.ahead.length) bits.push(`${f.ahead.length} to play`);
  if (f.best) bits.push(`top pick <b>${esc(f.best.label)}</b> ${Math.round(f.best.pct)}%`);
  return bits.length ? `<p class="lgnote">${bits.join(" · ")}</p>` : "";
};

function leagueBlock(g, { limit = 0, moreHref = "", open = true, level = 2 } = {}) {
  const list = limit ? g.matches.slice(0, limit) : g.matches;
  const more = limit && g.matches.length > limit ? `<a class="seemore" href="${moreHref || leaguePath(g.league)}">All ${g.matches.length} matches in ${esc(g.league.name)}</a>` : "";
  const lgHref = g.league.id != null ? leaguePath(g.league) : "/leagues";
  return `<details class="lgblock fxg" id="lg-${esc(g.league.id ?? "x")}"${open ? " open" : ""}>
    <summary class="fxg-h"><h${level}>${lgIcon(g.league)}<span class="lname">${esc(g.league.name)}</span></h${level}><span class="n">${g.matches.length}</span><i class="chev" aria-hidden="true"></i></summary>
    <div class="fxg-meta">${lgNote(g)}<a href="${lgHref}">${esc(g.league.name)} table and predictions</a></div>
    <div class="fxg-list">${list.map((m) => matchRow(m)).join("")}</div>${more}
  </details>`;
}
// feedAfter: put the in-feed sponsor slot after the group in which this many matches have been shown.
const leagueBlocks = (groups, o = {}) => {
  let shown = 0, placed = !o.feedAfter;
  return groups.map((g, i) => {
    shown += g.matches.length;
    let html = leagueBlock(g, { ...o, open: i < (o.openN ?? 8) });
    if (!placed && shown >= o.feedAfter) { placed = true; html += sponsorSlot("feed"); }
    return html;
  }).join("");
};

function toolbar(groups) {
  const jump = groups.length > 2
    ? `<nav class="lgjump" aria-label="Jump to a league">${groups.map((g) => `<a href="#lg-${esc(g.league.id ?? "x")}">${esc(g.league.name)} <b>${g.matches.length}</b></a>`).join("")}</nav>`
    : "";
  return `<div class="toolbar"><label class="search"><span class="sr">Search teams or leagues</span><input type="search" data-search placeholder="Search a team or league" autocomplete="off"></label>${groups.length > 3 ? `<button type="button" class="lgtoggle" data-lgtoggle>Collapse all</button>` : ""}</div>${jump}`;
}

function dayTabs(days, activeKey) {
  const today = todayKey();
  const tabs = days.map((k) => {
    const label = k === today ? "Today" : k === addDays(today, 1) ? "Tomorrow" : shortDate(keyToTs(k)).split(" ").slice(0, 1).join("");
    const href = k === today ? "/football-predictions-today" : k === addDays(today, 1) ? "/football-predictions-tomorrow" : `/football-predictions/${k}`;
    return `<a class="dt${k === activeKey ? " on" : ""}" href="${href}"${k === activeKey ? ' aria-current="page"' : ""}>${esc(label)}<small>${esc(shortDate(keyToTs(k)))}</small></a>`;
  }).join("");
  return `<nav class="daytabs" aria-label="Choose a day">${tabs}<a class="dt" href="/predictions/weekend-match-predictions">Weekend<small>Fri to Sun</small></a></nav>`;
}
function crumbs(list) {
  return `<nav class="crumbs" aria-label="Breadcrumb">${list.map(([n, p], i) => (i === list.length - 1 ? `<span aria-current="page">${esc(n)}</span>` : `<a href="${p}">${esc(n)}</a>`)).join('<i>/</i>')}</nav>`;
}
const crumbLd = (origin, list) => ({
  "@context": "https://schema.org", "@type": "BreadcrumbList",
  itemListElement: list.map(([n, p], i) => ({ "@type": "ListItem", position: i + 1, name: n, item: origin + p }))
});
const faqLd = (items) => ({
  "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } }))
});
const faqHtml = (items, title = "Frequently asked questions") => `<section class="faq5" aria-labelledby="faq-h"><h2 id="faq-h">${esc(title)}</h2><div class="faq5-grid">${items.map(([q, a]) => `<div class="faq5-i"><h3>${esc(q)}</h3><p>${esc(a)}</p></div>`).join("")}</div></section>`;
const GROUP_ORDER = ["Match result", "Goals", "Both teams to score", "Double chance", "Smart picks", "Accumulators"];
const isAcca = (c) => c.kind === "acca" || c.kind === "acca-hub";
function catTile(c, counts) {
  const n = counts[c.slug];
  const tag = n == null ? "" : c.kind === "acca" ? `<i class="${n ? "" : "off"}">${n ? "Ready" : "Building"}</i>` : c.kind === "acca-hub" ? `<i>${n} ready</i>` : `<i class="${n ? "" : "off"}">${n} ${n === 1 ? "pick" : "picks"}</i>`;
  return `<a class="catcard" href="/predictions/${c.slug}"><b>${esc(c.name)}</b><span>${esc(c.short)}</span>${tag}</a>`;
}
function catCards(counts = {}, { featured = false, level = 2 } = {}) {
  if (featured) return `<div class="catgrid">${CATEGORIES.filter((c) => c.featured).map((c) => catTile(c, counts)).join("")}</div>`;
  return GROUP_ORDER.map((g) => {
    const list = CATEGORIES.filter((c) => c.group === g);
    return list.length ? `<section class="catgroup"><h${level} class="grp">${esc(g)}</h${level}><div class="catgrid">${list.map((c) => catTile(c, counts)).join("")}</div></section>` : "";
  }).join("");
}
const liveOrPre = (m) => !m.res || m.res.state !== "ft";
function countsFor(matches) {
  const counts = {};
  const upcoming = matches.filter((m) => !m.res || m.res.state === "pre");
  let accas = 0;
  for (const c of CATEGORIES) {
    if (c.kind === "acca") { counts[c.slug] = resolveAcca(c, upcoming) ? 1 : 0; accas += counts[c.slug]; }
    else if (c.kind !== "acca-hub") counts[c.slug] = rankPicks(c.slug, matches).filter((x) => !x.weak).length;
  }
  counts["accumulator-tips"] = accas;
  return counts;
}

function cardStat(m, k) {
  const r = resOf(m);
  if (r.state === "pre") return timeEl(m, "mono w-top");
  const ps = pickState(m, k);
  return `<span class="mono w-top">${esc(r.label)}${r.h !== null ? ` ${r.h}–${r.a}` : ""}</span>${pstEl(m, k)}`;
}

function pickCard(it) {
  return `<a class="pickcard" href="${matchPath(it.m)}" ${rowAttrs(it.m, it.k)} data-card>
    <span class="pk-top"><span>${esc(it.m.league.name)}</span><span class="pk-stat">${cardStat(it.m, it.k)}</span></span>
    <span class="pk-teams"><span>${esc(it.m.home.name)}</span><i>vs</i><span>${esc(it.m.away.name)}</span></span>
    <span class="pk-foot"><span class="pk-says"><small>Model says</small><b>${esc(it.label)}</b>${it.odd ? `<small class="mono">Odds ${it.calc ? "~" : ""}${fmtOdd(it.odd)}</small>` : ""}</span><span class="pk-pct">${Math.round(it.pct)}<small>%</small></span></span>
  </a>`;
}

const legWhen = (m) => {
  const r = resOf(m);
  if (r.state !== "pre") return `<span class="w-top">${esc(r.label)}</span>`;
  return `${dayKey(m.ts) !== todayKey() ? `<small>${esc(shortDate(m.ts))}</small>` : ""}${timeEl(m, "w-top")}`;
};
const accaNote = (acca) => acca.manual ? `<p class="acca-note">Hand-picked by our team.</p>`
  : acca.tier ? `<p class="acca-note">Built from the best games available today, so confidence is lower than on a normal day.</p>` : "";
const accaHtml = (name, acca, href = "") => acca
  ? `<section class="acca"><div class="acca-head"><h2>${href ? `<a href="${href}">${esc(name)}</a>` : esc(name)}</h2><span class="acca-total">${plural(acca.legs.length, "leg")} · Total odds <b>${acca.total.toFixed(2)}</b>${acca.result ? ` <span class="pst ${acca.result}">${acca.result === "won" ? "Won" : "Lost"}</span>` : ""}</span></div>
      ${accaNote(acca)}
      ${acca.legs.map((l) => `<div class="leg" ${rowAttrs(l.m, l.k)}><span class="legt">${legWhen(l.m)}</span><a href="${matchPath(l.m)}"><b>${esc(l.m.home.name)} v ${esc(l.m.away.name)}</b><small>${esc(l.label)} · ${Math.round(l.pct)}% model</small></a><span class="legr"><b class="sc" data-side="h">${scNum(l.m, "h")}</b><i>–</i><b class="sc" data-side="a">${scNum(l.m, "a")}</b>${pstEl(l.m, l.k)}</span><span class="mono">${l.calc ? "~" : ""}${fmtOdd(l.odd)}</span></div>`).join("")}
      <button type="button" class="btn solid" data-acca='${esc(JSON.stringify(acca.legs.map((l) => ({ mid: l.m.id, k: l.k, odd: Number(l.odd).toFixed(2), pick: l.label, teams: `${l.m.home.name} v ${l.m.away.name}` }))))}'>Add all to pick slip</button></section>`
  : `<section class="acca"><div class="acca-head"><h2>${href ? `<a href="${href}">${esc(name)}</a>` : esc(name)}</h2></div><div class="empty">There are not enough games with prices to build this acca right now. It fills in by itself as soon as more games are listed.</div></section>`;

// Bet-type card: one pick, the rule showing our chance against the market's, odds and result.
function pickRow(it) {
  const m = it.m;
  const vs = it.vs ?? fairOf(m, it.k);
  const e = it.edge;
  const label = ({ "O1.5": "Over 1.5", "O2.5": "Over 2.5", "O3.5": "Over 3.5", "U2.5": "Under 2.5", "U3.5": "Under 3.5", GG: "Both score", NG: "One or none" })[it.k] || it.k;
  return `<article class="cx" ${rowAttrs(m, it.k)} data-search="${esc(`${m.home.name} ${m.away.name} ${m.league.name}`.toLowerCase())}">
    <div class="cx-top"><span class="cx-lg">${lgIcon(m.league)}<span>${esc(m.league.name)}</span></span>${whenBit(m)}${starBtn(m)}</div>
    <a class="cx-teams" href="${matchPath(m)}"><span class="fx-t">${crest(m.home)}<span class="nm">${esc(m.home.name)}</span>${scEl(m, "h")}</span><span class="fx-t">${crest(m.away)}<span class="nm">${esc(m.away.name)}</span>${scEl(m, "a")}</span></a>
    <div class="cx-read"><div class="cx-pick"><small>Our pick</small><b>${esc(it.label)}</b></div><b class="cx-pct">${Math.round(it.pct)}<i>%</i></b></div>
    ${rule(it.pct, vs)}
    <div class="cx-legend"><span>Our chance ${Math.round(it.pct)}%</span>${vs !== null && vs !== undefined ? `<span>Market ${Math.round(vs)}%</span>` : ""}${e !== null && e !== undefined ? `<span class="${e > 0 ? "pos" : "neg"}">Edge ${e > 0 ? "+" : ""}${(e * 100).toFixed(1)}%</span>` : ""}</div>
    <div class="cx-foot">${pstEl(m, it.k)}${oddBtn(m, { k: it.k, label, odd: it.odd, pick: it.label, calc: it.calc })}</div>
  </article>`;
}

function liveCard(m) {
  const tp = topPick(m);
  const pk = tp ? tp.k : null;
  const r = resOf(m);
  return `<div class="lcard" ${rowAttrs(m, pk)} data-card>
    <span class="lc-top"><span class="lc-lg">${esc(m.league.name)}</span><span class="lc-min"><i class="pulse"></i><span class="w-top">${esc(r.label || "LIVE")}</span></span></span>
    <span class="lc-m">${crest(m.home)}<span class="lc-t">${esc(m.home.name)}</span>${scEl(m, "h")}</span>
    <span class="lc-m">${crest(m.away)}<span class="lc-t">${esc(m.away.name)}</span>${scEl(m, "a")}</span>
    ${tp ? `<span class="lc-foot"><span class="pkline"><small>Pick</small><b>${esc(tp.label)}</b><i>${Math.round(tp.pct)}%</i></span>${pstEl(m, pk)}</span>` : ""}
  </div>`;
}

export function liveList(items) {
  if (!items.length) return `<div class="empty">No matches are live right now.<br>This page refreshes itself, so leave it open around kick-off time.</div>`;
  return `<div class="lgrid">${items.map(liveCard).join("")}</div>`;
}

export function tickerHtml(live, upcoming) {
  let label = "NEXT UP", items = "";
  if (live.length) {
    label = "LIVE";
    items = live.map((m) => `<a class="t-item" href="${matchPath(m)}"><span class="min">${num(m.minute) !== null ? m.minute + "'" : "LIVE"}</span><b>${esc(m.home.name)}</b><span class="sc">${m.score?.home ?? "-"} - ${m.score?.away ?? "-"}</span><b>${esc(m.away.name)}</b></a>`).join("");
  } else {
    items = upcoming.slice(0, 12).map((m) => `<a class="t-item" href="${matchPath(m)}"><b>${esc(m.home.name)}</b> v <b>${esc(m.away.name)}</b> ${timeEl(m, "sc")}</a>`).join("");
  }
  return { label, items: items ? items + items : "" };
}

// ---------- layout ----------
const FAV_ICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%230a1020'/%3E%3Ccircle cx='32' cy='32' r='17' fill='none' stroke='%23d8b467' stroke-width='5'/%3E%3Ccircle cx='32' cy='32' r='5.5' fill='%23d8b467'/%3E%3C/svg%3E";
function betTypesPanel() {
  const groups = GROUP_ORDER.map((g) => {
    const list = CATEGORIES.filter((c) => c.group === g);
    return list.length ? `<div class="bt-g"><b>${esc(g)}</b>${list.map((c) => `<a href="/predictions/${c.slug}">${esc(c.name)}</a>`).join("")}</div>` : "";
  }).join("");
  return `<details class="bt"><summary>Bet types<i aria-hidden="true"></i></summary><div class="bt-panel"><div class="bt-grid">${groups}</div><div class="bt-foot"><a href="/predictions">All bet types</a><a href="/predictions/weekend-match-predictions">Weekend picks</a><a href="/build-slip">AI slip builder</a><a href="/favourites">Saved matches</a></div></div></details>`;
}
export function layout(ctx, o) {
  const url = ctx.origin + o.path;
  const robots = o.noindex || ctx.demo ? "noindex,follow" : "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";
  const contactLinks = [CONTACT.channelLink].filter(Boolean);
  const siteLd = o.path === "/" ? [
    { "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, url: ctx.origin + "/", logo: `${ctx.origin}/assets/icon-512.png`, sameAs: contactLinks },
    { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: ctx.origin + "/", inLanguage: "en", publisher: { "@type": "Organization", name: SITE_NAME } }
  ] : [];
  const ld = [...siteLd, ...(o.ld || [])].map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("");
  const active = (p) => (o.path === p || (p !== "/" && o.path.startsWith(p)) ? " on" : "");
  const t = ctx.ticker;
  const topLeagues = (ctx.leagues || []).slice(0, 6);
  const nav = (href, label, extra = "") => `<a class="${active(href).trim()}" href="${href}"${active(href) ? ' aria-current="page"' : ""}>${label}${extra}</a>`;
  const chrome = `<header class="top"><div class="top-in">
  <a class="logo" href="/" aria-label="${SITE_NAME} home"><span class="logo-mark" aria-hidden="true"></span><span class="logo-t">Sporty<b>Predictz</b></span></a>
  <div class="top-right">${betTypesPanel()}<a class="top-cta" href="/build-slip">AI slip</a><a class="saved${active("/favourites")}" href="/favourites" aria-label="Saved matches"><span aria-hidden="true">★</span><i class="count" id="favCount" hidden>0</i></a><span class="age" title="18 or older only">18+</span></div>
  <nav class="mainnav" aria-label="Main">${nav("/football-predictions-today", "Today")}${nav("/football-predictions-tomorrow", "Tomorrow")}${nav("/predictions/weekend-match-predictions", "Weekend")}${nav("/leagues", "Leagues")}${nav("/live", "Live", ` <i class="live-dot" id="liveCount"${ctx.liveCount ? "" : " hidden"}>${ctx.liveCount || 0}</i>`)}${nav("/results", "Results")}</nav>
</div></header>
<div class="ticker" aria-label="Live scores and next matches"><a class="ticker-label${t.label === "LIVE" ? " live" : ""}" id="tickerLabel" href="/live">${t.label === "LIVE" ? "Live" : "Next up"}</a><div class="ticker-window"><div class="ticker-track" id="ticker">${t.items}</div></div></div>`;
  const desc = String(o.desc || "").replace(/\s+/g, " ").trim();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}">${o.refresh ? `<meta http-equiv="refresh" content="${o.refresh}">` : ""}
${(ctx.verify || []).join("\n")}
<link rel="canonical" href="${esc(url)}">
<link rel="alternate" hreflang="en" href="${esc(url)}"><link rel="alternate" hreflang="x-default" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(ctx.origin)}/assets/og.png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="SportyPredictz football predictions, odds and live scores"><meta property="og:locale" content="en_GB">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(o.title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(ctx.origin)}/assets/og.png"><meta name="twitter:image:alt" content="SportyPredictz football predictions, odds and live scores">
<meta name="theme-color" content="#0a1020"><meta name="color-scheme" content="dark"><link rel="manifest" href="/site.webmanifest"><link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<link rel="icon" href="${FAV_ICON}">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700;800&family=Newsreader:opsz,wght@6..72,500;6..72,600;6..72,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css?v=${ctx.v}">
${ld}
</head>
<body data-market="1x2">
<a class="skip" href="#main">Skip to content</a>
${ctx.demo ? `<div class="demo-banner"><b>Demo data.</b> Not connected to odds-api yet. Set <code>ODDS_API_KEY_SPORTY</code> on Render for real matches.</div>` : ""}
${o.bare ? "" : chrome}
<main class="wrap" id="main">
${o.body}
</main>
<footer class="foot foot-card">
  <div class="foot-grid">
    <div class="foot-brand"><a class="logo" href="/"><span class="logo-mark" aria-hidden="true"></span><span class="logo-t">Sporty<b>Predictz</b></span></a><p>Free football predictions with win probabilities, odds and a public track record.</p><p class="foot-join"><button type="button" class="linkish" data-contact="channel">Telegram channel</button><button type="button" class="linkish" data-contact="whatsapp">WhatsApp</button><button type="button" class="linkish" data-contact="email">Email</button></p></div>
    <div class="foot-col"><h5>Predictions</h5><a href="/football-predictions-today">Today</a><a href="/football-predictions-tomorrow">Tomorrow</a><a href="/predictions/weekend-match-predictions">Weekend match predictions</a>${CATEGORIES.slice(0, 6).map((c) => `<a href="/predictions/${c.slug}">${esc(c.name)}</a>`).join("")}<a href="/predictions">All bet types</a></div>
    <div class="foot-col"><h5>Football</h5><a href="/live">Live scores</a><a href="/results">Results</a><a href="/leagues">All leagues</a>${topLeagues.map((l) => `<a class="lg-link" href="${leaguePath(l)}">${esc(l.name)}</a>`).join("")}<a href="/teams">Clubs</a></div>
    <div class="foot-col"><h5>Site</h5><a href="/ai-football-predictions">Scout AI helper</a><a href="/build-slip">AI slip builder</a><a href="/about">About us</a><a href="/how-it-works">How it works</a><a href="/track-record">Track record</a><a href="/advertise">Advertise with us</a><a href="/contact">Contact</a><a href="/responsible-gambling">Responsible gambling</a><a href="/terms">Terms of use</a><a href="/privacy">Privacy policy</a></div>
  </div>
  <div class="foot-bar"><p><b class="age-pill">18+</b> ${SITE_NAME} is an information site, not a bookmaker, and takes no bets. Odds can change at any time. Predictions are estimates, not guarantees. Bet only where it is legal and only what you can afford to lose.</p><span>&copy; ${new Date().getFullYear()} ${SITE_NAME}</span></div>
</footer>
<aside class="slip" id="slip" aria-label="Pick slip" hidden>
  <div class="slip-head"><div class="block-title">Pick slip <i class="count" id="slipCount">0</i></div><button type="button" class="link-btn" id="slipClose">Close</button></div>
  <div id="slipBody"></div>
</aside>
<button type="button" class="slip-fab" id="slipFab" hidden><span>Pick slip</span><b id="fabCount">0</b><span class="mono" id="fabOdds">0.00</span></button>
<div class="scout" id="scout">
  <section class="scout-panel" id="scoutPanel" aria-label="Scout FAQ" hidden>
    <header class="scout-head"><div class="scout-id"><img src="/assets/scout-logo.svg" width="34" height="34" alt=""><div><b>Scout</b><small>AI helper · 18+ · no guarantees</small></div></div><button type="button" class="scout-x" id="scoutX" aria-label="Close Scout">×</button></header>
    <div class="scout-log" id="scoutLog" aria-live="polite"></div>
    <div class="scout-chips" id="scoutChips"></div>
    <form class="scout-ask" id="scoutForm" autocomplete="off"><label class="sr" for="scoutInput">Ask Scout a question</label><input id="scoutInput" type="text" maxlength="160" placeholder="Type a question…"><button type="submit">Ask</button></form>
  </section>
  <div class="scout-stack">
    <a class="scout-go scout-blink" href="/build-slip" aria-label="Open the AI slip builder"><img src="/assets/scout-logo.svg" width="52" height="52" alt=""></a>
    <button type="button" class="scout-faq" id="scoutFab" aria-expanded="false" aria-controls="scoutPanel" aria-label="Open FAQ"><span>FAQ</span></button>
  </div>
</div>
<script src="/app.js?v=${ctx.v}" defer></script>
<script type="module" src="/scout.js?v=${ctx.v}"></script>
${GC_CODE ? `<script data-goatcounter="https://${GC_CODE}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>` : ""}
</body>
</html>`;
}

const pageHead = (h1, sub, chips = "") => `<header class="pagehead"><h1>${esc(h1)}</h1>${sub ? `<p>${sub}</p>` : ""}${chips ? `<div class="chips">${chips}</div>` : ""}</header>`;
const chip = (n, label) => `<span class="statchip"><b>${esc(n)}</b>${esc(label)}</span>`;

// ---------- pages ----------
const ring = (p) => `<span class="ring" style="--pv:${Math.round(p)}"><b>${Math.round(p)}<i>%</i></b></span>`;

function heroTiles(ctx, pod, liveItems, upcoming) {
  const rec = ctx.record;
  const podTile = pod ? `<a class="tile tile-pod" href="${matchPath(pod.m)}" ${rowAttrs(pod.m, pod.k)} data-card>
      <span class="tile-k">Pick of the day</span>
      <span class="pod-lg">${esc(pod.m.league.name)} · ${resOf(pod.m).state === "pre" ? timeEl(pod.m, "w-top") : `<span class="w-top">${esc(resOf(pod.m).label)}</span>`}</span>
      <span class="pod-teams"><span>${esc(pod.m.home.name)}</span><i>v</i><span>${esc(pod.m.away.name)}</span></span>
      <span class="pod-foot"><span class="pod-pick"><small>Model says</small><b>${esc(pod.label)}</b><span class="pod-meta">${pod.odd ? `<em>Odds ${pod.calc ? "~" : ""}${fmtOdd(pod.odd)}</em>` : ""}${pstEl(pod.m, pod.k)}</span></span>${ring(pod.pct)}</span>
    </a>` : "";
  const liveRows = liveItems.slice(0, 3).map((m) => `<span class="lt-row"><span class="lt-min">${esc(resOf(m).label || "LIVE")}</span><span class="lt-t">${esc(m.home.name)}</span><b>${scNum(m, "h")}–${scNum(m, "a")}</b><span class="lt-t r">${esc(m.away.name)}</span></span>`).join("");
  const next = upcoming[0];
  const liveTile = `<a class="tile tile-live" href="/live"><span class="tile-k"><i class="pulse${liveItems.length ? "" : " off"}"></i>Live now <b>${liveItems.length}</b></span>
      ${liveRows || (next ? `<span class="lt-idle">No live games right now.<br>Next: <b>${esc(next.home.name)} v ${esc(next.away.name)}</b> at ${timeEl(next, "w-top")}</span>` : `<span class="lt-idle">No live games right now.</span>`)}
      <span class="tile-link">${liveItems.length > 3 ? `+${liveItems.length - 3} more · ` : ""}All live scores →</span></a>`;
  const recTile = rec && rec.total
    ? `<a class="tile tile-rec" href="/results"><span class="tile-k">Our record</span><span class="rec-main">${ring(rec.rate ?? 0)}<span class="rec-txt"><b>${rec.won} of ${rec.total}</b><small>picks won on finished matches</small></span></span>
        <span class="rec-groups">${(rec.groups || []).slice(0, 3).map((g) => `<span><small>${esc(g.name)}</small><b>${g.rate}%</b></span>`).join("")}</span></a>`
    : `<a class="tile tile-rec" href="/results"><span class="tile-k">Our record</span><span class="rec-empty"><b>Tracking starts today</b><small>Every pick is saved before kick-off and marked Won or Lost at full time.</small></span></a>`;
  return `<section class="hero" aria-label="Highlights">${podTile}${liveTile}${recTile}</section>`;
}

function homeStory(matches, groups, liveItems, ctx) {
  const ahead = matches.filter((m) => !m.res || m.res.state === "pre");
  const done = matches.filter((m) => m.res && m.res.state === "ft");
  const best = rankPicks("banker-picks", ahead).slice(0, 3);
  const todayN = matches.filter((m) => dayKey(m.ts) === todayKey()).length || matches.length;
  const seed = `home|${todayKey()}`;
  const ps = [say(seed, [
    `${plural(todayN, "match")} across ${plural(groups.length, "league")} on the board for ${longDate(Date.now())}${liveItems.length ? `, and ${liveItems.length} ${liveItems.length === 1 ? "is" : "are"} live right now` : ""}.`,
    `Here's the picture for ${longDate(Date.now())}: ${plural(todayN, "match")}, ${plural(groups.length, "league")}${liveItems.length ? `, ${liveItems.length} in play` : ""}${done.length ? `, ${done.length} already finished` : ""}.`
  ])];
  if (liveItems.length) ps.push(`In play now: ${joinAnd(liveItems.slice(0, 5).map((m) => `${scoreTxt(m)} (${resOf(m).label || "live"})`))}.`);
  if (best.length) ps.push(say(seed + "b", [
    `The model's firmest calls right now: ${joinAnd(best.map((b2) => `${b2.label} in ${vs(b2.m)} (${Math.round(b2.pct)}%)`))}.`,
    `Safest-looking picks at the moment: ${joinAnd(best.map((b2) => `${vs(b2.m)}, ${b2.label} (${Math.round(b2.pct)}%)`))}.`
  ]));
  if (ctx.record && ctx.record.total) ps.push(`We keep score on ourselves: ${ctx.record.won} of our last ${ctx.record.total} finished picks won${ctx.record.rate !== null ? ` (${ctx.record.rate}%)` : ""}.`);
  return `<section class="story"><h2>Today's football picture</h2>${ps.map((p) => `<p>${esc(p)}</p>`).join("")}<small class="mono">Written from live data · refreshed ${esc(clock(Date.now()))}</small></section>`;
}
const fitTitle = (variants) => variants.find((t) => t.length <= 62) || variants[variants.length - 1];
const cut = (s, n = 158) => (s.length <= n ? s : s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…");
const pageLd = (ctx, { name, desc, path, type = "WebPage" }) => ({
  "@context": "https://schema.org", "@type": type, name, description: desc, url: ctx.origin + path, inLanguage: "en",
  dateModified: new Date().toISOString(), isPartOf: { "@type": "WebSite", name: SITE_NAME, url: ctx.origin + "/" }
});
const itemListLd = (ctx, name, ms) => ({
  "@context": "https://schema.org", "@type": "ItemList", name, numberOfItems: ms.length,
  itemListElement: ms.map((m, i) => ({ "@type": "ListItem", position: i + 1, url: ctx.origin + matchPath(m), name: `${m.home.name} vs ${m.away.name}` }))
});

function slipsTeaser(upcoming) {
  const tiles = CATEGORIES.filter((c) => c.kind === "acca").map((c) => {
    const a = resolveAcca(c, upcoming);
    if (!a) return `<a class="slipc off" href="/predictions/${c.slug}"><b>${esc(c.name)}</b><span>Building as more strong picks appear</span></a>`;
    const chance = Math.round(a.legs.reduce((p, l) => p * (l.pct / 100), 1) * 100);
    return `<a class="slipc" href="/predictions/${c.slug}"><small>${a.legs.length} picks</small><strong>${a.total.toFixed(2)}</strong><b>${esc(c.name)}</b><span>Combined model chance about ${chance}%</span></a>`;
  }).join("");
  return `<section class="sec" aria-labelledby="h-slips"><div class="sec-h"><h2 id="h-slips">Ready-made accumulator slips</h2><a href="/build-slip">Build your own with the AI slip builder</a></div><div class="slips5">${tiles}</div></section>`;
}

export function homePage(ctx, { matches, live, updatedAt }) {
  const today = todayKey();
  const todays = matches.filter((m) => dayKey(m.ts) === today);
  const pool = (todays.length ? todays : matches).slice().sort((a, b) => a.ts - b.ts);
  const upcoming = matches.filter((m) => !m.res || m.res.state === "pre");
  const groups = groupByLeague(pool);
  const liveNow = (ctx.liveItems || []).length;
  const isToday = todays.length > 0;
  const withPick = pool.filter((m) => topPick(m));
  const ranked = (withPick.filter((m) => !m.res || m.res.state === "pre").length ? withPick.filter((m) => !m.res || m.res.state === "pre") : withPick).sort((a, b) => topPick(b).pct - topPick(a).pct);
  const spots = ranked.slice(0, 4);
  const pod = spots[0];
  const counts = countsFor(matches);
  const rec = ctx.record;
  const when = isToday ? "today" : "this week";
  const h1 = `Football predictions ${when}`;
  const stats = [
    [pool.length, pool.length === 1 ? "match" : "matches"],
    [groups.length, groups.length === 1 ? "league" : "leagues"],
    [withPick.length, "with a clear pick"],
    ...(rec && rec.total >= 20 && rec.rate !== null ? [[`${rec.rate}%`, `of ${rec.total} settled picks won`]] : [])
  ].map(([n, l]) => `<div><dt>${esc(String(n))}</dt><dd>${esc(l)}</dd></div>`).join("");
  const podHtml = pod ? (() => { const tp = topPick(pod), vs = fairOf(pod, tp.k);
    return `<a class="pod" href="${matchPath(pod)}" ${rowAttrs(pod, tp.k)} data-card><span class="pod-k">Pick of the day</span><span class="pod-lg">${lgIcon(pod.league)}${esc(pod.league.name)}</span>
      <span class="pod-m"><span>${esc(pod.home.name)}</span><i>v</i><span>${esc(pod.away.name)}</span></span>
      <span class="pod-row"><span class="pod-pick"><small>Our pick</small><b>${esc(tp.label)}</b></span><b class="pod-pct">${Math.round(tp.pct)}<i>%</i></b></span>${rule(tp.pct, vs)}
      <span class="pod-foot">${whenBit(pod)}${tp.odd ? `<em>Odds ${tp.calc ? "~" : ""}${fmtOdd(tp.odd)}</em>` : ""}${vs !== null && vs !== undefined ? `<span>Market ${Math.round(vs)}%</span>` : ""}</span></a>`; })() : "";

  const guide = HOME.guide.map((g, i) => `<div class="ed-b"><h3>${esc(g.h)}</h3>${g.p.map((t) => `<p>${esc(t)}</p>`).join("")}${i === 0 ? `<p>Want the full method? Read <a href="/how-we-predict">how our football predictions work</a>.</p>` : ""}${i === 2 ? `<p>See the <a href="/track-record">full track record</a> or the latest <a href="/results">football results</a>.</p>` : ""}</div>`).join("");
  const typeLinks = ["banker-picks", "over-2-5-goals", "both-teams-to-score", "double-chance", "value-bets", "accumulator-tips"].map((s) => CAT_BY_SLUG[s]).filter(Boolean).map((c) => `<a href="/predictions/${c.slug}">${esc(c.name.toLowerCase())}</a>`).join(", ");

  const body = `
  <section class="hz" aria-labelledby="h1">
    <div class="hz-copy">
      <p class="hz-date"><time datetime="${new Date().toISOString()}">${esc(longDate(Date.now()))}</time>${liveNow ? ` <span class="hz-live">${liveNow} live now</span>` : ""}</p>
      <h1 id="h1">${esc(h1)}</h1>
      <p class="hz-lede">${pool.length ? `${plural(pool.length, "match")} across ${plural(groups.length, "league")}, each with win probabilities, bookmaker odds and a model pick. ${withPick.length} ${withPick.length === 1 ? "has" : "have"} a clear pick right now.` : "Matches appear here as soon as the odds feed adds them."}</p>
      <div class="hz-cta"><a class="btn solid" href="/football-predictions-today">All ${pool.length || ""} matches</a><a class="btn" href="/build-slip">Build an AI slip</a></div>
      <dl class="hz-stats">${stats}</dl>
    </div>
    ${podHtml}
  </section>
  ${sponsorSlot("top")}
  <div class="hz-grid">
    <div class="hz-main">
      ${spots.length ? `<section class="sec" aria-labelledby="h-best"><div class="sec-h"><h2 id="h-best">Strongest picks ${esc(when)}</h2><a href="/predictions/banker-picks">All banker picks</a></div><div class="spots5">${spots.map(spotCard).join("")}</div></section>` : ""}
      <section class="sec" id="matches" aria-labelledby="h-matches"><div class="sec-h"><h2 id="h-matches">${isToday ? "Today's football matches" : "Football matches this week"}</h2><a href="/football-predictions-today">Open the full list</a></div>
        ${dayTabs([today, addDays(today, 1)], isToday ? today : "")}
        ${pool.length ? toolbar(groups) + leagueBlocks(groups, { openN: 6, feedAfter: 6, level: 3 }) : `<div class="empty">No matches loaded yet. This page fills itself in when they appear.</div>`}
      </section>
      <section class="sec" aria-labelledby="h-types"><div class="sec-h"><h2 id="h-types">Predictions by bet type</h2><a href="/predictions">See all bet types</a></div><p class="sec-sub">Every market we publish, with the number of picks that clear the bar today.</p>${catCards(counts, { level: 3 })}</section>
      ${slipsTeaser(upcoming)}
    </div>
    <aside class="hz-side" aria-label="More from SportyPredictz">
      ${sponsorSlot("side")}
      ${rec && rec.total ? `<section class="card5"><h2>Our track record</h2>${recStrip(rec)}<p><a href="/track-record">See every settled pick</a></p></section>` : ""}
      ${joinBlock()}
    </aside>
  </div>
  <section class="ed" aria-labelledby="h-guide"><h2 id="h-guide">Free football predictions, explained</h2><div class="ed-grid">${guide}<div class="ed-b"><h3>Bet types we cover</h3><p>Browse ${typeLinks} and more. Each page lists the matches that clear the bar for that market, strongest first, and shows our chance next to the market's.</p><p>Looking for a league? Every competition has its own page with fixtures, odds, predictions and the table: <a href="/leagues">football leagues</a>.</p></div></div></section>
  ${homeStory(matches, groups, ctx.liveItems || [], ctx)}
  ${faqHtml(HOME.faq)}`;
  const desc = pool.length
    ? cut(`Free football predictions for ${longDate(Date.now())}: ${pool.length} matches with win probabilities, over/under and BTTS picks, odds, live scores and a public track record.`)
    : HOME.desc;
  return {
    title: HOME.title, desc, path: "/", body,
    ld: [pageLd(ctx, { name: HOME.title, desc, path: "/" }), faqLd(HOME.faq), ...(pool.length ? [itemListLd(ctx, h1, pool.slice(0, 10))] : [])]
  };
}

// Daily summary: plain sentences filled from the day's real numbers. Several phrasings per idea;
// the phrasing is chosen from the date and league, so pages read differently and stay the same on refresh.
const pickPhrase = (seed, options) => options[hash(seed) % options.length];
export function daySummary(list, key) {
  if (!list.length) return "";
  const leagues = [...new Set(list.map((m) => m.league.name))];
  const picks = list.map((m) => ({ m, tp: topPick(m) })).filter((x) => x.tp).sort((a, b) => b.tp.pct - a.tp.pct);
  const best = picks[0];
  const drawish = list.filter((m) => num(m.prediction?.draw_pct) >= 28).length;
  const goalsy = list.filter((m) => num(m.prediction?.over_25_pct) >= 60).length;
  const out = [];
  out.push(pickPhrase(key + "a", [
    `${list.length} matches are on the list across ${leagues.length} ${leagues.length === 1 ? "competition" : "competitions"}.`,
    `The list has ${list.length} matches from ${leagues.length} ${leagues.length === 1 ? "league" : "leagues"}.`,
    `${plural(list.length, "match")} to look at, spread over ${leagues.length} ${leagues.length === 1 ? "league" : "leagues"}.`
  ]));
  if (best) out.push(pickPhrase(key + "b", [
    `The strongest model read is ${best.m.home.name} vs ${best.m.away.name}, where the model gives "${best.tp.label}" a ${Math.round(best.tp.pct)}% chance.`,
    `Furthest ahead on the model is ${best.tp.label} in ${best.m.home.name} vs ${best.m.away.name}, at ${Math.round(best.tp.pct)}%.`,
    `The model is most confident about ${best.tp.label} (${best.m.home.name} vs ${best.m.away.name}), with ${Math.round(best.tp.pct)}%.`
  ]));
  if (goalsy) out.push(pickPhrase(key + "c", [
    `${plural(goalsy, "match")} look like goal-rich games, with a model chance of over 2.5 goals at 60% or more.`,
    `Over 2.5 goals is the leaning in ${plural(goalsy, "match")} on the list.`
  ]));
  if (drawish) out.push(pickPhrase(key + "d", [
    `${plural(drawish, "match")} look evenly matched, with the draw at 28% or more.`,
    `A draw is a live option in ${plural(drawish, "match")}, so those are worth a look if you follow the draw pages.`
  ]));
  out.push(pickPhrase(key + "e", [
    "Odds and chances move before kick-off, so check the price again before you act on any pick.",
    "Team news can change a match after these numbers are set, so read the match page close to kick-off."
  ]));
  return out.map((t) => `<p>${esc(t)}</p>`).join("");
}

export function dayPage(ctx, { matches, days, key }) {
  const today = todayKey();
  const list = matches.filter((m) => dayKey(m.ts) === key);
  const groups = groupByLeague(list);
  const label = key === today ? "today" : key === addDays(today, 1) ? "tomorrow" : shortDate(keyToTs(key));
  const Label = label[0].toUpperCase() + label.slice(1);
  const path = key === today ? "/football-predictions-today" : key === addDays(today, 1) ? "/football-predictions-tomorrow" : `/football-predictions/${key}`;
  const nice = longDate(keyToTs(key));
  const picks = list.map((m) => ({ m, tp: topPick(m) })).filter((x) => x.tp).sort((a, b) => b.tp.pct - a.tp.pct);
  const first = list.slice().sort((a, b) => a.ts - b.ts)[0], last = list.slice().sort((a, b) => b.ts - a.ts)[0];
  const faq = list.length ? [
    [`What time do football matches start ${label}?`, `The first of ${list.length} matches on our list kicks off at ${clock(first.ts)} (${first.home.name} vs ${first.away.name}) and the last at ${clock(last.ts)} (${last.home.name} vs ${last.away.name}), in ${TZ_LABEL || "site"} time. Your device converts them to your own time zone.`],
    ...(picks[0] ? [[`Which match has the strongest prediction ${label}?`, `${picks[0].m.home.name} vs ${picks[0].m.away.name} in the ${picks[0].m.league.name}. Our model gives "${picks[0].tp.label}" a ${Math.round(picks[0].tp.pct)}% chance${picks[0].tp.odd ? ` at odds of ${fmtOdd(picks[0].tp.odd)}` : ""}. A high chance is still an estimate, not a guarantee.`]] : []),
    [`How many matches have predictions ${label}?`, `${plural(list.length, "match")} from ${plural(groups.length, "league")} are on the list, and ${picks.length} of them carry a clear pick. Matches the model cannot separate are shown without a pick.`],
    ["Are these football predictions free?", "Yes. Every prediction, odds table and result on SportyPredictz is free to read, and the site takes no bets."],
    ["How often are the predictions updated?", "Odds and probabilities refresh every few minutes. If team news or a price moves sharply before kick-off, the numbers move with it."]
  ] : [];
  const body = `
  ${crumbs([["Home", "/"], [`Predictions ${label}`, path]])}
  <header class="ph5"><p class="ph5-d"><time datetime="${esc(key)}">${esc(nice)}</time></p><h1>Football predictions ${esc(label)}</h1><p class="ph5-s">${list.length ? `${plural(list.length, "match")} from ${plural(groups.length, "league")}, with win probabilities, odds and a model pick for each. Updated ${esc(clock(Date.now()))} ${esc(TZ_LABEL)}.` : "No matches found for this day yet."}</p></header>
  ${dayTabs(days, key)}
  ${sponsorSlot("top")}
  ${list.length ? `<section class="prose daysum"><h2>${esc(Label)} at a glance</h2>${daySummary(list, key)}</section>` : ""}
  ${list.length ? `<section class="sec" aria-labelledby="h-list"><div class="sec-h"><h2 id="h-list">${esc(Label)}'s matches by league</h2></div>${toolbar(groups)}${leagueBlocks(groups, { openN: 8, feedAfter: 6, level: 3 })}</section>` : `<div class="empty">No matches found for this day yet.<br>Try another day above.</div>`}
  <section class="prose"><h2>About these predictions</h2><p>Kick-off times are shown in your own time zone. Odds are a single market consensus price, and the model percentages are estimates. Tap any odds button to add it to your pick slip, or open a match for the full breakdown. Looking for a particular market? See <a href="/predictions/over-2-5-goals">over 2.5 goals</a>, <a href="/predictions/both-teams-to-score">both teams to score</a> and <a href="/predictions/banker-picks">banker picks</a>.</p></section>
  ${faq.length ? faqHtml(faq) : ""}`;
  const title = fitTitle([`Football Predictions ${Label}: Free Tips & Odds | ${SITE_NAME}`, `Football Predictions ${Label} | ${SITE_NAME}`]);
  const desc = cut(`Football predictions for ${nice}: ${list.length} matches with win probabilities, over/under and BTTS picks and odds.${picks[0] ? ` Strongest pick: ${picks[0].tp.label} (${Math.round(picks[0].tp.pct)}%).` : ""}`);
  return {
    title: key === today || key === addDays(today, 1) ? title : fitTitle([`Football Predictions ${nice}: Odds & Tips | ${SITE_NAME}`, `Football Predictions ${shortDate(keyToTs(key))} | ${SITE_NAME}`]),
    desc, path, body, noindex: key < todayKey(),
    ld: [crumbLd(ctx.origin, [["Home", "/"], [`Predictions ${label}`, path]]), pageLd(ctx, { name: title, desc, path }), ...(list.length ? [itemListLd(ctx, `Football predictions ${label}`, list.slice(0, 20)), faqLd(faq)] : [])]
  };
}

export function hubPage(ctx, { matches }) {
  const counts = countsFor(matches);
  const body = `${crumbs([["Home", "/"], ["Predictions", "/predictions"]])}
  ${pageHead("Football predictions by bet type", "Pick the kind of bet you like and see the matches the model rates best for it.")}
  ${catCards(counts)}`;
  return { title: `Football Predictions by Bet Type | ${SITE_NAME}`, desc: "Browse football predictions by bet type: banker picks, home wins, away wins, draws, over/under 2.5 goals, both teams to score, double chance, value bets and accumulator tips.", path: "/predictions", body, ld: [crumbLd(ctx.origin, [["Home", "/"], ["Predictions", "/predictions"]])] };
}

// Weekend match predictions: Friday, Saturday and Sunday.
// Shows finished and upcoming games of the weekend, hot picks, and never comes up empty:
// thin weekend -> the coming week; no fixtures at all -> last weekend's results.
export function weekendPage(ctx, { matches, results = [] }) {
  const path = "/predictions/weekend-match-predictions";
  const today = todayKey();
  const dow = new Date(today + "T12:00:00Z").getUTCDay();   // 0 Sun ... 6 Sat
  const since = (dow + 2) % 7;                               // days since Friday
  const fri = since <= 2 ? addDays(today, -since) : addDays(today, 7 - since);
  const weekend = [fri, addDays(fri, 1), addDays(fri, 2)];
  const names = ["Friday", "Saturday", "Sunday"];
  const now = Date.now();
  const done = (m) => !!m.res && (m.res.state === "ft" || m.res.state === "finished");
  const upcoming = (m) => !!m.ts && m.ts >= now - 3 * 3600e3 && !done(m) && (!m.res || m.res.state === "pre");
  const dayAll = weekend.map((k) => matches.filter((m) => m.ts && dayKey(m.ts) === k).sort((a, b) => a.ts - b.ts));
  const upcomingCount = dayAll.reduce((n, a) => n + a.filter(upcoming).length, 0);
  const nextWeek = upcomingCount < 3
    ? matches.filter((m) => upcoming(m) && !weekend.includes(dayKey(m.ts)) && dayKey(m.ts) > today && dayKey(m.ts) <= addDays(today, 7))
        .sort((a, b) => a.ts - b.ts).slice(0, 12)
    : [];
  const hot = [...dayAll.flat().filter(upcoming), ...nextWeek]
    .filter((m) => m.prediction && topPick(m) && topPick(m).pct >= 65)
    .sort((a, b) => topPick(b).pct - topPick(a).pct).slice(0, 8);
  const totalWeekend = dayAll.reduce((n, a) => n + a.length, 0);
  const lastWeekend = [addDays(fri, -7), addDays(fri, -6), addDays(fri, -5)];
  const lastResults = totalWeekend === 0 && nextWeek.length === 0
    ? results.filter((r) => r.score && r.score.home != null && lastWeekend.includes(dayKey(r.ts))).sort((a, b) => b.ts - a.ts).slice(0, 24)
    : [];

  // Every game gets a pick. Model pick first; if the feed has none, the market favourite from the odds (labelled as such).
  const favPick = (m) => {
    const o = m.odds || {};
    const opts = [[o.home_win, `${m.home.name} to win`], [o.draw, "Draw"], [o.away_win, `${m.away.name} to win`]].filter((x) => x[0]);
    if (!opts.length) return null;
    opts.sort((a, b) => a[0] - b[0]);
    return opts[0][1];
  };
  const pickChip = (m) => {
    const tp = topPick(m);
    if (tp) return `<span class="wk-pick">${esc(tp.label)} ${Math.round(tp.pct)}%</span>`;
    const f = favPick(m);
    return f ? `<span class="wk-pick wk-fav">Favourite: ${esc(f)}</span>` : `<span class="wk-pick wk-fav">Prediction soon</span>`;
  };
  const row = (m) => {
    const right = done(m)
      ? `<span class="wk-score">${scEl(m, "h")}<i>–</i>${scEl(m, "a")}</span>`
      : pickChip(m);
    return `<li class="wk-row"><a href="${matchPath(m)}"><span class="wk-when">${esc(kickLabel(m.ts))}</span><span class="wk-teams">${esc(m.home.name)} <em>v</em> ${esc(m.away.name)}</span><span class="wk-league">${esc(m.league.name)}</span></a>${right}</li>`;
  };
  const hotCard = (m) => {
    const tp = topPick(m);
    return `<div class="wk-hotcard"><a href="${matchPath(m)}">${esc(m.home.name)} v ${esc(m.away.name)}<small>${esc(kickLabel(m.ts))} · ${esc(m.league.name)}</small></a><span class="wk-pick">${esc(tp.label)} ${Math.round(tp.pct)}%</span></div>`;
  };

  const dayBlocks = weekend.map((k, i) => {
    const list = dayAll[i];
    return `<section class="wk-day"><header><h2>${names[i]} match predictions</h2><span class="wk-date">${esc(longDate(keyToTs(k)))}</span></header>${list.length
      ? `<ul class="wk-list">${list.map(row).join("")}</ul>`
      : `<p class="wk-empty">No ${names[i]} fixtures are loaded yet. They appear here as soon as they are added, so check back.</p>`}</section>`;
  }).join("");
  const hotBlock = `<section class="wk-day wk-hot"><header><h2>Hot picks this weekend</h2><span class="wk-date">Model chance 65% or higher</span></header>${hot.length
    ? `<div class="wk-hotgrid">${hot.map(hotCard).join("")}</div>`
    : `<p class="wk-empty">Hot picks appear here as soon as the model rates a match strongly enough.</p>`}</section>`;
  const comingBlock = nextWeek.length
    ? `<section class="wk-day"><header><h2>Coming up this week</h2><span class="wk-date">The weekend is still filling in</span></header><ul class="wk-list">${nextWeek.map(row).join("")}</ul></section>` : "";
  const lastBlock = lastResults.length
    ? `<section class="wk-day"><header><h2>Last weekend's results</h2><span class="wk-date">While this weekend's fixtures load</span></header><ul class="wk-list">${lastResults.map((r) => `<li class="wk-row"><a href="${matchPath(r)}"><span class="wk-when">${esc(longDate(r.ts))}</span><span class="wk-teams">${esc(r.home.name)} <em>v</em> ${esc(r.away.name)}</span><span class="wk-league">${esc(r.league.name)}</span></a><span class="wk-score">${r.score.home}<i>–</i>${r.score.away}</span></li>`).join("")}</ul></section>` : "";

  const intro = `<p class="wk-intro">Weekend football is the busiest stretch of the week. This page gathers every Friday, Saturday and Sunday match we have a prediction for, with the kick-off time, the model's most likely result and the odds, so you can judge the price yourself.</p>`;
  const faq = `<section class="wk-day"><header><h2>Weekend predictions FAQ</h2></header><dl class="wk-faq">
    <dt>When does the weekend start?</dt><dd>Friday. The page covers Friday, Saturday and Sunday. From Monday to Thursday it shows the coming weekend.</dd>
    <dt>Why are some days empty?</dt><dd>Fixtures are added as league schedules are confirmed. If a day is empty, the page shows the coming week or last weekend's results instead.</dd>
    <dt>What is a hot pick?</dt><dd>A match where the model's top result has a 65% chance or better. Open the match page for the full breakdown.</dd>
  </dl></section>`;

  return {
    title: `Weekend Match Predictions: Friday, Saturday and Sunday Tips | ${SITE_NAME}`,
    desc: "Friday, Saturday and Sunday football match predictions with hot picks, model chances, kick-off times and odds.",
    path,
    body: pageHead("Weekend match predictions", "Hot picks and every Friday, Saturday and Sunday match, with model chances, kick-off times and odds.")
      + `<div class="wk-wrap">${intro}${hotBlock}${comingBlock}${dayBlocks}${lastBlock}${faq}</div>`,
    ld: [crumbLd(ctx.origin, [["Home", "/"], ["Predictions", "/predictions"], ["Weekend match predictions", path]])]
  };
}

export function categoryPage(ctx, { cat, matches }) {
  const path = `/predictions/${cat.slug}`;
  const others = CATEGORIES.filter((c) => c.slug !== cat.slug && (c.group === cat.group || c.featured)).slice(0, 8);
  let list = "", count = 0, thin = false, listLd = null;
  const upcoming = matches.filter((m) => !m.res || m.res.state === "pre");
  if (cat.kind === "acca-hub") {
    const four = CATEGORIES.filter((c) => c.kind === "acca");
    const built = four.map((c) => ({ c, acca: resolveAcca(c, upcoming) }));
    count = built.filter((x) => x.acca).length;
    list = built.map(({ c, acca }) => accaHtml(c.name, acca, `/predictions/${c.slug}`)).join("");
  } else if (cat.kind === "acca") {
    const acca = resolveAcca(cat, upcoming);
    count = acca ? 1 : 0;
    list = accaHtml(cat.name, acca);
  } else {
    const items = rankPicks(cat.slug, matches).slice(0, 40);
    count = items.length;
    thin = items.length < 3;
    listLd = items.length ? itemListLd(ctx, cat.name, items.slice(0, 15).map((it) => it.m)) : null;
    const weak = items.length && items.every((x) => x.weak);
    const byDay = new Map();
    const order = (it) => (it.m.res?.state === "live" ? 0 : it.m.res?.state === "ft" ? 2 : 1);
    items.sort((a, b) => order(a) - order(b) || b.pct - a.pct);
    for (const it of items) { const k = dayKey(it.m.ts); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(it); }
    const today = todayKey();
    let n = 0, placed = false;
    list = items.length
      ? (weak ? `<p class="mnote show">Nothing beats the market price by a clear margin right now, so these are the closest: the matches where the model is furthest above the market's own chance. Treat them as a watch list, not a recommendation.</p>` : "")
        + `<div class="toolbar single"><label class="search"><span class="sr">Search teams or leagues</span><input type="search" data-search placeholder="Search a team or league" autocomplete="off"></label></div>`
        + [...byDay.entries()].map(([k, arr]) => {
          n += arr.length;
          let h = `<section class="lgblock cxg"><h2 class="cxg-h">${k === today ? "Today" : k === addDays(today, 1) ? "Tomorrow" : esc(longDate(keyToTs(k)))}<span class="n">${arr.length}</span></h2><div class="cxg-list">${arr.map(pickRow).join("")}</div></section>`;
          if (!placed && n >= 3) { placed = true; h += sponsorSlot("feed"); }
          return h;
        }).join("")
      : `<div class="empty">No matches meet this rule right now.<br>New picks appear as odds and probabilities refresh.</div>`;
  }
  const body = `${crumbs([["Home", "/"], ["Predictions", "/predictions"], [cat.name, path]])}
  <header class="ph5"><p class="ph5-d">Updated ${esc(clock(Date.now()))} ${esc(TZ_LABEL)}</p><h1>${esc(cat.h1)}</h1><p class="ph5-s">${esc(cat.short)}</p><div class="chips">${chip(count, isAcca(cat) ? (cat.kind === "acca-hub" ? "accas ready" : "acca ready") : count === 1 ? "pick" : "picks")}</div></header>
  ${sponsorSlot("top")}
  ${list}
  <section class="prose"><h2>About ${esc(cat.name.toLowerCase())}</h2>${cat.intro.map((p) => `<p>${esc(p)}</p>`).join("")}<p>Looking at all matches instead? See <a href="/football-predictions-today">today's football predictions</a> or <a href="/football-predictions-tomorrow">tomorrow's</a>, and check our <a href="/track-record">track record</a> for how past picks landed.</p></section>
  ${faqHtml(cat.faq, `${cat.name}: frequently asked questions`)}
  <section class="sec"><div class="sec-h"><h2>More prediction types</h2><a href="/predictions">See all</a></div><div class="catgrid small">${others.map((c) => `<a class="catcard" href="/predictions/${c.slug}"><b>${esc(c.name)}</b><span>${esc(c.short)}</span></a>`).join("")}</div></section>`;
  const title = fitTitle([cat.title + ` | ${SITE_NAME}`, cat.title]);
  return {
    title, desc: cut(cat.desc), path, body, noindex: thin,
    ld: [crumbLd(ctx.origin, [["Home", "/"], ["Predictions", "/predictions"], [cat.name, path]]), pageLd(ctx, { name: cat.h1, desc: cat.desc, path }), faqLd(cat.faq), ...(listLd ? [listLd] : [])]
  };
}

export function leaguesPage(ctx, { leagues, counts }) {
  const card = (l) => { const n = counts.get(l.id) || 0; return `<a class="lgcard" href="${leaguePath(l)}">${lgIcon(l)}<span>${esc(l.name)}</span><i title="${n} upcoming">${n || "·"}</i></a>`; };
  const pop = leagues.filter((l) => leagueRank(l.name) < 100);
  const rest = leagues.filter((l) => leagueRank(l.name) >= 100);
  const body = `${crumbs([["Home", "/"], ["Leagues", "/leagues"]])}
  <header class="ph5"><h1>Football leagues</h1><p class="ph5-s">Pick a league for its table, upcoming matches, odds and predictions.</p></header>
  ${pop.length ? `<section class="sec" aria-labelledby="h-pop"><div class="sec-h"><h2 id="h-pop">Popular leagues</h2></div><div class="leaguegrid big">${pop.map(card).join("")}</div></section>` : ""}
  ${rest.length ? `<section class="sec" aria-labelledby="h-more"><div class="sec-h"><h2 id="h-more">${pop.length ? "More leagues and cups" : "All leagues"}</h2></div><div class="leaguegrid big">${rest.map(card).join("")}</div></section>` : ""}
  ${leagues.length ? "" : `<div class="empty">Leagues appear once matches are loaded.</div>`}`;
  return { title: `Football Leagues: Tables and Predictions | ${SITE_NAME}`, desc: "Browse football leagues with live tables, upcoming matches, odds and predictions.", path: "/leagues", body, ld: [crumbLd(ctx.origin, [["Home", "/"], ["Leagues", "/leagues"]])] };
}

function standingsTable(st) {
  if (!st || !st.groups.length) return "";
  return st.groups.map((g) => `<div class="tablewrap">${g.name ? `<div class="tblcap">${esc(g.name)}</div>` : ""}<table class="stand"><thead><tr><th>#</th><th class="l">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th class="hide-s">GF</th><th class="hide-s">GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>${g.rows.map((r) => {
    const fb = esc(initials(r.team));
    return `<tr><td>${r.pos ?? "–"}</td><td class="l"><span class="team">${r.crest ? `<span class="crest"><img src="${esc(r.crest)}" alt="" loading="lazy" width="20" height="20" data-fb="${fb}"></span>` : `<span class="crest">${fb}</span>`}<span class="nm">${esc(r.team)}</span></span></td><td>${r.p ?? "–"}</td><td>${r.w ?? "–"}</td><td>${r.d ?? "–"}</td><td>${r.l ?? "–"}</td><td class="hide-s">${r.gf ?? "–"}</td><td class="hide-s">${r.ga ?? "–"}</td><td>${r.gd ?? "–"}</td><td class="pts">${r.pts ?? "–"}</td></tr>`;
  }).join("")}</tbody></table></div>`).join("");
}

// ---------- v4.7: climbers and sinkers, and the week in review ----------
function moversHtml(standings, snapshot) {
  if (!snapshot || !snapshot.rows || !snapshot.rows.length) return "";
  const now = ((standings && standings.groups && standings.groups[0] && standings.groups[0].rows) || []).filter((r) => r.p);
  if (now.length < 4) return "";
  const before = new Map(snapshot.rows.map((r) => [r.team, r.pos]));
  const moves = now.map((r) => ({ team: r.team, to: r.pos, from: before.get(r.team), by: before.has(r.team) ? before.get(r.team) - r.pos : null })).filter((x) => x.by !== null);
  const up = moves.filter((x) => x.by > 0).sort((a, b) => b.by - a.by).slice(0, 3);
  const down = moves.filter((x) => x.by < 0).sort((a, b) => a.by - b.by).slice(0, 3);
  if (!up.length && !down.length) return "";
  const line = (x) => `<div class="v4-mv ${x.by > 0 ? "up" : "down"}"><span class="v4-arrow">${x.by > 0 ? "▲" : "▼"}</span><span class="v4-mvname">${esc(x.team)}</span><span class="v4-mvchg">${x.from} → ${x.to}</span><b>${Math.abs(x.by)}</b></div>`;
  const lead = up[0] ? `${esc(up[0].team)} climbed ${up[0].by} ${up[0].by === 1 ? "place" : "places"}` : "";
  const drop = down[0] ? `${esc(down[0].team)} dropped ${Math.abs(down[0].by)} ${Math.abs(down[0].by) === 1 ? "place" : "places"}` : "";
  return `<section class="block v4-movers"><div class="v4-mhead"><h2>Climbers and sinkers</h2><small>vs. ${esc(snapshot.day)}</small></div>
    ${up.length ? `<div class="v4-mvgroup"><small>Climbing</small>${up.map(line).join("")}</div>` : ""}
    ${down.length ? `<div class="v4-mvgroup"><small>Sinking</small>${down.map(line).join("")}</div>` : ""}
    <p class="v4-cap">${[lead, drop].filter(Boolean).join(". ")}${lead || drop ? "." : ""}</p></section>`;
}

function weekHtml(league, recent, upcoming, ctx) {
  const now = Date.now();
  const last = recent.filter((m) => m.ts >= now - 7 * 864e5 && Number.isFinite(resOf(m).h) && Number.isFinite(resOf(m).a)).sort((a, b) => b.ts - a.ts);
  const soon = upcoming.filter((m) => m.ts >= now && m.ts <= now + 4 * 864e5).sort((a, b) => a.ts - b.ts).slice(0, 6);
  if (!last.length && !soon.length) return "";
  const goals = last.reduce((s, m) => s + resOf(m).h + resOf(m).a, 0);
  const margin = last.reduce((best, m) => (Math.abs(resOf(m).h - resOf(m).a) > Math.abs(resOf(best).h - resOf(best).a) ? m : best), last[0]);
  const res = last.length ? `<div class="v4-wk-results">${last.slice(0, 8).map((m) => `<div class="v4-wk-r"><span>${esc(m.home.name)}</span><b>${resOf(m).h}–${resOf(m).a}</b><span class="right">${esc(m.away.name)}</span></div>`).join("")}</div>` : "";
  const facts = last.length ? `<p class="v4-cap">${last.length} ${last.length === 1 ? "result" : "results"} in the last seven days, ${goals} goals (${(goals / last.length).toFixed(1)} a game). Biggest margin: ${esc(margin.home.name)} ${resOf(margin).h}–${resOf(margin).a} ${esc(margin.away.name)}.</p>` : "";
  const next = soon.length ? `<div class="v4-sub">Coming up</div><div class="v4-wk-next">${soon.map((m) => { const p = m.prediction; const top = p ? Math.max(num(p.home_win_pct) || 0, num(p.draw_pct) || 0, num(p.away_win_pct) || 0) : null; return `<div class="v4-wk-n"><span>${esc(m.home.name)} <i>v</i> ${esc(m.away.name)}</span><small>${esc(shortDate(m.ts))} · ${esc(clock(m.ts))}${top !== null ? ` · top ${Math.round(top)}%` : ""}</small></div>`; }).join("")}</div>` : "";
  return `<section class="block v4-week"><div class="v4-mhead"><h2>The week in ${esc(league.name)}</h2></div>${res}${facts}${next}</section>`;
}

// The opening paragraph of a league page. Three angles, picked per league and per day, built from that league's own numbers.
function leagueLede(league, matches, standings, ctx) {
  const rows = (standings && standings.groups && standings.groups[0] && standings.groups[0].rows) || [];
  // The page already passes only matches still to play, so the opening uses the same list as the "to play" count.
  const upcoming = matches.slice().sort((a, b) => a.ts - b.ts);
  const n = upcoming.length;
  const leader = rows.find((r) => r.pts !== null && r.p);
  const best = upcoming.map((m) => ({ m, b: topPick(m) })).filter((x) => x.b).sort((a, b) => b.b.pct - a.b.pct)[0];
  const seed = `${league.id}|${todayKey()}`;
  const i = seed.split("").reduce((t, c) => t + c.charCodeAt(0), 0) % 3;
  const count = n ? `${n} ${n === 1 ? "match" : "matches"}` : "no matches yet";
  const angles = [
    `${esc(league.name)} has ${count} on our board right now.${best ? ` The strongest model pick is ${esc(best.b.label)} (${Math.round(best.b.pct)}%) in ${esc(best.m.home.name)} v ${esc(best.m.away.name)}.` : ""} Start there, then check the table below for context.`,
    `${leader ? `${esc(leader.team)} lead on ${leader.pts} points.` : `The table is still settling.`} ${n ? `Our numbers cover ${count} across the next few days.` : "New fixtures appear here as bookmakers publish them."} Every price and pick is shown with its odds so you can judge it yourself.`,
    `${best ? `Start with ${esc(best.m.home.name)} v ${esc(best.m.away.name)}: the model gives ${esc(best.b.label)} a ${Math.round(best.b.pct)}% chance.` : `Nothing in ${esc(league.name)} clears our threshold right now, so there are no strong picks.`} ${n ? `There are ${count} to follow.` : ""}`
  ];
  return `<p class="lede">${angles[i]}</p>`;
}

// League page, rebuilt as a matchday board: a league identity bar, a day-by-day fixture feed with probability splits,
// and a sticky table beside it on wide screens. Its own visual language (league-coloured, not card-and-chance-bar).
function leagueFeedItem(m) {
  const tp = topPick(m);
  const mk = marketsOf(m);
  const pct = tp ? Math.round(tp.pct) : null;
  const pk = tp ? tp.k : null;
  const r = resOf(m);
  const when = r.state === "pre"
    ? `<time class="lgb-time w-top" datetime="${esc(m.kickoff || "")}" data-t="hm">${kickLabel(m.ts)}</time>`
    : `<span class="lgb-time w-top">${esc(r.label)}</span>`;
  return `<a class="lgb-fx" ${rowAttrs(m, pk)} href="${matchPath(m)}">
    ${when}
    <span class="lgb-teams"><span>${crest(m.home)}<span class="nm">${esc(m.home.name)}</span>${scEl(m, "h")}</span><span>${crest(m.away)}<span class="nm">${esc(m.away.name)}</span>${scEl(m, "a")}</span></span>
    <span class="lgb-read">${splitBar(mk) || ""}${tp ? `<span class="lgb-pick"><small>Model</small>${esc(tp.label)} <b>${pct}%</b>${pstEl(m, pk)}</span>` : `<span class="lgb-pick none">No clear pick</span>`}</span>
    <span class="lgb-go" aria-hidden="true">›</span>
  </a>`;
}

function leagueFeed(matches, recent = []) {
  const sorted = matches.slice().sort((a, b) => a.ts - b.ts);
  const started = sorted.filter((m) => resOf(m).state !== "pre");
  const seen = new Set(started.map((m) => m.id));
  const played = [...started, ...recent.filter((m) => !seen.has(m.id) && m.ts >= Date.now() - 7 * 864e5 && resOf(m).state !== "pre")]
    .sort((a, b) => b.ts - a.ts);
  const ahead = sorted.filter((m) => resOf(m).state === "pre");
  const days = new Map();
  for (const m of ahead) {
    const k = dayKey(m.ts);
    days.set(k, [...(days.get(k) || []), m]);
  }
  const playedHtml = played.length ? `<div class="lgb-day">
      <h3><span>Live and played</span><small>${played.length} ${played.length === 1 ? "match" : "matches"}</small></h3>
      <div class="lgb-list">${played.map(leagueFeedItem).join("")}</div>
    </div>` : "";
  const aheadHtml = [...days.entries()].map(([k, list]) => `<div class="lgb-day">
      <h3><span>${esc(longDate(list[0].ts))}</span><small>${list.length} ${list.length === 1 ? "match" : "matches"}</small></h3>
      <div class="lgb-list">${list.map(leagueFeedItem).join("")}</div>
    </div>`).join("");
  if (!playedHtml && !aheadHtml) return `<div class="empty">Nothing scheduled in the next few days.</div>`;
  return playedHtml + aheadHtml;
}


// League write-up: plain sentences built from this league's own numbers, plus links to its clubs and
// the prediction pages that suit it. Thin leagues still get a useful page: the links and method notes carry it.
function leagueAbout(league, matches, rows) {
  const parts = [];
  parts.push(`<p>${esc(league.name)} has ${matches.length ? plural(matches.length, "match") + " to play on our list today and the coming days" : "no matches on our list right now, so the fixtures below will fill in as the feed adds them"}.${rows.length ? ` The table covers ${plural(rows.length, "team")}.` : ""}</p>`);
  const leader = rows.find((r) => r.pts !== null && r.p);
  const last = [...rows].reverse().find((r) => r.pts !== null && r.p);
  if (leader && last && leader !== last) parts.push(`<p>${esc(leader.team)} sit at the top on ${leader.pts} points from ${leader.p} games, while ${esc(last.team)} are at the bottom on ${last.pts}. Form and points move quickly this early in a season, so the table is worth checking against the picks.</p>`);
  const best = matches.map((m) => ({ m, tp: topPick(m) })).filter((x) => x.tp).sort((a, b) => b.tp.pct - a.tp.pct)[0];
  if (best) parts.push(`<p>The strongest model read in ${esc(league.name)} right now is ${esc(best.tp.label)} in ${esc(best.m.home.name)} vs ${esc(best.m.away.name)}, at ${Math.round(best.tp.pct)}%. Model chances are estimates, so treat them as a guide, not a guarantee.</p>`);
  const clubs = TEAMS.filter((t) => matches.some((m) => isClub(m.home.name, t) || isClub(m.away.name, t)) || rows.some((r) => isClub(r.team, t)));
  const clubLinks = clubs.length ? `<h2>Clubs in ${esc(league.name)}</h2><div class="catgrid small">${clubs.map((t) => `<a class="catcard" href="/team/${t.slug}"><b>${esc(t.name)}</b><span>Upcoming matches and results</span></a>`).join("")}</div>` : "";
  return `<section class="prose lgb-about"><h2>About ${esc(league.name)} predictions</h2>${parts.join("")}
    <p>Every pick on this page comes from bookmaker odds with the margin taken out, and a model read of each match. See <a href="/how-we-predict">how we predict</a> for what the model can and cannot do, and the <a href="/track-record">track record</a> for how past picks landed.</p>
    ${clubLinks}
    <h2>Predictions to compare for ${esc(league.name)}</h2>
    <div class="catgrid small"><a class="catcard" href="/predictions/over-2-5-goals"><b>Over 2.5 goals</b><span>Goal-rich matches across all leagues</span></a><a class="catcard" href="/predictions/both-teams-to-score"><b>Both teams to score</b><span>Matches where both sides are likely to score</span></a><a class="catcard" href="/predictions/double-chance"><b>Double chance</b><span>Safer cover on two of three results</span></a><a class="catcard" href="/predictions/banker-picks"><b>Banker picks</b><span>The strongest model reads of the day</span></a><a class="catcard" href="/football-predictions-today"><b>Today's predictions</b><span>Every match on today's list</span></a><a class="catcard" href="/results"><b>Results</b><span>Finished matches and final scores</span></a></div>
  </section>`;
}

export function leaguePage(ctx, { league, matches, standings, allLeagues, recent = [], snapshot = null }) {
  const path = leaguePath(league);
  const picks = rankPicks("banker-picks", matches).slice(0, 4);
  const st = leagueStory(league, matches, ctx, standings);
  const hue = (Number(league.id) * 47) % 360;
  const rows = (standings && standings.groups && standings.groups[0] && standings.groups[0].rows) || [];
  const teams = rows.length;
  const live = (ctx.liveItems || []).filter((m) => m.league && m.league.id === league.id).length;
  const leader = rows.find((r) => r.pts !== null && r.p);
  const stats = `<div class="lgb-stats">
      <div><b>${matches.length}</b><span>to play</span></div>
      <div><b>${live}</b><span>live now</span></div>
      <div><b>${teams || "–"}</b><span>teams</span></div>
      <div><b>${leader ? leader.pts : "–"}</b><span>${leader ? esc(leader.team) : "leader pts"}</span></div>
    </div>`;
  const best = picks.length ? `<div class="lgb-best" role="list">${picks.map((it) => {
      const tp = topPick(it.m || it);
      return tp ? `<a role="listitem" class="lgb-chip" href="${matchPath(it.m || it)}"><b>${Math.round(tp.pct)}%</b><span>${esc((it.m || it).home.name)} v ${esc((it.m || it).away.name)}</span><em>${esc(tp.label)}</em></a>` : "";
    }).join("")}</div>` : "";
  const nextKo = matches.filter((x) => x.ts > Date.now()).sort((a, b) => a.ts - b.ts)[0];
  const lgPicks = matches.map((m) => ({ m, tp: topPick(m) })).filter((x) => x.tp).sort((x, y) => y.tp.pct - x.tp.pct);
  const faq = [
    [`What are today's ${league.name} predictions?`, matches.length ? `${plural(matches.length, "upcoming match")} in the ${league.name} carry odds and model chances on this page, and ${lgPicks.length} of them have a clear pick.` : `There are no upcoming ${league.name} matches on our list right now. This page fills in when the next fixtures are added.`],
    ...(lgPicks[0] ? [[`Which ${league.name} match has the strongest pick?`, `${lgPicks[0].m.home.name} vs ${lgPicks[0].m.away.name}: "${lgPicks[0].tp.label}" at ${Math.round(lgPicks[0].tp.pct)}%${lgPicks[0].tp.odd ? ` and odds of ${fmtOdd(lgPicks[0].tp.odd)}` : ""}. It is an estimate, not a guarantee.`]] : []),
    ...(nextKo ? [[`When is the next ${league.name} match?`, `${nextKo.home.name} vs ${nextKo.away.name} on ${longDate(nextKo.ts)} at ${clock(nextKo.ts)} (${TZ_LABEL} time). Your device shows the time in your own zone.`]] : []),
    [`Are ${league.name} predictions on SportyPredictz free?`, "Yes. Every prediction, odds table and the league table are free to read. The site does not take bets."]
  ];
  const body = `${crumbs([["Home", "/"], ["Leagues", "/leagues"], [league.name, path]])}
  <div class="lgb" style="--lh:${hue}">
    <header class="lgb-hero">
      <div class="lgb-id">${lgIcon(league)}<div><small>${esc(league.cn || "")}</small><h1>${esc(league.name)} predictions today</h1><p>Odds, model chances, tips and the live table, updated through the day.</p>${nextKo ? `<p class="kickcount">Next kick-off <b data-ko="${nextKo.ts}">${clock(nextKo.ts)}</b> · ${esc(nextKo.home.name)} v ${esc(nextKo.away.name)}</p>` : ""}</div></div>
      ${stats}
    </header>
    ${leagueLede(league, matches, standings, ctx)}
    ${best ? `<section class="lgb-strip"><h2>Strongest model picks</h2>${best}</section>` : ""}
    <div class="lgb-grid">
      <div class="lgb-main">
        <section class="lgb-section"><h2>Fixtures</h2>${leagueFeed(matches, recent)}</section>
        ${weekHtml(league, recent, matches, ctx)}
        ${moversHtml(standings, snapshot)}
        ${leaguePulse(league, [...matches, ...recent], standings, ctx)}
      </div>
      <aside class="lgb-side">
        <section class="lgb-table"><h2>Table</h2>${standingsTable(standings) || `<p class="mut">The table for ${esc(league.name)} is not in our data yet. Fixtures and picks still update as usual.</p>`}</section>
        <section class="lgb-others"><h2>More leagues</h2><div class="leaguegrid">${allLeagues.filter((l) => l.id !== league.id).slice(0, 10).map((l) => `<a class="lgcard" href="${leaguePath(l)}">${lgIcon(l)}<span>${esc(l.name)}</span></a>`).join("")}</div></section>
      </aside>
    </div>
  </div>
  ${leagueAbout(league, matches, rows)}
  ${sponsorSlot("top")}
  ${faqHtml(faq, `${league.name} predictions: frequently asked questions`)}`;
  return {
    title: fitTitle([`${league.name} Predictions Today: Odds & Tips | ${SITE_NAME}`, `${league.name} Predictions & Odds | ${SITE_NAME}`, `${league.name} Predictions`]),
    desc: `${league.name} predictions for ${longDate(Date.now())}: ${st.f.now.length ? `${st.f.now.length} live now, ` : ""}${st.f.today.length || st.f.ahead.length} to play${st.f.best ? `, top pick ${st.f.best.label} (${Math.round(st.f.best.pct)}%)` : ""}. Odds, model chances and the league table.`,
    path, body, ld: [crumbLd(ctx.origin, [["Home", "/"], ["Leagues", "/leagues"], [league.name, path]]), pageLd(ctx, { name: `${league.name} predictions`, desc: `${league.name} predictions, odds and table`, path }), faqLd(faq), ...(matches.length ? [itemListLd(ctx, `${league.name} fixtures`, matches.slice(0, 20))] : [])]
  };
}

function compareTable(m) {
  const p = m.prediction, o = m.odds || {};
  if (!p && !m.odds) return "";
  const invSum = (num(o.home_win) ? 1 / o.home_win : 0) + (num(o.draw) ? 1 / o.draw : 0) + (num(o.away_win) ? 1 / o.away_win : 0);
  const imp = (price) => (num(price) && invSum ? (1 / price / invSum) * 100 : null);
  const xg = p?.expected_goals || {};
  const rows = [
    ["Model win chance", p ? num(p.home_win_pct) : null, p ? num(p.away_win_pct) : null, pctTxt, 1],
    ["Market win chance", imp(o.home_win), imp(o.away_win), pctTxt, 1],
    ["Win odds", num(o.home_win), num(o.away_win), fmtOdd, -1],
    ["Expected goals", num(xg.home), num(xg.away), (v) => (v === null ? "–" : v.toFixed(1)), 1],
    ["Model edge", p ? edgeOf(p.home_win_pct, o.home_win) : null, p ? edgeOf(p.away_win_pct, o.away_win) : null, (v) => (v === null ? "–" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`), 1]
  ].filter((r) => r[1] !== null || r[2] !== null);
  if (!rows.length) return "";
  const cell = (v, other, f, dir) => `<td class="${v !== null && other !== null && (v - other) * dir > 0 ? "win" : ""}">${f(v)}</td>`;
  return `<table class="avb"><thead><tr><th>${esc(m.home.name)}</th><th>Comparison</th><th>${esc(m.away.name)}</th></tr></thead><tbody>${rows.map((r) => `<tr>${cell(r[1], r[2], r[3], r[4])}<td class="k">${esc(r[0])}</td>${cell(r[2], r[1], r[3], r[4])}</tr>`).join("")}</tbody></table>`;
}

// Three stages on one page: before kick-off (the sections below), live (score and our pick right now),
// and after full time (what the model expected against what happened).
const pctOf = (x) => (num(x) === null ? null : Math.round(num(x)));
function stageBlock(m, pick, verdictState) {
  const rs = resOf(m);
  const hasScore = rs.h !== null && rs.h !== undefined;
  if (rs.state === "live" && hasScore) {
    const right = verdictState === "on" ? "is winning right now" : verdictState === "off" ? "is losing right now" : "is still open";
    return `<section class="block live-now"><h2>Live now</h2><p>${esc(rs.label || "In play")}: ${rs.h}–${rs.a}. Our pick ${right}.</p><p class="mnote">The score on this page refreshes as the match goes on.</p></section>`;
  }
  if (rs.state === "ft" && hasScore) {
    const p = m.prediction;
    const outcome = rs.h > rs.a ? `${m.home.name} won` : rs.h < rs.a ? `${m.away.name} won` : "The match ended level";
    const options = p ? [[m.home.name, pctOf(p.home_win_pct)], ["a draw", pctOf(p.draw_pct)], [m.away.name, pctOf(p.away_win_pct)]].filter((x) => x[1] !== null) : [];
    const fav = options.sort((a, b) => b[1] - a[1])[0];
    const picked = pick ? `Our pick was ${esc(pick.label)} at ${Math.round(pick.pct)}%${pick.odd ? ` (odds ${fmtOdd(pick.odd)})` : ""}, and it ${verdictState === "won" ? "landed" : "did not land"}.` : "";
    return `<section class="block review"><h2>Expectation vs result</h2>
      <p>Final score ${rs.h}–${rs.a}. ${esc(outcome)}.</p>
      ${fav ? `<p>Before kick-off, the model's most likely outcome was ${esc(fav[0])}, at ${fav[1]}%.</p>` : ""}
      ${picked ? `<p>${picked}</p>` : ""}</section>`;
  }
  return "";
}

const ord = (n) => { const x = Number(n); const s = ["th", "st", "nd", "rd"], v = x % 100; return `${x}${s[(v - 20) % 10] || s[v] || s[0]}`; };
// Before kick-off: where both sides sit in the table, and what a win would change.
function stakesBlock(m, standings) {
  if (resOf(m).state !== "pre") return "";
  const rows = ((standings && standings.groups && standings.groups[0] && standings.groups[0].rows) || []).filter((r) => r.p && r.pts !== null);
  if (rows.length < 6) return "";
  const sorted = [...rows].sort((a, b) => a.pos - b.pos);
  const h = sorted.find((r) => r.team === m.home.name), a = sorted.find((r) => r.team === m.away.name);
  if (!h || !a) return "";
  const fourth = sorted[3], safe = sorted[sorted.length - 4];
  const sentence = (r) => `${r.team} are ${ord(r.pos)} on ${r.pts} points from ${r.p} games`;
  const homeWin = h.pts + 3;
  const lift = homeWin > fourth.pts
    ? `A home win would lift ${h.team} to ${homeWin} points, above fourth place (${fourth.team}, ${fourth.pts}).`
    : `A home win would lift ${h.team} to ${homeWin} points, still ${fourth.pts - homeWin} short of fourth place (${fourth.team}, ${fourth.pts}).`;
  const drop = `The side just clear of the drop zone, ${safe.team}, have ${safe.pts} points.`;
  return `<section class="block stakes"><h2>What's at stake</h2><p>${esc(sentence(h))}. ${esc(sentence(a))}.</p><p>${esc(lift)} ${esc(drop)}</p></section>`;
}

// ---------- visual blocks (v4: class names prefixed so they cannot clash with existing styles) ----------
const abbr = (n) => String(n || "").split(/\s+/).filter(Boolean).slice(0, 3).map((w) => w[0]).join("").toUpperCase();
const barPct = (v, max) => `${Math.max(0, Math.min(100, ((Number(v) || 0) / (max || 1)) * 100)).toFixed(1)}%`;
const statTile = (label, value, sub = "") => `<div class="v4-tile"><small>${esc(label)}</small><b>${esc(value)}</b>${sub ? `<span>${esc(sub)}</span>` : ""}</div>`;

// ---------- modules: each page builds a set of notable blocks, scores them, and leads with the strongest ----------
const modHtml = (key, title, big, sub, body) => `<section class="v4-mod v4-m-${key}"><div class="v4-mh"><h3>${esc(title)}</h3><small>${esc(sub)}</small></div><div class="v4-big">${esc(big)}</div>${body}</section>`;
// The highest-scoring module becomes the lead (full width). The rest follow in score order.
function renderModules(mods) {
  const sorted = [...mods].sort((a, b) => b.score - a.score);
  return sorted.map((x, i) => (i === 0 ? x.html.replace('class="v4-mod ', 'class="v4-mod v4-lead ') : x.html)).join("");
}

function leagueModules(league, matches, standings, ctx) {
  const f = leagueFacts(league, matches, ctx, standings);
  const seed = `${league.id}|${todayKey()}`;
  const jit = (k) => (hash(seed + k) % 100) / 1000;
  const rows = ((standings && standings.groups && standings.groups[0] && standings.groups[0].rows) || []).filter((r) => r.p && r.pts !== null);
  const sorted = [...rows].sort((a, b) => a.pos - b.pos);
  const mods = [];
  const add = (key, score, html) => { if (html) mods.push({ key, score: score + jit(key), html }); };
  const row = (r, max, cls = "") => `<div class="v4-row${cls}"><span class="v4-pos">${r.pos}</span><span class="v4-name">${esc(r.team)}</span><span class="v4-bar"><i style="width:${barPct(r.pts, max)}"></i></span><b class="mono">${r.pts}</b></div>`;

  if (sorted.length >= 6) {
    const top = sorted[0], second = sorted[1], fourth = sorted[3], tail = sorted[sorted.length - 1], safe = sorted[sorted.length - 4];
    const gapTop = top.pts - second.pts, gapSafe = safe.pts - tail.pts, gapFour = top.pts - fourth.pts;
    const max = Math.max(...sorted.map((r) => r.pts), 1);
    add("title", gapTop <= 2 ? 9 : gapTop >= 8 ? 2 : 5, modHtml("title", "Title race", `${gapTop} pt${gapTop === 1 ? "" : "s"}`,
      `${top.team} lead, ${second.team} second`, `<div class="v4-table">${sorted.slice(0, 6).map((r) => row(r, max, r.pos <= 4 ? " top" : "")).join("")}</div>`));
    add("relegation", gapSafe <= 3 ? 8 : 3, modHtml("relegation", "Bottom three", `${gapSafe} pts`,
      `${tail.team} to safety`, `<div class="v4-table">${sorted.slice(-4).map((r) => row(r, max, r.pos > sorted.length - 3 ? " drop" : "")).join("")}</div>`));
    add("top4", gapFour <= 4 ? 6 : 1, modHtml("top4", "Top four", `${gapFour} pts`,
      `${fourth.team} in fourth`, `<p class="v4-note">${esc(sorted[0].team)} ${sorted[0].pts} pts, ${esc(fourth.team)} ${fourth.pts} pts after ${fourth.p} games.</p>`));
  }

  if (rows.length >= 6 && rows.every((r) => Number.isFinite(r.gf) && Number.isFinite(r.ga))) {
    const played = rows.reduce((s, r) => s + r.p, 0);
    const perGame = rows.reduce((s, r) => s + r.gf, 0) / (played / 2);
    const attack = [...rows].sort((a, b) => b.gf / b.p - a.gf / a.p)[0];
    const leak = [...rows].sort((a, b) => a.ga / a.p - b.ga / b.p)[0];
    add("goals", perGame >= 2.9 || perGame <= 2.2 ? 7 : 2, modHtml("goals", "Goals", perGame.toFixed(2), "a game across the table",
      `<div class="v4-pair"><span>Most scored <b>${esc(attack.team)}</b></span><span>Fewest conceded <b>${esc(leak.team)}</b></span></div>`));
  }

  if (rows.length >= 6 && rows.every((r) => Number.isFinite(r.gd))) {
    const byGd = [...rows].sort((a, b) => b.gd - a.gd);
    const gdPos = (r) => byGd.indexOf(r) + 1;
    const big = rows.map((r) => ({ r, diff: gdPos(r) - r.pos })).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0];
    if (big && Math.abs(big.diff) >= 3) {
      const gd = big.r.gd > 0 ? `+${big.r.gd}` : `${big.r.gd}`;
      add("mismatch", 7, modHtml("mismatch", "Table vs goal difference", `${Math.abs(big.diff)} places`,
        big.r.team, `<p class="v4-note">${esc(big.r.team)} are ${ord(big.r.pos)} on points but ${ord(gdPos(big.r))} on goal difference (${gd}).</p>`));
    }
  }

  const formed = sorted.filter((r) => typeof r.form === "string" && /^[WDL]{3,}$/i.test(r.form));
  if (formed.length >= 6) {
    const pts = (s) => [...s.slice(-5).toUpperCase()].reduce((t, c) => t + (c === "W" ? 3 : c === "D" ? 1 : 0), 0);
    const hot = [...formed].sort((a, b) => pts(b.form) - pts(a.form))[0];
    const spread = pts(hot.form) - Math.min(...formed.map((r) => pts(r.form)));
    add("form", spread >= 8 ? 7 : 3, modHtml("form", "Recent form", `${pts(hot.form)} pts`, `${hot.team}, last five`,
      `<div class="v4-table">${formed.slice(0, 6).map((r) => { const s = [...r.form.slice(-5).toUpperCase()]; return `<div class="v4-form"><span class="v4-fname">${esc(r.team)}</span><span class="v4-dots">${s.map((c) => `<i class="${c === "W" ? "w" : c === "D" ? "d" : "l"}"></i>`).join("")}</span><b class="mono">${pts(r.form)}</b></div>`; }).join("")}</div>`));
  }

  const withP = f.ahead.filter((m) => m.prediction);
  if (withP.length >= 2) {
    const strong = withP.filter((m) => Math.max(num(m.prediction.home_win_pct) || 0, num(m.prediction.away_win_pct) || 0, num(m.prediction.draw_pct) || 0) >= 60).length;
    const toss = withP.filter((m) => Math.max(num(m.prediction.home_win_pct) || 0, num(m.prediction.away_win_pct) || 0, num(m.prediction.draw_pct) || 0) < 45).length;
    const fx = withP.slice(0, 6).map((m) => {
      const p = m.prediction; const h = num(p.home_win_pct) || 0, d = num(p.draw_pct) || 0, a = num(p.away_win_pct) || 0; const t = h + d + a || 1;
      return `<div class="v4-fx"><div class="v4-fx-head"><span>${esc(m.home.name)} <em>v</em> ${esc(m.away.name)}</span><small class="mono">${esc(kickLabel(m.ts))}</small></div><div class="v4-chance"><i class="h" style="width:${((h / t) * 100).toFixed(1)}%"></i><i class="d" style="width:${((d / t) * 100).toFixed(1)}%"></i><i class="a" style="width:${((a / t) * 100).toFixed(1)}%"></i></div><div class="v4-legend"><span>${Math.round(h)}% ${esc(abbr(m.home.name))}</span><span>${Math.round(d)}% X</span><span>${Math.round(a)}% ${esc(abbr(m.away.name))}</span></div></div>`;
    }).join("");
    add("model", strong >= 2 || toss >= 2 ? 6 : 3, modHtml("model", "Model chances", String(strong), "games with a side at 60%+", fx));
  }

  const finished = f.done.filter((m) => Number.isFinite(resOf(m).h) && Number.isFinite(resOf(m).a));
  if (finished.length >= 3) {
    const totals = finished.map((m) => resOf(m).h + resOf(m).a);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const over = Math.round((100 * totals.filter((t) => t > 2.5).length) / totals.length);
    const homeW = finished.filter((m) => resOf(m).h > resOf(m).a).length, awayW = finished.filter((m) => resOf(m).a > resOf(m).h).length;
    add("finished", finished.length >= 5 && (avg >= 3.5 || avg <= 2) ? 6 : 2, modHtml("finished", "Finished games", avg.toFixed(1), `goals a game from ${finished.length}`,
      `<div class="v4-pair"><span>${over}% over 2.5</span><span>Home ${homeW} · Away ${awayW}</span></div>`));
  }

  if (f.recs.length >= 3) {
    const rate = f.won / f.recs.length;
    add("record", rate >= 0.6 || rate <= 0.3 ? 5 : 2, modHtml("record", "Our picks here", `${f.won}/${f.recs.length}`, "came in", ""));
  }

  return mods;
}

function matchModules(m, standings) {
  const p = m.prediction, o = m.odds || {};
  const seed = String(m.id);
  const jit = (k) => (hash(seed + k) % 100) / 1000;
  const mods = [];
  const add = (key, score, html) => mods.push({ key, score: score + jit(key), html });
  const h = m.home.name, a = m.away.name;
  if (p && num(p.home_win_pct) !== null && num(o.home_win)) {
    const mk = (price) => (1 / price) * 100;
    const gapH = num(p.home_win_pct) - mk(o.home_win), gapA = num(p.away_win_pct) - (num(o.away_win) ? mk(o.away_win) : 0);
    const side = Math.abs(gapH) >= Math.abs(gapA) ? { t: h, g: gapH, pct: num(p.home_win_pct), price: o.home_win } : { t: a, g: gapA, pct: num(p.away_win_pct), price: o.away_win };
    if (Math.abs(side.g) >= 4) add("value", 8, modHtml("value", "Model vs price", `${Math.abs(Math.round(side.g))} pts`, `${side.t} ${side.g > 0 ? "edge" : "shortfall"}`,
      `<div class="v4-pair"><span>Model ${Math.round(side.pct)}%</span><span>Price ${Math.round(mk(side.price))}%</span></div>`));
  }
  const xg = p && p.expected_goals;
  if (xg && num(xg.home) !== null && num(xg.away) !== null) {
    const total = num(xg.home) + num(xg.away);
    if (total >= 3 || total <= 2.1) add("goals", 6, modHtml("goals", "Expected goals", total.toFixed(1), total >= 3 ? "an open game" : "a tight game",
      `<div class="v4-pair"><span>${esc(h)} ${num(xg.home).toFixed(1)}</span><span>${esc(a)} ${num(xg.away).toFixed(1)}</span></div>`));
  }
  if (p && Math.max(num(p.home_win_pct) || 0, num(p.away_win_pct) || 0, num(p.draw_pct) || 0) < 45) {
    add("toss", 5, modHtml("toss", "Coin toss", `${Math.round(Math.max(num(p.home_win_pct) || 0, num(p.away_win_pct) || 0, num(p.draw_pct) || 0))}%`, "highest outcome", ""));
  }
  const rows = ((standings && standings.groups && standings.groups[0] && standings.groups[0].rows) || []).filter((r) => r.p && r.pts !== null);
  if (rows.length >= 6) {
    const sorted = [...rows].sort((x, y) => x.pos - y.pos);
    const hr = sorted.find((r) => r.team === h), ar = sorted.find((r) => r.team === a);
    const fourth = sorted[3], safe = sorted[sorted.length - 4];
    if (hr && ar) {
      const near = [[hr], [ar]].map(([r]) => ({ r, d: Math.min(Math.abs(r.pts - fourth.pts), Math.abs(r.pts - safe.pts)) })).sort((x, y) => x.d - y.d)[0];
      if (near.d <= 4) add("stakes", near.d <= 2 ? 9 : 6, modHtml("stakes", "Table stakes", `${near.d} pts`, `${near.r.team} from a key line`,
        `<div class="v4-pair"><span>${esc(h)} ${hr.pts} pts · ${ord(hr.pos)}</span><span>${esc(a)} ${ar.pts} pts · ${ord(ar.pos)}</span></div>`));
    }
  }
  return mods;
}

// ================= v4.4 layouts =================
// Each league page picks ONE layout from its own data. Each layout needs certain data (need), has a
// notability score (score), and draws its own composition (render). The highest score wins; ties break on a seed.
const slugName = (n) => String(n || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const perGame = (v, p) => (p ? v / p : 0);
const p0 = (r) => Number(r.p) || 0;
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "–");
const jitterFor = (seed, key) => (hash(seed + key) % 100) / 1000;

// One row per team, with goals and form filled from the table when it has them, otherwise from finished results.
function teamTable(rows, finished) {
  const fromResults = new Map();
  const bump = (team, gf, ga, res) => {
    const x = fromResults.get(team) || { gf: 0, ga: 0, p: 0, recent: [] };
    x.gf += gf; x.ga += ga; x.p += 1; x.recent.push({ ts: res.ts, c: res.c });
    fromResults.set(team, x);
  };
  for (const m of finished) {
    const h = resOf(m).h, a = resOf(m).a;
    const rs = (c) => ({ ts: m.ts, c });
    bump(m.home.name, h, a, rs(h > a ? "W" : h < a ? "L" : "D"));
    bump(m.away.name, a, h, rs(a > h ? "W" : a < h ? "L" : "D"));
  }
  return [...rows].sort((a, b) => a.pos - b.pos).map((r) => {
    const x = fromResults.get(r.team);
    const fromTable = Number.isFinite(r.gf) && Number.isFinite(r.ga);
    const gf = fromTable ? r.gf : x && x.p >= 3 ? x.gf : null;
    const ga = fromTable ? r.ga : x && x.p >= 3 ? x.ga : null;
    const gp = fromTable ? p0(r) : x ? x.p : 0;
    // Form: table value if present, else the last five finished results, oldest first.
    let form = typeof r.form === "string" && /^[WDL]{3,}$/i.test(r.form) ? r.form.slice(-5).toUpperCase() : null;
    if (!form && x && x.recent.length >= 5) form = [...x.recent].sort((a, b) => b.ts - a.ts).slice(0, 5).reverse().map((q) => q.c).join("");
    const pts = Number(r.pts) || 0, p = Number(r.p) || 0;
    return { team: r.team, pos: r.pos, p, pts, ppg: perGame(pts, p), gf, ga, gfpg: gf === null ? null : perGame(gf, gp), gapg: ga === null ? null : perGame(ga, gp), gd: Number.isFinite(r.gd) ? r.gd : gf !== null && ga !== null ? gf - ga : null, form };
  });
}

const formPts = (s) => [...String(s || "")].reduce((t, c) => t + (c === "W" ? 3 : c === "D" ? 1 : 0), 0);
const cell = (c) => (c === "W" ? "w" : c === "D" ? "d" : "l");

const LEAGUE_LAYOUTS = [
  { key: "title",
    need: (T) => T.teams.length >= 6,
    score: (T) => { const g = T.teams[0].pts - T.teams[1].pts; return g <= 2 ? 9 : g >= 8 ? 2 : 5; },
    render: (T) => {
      const [a, b] = T.teams, gap = a.pts - b.pts, max = Math.max(...T.teams.map((t) => t.pts), 1);
      return `<div class="v4-duel">
        <div class="v4-duo"><small>Leader</small><b>${esc(a.team)}</b><span>${a.pts} pts · ${f2(a.ppg)} ppg</span></div>
        <div class="v4-gapbox"><b>${gap}</b><small>${gap === 1 ? "point" : "points"}</small><i style="width:${Math.min(100, gap * 10)}%"></i></div>
        <div class="v4-duo right"><small>Second</small><b>${esc(b.team)}</b><span>${b.pts} pts · ${f2(b.ppg)} ppg</span></div>
      </div>
      <div class="v4-race">${T.teams.slice(0, 8).map((t) => `<div class="v4-racer" title="${esc(t.team)}"><span style="left:${barPct(t.pts, max)}"><b>${esc(abbr(t.team))}</b></span></div>`).join("")}</div>
      <p class="v4-cap">${esc(a.team)} lead ${esc(b.team)} by ${gap} ${gap === 1 ? "point" : "points"} after ${a.p} games. ${T.teams.filter((t) => t.pts >= a.pts - 3).length} clubs are within three points of the top.</p>`;
    } },

  { key: "relegation",
    need: (T) => T.teams.length >= 6,
    score: (T) => { const n = T.teams.length, safe = T.teams[n - 4], last = T.teams[n - 1]; return safe.pts - last.pts <= 3 ? 8 : 3; },
    render: (T) => {
      const n = T.teams.length, season = 2 * (n - 1), last = T.teams[n - 1];
      const proj = (t) => Math.round(t.ppg * season);
      const rows = T.teams.slice(-6).reverse();
      const max = Math.max(...rows.map(proj), 1);
      const safety = proj(T.teams[n - 4]);
      return `<div class="v4-sink">${rows.map((t) => `<div class="v4-srow"><span class="v4-spos">${t.pos}</span><span class="v4-sname">${esc(t.team)}</span><span class="v4-strack"><i style="width:${barPct(proj(t), max)}"></i><em style="left:${barPct(safety, max)}"></em></span><b class="mono">${proj(t)}</b></div>`).join("")}</div>
      <p class="v4-cap">${esc(last.team)} have ${last.pts} points from ${last.p} games, a pace of ${proj(last)} over ${season}. ${esc(T.teams[n - 4].team)} project to ${safety}, the first side clear of the bottom three.</p>`;
    } },

  { key: "form",
    need: (T) => T.teams.filter((t) => t.form).length >= 6,
    score: (T) => { const f = T.teams.filter((t) => t.form).map((t) => formPts(t.form)); return Math.max(...f) - Math.min(...f) >= 8 ? 7 : 3; },
    render: (T) => {
      const rows = T.teams.filter((t) => t.form).sort((a, b) => formPts(b.form) - formPts(a.form)).slice(0, 8);
      return `<div class="v4-heat">${rows.map((t) => `<div class="v4-hrow"><span class="v4-hname">${esc(t.team)}</span><span class="v4-cells">${[...t.form].map((c, i, arr) => `<i class="${cell(c)}${i === arr.length - 1 ? " now" : ""}"></i>`).join("")}</span><b class="mono">${formPts(t.form)}</b></div>`).join("")}</div>
      <p class="v4-cap">${esc(rows[0].team)} lead the form table on ${formPts(rows[0].form)} points from five. ${(u => `${u} ${u === 1 ? "club is" : "clubs are"}`)(T.teams.filter((t) => t.form && !/L/i.test(t.form)).length)} unbeaten in their last five. Oldest result on the left.</p>`;
    } },

  { key: "goals",
    need: (T) => T.teams.every((t) => t.gfpg !== null && t.gapg !== null),
    score: (T) => { const avg = T.teams.reduce((s, t) => s + t.gfpg, 0) / T.teams.length; return avg >= 2.9 || avg <= 2.2 ? 7 : 2; },
    render: (T) => {
      const xs = T.teams.map((t) => t.gfpg), ys = T.teams.map((t) => t.gapg);
      const lo = (a) => Math.min(...a) - 0.2, hi = (a) => Math.max(...a) + 0.2;
      const x0 = lo(xs), x1 = hi(xs), y0 = lo(ys), y1 = hi(ys);
      const X = (v) => 20 + ((v - x0) / (x1 - x0)) * 260, Y = (v) => 20 + ((v - y0) / (y1 - y0)) * 200;
      const ax = xs.reduce((s, v) => s + v, 0) / xs.length, ay = ys.reduce((s, v) => s + v, 0) / ys.length;
      const dots = T.teams.map((t) => `<g><circle cx="${X(t.gfpg).toFixed(1)}" cy="${Y(t.gapg).toFixed(1)}" r="5" class="v4-dot"/><text x="${(X(t.gfpg) + 8).toFixed(1)}" y="${(Y(t.gapg) + 4).toFixed(1)}">${esc(abbr(t.team))}</text></g>`).join("");
      return `<svg class="v4-quad" viewBox="0 0 300 250" role="img" aria-label="Goals scored against goals conceded per game">
        <line x1="${X(ax)}" y1="10" x2="${X(ax)}" y2="230" class="v4-axis"/><line x1="10" y1="${Y(ay)}" x2="290" y2="${Y(ay)}" class="v4-axis"/>
        <text x="150" y="246" class="v4-lbl">goals scored a game →</text><text x="4" y="14" class="v4-lbl">↑ fewer conceded</text>
        ${dots}</svg>
      <p class="v4-cap">${esc([...T.teams].sort((a, b) => b.gfpg - a.gfpg)[0].team)} score the most, at ${f2(Math.max(...xs))} a game. The league averages ${f2(ax)} scored and ${f2(ay)} conceded per game.</p>`;
    } },

  { key: "mismatch",
    need: (T) => T.teams.every((t) => t.gd !== null),
    score: (T) => { const byGd = [...T.teams].sort((a, b) => b.gd - a.gd); const moves = T.teams.map((t) => Math.abs(byGd.indexOf(t) + 1 - t.pos)); return Math.max(...moves) >= 3 ? 7 : 1; },
    render: (T) => {
      const byGd = [...T.teams].sort((a, b) => b.gd - a.gd);
      const movers = T.teams.map((t) => ({ t, to: byGd.indexOf(t) + 1 })).sort((a, b) => Math.abs(b.to - b.t.pos) - Math.abs(a.to - a.t.pos)).slice(0, 6);
      const H = 30 + movers.length * 34;
      const byPts = [...movers].sort((a, b) => a.t.pos - b.t.pos), byGdM = [...movers].sort((a, b) => a.to - b.to);
      const yL = (m) => 34 + byPts.indexOf(m) * 34, yR = (m) => 34 + byGdM.indexOf(m) * 34;
      const lines = movers.map((m) => `<line x1="92" y1="${yL(m)}" x2="208" y2="${yR(m)}" class="v4-slope ${m.to < m.t.pos ? "up" : "down"}"/>`).join("");
      const left = movers.map((m) => `<text x="84" y="${yL(m) + 4}" text-anchor="end">${esc(abbr(m.t.team))} ${m.t.pos}</text>`).join("");
      const right = movers.map((m) => `<text x="216" y="${yR(m) + 4}">${m.to} ${esc(abbr(m.t.team))}</text>`).join("");
      return `<svg class="v4-slopesvg" viewBox="0 0 300 ${H}" role="img" aria-label="League position against goal-difference position">
        <text x="84" y="14" text-anchor="end" class="v4-lbl">points</text><text x="216" y="14" class="v4-lbl">goal difference</text>
        ${lines}${left}${right}</svg>
      <p class="v4-cap">${esc(movers[0].t.team)} sit ${ord(movers[0].t.pos)} on points but ${ord(movers[0].to)} on goal difference, the biggest gap in this table.</p>`;
    } },

  { key: "fixtures",
    need: (T) => T.f.ahead.filter((m) => m.prediction).length >= 2,
    score: (T) => { const ps = T.f.ahead.filter((m) => m.prediction).map((m) => Math.max(num(m.prediction.home_win_pct) || 0, num(m.prediction.away_win_pct) || 0, num(m.prediction.draw_pct) || 0)); return ps.filter((x) => x >= 60).length >= 2 || ps.filter((x) => x < 45).length >= 2 ? 6 : 3; },
    render: (T) => {
      const list = T.f.ahead.filter((m) => m.prediction).slice(0, 6);
      const tipped = list.filter((m) => Math.max(num(m.prediction.home_win_pct) || 0, num(m.prediction.away_win_pct) || 0, num(m.prediction.draw_pct) || 0) >= 60).length;
      const tossed = list.filter((m) => Math.max(num(m.prediction.home_win_pct) || 0, num(m.prediction.away_win_pct) || 0, num(m.prediction.draw_pct) || 0) < 45).length;
      const capFx = `<p class="v4-cap">${list.length} ${list.length === 1 ? "game" : "games"} still to play with a model chance. ${tipped} clearly one-sided, ${tossed} close to a coin toss.</p>`;
      return `<div class="v4-fixtures">${list.map((m) => {
        const p = m.prediction, h = num(p.home_win_pct) || 0, d = num(p.draw_pct) || 0, a = num(p.away_win_pct) || 0, t = h + d + a || 1, top = Math.max(h, d, a);
        const tag = top < 45 ? `<em class="v4-tag toss">coin toss</em>` : top >= 60 ? `<em class="v4-tag sure">one-sided</em>` : "";
        return `<div class="v4-fxc"><div class="v4-fxh"><span>${esc(m.home.name)} <i>v</i> ${esc(m.away.name)}</span><small class="mono">${esc(kickLabel(m.ts))}</small></div>${tag}<div class="v4-chance"><i class="h" style="width:${((h / t) * 100).toFixed(1)}%"></i><i class="d" style="width:${((d / t) * 100).toFixed(1)}%"></i><i class="a" style="width:${((a / t) * 100).toFixed(1)}%"></i></div><div class="v4-legend"><span>${Math.round(h)}% ${esc(abbr(m.home.name))}</span><span>${Math.round(d)}% X</span><span>${Math.round(a)}% ${esc(abbr(m.away.name))}</span></div></div>`;
      }).join("")}</div>${capFx}`;
    } },
];

function leagueLayoutHtml(league, matches, standings, ctx) {
  const f = leagueFacts(league, matches, ctx, standings);
  const rows = ((standings && standings.groups && standings.groups[0] && standings.groups[0].rows) || []).filter((r) => r.p && r.pts !== null);
  const T = { league, f, teams: teamTable(rows, f.done.filter((m) => Number.isFinite(resOf(m).h) && Number.isFinite(resOf(m).a))), seed: `${league.id}|${todayKey()}` };
  const cands = LEAGUE_LAYOUTS.filter((L) => L.need(T)).map((L) => ({ L, s: L.score(T) + jitterFor(T.seed, L.key) })).filter((x) => x.s >= 1).sort((a, b) => b.s - a.s);
  if (!cands.length) return "";
  const pick = cands[0].L;
  return `<section class="block v4-layout v4-l-${pick.key}">${pick.render(T)}</section>`;
}

// ---------- match layouts ----------
const MATCH_LAYOUTS = [
  { key: "stakes",
    need: (m, rows) => { if (rows.length < 6 || resOf(m).state !== "pre") return null; const s = [...rows].sort((a, b) => a.pos - b.pos); const h = s.find((r) => r.team === m.home.name), a = s.find((r) => r.team === m.away.name); return h && a ? { h, a, s } : null; },
    score: (x) => { const d = Math.min(Math.abs(x.h.pts - x.s[3].pts), Math.abs(x.h.pts - x.s[x.s.length - 4].pts), Math.abs(x.a.pts - x.s[3].pts), Math.abs(x.a.pts - x.s[x.s.length - 4].pts)); return d <= 2 ? 9 : d <= 4 ? 6 : 0; },
    render: (m, x) => {
      const { h, a, s } = x, fourth = s[3], safe = s[s.length - 4], max = Math.max(...s.map((r) => r.pts), h.pts + 3, 1) + 2;
      const at = (v) => barPct(v, max);
      return `<div class="v4-track"><i class="v4-line" style="left:${at(fourth.pts)}"><em>4th · ${fourth.pts}</em></i><i class="v4-line safe" style="left:${at(safe.pts)}"><em>safe · ${safe.pts}</em></i><i class="v4-ghost" style="left:${at(h.pts + 3)}"><em>home win</em></i><span class="v4-mk home" style="left:${at(h.pts)}"><b>${esc(abbr(h.team))}</b></span><span class="v4-mk away" style="left:${at(a.pts)}"><b>${esc(abbr(a.team))}</b></span></div>
      <p class="v4-cap">${esc(h.team)} ${h.pts} pts (${ord(h.pos)}), ${esc(a.team)} ${a.pts} pts (${ord(a.pos)}). Each dot is a side on the points scale.</p>`;
    } },
  { key: "price",
    need: (m) => { const p = m.prediction, o = m.odds || {}; return p && num(p.home_win_pct) !== null && num(o.home_win) ? true : null; },
    score: (m) => { const p = m.prediction, o = m.odds; const gap = num(p.home_win_pct) - (100 / o.home_win); return Math.abs(gap) >= 4 ? 8 : 0; },
    render: (m) => {
      const p = m.prediction, o = m.odds, model = num(p.home_win_pct), price = 100 / o.home_win;
      return `<div class="v4-pscale"><span class="v4-pm model" style="left:${barPct(model, 100)}"><b>Model ${Math.round(model)}%</b></span><span class="v4-pm price" style="left:${barPct(price, 100)}"><b>Price ${Math.round(price)}%</b></span><i class="v4-pbar" style="left:${barPct(Math.min(model, price), 100)};width:${(Math.abs(model - price) / 100 * 100).toFixed(1)}%"></i></div>
      <p class="v4-cap">The model has ${esc(m.home.name)} at ${Math.round(model)}% to win and the price implies ${Math.round(price)}%, a gap of ${Math.abs(Math.round(model - price))} points${model > price ? ", in the model's favour" : ", against the model"}.</p>`;
    } },
  { key: "goals",
    need: (m) => { const xg = m.prediction && m.prediction.expected_goals; return xg && num(xg.home) !== null && num(xg.away) !== null ? true : null; },
    score: (m) => { const t = num(m.prediction.expected_goals.home) + num(m.prediction.expected_goals.away); return t >= 3 || t <= 2.1 ? 6 : 0; },
    render: (m) => {
      const xg = m.prediction.expected_goals, hv = num(xg.home), av = num(xg.away), max = Math.max(hv, av, 1);
      return `<div class="v4-twin"><div class="v4-tr"><span>${esc(m.home.name)}</span><span class="v4-tbar"><i style="width:${barPct(hv, max)}"></i></span><b class="mono">${hv.toFixed(1)}</b></div><div class="v4-tr away"><span>${esc(m.away.name)}</span><span class="v4-tbar"><i style="width:${barPct(av, max)}"></i></span><b class="mono">${av.toFixed(1)}</b></div></div>
      <p class="v4-cap">The model expects ${(hv + av).toFixed(1)} goals in all: ${hv.toFixed(1)} from ${esc(m.home.name)} and ${av.toFixed(1)} from ${esc(m.away.name)}.</p>`;
    } },
  { key: "toss",
    need: (m) => (m.prediction ? true : null),
    score: (m) => { const p = m.prediction; const top = Math.max(num(p.home_win_pct) || 0, num(p.draw_pct) || 0, num(p.away_win_pct) || 0); return top < 45 ? 5 : 0; },
    render: (m) => {
      const p = m.prediction, h = num(p.home_win_pct) || 0, a = num(p.away_win_pct) || 0, d = num(p.draw_pct) || 0;
      const angle = (-90 + ((h - a) / 100) * 90).toFixed(1);
      return `<div class="v4-gauge"><svg viewBox="0 0 200 110" role="img" aria-label="Win balance"><path d="M10 100 A90 90 0 0 1 190 100" class="v4-arc"/><line x1="100" y1="100" x2="100" y2="22" class="v4-needle" style="transform-origin:100px 100px;transform:rotate(${angle}deg)"/><circle cx="100" cy="100" r="6" class="v4-hub"/></svg><div class="v4-gl"><span>${esc(abbr(m.home.name))} ${Math.round(h)}%</span><span>Draw ${Math.round(d)}%</span><span>${esc(abbr(m.away.name))} ${Math.round(a)}%</span></div></div>
      <p class="v4-cap">${Math.max(h, d, a) < 45 ? "No side clears 45%, so the model sees this as close to even." : `The most likely result is ${Math.max(h, d, a) === h ? esc(m.home.name) + " to win" : Math.max(h, d, a) === a ? esc(m.away.name) + " to win" : "a draw"} at ${Math.round(Math.max(h, d, a))}%.`}</p>`;
    } },
];

function matchLayoutHtml(m, standings) {
  const rows = ((standings && standings.groups && standings.groups[0] && standings.groups[0].rows) || []).filter((r) => r.p && r.pts !== null);
  const seed = String(m.id);
  const cands = [];
  for (const L of MATCH_LAYOUTS) {
    const x = L.need(m, rows);
    if (x === null || x === undefined || x === false) continue;
    const s = L.score(x === true ? m : x, rows) + jitterFor(seed, L.key);
    if (s >= 1) cands.push({ L, s, x });
  }
  if (!cands.length) return "";
  cands.sort((a, b) => b.s - a.s);
  const pick = cands[0];
  const inner = pick.L.key === "stakes" ? pick.L.render(m, pick.x) : pick.L.render(m);
  return `<section class="block v4-mlayout v4-m-${pick.L.key}"><div class="v4-mlab">${esc(pick.L.key === "stakes" ? "Table stakes" : pick.L.key === "price" ? "Price vs model" : pick.L.key === "goals" ? "Expected goals" : "Win balance")}</div>${inner}</section>`;
}

function leaguePulse(league, matches, standings, ctx) {
  // Leagues without a table in our data still get their fixtures, odds and picks. The table-based analysis is skipped for them.
  const rows = (standings && standings.groups && standings.groups[0] && standings.groups[0].rows) || [];
  if (rows.filter((r) => r.p && r.pts !== null).length < 2) return "";
  try { return leagueLayoutHtml(league, matches, standings, ctx); }
  catch (e) { console.error("League analysis:", league && league.name, e.message); return ""; }
}

// ---------- match lifecycle: what the page says before, during, at half-time and after the match ----------
function matchStage(m) {
  const rs = resOf(m);
  if (rs.state === "ft") return "ft";
  if (rs.state === "live") return /ht|half|break/i.test(String(rs.label || "")) ? "ht" : "live";
  if (rs.state === "wait") return "live";
  return "pre";
}

// Table after this result: each side's new points and position, from the standings we already fetch.
function tableAfter(m, rows, h, a) {
  const add = (pts, gf, ga) => (gf > ga ? 3 : gf === ga ? 1 : 0) + pts;
  const sorted = [...rows].sort((x, y) => x.pos - y.pos);
  const newPts = new Map(sorted.map((r) => [r.team, r.pts]));
  const before = (team) => sorted.find((r) => r.team === team);
  const hb = before(m.home.name), ab = before(m.away.name);
  if (!hb || !ab) return null;
  newPts.set(m.home.name, hb.pts + (h > a ? 3 : h === a ? 1 : 0));
  newPts.set(m.away.name, ab.pts + (a > h ? 3 : a === h ? 1 : 0));
  const ranked = [...newPts.entries()].sort((x, y) => y[1] - x[1]).map((x) => x[0]);
  return { home: { pts: newPts.get(m.home.name), before: hb.pos, after: ranked.indexOf(m.home.name) + 1 }, away: { pts: newPts.get(m.away.name), before: ab.pos, after: ranked.indexOf(m.away.name) + 1 } };
}

function nextLine(team, n) {
  if (!n) return "";
  const home = n.home.name === team;
  const opp = home ? n.away.name : n.home.name;
  const p = n.prediction;
  const chance = p ? Math.round(home ? num(p.home_win_pct) : num(p.away_win_pct)) : null;
  return `<div class="v4-next"><small>${esc(team)} next</small><b>${home ? "" : "at "}${esc(opp)}${home ? " (home)" : ""}</b><span>${esc(shortDate(n.ts))} · ${esc(clock(n.ts))}${chance !== null ? ` · model ${chance}% for ${esc(team)}` : ""}</span></div>`;
}

function matchStageHtml(m, standings, nextFor) {
  const stage = matchStage(m);
  const rs = resOf(m);
  const rows = ((standings && standings.groups && standings.groups[0] && standings.groups[0].rows) || []).filter((r) => r.p && r.pts !== null);
  const xg = m.prediction && m.prediction.expected_goals;
  const totalXg = xg ? num(xg.home) + num(xg.away) : null;
  const pick = topPick(m);
  const ps = pick ? pickState(m, pick.k) : null;
  const outcome = (h, a) => (h > a ? `${m.home.name} won` : h < a ? `${m.away.name} won` : "a draw");
  const nexts = nextFor ? `<div class="v4-nexts">${nextLine(m.home.name, nextFor.home)}${nextLine(m.away.name, nextFor.away)}</div>` : "";
  let title = "", body = "";

  if (stage === "pre") {
    title = "Before kick-off";
    const form = (team) => { const r = rows.find((x) => x.team === team); return r && typeof r.form === "string" ? [...r.form.slice(-5).toUpperCase()].map((c) => `<i class="${c === "W" ? "w" : c === "D" ? "d" : "l"}"></i>`).join("") : ""; };
    const fh = form(m.home.name), fa = form(m.away.name);
    body = `${fh || fa ? `<div class="v4-formpair"><div><small>${esc(m.home.name)}</small><span class="v4-dots">${fh}</span></div><div class="right"><small>${esc(m.away.name)}</small><span class="v4-dots">${fa}</span></div></div>` : ""}
      ${totalXg !== null ? `<p class="v4-cap">The model expects ${totalXg.toFixed(1)} goals in this match.</p>` : ""}`;
  } else if (stage === "live") {
    title = "In play";
    const minuteNote = rs.label ? esc(rs.label) : "In play";
    const goals = (rs.h ?? 0) + (rs.a ?? 0);
    body = `<div class="v4-score"><b>${rs.h ?? "–"}</b><span>${esc(m.home.name)}</span><span>${esc(m.away.name)}</span><b>${rs.a ?? "–"}</b></div>
      <p class="v4-cap">${minuteNote}. ${totalXg !== null ? `${goals} goal${goals === 1 ? "" : "s"} so far against ${totalXg.toFixed(1)} the model expected for the full game.` : ""}${ps ? ` Our pick is ${ps === "on" ? "winning" : ps === "off" ? "losing" : "still open"}.` : ""}</p>`;
  } else if (stage === "ht") {
    title = "Half-time";
    const lead = rs.h > rs.a ? m.home.name : rs.a > rs.h ? m.away.name : null;
    const trail = lead ? (lead === m.home.name ? m.away.name : m.home.name) : null;
    const remaining = totalXg !== null ? Math.max(0, totalXg - ((rs.h ?? 0) + (rs.a ?? 0))) : null;
    body = `<div class="v4-score"><b>${rs.h ?? "–"}</b><span>${esc(m.home.name)}</span><span>${esc(m.away.name)}</span><b>${rs.a ?? "–"}</b></div>
      <p class="v4-cap">${lead ? `${esc(lead)} lead, so ${esc(trail)} need to change the game in the second half.` : "Level at the break."}${remaining !== null ? ` The model had about ${remaining.toFixed(1)} goals left in the match from this point.` : ""}${ps ? ` Our pick is ${ps === "on" ? "winning" : ps === "off" ? "losing" : "still open"}.` : ""}</p>`;
  } else if (stage === "ft") {
    title = "Full-time";
    const ta = rows.length ? tableAfter(m, rows, rs.h, rs.a) : null;
    const p = m.prediction;
    const likely = p ? [[m.home.name, num(p.home_win_pct)], ["a draw", num(p.draw_pct)], [m.away.name, num(p.away_win_pct)]].filter((x) => x[1] !== null).sort((x, y) => y[1] - x[1])[0] : null;
    const total = (rs.h ?? 0) + (rs.a ?? 0);
    const verdict = pick ? (ps === "won" ? "Our pick landed." : "Our pick did not land.") : "";
    body = `<div class="v4-score"><b>${rs.h}</b><span>${esc(m.home.name)}</span><span>${esc(m.away.name)}</span><b>${rs.a}</b></div>
      <p class="v4-cap">${esc(outcome(rs.h, rs.a))}. ${likely ? `Before kick-off the model's most likely result was ${esc(likely[0])} at ${Math.round(likely[1])}%.` : ""} ${totalXg !== null ? `${total} goals against ${totalXg.toFixed(1)} expected.` : ""} ${verdict}</p>
      ${ta ? `<div class="v4-table-after"><div><small>${esc(m.home.name)}</small><b>${ta.home.before} → ${ta.home.after}</b><span>${ta.home.pts} pts</span></div><div class="right"><small>${esc(m.away.name)}</small><b>${ta.away.before} → ${ta.away.after}</b><span>${ta.away.pts} pts</span></div></div>` : ""}`;
  }
  if (!body && stage === "pre") body = "";
  if (!title) return "";
  const next = stage === "ft" && nexts ? `<div class="v4-sub">Next</div>${nexts}` : "";
  return `<section class="block v4-stage v4-st-${stage}"><div class="v4-stg-h">${esc(title)}</div>${body}${next}</section>`;
}

// Questions a reader actually asks about this match, answered from its own numbers.
function matchFaq(m) {
  const p = m.prediction, o = m.odds || {};
  const b = p ? bestSide(m) : null;
  const who = b ? (b.k === "X" ? "a draw" : b.k === "1" ? m.home.name : m.away.name) : "";
  const qa = [];
  qa.push([`When does ${m.home.name} vs ${m.away.name} kick off?`, `${longDate(m.ts)} at ${clock(m.ts)} (${TZ_LABEL || "site"} time). Times change if the fixture is moved, so check the league page before you act on it.`]);
  if (b) qa.push([`What is the prediction for ${m.home.name} vs ${m.away.name}?`, `The model's strongest outcome is ${who} at ${Math.round(b.pct)}%.${b.odd ? ` The market price is ${fmtOdd(b.odd)}.` : ""} It is a probability estimate, not a guarantee.`]);
  if (b && b.odd) {
    const e = edgeOf(b.pct, b.odd);
    qa.push([`Is the price on ${who} good value?`, e === null ? "There is not enough price information to judge that yet." : e >= 0.06 ? `On our numbers the price is higher than the chance suggests, an edge of about +${(e * 100).toFixed(1)}%. Value is still no guarantee of a win.` : e <= -0.08 ? `The price is shorter than the model's chance, so the bookmaker already thinks the result is likely. There is little value in it.` : `The price is close to the model's chance, so the market and our numbers agree.`]);
  }
  if (p && num(p.over_25_pct) !== null) qa.push([`Will ${m.home.name} vs ${m.away.name} have over 2.5 goals?`, `The model gives over 2.5 goals a ${Math.round(p.over_25_pct)}% chance${num(o.over_25_goals) ? ` at odds of ${fmtOdd(o.over_25_goals)}` : ""}, so under 2.5 is ${Math.round(100 - p.over_25_pct)}%.${p.expected_goals && num(p.expected_goals.home) !== null ? ` Expected goals are ${num(p.expected_goals.home).toFixed(1)} for ${m.home.name} and ${num(p.expected_goals.away).toFixed(1)} for ${m.away.name}.` : ""}`]);
  if (p && num(p.btts_yes_pct) !== null) qa.push([`Will both teams score in ${m.home.name} vs ${m.away.name}?`, `The model gives both teams to score a ${Math.round(p.btts_yes_pct)}% chance${num(o.btts_yes) ? ` at odds of ${fmtOdd(o.btts_yes)}` : ""}.`]);
  if (p && p.most_likely_score) qa.push([`What scoreline does the model expect?`, `The most likely single scoreline is ${p.most_likely_score}. Most matches end with a different score, so treat it as the centre of the range, not a prediction.`]);
  return qa;
}

// Model vs market: the model's share of each outcome against the bookmaker price with the margin removed.
function modelVsMarket(m) {
  const p = m.prediction, o = m.odds || {};
  if (!p || !o.home_win || !o.draw || !o.away_win) return "";
  const mod = [num(p.home_win_pct), num(p.draw_pct), num(p.away_win_pct)];
  if (mod.some((x) => x === null)) return "";
  const imp = [1 / o.home_win, 1 / o.draw, 1 / o.away_win], tot = imp.reduce((t, x) => t + x, 0);
  const rows = [[m.home.name, mod[0], (imp[0] / tot) * 100], ["Draw", mod[1], (imp[1] / tot) * 100], [m.away.name, mod[2], (imp[2] / tot) * 100]];
  return `<section class="block mvm"><h2>Model vs market</h2>
    ${rows.map(([n, a, b]) => `<div class="mvm-row"><span class="mvm-n">${esc(n)}</span>
      <span class="mvm-bars" aria-hidden="true"><i class="mv-m" style="width:${Math.round(a)}%"></i><i class="mv-k" style="width:${Math.round(b)}%"></i></span>
      <b class="mvm-v">${Math.round(a)}%<small> vs ${Math.round(b)}%</small></b></div>`).join("")}
    <p class="mvm-key"><i class="mv-m"></i> Model <i class="mv-k"></i> Market (margin removed)</p>
  </section>`;
}


// Exact club match: names are compared after dropping punctuation, accents and FC/AFC-style words,
// so "Man City" never matches "Manchester United".
const clubKey = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  .replace(/\b(fc|afc|sc|cf|ac|as|us|ss|rc)\b/g, "").replace(/[^a-z0-9]/g, "");
export const isClub = (name, team) => team.aliases.some((a) => clubKey(a) === clubKey(name));
export const teamMatches = (matches, team) => matches.filter((m) => isClub(m.home.name, team) || isClub(m.away.name, team));

const ordinal = (n) => { const s = ["th", "st", "nd", "rd"], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };
export function teamPage(ctx, { team, matches, past = [], tables = [] }) {
  const path = `/team/${team.slug}`;
  const upcoming = matches.filter((m) => !m.res || m.res.state === "pre").sort((a, b) => a.ts - b.ts);
  const recent = past.filter((m) => m.score && m.score.home != null && m.score.away != null).sort((a, b) => b.ts - a.ts);
  const playedCount = recent.length;
  const picks = upcoming.map((m) => ({ m, tp: topPick(m) })).filter((x) => x.tp).sort((a, b) => b.tp.pct - a.tp.pct).slice(0, 5);
  const next = upcoming[0];

  // League position and the clubs either side of it
  const tableInfo = tables.map(({ league, standings }) => {
    const rows = (standings && standings.groups && standings.groups[0] && standings.groups[0].rows) || [];
    const idx = rows.findIndex((r) => isClub(r.team, team));
    return idx < 0 ? null : { league, rows, idx };
  }).find(Boolean);
  const row = tableInfo ? tableInfo.rows[tableInfo.idx] : null;
  const above = tableInfo && tableInfo.idx > 0 ? tableInfo.rows[tableInfo.idx - 1] : null;
  const below = tableInfo && tableInfo.idx < tableInfo.rows.length - 1 ? tableInfo.rows[tableInfo.idx + 1] : null;
  const leader = tableInfo ? tableInfo.rows[0] : null;

  // Recent form and goals, from finished matches only
  const form = recent.slice(0, 5).map((m) => {
    const home = isClub(m.home.name, team);
    const me = home ? m.score.home : m.score.away, them = home ? m.score.away : m.score.home;
    return me > them ? "W" : me === them ? "D" : "L";
  });
  const goalsFor = recent.slice(0, 10).reduce((n, m) => n + (isClub(m.home.name, team) ? m.score.home : m.score.away), 0);
  const goalsAgainst = recent.slice(0, 10).reduce((n, m) => n + (isClub(m.home.name, team) ? m.score.away : m.score.home), 0);
  const leagues = [...new Set([...matches, ...past].map((m) => m.league && m.league.name).filter(Boolean))];

  // Written overview, from the facts and numbers we actually have
  const paras = [];
  if (team.city) paras.push(`${team.name} are based in ${team.city}${team.stadium ? `, and play their home matches at ${team.stadium}` : ""}.`);
  if (row && tableInfo) {
    let t = `In the ${tableInfo.league.name} table, ${team.name} are ${ordinal(tableInfo.idx + 1)} with ${row.pts} points from ${row.p} games.`;
    if (above) t += ` ${above.team} are one place above on ${above.pts}.`;
    if (below) t += ` ${below.team} are one place below on ${below.pts}.`;
    if (leader && leader !== row) t += ` The leaders, ${leader.team}, have ${leader.pts}.`;
    paras.push(t);
  }
  if (playedCount) paras.push(`Across the last ${Math.min(10, playedCount)} finished matches the club scored ${goalsFor} and conceded ${goalsAgainst}${form.length ? `. The last ${form.length} results, most recent first, read ${form.join(" ")} (W win, D draw, L loss)` : ""}.`);
  if (next) paras.push(`The next match on our list is ${next.home.name} vs ${next.away.name} in the ${next.league.name}, at ${shortDate(next.ts)}.`);
  else paras.push(`No upcoming ${team.name} match is on our list right now. New fixtures appear as the feed adds them.`);
  const overview = paras.length ? paras.map((t) => `<p>${esc(t)}</p>`).join("") : `<p>${esc(team.name)} is on our list of popular clubs. Fixtures, results and model picks appear here as the feed adds them.</p>`;

  const tableBlock = tableInfo ? `<section class="block"><div class="block-head"><h2>${esc(tableInfo.league.name)} table</h2></div>
    <div class="catgrid small">${[above, row, below].filter(Boolean).map((r) => `<div class="catcard"><b>${esc(r.team)}</b><span>${r.pts} pts from ${r.p} games</span></div>`).join("")}</div>
    <p class="mut"><a href="${leaguePath(tableInfo.league)}">Full ${esc(tableInfo.league.name)} predictions and table</a></p></section>` : "";

  const formBlock = form.length ? `<section class="block"><div class="block-head"><h2>${esc(team.name)} form</h2></div><div class="catgrid small"><div class="catcard"><b>${form.join(" ")}</b><span>Last ${form.length} results, most recent first</span></div><div class="catcard"><b>${goalsFor}-${goalsAgainst}</b><span>Goals scored and conceded, last ${Math.min(10, playedCount)} matches</span></div></div></section>` : "";

  const body = `${crumbs([["Home", "/"], ["Teams", "/teams"], [team.name, path]])}
  ${pageHead(`${team.name} predictions`, esc(`${team.name} fixtures, results, league position, form and model picks.`))}
  <section class="prose"><h2>About ${esc(team.name)}</h2>${overview}</section>
  ${tableBlock}
  ${formBlock}
  ${picks.length ? `<section class="block"><div class="block-head"><h2>${esc(team.name)}: strongest model picks</h2></div><div class="catgrid small">${picks.map((x) => `<a class="catcard" href="${matchPath(x.m)}"><b>${esc(x.m.home.name)} vs ${esc(x.m.away.name)}</b><span>${esc(x.tp.label)} · ${Math.round(x.tp.pct)}% model</span></a>`).join("")}</div></section>` : ""}
  <section class="block"><div class="block-head"><h2>Upcoming ${esc(team.name)} matches</h2></div>${upcoming.length ? upcoming.map(matchRow).join("") : `<div class="empty">No upcoming matches on our list yet.</div>`}</section>
  ${recent.length ? `<section class="block"><div class="block-head"><h2>Recent ${esc(team.name)} results</h2></div><div class="catgrid small">${recent.slice(0, 10).map((m) => `<a class="catcard" href="${matchPath(m)}"><b>${esc(m.home.name)} ${m.score.home}-${m.score.away} ${esc(m.away.name)}</b><span>${esc(m.league.name)} · ${shortDate(m.ts)}</span></a>`).join("")}</div></section>` : ""}
  <section class="prose"><h2>How to read ${esc(team.name)} predictions</h2><p>Each pick comes from bookmaker odds with the margin taken out, and a model read of the match. Predictions are estimates, not guarantees. See <a href="/how-we-predict">how we predict</a> for what the model can and cannot do, and the <a href="/track-record">track record</a> for how past picks landed.</p>${leagues.length ? `<p>On our list, ${esc(team.name)} appear in ${leagues.map((l) => esc(l)).join(" and ")}.</p>` : ""}</section>
  <section class="block"><div class="block-head"><h2>Keep browsing</h2></div><div class="catgrid small"><a class="catcard" href="/football-predictions-today"><b>Today's predictions</b><span>Every match on today's list</span></a><a class="catcard" href="/football-predictions-tomorrow"><b>Tomorrow's predictions</b><span>Every match on tomorrow's list</span></a><a class="catcard" href="/results"><b>Results</b><span>Finished matches and final scores</span></a><a class="catcard" href="/teams"><b>All club pages</b><span>Every popular club we cover</span></a></div></section>`;
  const indexable = upcoming.length + playedCount >= 2 || !!tableInfo;
  return {
    title: `${team.name} Predictions, Fixtures and Results | ${SITE_NAME}`,
    desc: `${team.name} football predictions: ${tableInfo ? `${ordinal(tableInfo.idx + 1)} in the ${tableInfo.league.name}, ` : ""}${next ? `next match ${next.home.name} vs ${next.away.name}, ` : ""}recent results, form and model picks.`,
    path, body, noindex: !indexable,
    ld: [crumbLd(ctx.origin, [["Home", "/"], ["Teams", "/teams"], [team.name, path]])]
  };
}

export function teamsIndexPage(ctx, { teams }) {
  const body = `${crumbs([["Home", "/"], ["Teams", "/teams"]])}
  ${pageHead("Football team predictions", "Pick a club for its upcoming matches, model picks and recent results.")}
  <div class="catgrid small">${teams.map((t) => `<a class="catcard" href="/team/${t.slug}"><b>${esc(t.name)}</b><span>Predictions and results</span></a>`).join("")}</div>`;
  return { title: `Football Team Predictions | ${SITE_NAME}`, desc: "Football team pages: upcoming matches, model picks and recent results for popular clubs.", path: "/teams", body, ld: [crumbLd(ctx.origin, [["Home", "/"], ["Teams", "/teams"]])] };
}

export function matchPage(ctx, { m, related, standings = null, nextFor = null }) {
  const path = matchPath(m);
  const p = m.prediction;
  const mk = marketsOf(m);
  const b = bestSide(m);
  const rs = resOf(m);
  const hasScore = rs.h !== null && rs.h !== undefined;
  const bs = topPick(m) || bestSide(m);
  const verdictState = bs ? pickState(m, bs.k) : null;
  const vs = bs ? fairOf(m, bs.k) : null;
  const lgHref = m.league.id != null ? leaguePath(m.league) : "/leagues";
  const nice = longDate(m.ts);
  const h1 = `${m.home.name} vs ${m.away.name} prediction, odds and tips`;
  const pbar = (label, pct, cls) => num(pct) === null ? "" : `<div class="pbar ${cls}"><span class="lbl">${esc(label)}</span><span class="bar"><i style="width:${Math.min(100, Math.round(pct))}%"></i></span><b>${Math.round(pct)}%</b></div>`;
  const groupBlock = (title, list) => {
    const cells = list.filter((d) => num(d.odd) && d.odd > 1).map((d) => `<div class="mkcell">${oddBtn(m, d)}${num(d.pct) !== null ? `<small>Model ${Math.round(d.pct)}%</small>` : ""}</div>`).join("");
    return cells ? `<div class="mkgroup"><h3>${title}</h3><div class="mkgrid">${cells}</div></div>` : "";
  };
  const faq = matchFaq(m);
  const keep = [["Today's predictions", "/football-predictions-today", "Every match on today's list"], ["Tomorrow's predictions", "/football-predictions-tomorrow", "Every match on tomorrow's list"], ["Results", "/results", "Finished matches and how picks landed"], ["Track record", "/track-record", "Every settled pick the site keeps"], ["How we predict", "/how-we-predict", "How the model works and what it cannot do"]];
  const clubs = TEAMS.filter((t) => isClub(m.home.name, t) || isClub(m.away.name, t));
  const body = `${crumbs([["Home", "/"], [m.league.name, lgHref], [`${m.home.name} vs ${m.away.name}`, path]])}
  <header class="mh5">
    <p class="mh5-l"><a href="${lgHref}">${lgIcon(m.league)}<span>${esc(m.league.name)}</span></a><time datetime="${esc(m.kickoff || "")}">${esc(nice)}</time></p>
    <h1>${esc(h1)}</h1>
    <div class="mh5-board" ${rowAttrs(m, bs ? bs.k : null)}>
      <div class="mh5-t">${crest(m.home)}<span>${esc(m.home.name)}</span></div>
      <div class="mh5-mid"><b class="mh5-ko-wrap"><b class="mh5-sc">${timeEl(m, "mh5-ko")}</b></b><b class="mh5-sc mh5-live"><span class="sc" data-side="h">${scNum(m, "h")}</span><i>-</i><span class="sc" data-side="a">${scNum(m, "a")}</span></b><small class="w-top">${rs.state === "pre" ? "kick-off" : esc(rs.label)}</small></div>
      <div class="mh5-t">${crest(m.away)}<span>${esc(m.away.name)}</span></div>
    </div>
  </header>
  ${bs ? `<section class="vd5" aria-label="Our pick"><div class="vd5-main"><small>Our pick</small><h2>${esc(bs.label)}</h2><p>${Math.round(bs.pct)}% model chance${vs !== null && vs !== undefined ? `, ${Math.round(vs)}% market chance` : ""}</p>${rule(bs.pct, vs)}</div><div class="vd5-side">${bs.odd ? `<div><small>Odds</small><b>${fmtOdd(bs.odd)}</b></div>` : ""}${verdictState ? `<div><small>Result</small><span class="pst ${verdictState}">${PICK_TXT[verdictState]}</span></div>` : ""}</div></section>` : ""}
  ${sponsorSlot("match")}
  ${stageBlock(m, bs, verdictState)}
  <div class="m30"><div class="m30-a">${p ? `<section class="block"><h2>Who will win? Win probability</h2>${pbar(m.home.name, p.home_win_pct, "h")}${pbar("Draw", p.draw_pct, "d")}${pbar(m.away.name, p.away_win_pct, "a")}</section>` : ""}${modelVsMarket(m)}</div>
  <div class="m30-b"><section class="block"><h2>Odds and model chances</h2><p class="mnote show">Tap a price to add it to your pick slip.</p>
    ${groupBlock("Match result", mk["1x2"])}${groupBlock("Goals", mk.goals)}${groupBlock("Both teams to score", mk.btts)}${groupBlock("Double chance <small>(calculated)</small>", mk.dc)}
  </section></div></div>
  ${compareTable(m) ? `<section class="block"><h2>${esc(m.home.name)} vs ${esc(m.away.name)}: head-to-head numbers</h2><div class="tablewrap">${compareTable(m)}</div><p class="mnote show">The brighter side leads on that line. Edge is model chance × odds − 1.</p></section>` : ""}
  ${matchStageHtml(m, standings, nextFor)}
  ${matchLayoutHtml(m, standings)}
  <section class="block an5"><h2>${esc(m.home.name)} vs ${esc(m.away.name)}: match analysis</h2>${analysis(m).map((t) => `<p>${esc(t)}</p>`).join("")}<p class="an5-u">Updated ${esc(clock(Date.now()))} ${esc(TZ_LABEL)}. Odds and chances move before kick-off.</p></section>
  ${faq.length ? faqHtml(faq, `${m.home.name} vs ${m.away.name}: questions and answers`) : ""}
  ${joinBlock()}
  ${related.length ? `<section class="block"><div class="block-head"><h2>More ${esc(m.league.name)} matches</h2><a href="${lgHref}">League page</a></div><div class="fxg-list">${related.map((x) => matchRow(x)).join("")}</div></section>` : ""}
  ${clubs.length ? `<section class="block"><div class="block-head"><h2>Club pages</h2></div><div class="catgrid small">${clubs.map((t) => `<a class="catcard" href="/team/${t.slug}"><b>${esc(t.name)}</b><span>Upcoming matches and results</span></a>`).join("")}</div></section>` : ""}
  <section class="block"><div class="block-head"><h2>Keep browsing</h2></div><div class="catgrid small">${keep.map(([n, h, s]) => `<a class="catcard" href="${h}"><b>${esc(n)}</b><span>${esc(s)}</span></a>`).join("")}</div></section>
  <section class="block"><div class="block-head"><h2>More prediction types</h2><a href="/predictions">All</a></div><div class="catgrid small">${CATEGORIES.slice(0, 6).map((c) => `<a class="catcard" href="/predictions/${c.slug}"><b>${esc(c.name)}</b><span>${esc(c.short)}</span></a>`).join("")}</div></section>`;
  const base = `${m.home.name} vs ${m.away.name}`;
  const title = fitTitle([`${base} Prediction, Odds & Tips | ${SITE_NAME}`, `${base} Prediction & Odds | ${SITE_NAME}`, `${base} Prediction | ${SITE_NAME}`, `${base} Prediction`]);
  const desc = cut(`${base} (${m.league.name}, ${nice}): free prediction${b ? ` - ${b.label} at ${Math.round(b.pct)}%` : ""}, win probabilities, over/under and both teams to score odds. Updated ${clock(Date.now())} ${TZ_LABEL}.`);
  return {
    title, desc, path, body,
    noindex: m.res?.state === "live" || !m.prediction,
    ld: [
      crumbLd(ctx.origin, [["Home", "/"], [m.league.name, lgHref], [base, path]]),
      { ...pageLd(ctx, { name: h1, desc, path }), about: { "@type": "Thing", name: `${base}, ${m.league.name}` }, ...(m.kickoff ? { datePublished: m.kickoff } : {}) },
      ...(faq.length ? [faqLd(faq)] : [])
    ]
  };
}

export function livePage(ctx, { live, upcoming = [] }) {
  const body = `${crumbs([["Home", "/"], ["Live scores", "/live"]])}
  ${pageHead("Live football scores", "Updates by itself every 15 seconds. Each card shows whether our pick is winning.")}
  <div id="liveList" data-live-page>${liveList(live)}</div>
  ${upcoming.length ? `<section class="block"><div class="block-head"><h2>Kicking off next</h2><a href="/football-predictions-today">All matches →</a></div><div class="reclist">${upcoming.slice(0, 6).map((m) => { const tp = topPick(m); return `<a class="rec" href="${matchPath(m)}"><span class="rec-lg">${esc(m.league.name)} · ${timeEl(m, "w-top")}</span><span class="rec-m"><span>${esc(m.home.name)}</span><b><i>v</i></b><span>${esc(m.away.name)}</span></span>${tp ? `<span class="rec-p"><span class="pkline"><small>Pick</small><b>${esc(tp.label)}</b><i>${Math.round(tp.pct)}%</i></span></span>` : ""}</a>`; }).join("")}</div></section>` : ""}`;
  return { title: `Live Football Scores | ${SITE_NAME}`, desc: "Live football scores from leagues around the world, updated every 30 seconds.", path: "/live", body, noindex: true, ld: [crumbLd(ctx.origin, [["Home", "/"], ["Live scores", "/live"]])] };
}

// Public track record: every settled pick in the window we keep, with totals, months and the recent list.
// A short "stay in touch" block: the Telegram channel and WhatsApp, linked from the pages people read most.
function joinBlock() {
  return `<section class="block join"><div class="block-head"><h2>Get the daily picks</h2></div>
    <p class="mut" style="margin:0 0 10px">Daily updates, results and match notes come through our Telegram channel.</p>
    <div class="join-btns"><button type="button" class="join-btn tg" data-contact="channel">Join Telegram</button><button type="button" class="join-btn wa" data-contact="whatsapp">WhatsApp us</button></div></section>`;
}

export function trackRecordPage(ctx, { record }) {
  const list = (record && record.list) || [];
  const total = record ? record.total : 0, won = record ? record.won : 0, rate = record ? record.rate : null;
  const dates = list.map((r) => r.m.ts).filter(Boolean);
  const from = dates.length ? shortDate(Math.min(...dates)) : "", to = dates.length ? shortDate(Math.max(...dates)) : "";
  const months = new Map();
  for (const r of list) {
    const k = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(r.m.ts);
    const x = months.get(k) || { won: 0, total: 0, ts: r.m.ts };
    x.total++; if (r.state === "won") x.won++; months.set(k, x);
  }
  const groups = (record && record.groups) || [];
  const tiles = `<div class="kp"><div><b>${rate === null ? "–" : `${rate}%`}</b><span>Won · ${won} of ${total} picks</span></div>${groups.map((g) => `<div><b>${g.rate}%</b><span>${esc(g.name)} · ${g.won} of ${g.total}</span></div>`).join("")}</div>`;
  const monthRows = [...months.entries()].map(([k, x]) => `<tr><td class="l">${esc(k)}</td><td>${x.won}</td><td>${x.total}</td><td>${Math.round((x.won / x.total) * 100)}%</td></tr>`).join("");
  const recent = list.slice(0, 60).map((r) => `<div class="tr-row ${r.state}"><span class="tr-d">${shortDate(r.m.ts)}</span>
      <span class="tr-m"><b>${esc(r.m.home.name)} ${r.h}–${r.a} ${esc(r.m.away.name)}</b><small>${esc(r.m.league.name)}</small></span>
      <span class="tr-p"><small>Pick</small>${esc(r.pick.label)}${r.pick.odd ? ` <em>@${fmtOdd(r.pick.odd)}</em>` : ""}</span>
      <span class="tr-s ${r.state}">${r.state === "won" ? "Won" : r.state === "lost" ? "Lost" : "Open"}</span></div>`).join("");
  const body = `${crumbs([["Home", "/"], ["Track record", "/track-record"]])}
  ${pageHead("Our track record", `Every published pick we settled between ${from || "–"} and ${to || "–"}. Nothing is removed, win or lose.`)}
  <div class="mx">
    <section class="mx-card"><h2>Overall</h2>${total ? tiles : `<p class="mut">We are still building the record. Settled picks appear here as matches finish.</p>`}
      <p class="mut" style="font-size:.82rem;margin:.8rem 0 0">A win rate is only one part of the story. Check the odds next to each pick, because a 40% pick at 2.60 can be worth more than a 70% pick at 1.20.</p></section>
    ${monthRows ? `<section class="mx-card"><h2>By month</h2><div class="tablewrap"><table class="stand"><thead><tr><th class="l">Month</th><th>Won</th><th>Picks</th><th>Rate</th></tr></thead><tbody>${monthRows}</tbody></table></div></section>` : ""}
    ${recent ? `<section class="mx-card"><h2>Recent picks</h2><div class="tr-list">${recent}</div></section>` : ""}
  </div>`;
  return {
    title: `Track Record: Every Published Pick | ${SITE_NAME}`,
    desc: total ? `${SITE_NAME} track record: ${won} of ${total} published picks won (${rate}%) from ${from} to ${to}, with odds and results for every pick.` : `${SITE_NAME} track record: every published pick and its result, with odds, updated as matches finish.`,
    path: "/track-record", body, ld: [crumbLd(ctx.origin, [["Home", "/"], ["Track record", "/track-record"]])]
  };
}

export function resultsPage(ctx, { results }) {
  const groups = groupByLeague(results.map((m) => ({ ...m })));
  const rows = (g) => g.matches.sort((a, b) => b.ts - a.ts).map((m) => `<article class="mrow res-row"><span class="when"><time datetime="${esc(m.kickoff || "")}" data-t="dm">${shortDate(m.ts)}</time></span>
    <a class="teams" href="${matchPath(m)}"><span class="team">${crest(m.home)}<span class="nm">${esc(m.home.name)}</span></span><span class="team">${crest(m.away)}<span class="nm">${esc(m.away.name)}</span></span></a>
    <div class="score"><b>${m.score?.home ?? "-"}</b><b>${m.score?.away ?? "-"}</b></div><span class="ft">FT</span></article>`).join("");
  const body = `${crumbs([["Home", "/"], ["Results", "/results"]])}
  ${pageHead("Football results", "How our picks did, and the latest final scores.")}
  ${ctx.record && ctx.record.total ? `<section class="block"><div class="block-head"><h2>Our picks</h2></div>${recStrip(ctx.record)}<div class="reclist">${ctx.record.list.map(recCard).join("")}</div></section>` : ""}
  <div class="block-head"><h2>All final scores</h2></div>
  ${groups.length ? groups.map((g) => `<section class="lgblock"><h3 class="lghead"><span>${lgIcon(g.league)}<span>${esc(g.league.name)}</span></span><span class="n">${g.matches.length}</span></h3>${rows(g)}</section>`).join("") : `<div class="empty">No recent results to show yet.</div>`}`;
  return { title: `Football Results: Latest Final Scores | ${SITE_NAME}`, desc: "Latest football results and final scores from leagues around the world.", path: "/results", body, ld: [crumbLd(ctx.origin, [["Home", "/"], ["Results", "/results"]])] };
}

export function favouritesPage(ctx) {
  const body = `${crumbs([["Home", "/"], ["Saved matches", "/favourites"]])}
  ${pageHead("Your saved matches", "Tap the ☆ on any match to keep it here. Saved on this device only.")}
  <div id="favList" class="favlist"><div class="empty">Loading your saved matches…</div></div>
  <noscript><div class="empty">Saved matches need JavaScript.</div></noscript>`;
  return { title: `Saved Matches | ${SITE_NAME}`, desc: "Your saved football matches.", path: "/favourites", body, noindex: true, ld: [] };
}

export function staticPage(ctx, slug) {
  const p = PAGES[slug];
  const path = `/${slug}`;
  const body = `${crumbs([["Home", "/"], [p.h1, path]])}<article class="prose page"><h1>${esc(p.h1)}</h1>${p.body}</article>`;
  return { title: p.title, desc: p.desc, path, body, noindex: !!p.noindex, ld: [crumbLd(ctx.origin, [["Home", "/"], [p.h1, path]])] };
}

export function notFoundPage() {
  return {
    title: `Page not found | ${SITE_NAME}`, desc: "That page could not be found.", path: "/404", noindex: true, ld: [],
    body: `<div class="notfound"><h1>We could not find that page</h1><p>The match may have finished, or the link may be old.</p><div class="btn-row"><a class="btn solid" href="/football-predictions-today">Today's predictions</a><a class="btn" href="/">Home</a></div></div>`
  };
}

export function errorPage() {
  return {
    title: `Please try again | ${SITE_NAME}`, desc: "Something went wrong.", path: "/error", noindex: true, ld: [],
    body: `<div class="notfound"><h1>Data is taking a moment</h1><p>Our data source is waking up or busy. Please try again in a minute.</p><div class="btn-row"><a class="btn solid" href="/">Try again</a></div></div>`
  };
}

export function warmingPage() {
  return {
    title: `Loading today's matches | ${SITE_NAME}`, desc: "Loading matches.", path: "/loading", noindex: true, refresh: 15, ld: [],
    body: `<div class="notfound"><h1>Getting today's matches…</h1><p>Our data source is waking up. This page reloads by itself every few seconds, so just wait a moment.</p><div class="btn-row"><a class="btn solid" href="">Reload now</a></div></div>`
  };
}


export function slipPage(ctx) {
  const path = "/build-slip";
  const body = `<section class="sb-wrap" aria-labelledby="sbTitle">
  <div class="sb-screen">
  <header class="sb-hero"><img src="/assets/scout-logo.svg" width="36" height="36" alt=""><div><h1 id="sbTitle">AI slip builder</h1><p>Three taps. The model shows you why.</p></div><a class="sb-home" href="/">SportyPredictz →</a></header>
  <div id="slipStage" class="sb-stage" aria-live="polite"><p class="sb-q-sub">Loading matches…</p></div>
  </div>
  <div id="mySlip" class="sb-mine"></div>
  <section class="sb-more" aria-labelledby="sbGlanceH"><h2 id="sbGlanceH" class="sb-h">At a glance</h2>
    <div class="sb-widgets">
      <div class="sb-widget" id="sbGlance"><p class="sb-q-sub">Loading today's numbers…</p></div>
      <div class="sb-widget">
        <h3>Quick return calculator</h3>
        <p class="sb-q-sub">Type the total odds and a stake to see the possible return. Nothing is placed or paid.</p>
        <div class="sb-calc2"><label>Total odds <input id="calcOdds" type="number" min="1" step="0.01" value="2.50"></label><label>Stake <input id="calcStake" type="number" min="0" step="1" value="10"></label></div>
        <p class="sb-ret">Possible return: <b id="calcOut">25.00</b></p>
      </div>
    </div>
  </section>
  <section class="sb-more"><h2 class="sb-h">How the builder decides</h2>
    <div class="sb-steps">
      <div class="sb-step"><b>1</b><span>It reads today's and tomorrow's matches that still have prices and a model chance.</span></div>
      <div class="sb-step"><b>2</b><span>It keeps only the picks the model rates at 75% or more for more combo, or 65% or more for fewer combo.</span></div>
      <div class="sb-step"><b>3</b><span>It uses one pick per match, spreads leagues and markets, and aims for your total odds.</span></div>
      <div class="sb-step"><b>4</b><span>It shows the reasons, the model chance against the bookmaker's price, so you can judge it yourself.</span></div>
    </div>
  </section>
  <section class="sb-more"><h2 class="sb-h">Markets the builder uses</h2>
    <div class="catgrid small">
      <a class="catcard" href="/predictions/over-1-5-goals"><b>Over 1.5 goals</b><span>Matches likely to see two or more goals</span></a>
      <a class="catcard" href="/predictions/over-2-5-goals"><b>Over 2.5 goals</b><span>Goal-rich games across all leagues</span></a>
      <a class="catcard" href="/predictions/under-2-5-goals"><b>Under 2.5 goals</b><span>Tighter games with fewer goals</span></a>
      <a class="catcard" href="/predictions/both-teams-to-score"><b>Both teams to score</b><span>Where both sides are likely to find the net</span></a>
      <a class="catcard" href="/predictions/double-chance"><b>Double chance</b><span>Cover two of the three results</span></a>
      <a class="catcard" href="/predictions/draws"><b>Draws</b><span>Evenly matched games</span></a>
      <a class="catcard" href="/predictions/banker-picks"><b>Banker picks</b><span>The strongest reads of the day</span></a>
      <a class="catcard" href="/predictions/weekend-match-predictions"><b>Weekend picks</b><span>Friday to Sunday fixtures</span></a>
    </div>
  </section>
  <section class="sb-more"><h2 class="sb-h">Questions people ask</h2>
    <details class="sb-faq"><summary>Is the slip guaranteed to win?</summary><p>No. Each pick is an estimate, and a slip's chance is roughly one divided by its total odds. Any game can change.</p></details>
    <details class="sb-faq"><summary>What does "more combo" mean?</summary><p>More games, each with a smaller price. The slip is spread across more matches for a safer pick on each game.</p></details>
    <details class="sb-faq"><summary>What does "fewer combo" mean?</summary><p>Fewer games, each with a bigger price. Each pick carries more risk, so the builder still chooses the strongest options it can find.</p></details>
    <details class="sb-faq"><summary>Can I save a slip?</summary><p>Yes. Add it to My slip. It's saved in your own browser, and you can use the calculator to see the return.</p></details>
    <details class="sb-faq"><summary>Is it betting advice?</summary><p>No. SportyPredictz is an information site and takes no bets. Bet only where it is legal where you live, and only what you can afford to lose.</p></details>
  </section>
  <section class="prose sb-seo">
    <h2>How the AI slip builder works</h2>
    <p>The builder reads today's and tomorrow's matches that have bookmaker prices and a model chance. It looks at each game across the markets we carry: match result, double chance, goals and both teams to score. More combo only uses games the model gives at least 75% to land. Fewer combo takes bigger risks, so it accepts games from 65% down, always picking the strongest first. A slip never uses two bets from the same match.</p>
    <h2>More combo or fewer combo</h2>
    <p>More combo uses more games with a smaller price on each, which is the safer shape. Fewer combo uses one to five games with bigger prices on each, which is the higher-risk shape. Both aim for the total odds you picked, and both show the reasons for every pick.</p>
    <h2>Why there is no guarantee</h2>
    <p>A slip's chance is roughly one divided by its total odds, and every extra game lowers it further. Even a strong pick can lose to a late goal or a red card. The builder helps you see the numbers clearly. It cannot promise a win.</p>
    <p class="sb-fine-page">18+ only. Bet responsibly, only where it is legal where you live, and only what you can afford to lose. <a href="/responsible-gambling">Responsible gambling</a></p>
  </section>
  <noscript><p>This builder needs JavaScript. You can still read the <a href="/football-predictions-today">predictions for today</a>.</p></noscript>
</section>
<script type="module" src="/slip.js?v=${ctx.v}"></script>`;
  return { bare: true, title: "AI Slip Builder: Build a Football Combo in 3 Taps | SportyPredictz", desc: "Build an AI football slip in three taps. Choose the odds, today or tomorrow, and more or fewer games. The model shows its reasons. No guarantees.", path, body, ld: [crumbLd(ctx.origin, [["Home", "/"], ["AI slip builder", path]])] };
}

export function advertisePage(ctx) {
  const path = "/advertise";
  const kit = MEDIA_KIT;
  const facts = [
    kit.monthlyVisitors ? [Number(kit.monthlyVisitors).toLocaleString("en-GB"), "monthly visitors"] : null,
    kit.monthlyPageViews ? [Number(kit.monthlyPageViews).toLocaleString("en-GB"), "monthly page views"] : null,
    kit.mobileShare ? [`${kit.mobileShare}%`, "on mobile"] : null,
    kit.topCountries && kit.topCountries.length ? [kit.topCountries.slice(0, 3).join(", "), "top countries"] : null
  ].filter(Boolean);
  const preview = (slot) => ({
    top: `<svg viewBox="0 0 120 70" aria-hidden="true"><rect x="4" y="4" width="112" height="8" rx="2" class="pv-hi"/><rect x="4" y="16" width="112" height="6" rx="2"/><rect x="4" y="26" width="54" height="40" rx="3"/><rect x="62" y="26" width="54" height="40" rx="3"/></svg>`,
    feed: `<svg viewBox="0 0 120 70" aria-hidden="true"><rect x="4" y="4" width="112" height="14" rx="3"/><rect x="4" y="22" width="112" height="14" rx="3" class="pv-hi"/><rect x="4" y="40" width="112" height="14" rx="3"/><rect x="4" y="58" width="112" height="8" rx="3"/></svg>`,
    side: `<svg viewBox="0 0 120 70" aria-hidden="true"><rect x="4" y="4" width="70" height="62" rx="3"/><rect x="80" y="4" width="36" height="26" rx="3" class="pv-hi"/><rect x="80" y="34" width="36" height="32" rx="3"/></svg>`,
    match: `<svg viewBox="0 0 120 70" aria-hidden="true"><rect x="4" y="4" width="112" height="18" rx="3"/><rect x="4" y="26" width="112" height="14" rx="3" class="pv-hi"/><rect x="4" y="44" width="54" height="22" rx="3"/><rect x="62" y="44" width="54" height="22" rx="3"/></svg>`
  })[slot];
  const body = `${crumbs([["Home", "/"], ["Advertise", path]])}
  <header class="ph5"><p class="ph5-d">Sponsorship and partnerships</p><h1>Advertise on SportyPredictz</h1><p class="ph5-s">Football fans open SportyPredictz right before kick-off to check the numbers. Four clearly labelled placements put your brand beside that moment, without touching a single pick.</p><div class="hz-cta"><button type="button" class="btn solid" data-contact="email">Email us</button><button type="button" class="btn" data-contact="whatsapp">WhatsApp</button><button type="button" class="btn" data-contact="telegram">Telegram</button></div></header>
  ${facts.length ? `<section class="sec"><h2>Audience</h2><dl class="hz-stats">${facts.map(([n, l]) => `<div><dt>${esc(n)}</dt><dd>${esc(l)}</dd></div>`).join("")}</dl>${kit.updated ? `<p class="sec-sub">Figures from our own analytics, ${esc(kit.updated)}.</p>` : ""}</section>` : ""}
  <section class="sec" aria-labelledby="h-pl"><div class="sec-h"><h2 id="h-pl">Placements</h2></div><div class="pl5">${PLACEMENTS.map((x) => `<article class="pl5-c">${preview(x.slot)}<h3>${esc(x.name)}</h3><p>${esc(x.where)}</p><small>Best size: ${esc(x.size)}</small></article>`).join("")}</div></section>
  <section class="prose"><h2>How sponsorship works here</h2>
    <p>Every sponsor is labelled Sponsored, and links carry the rel="sponsored" tag that Google asks for on paid placements. Sponsors never change a prediction, a percentage or the track record. The model runs on odds and data, and a sponsor cannot touch it.</p>
    <p>SportyPredictz is for adults. Every page carries an 18+ notice and a responsible gambling message, and gambling brands must be licensed where they operate. We reserve the right to decline a brand.</p>
    <h2>What to send us</h2>
    <p>Your brand name, the link you want visitors to land on, a short line of copy, a logo or banner in the size above, the dates you want, and the markets you serve. We will reply with availability and a price.</p></section>`;
  const desc = "Advertise on SportyPredictz: top banner, in-feed, sidebar and match page placements for brands that want to reach football fans before kick-off.";
  return { title: `Advertise on SportyPredictz | Football Sponsorship`, desc, path, body, ld: [crumbLd(ctx.origin, [["Home", "/"], ["Advertise", path]]), pageLd(ctx, { name: "Advertise on SportyPredictz", desc, path })] };
}

// views.js - turns data into HTML pages (rendered on the server, so Google and phones get real content at once).

import {
  esc, num, fmtOdd, pctTxt, initials, clock, longDate, shortDate, dayKey, todayKey, addDays, keyToTs,
  matchPath, leaguePath, marketsOf, MARKET_TABS, groupByLeague, bestSide, edgeOf, rankPicks, buildAcca, byLeague, pickState, PICK_TXT, topPick
} from "./logic.js";
import { CATEGORIES, CAT_BY_SLUG, HOME, PAGES, SITE_NAME, analysis } from "./content.js";

// ---------- small pieces ----------
const crest = (t) => {
  const fb = esc(initials(t.name));
  return `<span class="crest">${t.logo ? `<img src="${esc(t.logo)}" alt="" loading="lazy" width="24" height="24" data-fb="${fb}">` : fb}</span>`;
};
const lgIcon = (lg) => {
  const fb = esc(initials(lg.name));
  return lg.logo ? `<img class="lgi" src="${esc(lg.logo)}" alt="" loading="lazy" width="22" height="22" data-fb="${fb}">` : `<span class="lg-fb">${fb}</span>`;
};
const timeEl = (m, cls = "when") => `<time class="${cls}" datetime="${esc(m.kickoff || "")}" data-t="hm">${clock(m.ts)}</time>`;

// Score + status helpers. state: pre | live | ft | wait. The browser keeps these fresh (see app.js).
const RES0 = { state: "pre", h: null, a: null, label: "" };
const resOf = (m) => m.res || RES0;
const scNum = (m, side) => { const v = resOf(m)[side]; return v === null || v === undefined ? "–" : v; };
const scEl = (m, side) => `<b class="sc" data-side="${side}">${scNum(m, side)}</b>`;
const pstEl = (m, k) => {
  if (!k) return "";
  const ps = pickState(m, k);
  return `<span class="pst ${ps || "pend"}">${ps ? PICK_TXT[ps] : resOf(m).state === "wait" ? "Started" : "Pending"}</span>`;
};
function whenEl(m, k, withChip = true) {
  const r = resOf(m);
  const top = r.state === "pre"
    ? `<time class="w-top" datetime="${esc(m.kickoff || "")}" data-t="hm">${clock(m.ts)}</time>`
    : `<span class="w-top">${esc(r.label)}</span>`;
  return `<span class="when">${top}${withChip ? pstEl(m, k) : ""}</span>`;
}
const rowAttrs = (m, k) => `data-sc="${m.id}" data-state="${resOf(m).state}" data-pk="${esc(k || "")}"`;

function oddBtn(m, d, extra = "") {
  const odd = num(d.odd);
  const ok = odd && odd > 1;
  return `<button type="button" class="odd${extra}" data-mid="${m.id}" data-k="${esc(d.k)}" data-odd="${ok ? odd.toFixed(2) : ""}" data-pick="${esc(d.pick)}" data-teams="${esc(m.home.name)} v ${esc(m.away.name)}"${d.calc ? ' data-calc="1"' : ""}${ok ? "" : " disabled"} aria-label="${esc(d.pick)} ${ok ? odd.toFixed(2) : "no price"}"><small>${esc(d.label)}</small><b>${d.calc && ok ? "~" : ""}${fmtOdd(odd)}</b></button>`;
}

const starBtn = (m) => `<button type="button" class="star" data-fav data-mid="${m.id}" data-home="${esc(m.home.name)}" data-away="${esc(m.away.name)}" data-league="${esc(m.league.name)}" data-ts="${m.ts}" data-path="${esc(matchPath(m))}" aria-label="Save ${esc(m.home.name)} v ${esc(m.away.name)}" aria-pressed="false">☆</button>`;

export function matchRow(m) {
  const mk = marketsOf(m);
  const tp = topPick(m);
  const pk = tp ? tp.k : null;
  const ps = pk ? pickState(m, pk) : null;
  const hl = ps === "won" || ps === "lost" ? ` ${ps}` : "";
  const groups = Object.entries(mk).map(([id, list]) =>
    `<div class="mk mk-${id}" style="--n:${list.length}">${list.map((d) => oddBtn(m, d, pk && d.k === pk ? ` mp${hl}` : "")).join("")}</div>`).join("");
  const pd = pk ? Object.values(mk).flat().find((d) => d.k === pk) : null;
  const line = tp
    ? `<span class="pkline"><small>Pick</small><b>${esc(tp.label)}</b><i>${Math.round(tp.pct)}%</i></span>${pstEl(m, pk)}<span class="mbar"><i style="width:${Math.min(100, Math.round(tp.pct))}%"></i></span>`
    : `<span class="pkline none"><small>Pick</small><b>No clear pick</b></span>`;
  return `<article class="mrow pk" ${rowAttrs(m, pk)} data-search="${esc(`${m.home.name} ${m.away.name} ${m.league.name}`.toLowerCase())}">
    ${whenEl(m, pk, false)}
    <a class="teams" href="${matchPath(m)}"><span class="team">${crest(m.home)}<span class="nm">${esc(m.home.name)}</span>${scEl(m, "h")}</span><span class="team">${crest(m.away)}<span class="nm">${esc(m.away.name)}</span>${scEl(m, "a")}</span></a>
    <div class="pkrow">${line}</div>
    <div class="pkgo">${pd ? oddBtn(m, pd, ` mp${hl}`) : ""}<button type="button" class="more" aria-expanded="false" aria-label="All odds for ${esc(m.home.name)} v ${esc(m.away.name)}"><span>Odds</span></button></div>
    <div class="mks">${groups}</div>
    ${starBtn(m)}
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
  const now = matches.filter((m) => resOf(m).state === "live" || resOf(m).state === "wait");
  const done = matches.filter((m) => resOf(m).state === "ft");
  const ahead = matches.filter((m) => resOf(m).state === "pre");
  const today = ahead.filter((m) => dayKey(m.ts) === todayKey());
  const best = rankPicks("banker-picks", ahead)[0] || null;
  const o25 = rankPicks("over-2-5-goals", ahead);
  const bt = rankPicks("both-teams-to-score", ahead);
  const recs = ((ctx.record && ctx.record.list) || []).filter((r) => r.m.league.name === name);
  const won = recs.filter((r) => r.state === "won").length;
  const lead = standings && standings.groups && standings.groups[0] && standings.groups[0].rows[0];
  return { name, now, done, ahead, today, best, o25, bt, recs, won, lead };
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
  if (f.ahead.length) bits.push(`${f.ahead.length} to play`);
  if (f.best) bits.push(`top pick <b>${esc(f.best.label)}</b> ${Math.round(f.best.pct)}%`);
  return bits.length ? `<p class="lgnote">${bits.join(" · ")}</p>` : "";
};

function leagueBlock(g, { limit = 0, moreHref = "", open = true } = {}) {
  const list = limit ? g.matches.slice(0, limit) : g.matches;
  const more = limit && g.matches.length > limit ? `<a class="seemore" href="${moreHref || leaguePath(g.league)}">All ${g.matches.length} matches in ${esc(g.league.name)} →</a>` : "";
  return `<details class="lgblock" id="lg-${esc(g.league.id ?? "x")}"${open ? " open" : ""}>
    <summary class="lghead"><span class="lhl">${lgIcon(g.league)}<span class="lname">${esc(g.league.name)}</span><span class="n">${g.matches.length}</span></span>${mkHeader()}<i class="chev" aria-hidden="true"></i></summary>
    ${lgNote(g)}${list.map(matchRow).join("")}${more}
  </details>`;
}
const leagueBlocks = (groups, o = {}) => groups.map((g, i) => leagueBlock(g, { ...o, open: i < (o.openN ?? 7) })).join("");

function toolbar(groups) {
  const tabs = MARKET_TABS.map((t, i) => `<button type="button" class="mtab${i === 0 ? " on" : ""}" data-market="${t.id}">${t.name}</button>`).join("");
  const jump = groups.length > 2
    ? `<nav class="lgjump" aria-label="Jump to a league">${groups.map((g) => `<a href="#lg-${esc(g.league.id ?? "x")}">${esc(g.league.name)} <b>${g.matches.length}</b></a>`).join("")}</nav>`
    : "";
  return `<div class="toolbar"><div class="mtabs" role="tablist" aria-label="Betting market">${tabs}</div>
    <label class="search"><span class="sr">Search</span><input type="search" data-search placeholder="Search a team or league" autocomplete="off"></label>${groups.length > 3 ? `<button type="button" class="lgtoggle" data-lgtoggle>Collapse all</button>` : ""}</div>${jump}
    <p class="mnote" data-mnote></p>`;
}

function dayTabs(days, activeKey) {
  const today = todayKey();
  return `<nav class="daytabs" aria-label="Choose a day">${days.map((k) => {
    const label = k === today ? "Today" : k === addDays(today, 1) ? "Tomorrow" : shortDate(keyToTs(k));
    const href = k === today ? "/football-predictions-today" : k === addDays(today, 1) ? "/football-predictions-tomorrow" : `/football-predictions/${k}`;
    return `<a class="daytab${k === activeKey ? " on" : ""}" href="${href}"><small>${esc(shortDate(keyToTs(k)).split(" ")[0])}</small><b>${esc(k.slice(8))}</b><span>${esc(label)}</span></a>`;
  }).join("")}</nav>`;
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
const faqHtml = (items) => `<section class="faq"><h2>Frequently asked questions</h2>${items.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</section>`;

const GROUP_ORDER = ["Match result", "Goals", "Both teams to score", "Double chance", "Smart picks", "Accumulators"];
const isAcca = (c) => c.kind === "acca" || c.kind === "acca-hub";
function catTile(c, counts) {
  const n = counts[c.slug];
  const tag = n == null ? "" : c.kind === "acca" ? `<i class="${n ? "" : "off"}">${n ? "Ready" : "Building"}</i>` : c.kind === "acca-hub" ? `<i>${n} ready</i>` : `<i class="${n ? "" : "off"}">${n} today</i>`;
  return `<a class="catcard" href="/predictions/${c.slug}"><b>${esc(c.name)}</b><span>${esc(c.short)}</span>${tag}</a>`;
}
function catCards(counts = {}, { featured = false } = {}) {
  if (featured) return `<div class="catgrid">${CATEGORIES.filter((c) => c.featured).map((c) => catTile(c, counts)).join("")}</div>`;
  return GROUP_ORDER.map((g) => {
    const list = CATEGORIES.filter((c) => c.group === g);
    return list.length ? `<section class="catgroup"><h2 class="grp">${esc(g)}</h2><div class="catgrid">${list.map((c) => catTile(c, counts)).join("")}</div></section>` : "";
  }).join("");
}
const liveOrPre = (m) => !m.res || m.res.state !== "ft";
function countsFor(matches) {
  const counts = {};
  const upcoming = matches.filter((m) => !m.res || m.res.state === "pre");
  let accas = 0;
  for (const c of CATEGORIES) {
    if (c.kind === "acca") { counts[c.slug] = buildAcca(upcoming, c.acca.target, c.acca.legs) ? 1 : 0; accas += counts[c.slug]; }
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

const accaHtml = (name, acca, href = "") => acca
  ? `<section class="acca"><div class="acca-head"><h2>${href ? `<a href="${href}">${esc(name)}</a>` : esc(name)}</h2><span class="acca-total">${plural(acca.legs.length, "leg")} · Total odds <b>${acca.total.toFixed(2)}</b></span></div>
      ${acca.legs.map((l) => `<div class="leg" ${rowAttrs(l.m, l.k)}><span class="legt">${dayKey(l.m.ts) !== todayKey() ? `<small>${esc(shortDate(l.m.ts))}</small>` : ""}${timeEl(l.m)}</span><a href="${matchPath(l.m)}"><b>${esc(l.m.home.name)} v ${esc(l.m.away.name)}</b><small>${esc(l.label)} · ${Math.round(l.pct)}% model</small></a><span class="mono">${l.calc ? "~" : ""}${fmtOdd(l.odd)}</span></div>`).join("")}
      <button type="button" class="btn solid" data-acca='${esc(JSON.stringify(acca.legs.map((l) => ({ mid: l.m.id, k: l.k, odd: l.odd.toFixed(2), pick: l.label, teams: `${l.m.home.name} v ${l.m.away.name}` }))))}'>Add all to pick slip</button></section>`
  : `<section class="acca"><div class="acca-head"><h2>${href ? `<a href="${href}">${esc(name)}</a>` : esc(name)}</h2></div><div class="empty">Not enough strong picks to build this acca right now.</div></section>`;

function pickRow(it) {
  const m = it.m;
  const e = it.edge;
  const note = it.vs !== undefined && it.vs !== null
    ? `${Math.round(it.pct)}% model vs ${Math.round(it.vs)}% market`
    : `${Math.round(it.pct)}% model chance${e !== null ? ` · edge <em class="${e > 0 ? "pos" : "neg"}">${e > 0 ? "+" : ""}${(e * 100).toFixed(1)}%</em>` : ""}`;
  return `<article class="prow" ${rowAttrs(m, it.k)} data-search="${esc(`${m.home.name} ${m.away.name} ${m.league.name}`.toLowerCase())}">
    ${whenEl(m, it.k)}
    <a class="teams" href="${matchPath(m)}"><span class="team">${crest(m.home)}<span class="nm">${esc(m.home.name)}</span>${scEl(m, "h")}</span><span class="team">${crest(m.away)}<span class="nm">${esc(m.away.name)}</span>${scEl(m, "a")}</span><span class="lgline">${esc(m.league.name)}</span></a>
    <div class="pkcell"><b>${esc(it.label)}</b><span class="bar"><i style="width:${Math.min(100, Math.round(it.pct))}%"></i></span><small>${note}</small></div>
    ${oddBtn(m, { k: it.k, label: ({ "O1.5": "Over 1.5", "O2.5": "Over 2.5", "O3.5": "Over 3.5", "U2.5": "Under 2.5", GG: "Both score", NG: "One or none" })[it.k] || it.k, odd: it.odd, pick: it.label, calc: it.calc })}
    ${starBtn(m)}
  </article>`;
}

function liveCard(m) {
  const tp = topPick(m);
  const pk = tp ? tp.k : null;
  const r = resOf(m);
  return `<a class="lcard" href="${matchPath(m)}" ${rowAttrs(m, pk)} data-card>
    <span class="lc-top"><span class="lc-lg">${esc(m.league.name)}</span><span class="lc-min"><i class="pulse"></i><span class="w-top">${esc(r.label || "LIVE")}</span></span></span>
    <span class="lc-m">${crest(m.home)}<span class="lc-t">${esc(m.home.name)}</span>${scEl(m, "h")}</span>
    <span class="lc-m">${crest(m.away)}<span class="lc-t">${esc(m.away.name)}</span>${scEl(m, "a")}</span>
    ${tp ? `<span class="lc-foot"><span class="pkline"><small>Pick</small><b>${esc(tp.label)}</b><i>${Math.round(tp.pct)}%</i></span>${pstEl(m, pk)}</span>` : ""}
  </a>`;
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
export function layout(ctx, o) {
  const url = ctx.origin + o.path;
  const robots = o.noindex || ctx.demo ? "noindex,follow" : "index,follow,max-image-preview:large";
  const ld = (o.ld || []).map((x) => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, "\\u003c")}</script>`).join("");
  const active = (p) => (o.path === p || (p !== "/" && o.path.startsWith(p)) ? " on" : "");
  const t = ctx.ticker;
  const topLeagues = (ctx.leagues || []).slice(0, 6);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<meta name="robots" content="${robots}">${o.refresh ? `<meta http-equiv="refresh" content="${o.refresh}">` : ""}
${(ctx.verify || []).join("\n")}
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.desc)}"><meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary"><meta name="theme-color" content="#06090d">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%2306090d'/%3E%3Ccircle cx='32' cy='32' r='18' fill='none' stroke='%23b6ff3b' stroke-width='5'/%3E%3Ccircle cx='32' cy='32' r='6' fill='%23b6ff3b'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css?v=${ctx.v}">
${ld}
</head>
<body data-market="1x2">
${ctx.demo ? `<div class="demo-banner"><b>DEMO DATA.</b> Not connected to odds-api yet. Set <code>ODDS_API_KEY_SPORTY</code> on Render for real matches.</div>` : ""}
<header class="topbar">
  <a class="logo" href="/" aria-label="${SITE_NAME} home"><span class="logo-mark" aria-hidden="true"></span><span>SPORTY<b>PREDICTZ</b></span></a>
  <nav class="mainnav" aria-label="Main">
    <a class="${active("/football-predictions-today").trim()}" href="/football-predictions-today">Today</a>
    <a class="${active("/football-predictions-tomorrow").trim()}" href="/football-predictions-tomorrow">Tomorrow</a>
    <a class="${active("/leagues").trim()}" href="/leagues">Leagues</a>
    <a class="${active("/live").trim()}" href="/live">Live <i class="live-dot" id="liveCount"${ctx.liveCount ? "" : " hidden"}>${ctx.liveCount || 0}</i></a>
    <a class="${active("/results").trim()}" href="/results">Results</a>
  </nav>
  <div class="top-right"><a class="saved${active("/favourites")}" href="/favourites">★ <span>Saved</span> <i class="count" id="favCount" hidden>0</i></a><span class="age" title="18 or older only">18+</span></div>
</header>
<div class="ticker" aria-label="Live scores and next matches"><a class="ticker-label${t.label === "LIVE" ? " live" : ""}" id="tickerLabel" href="/live">${t.label}</a><div class="ticker-window"><div class="ticker-track" id="ticker">${t.items}</div></div></div>
<nav class="catbar" aria-label="Prediction categories"><div class="catscroll"><a class="catpill${o.path === "/predictions" ? " on" : ""}" href="/predictions">All tips</a>${CATEGORIES.map((c) => `<a class="catpill${o.path === `/predictions/${c.slug}` ? " on" : ""}" href="/predictions/${c.slug}">${esc(c.name)}</a>`).join("")}</div></nav>
<main class="wrap" id="main">
${o.body}
</main>
<footer class="foot">
  <div class="foot-grid">
    <div class="foot-brand"><a class="logo" href="/"><span class="logo-mark" aria-hidden="true"></span><span>SPORTY<b>PREDICTZ</b></span></a><p>Football predictions, odds and model chances in one fast place.</p></div>
    <div class="foot-col"><h5>Predictions</h5>${CATEGORIES.slice(0, 6).map((c) => `<a href="/predictions/${c.slug}">${esc(c.name)}</a>`).join("")}<a href="/predictions">See all tips</a></div>
    <div class="foot-col"><h5>Football</h5><a href="/football-predictions-today">Today's matches</a><a href="/football-predictions-tomorrow">Tomorrow's matches</a><a href="/live">Live scores</a><a href="/results">Results</a><a href="/leagues">All leagues</a>${topLeagues.map((l) => `<a class="lg-link" href="${leaguePath(l)}">${esc(l.name)}</a>`).join("")}</div>
    <div class="foot-col"><h5>Site</h5><a href="/about">About us</a><a href="/how-it-works">How it works</a><a href="/responsible-gambling">Responsible gambling</a><a href="/terms">Terms of use</a><a href="/privacy">Privacy policy</a></div>
  </div>
  <div class="foot-bar"><p><b class="age-pill">18+</b> ${SITE_NAME} is an information site, not a bookmaker, and takes no bets. Odds can change at any time. Predictions are estimates, not guarantees. Bet only where it is legal and only what you can afford to lose.</p><span class="mono">&copy; ${new Date().getFullYear()} ${SITE_NAME}</span></div>
</footer>
<aside class="slip" id="slip" aria-label="Pick slip" hidden>
  <div class="slip-head"><div class="block-title">Pick slip <i class="count" id="slipCount">0</i></div><button type="button" class="link-btn" id="slipClose">Close</button></div>
  <div id="slipBody"></div>
</aside>
<button type="button" class="slip-fab" id="slipFab" hidden><span>Pick slip</span><b id="fabCount">0</b><span class="mono" id="fabOdds">0.00</span></button>
<script src="/app.js?v=${ctx.v}" defer></script>
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
export function homePage(ctx, { matches, live, updatedAt }) {
  const today = todayKey();
  const todays = matches.filter((m) => dayKey(m.ts) === today);
  const pool = (todays.length ? todays : matches).slice().sort((a, b) => a.ts - b.ts);
  const groups = groupByLeague(pool);
  const liveNow = (ctx.liveItems || []).length;
  const VIEW_ALL_AFTER = 6;
  let shown = 0;
  const viewAll = `<a class="v4-viewall" href="/football-predictions-today">View all ${pool.length} matches →</a>`;

  // League picker first, open by default. Each chip jumps to that league's matches below.
  const picker = groups.length ? `<details class="v4-picker" open>
      <summary><span>Leagues</span><b>${groups.length}</b><i>tap a league</i></summary>
      <div class="v4-chips">${groups.map((g) => `<a href="#lg-${esc(g.league.id ?? "x")}">${lgIcon(g.league)}<span>${esc(g.league.name)}</span><b>${g.matches.length}</b></a>`).join("")}</div>
    </details>` : "";

  // Every match, grouped by league. The "View all" link sits after the first few matches.
  const list = groups.map((g) => {
    const rows = g.matches.map((m) => {
      shown++;
      return matchRow(m) + (shown === VIEW_ALL_AFTER && pool.length > VIEW_ALL_AFTER ? viewAll : "");
    }).join("");
    return `<div class="v4-group" id="lg-${esc(g.league.id ?? "x")}"><h3>${lgIcon(g.league)}${esc(g.league.name)} <span>${g.matches.length}</span></h3>${rows}</div>`;
  }).join("");

  const body = `
  ${pageHead(`Football predictions ${todays.length ? "today" : "this week"}`, `${esc(longDate(Date.now()))} · ${pool.length} matches${liveNow ? ` · ${liveNow} live now` : ""}`)}
  ${picker}
  ${pool.length ? `<section class="block">${list}</section>` : `<div class="empty">No matches loaded yet. This page fills itself in when they appear.</div>`}
  ${pool.length > VIEW_ALL_AFTER && shown <= VIEW_ALL_AFTER ? viewAll : ""}
  ${ctx.record && ctx.record.total ? `<section class="block"><div class="block-head"><h2>Our track record</h2><a href="/results">All results →</a></div>${recStrip(ctx.record)}</section>` : ""}
  <details class="v4-more"><summary>How we make predictions<span>Tap to read</span></summary>
    <div class="v4-prose">${HOME.how.map((p) => `<p>${esc(p)}</p>`).join("")}<p><a href="/how-it-works">Read how to read the numbers →</a></p>${HOME.faq.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join("")}</div>
  </details>`;
  return {
    title: HOME.title, desc: HOME.desc, path: "/", body,
    ld: [
      { "@context": "https://schema.org", "@type": "WebSite", name: SITE_NAME, url: ctx.origin + "/", description: HOME.desc },
      faqLd(HOME.faq)
    ]
  };
}

export function dayPage(ctx, { matches, days, key }) {
  const today = todayKey();
  const list = matches.filter((m) => dayKey(m.ts) === key);
  const groups = groupByLeague(list);
  const label = key === today ? "today" : key === addDays(today, 1) ? "tomorrow" : shortDate(keyToTs(key));
  const path = key === today ? "/football-predictions-today" : key === addDays(today, 1) ? "/football-predictions-tomorrow" : `/football-predictions/${key}`;
  const nice = longDate(keyToTs(key));
  const body = `
  ${crumbs([["Home", "/"], [`Predictions ${label}`, path]])}
  ${pageHead(`Football predictions ${label}`, `${esc(nice)} · ${list.length} matches · ${groups.length} leagues`)}
  ${dayTabs(days, key)}
  ${list.length ? toolbar(groups) + leagueBlocks(groups, { openN: 7 }) : `<div class="empty">No matches found for this day yet.<br>Try another day above.</div>`}
  <section class="prose"><h2>About these predictions</h2><p>Kick-off times are shown in your own time zone. Odds are a single market consensus price, and the model percentages are estimates. Tap any odds button to add it to your pick slip, or open a match for the full breakdown.</p></section>`;
  return {
    title: `Football Predictions ${key === today ? "Today" : key === addDays(today, 1) ? "Tomorrow" : nice}: Odds and Tips | ${SITE_NAME}`,
    desc: `Football predictions for ${nice}: ${list.length} matches with odds, win probabilities, over/under goals and both teams to score picks.`,
    path, body, ld: [crumbLd(ctx.origin, [["Home", "/"], [`Predictions ${label}`, path]])]
  };
}

export function hubPage(ctx, { matches }) {
  const counts = countsFor(matches);
  const body = `${crumbs([["Home", "/"], ["Predictions", "/predictions"]])}
  ${pageHead("Football predictions by bet type", "Pick the kind of bet you like and see the matches the model rates best for it.")}
  ${catCards(counts)}`;
  return { title: `Football Predictions by Bet Type | ${SITE_NAME}`, desc: "Browse football predictions by bet type: banker picks, home wins, away wins, draws, over/under 2.5 goals, both teams to score, double chance, value bets and accumulator tips.", path: "/predictions", body, ld: [crumbLd(ctx.origin, [["Home", "/"], ["Predictions", "/predictions"]])] };
}

export function categoryPage(ctx, { cat, matches }) {
  const path = `/predictions/${cat.slug}`;
  const others = CATEGORIES.filter((c) => c.slug !== cat.slug && (c.group === cat.group || c.featured)).slice(0, 8);
  let list = "";
  let count = 0;
  const upcoming = matches.filter((m) => !m.res || m.res.state === "pre");
  if (cat.kind === "acca-hub") {
    const four = CATEGORIES.filter((c) => c.kind === "acca");
    const built = four.map((c) => ({ c, acca: buildAcca(upcoming, c.acca.target, c.acca.legs) }));
    count = built.filter((x) => x.acca).length;
    list = built.map(({ c, acca }) => accaHtml(c.name, acca, `/predictions/${c.slug}`)).join("");
  } else if (cat.kind === "acca") {
    const acca = buildAcca(upcoming, cat.acca.target, cat.acca.legs);
    count = acca ? 1 : 0;
    list = accaHtml(cat.name, acca);
  } else {
    const items = rankPicks(cat.slug, matches).slice(0, 40);
    count = items.length;
    const weak = items.length && items.every((x) => x.weak);
    const byDay = new Map();
    const order = (it) => (it.m.res?.state === "live" ? 0 : it.m.res?.state === "ft" ? 2 : 1);
    items.sort((a, b) => order(a) - order(b) || b.pct - a.pct);
    for (const it of items) {
      const k = dayKey(it.m.ts);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(it);
    }
    const today = todayKey();
    list = items.length
      ? (weak ? `<p class="mnote show">Nothing beats the market price by a clear margin right now, so these are the closest: the matches where the model is furthest above the market's own chance. Treat them as a watch list, not a recommendation.</p>` : "") + `<div class="toolbar single"><label class="search"><span class="sr">Search</span><input type="search" data-search placeholder="Search a team or league" autocomplete="off"></label></div>` +
        [...byDay.entries()].map(([k, arr]) => `<section class="lgblock"><h3 class="lghead"><span>${k === today ? "Today" : k === addDays(today, 1) ? "Tomorrow" : esc(shortDate(keyToTs(k)))}</span><span class="n">${arr.length}</span></h3>${arr.map(pickRow).join("")}</section>`).join("")
      : `<div class="empty">No matches meet this rule right now.<br>New picks appear as odds and probabilities refresh.</div>`;
  }
  const body = `${crumbs([["Home", "/"], ["Predictions", "/predictions"], [cat.name, path]])}
  ${pageHead(cat.h1, esc(cat.short), chip(count, isAcca(cat) ? (cat.kind === "acca-hub" ? "accas ready" : "acca ready") : "picks"))}
  ${list}
  <section class="prose"><h2>About ${esc(cat.name.toLowerCase())}</h2>${cat.intro.map((p) => `<p>${esc(p)}</p>`).join("")}</section>
  <section class="block"><div class="block-head"><h2>More prediction types</h2></div><div class="catgrid small">${others.map((c) => `<a class="catcard" href="/predictions/${c.slug}"><b>${esc(c.name)}</b><span>${esc(c.short)}</span></a>`).join("")}</div></section>
  ${faqHtml(cat.faq)}`;
  return {
    title: cat.title + ` | ${SITE_NAME}`, desc: cat.desc, path, body,
    ld: [crumbLd(ctx.origin, [["Home", "/"], ["Predictions", "/predictions"], [cat.name, path]]), faqLd(cat.faq)]
  };
}

export function leaguesPage(ctx, { leagues, counts }) {
  const body = `${crumbs([["Home", "/"], ["Leagues", "/leagues"]])}
  ${pageHead("Football leagues", "Pick a league for its table, upcoming matches and predictions.")}
  <div class="leaguegrid big">${leagues.map((l) => `<a class="lgcard" href="${leaguePath(l)}">${lgIcon(l)}<span>${esc(l.name)}</span><i>${counts.get(l.id) || 0}</i></a>`).join("")}</div>
  ${leagues.length ? "" : `<div class="empty">Leagues appear once matches are loaded.</div>`}`;
  return { title: `Football Leagues: Tables and Predictions | ${SITE_NAME}`, desc: "Browse football leagues with live tables, upcoming matches, odds and predictions.", path: "/leagues", body, ld: [crumbLd(ctx.origin, [["Home", "/"], ["Leagues", "/leagues"]])] };
}

function standingsTable(st) {
  if (!st || !st.groups.length) return "";
  return st.groups.map((g) => `<div class="tablewrap">${g.name ? `<div class="tblcap">${esc(g.name)}</div>` : ""}<table class="stand"><thead><tr><th>#</th><th class="l">Team</th><th>P</th><th>W</th><th>D</th><th>L</th><th class="hide-s">GF</th><th class="hide-s">GA</th><th>GD</th><th>Pts</th></tr></thead><tbody>${g.rows.map((r) => {
    const fb = esc(initials(r.team));
    return `<tr><td>${r.pos}</td><td class="l"><span class="team">${r.crest ? `<span class="crest"><img src="${esc(r.crest)}" alt="" loading="lazy" width="20" height="20" data-fb="${fb}"></span>` : `<span class="crest">${fb}</span>`}<span class="nm">${esc(r.team)}</span></span></td><td>${r.p ?? "–"}</td><td>${r.w ?? "–"}</td><td>${r.d ?? "–"}</td><td>${r.l ?? "–"}</td><td class="hide-s">${r.gf ?? "–"}</td><td class="hide-s">${r.ga ?? "–"}</td><td>${r.gd ?? "–"}</td><td class="pts">${r.pts ?? "–"}</td></tr>`;
  }).join("")}</tbody></table></div>`).join("");
}

export function leaguePage(ctx, { league, matches, standings, allLeagues }) {
  const path = leaguePath(league);
  const groups = groupByLeague(matches);
  const picks = rankPicks("banker-picks", matches).slice(0, 4);
  const table = standingsTable(standings);
  const st = leagueStory(league, matches, ctx, standings);
  const body = `${crumbs([["Home", "/"], ["Leagues", "/leagues"], [league.name, path]])}
  <header class="pagehead lghero">${lgIcon(league)}<div><h1>${esc(league.name)} predictions, odds and table</h1><p>${matches.length ? `${matches.length} upcoming matches with odds and model probabilities.` : "No upcoming matches are loaded for this league right now."}</p></div></header>
  ${picks.length ? `<section class="block"><div class="block-head"><h2>Best picks in ${esc(league.name)}</h2></div><div class="pickrail">${picks.map(pickCard).join("")}</div></section>` : ""}
  ${leaguePulse(league, matches, standings, ctx)}
  <section class="block"><div class="block-head"><h2>Upcoming matches</h2></div>${matches.length ? toolbar(groups) + groups.map((g) => leagueBlock(g)).join("") : `<div class="empty">Nothing scheduled in the next few days.</div>`}</section>
  <section class="block"><div class="block-head"><h2>${esc(league.name)} table</h2></div>${table || `<div class="empty">A table is not available for this league yet.</div>`}</section>
  <section class="block"><div class="block-head"><h2>Other leagues</h2></div><div class="leaguegrid">${allLeagues.filter((l) => l.id !== league.id).slice(0, 10).map((l) => `<a class="lgcard" href="${leaguePath(l)}">${lgIcon(l)}<span>${esc(l.name)}</span></a>`).join("")}</div></section>`;
  return {
    title: `${league.name} Predictions, Odds and Table | ${SITE_NAME}`,
    desc: `${league.name} predictions for ${longDate(Date.now())}: ${st.f.now.length ? `${st.f.now.length} live now, ` : ""}${st.f.today.length || st.f.ahead.length} to play${st.f.best ? `, top pick ${st.f.best.label} (${Math.round(st.f.best.pct)}%)` : ""}. Odds, over 2.5 goals, both teams to score and the latest table.`.slice(0, 300),
    path, body, ld: [crumbLd(ctx.origin, [["Home", "/"], ["Leagues", "/leagues"], [league.name, path]])]
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
      return `<div class="v4-fx"><div class="v4-fx-head"><span>${esc(m.home.name)} <em>v</em> ${esc(m.away.name)}</span><small class="mono">${esc(clock(m.ts))}</small></div><div class="v4-chance"><i class="h" style="width:${((h / t) * 100).toFixed(1)}%"></i><i class="d" style="width:${((d / t) * 100).toFixed(1)}%"></i><i class="a" style="width:${((a / t) * 100).toFixed(1)}%"></i></div><div class="v4-legend"><span>${Math.round(h)}% ${esc(abbr(m.home.name))}</span><span>${Math.round(d)}% X</span><span>${Math.round(a)}% ${esc(abbr(m.away.name))}</span></div></div>`;
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
        return `<div class="v4-fxc"><div class="v4-fxh"><span>${esc(m.home.name)} <i>v</i> ${esc(m.away.name)}</span><small class="mono">${esc(clock(m.ts))}</small></div>${tag}<div class="v4-chance"><i class="h" style="width:${((h / t) * 100).toFixed(1)}%"></i><i class="d" style="width:${((d / t) * 100).toFixed(1)}%"></i><i class="a" style="width:${((a / t) * 100).toFixed(1)}%"></i></div><div class="v4-legend"><span>${Math.round(h)}% ${esc(abbr(m.home.name))}</span><span>${Math.round(d)}% X</span><span>${Math.round(a)}% ${esc(abbr(m.away.name))}</span></div></div>`;
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
  return leagueLayoutHtml(league, matches, standings, ctx);
}

export function matchPage(ctx, { m, related, standings = null }) {
  const path = matchPath(m);
  const p = m.prediction;
  const mk = marketsOf(m);
  const b = bestSide(m);
  const bar = (label, pct) => num(pct) === null ? "" : `<div class="pbar"><span class="lbl">${esc(label)}</span><span class="bar"><i style="width:${Math.min(100, Math.round(pct))}%"></i></span><b>${Math.round(pct)}%</b></div>`;
  const rs = resOf(m);
  const hasScore = rs.h !== null && rs.h !== undefined;
  const sc = hasScore ? `<div class="big">${rs.h} - ${rs.a}</div>` : `<div class="big">${timeEl(m, "mono")}</div>`;
  const bs = topPick(m) || bestSide(m);
  const verdictState = bs ? pickState(m, bs.k) : null;
  const groupBlock = (title, list) => `<div class="mkgroup"><h3>${title}</h3><div class="mkgrid" style="--n:${list.length}">${list.map((d) => `<div class="mkcell">${oddBtn(m, d)}${num(d.pct) !== null ? `<small>Model ${Math.round(d.pct)}%</small>` : ""}</div>`).join("")}</div></div>`;
  const title = `${m.home.name} vs ${m.away.name} Prediction, Odds and Tips`;
  const nice = `${longDate(m.ts)}`;
  const body = `${crumbs([["Home", "/"], [m.league.name, m.league.id != null ? leaguePath(m.league) : "/leagues"], [`${m.home.name} vs ${m.away.name}`, path]])}
  <header class="mhead">
    <div class="mleague"><a href="${m.league.id != null ? leaguePath(m.league) : "/leagues"}">${lgIcon(m.league)}<span>${esc(m.league.name)}</span></a><span>${esc(nice)}</span></div>
    <div class="mteams"><div class="mt">${crest(m.home)}<span>${esc(m.home.name)}</span></div><div class="mmid">${sc}<small>${rs.state === "pre" ? "kick-off" : esc(rs.label)}</small></div><div class="mt">${crest(m.away)}<span>${esc(m.away.name)}</span></div></div>
    <h1>${esc(title)}</h1>
  </header>
  ${b ? `<section class="verdict"><div><small>Model pick</small><b>${esc(b.label)}</b></div><div class="vpct">${Math.round(b.pct)}<small>%</small></div>${verdictState ? `<div><small>Result</small><span class="pst ${verdictState}">${PICK_TXT[verdictState]}</span></div>` : ""}${b.odd ? `<div><small>Market odds</small><b class="mono">${fmtOdd(b.odd)}</b></div>` : ""}</section>` : ""}
  ${stageBlock(m, bs, verdictState)}
  ${p ? `<section class="block"><h2>Win probability</h2>${bar(m.home.name, p.home_win_pct)}${bar("Draw", p.draw_pct)}${bar(m.away.name, p.away_win_pct)}</section>` : ""}
  <section class="block"><h2>Odds and model chances</h2><p class="mnote show">Tap a price to add it to your pick slip.</p>
    ${groupBlock("Match result", mk["1x2"])}${groupBlock("Goals", mk.goals)}${groupBlock("Both teams to score", mk.btts)}${groupBlock("Double chance <small>(calculated)</small>", mk.dc)}
  </section>
  ${compareTable(m) ? `<section class="block"><h2>${esc(m.home.name)} vs ${esc(m.away.name)}: comparison</h2><div class="tablewrap">${compareTable(m)}</div><p class="mnote show">The greener side leads on that line. Edge is model chance × odds − 1.</p></section>` : ""}
  ${matchLayoutHtml(m, standings)}
  <details class="v4-more"><summary>Full match analysis<span>Tap to read</span></summary><div class="v4-prose">${analysis(m).map((t) => `<p>${esc(t)}</p>`).join("")}</div></details>
  ${related.length ? `<section class="block"><div class="block-head"><h2>More ${esc(m.league.name)} matches</h2></div>${related.map(matchRow).join("")}</section>` : ""}
  <section class="block"><div class="block-head"><h2>More prediction types</h2><a href="/predictions">All →</a></div><div class="catgrid small">${CATEGORIES.slice(0, 6).map((c) => `<a class="catcard" href="/predictions/${c.slug}"><b>${esc(c.name)}</b><span>${esc(c.short)}</span></a>`).join("")}</div></section>`;
  const iso = m.kickoff || undefined;
  return {
    title: `${title} | ${SITE_NAME}`,
    desc: `${m.home.name} vs ${m.away.name} (${m.league.name}, ${nice}): odds, win probability, goals and both teams to score predictions.${b ? ` Model pick: ${b.label} (${Math.round(b.pct)}%).` : ""}`,
    path, body,
    ld: [
      crumbLd(ctx.origin, [["Home", "/"], [m.league.name, m.league.id != null ? leaguePath(m.league) : "/leagues"], [`${m.home.name} vs ${m.away.name}`, path]]),
      { "@context": "https://schema.org", "@type": "SportsEvent", name: `${m.home.name} vs ${m.away.name}`, sport: "Football", startDate: iso, eventStatus: "https://schema.org/EventScheduled", homeTeam: { "@type": "SportsTeam", name: m.home.name }, awayTeam: { "@type": "SportsTeam", name: m.away.name }, url: ctx.origin + path }
    ]
  };
}

export function livePage(ctx, { live, upcoming = [] }) {
  const body = `${crumbs([["Home", "/"], ["Live scores", "/live"]])}
  ${pageHead("Live football scores", "Updates by itself every 15 seconds. Each card shows whether our pick is winning.")}
  <div id="liveList" data-live-page>${liveList(live)}</div>
  ${upcoming.length ? `<section class="block"><div class="block-head"><h2>Kicking off next</h2><a href="/football-predictions-today">All matches →</a></div><div class="reclist">${upcoming.slice(0, 6).map((m) => { const tp = topPick(m); return `<a class="rec" href="${matchPath(m)}"><span class="rec-lg">${esc(m.league.name)} · ${timeEl(m, "w-top")}</span><span class="rec-m"><span>${esc(m.home.name)}</span><b><i>v</i></b><span>${esc(m.away.name)}</span></span>${tp ? `<span class="rec-p"><span class="pkline"><small>Pick</small><b>${esc(tp.label)}</b><i>${Math.round(tp.pct)}%</i></span></span>` : ""}</a>`; }).join("")}</div></section>` : ""}`;
  return { title: `Live Football Scores | ${SITE_NAME}`, desc: "Live football scores from leagues around the world, updated every 30 seconds.", path: "/live", body, ld: [crumbLd(ctx.origin, [["Home", "/"], ["Live scores", "/live"]])] };
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
  return { title: p.title, desc: p.desc, path, body, ld: [crumbLd(ctx.origin, [["Home", "/"], [p.h1, path]])] };
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

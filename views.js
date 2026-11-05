// views.js - turns data into HTML pages (rendered on the server, so Google and phones get real content at once).

import {
  esc, num, fmtOdd, pctTxt, initials, clock, longDate, shortDate, dayKey, todayKey, addDays, keyToTs,
  matchPath, leaguePath, marketsOf, MARKET_TABS, groupByLeague, bestSide, edgeOf, rankPicks, buildAcca, byLeague
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

function oddBtn(m, d, extra = "") {
  const odd = num(d.odd);
  const ok = odd && odd > 1;
  return `<button type="button" class="odd${extra}" data-mid="${m.id}" data-k="${esc(d.k)}" data-odd="${ok ? odd.toFixed(2) : ""}" data-pick="${esc(d.pick)}" data-teams="${esc(m.home.name)} v ${esc(m.away.name)}"${d.calc ? ' data-calc="1"' : ""}${ok ? "" : " disabled"} aria-label="${esc(d.pick)} ${ok ? odd.toFixed(2) : "no price"}"><small>${esc(d.label)}</small><b>${d.calc && ok ? "~" : ""}${fmtOdd(odd)}</b></button>`;
}

const starBtn = (m) => `<button type="button" class="star" data-fav data-mid="${m.id}" data-home="${esc(m.home.name)}" data-away="${esc(m.away.name)}" data-league="${esc(m.league.name)}" data-ts="${m.ts}" data-path="${esc(matchPath(m))}" aria-label="Save ${esc(m.home.name)} v ${esc(m.away.name)}" aria-pressed="false">☆</button>`;

export function matchRow(m) {
  const mk = marketsOf(m);
  const b = bestSide(m);
  const groups = Object.entries(mk).map(([id, list]) =>
    `<div class="mk mk-${id}" style="--n:${list.length}">${list.map((d) => oddBtn(m, d, id === "1x2" && b && d.k === b.k && b.pct >= 45 ? " mp" : "")).join("")}</div>`).join("");
  return `<article class="mrow" data-search="${esc(`${m.home.name} ${m.away.name} ${m.league.name}`.toLowerCase())}">
    ${timeEl(m)}
    <a class="teams" href="${matchPath(m)}"><span class="team">${crest(m.home)}<span class="nm">${esc(m.home.name)}</span></span><span class="team">${crest(m.away)}<span class="nm">${esc(m.away.name)}</span></span></a>
    <div class="mks">${groups}</div>
    ${starBtn(m)}
  </article>`;
}

const MK_LABELS = { "1x2": ["1", "X", "2"], goals: ["O1.5", "O2.5", "U2.5", "O3.5"], btts: ["GG", "NG"], dc: ["1X", "12", "X2"] };
const mkHeader = () => `<span class="mkh">${Object.entries(MK_LABELS).map(([id, l]) => `<span class="mkh-${id}" style="--n:${l.length}">${l.map((x) => `<i>${x}</i>`).join("")}</span>`).join("")}</span>`;

function leagueBlock(g, { limit = 0, moreHref = "" } = {}) {
  const list = limit ? g.matches.slice(0, limit) : g.matches;
  const more = limit && g.matches.length > limit ? `<a class="seemore" href="${moreHref || leaguePath(g.league)}">All ${g.matches.length} matches in ${esc(g.league.name)} →</a>` : "";
  return `<section class="lgblock" id="lg-${esc(g.league.id ?? "x")}">
    <h3 class="lghead"><span class="lhl"><a href="${g.league.id != null ? leaguePath(g.league) : "#"}">${lgIcon(g.league)}<span>${esc(g.league.name)}</span></a><span class="n">${g.matches.length}</span></span>${mkHeader()}</h3>
    ${list.map(matchRow).join("")}${more}
  </section>`;
}

function toolbar(groups) {
  const tabs = MARKET_TABS.map((t, i) => `<button type="button" class="mtab${i === 0 ? " on" : ""}" data-market="${t.id}">${t.name}</button>`).join("");
  const jump = groups.length > 2
    ? `<nav class="lgjump" aria-label="Jump to a league">${groups.map((g) => `<a href="#lg-${esc(g.league.id ?? "x")}">${esc(g.league.name)} <b>${g.matches.length}</b></a>`).join("")}</nav>`
    : "";
  return `<div class="toolbar"><div class="mtabs" role="tablist" aria-label="Betting market">${tabs}</div>
    <label class="search"><span class="sr">Search</span><input type="search" data-search placeholder="Search a team or league" autocomplete="off"></label></div>${jump}
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

function catCards(counts = {}) {
  return `<div class="catgrid">${CATEGORIES.map((c) => `<a class="catcard" href="/predictions/${c.slug}"><b>${esc(c.name)}</b><span>${esc(c.short)}</span>${counts[c.slug] != null ? `<i>${counts[c.slug]} today</i>` : ""}</a>`).join("")}</div>`;
}

function pickCard(it) {
  return `<a class="pickcard" href="${matchPath(it.m)}">
    <span class="pk-top"><span>${esc(it.m.league.name)}</span>${timeEl(it.m, "mono")}</span>
    <span class="pk-teams"><span>${esc(it.m.home.name)}</span><i>vs</i><span>${esc(it.m.away.name)}</span></span>
    <span class="pk-foot"><span class="pk-says"><small>Model says</small><b>${esc(it.label)}</b>${it.odd ? `<small class="mono">Odds ${it.calc ? "~" : ""}${fmtOdd(it.odd)}</small>` : ""}</span><span class="pk-pct">${Math.round(it.pct)}<small>%</small></span></span>
  </a>`;
}

function pickRow(it) {
  const m = it.m;
  const e = it.edge;
  return `<article class="prow" data-search="${esc(`${m.home.name} ${m.away.name} ${m.league.name}`.toLowerCase())}">
    ${timeEl(m)}
    <a class="teams" href="${matchPath(m)}"><span class="team">${crest(m.home)}<span class="nm">${esc(m.home.name)}</span></span><span class="team">${crest(m.away)}<span class="nm">${esc(m.away.name)}</span></span><span class="lgline">${esc(m.league.name)}</span></a>
    <div class="pkcell"><b>${esc(it.label)}</b><span class="bar"><i style="width:${Math.min(100, Math.round(it.pct))}%"></i></span><small>${Math.round(it.pct)}% model chance${e !== null ? ` · edge <em class="${e > 0 ? "pos" : "neg"}">${e > 0 ? "+" : ""}${(e * 100).toFixed(1)}%</em>` : ""}</small></div>
    ${oddBtn(m, { k: it.k, label: it.k, odd: it.odd, pick: it.label, calc: it.calc })}
    ${starBtn(m)}
  </article>`;
}

function liveRow(m) {
  const sc = m.score || {};
  const min = num(m.minute);
  return `<article class="mrow live-row"><span class="when live">${min !== null ? `${min}'` : esc(m.period || "LIVE")}<small>LIVE</small></span>
    <a class="teams" href="${matchPath(m)}"><span class="team">${crest(m.home)}<span class="nm">${esc(m.home.name)}</span></span><span class="team">${crest(m.away)}<span class="nm">${esc(m.away.name)}</span></span></a>
    <div class="score"><b>${sc.home ?? "-"}</b><b>${sc.away ?? "-"}</b></div>${starBtn({ ...m, ts: m.ts })}</article>`;
}

export function liveList(live) {
  if (!live.length) return `<div class="empty">No matches are live right now.<br>Check back around kick-off time.</div>`;
  return groupByLeague(live).map((g) => `<section class="lgblock"><h3 class="lghead"><span>${lgIcon(g.league)}<span>${esc(g.league.name)}</span></span><span class="n">${g.matches.length}</span></h3>${g.matches.map(liveRow).join("")}</section>`).join("");
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
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="${SITE_NAME}">
<meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.desc)}"><meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary"><meta name="theme-color" content="#06090d">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%2306090d'/%3E%3Ccircle cx='32' cy='32' r='18' fill='none' stroke='%23b6ff3b' stroke-width='5'/%3E%3Ccircle cx='32' cy='32' r='6' fill='%23b6ff3b'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@500;600;700;800&family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
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
    <div class="foot-brand"><a class="logo" href="/"><span class="logo-mark" aria-hidden="true"></span><span>SPORTY<b>PREDICTZ</b></span></a><p>Football predictions, market odds and model probabilities in one fast place.</p></div>
    <div class="foot-col"><h5>Predictions</h5>${CATEGORIES.slice(0, 6).map((c) => `<a href="/predictions/${c.slug}">${esc(c.name)}</a>`).join("")}<a href="/predictions">See all tips</a></div>
    <div class="foot-col"><h5>Football</h5><a href="/football-predictions-today">Today's matches</a><a href="/football-predictions-tomorrow">Tomorrow's matches</a><a href="/live">Live scores</a><a href="/results">Results</a><a href="/leagues">All leagues</a>${topLeagues.map((l) => `<a href="${leaguePath(l)}">${esc(l.name)}</a>`).join("")}</div>
    <div class="foot-col"><h5>Site</h5><a href="/about">About us</a><a href="/how-it-works">How it works</a><a href="/responsible-gambling">Responsible gambling</a><a href="/terms">Terms of use</a><a href="/privacy">Privacy policy</a></div>
  </div>
  <div class="foot-bar"><p><b class="age-pill">18+</b> ${SITE_NAME} is an information site, not a bookmaker. It does not take bets. Odds come from a third-party source and can change at any time. Predictions are estimates, not guarantees. Bet only where it is legal and only what you can afford to lose.</p><span class="mono">&copy; ${new Date().getFullYear()} ${SITE_NAME}</span></div>
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
export function homePage(ctx, { matches, live, updatedAt }) {
  const today = todayKey();
  const todays = matches.filter((m) => dayKey(m.ts) === today);
  const pool = todays.length ? todays : matches;
  const groups = groupByLeague(pool);
  const picks = rankPicks("banker-picks", matches).slice(0, 8);
  const counts = {};
  for (const c of CATEGORIES) if (c.slug !== "accumulator-tips") counts[c.slug] = rankPicks(c.slug, todays.length ? todays : matches).length;
  const dayLabel = todays.length ? "today" : "coming up";
  const body = `
  ${pageHead(`Football predictions ${todays.length ? "today" : "this week"}`, `${esc(longDate(Date.now()))}. Odds and model probabilities for every match, with the picks the numbers like best.`,
    chip(pool.length, "matches") + chip(groups.length, "leagues") + chip(live.length, "live now"))}
  ${picks.length ? `<section class="block"><div class="block-head"><h2>Top picks right now</h2><a href="/predictions/banker-picks">All banker picks →</a></div><div class="pickrail">${picks.map(pickCard).join("")}</div></section>` : ""}
  <section class="block"><div class="block-head"><h2>Browse by bet type</h2><a href="/predictions">All categories →</a></div>${catCards(counts)}</section>
  <section class="block"><div class="block-head"><h2>Matches ${dayLabel}</h2><a href="/football-predictions-today">Full list →</a></div>
    ${pool.length ? toolbar(groups) + groups.slice(0, 5).map((g) => leagueBlock(g, { limit: 4, moreHref: "/football-predictions-today" })).join("") + (groups.length > 5 ? `<a class="btn solid wide" href="/football-predictions-today">See all ${pool.length} matches</a>` : "") : `<div class="empty">No matches loaded yet. Please refresh in a moment.</div>`}
  </section>
  <section class="block"><div class="block-head"><h2>Leagues</h2><a href="/leagues">All leagues →</a></div><div class="leaguegrid">${ctx.leagues.slice(0, 12).map((l) => `<a class="lgcard" href="${leaguePath(l)}">${lgIcon(l)}<span>${esc(l.name)}</span></a>`).join("")}</div></section>
  <section class="prose"><h2>How we make football predictions</h2>${HOME.how.map((p) => `<p>${esc(p)}</p>`).join("")}<p><a href="/how-it-works">Read how to read the numbers →</a></p></section>
  ${faqHtml(HOME.faq)}`;
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
  ${pageHead(`Football predictions ${label}`, `${esc(nice)}. ${list.length} matches across ${groups.length} leagues, each with the odds and the model's view. Pick a bet type below to switch the prices.`)}
  ${dayTabs(days, key)}
  ${list.length ? toolbar(groups) + groups.map((g) => leagueBlock(g)).join("") : `<div class="empty">No matches found for this day yet.<br>Try another day above.</div>`}
  <section class="prose"><h2>About these predictions</h2><p>Kick-off times are shown in your own time zone. Odds are a single market consensus price, and the model percentages are estimates. Tap any odds button to add it to your pick slip, or open a match for the full breakdown.</p></section>`;
  return {
    title: `Football Predictions ${key === today ? "Today" : key === addDays(today, 1) ? "Tomorrow" : nice}: Odds and Tips | ${SITE_NAME}`,
    desc: `Football predictions for ${nice}: ${list.length} matches with odds, win probabilities, over/under goals and both teams to score picks.`,
    path, body, ld: [crumbLd(ctx.origin, [["Home", "/"], [`Predictions ${label}`, path]])]
  };
}

export function hubPage(ctx, { matches }) {
  const counts = {};
  for (const c of CATEGORIES) if (c.slug !== "accumulator-tips") counts[c.slug] = rankPicks(c.slug, matches).length;
  const body = `${crumbs([["Home", "/"], ["Predictions", "/predictions"]])}
  ${pageHead("Football predictions by bet type", "Pick the kind of bet you like and see the matches the model rates best for it.")}
  ${catCards(counts)}`;
  return { title: `Football Predictions by Bet Type | ${SITE_NAME}`, desc: "Browse football predictions by bet type: banker picks, home wins, away wins, draws, over/under 2.5 goals, both teams to score, double chance, value bets and accumulator tips.", path: "/predictions", body, ld: [crumbLd(ctx.origin, [["Home", "/"], ["Predictions", "/predictions"]])] };
}

export function categoryPage(ctx, { cat, matches }) {
  const path = `/predictions/${cat.slug}`;
  const others = CATEGORIES.filter((c) => c.slug !== cat.slug);
  let list = "";
  let count = 0;
  if (cat.slug === "accumulator-tips") {
    const accas = [[2, 4, "2 odds acca"], [5, 7, "5 odds acca"]].map(([t, n, name]) => ({ name, acca: buildAcca(matches, t, n) }));
    count = accas.filter((a) => a.acca).length;
    list = accas.map(({ name, acca }) => acca
      ? `<section class="acca"><div class="acca-head"><h2>${name}</h2><span class="acca-total">Total odds <b>${acca.total.toFixed(2)}</b></span></div>
          ${acca.legs.map((l) => `<div class="leg">${timeEl(l.m)}<a href="${matchPath(l.m)}"><b>${esc(l.m.home.name)} v ${esc(l.m.away.name)}</b><small>${esc(l.label)} · ${Math.round(l.pct)}% model</small></a><span class="mono">${fmtOdd(l.odd)}</span></div>`).join("")}
          <button type="button" class="btn solid" data-acca='${esc(JSON.stringify(acca.legs.map((l) => ({ mid: l.m.id, k: l.k, odd: l.odd.toFixed(2), pick: l.label, teams: `${l.m.home.name} v ${l.m.away.name}` }))))}'>Add all to pick slip</button></section>`
      : `<section class="acca"><h2>${name}</h2><div class="empty">Not enough strong picks to build this acca right now.</div></section>`).join("");
  } else {
    const items = rankPicks(cat.slug, matches).slice(0, 40);
    count = items.length;
    const byDay = new Map();
    for (const it of items) {
      const k = dayKey(it.m.ts);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(it);
    }
    const today = todayKey();
    list = items.length
      ? `<div class="toolbar single"><label class="search"><span class="sr">Search</span><input type="search" data-search placeholder="Search a team or league" autocomplete="off"></label></div>` +
        [...byDay.entries()].map(([k, arr]) => `<section class="lgblock"><h3 class="lghead"><span>${k === today ? "Today" : k === addDays(today, 1) ? "Tomorrow" : esc(shortDate(keyToTs(k)))}</span><span class="n">${arr.length}</span></h3>${arr.map(pickRow).join("")}</section>`).join("")
      : `<div class="empty">No matches meet this rule right now.<br>New picks appear as odds and probabilities refresh.</div>`;
  }
  const body = `${crumbs([["Home", "/"], ["Predictions", "/predictions"], [cat.name, path]])}
  ${pageHead(cat.h1, "", chip(count, cat.slug === "accumulator-tips" ? "accas" : "picks"))}
  <div class="prose lead">${cat.intro.map((p) => `<p>${esc(p)}</p>`).join("")}</div>
  ${list}
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
  const body = `${crumbs([["Home", "/"], ["Leagues", "/leagues"], [league.name, path]])}
  <header class="pagehead lghero">${lgIcon(league)}<div><h1>${esc(league.name)} predictions, odds and table</h1><p>${matches.length ? `${matches.length} upcoming matches with odds and model probabilities.` : "No upcoming matches are loaded for this league right now."}</p></div></header>
  ${picks.length ? `<section class="block"><div class="block-head"><h2>Best picks in ${esc(league.name)}</h2></div><div class="pickrail">${picks.map(pickCard).join("")}</div></section>` : ""}
  <section class="block"><div class="block-head"><h2>Upcoming matches</h2></div>${matches.length ? toolbar(groups) + groups.map((g) => leagueBlock(g)).join("") : `<div class="empty">Nothing scheduled in the next few days.</div>`}</section>
  <section class="block"><div class="block-head"><h2>${esc(league.name)} table</h2></div>${table || `<div class="empty">A table is not available for this league yet.</div>`}</section>
  <section class="block"><div class="block-head"><h2>Other leagues</h2></div><div class="leaguegrid">${allLeagues.filter((l) => l.id !== league.id).slice(0, 10).map((l) => `<a class="lgcard" href="${leaguePath(l)}">${lgIcon(l)}<span>${esc(l.name)}</span></a>`).join("")}</div></section>`;
  return {
    title: `${league.name} Predictions, Odds and Table | ${SITE_NAME}`,
    desc: `${league.name} football predictions with odds, over/under goals and both teams to score picks for every upcoming match, plus the latest league table.`,
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

export function matchPage(ctx, { m, related }) {
  const path = matchPath(m);
  const p = m.prediction;
  const mk = marketsOf(m);
  const b = bestSide(m);
  const bar = (label, pct) => num(pct) === null ? "" : `<div class="pbar"><span class="lbl">${esc(label)}</span><span class="bar"><i style="width:${Math.min(100, Math.round(pct))}%"></i></span><b>${Math.round(pct)}%</b></div>`;
  const sc = m.score && m.score.home != null && m.score.home !== undefined ? `<div class="big">${m.score.home} - ${m.score.away}</div>` : `<div class="big">${timeEl(m, "mono")}</div>`;
  const groupBlock = (title, list) => `<div class="mkgroup"><h3>${title}</h3><div class="mkgrid" style="--n:${list.length}">${list.map((d) => `<div class="mkcell">${oddBtn(m, d)}${num(d.pct) !== null ? `<small>Model ${Math.round(d.pct)}%</small>` : ""}</div>`).join("")}</div></div>`;
  const title = `${m.home.name} vs ${m.away.name} Prediction, Odds and Tips`;
  const nice = `${longDate(m.ts)}`;
  const body = `${crumbs([["Home", "/"], [m.league.name, m.league.id != null ? leaguePath(m.league) : "/leagues"], [`${m.home.name} vs ${m.away.name}`, path]])}
  <header class="mhead">
    <div class="mleague"><a href="${m.league.id != null ? leaguePath(m.league) : "/leagues"}">${lgIcon(m.league)}<span>${esc(m.league.name)}</span></a><span>${esc(nice)}</span></div>
    <div class="mteams"><div class="mt">${crest(m.home)}<span>${esc(m.home.name)}</span></div><div class="mmid">${sc}<small>${m.score && m.score.home != null ? esc(m.status || "") : "kick-off"}</small></div><div class="mt">${crest(m.away)}<span>${esc(m.away.name)}</span></div></div>
    <h1>${esc(title)}</h1>
  </header>
  ${b ? `<section class="verdict"><div><small>Model pick</small><b>${esc(b.label)}</b></div><div class="vpct">${Math.round(b.pct)}<small>%</small></div>${b.odd ? `<div><small>Market odds</small><b class="mono">${fmtOdd(b.odd)}</b></div>` : ""}</section>` : ""}
  ${p ? `<section class="block"><h2>Win probability</h2>${bar(m.home.name, p.home_win_pct)}${bar("Draw", p.draw_pct)}${bar(m.away.name, p.away_win_pct)}</section>` : ""}
  <section class="block"><h2>Odds and model chances</h2><p class="mnote show">Tap a price to add it to your pick slip.</p>
    ${groupBlock("Match result", mk["1x2"])}${groupBlock("Goals", mk.goals)}${groupBlock("Both teams to score", mk.btts)}${groupBlock("Double chance <small>(calculated)</small>", mk.dc)}
  </section>
  ${compareTable(m) ? `<section class="block"><h2>${esc(m.home.name)} vs ${esc(m.away.name)}: comparison</h2><div class="tablewrap">${compareTable(m)}</div><p class="mnote show">The greener side leads on that line. Edge is model chance × odds − 1.</p></section>` : ""}
  <section class="prose"><h2>Match analysis</h2>${analysis(m).map((t) => `<p>${esc(t)}</p>`).join("")}</section>
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

export function livePage(ctx, { live }) {
  const body = `${crumbs([["Home", "/"], ["Live scores", "/live"]])}
  ${pageHead("Live football scores", "Scores update about every 30 seconds while you are on this page.")}
  <div id="liveList" data-live-page>${liveList(live)}</div>`;
  return { title: `Live Football Scores | ${SITE_NAME}`, desc: "Live football scores from leagues around the world, updated every 30 seconds.", path: "/live", body, ld: [crumbLd(ctx.origin, [["Home", "/"], ["Live scores", "/live"]])] };
}

export function resultsPage(ctx, { results }) {
  const groups = groupByLeague(results.map((m) => ({ ...m })));
  const rows = (g) => g.matches.sort((a, b) => b.ts - a.ts).map((m) => `<article class="mrow res-row"><span class="when"><time datetime="${esc(m.kickoff || "")}" data-t="dm">${shortDate(m.ts)}</time></span>
    <a class="teams" href="${matchPath(m)}"><span class="team">${crest(m.home)}<span class="nm">${esc(m.home.name)}</span></span><span class="team">${crest(m.away)}<span class="nm">${esc(m.away.name)}</span></span></a>
    <div class="score"><b>${m.score?.home ?? "-"}</b><b>${m.score?.away ?? "-"}</b></div><span class="ft">FT</span></article>`).join("");
  const body = `${crumbs([["Home", "/"], ["Results", "/results"]])}
  ${pageHead("Football results", "Final scores from the last couple of days.")}
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

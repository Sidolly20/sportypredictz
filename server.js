// server.js - SportyPredictz
// A real multi-page website: every page is built on the server, so phones and Google see full content at once.
// It talks to your odds-api using a key kept in an environment variable. Browsers never see the key.

import express from "express";
import compression from "compression";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { API_BASE, DEMO, status, upstreamBackoff, boardInfo, getBoard, getLive, getResults, getMatch, getStandings, standingsShape, startBoardLoop, UpstreamError, rememberFinished, getRecord, getWeekend, weekendKeys, dayKeyOf } from "./data.js";
import { dayKey, todayKey, addDays, matchPath, leaguePath, parseLeagueSlug, byLeague, slugify, annotate, scoreMap, rankPicks, marketsOf, esc } from "./logic.js";
import { CATEGORIES, CAT_BY_SLUG, PAGES, TEAMS, TEAM_BY_SLUG } from "./content.js";
import * as V from "./views.js";
import { logPicks, settleFinished, status as logStatus, LOG_ON } from "./pickLog.js";
import { storeStatus, startStoreJanitor, loadSnapshotNear, loadMatchesBetween } from "./store.js";
import { accaStatus, loadAccas, setAccaContext, resolveAcca, recordFor, addLeg, removeLeg, resetAuto } from "./accas.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = (process.env.SITE_URL || "").replace(/\/+$/, "");

// Search-engine ownership checks. Set these in Render > Environment (all optional):
//   GOOGLE_SITE_VERIFICATION = the code from Google's "HTML tag" method (the long text after content=), or the whole <meta> tag
//   GOOGLE_VERIFY_FILE       = the file name from Google's "HTML file" method, e.g. google1a2b3c4d5e6f.html
//   BING_SITE_VERIFICATION   = the code from Bing Webmaster Tools' meta tag method
const metaCode = (v) => { const t = String(v || "").trim(); const m = t.match(/content\s*=\s*["']([^"']+)["']/i); return (m ? m[1] : t).replace(/["'<>]/g, ""); };
const VERIFY = [];
if (process.env.GOOGLE_SITE_VERIFICATION) VERIFY.push(`<meta name="google-site-verification" content="${metaCode(process.env.GOOGLE_SITE_VERIFICATION)}">`);
if (process.env.BING_SITE_VERIFICATION) VERIFY.push(`<meta name="msvalidate.01" content="${metaCode(process.env.BING_SITE_VERIFICATION)}">`);
const VERIFY_FILE = (process.env.GOOGLE_VERIFY_FILE || "").trim().replace(/^\/+/, "");

app.set("trust proxy", true);
app.disable("x-powered-by");
app.use(compression());
// Security headers. The Content-Security-Policy only allows what this site actually loads:
// its own scripts and styles, Google Fonts, and images from anywhere over https (team and league crests).
// Set CSP_MODE=report in Render to test a change without blocking anything (violations are only logged by the browser).
const CSP = [
  "default-src 'self'",
  process.env.GOATCOUNTER_CODE ? "script-src 'self' https://gc.zgo.at" : "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  process.env.GOATCOUNTER_CODE ? `connect-src 'self' https://${process.env.GOATCOUNTER_CODE}.goatcounter.com` : "connect-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'"
].join("; ");
const CSP_HEADER = process.env.CSP_MODE === "report" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
app.use((req, res, next) => {
  res.set({
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "SAMEORIGIN",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    "Strict-Transport-Security": "max-age=31536000",
    [CSP_HEADER]: CSP
  });
  next();
});

// Version tag for the css/js files so phones always pick up new versions.
const ASSET_V = crypto.createHash("md5")
  .update(fs.readFileSync(path.join(__dirname, "styles.css")))
  .update(fs.readFileSync(path.join(__dirname, "app.js")))
  .digest("hex").slice(0, 8);

// Leagues we have seen. Kept in memory, in a small file, and rebuilt from the stored matches in Supabase
// (when it is connected), so popular leagues stay listed after a restart or on days with no fixtures.
const seenLeagues = new Map();
const LEAGUE_FILE = path.join(__dirname, ".league-cache.json");
try { for (const l of JSON.parse(fs.readFileSync(LEAGUE_FILE, "utf8"))) if (l && l.id != null) seenLeagues.set(l.id, l); } catch { /* first run */ }
let leagueFileAt = 0;
function saveLeagueFile() {
  if (Date.now() - leagueFileAt < 60000) return;
  leagueFileAt = Date.now();
  fs.writeFile(LEAGUE_FILE, JSON.stringify([...seenLeagues.values()]), () => {});
}
async function warmLeagues() {
  try {
    const list = await loadMatchesBetween(dayKey(Date.now() - 14 * 864e5), dayKey(Date.now() + 7 * 864e5));
    for (const m of list) if (m.league && m.league.id != null && !seenLeagues.has(m.league.id)) seenLeagues.set(m.league.id, { id: m.league.id, name: m.league.name, logo: m.league.logo || null });
    saveLeagueFile();
  } catch { /* the site works without it */ }
}
warmLeagues();
setInterval(warmLeagues, 60 * 60 * 1000).unref();

const withTimeout = (p, ms, fallback) => Promise.race([p, new Promise((r) => setTimeout(() => r(fallback), ms))]);

function makeCtx(req, board, live) {
  for (const m of board.matches) if (m.league.id != null) seenLeagues.set(m.league.id, m.league);
  saveLeagueFile();
  const leagues = [...seenLeagues.values()].sort(byLeague);
  const t = V.tickerHtml(live.matches || [], board.matches.filter((m) => !m.res || m.res.state === "pre"));
  return {
    origin: SITE_URL || `${req.protocol}://${req.get("host")}`,
    demo: DEMO, v: ASSET_V, leagues, ticker: t, liveCount: (live.matches || []).length, verify: VERIFY
  };
}

// Builds one page: gets the data, runs the page function, wraps it in the layout.
// Live matches, with our pick attached when the match is on the board.
function liveItems(matches, liveList) {
  const byId = new Map(matches.map((m) => [m.id, m]));
  return (liveList || []).map((l) => byId.get(l.id) || annotate([l], [l], [])[0]);
}

// Games that kicked off over 100 minutes ago but still have no final score in the live or results lists:
// ask odds-api for that match directly (at most 8 a page, cached by the odds-api client).
const lookedUp = new Map(); // match id -> when we last asked odds-api for its final score
async function finalScoresFor(matches, liveList, resultList) {
  const now = Date.now();
  if (upstreamBackoff()) return []; // odds-api is capped or failing: do not pile more calls on it
  const stuck = annotate(matches, liveList, resultList)
    .filter((m) => m.res.state === "wait" && m.ts && now - m.ts > 100 * 60e3 && now - m.ts < 24 * 3600e3 && now - (lookedUp.get(m.id) || 0) > 10 * 60e3)
    .slice(0, 4);
  for (const m of stuck) lookedUp.set(m.id, now);
  if (!stuck.length) return [];
  const got = await Promise.all(stuck.map((m) => withTimeout(getMatch(m.id).catch(() => null), 3000, null)));
  return got
    .filter((x) => x && x.score && x.score.home != null && x.score.away != null && (!x.status || /finish|ended|full|^ft$|after/i.test(String(x.status))))
    .map((x) => ({ id: x.id, score: x.score, status: x.status || "Full time" }));
}

function route(build, { maxAge = 60, needsBoard = false, needsRecord = false } = {}) {
  return async (req, res) => {
    try {
      const [board0, live, done0] = await Promise.all([getBoard(), withTimeout(getLive(), 4000, { matches: [] }), withTimeout(getResults(), 4000, { results: [] })]);
      const done = { ...done0, results: [...(done0.results || []), ...(await finalScoresFor(board0.matches, live.matches, done0.results))] };
      const board = { ...board0, matches: annotate(board0.matches, live.matches, done.results) };
      rememberFinished(board.matches);
      const ctx = makeCtx(req, board, live);
      ctx.liveItems = liveItems(board.matches, live.matches);
      if (needsRecord) ctx.record = await getRecord();
      logPicks(board.matches); settleFinished(board.matches);
      ctx.scoresFor = (m) => annotate([m], live.matches, done.results)[0];
      setAccaContext({ matches: board.matches, scoresFor: ctx.scoresFor });
      if (needsBoard && !board.matches.length) {
        // No matches yet (odds-api is probably waking up). Show a friendly page that reloads itself.
        return res.status(503).set({ "Cache-Control": "no-store", "Retry-After": "20" }).type("html").send(V.layout(ctx, V.warmingPage()));
      }
      const pg = await build({ req, res, ctx, board, live });
      if (!pg) return send404(req, res, ctx);
      res.status(pg.status || 200).set("Cache-Control", `public, max-age=${maxAge}`).type("html").send(V.layout(ctx, pg));
    } catch (err) {
      console.error("Page error:", req.path, err.message);
      try {
        const ctx = { origin: SITE_URL || `${req.protocol}://${req.get("host")}`, demo: DEMO, v: ASSET_V, leagues: [], ticker: { label: "NEXT UP", items: "" }, liveCount: 0, verify: VERIFY };
        res.status(503).set("Cache-Control", "no-store").type("html").send(V.layout(ctx, V.errorPage()));
      } catch { res.status(503).send("Please try again in a minute."); }
    }
  };
}

function send404(req, res, ctx) {
  res.status(404).set("Cache-Control", "no-store").type("html").send(V.layout(ctx, V.notFoundPage()));
}

const dayList = (board) => {
  const today = todayKey();
  const keys = new Set([today, addDays(today, 1)]);
  for (const m of board.matches) {
    const k = dayKey(m.ts);
    if (k >= today && k <= addDays(today, 2)) keys.add(k);
  }
  return [...keys].sort();
};

// ---------- pages ----------
app.get("/", route(({ ctx, board, live }) => V.homePage(ctx, { matches: board.matches, live: live.matches || [], updatedAt: board.updatedAt }), { needsBoard: true, needsRecord: true, maxAge: 20 }));

app.get("/football-predictions-today", route(({ ctx, board }) => V.dayPage(ctx, { matches: board.matches, days: dayList(board), key: todayKey() }), { needsBoard: true }));
app.get("/football-predictions-tomorrow", route(({ ctx, board }) => V.dayPage(ctx, { matches: board.matches, days: dayList(board), key: addDays(todayKey(), 1) }), { needsBoard: true }));
app.get("/football-predictions/:date", route(({ req, ctx, board }) => {
  const key = req.params.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || !dayList(board).includes(key)) return null;
  return V.dayPage(ctx, { matches: board.matches, days: dayList(board), key });
}, { needsBoard: true }));

app.get("/predictions", route(({ ctx, board }) => V.hubPage(ctx, { matches: board.matches }), { needsBoard: true }));
app.get("/predictions/weekend-match-predictions", route(async ({ ctx, board }) => {
  const { weekKey, days } = weekendKeys();
  const frozen = await withTimeout(getWeekend(weekKey, days), 20000, []);
  // Friday to Sunday come from the frozen weekend list; the rest of the board is added as well.
  const merged = new Map();
  for (const m of board.matches) merged.set(m.id, m);
  for (const m of frozen) merged.set(m.id, m);
  const matches = [...merged.values()].map(ctx.scoresFor);
  const results = (await withTimeout(getResults(), 6000, { results: [] })).results || [];
  return V.weekendPage(ctx, { matches, results });
}, { needsBoard: true }));
app.get("/predictions/:slug", route(({ req, ctx, board }) => {
  const cat = CAT_BY_SLUG[req.params.slug];
  if (!cat) return null;
  const page = V.categoryPage(ctx, { cat, matches: board.matches });
  // Thin page: a tip page with no picks yet is kept out of Google until it has real content.
  const picks = cat.kind === "acca" || cat.kind === "acca-hub" ? null : rankPicks(cat.slug, board.matches).filter((x) => !x.weak).length;
  if (page && picks === 0) page.noindex = true;
  return page;
}, { needsBoard: true }));

app.get("/leagues", route(({ ctx, board }) => {
  const counts = new Map();
  for (const m of board.matches) counts.set(m.league.id, (counts.get(m.league.id) || 0) + 1);
  return V.leaguesPage(ctx, { leagues: ctx.leagues, counts });
}, { needsBoard: true }));
app.get("/teams", route(({ ctx }) => V.teamsIndexPage(ctx, { teams: TEAMS }), { maxAge: 3600 }));
app.get("/team/:slug", route(async ({ req, ctx, board }) => {
  const team = TEAM_BY_SLUG[req.params.slug];
  if (!team) return null;
  const matches = V.teamMatches(board.matches, team);
  const done = await withTimeout(getResults(), 4000, { results: [] });
  const past = V.teamMatches(done.results || [], team);
  const leagues = [...new Map([...matches, ...past].filter((m) => m.league).map((m) => [m.league.id, m.league])).values()].slice(0, 2);
  const tables = await Promise.all(leagues.map(async (league) => ({ league, standings: await withTimeout(getStandings(league.id).catch(() => null), 4000, null) })));
  return V.teamPage(ctx, { team, matches, past, tables });
}, { maxAge: 300, needsBoard: false }));
app.get("/leagues/:slug", route(async ({ req, ctx, board }) => {
  const id = parseLeagueSlug(req.params.slug);
  const league = id != null ? seenLeagues.get(id) : null;
  if (!league) return null;
  const matches = board.matches.filter((m) => m.league.id === id).map(ctx.scoresFor);
  const standings = await withTimeout(getStandings(league), 12000, null);
  const seenIds = new Set(matches.map((m) => m.id));
  const recent = ((await withTimeout(getResults(), 6000, { results: [] })).results || [])
    .filter((x) => x.league && x.league.id === id && !seenIds.has(x.id)).map(ctx.scoresFor);
  const snapshot = await withTimeout(loadSnapshotNear(id, 7), 4000, null);
  return V.leaguePage(ctx, { league, matches, standings, allLeagues: ctx.leagues, recent, snapshot });
}));

app.get("/match/:id/:slug?", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return next();
  try {
    await getBoard(); // on a cold start, load the board first so the match can be found
    const m = await getMatch(id);
    if (m && req.params.slug !== slugify(`${m.home.name} vs ${m.away.name}`)) return res.redirect(301, matchPath(m));
    return route(async ({ ctx, board }) => {
      if (!m) return null;
      const related = board.matches.filter((x) => x.league.id === m.league.id && x.id !== m.id).slice(0, 5);
      const standings = await withTimeout(getStandings(m.league), 4000, null);
      const later = board.matches.filter((x) => x.ts > m.ts && x.id !== m.id).sort((x, y) => x.ts - y.ts);
      const nextFor = {
        home: later.find((x) => x.home.name === m.home.name || x.away.name === m.home.name) || null,
        away: later.find((x) => x.home.name === m.away.name || x.away.name === m.away.name) || null
      };
      return V.matchPage(ctx, { m: ctx.scoresFor(m), related, standings, nextFor });
    }, { maxAge: 45 })(req, res);
  } catch (err) {
    console.error("Match error:", err.message);
    return route(() => ({ ...V.errorPage(), status: 503 }), { maxAge: 0 })(req, res);
  }
});

app.get("/track-record", route(({ ctx }) => V.trackRecordPage(ctx, { record: ctx.record }), { maxAge: 300, needsRecord: true }));
app.get("/live", route(({ ctx, board }) => V.livePage(ctx, { live: ctx.liveItems, upcoming: board.matches.filter((m) => !m.res || m.res.state === "pre") }), { maxAge: 10 }));
app.get("/results", route(async ({ ctx }) => V.resultsPage(ctx, { results: (await getResults()).results || [] }), { maxAge: 60, needsRecord: true }));
app.get("/advertise", route(({ ctx }) => V.advertisePage(ctx), { maxAge: 3600 }));
app.get("/favourites", route(({ ctx }) => V.favouritesPage(ctx), { maxAge: 300 }));
for (const slug of Object.keys(PAGES)) app.get(`/${slug}`, route(({ ctx }) => V.staticPage(ctx, slug), { maxAge: 3600 }));

// ---------- small JSON endpoints for the browser ----------
app.get("/api/live", async (req, res) => {
  const [board0, live, done] = await Promise.all([getBoard(), getLive(), withTimeout(getResults(), 4000, { results: [] })]);
  const list = live.matches || [];
  const matches = annotate(board0.matches, list, done.results);
  rememberFinished(matches);
  const items = liveItems(matches, list);
  res.set("Cache-Control", "no-store").json({
    count: list.length,
    ticker: V.tickerHtml(list, matches.filter((m) => m.res.state === "pre")),
    list: V.liveList(items),
    scores: scoreMap(matches)
  });
});

app.get("/api/status", (req, res) => {
  res.json({ mode: DEMO ? "demo" : "live", upstream: API_BASE.replace(/^https?:\/\//, ""), assets: ASSET_V, board: boardInfo(), store: storeStatus, accas: accaStatus, pickLog: LOG_ON ? logStatus : "off (set SUPABASE_URL and SUPABASE_SERVICE_KEY to turn on)", ...status });
});

// Debug: shows the SHAPE of a league table from odds-api (no keys, no secrets). Handy if a table looks empty.
app.get("/api/debug/standings/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be a number" });
  try { res.json(await standingsShape(id)); }
  catch (err) { res.status(502).json({ error: err instanceof UpstreamError ? `odds-api answered ${err.code}` : err.message }); }
});

if (/^google[a-z0-9]+\.html$/i.test(VERIFY_FILE)) {
  app.get(`/${VERIFY_FILE}`, (req, res) => res.type("text/html").send(`google-site-verification: ${VERIFY_FILE}`));
}

// ---------- admin: set the accumulators by hand ----------
// Needs ADMIN_PASSWORD in Render > Environment. Without it the page stays switched off.
const ADMIN_PW = process.env.ADMIN_PASSWORD || "";
const ADMIN_TOKEN = ADMIN_PW ? crypto.createHmac("sha256", ADMIN_PW).update("sportypredictz-admin-v1").digest("hex") : "";
const sameStr = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const cookieOf = (req, name) => { for (const part of String(req.headers.cookie || "").split(";")) { const i = part.indexOf("="); if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim()); } return ""; };
const isAdmin = (req) => !!ADMIN_TOKEN && sameStr(cookieOf(req, "sp_admin"), ADMIN_TOKEN);
const loginTries = new Map();
const adminForm = express.urlencoded({ extended: false, limit: "20kb" });
const ACCA_CATS = CATEGORIES.filter((c) => c.kind === "acca");
const ADMIN_CATS = [["1", "Home win"], ["X", "Draw"], ["2", "Away win"], ["1X", "Home or draw"], ["X2", "Draw or away"], ["12", "Home or away"], ["O1.5", "Over 1.5 goals"], ["O2.5", "Over 2.5 goals"], ["U2.5", "Under 2.5 goals"], ["O3.5", "Over 3.5 goals"], ["U3.5", "Under 3.5 goals"], ["GG", "Both teams to score"], ["NG", "Both teams to score: No"]];

async function adminData() {
  const [board0, live, done0] = await Promise.all([getBoard(), withTimeout(getLive(), 4000, { matches: [] }), withTimeout(getResults(), 4000, { results: [] })]);
  const board = { ...board0, matches: annotate(board0.matches, live.matches, done0.results) };
  const scoresFor = (m) => annotate([m], live.matches, done0.results)[0];
  setAccaContext({ matches: board.matches, scoresFor });
  return { board, live, scoresFor, upcoming: board.matches.filter((m) => !m.res || m.res.state === "pre") };
}
function sendAdmin(req, res, ctx, body, title = "Admin") {
  res.status(200).set({ "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" }).type("html")
    .send(V.layout(ctx, { title: `${title} | SportyPredictz`, desc: "Admin", path: "/admin", body, noindex: true }));
}
const adminBox = (inner) => `<div class="wrap" style="max-width:760px;margin:24px auto;padding:0 14px">${inner}</div>`;
const adminLogin = (msg = "") => adminBox(`<h1>Admin</h1>${msg ? `<p>${esc(msg)}</p>` : ""}<form method="post" action="/admin/login"><p><label>Password<br><input type="password" name="pw" autocomplete="current-password" required></label></p><p><button class="btn solid" type="submit">Log in</button></p></form>`);

app.get("/admin", async (req, res) => {
  try {
    const d = await adminData();
    const ctx = makeCtx(req, d.board, d.live);
    if (!ADMIN_PW) return sendAdmin(req, res, ctx, adminBox(`<h1>Admin is off</h1><p>Add an environment variable called <b>ADMIN_PASSWORD</b> in Render (Environment tab), save, and open this page again.</p>`));
    if (!isAdmin(req)) return sendAdmin(req, res, ctx, adminLogin());
    const soon = d.upcoming.filter((m) => dayKey(m.ts) <= addDays(todayKey(), 1)).sort((a, b) => a.ts - b.ts);
    const when = (m) => new Date(m.ts).toLocaleString("en-GB", { timeZone: process.env.SITE_TZ || "Africa/Lagos", weekday: "short", hour: "2-digit", minute: "2-digit" });
    const eligible = (k) => soon.map((m) => ({ m, d: Object.values(marketsOf(m)).flat().find((x) => x.k === k && Number(x.odd) > 1) }))
      .filter((x) => x.d).sort((a, b) => (Number(b.d.pct) || 0) - (Number(a.d.pct) || 0));
    const sections = ACCA_CATS.map((c) => {
      const a = resolveAcca(c, d.upcoming);
      const rec = recordFor(c.slug);
      const legs = a ? a.legs.map((l) => `<li>${esc(l.m.home.name)} v ${esc(l.m.away.name)}: <b>${esc(l.label)}</b> @ ${Number(l.odd).toFixed(2)}${l.m.res && l.m.res.state !== "pre" ? ` <em>(${esc(l.m.res.label)})</em>` : ""}
        <form method="post" action="/admin/remove" style="display:inline"><input type="hidden" name="slug" value="${esc(c.slug)}"><input type="hidden" name="mid" value="${esc(l.m.id)}"><button type="submit">Remove</button></form></li>`).join("") : "";
      return `<section id="${esc(c.slug)}" style="margin:26px 0;padding:14px;border:1px solid var(--line);border-radius:14px"><h2>${esc(c.name)}</h2>
        <p>${a ? `${a.legs.length} legs · total odds <b>${a.total.toFixed(2)}</b> · ${rec && rec.mode === "manual" ? "<b>hand-picked</b>" : "built automatically"}` : "No slip yet (not enough games with prices)."}</p>
        ${legs ? `<ol>${legs}</ol>` : ""}
        <form method="get" action="/admin#${esc(c.slug)}"><input type="hidden" name="slug" value="${esc(c.slug)}">
          <p><select name="cat" style="max-width:100%">${ADMIN_CATS.map(([k, label]) => `<option value="${esc(k)}"${req.query.slug === c.slug && req.query.cat === k ? " selected" : ""}>${esc(label)}</option>`).join("")}</select>
          <button type="submit">Show games</button></p></form>
        ${req.query.slug === c.slug && ADMIN_CATS.some(([k]) => k === req.query.cat) ? (() => {
          const list = eligible(String(req.query.cat));
          return list.length ? `<p>${list.length} games for this bet (strongest first). Tap Add on the ones you want.</p><ul style="list-style:none;padding:0">${list.map(({ m, d: x }) => `<li style="margin:8px 0;padding:8px;border:1px solid var(--line);border-radius:10px"><b>${esc(m.home.name)} v ${esc(m.away.name)}</b><br><small>${esc(m.league.name)} · ${esc(when(m))}</small><br>${esc(x.pick)} @ ${Number(x.odd).toFixed(2)}${Number.isFinite(Number(x.pct)) ? ` · model ${Math.round(x.pct)}%` : ""}
            <form method="post" action="/admin/add" style="display:inline"><input type="hidden" name="slug" value="${esc(c.slug)}"><input type="hidden" name="cat" value="${esc(req.query.cat)}"><input type="hidden" name="choice" value="${m.id}|${esc(x.k)}"><button class="btn solid" type="submit">Add</button></form></li>`).join("")}</ul>` : `<p>No games with a price for this bet yet (today and tomorrow, not started). Try another bet, or check again later.</p>`;
        })() : ""}
        ${rec && rec.mode === "manual" ? `<form method="post" action="/admin/reset"><input type="hidden" name="slug" value="${esc(c.slug)}"><button type="submit">Go back to the automatic slip</button></form>` : ""}
      </section>`;
    }).join("");
    sendAdmin(req, res, ctx, adminBox(`<h1>Admin: accumulators</h1><p>A hand-picked slip replaces the automatic one for today. Adding a pick keeps the legs already there. Picking a second bet from the same game replaces the first. Today's slips only; tomorrow starts automatic again.</p>${sections}<form method="post" action="/admin/logout"><button type="submit">Log out</button></form>`), "Admin accumulators");
  } catch (e) { console.error("Admin error:", e.message); res.status(500).send("Admin page error"); }
});
app.post("/admin/login", adminForm, async (req, res) => {
  const ip = req.ip || "x", now = Date.now();
  const t = (loginTries.get(ip) || []).filter((x) => now - x < 10 * 60e3);
  if (!ADMIN_PW || t.length >= 6) return res.status(429).send("Too many tries. Wait ten minutes.");
  if (!sameStr(crypto.createHash("sha256").update(String(req.body.pw || "")).digest("hex"), crypto.createHash("sha256").update(ADMIN_PW).digest("hex"))) {
    loginTries.set(ip, [...t, now]);
    return res.status(401).set("Cache-Control", "no-store").send("Wrong password. Go back and try again.");
  }
  res.set("Set-Cookie", `sp_admin=${ADMIN_TOKEN}; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=${30 * 86400}${req.protocol === "https" ? "; Secure" : ""}`);
  res.redirect(303, "/admin");
});
app.post("/admin/logout", adminForm, (req, res) => {
  res.set("Set-Cookie", "sp_admin=; Path=/admin; HttpOnly; SameSite=Strict; Max-Age=0");
  res.redirect(303, "/admin");
});
const adminAction = (fn) => [adminForm, async (req, res) => {
  if (!isAdmin(req)) return res.status(401).send("Please log in at /admin first.");
  try {
    const cat = ACCA_CATS.find((c) => c.slug === req.body.slug);
    if (!cat) return res.status(400).send("Unknown accumulator.");
    const d = await adminData();
    const ok = fn(cat, d, req.body);
    const back = ADMIN_CATS.some(([k]) => k === req.body.cat) ? `/admin?slug=${encodeURIComponent(cat.slug)}&cat=${encodeURIComponent(req.body.cat)}#${cat.slug}` : `/admin#${cat.slug}`;
    res.redirect(303, ok === false ? "/admin?e=1" : back);
  } catch (e) { console.error("Admin action:", e.message); res.status(500).send("Admin action failed"); }
}];
app.post("/admin/add", ...adminAction((cat, d, b) => {
  const [mid, k] = String(b.choice || "").split("|");
  const m = d.upcoming.find((x) => String(x.id) === mid);
  return m ? addLeg(cat, d.upcoming, m, k) : false;
}));
app.post("/admin/remove", ...adminAction((cat, d, b) => removeLeg(cat, d.upcoming, b.mid)));
app.post("/admin/reset", ...adminAction((cat) => { resetAuto(cat); }));


app.get("/healthz", (req, res) => res.send("ok"));

// ---------- search-engine files ----------
app.get("/robots.txt", (req, res) => {
  const origin = SITE_URL || `${req.protocol}://${req.get("host")}`;
  res.type("text/plain").send(DEMO
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /admin\nDisallow: /favourites\n\nSitemap: ${origin}/sitemap.xml\n`);
});

app.get("/sitemap.xml", async (req, res) => {
  const origin = SITE_URL || `${req.protocol}://${req.get("host")}`;
  const board = await getBoard();
  const today = todayKey();
  const urls = [
    ["/", 1.0], ["/build-slip", 0.9], ["/football-predictions-today", 0.9], ["/football-predictions-tomorrow", 0.9], ["/predictions", 0.8],
    ...CATEGORIES.filter((c) => c.kind === "acca" || c.kind === "acca-hub" || rankPicks(c.slug, board.matches.filter((m) => !m.res || m.res.state === "pre")).length >= 3).map((c) => [`/predictions/${c.slug}`, 0.8]),
    ["/predictions/weekend-match-predictions", 0.9],
    ["/leagues", 0.7], ["/results", 0.5], ["/track-record", 0.6], ["/advertise", 0.3],
    ...Object.keys(PAGES).map((s) => [`/${s}`, 0.3]),
    ...[...seenLeagues.values()].map((l) => [leaguePath(l), 0.6]),
    ["/teams", 0.6],
    ...TEAMS.filter((t) => V.teamMatches(board.matches, t).length >= 2).map((t) => [`/team/${t.slug}`, 0.6]),
    ...board.matches.filter((m) => m.prediction && m.odds?.home_win && m.res?.state !== "live").slice(0, 400).map((m) => [matchPath(m), 0.5, dayKey(m.ts)])
  ];
  const day = today;
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([p, pr, lm]) => `<url><loc>${origin}${p}</loc><lastmod>${lm || day}</lastmod><priority>${pr}</priority></url>`).join("\n")}\n</urlset>`);
});

// ---------- brand assets, install manifest, AI-readable summary ----------
app.use("/assets", express.static(path.join(__dirname, "assets"), { maxAge: "30d", immutable: false }));

app.get("/site.webmanifest", (req, res) => {
  res.type("application/manifest+json").set("Cache-Control", "public, max-age=86400").send(JSON.stringify({
    name: "SportyPredictz",
    short_name: "SportyPredictz",
    description: "Football predictions, odds, live scores and results.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0a1020",
    theme_color: "#0a1020",
    icons: [
      { src: "/assets/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/assets/icon-512.png", sizes: "512x512", type: "image/png" }
    ]
  }, null, 2));
});

app.get("/llms.txt", (req, res, next) => {
  if (DEMO) return next();
  const origin = SITE_URL || `${req.protocol}://${req.get("host")}`;
  res.type("text/plain").set("Cache-Control", "public, max-age=86400").send([
    "# SportyPredictz",
    "",
    "> Free football predictions for today and tomorrow. Each match shows the bookmaker-consensus odds, a model win probability and a pick where the numbers are strong enough. Live scores and final results are published as they happen.",
    "",
    "SportyPredictz is an information site. It does not take bets and does not guarantee any result. Odds are a single market consensus price, not a bookmaker-by-bookmaker comparison.",
    "",
    "## Main pages",
    `- [Predictions today](${origin}/football-predictions-today): today's matches with odds and picks`,
    `- [Predictions tomorrow](${origin}/football-predictions-tomorrow): tomorrow's matches`,
    `- [Predictions by bet type](${origin}/predictions): 1X2, over/under, both teams to score, double chance and accumulators`,
    `- [Leagues](${origin}/leagues): every league with fixtures, standings and recent results`,
    `- [Live scores](${origin}/live): matches in play`,
    `- [Results](${origin}/results): latest final scores`,
    "",
    "## Policies",
    `- [How predictions work](${origin}/how-it-works)`,
    `- [Terms of use](${origin}/terms)`,
    `- [Privacy policy](${origin}/privacy)`,
    `- [Responsible gambling](${origin}/responsible-gambling)`,
    "",
    "Sitemap: " + `${origin}/sitemap.xml`
  ].join("\n") + "\n");
});

// ---------- the two browser files ----------
const sendAsset = (file, type) => (req, res) => {
  res.type(type).set("Cache-Control", req.query.v ? "public, max-age=31536000, immutable" : "public, max-age=300");
  res.sendFile(file, { root: __dirname });
};
app.get("/styles.css", sendAsset("styles.css", "text/css"));
app.get("/app.js", sendAsset("app.js", "application/javascript"));
app.get("/scout.js", sendAsset("scout.js", "application/javascript"));
app.get("/slip.js", sendAsset("slip.js", "application/javascript"));
app.get("/slip-engine.js", sendAsset("slip-engine.js", "application/javascript"));

// Data for the AI slip builder: upcoming matches with their prices and model chances. No keys, no personal data.
const SLIP_ODDS = ["home_win", "draw", "away_win", "over_15_goals", "over_25_goals", "under_25_goals", "over_35_goals", "under_35_goals", "btts_yes", "btts_no"];
const SLIP_PRED = ["home_win_pct", "draw_pct", "away_win_pct", "over_15_pct", "over_25_pct", "over_35_pct", "btts_yes_pct"];
const keep = (obj, keys) => Object.fromEntries(keys.filter((k) => obj && obj[k] !== undefined && obj[k] !== null).map((k) => [k, obj[k]]));
app.get("/api/slip-data", async (req, res, next) => {
  try {
    const board = await getBoard();
    const today = todayKey(), tomorrow = addDays(today, 1);
    const matches = board.matches
      .filter((m) => m.odds && m.prediction && (!m.res || m.res.state === "pre") && m.ts - Date.now() > 15 * 60 * 1000 && [today, tomorrow].includes(dayKeyOf(m.ts)))
      .map((m) => ({ id: m.id, lg: m.league?.name || "", h: m.home.name, a: m.away.name, t: m.kickoff || new Date(m.ts).toISOString(), d: dayKeyOf(m.ts), o: keep(m.odds, SLIP_ODDS), p: keep(m.prediction, SLIP_PRED) }));
    res.set("Cache-Control", "public, max-age=120").json({ today, tomorrow, demo: !!DEMO, updatedAt: board.updatedAt, matches });
  } catch (e) { next(e); }
});
app.get("/build-slip", route(({ ctx }) => V.slipPage(ctx), { maxAge: 300 }));

// anything else
const INDEXNOW_KEY = (process.env.INDEXNOW_KEY || "3f9c1a7e5b2d4f8a9c6e0b1d2f3a4b5c").replace(/[^a-z0-9-]/gi, "").slice(0, 128);
app.get(`/${INDEXNOW_KEY}.txt`, (req, res) => res.type("text/plain").send(INDEXNOW_KEY));
app.use(route(() => null));


// IndexNow: tells Bing, Yandex and others when pages change, so they are found sooner. The key is public by design.
async function pingIndexNow() {
  if (DEMO || !SITE_URL) return;
  try {
    const host = new URL(SITE_URL).host;
    const board = await getBoard();
    const today = todayKey(), tomorrow = addDays(today, 1);
    const urls = [
      `${SITE_URL}/`, `${SITE_URL}/football-predictions-today`, `${SITE_URL}/football-predictions-tomorrow`,
      `${SITE_URL}/predictions/weekend-match-predictions`,
      ...CATEGORIES.filter((c) => c.kind !== "acca" && c.kind !== "acca-hub").map((c) => `${SITE_URL}/predictions/${c.slug}`),
      ...TEAMS.map((t) => `${SITE_URL}/team/${t.slug}`),
      ...board.matches.filter((m) => m.prediction && [today, tomorrow].includes(dayKeyOf(m.ts))).slice(0, 200).map((m) => `${SITE_URL}${matchPath(m)}`)
    ];
    const r = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ host, key: INDEXNOW_KEY, keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`, urlList: urls.slice(0, 10000) })
    });
    status.indexnow = { at: new Date().toISOString(), sent: urls.length, http: r.status };
  } catch (err) { status.indexnow = { at: new Date().toISOString(), error: err.message }; }
}
setInterval(pingIndexNow, 60 * 60 * 1000).unref();

app.listen(PORT, () => {
  console.log(`SportyPredictz running on port ${PORT}`);
  console.log(DEMO ? "ODDS_API_KEY_SPORTY is not set: showing DEMO data (and hiding from Google)." : `Using odds-api at ${API_BASE}`);
  startBoardLoop();
  setTimeout(pingIndexNow, 90 * 1000).unref();
  startStoreJanitor();
  loadAccas();
  // Every 3 minutes, even with no visitors: save picks before kick-off and settle finished matches.
  const tick = async () => {
    try {
      const [b0, live, done] = await Promise.all([getBoard(), getLive(), getResults()]);
      const matches = annotate(b0.matches, live.matches, done.results);
      rememberFinished(matches);
      setAccaContext({ matches, scoresFor: (m) => annotate([m], live.matches, done.results)[0] });
      const upcoming = matches.filter((m) => !m.res || m.res.state === "pre");
      for (const c of CATEGORIES) if (c.kind === "acca") resolveAcca(c, upcoming);
      await logPicks(matches);
      await settleFinished(matches);
    } catch (e) { console.error("Background tick:", e.message); }
  };
  setTimeout(tick, 15 * 1000);
  setInterval(tick, 3 * 60 * 1000).unref?.();
});

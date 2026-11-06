// server.js - SportyPredictz
// A real multi-page website: every page is built on the server, so phones and Google see full content at once.
// It talks to your odds-api using a key kept in an environment variable. Browsers never see the key.

import express from "express";
import compression from "compression";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { API_BASE, DEMO, status, boardInfo, getBoard, getLive, getResults, getMatch, getStandings, standingsShape, startBoardLoop, UpstreamError, rememberFinished, getRecord } from "./data.js";
import { dayKey, todayKey, addDays, matchPath, leaguePath, parseLeagueSlug, byLeague, slugify, annotate, scoreMap } from "./logic.js";
import { CATEGORIES, CAT_BY_SLUG, PAGES } from "./content.js";
import * as V from "./views.js";
import { logPicks, settleFinished, status as logStatus, LOG_ON } from "./pickLog.js";
import { storeStatus, startStoreJanitor, loadSnapshotNear } from "./store.js";

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
app.use((req, res, next) => {
  res.set({ "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin", "X-Frame-Options": "SAMEORIGIN" });
  next();
});

// Version tag for the css/js files so phones always pick up new versions.
const ASSET_V = crypto.createHash("md5")
  .update(fs.readFileSync(path.join(__dirname, "styles.css")))
  .update(fs.readFileSync(path.join(__dirname, "app.js")))
  .digest("hex").slice(0, 8);

const seenLeagues = new Map(); // keeps league pages alive on days without matches

const withTimeout = (p, ms, fallback) => Promise.race([p, new Promise((r) => setTimeout(() => r(fallback), ms))]);

function makeCtx(req, board, live) {
  for (const m of board.matches) if (m.league.id != null) seenLeagues.set(m.league.id, m.league);
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

function route(build, { maxAge = 60, needsBoard = false, needsRecord = false } = {}) {
  return async (req, res) => {
    try {
      const [board0, live, done] = await Promise.all([getBoard(), withTimeout(getLive(), 4000, { matches: [] }), withTimeout(getResults(), 4000, { results: [] })]);
      const board = { ...board0, matches: annotate(board0.matches, live.matches, done.results) };
      rememberFinished(board.matches);
      const ctx = makeCtx(req, board, live);
      ctx.liveItems = liveItems(board.matches, live.matches);
      if (needsRecord) ctx.record = await getRecord();
      logPicks(board.matches); settleFinished(board.matches);
      ctx.scoresFor = (m) => annotate([m], live.matches, done.results)[0];
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
app.get("/predictions/:slug", route(({ req, ctx, board }) => {
  const cat = CAT_BY_SLUG[req.params.slug];
  return cat ? V.categoryPage(ctx, { cat, matches: board.matches }) : null;
}, { needsBoard: true }));

app.get("/leagues", route(({ ctx, board }) => {
  const counts = new Map();
  for (const m of board.matches) counts.set(m.league.id, (counts.get(m.league.id) || 0) + 1);
  return V.leaguesPage(ctx, { leagues: ctx.leagues, counts });
}, { needsBoard: true }));
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

app.get("/live", route(({ ctx, board }) => V.livePage(ctx, { live: ctx.liveItems, upcoming: board.matches.filter((m) => !m.res || m.res.state === "pre") }), { maxAge: 10 }));
app.get("/results", route(async ({ ctx }) => V.resultsPage(ctx, { results: (await getResults()).results || [] }), { maxAge: 60, needsRecord: true }));
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
  res.json({ mode: DEMO ? "demo" : "live", upstream: API_BASE.replace(/^https?:\/\//, ""), assets: ASSET_V, board: boardInfo(), store: storeStatus, pickLog: LOG_ON ? logStatus : "off (set SUPABASE_URL and SUPABASE_SERVICE_KEY to turn on)", ...status });
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

app.get("/healthz", (req, res) => res.send("ok"));

// ---------- search-engine files ----------
app.get("/robots.txt", (req, res) => {
  const origin = SITE_URL || `${req.protocol}://${req.get("host")}`;
  res.type("text/plain").send(DEMO
    ? "User-agent: *\nDisallow: /\n"
    : `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /favourites\n\nSitemap: ${origin}/sitemap.xml\n`);
});

app.get("/sitemap.xml", async (req, res) => {
  const origin = SITE_URL || `${req.protocol}://${req.get("host")}`;
  const board = await getBoard();
  const today = todayKey();
  const urls = [
    ["/", 1.0], ["/football-predictions-today", 0.9], ["/football-predictions-tomorrow", 0.9], ["/predictions", 0.8],
    ...CATEGORIES.map((c) => [`/predictions/${c.slug}`, 0.8]),
    ["/leagues", 0.7], ["/live", 0.6], ["/results", 0.5],
    ...Object.keys(PAGES).map((s) => [`/${s}`, 0.3]),
    ...[...seenLeagues.values()].map((l) => [leaguePath(l), 0.6]),
    ...board.matches.slice(0, 400).map((m) => [matchPath(m), 0.5, dayKey(m.ts)])
  ];
  const day = today;
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([p, pr, lm]) => `<url><loc>${origin}${p}</loc><lastmod>${lm || day}</lastmod><priority>${pr}</priority></url>`).join("\n")}\n</urlset>`);
});

// ---------- the two browser files ----------
const sendAsset = (file, type) => (req, res) => {
  res.type(type).set("Cache-Control", req.query.v ? "public, max-age=31536000, immutable" : "public, max-age=300");
  res.sendFile(file, { root: __dirname });
};
app.get("/styles.css", sendAsset("styles.css", "text/css"));
app.get("/app.js", sendAsset("app.js", "application/javascript"));

// anything else
app.use(route(() => null));

app.listen(PORT, () => {
  console.log(`SportyPredictz running on port ${PORT}`);
  console.log(DEMO ? "ODDS_API_KEY_SPORTY is not set: showing DEMO data (and hiding from Google)." : `Using odds-api at ${API_BASE}`);
  startBoardLoop();
  startStoreJanitor();
  // Every 3 minutes, even with no visitors: save picks before kick-off and settle finished matches.
  const tick = async () => {
    try {
      const [b0, live, done] = await Promise.all([getBoard(), getLive(), getResults()]);
      const matches = annotate(b0.matches, live.matches, done.results);
      rememberFinished(matches);
      await logPicks(matches);
      await settleFinished(matches);
    } catch (e) { console.error("Background tick:", e.message); }
  };
  setTimeout(tick, 15 * 1000);
  setInterval(tick, 3 * 60 * 1000).unref?.();
});

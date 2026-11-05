// server.js - SportyPredictz
// A real multi-page website: every page is built on the server, so phones and Google see full content at once.
// It talks to your odds-api using a key kept in an environment variable. Browsers never see the key.

import express from "express";
import compression from "compression";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { API_BASE, DEMO, status, boardInfo, getBoard, getLive, getResults, getMatch, getStandings, standingsShape, startBoardLoop, UpstreamError } from "./data.js";
import { dayKey, todayKey, addDays, matchPath, leaguePath, parseLeagueSlug, byLeague, slugify } from "./logic.js";
import { CATEGORIES, CAT_BY_SLUG, PAGES } from "./content.js";
import * as V from "./views.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const SITE_URL = (process.env.SITE_URL || "").replace(/\/+$/, "");

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
  const t = V.tickerHtml(live.matches || [], board.matches);
  return {
    origin: SITE_URL || `${req.protocol}://${req.get("host")}`,
    demo: DEMO, v: ASSET_V, leagues, ticker: t, liveCount: (live.matches || []).length
  };
}

// Builds one page: gets the data, runs the page function, wraps it in the layout.
function route(build, { maxAge = 60, needsBoard = false } = {}) {
  return async (req, res) => {
    try {
      const [board, live] = await Promise.all([getBoard(), withTimeout(getLive(), 4000, { matches: [] })]);
      const ctx = makeCtx(req, board, live);
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
        const ctx = { origin: SITE_URL || `${req.protocol}://${req.get("host")}`, demo: DEMO, v: ASSET_V, leagues: [], ticker: { label: "NEXT UP", items: "" }, liveCount: 0 };
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
app.get("/", route(({ ctx, board, live }) => V.homePage(ctx, { matches: board.matches, live: live.matches || [], updatedAt: board.updatedAt }), { needsBoard: true }));

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
  const matches = board.matches.filter((m) => m.league.id === id);
  const standings = await withTimeout(getStandings(league), 12000, null);
  return V.leaguePage(ctx, { league, matches, standings, allLeagues: ctx.leagues });
}));

app.get("/match/:id/:slug?", async (req, res, next) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return next();
  try {
    const m = await getMatch(id);
    if (m && req.params.slug !== slugify(`${m.home.name} vs ${m.away.name}`)) return res.redirect(301, matchPath(m));
    return route(async ({ ctx, board }) => {
      if (!m) return null;
      const related = board.matches.filter((x) => x.league.id === m.league.id && x.id !== m.id).slice(0, 5);
      return V.matchPage(ctx, { m, related });
    }, { maxAge: 45 })(req, res);
  } catch (err) {
    console.error("Match error:", err.message);
    return route(() => V.errorPage())(req, res);
  }
});

app.get("/live", route(({ ctx, live }) => V.livePage(ctx, { live: live.matches || [] }), { maxAge: 20 }));
app.get("/results", route(async ({ ctx }) => V.resultsPage(ctx, { results: (await getResults()).results || [] }), { maxAge: 120 }));
app.get("/favourites", route(({ ctx }) => V.favouritesPage(ctx), { maxAge: 300 }));
for (const slug of Object.keys(PAGES)) app.get(`/${slug}`, route(({ ctx }) => V.staticPage(ctx, slug), { maxAge: 3600 }));

// ---------- small JSON endpoints for the browser ----------
app.get("/api/live", async (req, res) => {
  const [board, live] = await Promise.all([getBoard(), getLive()]);
  const list = live.matches || [];
  res.set("Cache-Control", "no-store").json({ count: list.length, ticker: V.tickerHtml(list, board.matches), list: V.liveList(list) });
});

app.get("/api/status", (req, res) => {
  res.json({ mode: DEMO ? "demo" : "live", upstream: API_BASE.replace(/^https?:\/\//, ""), assets: ASSET_V, board: boardInfo(), ...status });
});

// Debug: shows the SHAPE of a league table from odds-api (no keys, no secrets). Handy if a table looks empty.
app.get("/api/debug/standings/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "id must be a number" });
  try { res.json(await standingsShape(id)); }
  catch (err) { res.status(502).json({ error: err instanceof UpstreamError ? `odds-api answered ${err.code}` : err.message }); }
});

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
    ...board.matches.slice(0, 400).map((m) => [matchPath(m), 0.5])
  ];
  const day = today;
  res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([p, pr]) => `<url><loc>${origin}${p}</loc><lastmod>${day}</lastmod><priority>${pr}</priority></url>`).join("\n")}\n</urlset>`);
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
});

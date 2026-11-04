// server.js - SportyPredictz
// Serves the website and talks to your odds-api on behalf of the browser.
// The odds-api key lives ONLY here (an environment variable). Browsers never see it.

import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const PORT = process.env.PORT || 3000;
const API_BASE = (process.env.ODDS_API_BASE || "https://odds-api-g6vq.onrender.com").replace(/\/+$/, "");
const API_KEY = process.env.ODDS_API_KEY_SPORTY || "";

// Free Render services sleep. Waking odds-api can take up to a minute.
const UPSTREAM_TIMEOUT_MS = 70 * 1000;

// How long we keep each kind of answer (seconds). Shared by all visitors,
// so 1,000 visitors still cost odds-api only a handful of calls.
const TTL = { matches: 90, live: 30, detail: 120 };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---------- tiny in-memory cache ----------
const cache = new Map();      // path -> { at, body }
const inflight = new Map();   // path -> Promise (so identical requests share one call)
const MAX_CACHE = 400;

const status = { lastOk: null, lastError: null, lastStatus: null };

class UpstreamError extends Error {
  constructor(code, body) {
    super(`odds-api answered ${code}`);
    this.code = code;
    this.body = body;
  }
}

function remember(path, body) {
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
  cache.set(path, { at: Date.now(), body });
}

async function callOddsApi(path, ttlSeconds) {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < ttlSeconds * 1000) return { ...hit.body, stale: false };

  if (inflight.has(path)) return inflight.get(path);

  const job = (async () => {
    try {
      const r = await fetch(API_BASE + path, {
        headers: { "x-api-key": API_KEY, accept: "application/json" },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
      });
      const body = await r.json().catch(() => null);
      status.lastStatus = r.status;
      if (!r.ok) throw new UpstreamError(r.status, body);
      status.lastOk = new Date().toISOString();
      status.lastError = null;
      remember(path, body || {});
      return { ...(body || {}), stale: false };
    } catch (err) {
      const code = err instanceof UpstreamError ? err.code : 0;
      status.lastError = err.message;
      // Network trouble or odds-api having a bad moment: serve the older copy if we have one.
      if (hit && (code === 0 || code >= 500)) return { ...hit.body, stale: true };
      throw err;
    } finally {
      inflight.delete(path);
    }
  })();

  inflight.set(path, job);
  return job;
}

function sendError(res, err) {
  const code = err instanceof UpstreamError ? err.code : 0;
  console.error("odds-api call failed:", err.message);
  if (code === 429) {
    return res.status(429).json({ error: "The daily data limit was reached. Please try again later." });
  }
  if (code === 401) {
    return res.status(502).json({ error: "The data service is not accepting this site right now." });
  }
  if (code === 400 && err.body?.error) {
    return res.status(400).json({ error: err.body.error });
  }
  return res.status(502).json({ error: "Data is temporarily unavailable. Please try again shortly." });
}

// ---------- demo data (used only when no key is set) ----------
// Same shape as odds-api, so the site looks right before the key is connected.
const TEAMS = {
  "Premier League": [["Arsenal", 88], ["Chelsea", 78], ["Liverpool", 90], ["Tottenham", 76], ["Man City", 92], ["Newcastle", 77], ["Everton", 66], ["Brighton", 72]],
  "La Liga": [["Real Madrid", 91], ["Barcelona", 89], ["Atletico Madrid", 82], ["Sevilla", 70], ["Valencia", 68], ["Villarreal", 72]],
  "Serie A": [["Inter", 87], ["Juventus", 80], ["AC Milan", 81], ["Napoli", 82], ["Roma", 75], ["Lazio", 74]],
  "Bundesliga": [["Bayern Munich", 91], ["Dortmund", 82], ["Leverkusen", 85], ["RB Leipzig", 80], ["Stuttgart", 74], ["Frankfurt", 73]],
  "Champions League": [["PSG", 88], ["Benfica", 76], ["Porto", 75], ["Ajax", 73], ["Celtic", 68], ["Galatasaray", 71]]
};
const LEAGUE_IDS = { "Premier League": 1, "La Liga": 2, "Serie A": 3, "Bundesliga": 4, "Champions League": 5 };

function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function demoDay(date) {
  const rnd = seeded(Number(date.replaceAll("-", "")));
  const out = [];
  let idx = 1;
  for (const [league, teams] of Object.entries(TEAMS)) {
    const pool = [...teams].sort(() => rnd() - 0.5);
    for (let i = 0; i + 1 < pool.length && i < 4; i += 2) {
      const [home, hs] = pool[i];
      const [away, as] = pool[i + 1];
      const diff = (hs - as + 6) / 14;
      const pH = Math.min(78, Math.max(14, 38 + diff * 22));
      const pD = Math.max(12, 28 - Math.abs(diff) * 4);
      const pA = 100 - pH - pD;
      const hour = 12 + Math.floor(rnd() * 9);
      const minute = rnd() > 0.5 ? 30 : 0;
      const kickoff = `${date}T${String(hour).padStart(2, "0")}:${minute === 0 ? "00" : "30"}:00Z`;
      const price = (p) => Math.max(1.01, +((100 / p) * 0.94).toFixed(2));
      const over = 44 + rnd() * 26;
      const btts = 40 + rnd() * 24;
      const top = Math.max(pH, pD, pA);
      out.push({
        id: Number(date.replaceAll("-", "")) * 100 + idx,
        league: { id: LEAGUE_IDS[league], name: league, logo: null },
        home: { id: null, name: home, logo: null },
        away: { id: null, name: away, logo: null },
        kickoff,
        status: "notstarted",
        odds: {
          type: "consensus",
          home_win: price(pH), draw: price(pD), away_win: price(pA),
          over_25_goals: price(over), under_25_goals: price(100 - over),
          btts_yes: price(btts), btts_no: price(100 - btts)
        },
        prediction: {
          source: "demo",
          home_win_pct: +pH.toFixed(1), draw_pct: +pD.toFixed(1), away_win_pct: +pA.toFixed(1),
          expected_goals: { home: +(1 + pH / 60).toFixed(2), away: +(0.6 + pA / 70).toFixed(2) },
          over_25_pct: +over.toFixed(1), btts_yes_pct: +btts.toFixed(1),
          most_likely_score: pH > pA ? "2-1" : pA > pH ? "1-2" : "1-1",
          confidence: +(top / 100).toFixed(2)
        }
      });
      idx++;
    }
  }
  return out.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

function demoMatches(q) {
  const date = q.date_from || new Date().toISOString().slice(0, 10);
  let list = demoDay(date);
  if (q.league_id) list = list.filter((m) => String(m.league.id) === String(q.league_id));
  const limit = Math.min(Math.max(parseInt(q.limit) || 10, 1), 20);
  const offset = Math.max(parseInt(q.offset) || 0, 0);
  return {
    demo: true, stale: false, has_more: list.length > offset + limit, limit, offset,
    window: { from: date, to: q.date_to || date },
    matches: list.slice(offset, offset + limit)
  };
}

function demoLive() {
  const minuteBase = new Date().getMinutes() + 20;
  const mk = (id, league, home, away, hs, as, add) => ({
    id, league: { id: LEAGUE_IDS[league], name: league, logo: null },
    home: { id: null, name: home, logo: null }, away: { id: null, name: away, logo: null },
    kickoff: new Date().toISOString(), status: "inprogress", period: "2nd half",
    minute: Math.min(89, minuteBase + add), score: { home: hs, away: as }
  });
  return {
    demo: true, stale: false, count: 3,
    matches: [
      mk(9001, "Premier League", "Newcastle", "Everton", 2, 0, 5),
      mk(9002, "Serie A", "Roma", "Lazio", 1, 1, 12),
      mk(9003, "La Liga", "Sevilla", "Valencia", 0, 1, 0)
    ]
  };
}

function demoDetail(id) {
  const date = String(Math.floor(id / 100)).replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3");
  if (!DATE_RE.test(date)) return null;
  const m = demoDay(date).find((x) => x.id === id);
  if (!m) return null;
  return { demo: true, stale: false, match: { ...m, score: { home: null, away: null } }, odds: m.odds, prediction: m.prediction };
}

// ---------- API for the website ----------
app.get("/api/status", (req, res) => {
  res.json({
    mode: API_KEY ? "live" : "demo",
    upstream: API_BASE.replace(/^https?:\/\//, ""),
    lastOk: status.lastOk,
    lastStatus: status.lastStatus,
    lastError: status.lastError
  });
});

app.get("/api/matches", async (req, res) => {
  const q = new URLSearchParams();
  for (const name of ["date_from", "date_to"]) {
    if (req.query[name]) {
      if (!DATE_RE.test(String(req.query[name]))) return res.status(400).json({ error: `${name} must look like 2026-11-05.` });
      q.set(name, String(req.query[name]));
    }
  }
  if (req.query.league_id) {
    const n = parseInt(req.query.league_id);
    if (!Number.isInteger(n)) return res.status(400).json({ error: "league_id must be a number." });
    q.set("league_id", String(n));
  }
  if (req.query.team_name) q.set("team_name", String(req.query.team_name).slice(0, 60));
  q.set("limit", String(Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 20)));
  q.set("offset", String(Math.min(Math.max(parseInt(req.query.offset) || 0, 0), 200)));
  q.sort();

  if (!API_KEY) return res.json(demoMatches(Object.fromEntries(q)));
  try {
    res.json(await callOddsApi(`/v1/matches?${q}`, TTL.matches));
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/live", async (req, res) => {
  if (!API_KEY) return res.json(demoLive());
  try {
    res.json(await callOddsApi("/v1/live", TTL.live));
  } catch (err) {
    sendError(res, err);
  }
});

app.get("/api/match/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "The match id must be a number." });
  if (!API_KEY) {
    const d = demoDetail(id);
    return d ? res.json(d) : res.status(404).json({ error: "Match not found." });
  }
  try {
    res.json(await callOddsApi(`/v1/matches/${id}?include=odds,prediction`, TTL.detail));
  } catch (err) {
    if (err instanceof UpstreamError && err.code === 404) return res.status(404).json({ error: "Match not found." });
    sendError(res, err);
  }
});

app.get("/healthz", (req, res) => res.send("ok"));

// ---------- the website itself ----------
// Only these three files are public. Nothing else in the folder can be downloaded.
const sendPublic = (file) => (req, res) => res.sendFile(file, { root: __dirname });
app.get("/", sendPublic("index.html"));
app.get("/styles.css", sendPublic("styles.css"));
app.get("/app.js", sendPublic("app.js"));

app.listen(PORT, () => {
  console.log(`SportyPredictz running on port ${PORT}`);
  console.log(API_KEY
    ? `Using odds-api at ${API_BASE}`
    : "ODDS_API_KEY_SPORTY is not set: showing DEMO data.");
});

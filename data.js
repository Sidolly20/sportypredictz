// data.js - everything that talks to odds-api, plus the in-memory "board" of upcoming matches.
// The odds-api key is read here from an environment variable and sent as the x-api-key header.
// It is never put into any page.

import { demoWindow, demoLive, demoResults, demoStandings } from "./demo.js";
import { normMatch, num, todayKey, addDays, topPick, judge } from "./logic.js";
import { fetchRecord, summarise } from "./pickLog.js";
import { saveMatches, saveResults, loadMatchesBetween, loadMatch, loadFinished, saveSnapshot, STORE_ON, storeStatus } from "./store.js";

export const API_BASE = (process.env.ODDS_API_BASE || "https://odds-api-g6vq.onrender.com").replace(/\/+$/, "");
export const API_KEY = process.env.ODDS_API_KEY_SPORTY || "";
export const DEMO = !API_KEY;

const UPSTREAM_TIMEOUT_MS = 70 * 1000;
const BOARD_DAYS = Number(process.env.BOARD_DAYS || 3);     // today + next 2 days
const BOARD_PAGES = Number(process.env.BOARD_PAGES || 3);   // 20 matches per page per day
const BOARD_TTL_MS = Number(process.env.BOARD_TTL_MS || 8 * 60 * 1000);
const KEEP_STARTED_MS = 10 * 3600 * 1000; // matches stay listed for 10 hours after kick-off

export const status = { lastOk: null, lastError: null, lastStatus: null };

export class UpstreamError extends Error {
  constructor(code, body) {
    super(`odds-api answered ${code}`);
    this.code = code;
    this.body = body;
  }
}

// ---------- cached call to odds-api ----------
const cache = new Map();
const inflight = new Map();
const MAX_CACHE = 500;

export async function callOddsApi(path, ttlSeconds, maxStaleSeconds = 1800) {
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
      if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value);
      cache.set(path, { at: Date.now(), body: body || {} });
      return { ...(body || {}), stale: false };
    } catch (err) {
      const code = err instanceof UpstreamError ? err.code : 0;
      status.lastError = err.message;
      // Old data is reused only for a limited time. Live scores must never be kept long: wrong live is worse than none.
      if (hit && (code === 0 || code >= 500) && Date.now() - hit.at < maxStaleSeconds * 1000) return { ...hit.body, stale: true };
      throw err;
    } finally {
      inflight.delete(path);
    }
  })();
  inflight.set(path, job);
  return job;
}

// ---------- the board: upcoming matches for the next few days ----------
const board = { matches: [], updatedAt: 0, loading: null, error: null, lastAttempt: 0, pages: 0 };
const BOARD_WAIT_MS = Number(process.env.BOARD_WAIT_MS || 20000);

async function loadBoard() {
  board.lastAttempt = Date.now();
  board.pages = 0;
  const start = todayKey();
  const fresh = new Map();
  let gotAny = false;

  if (DEMO) {
    for (const m of demoWindow(start, addDays(start, BOARD_DAYS - 1))) fresh.set(m.id, normMatch(m));
    board.matches = [...fresh.values()].sort((a, b) => a.ts - b.ts);
    board.updatedAt = Date.now();
    return;
  }

  for (let d = 0; d < BOARD_DAYS; d++) {
    const day = addDays(start, d);
    for (let page = 0; page < BOARD_PAGES; page++) {
      try {
        const q = new URLSearchParams({ date_from: day, date_to: day, limit: "20", offset: String(page * 20) });
        q.sort();
        const data = await callOddsApi(`/v1/matches?${q}`, 60);
        for (const raw of data.matches || []) if (raw && raw.id != null) fresh.set(Number(raw.id), normMatch(raw));
        gotAny = true;
        board.pages++;
        // Show something as soon as the first page of a cold start arrives.
        if (!board.matches.length) {
          board.matches = [...fresh.values()].sort((a, b) => a.ts - b.ts);
          board.updatedAt = Date.now();
        }
        if (!data.has_more) break;
      } catch (err) {
        board.error = err instanceof UpstreamError ? `odds-api answered ${err.code}` : err.message;
        console.error("Board load failed:", err.message);
        break;
      }
    }
  }
  if (gotAny) {
    // odds-api only lists matches that have not started. Keep the ones we already knew about for
    // the rest of the day, so they stay on the page with a live score and then the final result.
    const keepFrom = Date.now() - KEEP_STARTED_MS;
    for (const old of board.matches) if (!fresh.has(old.id) && old.ts >= keepFrom) fresh.set(old.id, old);
    board.matches = [...fresh.values()].sort((a, b) => a.ts - b.ts);
    board.updatedAt = Date.now();
    board.error = null;
    saveMatches(board.matches);
  }
}

function refreshBoard() {
  if (!board.loading) {
    board.loading = loadBoard().catch((e) => console.error("Board error:", e.message)).finally(() => { board.loading = null; });
  }
  return board.loading;
}

// Cold start: show the matches we saved last time straight away, and refresh from odds-api in the background.
let seeded = false;
async function seedFromStore() {
  if (DEMO || !STORE_ON || seeded) return;
  seeded = true;
  const start = todayKey();
  const rows = await loadMatchesBetween(start, addDays(start, BOARD_DAYS - 1));
  const cutoff = Date.now() - KEEP_STARTED_MS;
  const list = rows.map(normMatch).filter((m) => m.ts >= cutoff);
  if (!list.length) return;
  board.matches = list.sort((a, b) => a.ts - b.ts);
  board.updatedAt = Date.now() - BOARD_TTL_MS - 1; // stale on purpose: refresh right away
}

// Pages call this. Fresh enough -> instant. Stale -> instant, refresh in the background. Empty -> wait (up to 50s).
export async function getBoard() {
  const age = Date.now() - board.updatedAt;
  if (board.updatedAt && age > BOARD_TTL_MS) refreshBoard();
  if (!board.matches.length) await seedFromStore();
  if (!board.matches.length) {
    // Do not hammer odds-api: at most one fresh attempt every 20 seconds while empty.
    const p = board.loading || (Date.now() - board.lastAttempt > 20 * 1000 ? refreshBoard() : null);
    if (p) await Promise.race([p, new Promise((r) => setTimeout(r, BOARD_WAIT_MS))]);
  }
  const cutoff = Date.now() - KEEP_STARTED_MS;
  return { matches: board.matches.filter((m) => m.ts >= cutoff), updatedAt: board.updatedAt, error: board.error, loading: !!board.loading };
}

export const boardInfo = () => ({ matches: board.matches.length, loading: !!board.loading, pagesLoaded: board.pages, updatedAt: board.updatedAt ? new Date(board.updatedAt).toISOString() : null, error: board.error });

export function startBoardLoop() {
  refreshBoard();
  setInterval(refreshBoard, BOARD_TTL_MS).unref?.();
}

// ---------- matches that started before we saw them ----------
// odds-api stops listing a match once it kicks off. If the site restarted mid-day, those matches would be
// missing from the lists. So when we see one in /v1/live or /v1/results we fetch its odds + prediction once.
const tried = new Set();
async function hydrateStarted(list) {
  if (DEMO || !list.length) return;
  const known = new Set(board.matches.map((m) => m.id));
  const todo = list.filter((x) => x && x.id != null && !known.has(Number(x.id)) && !tried.has(Number(x.id))).slice(0, 25);
  for (const x of todo) {
    tried.add(Number(x.id));
    try {
      const d = await callOddsApi(`/v1/matches/${x.id}?include=odds,prediction`, 600);
      if (!d.match || !(d.odds || d.prediction)) continue;
      board.matches.push(normMatch({ ...x, ...d.match, odds: d.odds ?? null, prediction: d.prediction ?? null }));
    } catch { /* leave it out */ }
  }
  if (todo.length) board.matches.sort((a, b) => a.ts - b.ts);
}

// ---------- live scores ----------
export async function getLive() {
  if (DEMO) return demoLive();
  try {
    const d = await callOddsApi("/v1/live", 12, 60);
    const matches = (d.matches || []).map(normMatch);
    hydrateStarted(matches);
    return { ...d, matches };
  } catch {
    return { matches: [], error: true };
  }
}

// ---------- results ----------
export async function getResults() {
  if (DEMO) return { ...demoResults(), results: demoResults().results.map(normMatch) };
  try {
    const d = await callOddsApi("/v1/results?limit=50", 60, 900);
    const results = (d.results || []).map(normMatch);
    hydrateStarted(results.filter((x) => x.ts >= Date.now() - 24 * 3600e3));
    saveResults(results);
    return { ...d, results: await withStoredResults(results) };
  } catch {
    return { results: await withStoredResults([]), error: true };
  }
}

// Fresh results first, then anything finished we saved earlier that odds-api no longer lists.
async function withStoredResults(fresh) {
  const byId = new Map((await loadFinished(3)).map((m) => [Number(m.id), m]));
  for (const m of fresh) byId.set(Number(m.id), m);
  return [...byId.values()].sort((a, b) => b.ts - a.ts).slice(0, 100);
}

// ---------- single match ----------
export async function getMatch(id) {
  const onBoard = board.matches.find((m) => m.id === id);
  if (DEMO) {
    if (onBoard) return onBoard;
    const pool = [...(await getResults()).results, ...(await getLive()).matches].map(normMatch);
    return pool.find((m) => m.id === id) || null;
  }
  const fromMemoryOrStore = async () => {
    if (onBoard) return onBoard;
    const saved = await loadMatch(id);
    return saved ? normMatch(saved) : null;
  };
  try {
    const d = await callOddsApi(`/v1/matches/${id}?include=odds,prediction`, 120);
    if (!d.match) return fromMemoryOrStore();
    const m = normMatch({ ...(onBoard || {}), ...d.match, odds: d.odds ?? onBoard?.odds ?? null, prediction: d.prediction ?? onBoard?.prediction ?? null });
    saveMatches([m]);
    return m;
  } catch (err) {
    const found = await fromMemoryOrStore();
    if (found) return found;
    if (err instanceof UpstreamError && err.code === 404) return null;
    throw err;
  }
}

// ---------- league tables ----------
const standCache = new Map(); // key -> { at, value }
const STAND_OK_MS = 15 * 60 * 1000;
const STAND_MISS_MS = 10 * 60 * 1000;

const CODE_BY_NAME = [
  [/^(english |england )?premier league$/i, "PL"],
  [/^(la ?liga|laliga|primera division)$/i, "PD"],
  [/^serie a$/i, "SA"],
  [/^bundesliga$/i, "BL1"],
  [/^(uefa )?champions league$/i, "CL"]
];

const pick = (o, keys) => {
  for (const k of keys) if (o && o[k] !== undefined && o[k] !== null) return o[k];
  return null;
};

function normRow(r, i) {
  const team = r.team && typeof r.team === "object" ? r.team : null;
  const name = team?.name ?? pick(r, ["team_name", "name", "club"]) ?? (typeof r.team === "string" ? r.team : null);
  if (!name) return null;
  const tid = team?.id ?? r.team_id ?? null;
  const gf = num(pick(r, ["goals_for", "gf", "scored", "goals_scored", "for"])) ?? num(r.goals?.for);
  const ga = num(pick(r, ["goals_against", "ga", "conceded", "goals_conceded", "against"])) ?? num(r.goals?.against);
  return {
    pos: num(pick(r, ["position", "pos", "rank"])) ?? i + 1,
    team: String(name),
    crest: team?.crest ?? team?.logo ?? r.crest ?? r.logo ?? (tid ? `https://sports.bzzoiro.com/img/team/${tid}/` : null),
    p: num(pick(r, ["played", "played_games", "games_played", "matches_played", "matches", "mp", "p"])),
    w: num(pick(r, ["won", "wins", "w"])),
    d: num(pick(r, ["draw", "drawn", "draws", "d"])),
    l: num(pick(r, ["lost", "losses", "l"])),
    gf, ga,
    gd: num(pick(r, ["goal_difference", "goal_diff", "gd"])) ?? (gf !== null && ga !== null ? gf - ga : null),
    pts: num(pick(r, ["points", "pts"])),
    form: typeof r.form === "string" ? r.form : null
  };
}

// Finds the table rows wherever the provider put them: [{position, team, points...}] possibly in groups.
function extractGroups(node, label = "", out = [], depth = 0) {
  if (!node || depth > 6) return out;
  if (Array.isArray(node)) {
    const objs = node.filter((x) => x && typeof x === "object");
    const looksLikeRows = objs.length >= 2 && objs.every((x) => pick(x, ["points", "pts"]) !== null || pick(x, ["position", "pos", "rank"]) !== null);
    if (looksLikeRows) {
      const rows = objs.map(normRow).filter(Boolean);
      if (rows.length >= 2) out.push({ name: label, rows });
      return out;
    }
    node.forEach((x) => extractGroups(x, x && typeof x === "object" ? String(x.group ?? x.name ?? x.stage ?? label ?? "") : label, out, depth + 1));
    return out;
  }
  if (typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (v && typeof v === "object") extractGroups(v, label || (/^(standings|table|tables|results|data|rows)$/i.test(k) ? "" : k), out, depth + 1);
    }
  }
  return out;
}

export async function getStandings(league) {
  if (!league || league.id == null) return null;
  const key = String(league.id);
  const hit = standCache.get(key);
  if (hit && Date.now() - hit.at < (hit.value ? STAND_OK_MS : STAND_MISS_MS)) return hit.value;

  let value = null;
  if (DEMO) {
    value = demoStandings(league.name);
  } else {
    try {
      const d = await callOddsApi(`/v1/standings/league/${league.id}`, 600);
      const groups = extractGroups({ ...d, league_id: undefined, season_id: undefined, stale: undefined });
      if (groups.length) { value = { groups, season: d.season?.name ?? d.season ?? null }; saveSnapshot(league.id, groups); }
    } catch { /* fall through to the stored tables */ }

    if (!value) {
      const code = (CODE_BY_NAME.find(([re]) => re.test(league.name)) || [])[1];
      if (code) {
        try {
          const d = await callOddsApi(`/v1/standings/${code}`, 900);
          const groups = (d.tables || []).map((t) => ({
            name: t.group || (t.stage && t.stage !== "REGULAR_SEASON" ? String(t.stage).replaceAll("_", " ") : ""),
            rows: (t.table || []).map(normRow).filter(Boolean)
          })).filter((g) => g.rows.length);
          if (groups.length) value = { groups, season: d.season ?? null };
        } catch { /* no table available */ }
      }
    }
  }
  standCache.set(key, { at: Date.now(), value });
  return value;
}

// Debug helper: shows the SHAPE of what the provider sends (no keys, no secrets).
export async function standingsShape(id) {
  if (DEMO) return { demo: true };
  const d = await callOddsApi(`/v1/standings/league/${id}`, 600);
  const sample = (v, depth = 0) => {
    if (Array.isArray(v)) return depth > 3 ? `[array ${v.length}]` : [`(${v.length} items)`, sample(v[0], depth + 1)];
    if (v && typeof v === "object") return depth > 3 ? "{...}" : Object.fromEntries(Object.entries(v).slice(0, 14).map(([k, x]) => [k, sample(x, depth + 1)]));
    return v;
  };
  return sample(d);
}

// ---------- track record: how our picks did on matches that have finished ----------
// Remembered in memory for 3 days (it starts again from empty if the server restarts).
const record = new Map();
export function rememberFinished(matches) {
  for (const m of matches) {
    if (!m.res || m.res.state !== "ft" || record.has(m.id)) continue;
    const pick = topPick(m);
    if (pick) record.set(m.id, { m, pick, h: m.res.h, a: m.res.a });
  }
  const cut = Date.now() - 72 * 3600e3;
  for (const [id, r] of record) if (r.m.ts < cut) record.delete(id);
}
export async function getRecord() {
  const db = await Promise.race([fetchRecord(), new Promise((r) => setTimeout(() => r(null), 2500))]);
  if (db && db.total) return db;
  const list = [...record.values()].sort((a, b) => b.m.ts - a.m.ts).map((r) => ({ ...r, state: judge(r.pick.k, r.h, r.a, true) }));
  return summarise(list);
}

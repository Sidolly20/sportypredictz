import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const ODDS_KEY = process.env.ODDS_API_KEY || "";
const API_ROOT = "https://api.the-odds-api.com/v4";
const REGIONS = "uk,eu";
const MARKET = "h2h";
const CACHE_MS = 60 * 1000;

const ALLOWED_LEAGUES = new Set([
  "soccer_epl",
  "soccer_spain_la_liga",
  "soccer_italy_serie_a",
  "soccer_germany_bundesliga",
  "soccer_france_ligue_one",
  "soccer_uefa_champs_league"
]);

const cache = new Map();

app.use(express.static(path.join(__dirname, "public")));

function demoEvents() {
  const make = (id, home, away, hours, h, d, a) => {
    const shifts = [["bet365", "bet365", 0], ["unibet", "Unibet", 0.03], ["williamhill", "William Hill", -0.02], ["pinnacle", "Pinnacle", 0.01]];
    return {
      id,
      home_team: home,
      away_team: away,
      commence_time: new Date(Date.now() + hours * 3600e3).toISOString(),
      bookmakers: shifts.map(([key, title, s]) => ({
        key,
        title,
        markets: [{
          key: "h2h",
          outcomes: [
            { name: home, price: +(h + s).toFixed(2) },
            { name: "Draw", price: +(d - s).toFixed(2) },
            { name: away, price: +(a + s / 2).toFixed(2) }
          ]
        }]
      }))
    };
  };
  return [
    make("d1", "Arsenal", "Chelsea", 4, 1.85, 3.6, 4.2),
    make("d2", "Liverpool", "Tottenham", 22, 1.55, 4.2, 5.5),
    make("d3", "Man City", "Newcastle", 28, 1.4, 4.9, 7.5),
    make("d4", "Everton", "Brighton", 46, 2.45, 3.3, 3.05)
  ];
}

app.get("/api/odds", async (req, res) => {
  const league = req.query.league || "soccer_epl";
  if (!ALLOWED_LEAGUES.has(league)) {
    return res.status(400).json({ error: "Unknown league" });
  }

  if (!ODDS_KEY) {
    return res.json({
      live: false,
      quota: null,
      events: demoEvents(),
      note: "ODDS_API_KEY is not set. Showing demo data."
    });
  }

  const cached = cache.get(league);
  if (cached && Date.now() - cached.at < CACHE_MS) {
    return res.json(cached.payload);
  }

  try {
    const url = `${API_ROOT}/sports/${league}/odds/?apiKey=${encodeURIComponent(ODDS_KEY)}&regions=${REGIONS}&markets=${MARKET}&oddsFormat=decimal`;
    const upstream = await fetch(url);
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `Odds provider returned ${upstream.status}` });
    }
    const events = await upstream.json();
    const payload = {
      live: true,
      quota: upstream.headers.get("x-requests-remaining"),
      events
    };
    cache.set(league, { at: Date.now(), payload });
    res.json(payload);
  } catch (err) {
    console.error("Odds fetch failed:", err);
    res.status(502).json({ error: "Could not reach the odds provider" });
  }
});

app.get("/healthz", (req, res) => res.send("ok"));

app.listen(PORT, () => {
  console.log(`SportyPredictz running on port ${PORT}`);
  console.log(ODDS_KEY ? "Live odds enabled." : "No ODDS_API_KEY set, using demo data.");
});

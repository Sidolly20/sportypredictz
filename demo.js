// demo.js - sample data in odds-api's shape. Used ONLY when ODDS_API_KEY_SPORTY is not set.

const TEAMS = {
  "Premier League": [["Arsenal", 88], ["Chelsea", 78], ["Liverpool", 90], ["Tottenham", 76], ["Man City", 92], ["Newcastle", 77], ["Everton", 66], ["Brighton", 72]],
  "La Liga": [["Real Madrid", 91], ["Barcelona", 89], ["Atletico Madrid", 82], ["Sevilla", 70], ["Valencia", 68], ["Villarreal", 72]],
  "Serie A": [["Inter", 87], ["Juventus", 80], ["AC Milan", 81], ["Napoli", 82], ["Roma", 75], ["Lazio", 74]],
  "Bundesliga": [["Bayern Munich", 91], ["Dortmund", 82], ["Leverkusen", 85], ["RB Leipzig", 80], ["Stuttgart", 74], ["Frankfurt", 73]],
  "Champions League": [["PSG", 88], ["Benfica", 76], ["Porto", 75], ["Ajax", 73], ["Celtic", 68], ["Galatasaray", 71]],
  "Brasileirao Serie A": [["Flamengo", 80], ["Palmeiras", 79], ["Gremio", 70], ["Cruzeiro", 69], ["Bahia", 68], ["Vasco da Gama", 66]]
};
export const DEMO_LEAGUE_IDS = { "Premier League": 1, "La Liga": 2, "Serie A": 3, "Bundesliga": 4, "Champions League": 5, "Brasileirao Serie A": 6 };

function seeded(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function demoDay(date) {
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
      const kickoff = `${date}T${String(hour).padStart(2, "0")}:${rnd() > 0.5 ? "30" : "00"}:00Z`;
      const price = (p) => Math.max(1.01, +((100 / p) * 0.94).toFixed(2));
      const over = 40 + rnd() * 30;
      const btts = 38 + rnd() * 28;
      out.push({
        id: Number(date.replaceAll("-", "")) * 100 + idx,
        league: { id: DEMO_LEAGUE_IDS[league], name: league, logo: null },
        home: { id: null, name: home, logo: null },
        away: { id: null, name: away, logo: null },
        kickoff, status: "notstarted",
        odds: {
          type: "consensus", home_win: price(pH), draw: price(pD), away_win: price(pA),
          over_15_goals: price(Math.min(90, over + 22)), over_25_goals: price(over), over_35_goals: price(Math.max(12, over - 24)),
          under_25_goals: price(100 - over), btts_yes: price(btts), btts_no: price(100 - btts)
        },
        prediction: {
          source: "demo", home_win_pct: +pH.toFixed(1), draw_pct: +pD.toFixed(1), away_win_pct: +pA.toFixed(1),
          expected_goals: { home: +(1 + pH / 60).toFixed(2), away: +(0.6 + pA / 70).toFixed(2) },
          over_15_pct: +Math.min(90, over + 22).toFixed(1), over_25_pct: +over.toFixed(1), over_35_pct: +Math.max(12, over - 24).toFixed(1),
          btts_yes_pct: +btts.toFixed(1),
          most_likely_score: pH > pA ? "2-1" : pA > pH ? "1-2" : "1-1",
          favorite: pH > pA ? "home" : "away", confidence: +(Math.max(pH, pD, pA) / 100).toFixed(2)
        }
      });
      idx++;
    }
  }
  return out.sort((a, b) => a.kickoff.localeCompare(b.kickoff));
}

export function demoWindow(from, to) {
  const out = [];
  let d = new Date(`${from}T12:00:00Z`);
  const end = new Date(`${to}T12:00:00Z`);
  while (d <= end) {
    out.push(...demoDay(d.toISOString().slice(0, 10)));
    d = new Date(d.getTime() + 86400e3);
  }
  return out;
}

export function demoLive() {
  const base = new Date().getMinutes() + 20;
  const mk = (id, league, home, away, hs, as, add) => ({
    id, league: { id: DEMO_LEAGUE_IDS[league], name: league, logo: null },
    home: { id: null, name: home, logo: null }, away: { id: null, name: away, logo: null },
    kickoff: new Date().toISOString(), status: "inprogress", period: "2nd half",
    minute: Math.min(89, base + add), score: { home: hs, away: as }
  });
  return { demo: true, count: 3, matches: [mk(9001, "Premier League", "Newcastle", "Everton", 2, 0, 5), mk(9002, "Serie A", "Roma", "Lazio", 1, 1, 12), mk(9003, "La Liga", "Sevilla", "Valencia", 0, 1, 0)] };
}

export function demoResults() {
  const mk = (id, league, home, away, hs, as, hrs) => ({
    id, league: { id: DEMO_LEAGUE_IDS[league], name: league, logo: null },
    home: { id: null, name: home, logo: null }, away: { id: null, name: away, logo: null },
    kickoff: new Date(Date.now() - hrs * 3600e3).toISOString(), status: "finished", score: { home: hs, away: as }
  });
  return { demo: true, results: [mk(8001, "Premier League", "Chelsea", "Tottenham", 2, 1, 20), mk(8002, "Serie A", "Napoli", "Juventus", 1, 1, 22), mk(8003, "Bundesliga", "Dortmund", "Stuttgart", 3, 0, 26)] };
}

export function demoStandings(leagueName) {
  const teams = TEAMS[leagueName] || TEAMS["Premier League"];
  const rows = teams.slice().sort((a, b) => b[1] - a[1]).map(([team], i) => {
    const played = 11, won = 9 - i, draw = 1 + (i % 2), lost = played - won - draw;
    return { position: i + 1, team, crest: null, played, won, draw, lost, points: won * 3 + draw, goals_for: 24 - i * 2, goals_against: 8 + i * 2, goal_difference: 16 - i * 4, form: null };
  });
  return { groups: [{ name: "", rows }], season: "Demo" };
}

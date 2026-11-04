const LEAGUES = [
  { key: "soccer_epl",                name: "Premier League" },
  { key: "soccer_spain_la_liga",      name: "La Liga" },
  { key: "soccer_italy_serie_a",      name: "Serie A" },
  { key: "soccer_germany_bundesliga", name: "Bundesliga" },
  { key: "soccer_france_ligue_one",   name: "Ligue 1" },
  { key: "soccer_uefa_champs_league", name: "Champions League" }
];

const state = {
  league: LEAGUES[0].key,
  events: [],
  live: false,
  quota: null,
  selected: null
};

const $ = id => document.getElementById(id);
const fmtTime = iso => new Date(iso).toLocaleString([], { weekday: "short", hour: "2-digit", minute: "2-digit" });
const pct = n => (n >= 0 ? "+" : "") + (n * 100).toFixed(1) + "%";
const leagueLabel = key => (LEAGUES.find(l => l.key === key) || {}).name || key;

function setStatus(msg, isErr = false) {
  const el = $("status");
  el.textContent = msg;
  el.className = "status" + (isErr ? " err" : "");
}

async function loadOdds() {
  setStatus("Loading odds...");
  try {
    const res = await fetch(`/api/odds?league=${encodeURIComponent(state.league)}`);
    const data = await res.json();
    if (!res.ok) {
      state.events = [];
      state.live = false;
      setStatus(data.error || "Could not load odds.", true);
    } else {
      state.events = data.events || [];
      state.live = !!data.live;
      state.quota = data.quota;
      setStatus(data.note || `${state.live ? "Live" : "Demo"} · ${state.events.length} matches`);
    }
  } catch (err) {
    state.events = [];
    setStatus("Network error. Check your connection.", true);
  }
  render();
}

function analyse(ev) {
  const outcomes = [
    { label: "1", name: ev.home_team },
    { label: "X", name: "Draw" },
    { label: "2", name: ev.away_team }
  ];

  const rows = outcomes.map(o => {
    const prices = [];
    ev.bookmakers.forEach(b => {
      const market = b.markets.find(m => m.key === "h2h");
      const oc = market && market.outcomes.find(x => x.name === o.name);
      if (oc) prices.push({ book: b.title, price: oc.price });
    });
    if (!prices.length) return { ...o, prices, best: null, avgImp: 0, fair: 0, edge: 0 };
    const best = prices.reduce((a, b) => (b.price > a.price ? b : a));
    const avgImp = prices.reduce((s, p) => s + 1 / p.price, 0) / prices.length;
    return { ...o, prices, best, avgImp, fair: 0, edge: 0 };
  });

  const total = rows.reduce((s, r) => s + r.avgImp, 0) || 1;
  rows.forEach(r => {
    if (!r.best) return;
    r.fair = r.avgImp / total;
    r.edge = r.fair * r.best.price - 1;
  });
  return rows;
}

function renderLeagues() {
  $("leagues").innerHTML = LEAGUES.map(l =>
    `<button class="league-btn ${l.key === state.league ? "on" : ""}" data-league="${l.key}">${l.name}</button>`
  ).join("");
}

function renderStats() {
  const books = new Set();
  state.events.forEach(e => e.bookmakers.forEach(b => books.add(b.title)));
  $("stat-matches").textContent = state.events.length;
  $("stat-books").textContent = books.size;
  $("stat-quota").textContent = state.quota ?? "–";
  $("stat-mode").textContent = state.live ? "Live" : "Demo";
}

function renderTicker() {
  if (!state.events.length) { $("ticker").innerHTML = ""; return; }
  const items = state.events.slice(0, 12).map(e => {
    const r = analyse(e)[0];
    const price = r.best ? `<b>${r.best.price.toFixed(2)}</b>` : "–";
    return `<span class="ticker-item">${e.home_team} vs ${e.away_team} · 1 ${price} · ${fmtTime(e.commence_time)}</span>`;
  }).join("");
  $("ticker").innerHTML = items + items;
}

function renderCarousel() {
  if (!state.events.length) {
    $("carousel").innerHTML = `<div class="empty" style="width:100%">No matches to show right now.</div>`;
    return;
  }
  $("carousel").innerHTML = state.events.map(e => {
    const rows = analyse(e);
    const bestEdge = Math.max(...rows.map(r => r.edge));
    const cls = bestEdge > 0 ? "pos" : "neg";
    const cell = r => `
      <div class="price">
        <small>${r.label}</small>
        <strong>${r.best ? r.best.price.toFixed(2) : "–"}</strong>
        <em>${r.best ? r.best.book : ""}</em>
      </div>`;
    return `
      <div class="ticket" data-id="${e.id}">
        <div class="ticket-top"><span>${fmtTime(e.commence_time)}</span><span>${leagueLabel(state.league)}</span></div>
        <div class="ticket-teams">${e.home_team}<span class="vs">VS</span>${e.away_team}</div>
        <div class="ticket-divider"></div>
        <div class="prices">${rows.map(cell).join("")}</div>
        <span class="edge ${cls}">Best edge ${pct(bestEdge)}</span>
      </div>`;
  }).join("");
}

function renderBoard() {
  const ev = state.events.find(e => e.id === state.selected) || state.events[0];
  if (!ev) {
    $("board").innerHTML = `<div class="empty">Nothing to compare yet.</div>`;
    $("board-sub").textContent = "Select a match to compare prices across every bookmaker.";
    return;
  }
  $("board-sub").textContent = `${ev.home_team} vs ${ev.away_team} · ${fmtTime(ev.commence_time)}`;

  const rows = analyse(ev);
  const bestFor = label => {
    const r = rows.find(x => x.label === label);
    return r && r.best ? r.best.price : null;
  };

  const bodyRows = ev.bookmakers.map(b => {
    const cells = ["1", "X", "2"].map(label => {
      const r = rows.find(x => x.label === label);
      const oc = r.prices.find(p => p.book === b.title);
      const price = oc ? oc.price : null;
      const isBest = price !== null && price === bestFor(label);
      return `<td class="${isBest ? "best" : ""}">${price !== null ? price.toFixed(2) : "–"}</td>`;
    }).join("");
    return `<tr><td>${b.title}</td>${cells}</tr>`;
  }).join("");

  $("board").innerHTML = `
    <div class="board">
      <h3>${ev.home_team} <span style="color:var(--mute)">vs</span> ${ev.away_team}</h3>
      <table>
        <thead>
          <tr><th>Bookmaker</th><th>1 · ${ev.home_team}</th><th>X · Draw</th><th>2 · ${ev.away_team}</th></tr>
        </thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>`;
}

function renderValue() {
  const all = [];
  state.events.forEach(e => {
    analyse(e).forEach(r => {
      if (r.best) all.push({ match: `${e.home_team} vs ${e.away_team}`, time: e.commence_time, ...r });
    });
  });
  all.sort((a, b) => b.edge - a.edge);
  const top = all.slice(0, 8);

  $("value").innerHTML = top.length
    ? top.map(v => `
      <div class="value-row">
        <div class="name">${v.name} <span style="color:var(--mute)">(${v.label})</span>
          <small>${v.match} · ${fmtTime(v.time)}</small></div>
        <div class="n"><small>Best price</small>${v.best.price.toFixed(2)}<small>${v.best.book}</small></div>
        <div class="n"><small>Fair prob</small>${(v.fair * 100).toFixed(1)}%</div>
        <div class="n"><small>Edge</small><span class="edge-big">${pct(v.edge)}</span></div>
      </div>`).join("")
    : `<div class="empty">No value found for this league yet.</div>`;
}

function render() {
  renderLeagues();
  renderStats();
  renderTicker();
  renderCarousel();
  renderBoard();
  renderValue();
}

$("leagues").addEventListener("click", e => {
  const btn = e.target.closest("[data-league]");
  if (!btn) return;
  state.league = btn.dataset.league;
  state.selected = null;
  loadOdds();
});

$("carousel").addEventListener("click", e => {
  const ticket = e.target.closest(".ticket");
  if (!ticket) return;
  state.selected = ticket.dataset.id;
  renderBoard();
  $("board").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("refresh-btn").addEventListener("click", loadOdds);

loadOdds();
setInterval(loadOdds, 2 * 60 * 1000);

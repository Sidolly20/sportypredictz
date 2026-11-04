// app.js - SportyPredictz front end.
// Talks only to this site's own server (/api/...). It never sees any API key.
(() => {
  "use strict";

  // ---------- helpers ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const store = {
    get(k, fallback) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: ignore */ } }
  };

  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Kickoff strings may arrive without a timezone. Treat those as UTC.
  function kick(s) {
    if (!s) return null;
    let t = String(s).trim().replace(" ", "T");
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(t)) t += "Z";
    const d = new Date(t);
    return isNaN(d) ? null : d;
  }
  const fmtTime = (d) => (d ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }) : "--:--");
  const fmtDay = (d) => (d ? d.toLocaleDateString([], { weekday: "short", day: "2-digit", month: "short" }) : "");

  const num = (v) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));
  const odd = (v) => { const n = num(v); return n && n > 1 ? n.toFixed(2) : "–"; };
  const pctTxt = (v) => (num(v) === null ? "–" : `${Math.round(num(v))}%`);
  const initials = (name) => String(name || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  function crest(team) {
    const fb = esc(initials(team && team.name));
    const logo = team && team.logo ? `<img src="${esc(team.logo)}" alt="" loading="lazy" data-fb="${fb}">` : fb;
    return `<span class="crest">${logo}</span>`;
  }
  // Teams or leagues with no badge: swap the broken image for initials.
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img && img.tagName === "IMG" && img.dataset.fb !== undefined) {
      const span = document.createElement("span");
      span.className = img.parentElement && img.parentElement.classList.contains("crest") ? "" : "lg-fb";
      span.textContent = img.dataset.fb;
      img.replaceWith(span);
    }
  }, true);

  function leagueIcon(lg) {
    const fb = esc(initials(lg && lg.name));
    return lg && lg.logo ? `<img src="${esc(lg.logo)}" alt="" loading="lazy" data-fb="${fb}">` : `<span class="lg-fb">${fb}</span>`;
  }

  // ---------- state ----------
  const state = {
    tab: "matches",
    dayIndex: 0,
    league: null,            // league id or null (all)
    matches: [],
    hasMore: false,
    offset: 0,
    loading: false,
    live: [],
    leagues: new Map(),      // id -> {id, name, logo}
    seen: new Map(),         // match id -> match (for slip / favourites / modal)
    favs: store.get("sp_favs", {}),
    slip: store.get("sp_slip", {}),
    stake: store.get("sp_stake", 1000),
    mode: "demo",
    loadToken: 0,
    view: store.get("sp_view", "cards"),
    sort: { key: "time", dir: 1 },
    openId: null
  };

  // drop favourites more than a day past kickoff
  for (const [id, m] of Object.entries(state.favs)) {
    const k = kick(m.kickoff);
    if (k && Date.now() - k.getTime() > 36 * 3600e3) delete state.favs[id];
  }

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    return { date: ymd(d), label: i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString([], { weekday: "short" }), num: pad(d.getDate()) };
  });

  // ---------- data ----------
  async function api(path) {
    const res = await fetch(path, { headers: { accept: "application/json" } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  function remember(m) {
    state.seen.set(m.id, m);
    if (m.league && m.league.id != null) state.leagues.set(m.league.id, m.league);
  }

  function setStatus(msg, kind, retry) {
    const el = $("status");
    el.className = "status" + (kind === "err" ? " err" : "");
    el.innerHTML = esc(msg) + (retry ? ` <button class="retry" id="retryBtn">Try again</button>` : "");
  }

  async function loadMatches(append = false) {
    if (state.loading) return;
    state.loading = true;
    const token = ++state.loadToken;
    if (!append) {
      state.offset = 0;
      $("moreBtn").hidden = true;
      $("list").innerHTML = '<div class="skel"></div>'.repeat(5);
    }
    const slowTimer = setTimeout(() => {
      if (state.loading && token === state.loadToken) setStatus("Waking up the data server (free hosting sleeps). This can take up to a minute…");
    }, 5000);
    setStatus("Loading matches…");

    const d = days[state.dayIndex].date;
    const q = new URLSearchParams({ date_from: d, date_to: d, limit: "20", offset: String(state.offset) });
    if (state.league != null) q.set("league_id", String(state.league));

    try {
      const data = await api(`/api/matches?${q}`);
      if (token !== state.loadToken) return;
      const list = (data.matches || []).filter((m) => m && m.id != null);
      list.forEach(remember);
      state.matches = append ? state.matches.concat(list) : list;
      state.hasMore = !!data.has_more;
      state.offset = state.matches.length;
      setStatus(data.stale ? "Showing saved data. Live refresh is temporarily unavailable." : "");
    } catch (err) {
      if (token !== state.loadToken) return;
      if (!append) state.matches = [];
      state.hasMore = false;
      setStatus(err.message, "err", true);
    } finally {
      clearTimeout(slowTimer);
      state.loading = false;
    }
    renderAll();
  }

  async function loadLive() {
    try {
      const data = await api("/api/live");
      state.live = (data.matches || []).filter((m) => m && m.id != null);
      state.live.forEach(remember);
    } catch { /* keep the previous live list */ }
    renderTicker();
    renderHeroStats();
    renderLiveBadge();
    if (state.tab === "live") renderList();
  }

  async function loadMode() {
    try {
      const s = await api("/api/status");
      state.mode = s.mode;
    } catch { /* ignore */ }
    const b = $("modeBadge");
    b.textContent = state.mode === "live" ? "LIVE DATA" : "DEMO DATA";
    b.className = "mode-badge " + state.mode;
    $("demoBanner").hidden = state.mode === "live";
  }

  // ---------- model maths ----------
  function pickOf(m) {
    const p = m.prediction;
    if (!p) return null;
    const c = [
      { side: "1", pct: num(p.home_win_pct), label: `${m.home.name} to win`, odd: num(m.odds && m.odds.home_win) },
      { side: "X", pct: num(p.draw_pct), label: "Draw", odd: num(m.odds && m.odds.draw) },
      { side: "2", pct: num(p.away_win_pct), label: `${m.away.name} to win`, odd: num(m.odds && m.odds.away_win) }
    ].filter((x) => x.pct !== null);
    if (!c.length) return null;
    return c.reduce((a, b) => (b.pct > a.pct ? b : a));
  }

  const edgeOf = (pct, price) => (num(pct) !== null && num(price) && price > 1 ? (pct / 100) * price - 1 : null);

  // ---------- rendering ----------
  function oddBtn(m, side, label, price) {
    const on = state.slip[m.id] && state.slip[m.id].side === side;
    const p = pickOf(m);
    const isModel = p && p.side === side;
    return `<button class="odd${on ? " on" : ""}${isModel ? " fav-pick" : ""}" data-act="pick" data-id="${esc(m.id)}" data-side="${esc(side)}" ${num(price) ? "" : "disabled"} aria-pressed="${on ? "true" : "false"}" aria-label="${esc(label)} ${odd(price)}"><small>${esc(label)}</small><b>${odd(price)}</b></button>`;
  }

  function rowHtml(m) {
    const k = kick(m.kickoff);
    const o = m.odds || {};
    const p = pickOf(m);
    const chip = p ? `<span class="model-chip" title="Model pick">MODEL: ${esc(p.side === "1" ? "HOME" : p.side === "2" ? "AWAY" : "DRAW")} ${Math.round(p.pct)}%</span>` : "";
    const fav = !!state.favs[m.id];
    return `
      <article class="row" data-id="${esc(m.id)}">
        <div class="when">${fmtTime(k)}<small>${esc(k ? k.toLocaleDateString([], { day: "2-digit", month: "short" }) : "")}</small></div>
        <div class="teams" data-act="open" data-id="${esc(m.id)}" role="button" tabindex="0" aria-label="Open ${esc(m.home.name)} vs ${esc(m.away.name)}">
          <div class="team">${crest(m.home)}<span class="nm">${esc(m.home.name)}</span></div>
          <div class="team">${crest(m.away)}<span class="nm">${esc(m.away.name)}</span></div>
          ${chip}
        </div>
        <div class="odds-wrap">
          <div class="odds">${oddBtn(m, "1", "1", o.home_win)}${oddBtn(m, "X", "X", o.draw)}${oddBtn(m, "2", "2", o.away_win)}</div>
          <span class="sep"></span>
          <div class="odds side-markets">${oddBtn(m, "O2.5", "O 2.5", o.over_25_goals)}${oddBtn(m, "U2.5", "U 2.5", o.under_25_goals)}${oddBtn(m, "GG", "GG", o.btts_yes)}</div>
        </div>
        <button class="star${fav ? " on" : ""}" data-act="fav" data-id="${esc(m.id)}" aria-label="${fav ? "Remove from" : "Add to"} favourites" aria-pressed="${fav}">${fav ? "★" : "☆"}</button>
      </article>`;
  }

  function liveRowHtml(m) {
    const minute = num(m.minute);
    const when = minute !== null ? `${minute}'` : esc(m.period || m.status || "LIVE");
    const sc = m.score || {};
    return `
      <article class="row live-row" data-id="${esc(m.id)}">
        <div class="when">${when}<small>LIVE</small></div>
        <div class="teams" data-act="open" data-id="${esc(m.id)}" role="button" tabindex="0">
          <div class="team">${crest(m.home)}<span class="nm">${esc(m.home.name)}</span></div>
          <div class="team">${crest(m.away)}<span class="nm">${esc(m.away.name)}</span></div>
        </div>
        <div class="score"><span>${sc.home ?? "-"}</span><span>${sc.away ?? "-"}</span></div>
        <button class="star${state.favs[m.id] ? " on" : ""}" data-act="fav" data-id="${esc(m.id)}" aria-label="Toggle favourite">${state.favs[m.id] ? "★" : "☆"}</button>
      </article>`;
  }

  function grouped(list, rowFn) {
    const groups = new Map();
    for (const m of list) {
      const key = m.league && m.league.id != null ? m.league.id : "x";
      if (!groups.has(key)) groups.set(key, { lg: m.league || { name: "Other" }, items: [] });
      groups.get(key).items.push(m);
    }
    return [...groups.values()].map((g) => `
      <div class="group-head">${leagueIcon(g.lg)}<span>${esc(g.lg.name || "Other")}</span>
        ${rowFn === rowHtml ? '<div class="cols"><span>1</span><span>X</span><span>2</span><span></span><span>O2.5</span><span>U2.5</span><span>GG</span></div>' : ""}
      </div>${g.items.map(rowFn).join("")}`).join("");
  }

  // ---------- compact table ----------
  const SORTERS = {
    time: (m) => (kick(m.kickoff) || 0).valueOf(),
    home: (m) => num(m.odds && m.odds.home_win) ?? 999,
    draw: (m) => num(m.odds && m.odds.draw) ?? 999,
    away: (m) => num(m.odds && m.odds.away_win) ?? 999,
    model: (m) => -(pickOf(m) ? pickOf(m).pct : 0)
  };
  function sorted(list) {
    const f = SORTERS[state.sort.key] || SORTERS.time;
    return [...list].sort((a, b) => (f(a) - f(b)) * state.sort.dir);
  }
  function th(key, label) {
    const on = state.sort.key === key;
    return `<th class="sortable${on ? " sorted" : ""}" data-act="sort" data-key="${key}" scope="col" aria-sort="${on ? (state.sort.dir > 0 ? "ascending" : "descending") : "none"}">${label}${on ? (state.sort.dir > 0 ? " ▲" : " ▼") : ""}</th>`;
  }
  function trow(m) {
    const k = kick(m.kickoff);
    const o = m.odds || {};
    const p = pickOf(m);
    const fav = !!state.favs[m.id];
    return `<tr class="trow" data-act="open" data-id="${esc(m.id)}" tabindex="0" role="button" aria-label="Open ${esc(m.home.name)} vs ${esc(m.away.name)}">
      <td class="l"><div class="tm"><span>${crest(m.home)}${esc(m.home.name)}</span><span>${crest(m.away)}${esc(m.away.name)}</span></div></td>
      <td class="tt">${fmtTime(k)}<small>${esc(k ? k.toLocaleDateString([], { day: "2-digit", month: "short" }) : "")}</small></td>
      <td>${oddBtn(m, "1", "1", o.home_win)}</td><td>${oddBtn(m, "X", "X", o.draw)}</td><td>${oddBtn(m, "2", "2", o.away_win)}</td>
      <td>${oddBtn(m, "O2.5", "O2.5", o.over_25_goals)}</td><td>${oddBtn(m, "GG", "GG", o.btts_yes)}</td>
      <td class="mp">${p ? `${esc(p.side)} ${Math.round(p.pct)}%` : "–"}</td>
      <td><button class="star${fav ? " on" : ""}" data-act="fav" data-id="${esc(m.id)}" aria-label="Toggle favourite">${fav ? "★" : "☆"}</button></td>
      <td class="go" aria-hidden="true">›</td></tr>`;
  }
  function tableGrouped(list) {
    const groups = new Map();
    for (const m of sorted(list)) {
      const key = m.league && m.league.id != null ? m.league.id : "x";
      if (!groups.has(key)) groups.set(key, { lg: m.league || { name: "Other" }, items: [] });
      groups.get(key).items.push(m);
    }
    return [...groups.values()].map((g) => `<div class="tbl-wrap"><table class="tbl">
      <caption>${leagueIcon(g.lg)}<span>${esc(g.lg.name || "Other")}</span></caption>
      <thead><tr><th class="l" scope="col">A vs B</th>${th("time", "Time")}${th("home", "1")}${th("draw", "X")}${th("away", "2")}<th scope="col">O2.5</th><th scope="col">GG</th>${th("model", "Model")}<th scope="col"></th><th scope="col"></th></tr></thead>
      <tbody>${g.items.map(trow).join("")}</tbody></table></div>`).join("");
  }

  function renderList() {
    const el = $("list");
    const isMatches = state.tab === "matches";
    document.querySelector(".toolbar").style.display = isMatches || state.tab === "favs" ? "" : "none";
    $("days").style.display = isMatches ? "" : "none";
    document.querySelectorAll("#viewToggle button").forEach((b) => b.classList.toggle("on", b.dataset.view === state.view));
    document.querySelector(".side").style.display = isMatches ? "" : "none";

    if (state.tab === "matches") {
      if (state.loading && !state.matches.length) return; // skeleton already shown
      el.innerHTML = state.matches.length ? (state.view === "table" ? tableGrouped(state.matches) : grouped(state.matches, rowHtml)) : `<div class="empty">No matches found for this day${state.league != null ? " in this league" : ""}.<br>Try another day.</div>`;
      $("moreBtn").hidden = !state.hasMore;
      $("moreBtn").textContent = state.loading ? "Loading…" : "Load more matches";
    } else if (state.tab === "live") {
      $("moreBtn").hidden = true;
      el.innerHTML = state.live.length ? grouped(state.live, liveRowHtml) : `<div class="empty">No matches are live right now.<br>Check back at kickoff time.</div>`;
    } else {
      $("moreBtn").hidden = true;
      const favs = Object.values(state.favs).sort((a, b) => String(a.kickoff).localeCompare(String(b.kickoff)));
      el.innerHTML = favs.length
        ? `<p class="status">Saved prices may have changed. Tap a match to see the latest.</p>` + (state.view === "table" ? tableGrouped(favs) : grouped(favs, rowHtml))
        : `<div class="empty">No favourites yet.<br>Tap the ☆ on any match to keep it here.</div>`;
    }
  }

  function renderDays() {
    $("days").innerHTML = days.map((d, i) => `<button class="day${i === state.dayIndex ? " on" : ""}" role="tab" aria-selected="${i === state.dayIndex}" data-act="day" data-i="${i}"><small>${esc(d.label)}</small><b>${d.num}</b></button>`).join("");
  }

  function renderLeagues() {
    const counts = new Map();
    state.matches.forEach((m) => { if (m.league && m.league.id != null) counts.set(m.league.id, (counts.get(m.league.id) || 0) + 1); });
    const list = [...state.leagues.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
    const all = `<button class="league-btn${state.league == null ? " on" : ""}" data-act="league" data-id="">${'<span class="lg-fb">ALL</span>'}All leagues</button>`;
    $("leagues").innerHTML = all + list.map((l) => `<button class="league-btn${String(state.league) === String(l.id) ? " on" : ""}" data-act="league" data-id="${esc(l.id)}">${leagueIcon(l)}<span>${esc(l.name)}</span>${counts.has(l.id) ? `<span class="n">${counts.get(l.id)}</span>` : ""}</button>`).join("");
  }

  function renderPicks() {
    const ranked = state.matches
      .map((m) => ({ m, p: pickOf(m) }))
      .filter((x) => x.p)
      .sort((a, b) => b.p.pct - a.p.pct)
      .slice(0, 6);
    $("picksDay").textContent = "· " + days[state.dayIndex].label;
    $("picks").innerHTML = ranked.length
      ? ranked.map(({ m, p }) => `
        <button class="pick-card" data-act="open" data-id="${esc(m.id)}">
          <div class="pick-league"><span>${esc(m.league.name)}</span><span class="mono">${fmtTime(kick(m.kickoff))}</span></div>
          <div class="pick-teams"><span>${esc(m.home.name)}</span><span class="v">vs</span><span>${esc(m.away.name)}</span></div>
          <div class="pick-foot">
            <div class="pick-says"><small>Model says</small><b>${esc(p.label)}</b>${p.odd ? `<small class="mono">Odds ${odd(p.odd)}</small>` : ""}</div>
            <div class="pick-pct">${Math.round(p.pct)}<small>%</small></div>
          </div>
        </button>`).join("")
      : `<div class="empty" style="width:100%">Model picks appear here once matches load.</div>`;
  }

  function renderTicker() {
    const label = $("tickerLabel");
    let items = "";
    if (state.live.length) {
      label.textContent = "LIVE"; label.className = "ticker-label live";
      items = state.live.map((m) => {
        const sc = m.score || {};
        return `<span class="t-item"><span class="min">${num(m.minute) !== null ? m.minute + "'" : "LIVE"}</span><b>${esc(m.home.name)}</b><span class="sc">${sc.home ?? "-"} - ${sc.away ?? "-"}</span><b>${esc(m.away.name)}</b></span>`;
      }).join("");
    } else if (state.matches.length) {
      label.textContent = "NEXT UP"; label.className = "ticker-label";
      items = state.matches.slice(0, 12).map((m) => `<span class="t-item"><b>${esc(m.home.name)}</b> v <b>${esc(m.away.name)}</b> <span class="sc">${fmtTime(kick(m.kickoff))}</span>${m.odds ? ` 1 <b>${odd(m.odds.home_win)}</b>` : ""}</span>`).join("");
    }
    $("ticker").innerHTML = items ? items + items : "";
  }

  function renderHeroStats() {
    $("stMatches").textContent = state.matches.length + (state.hasMore ? "+" : "");
    $("stLeagues").textContent = new Set(state.matches.map((m) => m.league && m.league.id)).size;
    $("stLive").textContent = state.live.length;
  }

  function renderLiveBadge() {
    const b = $("liveCount");
    b.hidden = !state.live.length;
    b.textContent = state.live.length;
  }

  function renderFavBadge() {
    const n = Object.keys(state.favs).length;
    $("favCount").hidden = !n;
    $("favCount").textContent = n;
  }

  // ---------- pick slip ----------
  const slipItems = () => Object.values(state.slip);
  const slipTotal = () => slipItems().reduce((t, s) => t * s.odd, 1);

  function renderSlip() {
    const items = slipItems();
    $("slipCount").textContent = items.length;
    $("fabCount").textContent = items.length;
    $("fabOdds").textContent = items.length ? slipTotal().toFixed(2) : "0.00";
    $("slipFab").hidden = !items.length;
    if (!items.length) $("slip").classList.remove("open");

    if (!items.length) {
      $("slipBody").innerHTML = `<p class="slip-empty">Tap any odds button to add a pick. Your slip shows the combined odds and a possible return.</p><p class="slip-note" style="margin-top:14px">This is a pick tracker. SportyPredictz does not take bets.</p>`;
      return;
    }
    const total = slipTotal();
    $("slipBody").innerHTML = items.map((s) => `
      <div class="slip-item">
        <div class="pk">${esc(s.pickLabel)}</div><div class="od">${s.odd.toFixed(2)}</div>
        <div class="mt">${esc(s.home)} v ${esc(s.away)}</div>
        <button class="rm" data-act="unpick" data-id="${esc(s.id)}">Remove</button>
      </div>`).join("") + `
      <div class="slip-total">
        <div class="line"><span>Total odds</span><b class="big">${total.toFixed(2)}</b></div>
        <div class="line"><span>Stake</span><input id="stake" type="number" inputmode="decimal" min="0" step="any" value="${esc(state.stake)}" aria-label="Stake"></div>
        <div class="line"><span>Possible return</span><b id="ret">${(total * (Number(state.stake) || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</b></div>
        <div class="btn-row"><button class="btn" data-act="clearslip">Clear</button><button class="btn solid" data-act="copyslip">Copy slip</button></div>
        <p class="slip-note">Pick tracker only. Place bets with a licensed bookmaker, where it is legal. Bet responsibly.</p>
      </div>`;
  }

  const SIDE_NAME = { "1": (m) => `${m.home.name} to win`, "X": () => "Draw", "2": (m) => `${m.away.name} to win`, "O2.5": () => "Over 2.5 goals", "U2.5": () => "Under 2.5 goals", "GG": () => "Both teams to score" };
  const SIDE_ODD = { "1": "home_win", "X": "draw", "2": "away_win", "O2.5": "over_25_goals", "U2.5": "under_25_goals", "GG": "btts_yes" };

  function togglePick(id, side) {
    const m = state.seen.get(Number(id)) || state.seen.get(id) || state.favs[id];
    if (!m || !m.odds) return;
    const price = num(m.odds[SIDE_ODD[side]]);
    if (!price) return;
    const cur = state.slip[id];
    if (cur && cur.side === side) delete state.slip[id];
    else state.slip[id] = { id, side, odd: price, pickLabel: SIDE_NAME[side](m), home: m.home.name, away: m.away.name };
    store.set("sp_slip", state.slip);
    renderAll();
    if (!$("modal").hidden) openMatch(id, true);
  }

  // ---------- favourites ----------
  function toggleFav(id) {
    const m = state.seen.get(Number(id)) || state.seen.get(id);
    if (state.favs[id]) delete state.favs[id];
    else if (m) state.favs[id] = { id: m.id, league: m.league, home: m.home, away: m.away, kickoff: m.kickoff, status: m.status, odds: m.odds, prediction: m.prediction };
    store.set("sp_favs", state.favs);
    renderAll();
  }

  // ---------- match detail ----------
  let modalToken = 0;
  async function openMatch(id, keepScroll) {
    const base = state.seen.get(Number(id)) || state.seen.get(id) || state.favs[id];
    const modal = $("modal");
    modal.hidden = false;
    document.body.style.overflow = "hidden";
    state.openId = id;
    const token = ++modalToken;
    if (base) $("modalBody").innerHTML = detailHtml(base, true);
    else $("modalBody").innerHTML = `<div class="skel"></div><div class="skel"></div>`;
    if (!keepScroll) $("modalBody").parentElement.scrollTop = 0;

    try {
      const d = await api(`/api/match/${encodeURIComponent(id)}`);
      if (token !== modalToken) return;
      const m = Object.assign({}, base || {}, d.match || {}, { odds: d.odds || (base && base.odds), prediction: d.prediction || (base && base.prediction) });
      if (m.id != null) state.seen.set(m.id, m);
      $("modalBody").innerHTML = detailHtml(m, false);
    } catch (err) {
      if (token !== modalToken) return;
      if (!base) $("modalBody").innerHTML = `<div class="empty">${esc(err.message)}</div>`;
    }
  }

  function closeMatch() {
    $("modal").hidden = true;
    document.body.style.overflow = "";
    modalToken++;
    state.openId = null;
  }


  function avbHtml(m) {
    const p = m.prediction, o = m.odds || {};
    if (!p && !m.odds) return "";
    const inv = (num(o.home_win) ? 1 / o.home_win : 0) + (num(o.draw) ? 1 / o.draw : 0) + (num(o.away_win) ? 1 / o.away_win : 0);
    const imp = (price) => (num(price) && inv ? (1 / price / inv) * 100 : null);
    const xgH = p && p.expected_goals ? num(p.expected_goals.home) : null;
    const xgA = p && p.expected_goals ? num(p.expected_goals.away) : null;
    const rows = [
      ["Model win chance", p ? num(p.home_win_pct) : null, p ? num(p.away_win_pct) : null, (v) => pctTxt(v), 1],
      ["Market win chance", imp(o.home_win), imp(o.away_win), (v) => pctTxt(v), 1],
      ["Odds", num(o.home_win), num(o.away_win), (v) => odd(v), -1],
      ["Expected goals", xgH, xgA, (v) => (v === null ? "–" : v.toFixed(1)), 1],
      ["Model edge", p ? edgeOf(p.home_win_pct, o.home_win) : null, p ? edgeOf(p.away_win_pct, o.away_win) : null, (v) => (v === null ? "–" : (v > 0 ? "+" : "") + (v * 100).toFixed(1) + "%"), 1]
    ].filter((r) => r[1] !== null || r[2] !== null);
    if (!rows.length) return "";
    const cell = (v, other, fmt, dir) => `<td class="${v !== null && other !== null && (v - other) * dir > 0 ? "win" : ""}">${fmt(v)}</td>`;
    return `<div class="d-sec"><h4>A vs B <span>Greener side leads</span></h4>
      <table class="avb"><thead><tr><th>${esc(m.home.name)}</th><th>Stat</th><th>${esc(m.away.name)}</th></tr></thead><tbody>
      ${rows.map((r) => `<tr>${cell(r[1], r[2], r[3], r[4])}<td class="k">${esc(r[0])}</td>${cell(r[2], r[1], r[3], r[4])}</tr>`).join("")}
      </tbody></table></div>`;
  }

  function detailHtml(m, loading) {
    const k = kick(m.kickoff);
    const o = m.odds || {};
    const p = m.prediction || null;
    const live = m.status && !/not|sched|upcoming|finish|ended|full/i.test(m.status) && m.score && m.score.home !== null && m.score.home !== undefined;
    const mid = live
      ? `<div class="big">${m.score.home} - ${m.score.away}</div><small class="lv">${num(m.minute) !== null ? m.minute + "'" : "LIVE"}</small>`
      : `<div class="big">${fmtTime(k)}</div><small>${esc(fmtDay(k))}</small>`;

    // 1X2: market implied (margin removed) vs model
    let bars = "";
    if (p) {
      const rows = [
        { side: "1", label: m.home.name, model: num(p.home_win_pct), price: num(o.home_win) },
        { side: "X", label: "Draw", model: num(p.draw_pct), price: num(o.draw) },
        { side: "2", label: m.away.name, model: num(p.away_win_pct), price: num(o.away_win) }
      ];
      const inv = rows.reduce((s, r) => s + (r.price ? 1 / r.price : 0), 0);
      bars = rows.map((r) => {
        const implied = r.price && inv ? (1 / r.price / inv) * 100 : null;
        const e = edgeOf(r.model, r.price);
        return `<div class="bar-row">
          <span class="lbl">${esc(r.label)}</span>
          <div class="bar" aria-hidden="true"><i style="width:${Math.max(0, Math.min(100, r.model ?? 0))}%"></i>${implied !== null ? `<u style="left:${Math.min(99, implied)}%"></u>` : ""}</div>
          <span class="v">${pctTxt(r.model)}</span>
          <span class="e ${e !== null ? (e > 0 ? "pos" : "neg") : ""}">${e !== null ? (e > 0 ? "+" : "") + (e * 100).toFixed(1) + "%" : ""}</span>
        </div>`;
      }).join("") + `<div class="legend"><span><i style="background:var(--acid)"></i>Model probability</span><span><i style="background:var(--gold)"></i>Market implied</span><span>Right column: model edge vs odds</span></div>`;
    }

    const mk = (side, key, label, modelPct) => {
      const on = state.slip[m.id] && state.slip[m.id].side === side;
      const price = num(o[key]);
      return `<div class="mkt click${on ? " on" : ""}" ${price ? `data-act="pick" data-id="${esc(m.id)}" data-side="${esc(side)}" role="button" tabindex="0"` : ""}>
        <span class="k">${esc(label)}</span>
        <span class="vv">${odd(price)}${num(modelPct) !== null ? `<small>Model ${pctTxt(modelPct)}</small>` : ""}</span></div>`;
    };

    const xg = p && p.expected_goals && num(p.expected_goals.home) !== null
      ? `${Number(p.expected_goals.home).toFixed(1)} - ${Number(p.expected_goals.away).toFixed(1)}` : "–";
    let conf = num(p && p.confidence);
    if (conf !== null && conf <= 1) conf *= 100;

    return `
      <div class="d-league">${leagueIcon(m.league)}<span>${esc(m.league && m.league.name)}</span></div>
      <div class="d-head">
        <div class="d-team">${crest(m.home)}<span>${esc(m.home.name)}</span></div>
        <div class="d-mid">${mid}</div>
        <div class="d-team">${crest(m.away)}<span>${esc(m.away.name)}</span></div>
      </div>
      <div class="d-sec"><h4>Match result <span>${loading ? "Updating…" : "1 · X · 2"}</span></h4>
        <div class="mkt-grid">${mk("1", "home_win", "1 Home", p && p.home_win_pct)}${mk("X", "draw", "X Draw", p && p.draw_pct)}${mk("2", "away_win", "2 Away", p && p.away_win_pct)}</div>
      </div>
      ${avbHtml(m)}
      ${bars ? `<div class="d-sec"><h4>Model vs market</h4>${bars}</div>` : ""}
      <div class="d-sec"><h4>Goals and both teams to score</h4>
        <div class="mkt-grid">
          ${mk("O2.5", "over_25_goals", "Over 2.5", p && p.over_25_pct)}
          ${mk("U2.5", "under_25_goals", "Under 2.5", p && num(p.over_25_pct) !== null ? 100 - p.over_25_pct : null)}
          ${mk("GG", "btts_yes", "BTTS Yes", p && p.btts_yes_pct)}
          <div class="mkt"><span class="k">BTTS No</span><span class="vv">${odd(o.btts_no)}${p && num(p.btts_yes_pct) !== null ? `<small>Model ${pctTxt(100 - p.btts_yes_pct)}</small>` : ""}</span></div>
        </div>
      </div>
      ${p ? `<div class="d-sec"><h4>Model outlook</h4>
        <div class="mkt-grid">
          <div class="mkt"><span class="k">Likely score</span><span class="vv">${esc(p.most_likely_score || "–")}</span></div>
          <div class="mkt"><span class="k">Expected goals</span><span class="vv">${xg}</span></div>
          <div class="mkt"><span class="k">Confidence</span><span class="vv">${conf !== null ? Math.round(conf) + "%" : "–"}</span></div>
        </div></div>` : `<p class="fine">No model prediction is available for this match yet.</p>`}
      <p class="fine">Odds are a market consensus (one price per market, not a bookmaker comparison). Model edge = model probability × odds − 1. It is an estimate, not a guarantee. Tap a price to add it to your pick slip.</p>`;
  }

  // ---------- events ----------
  function renderAll() {
    renderDays();
    renderLeagues();
    renderPicks();
    renderList();
    renderTicker();
    renderHeroStats();
    renderLiveBadge();
    renderFavBadge();
    renderSlip();
  }

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-act]");
    if (!t) {
      if (e.target === $("modal")) closeMatch();
      return;
    }
    const act = t.dataset.act;
    if (act === "pick") togglePick(t.dataset.id, t.dataset.side);
    else if (act === "unpick") { delete state.slip[t.dataset.id]; store.set("sp_slip", state.slip); renderAll(); if (!$("modal").hidden) openMatch(t.dataset.id, true); }
    else if (act === "fav") toggleFav(t.dataset.id);
    else if (act === "open") openMatch(t.dataset.id);
    else if (act === "day") { state.dayIndex = Number(t.dataset.i); state.league = null; loadMatches(); renderDays(); }
    else if (act === "league") { state.league = t.dataset.id === "" ? null : Number(t.dataset.id); renderLeagues(); loadMatches(); }
    else if (act === "clearslip") { state.slip = {}; store.set("sp_slip", state.slip); renderAll(); if (!$("modal").hidden) openMatch(state.openId, true); }
    else if (act === "copyslip") copySlip(t);
    else if (act === "sort") { const k = t.dataset.key; state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : 1 }; renderList(); }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("modal").hidden) closeMatch();
    if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches('[role="button"][data-act]')) {
      e.preventDefault();
      e.target.click();
    }
  });

  document.addEventListener("input", (e) => {
    if (e.target.id === "stake") {
      state.stake = e.target.value;
      store.set("sp_stake", state.stake);
      const r = $("ret");
      if (r) r.textContent = (slipTotal() * (Number(state.stake) || 0)).toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
  });

  async function copySlip(btn) {
    const items = slipItems();
    const text = items.map((s) => `${s.home} v ${s.away}: ${s.pickLabel} @ ${s.odd.toFixed(2)}`).join("\n") + `\nTotal odds: ${slipTotal().toFixed(2)}\nvia SportyPredictz`;
    try { await navigator.clipboard.writeText(text); btn.textContent = "Copied!"; }
    catch { btn.textContent = "Copy not allowed"; }
    setTimeout(() => { btn.textContent = "Copy slip"; }, 1600);
  }

  $("tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-tab]");
    if (!b) return;
    state.tab = b.dataset.tab;
    document.querySelectorAll(".tab").forEach((x) => x.classList.toggle("on", x === b));
    if (state.tab === "live") loadLive();
    renderList();
  });

  $("viewToggle").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (!b) return;
    state.view = b.dataset.view;
    store.set("sp_view", state.view);
    renderList();
  });
  document.querySelectorAll("[data-go]").forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const tab = document.querySelector(`.tab[data-tab="${a.dataset.go}"]`);
    if (tab) tab.click();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
  $("yr").textContent = new Date().getFullYear();
  $("moreBtn").addEventListener("click", () => loadMatches(true));
  $("status").addEventListener("click", (e) => { if (e.target.id === "retryBtn") loadMatches(); });
  $("modalX").addEventListener("click", closeMatch);
  $("slipFab").addEventListener("click", () => $("slip").classList.add("open"));
  $("slipClose").addEventListener("click", () => $("slip").classList.remove("open"));

  function tickClock() {
    $("clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  // ---------- start ----------
  renderAll();
  tickClock();
  setInterval(tickClock, 15000);
  loadMode();
  loadMatches();
  loadLive();
  setInterval(() => { if (!document.hidden) loadLive(); }, 45 * 1000);
  setInterval(() => { if (!document.hidden && state.tab === "matches" && !state.loading && state.offset <= 20) loadMatches(); }, 3 * 60 * 1000);
})();

// app.js - small browser helpers for SportyPredictz.
// The pages themselves are built on the server. This file adds: local kick-off times, bet-type tabs,
// search, the pick slip, saved matches and the live score ticker. It never sees any API key.
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }
  };

  // ---------- kick-off times in the visitor's own time zone ----------
  function localTimes(root = document) {
    $$("time[data-t]", root).forEach((t) => {
      const d = new Date(t.getAttribute("datetime"));
      if (Number.isNaN(d.getTime())) return;
      t.textContent = t.dataset.t === "dm"
        ? d.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })
        : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
    });
  }

  // ---------- team badges that are missing: show initials instead ----------
  document.addEventListener("error", (e) => {
    const img = e.target;
    if (img && img.tagName === "IMG" && img.dataset.fb !== undefined) {
      const s = document.createElement("span");
      s.className = img.classList.contains("lgi") ? "lg-fb" : "";
      s.textContent = img.dataset.fb;
      img.replaceWith(s);
    }
  }, true);

  // ---------- bet-type tabs (match result / goals / both teams score / double chance) ----------
  const NOTES = {
    "1x2": "Outlined price = the model's pick. Tap a price to add it to your pick slip.",
    dc: "Double chance prices are worked out from the match result odds. They are a guide (marked ~), not a quoted bookmaker price.",
    goals: "Over and under refer to total goals in normal time.",
    btts: "Both teams to score: each side must score at least once."
  };
  function setMarket(id) {
    document.body.dataset.market = id;
    $$(".mtab").forEach((b) => b.classList.toggle("on", b.dataset.market === id));
    $$("[data-mnote]").forEach((n) => { n.textContent = NOTES[id] || ""; n.classList.toggle("show", !!NOTES[id]); });
    store.set("sp_market", id);
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".mtab");
    if (b) setMarket(b.dataset.market);
  });
  if ($(".mtab")) setMarket(store.get("sp_market", "1x2"));

  // ---------- search ----------
  document.addEventListener("input", (e) => {
    const inp = e.target.closest("[data-search]");
    if (!inp) return;
    const q = inp.value.trim().toLowerCase();
    $$(".mrow[data-search], .prow[data-search]").forEach((r) => { r.hidden = !!q && !r.dataset.search.includes(q); });
    $$(".lgblock").forEach((blk) => { blk.hidden = !!q && !$(".mrow:not([hidden]), .prow:not([hidden])", blk); });
  });

  // ---------- pick slip ----------
  let slip = store.get("sp_slip", {});
  let stake = store.get("sp_stake", 1000);
  const items = () => Object.values(slip);
  const total = () => items().reduce((t, s) => t * Number(s.odd), 1);
  const money = (n) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

  function renderSlip() {
    const list = items();
    $("#slipCount").textContent = list.length;
    $("#fabCount").textContent = list.length;
    $("#fabOdds").textContent = list.length ? total().toFixed(2) : "0.00";
    $("#slipFab").hidden = !list.length;
    if (!list.length) $("#slip").classList.remove("open");
    $$(".odd[data-mid]").forEach((b) => {
      const s = slip[b.dataset.mid];
      const on = !!s && s.k === b.dataset.k;
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    if (!list.length) {
      $("#slipBody").innerHTML = `<p class="slip-empty">Tap any odds button to add a pick. Your slip adds up the odds and shows a possible return.</p><p class="slip-note">This is a pick tracker. SportyPredictz does not take bets.</p>`;
      return;
    }
    $("#slipBody").innerHTML = list.map((s) => `
      <div class="slip-item"><div class="pk">${esc(s.pick)}</div><div class="od">${s.calc ? "~" : ""}${Number(s.odd).toFixed(2)}</div>
        <div class="mt">${esc(s.teams)}</div><button type="button" class="rm" data-rm="${esc(s.mid)}">Remove</button></div>`).join("") + `
      <div class="slip-total">
        <div class="line"><span>Total odds</span><b class="big">${total().toFixed(2)}</b></div>
        <div class="line"><span>Stake</span><input id="stake" type="number" inputmode="decimal" min="0" step="any" value="${esc(stake)}" aria-label="Stake"></div>
        <div class="line"><span>Possible return</span><b id="ret">${money(total() * (Number(stake) || 0))}</b></div>
        <div class="btn-row"><button type="button" class="btn" id="slipClear">Clear</button><button type="button" class="btn solid" id="slipCopy">Copy slip</button></div>
        <p class="slip-note">Pick tracker only. Place bets with a licensed bookmaker, where it is legal. Bet responsibly.</p>
      </div>`;
  }
  const saveSlip = () => { store.set("sp_slip", slip); renderSlip(); };

  document.addEventListener("click", (e) => {
    const odd = e.target.closest(".odd[data-mid]");
    if (odd && !odd.disabled) {
      const id = odd.dataset.mid;
      if (slip[id] && slip[id].k === odd.dataset.k) delete slip[id];
      else slip[id] = { mid: id, k: odd.dataset.k, odd: odd.dataset.odd, pick: odd.dataset.pick, teams: odd.dataset.teams, calc: !!odd.dataset.calc };
      saveSlip();
      return;
    }
    const acca = e.target.closest("[data-acca]");
    if (acca) {
      try { JSON.parse(acca.dataset.acca).forEach((l) => { slip[l.mid] = { mid: String(l.mid), k: l.k, odd: l.odd, pick: l.pick, teams: l.teams, calc: false }; }); } catch { /* ignore */ }
      saveSlip();
      $("#slip").hidden = false; $("#slip").classList.add("open");
      return;
    }
    const rm = e.target.closest("[data-rm]");
    if (rm) { delete slip[rm.dataset.rm]; saveSlip(); return; }
    if (e.target.id === "slipClear") { slip = {}; saveSlip(); return; }
    if (e.target.id === "slipCopy") {
      const text = items().map((s) => `${s.teams}: ${s.pick} @ ${s.calc ? "~" : ""}${Number(s.odd).toFixed(2)}`).join("\n") + `\nTotal odds: ${total().toFixed(2)}\nvia SportyPredictz`;
      const btn = e.target;
      (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => { btn.textContent = "Copied!"; }, () => { btn.textContent = "Copy not allowed"; });
      setTimeout(() => { btn.textContent = "Copy slip"; }, 1600);
      return;
    }
    if (e.target.closest("#slipFab")) { $("#slip").hidden = false; requestAnimationFrame(() => $("#slip").classList.add("open")); return; }
    if (e.target.closest("#slipClose")) { $("#slip").classList.remove("open"); }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "stake") {
      stake = e.target.value; store.set("sp_stake", stake);
      const r = $("#ret"); if (r) r.textContent = money(total() * (Number(stake) || 0));
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") $("#slip").classList.remove("open"); });

  // ---------- saved matches ----------
  let favs = store.get("sp_favs", {});
  for (const [id, f] of Object.entries(favs)) if (Date.now() - Number(f.ts) > 36 * 3600e3) delete favs[id];

  function syncFavs() {
    $$(".star[data-fav]").forEach((b) => {
      const on = !!favs[b.dataset.mid];
      b.classList.toggle("on", on);
      b.textContent = on ? "★" : "☆";
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });
    const n = Object.keys(favs).length;
    const c = $("#favCount");
    if (c) { c.hidden = !n; c.textContent = n; }
  }
  function renderFavPage() {
    const box = $("#favList");
    if (!box) return;
    const list = Object.values(favs).sort((a, b) => a.ts - b.ts);
    box.innerHTML = list.length
      ? list.map((f) => `<article class="mrow res-row"><span class="when"><time>${esc(new Date(Number(f.ts)).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false }))}<small>${esc(new Date(Number(f.ts)).toLocaleDateString([], { day: "2-digit", month: "short" }))}</small></time></span>
          <a class="teams" href="${esc(f.path)}"><span class="team"><span class="nm">${esc(f.home)}</span></span><span class="team"><span class="nm">${esc(f.away)}</span></span><span class="lgline">${esc(f.league)}</span></a>
          <span></span><button type="button" class="star on" data-unfav="${esc(f.mid)}" aria-label="Remove">★</button></article>`).join("")
      : `<div class="empty">No saved matches yet.<br>Tap the ☆ on any match to keep it here.</div>`;
  }
  document.addEventListener("click", (e) => {
    const s = e.target.closest(".star[data-fav]");
    if (s) {
      const id = s.dataset.mid;
      if (favs[id]) delete favs[id];
      else favs[id] = { mid: id, home: s.dataset.home, away: s.dataset.away, league: s.dataset.league, ts: s.dataset.ts, path: s.dataset.path };
      store.set("sp_favs", favs); syncFavs();
      return;
    }
    const u = e.target.closest("[data-unfav]");
    if (u) { delete favs[u.dataset.unfav]; store.set("sp_favs", favs); syncFavs(); renderFavPage(); }
  });

  // ---------- live scores ----------
  async function pollLive() {
    if (document.hidden) return;
    try {
      const r = await fetch("/api/live", { headers: { accept: "application/json" } });
      if (!r.ok) return;
      const d = await r.json();
      const t = $("#ticker"), label = $("#tickerLabel");
      if (t && d.ticker) { t.innerHTML = d.ticker.items; localTimes(t); }
      if (label && d.ticker) { label.textContent = d.ticker.label; label.classList.toggle("live", d.ticker.label === "LIVE"); }
      const c = $("#liveCount");
      if (c) { c.hidden = !d.count; c.textContent = d.count; }
      const list = $("#liveList");
      if (list) { list.innerHTML = d.list; syncFavs(); }
    } catch { /* keep what is on screen */ }
  }
  setInterval(pollLive, 45 * 1000);

  // ---------- start ----------
  localTimes();
  renderSlip();
  syncFavs();
  renderFavPage();
  $("#slip").hidden = false;
})();

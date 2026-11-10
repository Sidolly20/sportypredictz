// slip.js - the guided AI slip builder page. Asks three tap questions, builds the slip with
// slip-engine.js (no language model, no paid service), and shows the result in a popup.
import { buildSlip, swapLeg, shuffleSlip, MODE_TEXT, priceNote, oneIn, thresholdsFor, upcoming, legsOf } from "/slip-engine.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DAY = { today: "Today", tomorrow: "Tomorrow", both: "Both days" };
const BAG_KEY = "sp_slip_bag";
const stage = $("#slipStage"), mine = $("#mySlip");
if (!stage) throw new Error("slip page missing");

const state = {
  data: null, step: 0, answers: { odds: null, day: null, mode: null },
  busy: false, slip: null, nothing: false, hint: "", mine: loadBag()
};

function loadBag() { try { return JSON.parse(localStorage.getItem(BAG_KEY) || "[]"); } catch { return []; } }
function saveBag() { try { localStorage.setItem(BAG_KEY, JSON.stringify(state.mine)); } catch { /* private mode */ } }
const live = () => upcoming(state.data.matches);
const opts = () => ({ mode: state.answers.mode, target: +state.answers.odds, day: state.answers.day, today: state.data.today, tomorrow: state.data.tomorrow });
const countFor = (day) => live().filter((m) => (day === "both" ? true : m.d === (day === "today" ? state.data.today : state.data.tomorrow))).length;
const fmt = (n) => (Number.isFinite(n) ? n.toFixed(2) : "–");

// ---------- stage: questions ----------
function chipsHtml() {
  const a = state.answers;
  const chips = [];
  if (a.odds) chips.push(`<button class="sb-chip" data-jump="0">${a.odds} odds</button>`);
  if (a.day) chips.push(`<button class="sb-chip" data-jump="1">${DAY[a.day]}</button>`);
  if (a.mode) chips.push(`<button class="sb-chip" data-jump="2">${MODE_TEXT[a.mode].title}</button>`);
  return chips.length ? `<div class="sb-chips" aria-label="Your answers, tap one to change it">${chips.join("")}</div>` : "";
}
const progressHtml = () => `<div class="sb-dots" aria-hidden="true">${[0, 1, 2].map((i) => `<i class="${i < state.step ? "done" : i === state.step ? "on" : ""}"></i>`).join("")}</div>`;
const backHtml = () => (state.step > 0 ? `<button class="sb-back" id="sbBack">← Back</button>` : "");

function questionHtml(step) {
  if (step === 0) return `<h2>How many odds?</h2><div class="sb-opts sb-cols-3" role="group" aria-label="Odds">${[
    [2, "lighter"], [3, "middle"], [5, "bigger, riskier"]
  ].map(([v, s]) => `<button class="sb-opt${state.answers.odds === String(v) ? " on" : ""}" data-set="odds" data-val="${v}"><b>${v} odds</b><span>${s}</span></button>`).join("")}</div>`;
  if (step === 1) return `<h2>Which day?</h2><div class="sb-opts sb-cols-3" role="group" aria-label="Day">${[
    ["today", "today's list"], ["tomorrow", "tomorrow's list"], ["both", "both lists"]
  ].map(([v, s]) => `<button class="sb-opt${state.answers.day === v ? " on" : ""}" data-set="day" data-val="${v}"><b>${DAY[v]}</b><span>${s} · ${countFor(v)} games</span></button>`).join("")}</div>`;
  return `<h2>More games, or fewer?</h2><div class="sb-opts sb-cols-2" role="group" aria-label="Combo style">${["more", "fewer"].map((v) => `<button class="sb-opt${state.answers.mode === v ? " on" : ""}" data-set="mode" data-val="${v}"><b>${MODE_TEXT[v].title}</b><span>${MODE_TEXT[v].sub}</span></button>`).join("")}</div><p class="sb-q-foot">Either way, the slip's chance stays near 1 in its total odds.</p>`;
}

const surpriseHtml = () => `<button class="sb-surprise" id="sbSurprise">✦ Surprise me</button>`;
const typeHtml = () => `<form class="sb-type" id="sbType" autocomplete="off"><label class="sr" for="sbText">Type a question</label><input id="sbText" type="text" maxlength="80" placeholder="Or type, e.g. “3 odds, tomorrow, more”"><button type="submit">Go</button></form>${state.hint ? `<p class="sb-q-sub" style="margin:6px 0 0">${esc(state.hint)}</p>` : ""}`;

function loaderHtml() {
  return `<div class="sb-card sb-loading"><div class="sb-pulse" aria-hidden="true"><i></i><i></i><i></i></div><h2>Building your slip</h2><p class="sb-q-sub" id="sbMsg">Reading the odds…</p></div>`;
}

function nothingHtml() {
  const a = state.answers;
  const btns = [];
  if (a.day !== "tomorrow") btns.push(`<button class="sb-btn solid" data-nothing="tomorrow">Try tomorrow</button>`);
  const lower = { 5: 3, 3: 2 }[+a.odds];
  if (lower) btns.push(`<button class="sb-btn" data-nothing="lower">Lower my target to ${lower} odds</button>`);
  const other = a.mode === "more" ? "fewer" : "more";
  btns.push(`<button class="sb-btn" data-nothing="mode">Try ${MODE_TEXT[other].title.toLowerCase()}</button>`);
  return `${chipsHtml()}<div class="sb-card sb-nothing"><h2>Nothing safe enough right now</h2><p class="sb-q-sub">${state.answers.mode === "more" ? "More combo only uses games the model gives at least 75% to land." : "Fewer combo still needs each game to clear the model's lowest bar, which is 55%."} Today's list doesn't have enough for this target. That's not a bad sign, just a quiet list.</p><div class="sb-nothing-btns">${btns.join("")}<button class="sb-btn" data-nothing="back">Change my answers</button></div></div>`;
}

function render() {
  if (!state.data) {
    stage.innerHTML = `<div class="sb-card"><h2>Matches are loading</h2><p class="sb-q-sub">Our data source is waking up. Try again in a moment.</p><button class="sb-btn solid" id="sbRetry">Try again</button></div>`;
    return;
  }
  if (!live().length) {
    stage.innerHTML = `<div class="sb-card"><h2>No prices yet</h2><p class="sb-q-sub">There are no matches with odds and model chances for today or tomorrow right now. Check back later.</p></div>`;
    return;
  }
  if (state.busy) { stage.innerHTML = loaderHtml(); return; }
  if (state.nothing) { stage.innerHTML = nothingHtml(); return; }
  stage.innerHTML = `${chipsHtml()}<div class="sb-top-row">${backHtml()}${progressHtml()}</div><div class="sb-card" data-step="${state.step}">${questionHtml(state.step)}</div>${state.step === 0 ? surpriseHtml() : ""}${typeHtml()}`;
}

function choose(key, val) {
  state.hint = "";
  state.answers[key] = String(val);
  state.slip = null; state.nothing = false;
  const el = stage.querySelector(`[data-set="${key}"][data-val="${val}"]`);
  if (el) el.classList.add("pop");
  setTimeout(() => {
    if (key === "odds") state.step = 1;
    else if (key === "day") state.step = 2;
    else return run();
    render();
  }, 170);
}

function run() {
  state.busy = true; state.nothing = false; render();
  const msgs = ["Reading the odds…", "Checking the model's chances…", "Mixing the markets…", "Balancing the slip…"];
  let i = 0;
  const tick = setInterval(() => { i++; const m = $("#sbMsg"); if (m) m.textContent = msgs[i % msgs.length]; }, 280);
  setTimeout(() => {
    clearInterval(tick);
    state.busy = false;
    const r = buildSlip(live(), opts());
    if (r) { state.slip = r; state.nothing = false; render(); openPopup(); }
    else { state.slip = null; state.nothing = true; render(); }
  }, 1100);
}

function surprise() {
  const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
  state.answers = { odds: pick(["2", "3", "5"]), day: pick(["today", "tomorrow", "both"]), mode: pick(["more", "fewer"]) };
  run();
}

function parseText(t) {
  const s = t.toLowerCase();
  const odds = (s.match(/\b(2|3|5)\s*odds?\b/) || [])[1] || null;
  const day = /\bboth\b/.test(s) ? "both" : /tomorrow/.test(s) ? "tomorrow" : /today/.test(s) ? "today" : null;
  const mode = /\b(fewer|less|lesser)\b/.test(s) ? "fewer" : /\b(more|safer)\b/.test(s) ? "more" : null;
  return { odds, day, mode, surprise: /surprise|random|pick for me/.test(s) };
}

// ---------- popup: the result ----------
let overlay = null;
const legRow = (l) => `<li class="sb-leg"><div class="sb-leg-m"><b>${esc(l.match.h)} v ${esc(l.match.a)}</b><span>${esc(l.pick)} · ${l.pct}% model</span></div><div class="sb-leg-r"><strong>${fmt(l.odd)}</strong><button class="sb-swap" data-swap="${esc(l.id)}:${esc(l.k)}" aria-label="Swap ${esc(l.match.h)} v ${esc(l.match.a)}">Swap</button></div></li>`;
const whyRow = (l) => `<div class="sb-why-row"><b>${esc(l.match.h)} v ${esc(l.match.a)}</b><span>${esc(l.pick)}</span><div class="sb-bars"><label>Model <em>${l.pct}%</em></label><i style="--w:${l.pct}%"></i><label>Market <em>${l.fair === null ? "–" : l.fair + "%"}</em></label><i class="mk" style="--w:${l.fair === null ? 0 : l.fair}%"></i></div><p>Price ${fmt(l.odd)}. ${esc(priceNote(l))}</p></div>`;

function slipText(s) {
  const t = MODE_TEXT[s.mode].title;
  const dayName = DAY[s.day];
  const lines = s.legs.map((l, i) => `${i + 1}. ${l.match.h} v ${l.match.a}: ${l.pick} @ ${fmt(l.odd)}`);
  return [`SportyPredictz AI slip`, `${s.target} odds · ${dayName} · ${t}`, ...lines, `Total odds: ${fmt(s.total)}`, `Information only. Not a guarantee. 18+ · Bet responsibly.`].join("\n");
}

function popupHtml(s) {
  const t = MODE_TEXT[s.mode].title;
  return `<div class="sb-sheet" role="document">
    <div class="sb-grip" aria-hidden="true"></div>
    <div class="sb-top"><div><span class="sb-kick">AI slip</span><h2>${s.target} odds · ${DAY[s.day]} · ${t}</h2></div><button class="sb-x" data-act="close" aria-label="Close">×</button></div>
    <div class="sb-stats"><div><small>Total odds</small><b>${fmt(s.total)}</b></div><div><small>Games</small><b>${s.legs.length}</b></div><div><small>Model chance</small><b>${s.chance}%</b></div></div>
    <p class="sb-honest">About 1 in ${oneIn(s.total)} slips like this come in, on average. That is a guide, not a promise.</p>
    ${s.mode === "fewer" ? `<p class="sb-note sb-note-risk">Fewer combo means bigger risk on each game. The picker still chooses the strongest options it can find.</p>` : ""}
    ${s.fallback ? `<p class="sb-note">A few picks are at a lower model chance, because there were fewer strong options on this list.</p>` : ""}
    <ol class="sb-legs">${s.legs.map(legRow).join("")}</ol>
    <details class="sb-why"><summary>Why these picks</summary>${s.legs.map(whyRow).join("")}</details>
    <div class="sb-actions">
      <button class="sb-btn" data-act="shuffle">Shuffle</button>
      <button class="sb-btn" data-act="copy">Copy</button>
      <a class="sb-btn" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(slipText(s) + "\n" + location.origin + "/build-slip")}">WhatsApp</a>
      <a class="sb-btn" target="_blank" rel="noopener" href="https://t.me/share/url?url=${encodeURIComponent(location.origin + "/build-slip")}&text=${encodeURIComponent(slipText(s))}">Telegram</a>
    </div>
    <div class="sb-actions">
      <button class="sb-btn solid" data-act="save">Add to My slip</button>
      <button class="sb-btn" data-act="again">Start again</button>
    </div>
    <p class="sb-fine">Predictions are estimates, not guarantees, and not betting advice. 18+ only. Bet responsibly, and only what you can afford to lose.</p>
  </div>`;
}

function openPopup() {
  closePopup(false);
  overlay = document.createElement("div");
  overlay.className = "sb-ov";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.setAttribute("aria-label", "Your AI slip");
  overlay.innerHTML = popupHtml(state.slip);
  document.body.append(overlay);
  document.body.classList.add("sb-lock");
  requestAnimationFrame(() => overlay.classList.add("on"));
  overlay.querySelector(".sb-x").focus();
}
function refreshPopup() { if (overlay) overlay.querySelector(".sb-sheet").outerHTML = popupHtml(state.slip); }
function closePopup(animate = true) {
  if (!overlay) return;
  const o = overlay; overlay = null;
  document.body.classList.remove("sb-lock");
  if (!animate) { o.remove(); return; }
  o.classList.remove("on");
  setTimeout(() => o.remove(), 220);
}
function toast(msg) {
  let t = $("#sbToast");
  if (!t) { t = document.createElement("div"); t.id = "sbToast"; t.className = "sb-toast"; t.setAttribute("role", "status"); document.body.append(t); }
  t.textContent = msg;
  t.classList.add("on");
  clearTimeout(toast._h);
  toast._h = setTimeout(() => t.classList.remove("on"), 2200);
}

async function doSwap(legId) {
  const next = swapLeg(live(), state.slip, legId, opts());
  if (!next) return toast("No safe swap keeps the odds right. Try Shuffle.");
  state.slip = next; refreshPopup(); toast("Game swapped. The rest of the slip stays.");
}
async function doShuffle() {
  const next = shuffleSlip(live(), state.slip, opts(), Math.random);
  if (!next) return toast("Nothing else fits right now.");
  state.slip = next; refreshPopup(); toast("Shuffled.");
}
function doCopy() {
  const text = slipText(state.slip);
  const done = () => toast("Copied. Paste it anywhere.");
  if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, () => toast("Could not copy. Select the slip and copy it."));
  else toast("Could not copy on this browser.");
}
function doSave() {
  const s = state.slip;
  state.mine.unshift({ id: Date.now(), target: s.target, day: s.day, mode: s.mode, total: s.total, stake: 10, legs: s.legs.map((l) => ({ h: l.match.h, a: l.match.a, pick: l.pick, odd: l.odd })) });
  state.mine = state.mine.slice(0, 12);
  saveBag(); renderMine();
  closePopup();
  toast("Saved to My slip below.");
}

// ---------- My slip with stake calculator ----------
function renderMine() {
  if (!mine) return;
  if (!state.mine.length) { mine.innerHTML = `<h2 class="sb-mine-h">My slip</h2><p class="sb-q-sub">Slips you save show here, with a simple stake calculator. Nothing is placed or paid from this page.</p>`; return; }
  mine.innerHTML = `<h2 class="sb-mine-h">My slip</h2><p class="sb-q-sub">A calculator only. Nothing is placed or paid from this page.</p>${state.mine.map((s) => `<article class="sb-mine-card" data-id="${s.id}">
    <div class="sb-mine-top"><b>${s.target} odds · ${DAY[s.day]} · ${MODE_TEXT[s.mode].title}</b><button class="sb-link" data-remove="${s.id}">Remove</button></div>
    <ul>${s.legs.map((l) => `<li>${esc(l.h)} v ${esc(l.a)} · ${esc(l.pick)} @ ${fmt(l.odd)}</li>`).join("")}</ul>
    <div class="sb-calc"><label>Stake <input type="number" min="0" step="1" value="${s.stake}" data-stake="${s.id}"></label><div><small>Total odds ${fmt(s.total)}</small><b data-ret="${s.id}">${fmt(s.stake * s.total)}</b><small>possible return</small></div></div>
  </article>`).join("")}`;
}

// ---------- events (delegated, bound once) ----------
stage.addEventListener("click", (e) => {
  const t = e.target.closest("button, a");
  if (!t) return;
  if (t.dataset.set) return choose(t.dataset.set, t.dataset.val);
  if (t.dataset.jump !== undefined) { state.step = +t.dataset.jump; state.slip = null; state.nothing = false; return render(); }
  if (t.id === "sbBack") { state.step = Math.max(0, state.step - 1); state.nothing = false; return render(); }
  if (t.id === "sbSurprise") return surprise();
  if (t.id === "sbRetry") return loadData();
  if (t.dataset.nothing) {
    const a = state.answers;
    if (t.dataset.nothing === "back") { state.nothing = false; state.step = 2; return render(); }
    if (t.dataset.nothing === "tomorrow") a.day = "tomorrow";
    if (t.dataset.nothing === "lower") a.odds = String({ 5: 3, 3: 2 }[+a.odds]);
    if (t.dataset.nothing === "mode") a.mode = a.mode === "more" ? "fewer" : "more";
    return run();
  }
});
stage.addEventListener("submit", (e) => {
  if (!e.target.matches("#sbType")) return;
  e.preventDefault();
  const raw = ($("#sbText").value || "").trim();
  if (!raw) { state.hint = "Type something like “3 odds, tomorrow, more”, or tap a card above."; return render(); }
  const p = parseText(raw);
  if (p.surprise) return surprise();
  if (!p.odds && !p.day && !p.mode) { state.hint = "I didn't catch that. Try “3 odds, tomorrow, more”, or tap a card above."; return render(); }
  state.hint = "";
  state.answers = { odds: p.odds || state.answers.odds, day: p.day || state.answers.day, mode: p.mode || state.answers.mode };
  if (state.answers.odds && state.answers.day && state.answers.mode) return run();
  state.nothing = false;
  state.step = !state.answers.odds ? 0 : !state.answers.day ? 1 : 2;
  render();
});

document.addEventListener("click", (e) => {
  if (!overlay) return;
  const t = e.target.closest("button, a");
  if (e.target === overlay) return closePopup();
  if (!t || !overlay.contains(t)) return;
  if (t.dataset.act === "close") return closePopup();
  if (t.dataset.act === "shuffle") return doShuffle();
  if (t.dataset.act === "copy") return doCopy();
  if (t.dataset.act === "save") return doSave();
  if (t.dataset.act === "again") { closePopup(); state.answers = { odds: null, day: null, mode: null }; state.step = 0; state.slip = null; return render(); }
  if (t.dataset.swap) { const [id] = t.dataset.swap.split(":"); const leg = state.slip.legs.find((l) => String(l.id) === id); return leg && doSwap(leg.id); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && overlay) closePopup(); });

mine.addEventListener("click", (e) => {
  const r = e.target.closest("[data-remove]");
  if (!r) return;
  state.mine = state.mine.filter((s) => String(s.id) !== r.dataset.remove);
  saveBag(); renderMine();
});
mine.addEventListener("input", (e) => {
  const inp = e.target.closest("[data-stake]");
  if (!inp) return;
  const s = state.mine.find((x) => String(x.id) === inp.dataset.stake);
  if (!s) return;
  s.stake = Math.max(0, +inp.value || 0);
  saveBag();
  const out = mine.querySelector(`[data-ret="${s.id}"]`);
  if (out) out.textContent = fmt(s.stake * s.total);
});

// ---------- start ----------
function renderGlance() {
  const box = $("#sbGlance");
  if (!box || !state.data) return;
  const all = live();
  const today = all.filter((m) => m.d === state.data.today);
  const tomorrow = all.filter((m) => m.d === state.data.tomorrow);
  const top = all.map((m) => ({ m, best: legsOf(m).sort((a, b) => b.pct - a.pct)[0] })).filter((x) => x.best)
    .sort((a, b) => b.best.pct - a.best.pct).slice(0, 3);
  box.innerHTML = `<h3>Matches with prices</h3>
    <div class="sb-stat2"><div><b>${today.length}</b><span>today</span></div><div><b>${tomorrow.length}</b><span>tomorrow</span></div></div>
    <h3>Strongest model picks</h3>
    ${top.length ? `<ul class="sb-top3">${top.map((x) => `<li><a href="/match/${esc(x.m.id)}"><b>${esc(x.m.home.name)} vs ${esc(x.m.away.name)}</b><span>${esc(x.best.pick)} · ${x.best.pct}% model</span></a></li>`).join("")}</ul>` : `<p class="sb-q-sub">No picks above the minimum right now.</p>`}`;
}
function wireCalc() {
  const o = $("#calcOdds"), s = $("#calcStake"), out = $("#calcOut");
  if (!o || !s || !out) return;
  const update = () => { const v = (+o.value || 0) * (+s.value || 0); out.textContent = v.toFixed(2); };
  o.addEventListener("input", update);
  s.addEventListener("input", update);
  update();
}

async function loadData() {
  stage.innerHTML = `<div class="sb-card sb-loading"><div class="sb-pulse" aria-hidden="true"><i></i><i></i><i></i></div><h2>Loading today's matches</h2><p class="sb-q-sub">One moment.</p></div>`;
  try {
    const r = await fetch("/api/slip-data", { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(String(r.status));
    state.data = await r.json();
  } catch { state.data = null; }
  render();
  renderGlance();
}
renderMine();
wireCalc();
loadData();

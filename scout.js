// scout.js - Scout's FAQ panel (opened from the green FAQ button), a live match list, and the notes microphone.
// The big logo on the page links straight to the AI slip builder. No language model, no paid service.
import { legsOf, upcoming } from "/slip-engine.js";

const $ = (s, r = document) => r.querySelector(s);

// ---------- Scout FAQ and match list ----------
const ANSWERS = [
  { id: "greet", re: /\b(hi|hello|hey|who are you|what are you|your name)\b/, a: "Hi, I'm Scout, the AI helper on SportyPredictz. I can list today's and tomorrow's matches, explain the picks, and build you a slip. I'm upfront about what I can't do." },
  { id: "guarantee", re: /\b(guarantee|guaranteed|sure win|sure bet|certain|definite|can'?t lose|cannot lose)\b/, a: "No guarantee, ever. A football result can turn on one deflection or one late injury. If anyone promises a sure win, don't trust them.", link: ["/responsible-gambling", "Responsible gambling"] },
  { id: "accuracy", re: /\b(accura\w*|correct|right picks|win rate|hit rate|track record)\b/, a: "Honest answer: sometimes right, sometimes not. Football is full of surprises. Judge the picks by the whole record over time, not by one good or bad weekend.", link: ["/track-record", "See the track record"] },
  { id: "free", re: /\b(free|cost|pay|paid|subscription)\b/, a: "Reading the predictions and using Scout is free. We don't take bets and we don't sell tips in a shop." },
  { id: "notes", re: /\b(note|notes|mic|microphone|speak|voice|talk)\b/, a: "Notes have a microphone. Tap it, speak, and your words are typed out. Everything stays in your browser.", link: ["/notes", "Open notes"] },
  { id: "slip", re: /\b(slip|slips|combo|combos|combination|accumulator|acca|build|builder)\b/, a: "Yes. The AI slip builder asks three quick questions and builds the slip for you, with the reasons shown.", link: ["/build-slip", "Open the AI slip builder"] },
  { id: "matches", re: /\b(today|tomorrow|match|matches|fixture|fixtures)\b/ },
  { id: "how", re: /\b(how|work|works|odds|margin|model|built|made)\b/, a: "I read the bookmaker's odds, take out their built-in margin to estimate the market's own chance, and set that beside the model's read. You get the numbers, and you decide what to make of them.", link: ["/ai-football-predictions", "Read how it works"] }
];
const FALLBACK = { a: "I'm not sure about that one. Try asking for today's matches, the odds, notes or the AI slip builder." };
const CHIPS = ["Build an AI slip", "Today's matches", "Tomorrow's matches", "How accurate?", "Is it free?", "Can it guarantee wins?", "How does it work?", "Open notes"];

const fab = $("#scoutFab"), panel = $("#scoutPanel");
if (fab && panel) {
  const log = $("#scoutLog"), chipBox = $("#scoutChips"), form = $("#scoutForm"), input = $("#scoutInput"), closeBtn = $("#scoutX");
  let greeted = false, cache = null;

  const addNode = (node) => { log.append(node); log.scrollTop = log.scrollHeight; };
  const addMsg = (who, text, link) => {
    const div = document.createElement("div");
    div.className = `scout-msg ${who}`;
    div.textContent = text;
    if (link) {
      div.append(" ");
      const a = document.createElement("a");
      a.href = link[0];
      a.textContent = link[1];
      div.append(a);
    }
    addNode(div);
  };

  async function matchList(which) {
    const tomorrow = which === "tomorrow";
    try {
      if (!cache) {
        const r = await fetch("/api/slip-data", { headers: { accept: "application/json" } });
        if (!r.ok) throw new Error(String(r.status));
        cache = await r.json();
      }
    } catch {
      return addMsg("bot", "I can't reach the match list right now. Try again in a moment.");
    }
    const key = tomorrow ? cache.tomorrow : cache.today;
    const rows = upcoming(cache.matches)
      .filter((m) => m.d === key)
      .map((m) => ({ m, top: legsOf(m).sort((a, b) => b.pct - a.pct || b.odd - a.odd)[0] }))
      .filter((x) => x.top)
      .sort((a, b) => b.top.pct - a.top.pct)
      .slice(0, 8);
    if (!rows.length) return addMsg("bot", `No matches with prices for ${tomorrow ? "tomorrow" : "today"} yet. Check back later.`);

    const box = document.createElement("div");
    box.className = "scout-msg bot scout-list";
    const head = document.createElement("div");
    head.textContent = `${tomorrow ? "Tomorrow" : "Today"}: strongest model picks first.`;
    box.append(head);
    rows.forEach(({ m, top }) => {
      const a = document.createElement("a");
      a.className = "scout-row";
      a.href = `/match/${m.id}`;
      const name = document.createElement("b");
      name.textContent = `${m.h} v ${m.a}`;
      const pick = document.createElement("span");
      pick.textContent = `${top.pick} · ${top.pct}% model · ${top.odd.toFixed(2)}`;
      a.append(name, pick);
      box.append(a);
    });
    const more = document.createElement("div");
    more.className = "scout-more";
    more.append("Full list: ");
    const link = document.createElement("a");
    link.href = tomorrow ? "/football-predictions-tomorrow" : "/football-predictions-today";
    link.textContent = tomorrow ? "Tomorrow's predictions" : "Today's predictions";
    more.append(link);
    box.append(more);
    addNode(box);
  }

  const answer = (text) => {
    addMsg("me", text);
    const q = text.toLowerCase();
    const hit = ANSWERS.find((r) => r.re.test(q)) || FALLBACK;
    if (hit.id === "matches") return matchList(/tomorrow/.test(q) ? "tomorrow" : "today");
    setTimeout(() => addMsg("bot", hit.a, hit.link), 300);
  };

  const open = (on) => {
    panel.hidden = !on;
    fab.setAttribute("aria-expanded", String(on));
    if (on && !greeted) {
      greeted = true;
      addMsg("bot", "Hi, I'm Scout. Ask for today's or tomorrow's matches, the odds, or how the slip builder works.");
    }
    if (on && window.matchMedia("(pointer: fine)").matches) input.focus();
  };

  CHIPS.forEach((label) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", () => answer(label));
    chipBox.append(b);
  });

  fab.addEventListener("click", () => open(panel.hidden));
  closeBtn.addEventListener("click", () => { open(false); fab.focus(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !panel.hidden) { open(false); fab.focus(); } });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    answer(text.slice(0, 160));
  });
}

// ---------- Notes page: typing, saving and the microphone ----------
const box = $("#notesBox");
if (box) {
  const KEY = "sp_notes";
  const count = $("#wordCount"), status = $("#micStatus"), mic = $("#micBtn"), micLabel = $("#micLabel"), copy = $("#copyNotes"), clear = $("#clearNotes");
  const words = (t) => (t.trim() ? t.trim().split(/\s+/).length : 0);
  const joinText = (a, b) => (!a ? b : /\s$/.test(a) ? a + b : a + " " + b);
  const save = () => {
    try { localStorage.setItem(KEY, box.value); } catch { /* private mode: keep it on screen only */ }
    count.textContent = `${words(box.value)} ${words(box.value) === 1 ? "word" : "words"}`;
  };

  try { box.value = localStorage.getItem(KEY) || ""; } catch { /* ignore */ }
  save();
  box.addEventListener("input", save);

  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null, listening = false, base = "";

  const setMic = (on) => {
    listening = on;
    mic.setAttribute("aria-pressed", String(on));
    micLabel.textContent = on ? "Stop" : "Start speaking";
  };

  if (!SR) {
    mic.disabled = true;
    status.textContent = "Voice typing isn't available in this browser. Try Chrome on Android or Safari on iPhone. You can still type here.";
  } else {
    rec = new SR();
    rec.lang = navigator.language || "en-GB";
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e) => {
      let finalText = "", interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interim += t;
      }
      if (finalText) base = joinText(base, finalText.trim());
      box.value = joinText(base, interim.trim());
      save();
    };

    rec.onerror = (e) => {
      const msgs = {
        "not-allowed": "The microphone is blocked. Allow it in your browser settings, then try again.",
        "service-not-allowed": "The microphone is blocked. Allow it in your browser settings, then try again.",
        "no-speech": "I didn't hear anything. Tap the mic and try again.",
        "audio-capture": "No microphone was found on this device."
      };
      status.textContent = msgs[e.error] || "The microphone stopped. Tap it to start again.";
      setMic(false);
    };

    rec.onend = () => {
      if (listening) {
        base = box.value;
        setMic(false);
        status.textContent = "Stopped. Your words are saved in this browser.";
        save();
      }
    };

    mic.addEventListener("click", () => {
      if (listening) { rec.stop(); return; }
      base = box.value;
      try {
        rec.start();
        setMic(true);
        status.textContent = "Listening. Speak now, and tap Stop when you're done.";
      } catch {
        status.textContent = "Give it a second, then tap the mic again.";
      }
    });
  }

  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(box.value);
      status.textContent = "Copied.";
    } catch {
      box.select();
      status.textContent = "Press and hold the text to copy it.";
    }
  });

  clear.addEventListener("click", () => {
    if (!box.value.trim() || confirm("Clear all your notes in this browser?")) {
      box.value = "";
      base = "";
      save();
      status.textContent = "Notes cleared.";
    }
  });
}

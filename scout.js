// scout.js - Scout, the AI helper in the corner, and the microphone on the notes page.
// No paid service and no language model: Scout answers from a short list of plain answers written here.
// The microphone uses the browser's own speech recognition. Notes stay in this browser only.
(() => {
  "use strict";

  const $ = (s, r = document) => r.querySelector(s);

  // ---------- Scout ----------
  const ANSWERS = [
    { re: /\b(hi|hello|hey|who are you|what are you|your name)\b/, a: "Hi, I'm Scout, the AI helper on SportyPredictz. I explain the picks and the odds, and I'm upfront about what I can't do." },
    { re: /\b(guarantee|guaranteed|sure win|sure bet|certain|definite|can'?t lose|cannot lose)\b/, a: "No guarantee, ever. A football result can turn on one deflection or one late injury. If anyone promises a sure win, don't trust them.", link: ["/responsible-gambling", "Responsible gambling"] },
    { re: /\b(accura\w*|correct|right picks|win rate|hit rate|track record)\b/, a: "Honest answer: sometimes right, sometimes not. Football is full of surprises. Judge the picks by the whole record over time, not by one good or bad weekend.", link: ["/track-record", "See the track record"] },
    { re: /\b(free|cost|pay|paid|subscription)\b/, a: "Reading the predictions and using Scout is free. We don't take bets and we don't sell tips in a shop." },
    { re: /\b(note|notes|mic|microphone|speak|voice|talk)\b/, a: "Notes have a microphone. Tap it, speak, and your words are typed out. Everything stays in your browser.", link: ["/notes", "Open notes"] },
    { re: /\b(slip|slips|combo|combos|combination|accumulator|acca|build|builder)\b/, a: "Yes. The AI slip builder asks three quick questions and builds the slip for you, with the reasons shown.", link: ["/build-slip", "Open the AI slip builder"] },
    { re: /\b(today|tomorrow|match|matches|fixture|fixtures)\b/, a: "Today's and tomorrow's matches are one tap away.", link: ["/football-predictions-today", "Today's matches"] },
    { re: /\b(how|work|works|odds|margin|model|built|made)\b/, a: "I read the bookmaker's odds, take out their built-in margin to estimate the market's own chance, and set that beside the model's read. You get the numbers, and you decide what to make of them.", link: ["/ai-football-predictions", "Read how it works"] }
  ];
  const FALLBACK = { a: "I'm not sure about that one. Try asking about accuracy, odds, notes or today's matches." };
  const CHIPS = ["Build an AI slip", "How accurate?", "Is it free?", "Can it guarantee wins?", "How does it work?", "Open notes", "Today's matches"];

  const fab = $("#scoutFab"), panel = $("#scoutPanel");
  // Attention: the bubble appears for a few seconds after the page loads, then steps back.
  const bubble = $("#scoutBubble");
  if (bubble) {
    setTimeout(() => bubble.classList.add("on"), 1200);
    setTimeout(() => bubble.classList.remove("on"), 11000);
  }
  if (fab && panel) {
    const log = $("#scoutLog"), chipBox = $("#scoutChips"), form = $("#scoutForm"), input = $("#scoutInput"), closeBtn = $("#scoutX");
    let greeted = false;

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
      log.append(div);
      log.scrollTop = log.scrollHeight;
    };

    const answer = (text) => {
      addMsg("me", text);
      const q = text.toLowerCase();
      const hit = ANSWERS.find((r) => r.re.test(q)) || FALLBACK;
      setTimeout(() => addMsg("bot", hit.a, hit.link), 300);
    };

    const open = (on) => {
      panel.hidden = !on;
      fab.setAttribute("aria-expanded", String(on));
      if (on && !greeted) {
        greeted = true;
        addMsg("bot", "Hi, I'm Scout. Ask me anything about the picks, the odds or this site. I won't promise results, but I'll be straight with you.");
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

    fab.addEventListener("click", () => { if (bubble) bubble.classList.remove("on"); open(panel.hidden); });
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
})();

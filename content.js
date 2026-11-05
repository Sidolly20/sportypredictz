// content.js - all the written copy: prediction categories, FAQs, static pages, match analysis.
// Edit the words here. No coding needed, just keep the quotes and commas as they are.

import { num, fmtOdd, edgeOf, bestSide, longDate, clock } from "./logic.js";

export const SITE_NAME = "SportyPredictz";

// ---------- prediction categories ----------
export const CATEGORIES = [
  {
    slug: "banker-picks",
    name: "Banker picks",
    short: "The matches where our model is most sure of the result.",
    title: "Banker Football Predictions Today: Most Likely Results",
    desc: "Today's banker football predictions: matches where the model gives one side a 62% chance or better, with odds and a quick breakdown for each.",
    h1: "Banker football predictions",
    intro: [
      "A banker is the pick you feel safest about: the match where one team is clearly ahead on the numbers. Here we list every upcoming match where the model rates one side at 62% or higher to win, strongest first.",
      "Safe does not mean certain. A 70% pick still loses three times in ten, and short odds mean a small return when it lands. Use this list to find the matches worth a closer look, then open the match page to see the full picture before you decide."
    ],
    faq: [
      ["How is a banker pick chosen?", "We take the model's win probability for each side. If one side is at 62% or more, the match shows up here, ranked from highest to lowest."],
      ["Are banker picks guaranteed?", "No. Nothing in football is. Favourites lose all the time, which is why the odds next to each pick matter as much as the percentage."],
      ["Why are the odds so low on some bankers?", "Because the bookmaker market agrees with the model. When both think a team is a strong favourite, the price drops."]
    ]
  },
  {
    slug: "home-wins",
    name: "Home wins",
    short: "Teams the model backs to win in front of their own fans.",
    title: "Home Win Predictions Today: Best Home Team Tips",
    desc: "Home win football predictions for today and the next two days. Teams rated at 50% or higher to win at home, with market odds.",
    h1: "Home win predictions",
    intro: [
      "Home advantage is real, and it shows in the numbers: home teams win more often than away teams in almost every league. This page lists the upcoming matches where the model gives the home side a 50% chance or better.",
      "Look at the odds as well as the percentage. When the model rates a home team higher than the market price suggests, that match also appears in our value bets list."
    ],
    faq: [
      ["What counts as a home win prediction here?", "Any match where the model gives the home team at least a 50% chance of winning in 90 minutes."],
      ["Does this include extra time or penalties?", "No. The 1X2 market covers the 90 minutes plus stoppage time only."],
      ["Where do the odds come from?", "They are a single market consensus price from our data provider, not a comparison across bookmakers."]
    ]
  },
  {
    slug: "away-wins",
    name: "Away wins",
    short: "Visitors the model thinks can win on the road.",
    title: "Away Win Predictions Today: Best Away Team Tips",
    desc: "Away win football predictions: road teams rated at 42% or higher to win, with odds. Updated through the day.",
    h1: "Away win predictions",
    intro: [
      "Away wins are harder to find, so the bar here is lower: we list visiting teams the model gives a 42% chance or better. That is still a strong number for a team playing in someone else's stadium.",
      "Away favourites usually pay better than home favourites. That can be a good thing, but check the match page first and see whether the gap in strength is real or just a weak home side having a bad run."
    ],
    faq: [
      ["Why is the cut-off lower than for home wins?", "Away teams win less often overall, so a 42% chance on the road is already a strong signal."],
      ["Can an away pick also appear in value bets?", "Yes. If the odds are higher than the model thinks they should be, the match appears in both lists."]
    ]
  },
  {
    slug: "draws",
    name: "Draw predictions",
    short: "Evenly matched games where a draw is the live option.",
    title: "Draw Predictions Today: Matches Likely to End Level",
    desc: "Football draw predictions: matches where the model gives the draw 28% or more, with draw odds for each game.",
    h1: "Draw predictions",
    intro: [
      "A draw almost never looks like the obvious result, yet roughly one match in four ends level. The model flags matches where the draw sits at 28% or higher, which usually means two evenly matched sides or two cautious ones.",
      "Draw odds tend to be generous, often above 3.00. That is the appeal and the risk: you will be wrong more often than right, so treat it as a small-stakes pick."
    ],
    faq: [
      ["How often do football matches end in a draw?", "Around 25% of matches in the major leagues, though it changes a lot from league to league."],
      ["What does a 30% draw chance mean?", "That if the same match were played many times, about three in ten would finish level."]
    ]
  },
  {
    slug: "over-2-5-goals",
    name: "Over 2.5 goals",
    short: "Matches likely to see three goals or more.",
    title: "Over 2.5 Goals Predictions Today: High-Scoring Matches",
    desc: "Over 2.5 goals football predictions: matches where the model gives a 55% chance or better of three or more goals.",
    h1: "Over 2.5 goals predictions",
    intro: [
      "Over 2.5 goals simply means three goals or more in the match, by either team. We list every upcoming match where the model rates that at 55% or higher, with the highest chances first.",
      "Goals markets are less about who wins and more about how the game is likely to be played. Open a match page to see the expected goals for each side and the most likely scoreline."
    ],
    faq: [
      ["What does over 2.5 goals mean?", "Three or more goals in total in normal time. A 2-1 result is over 2.5. A 1-1 draw is under."],
      ["Does stoppage time count?", "Yes. Goals in added time count. Extra time in a cup match does not."],
      ["How do I find the matching under pick?", "Open the Under 2.5 goals page. It is the same model with the percentage the other way round."]
    ]
  },
  {
    slug: "under-2-5-goals",
    name: "Under 2.5 goals",
    short: "Tighter games where two goals or fewer is the likely outcome.",
    title: "Under 2.5 Goals Predictions Today: Low-Scoring Matches",
    desc: "Under 2.5 goals football predictions: matches where the model gives a 55% chance or better of two goals or fewer.",
    h1: "Under 2.5 goals predictions",
    intro: [
      "Under 2.5 means two goals or fewer. These are the games the model expects to be tight, cagey or defensive: matches where a single goal could decide the whole thing.",
      "Low-scoring picks are often priced close to even money, so the return is modest. They also tend to be nervous to sit through, since one early goal can change everything."
    ],
    faq: [
      ["Is under 2.5 the same as both teams not scoring?", "No. A 2-0 result is under 2.5 even though one team scored twice. Both teams to score is a different market."],
      ["How is the percentage worked out?", "It is 100% minus the model's chance of over 2.5 goals."]
    ]
  },
  {
    slug: "both-teams-to-score",
    name: "Both teams to score",
    short: "Matches where each side is expected to find the net.",
    title: "Both Teams to Score (BTTS) Predictions Today",
    desc: "BTTS football predictions today: matches where the model gives both teams a 55% chance or better of scoring.",
    h1: "Both teams to score predictions",
    intro: [
      "Both teams to score, often called BTTS or GG, wins if each side scores at least once, whatever the final result. We list matches where the model puts that at 55% or higher.",
      "It is a popular market because you do not need to pick a winner. It helps to check the team news, though: a missing striker or a changed goalkeeper can swing it either way."
    ],
    faq: [
      ["What does GG mean?", "Goal-goal. Another name for both teams to score."],
      ["Does the match need to be a draw?", "No. 3-1 and 2-2 both count. 2-0 does not."],
      ["Where can I see the No option?", "On each match page. The 'one or none' price is shown next to the BTTS yes price."]
    ]
  },
  {
    slug: "double-chance",
    name: "Double chance",
    short: "Two of three results covered. Safer picks, shorter odds.",
    title: "Double Chance Predictions Today: Safer Football Tips",
    desc: "Double chance football predictions: home or draw, or draw or away, where the model gives the pair a 72% chance or better.",
    h1: "Double chance predictions",
    intro: [
      "Double chance covers two of the three results in one bet: home or draw (1X), draw or away (X2), or home or away (12). You only lose if the one result you left out happens.",
      "The prices on this page are calculated from the match result odds, so they are a guide and not a quoted bookmaker price. Always check the actual price with your bookmaker before you decide."
    ],
    faq: [
      ["How are the double chance odds calculated?", "We combine the 1X2 prices mathematically. Real bookmaker prices can be slightly different."],
      ["When does 1X or X2 make sense?", "When you think a team will not lose but you are less sure they will win."]
    ]
  },
  {
    slug: "value-bets",
    name: "Value bets",
    short: "Where the model is more optimistic than the market.",
    title: "Football Value Bets Today: Model vs Market Odds",
    desc: "Football value bets: matches where the model's probability times the odds comes out above break-even. Model edge shown for every pick.",
    h1: "Football value bets",
    intro: [
      "A value bet is not the most likely result. It is a result the market is underpricing compared with our model. We show the edge as model probability multiplied by the odds, minus one. Above zero means the model thinks the price is too big.",
      "Be honest with yourself about what this is: one model's opinion. Models are wrong, injuries are missed, and a big edge can simply mean the model has not seen something. Use it as a reason to look closer, not a reason to bet bigger."
    ],
    faq: [
      ["What does model edge mean?", "Model probability multiplied by the odds, minus 1. A +10% edge means that, if the model is right, every 100 staked would return 110 on average over time."],
      ["Why do some picks have long odds?", "Value often hides in longer prices. We hide anything above 6.00 and anything the model rates below 30%."],
      ["Is a value bet a safe bet?", "No. Value and safety are different things. A value pick can lose most of the time."]
    ]
  },
  {
    slug: "accumulator-tips",
    name: "Accumulator tips",
    short: "Ready-made accas built from the most likely picks.",
    title: "Accumulator Tips Today: 2 Odds and 5 Odds Football Acca",
    desc: "Football accumulator tips today: a 2-odds and a 5-odds acca built from the model's most likely results. Add the whole acca to your slip in one tap.",
    h1: "Accumulator tips",
    intro: [
      "We build two accas each day by stacking the most likely results until the total odds reach about 2.00 and 5.00. We keep to two picks per league, so a single bad day in one competition cannot sink everything.",
      "Every extra leg lowers your chance of winning. A 5-odds acca of favourites can look comfortable on paper and still fall apart on one late goal. Stake small."
    ],
    faq: [
      ["How is the acca built?", "We take the picks with the highest model probability, skip anything priced below 1.12 or above 3.00, and add legs until the total odds reach the target."],
      ["Can the acca change during the day?", "Yes. If odds move or a match kicks off, the acca is rebuilt on the next refresh."],
      ["What is the pick slip?", "A simple tracker on this site. It adds up your odds. It does not place bets."]
    ]
  }
];

export const CAT_BY_SLUG = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));

// ---------- home page ----------
export const HOME = {
  title: "Football Predictions Today, Odds and Tips | SportyPredictz",
  desc: "Free football predictions for today and tomorrow with market odds, win probabilities, over/under goals and both-teams-to-score picks for every match. Live scores and league tables.",
  how: [
    "Every match on SportyPredictz comes with two things side by side: the market odds and a probability from a statistical model. When the two disagree, that is usually where the interesting picks are.",
    "We do not sell tips and we do not take bets. The site is a quick way to check the numbers before you decide anything, with the 1X2 result, goals and both-teams-to-score markets all in one place.",
    "The odds are a single market consensus price per outcome, not a bookmaker-by-bookmaker comparison. We say so on every page, because it matters."
  ],
  faq: [
    ["Are the predictions free?", "Yes. Everything on SportyPredictz is free to read."],
    ["Can I bet on this site?", "No. SportyPredictz is an information site and does not take bets. Use a licensed bookmaker where gambling is legal."],
    ["How accurate are the predictions?", "Nobody can promise accuracy in football. The model gives probabilities, not certainties. A 70% pick still loses 3 times in 10."],
    ["How often is the data updated?", "Odds and probabilities refresh every few minutes through the day. Live scores update about every 30 seconds."],
    ["What does the model edge number mean?", "Model probability multiplied by the odds, minus 1. It shows where the model and the market disagree."],
    ["Which time zone are the kick-off times in?", "Your own. We convert every kick-off to the time zone of your device."]
  ]
};

// ---------- static pages ----------
export const PAGES = {
  about: {
    title: "About SportyPredictz",
    desc: "SportyPredictz is a free football predictions site: market odds, model probabilities, live scores and league tables in one place.",
    h1: "About SportyPredictz",
    body: [
      "<p>SportyPredictz started with a simple annoyance: checking a football match meant opening four different sites for odds, form, live scores and the league table. We put the useful parts on one fast page.</p>",
      "<p>For every upcoming match you can see the market odds for the result, goals and both-teams-to-score, next to a probability from a statistical model. Where the two disagree, we point it out.</p>",
      "<h2>What we are not</h2>",
      "<p>We are not a bookmaker and we do not take bets. We do not sell tips, and we do not promise winners. Football is unpredictable and anyone who says otherwise is selling something.</p>",
      "<h2>Where the data comes from</h2>",
      "<p>Fixtures, odds, predictions and live scores come from a third-party sports data provider. The odds are one consensus price for each market, not a comparison between bookmakers. League tables come from the same provider and from public competition data.</p>",
      "<h2>Our promise</h2>",
      "<p>We will always say plainly what the numbers are and where they come from, and we will fix mistakes when we find them.</p>"
    ].join("")
  },
  "how-it-works": {
    title: "How SportyPredictz Predictions Work",
    desc: "How to read the probabilities, odds, model edge and accumulator tips on SportyPredictz, and what they can and cannot tell you.",
    h1: "How our predictions work",
    body: [
      "<h2>Model probability</h2>",
      "<p>For each match the model estimates the chance of a home win, a draw and an away win, plus the chance of over 2.5 goals and of both teams scoring. These are percentages that add up across the three results.</p>",
      "<h2>Market odds</h2>",
      "<p>The odds shown are a single consensus price. Decimal odds of 2.00 mean a stake of 10 returns 20 including the stake. Higher odds mean the market thinks the result is less likely.</p>",
      "<h2>Model edge</h2>",
      "<p>Edge is the model's probability multiplied by the odds, minus one. If the model says 50% and the odds are 2.40, the edge is +20%. It means the model likes the price, not that the bet will win.</p>",
      "<h2>Double chance prices</h2>",
      "<p>Double chance odds are calculated from the 1X2 prices. They are a guide, and real bookmaker prices can be slightly different.</p>",
      "<h2>Accumulators</h2>",
      "<p>Our acca tips stack the most likely picks until the total odds reach a target. The more legs, the lower the chance that all of them win.</p>",
      "<h2>What the numbers cannot see</h2>",
      "<p>A model does not know about a late injury, a changed line-up or a team with nothing to play for. Always check team news before you decide.</p>"
    ].join("")
  },
  "responsible-gambling": {
    title: "Responsible Gambling | SportyPredictz",
    desc: "Gambling advice and where to get help. You must be 18 or older. SportyPredictz does not take bets.",
    h1: "Responsible gambling",
    body: [
      "<p>SportyPredictz is for information and entertainment. We do not take bets, and nothing here is a promise of profit. You must be 18 or older, and you should only gamble where it is legal.</p>",
      "<h2>Some simple rules</h2>",
      "<ul><li>Only stake money you can afford to lose.</li><li>Decide your limit before you start and stick to it.</li><li>Never chase losses.</li><li>Do not bet when you are angry, tired or drinking.</li><li>Take regular breaks from betting.</li></ul>",
      "<h2>Signs it may be becoming a problem</h2>",
      "<p>Betting more than you planned, hiding it from people close to you, borrowing to bet, or feeling anxious when you are not betting. If that sounds familiar, stop and talk to someone you trust.</p>",
      "<h2>Where to get help</h2>",
      "<p>Look for a gambling support organisation in your country, or ask your bookmaker to set deposit limits or close your account. Support is available and asking for it is a strong thing to do.</p>"
    ].join("")
  },
  terms: {
    title: "Terms of Use | SportyPredictz",
    desc: "The terms of using SportyPredictz: information only, no bets, no guarantees.",
    h1: "Terms of use",
    body: [
      "<p>By using SportyPredictz you agree to these terms. If you do not agree, please do not use the site.</p>",
      "<h2>Information only</h2>",
      "<p>Everything on the site is general information about football matches. It is not financial advice or a recommendation to place any bet. We do not take bets or hold any money.</p>",
      "<h2>No guarantees</h2>",
      "<p>Predictions are estimates. Odds change and data can contain errors or be delayed. We do not guarantee any result and we are not responsible for any loss you suffer from using the site.</p>",
      "<h2>Age and local law</h2>",
      "<p>You must be 18 or older to use this site. It is your responsibility to follow the gambling laws where you live.</p>",
      "<h2>Third-party links and data</h2>",
      "<p>Some data comes from third parties. We are not responsible for their content or availability.</p>",
      "<h2>Changes</h2>",
      "<p>We may update these terms from time to time. Continued use of the site means you accept the current version.</p>"
    ].join("")
  },
  privacy: {
    title: "Privacy Policy | SportyPredictz",
    desc: "What SportyPredictz stores on your device and what it does not collect.",
    h1: "Privacy policy",
    body: [
      "<p>SportyPredictz does not ask you to create an account and does not ask for your name, email or phone number.</p>",
      "<h2>What is saved on your device</h2>",
      "<p>Your favourites, your pick slip and your chosen market tab are stored in your own browser using local storage. They never leave your device and clearing your browser data removes them.</p>",
      "<h2>Server logs</h2>",
      "<p>Like any website, our hosting provider may keep basic technical logs such as IP address, browser type and the pages requested, for security and to keep the site running.</p>",
      "<h2>Fonts</h2>",
      "<p>The site loads fonts from Google Fonts, which may receive your IP address when it serves them.</p>",
      "<h2>Changes</h2>",
      "<p>If we add analytics or advertising later, we will update this page before we do.</p>"
    ].join("")
  }
};

// ---------- match analysis (written from the numbers, varied so pages do not read the same) ----------
const pickBy = (arr, id) => arr[Math.abs(Number(id) || 0) % arr.length];

export function analysis(m) {
  const p = m.prediction, o = m.odds || {};
  const h = m.home.name, a = m.away.name;
  const when = `${longDate(m.ts)} at ${clock(m.ts)}`;
  const lg = m.league.name;
  const out = [];

  out.push(pickBy([
    `${h} take on ${a} in ${lg} on ${when}.`,
    `${lg} action: ${h} host ${a} on ${when}.`,
    `${h} v ${a} is on the ${lg} schedule for ${when}.`
  ], m.id) + (o.home_win ? ` The market has ${h} at ${fmtOdd(o.home_win)}, the draw at ${fmtOdd(o.draw)} and ${a} at ${fmtOdd(o.away_win)}.` : ""));

  if (!p) {
    out.push("There is no model prediction for this match yet. Check back closer to kick-off.");
    return out;
  }

  const b = bestSide(m);
  const hp = num(p.home_win_pct), dp = num(p.draw_pct), ap = num(p.away_win_pct);
  if (b && hp !== null) {
    const strong = b.pct >= 62, lean = b.pct >= 48;
    const lead = b.k === "X"
      ? `The model sees this as tight: a draw is its single most likely result at ${Math.round(dp)}%.`
      : strong
        ? `The model is fairly confident here. It gives ${b.k === "1" ? h : a} a ${Math.round(b.pct)}% chance of winning.`
        : lean
          ? `The model leans towards ${b.k === "1" ? h : a} at ${Math.round(b.pct)}%, but it is far from decided.`
          : `The model cannot split these two. ${h} are at ${Math.round(hp)}%, ${a} at ${Math.round(ap)}% and the draw at ${Math.round(dp)}%.`;
    let tail = "";
    const e = b.odd ? edgeOf(b.pct, b.odd) : null;
    if (e !== null) {
      tail = e >= 0.06
        ? ` At ${fmtOdd(b.odd)} that price looks a little generous compared with the model, a model edge of ${e > 0 ? "+" : ""}${(e * 100).toFixed(1)}%.`
        : e <= -0.08
          ? ` The market price of ${fmtOdd(b.odd)} is shorter than the model suggests, so there is little value in it.`
          : ` The market price of ${fmtOdd(b.odd)} is close to where the model has it.`;
    }
    out.push(lead + tail);
  }

  const bits = [];
  if (num(p.over_25_pct) !== null) {
    const ov = p.over_25_pct;
    bits.push(ov >= 58 ? `Goals look likely: over 2.5 is rated at ${Math.round(ov)}%` : ov <= 42 ? `This could be a quiet one: over 2.5 goals is only ${Math.round(ov)}%` : `Over 2.5 goals sits near the middle at ${Math.round(ov)}%`);
  }
  if (num(p.btts_yes_pct) !== null) bits.push(`both teams to score is at ${Math.round(p.btts_yes_pct)}%`);
  if (p.most_likely_score) bits.push(`the most likely scoreline is ${p.most_likely_score}`);
  if (p.expected_goals && num(p.expected_goals.home) !== null) bits.push(`expected goals come out at ${Number(p.expected_goals.home).toFixed(1)} for ${h} and ${Number(p.expected_goals.away).toFixed(1)} for ${a}`);
  if (bits.length) out.push(bits.join(", ").replace(/^./, (c) => c.toUpperCase()) + ".");

  out.push("This is a model estimate and not a promise. Check team news before kick-off.");
  return out;
}

// content.js - all the written copy: prediction categories, FAQs, static pages, match analysis.
// Edit the words here. No coding needed, just keep the quotes and commas as they are.

import { num, fmtOdd, edgeOf, bestSide, longDate, clock } from "./logic.js";

export const SITE_NAME = "SportyPredictz";

// ---------- prediction categories ----------
export const CATEGORIES = [
  {
    slug: "banker-picks",
    group: "Match result", featured: true,
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
    group: "Match result",
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
    group: "Match result",
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
    group: "Match result",
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
    group: "Goals", featured: true,
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
    group: "Goals",
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
    group: "Both teams to score", featured: true,
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
    group: "Double chance",
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
    group: "Smart picks", featured: true,
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
    group: "Accumulators", kind: "acca-hub",
    name: "Accumulator tips",
    short: "Ready-made accas built from the most likely picks.",
    title: "Accumulator Tips Today: 2, 3, 5 and 10 Odds Football Accas",
    desc: "Football accumulator tips today: 2, 3, 5 and 10 odds accas built from the model's most likely results. Add a whole acca to your slip in one tap.",
    h1: "Accumulator tips",
    intro: [
      "We build four accas each day by stacking the most likely results until the total odds reach about 2, 3, 5 and 10. We keep to two picks per league, so a single bad day in one competition cannot sink everything.",
      "Every extra leg lowers your chance of winning. A 5-odds acca of favourites can look comfortable on paper and still fall apart on one late goal. Stake small."
    ],
    faq: [
      ["How is the acca built?", "We take the picks with the highest model probability, skip anything priced below 1.12 or above 3.00, and add legs until the total odds reach the target."],
      ["Can the acca change during the day?", "Yes. If odds move or a match kicks off, the acca is rebuilt on the next refresh."],
      ["What is the pick slip?", "A simple tracker on this site. It adds up your odds. It does not place bets."]
    ]
  },

  {
    slug: "over-1-5-goals", group: "Goals", featured: true,
    name: "Over 1.5 goals",
    short: "Matches likely to see at least two goals.",
    title: "Over 1.5 Goals Predictions Today: Safer Goals Tips",
    desc: "Over 1.5 goals predictions for today and the next two days: matches where the model gives two or more goals a 78% chance or better, with odds.",
    h1: "Over 1.5 goals predictions",
    intro: [
      "Over 1.5 is the cautious goals bet. It wins the moment a second goal goes in, whoever scores it, so the prices are short. This page lists every upcoming match where the model puts the chance of two or more goals at 78% or higher.",
      "Short prices cut both ways. At odds of 1.25 you need to win four times in five just to break even, so one 1-0 result can wipe out the profit from several wins. Use this list as a starting point and check the match page before you decide."
    ],
    faq: [
      ["What does over 1.5 goals mean?", "The match needs at least two goals in normal time. A 1-1, 2-0 or 3-2 all win. A 0-0 or a 1-0 loses."],
      ["Is over 1.5 safer than over 2.5?", "It wins more often, which is why it pays less. The extra goal you need for over 2.5 is what separates the two."],
      ["Which matches get listed?", "Any match where the model gives over 1.5 a probability of 78% or more, ranked from the highest down."]
    ]
  },
  {
    slug: "over-3-5-goals", group: "Goals",
    name: "Over 3.5 goals",
    short: "Open games where four or more goals are on the cards.",
    title: "Over 3.5 Goals Predictions Today: High-Scoring Football Tips",
    desc: "Over 3.5 goals predictions: matches where the model sees a real chance of four or more goals, with market odds and probabilities.",
    h1: "Over 3.5 goals predictions",
    intro: [
      "Four goals is a lot, and most matches fall short. That is why over 3.5 pays well and loses often. We only list matches where the model rates four or more goals at 38% or better, which is high for this market.",
      "Treat these as high-risk, high-reward picks. A 40% chance at odds of 2.60 is a fair deal on paper, but you will still lose six times in ten. Keep stakes small."
    ],
    faq: [
      ["Why is the percentage so much lower here?", "Because four goals is rare. A 40% rating in this market is a strong signal, much like 75% would be for over 1.5."],
      ["Does extra time count?", "No. Goals markets cover the 90 minutes plus stoppage time only."],
      ["Where do the odds come from?", "From the same market consensus price we show everywhere on the site. They can move before kick-off."]
    ]
  },
  {
    slug: "both-teams-not-to-score", group: "Both teams to score",
    name: "Both teams not to score",
    short: "Games where at least one side may stay quiet.",
    title: "Both Teams Not To Score Predictions Today: BTTS No Tips",
    desc: "BTTS No predictions: matches where the model thinks at least one team fails to score, with odds and a probability for each.",
    h1: "Both teams not to score predictions",
    intro: [
      "Both teams not to score, often written BTTS No, wins when one side or both go home without a goal. It suits matches with a strong favourite, a leaky underdog and little else, or two sides who rarely get chances.",
      "We list matches where the model gives the no outcome 58% or more. A 1-0 and a 0-0 both win, and so does a 4-0. One late consolation goal ends it."
    ],
    faq: [
      ["Does a 0-0 win BTTS No?", "Yes. Any score where at least one team stays on zero wins."],
      ["When does BTTS No make sense?", "When one team is very strong defensively, or the other is in poor attacking form. The match page shows the model's view."],
      ["How is it different from under 2.5 goals?", "Under 2.5 wins any 1-1 draw, but BTTS No loses it. BTTS No wins a 3-0, which loses under 2.5. The two bets react to different scores."]
    ]
  },
  {
    slug: "double-chance-1x", group: "Double chance",
    name: "Home or draw (1X)",
    short: "The home side wins or draws. Only an away win beats you.",
    title: "1X Double Chance Predictions Today: Home Win or Draw Tips",
    desc: "Home win or draw (1X) predictions: matches where the model gives the home side at least a 75% chance of not losing, with calculated odds.",
    h1: "Home or draw (1X) predictions",
    intro: [
      "Double chance 1X covers two of the three results: a home win or a draw. You lose only if the away team wins. That makes it a popular pick when a home favourite looks strong but the draw is a real worry.",
      "We list matches where the combined chance of a home win or a draw is 75% or higher. The odds shown are worked out from the match result prices and marked with a tilde, so treat them as a guide and check the real price with your bookmaker."
    ],
    faq: [
      ["What does 1X mean?", "1 is a home win and X is a draw. The bet wins if either happens."],
      ["Why are the odds marked with ~?", "Because we calculate them from the match result odds rather than quoting a bookmaker. Real prices can differ a little."],
      ["Is 1X a safe bet?", "It wins often, but the prices are short. One away win undoes several small profits."]
    ]
  },
  {
    slug: "double-chance-x2", group: "Double chance",
    name: "Draw or away (X2)",
    short: "The visitors win or draw. Only a home win beats you.",
    title: "X2 Double Chance Predictions Today: Draw or Away Win Tips",
    desc: "Draw or away win (X2) predictions: matches where the model gives the visitors at least a 70% chance of not losing, with odds.",
    h1: "Draw or away (X2) predictions",
    intro: [
      "Double chance X2 wins when the away team wins or the match is drawn. It gives you cover when you like the visitors but do not trust them to win outright, or when the home side is strong but not unbeatable.",
      "Away sides win less often than home sides, so the bar here is a little lower: we list matches where a draw or an away win comes to 70% or more. Odds are calculated from the match result prices and shown with a tilde."
    ],
    faq: [
      ["What does X2 mean?", "X is a draw and 2 is an away win. Either result wins the bet."],
      ["Why is the threshold 70% and not higher?", "Away teams carry less home advantage, so strong X2 spots are rarer. A lower bar keeps the list useful."],
      ["Can I add X2 to my slip?", "Yes. Open the Double chance tab on any match and tap the X2 price."]
    ]
  },
  {
    slug: "double-chance-12", group: "Double chance",
    name: "Home or away (12)",
    short: "Anyone wins. A draw is the only way to lose.",
    title: "12 Double Chance Predictions Today: No Draw Football Tips",
    desc: "Home or away (12) predictions: matches where the model rates a draw as unlikely and a winner at 80% or better, with calculated odds.",
    h1: "Home or away (12) predictions",
    intro: [
      "Double chance 12 wins if either team wins and loses only on a draw. It is the pick for matches that look open and attacking, where you expect a winner but cannot say who.",
      "We list matches where the model puts a win for either side at 80% or higher, which means the draw is clearly the outsider. The odds are calculated from the match result prices."
    ],
    faq: [
      ["What does 12 mean?", "1 is a home win and 2 is an away win. A draw is the only result that loses."],
      ["When is 12 a good idea?", "In matches between two attacking sides, or where both teams need the win."],
      ["Are the odds exact?", "No. They are worked out from the 1X2 prices and marked with a tilde."]
    ]
  },
  {
    slug: "acca-2-odds", group: "Accumulators", kind: "acca", acca: { target: 2, legs: 3 }, featured: true,
    name: "2 odds accumulator",
    short: "A short acca built to land around 2.00.",
    title: "2 Odds Accumulator Tips Today: Safe 2.00 Football Acca",
    desc: "Today's 2 odds accumulator: two or three of the model's most likely results stacked to about 2.00 total odds. Add it to your slip in one tap.",
    h1: "2 odds accumulator",
    intro: [
      "A 2 odds acca is the gentlest way into accumulators. Two or three strong favourites, stacked until the total reaches about 2.00, so you only need a couple of results to land.",
      "Short does not mean safe. Even three 75% picks win together only about four times in ten. Keep the stake small and enjoy the lower variance."
    ],
    faq: [
      ["How is this acca built?", "We stack the picks with the highest model probability, skip anything priced below 1.12 or above 3.00, and stop when the total odds reach about 2.00. No more than two picks come from one league."],
      ["Does the acca change during the day?", "Yes. If a match kicks off or the odds move, it is rebuilt on the next refresh. Tap Add all to pick slip to lock in what you see."],
      ["Is an acca a good idea?", "Every extra leg lowers your chance of winning. Treat it as a small-stake bet and never chase losses with it."]
    ]
  },
  {
    slug: "acca-3-odds", group: "Accumulators", kind: "acca", acca: { target: 3, legs: 4 },
    name: "3 odds accumulator",
    short: "A balanced acca built to land around 3.00.",
    title: "3 Odds Accumulator Tips Today: Football Acca at 3.00",
    desc: "Today's 3 odds accumulator: the model's strongest picks stacked to about 3.00 total odds, with the whole acca ready to add to your slip.",
    h1: "3 odds accumulator",
    intro: [
      "Three to four likely results stacked to a total near 3.00. It pays three times your stake, which is a good middle ground between a cautious double and a long shot.",
      "We stop adding legs as soon as the target is reached, so the acca is never longer than it needs to be."
    ],
    faq: [
      ["How is this acca built?", "We stack the picks with the highest model probability, skip anything priced below 1.12 or above 3.00, and stop when the total odds reach about 3.00. No more than two picks come from one league."],
      ["Does the acca change during the day?", "Yes. If a match kicks off or the odds move, it is rebuilt on the next refresh. Tap Add all to pick slip to lock in what you see."],
      ["Is an acca a good idea?", "Every extra leg lowers your chance of winning. Treat it as a small-stake bet and never chase losses with it."]
    ]
  },
  {
    slug: "acca-5-odds", group: "Accumulators", kind: "acca", acca: { target: 5, legs: 6 }, featured: true,
    name: "5 odds accumulator",
    short: "A bigger acca built to land around 5.00.",
    title: "5 Odds Accumulator Tips Today: Football Acca at 5.00",
    desc: "Today's 5 odds accumulator built from the model's most likely results, about 5.00 total odds, with no more than two picks from one league.",
    h1: "5 odds accumulator",
    intro: [
      "Five times your stake needs four to six legs, and each one is another chance for a late goal to ruin the day. We spread the picks across leagues to avoid one bad evening in a single competition sinking everything.",
      "This is a small-stake bet. If it comes in, great. If not, tomorrow's acca is a fresh start, not a reason to raise the stake."
    ],
    faq: [
      ["How is this acca built?", "We stack the picks with the highest model probability, skip anything priced below 1.12 or above 3.00, and stop when the total odds reach about 5.00. No more than two picks come from one league."],
      ["Does the acca change during the day?", "Yes. If a match kicks off or the odds move, it is rebuilt on the next refresh. Tap Add all to pick slip to lock in what you see."],
      ["Is an acca a good idea?", "Every extra leg lowers your chance of winning. Treat it as a small-stake bet and never chase losses with it."]
    ]
  },
  {
    slug: "acca-10-odds", group: "Accumulators", kind: "acca", acca: { target: 10, legs: 9 },
    name: "10 odds accumulator",
    short: "A long acca built to land around 10.00.",
    title: "10 Odds Accumulator Tips Today: Football Acca at 10.00",
    desc: "Today's 10 odds accumulator: six to nine of the model's most likely picks stacked to about 10.00 total odds. Small stakes only.",
    h1: "10 odds accumulator",
    intro: [
      "Ten times your stake sounds great, and it usually takes six to nine legs to get there. Even when every pick is a favourite, the chance of all of them winning is small.",
      "We build it from the strongest picks on the board and keep to two per league. Think of it as a lottery ticket with better odds, and stake accordingly."
    ],
    faq: [
      ["How is this acca built?", "We stack the picks with the highest model probability, skip anything priced below 1.12 or above 3.00, and stop when the total odds reach about 10.00. No more than two picks come from one league."],
      ["Does the acca change during the day?", "Yes. If a match kicks off or the odds move, it is rebuilt on the next refresh. Tap Add all to pick slip to lock in what you see."],
      ["Is an acca a good idea?", "Every extra leg lowers your chance of winning. Treat it as a small-stake bet and never chase losses with it."]
    ]
  },
  {
    slug: "under-3-5-goals", group: "Goals",
    name: "Under 3.5 goals",
    short: "Tight games where three goals or fewer is the likely outcome.",
    title: "Under 3.5 Goals Predictions Today: Low-Scoring Football Tips",
    desc: "Under 3.5 goals predictions: matches where the model gives a 60% chance or better of three goals or fewer, with odds.",
    h1: "Under 3.5 goals predictions",
    intro: [
      "Under 3.5 means three goals or fewer in the whole match. It is the safer side of the over 3.5 bet, and it wins in every game that finishes 2-1, 1-1, 2-0 or 1-0.",
      "We list the upcoming matches where the model gives under 3.5 a 60% chance or better. Check the open match page for the expected goals on each side before you add one to your slip."
    ],
    faq: [
      ["What does under 3.5 goals mean?", "Three goals or fewer in total in normal time. A 2-1 result is under 3.5. A 3-1 result is over."],
      ["How is it different from under 2.5?", "Under 2.5 loses to a 2-1 win, but under 3.5 wins it. Under 3.5 is the more forgiving line."],
      ["Does stoppage time count?", "Yes. Goals in added time count, and extra time in a cup match does not."]
    ]
  },
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
// Contact details. Change them here only.
export const CONTACT = {
  whatsapp: "+234 915 469 7507",
  whatsappLink: "https://wa.me/2349154697507",
  telegramPersonal: "@Aiam_B",
  telegramPersonalLink: "https://t.me/Aiam_B",
  channel: "t.me/sportypredictz1",
  channelLink: "https://t.me/sportypredictz1",
  email: "allotips8@gmail.com",
  emailLink: "mailto:allotips8@gmail.com"
};

export const PAGES = {
  contact: {
    title: "Contact SportyPredictz",
    desc: "Get in touch with SportyPredictz by email, WhatsApp or Telegram. Questions about a prediction, the site or a bug are welcome.",
    h1: "Contact us",
    body: [
      `<p>Questions about a prediction, a page that looks wrong, or a bug you have spotted? Choose the channel that suits you.</p>`,
      `<div class="cbtns"><button type="button" class="cbtn" data-contact="email"><b>Email us</b><span>Longer questions and bug reports</span></button>`
      + `<button type="button" class="cbtn" data-contact="whatsapp"><b>WhatsApp</b><span>Quick questions</span></button>`
      + `<button type="button" class="cbtn" data-contact="telegram"><b>Telegram</b><span>Direct messages</span></button>`
      + `<button type="button" class="cbtn" data-contact="channel"><b>Telegram channel</b><span>Daily updates and results</span></button></div>`,
      `<h2>What we do with your message</h2><p>We only use the details you send to reply to you. We do not sell them or add them to a mailing list without asking first. We are not able to give personal betting advice; the predictions on this site are the same for everyone.</p>`
    ]
  },
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
      "<p>We may use GoatCounter to count page visits. It does not use cookies or build personal profiles, and it only runs when the site owner has turned it on. We do not show advertising.</p>"
    ].join("")
  }
};

// ---------- match analysis (written from the numbers, varied so pages do not read the same) ----------
const pickBy = (arr, id) => arr[Math.abs(Number(id) || 0) % arr.length];

// Each match gets its own mix of angles: the same facts, told in different orders and with different words,
// chosen by match id, so no two match pages read alike and the wording never repeats across the site.
export function analysis(m) {
  const p = m.prediction, o = m.odds || {};
  const h = m.home.name, a = m.away.name, id = m.id;
  const when = `${longDate(m.ts)} at ${clock(m.ts)}`;
  const lg = m.league.name;
  const out = [];

  // 1) Set the scene
  out.push(pickBy([
    `${h} and ${a} meet in ${lg} on ${when}. ${o.home_win ? `Bookmakers price ${h} at ${fmtOdd(o.home_win)}, the draw at ${fmtOdd(o.draw)} and ${a} at ${fmtOdd(o.away_win)}.` : "Bookmaker prices for this game are still being set."}`,
    `Kick-off is ${when} in ${lg}. ${o.home_win ? `On the prices, ${h} are ${fmtOdd(o.home_win)} at home and ${a} are ${fmtOdd(o.away_win)} away, with the draw at ${fmtOdd(o.draw)}.` : "The prices have not settled yet, so check back before you decide."}`,
    `${lg}, ${when}: ${h} host ${a}. ${o.home_win ? `The market's single price for each result is ${fmtOdd(o.home_win)} / ${fmtOdd(o.draw)} / ${fmtOdd(o.away_win)} (home / draw / away).` : "Odds for this match have not been published yet."}`
  ], id));

  if (!p) {
    out.push("There is no model read for this match yet. It appears once the numbers are in, usually a few hours before kick-off.");
    out.push("This is a model estimate and not a promise. Check team news before kick-off.");
    return out;
  }

  // 2) What the model thinks
  const b = bestSide(m);
  const hp = num(p.home_win_pct), dp = num(p.draw_pct), ap = num(p.away_win_pct);
  if (b && hp !== null) {
    const who = b.k === "1" ? h : a;
    const gap = Math.abs(hp - ap);
    const read = b.k === "X"
      ? pickBy([
          `The model's most likely single result is a draw, at ${Math.round(dp)}%. Neither side pulls clearly ahead.`,
          `A draw is what the numbers point to most, at ${Math.round(dp)}%. This one is about how it is played, not who is better on paper.`
        ], id + 1)
      : b.pct >= 62
        ? pickBy([
            `${who} are the clear favourite on our numbers, at ${Math.round(b.pct)}% to win.`,
            `On the model, ${who} have a ${Math.round(b.pct)}% chance, which puts them well ahead of the other side.`
          ], id + 1)
        : b.pct >= 48
          ? pickBy([
              `${who} lean on our numbers at ${Math.round(b.pct)}%, but the match is still open.`,
              `The model gives ${who} a ${Math.round(b.pct)}% shot, a real edge without being a lock.`
            ], id + 1)
          : pickBy([
              `The model cannot separate these sides: ${h} ${Math.round(hp)}%, draw ${Math.round(dp)}%, ${a} ${Math.round(ap)}%.`,
              `Nothing stands out. Our split is ${Math.round(hp)} / ${Math.round(dp)} / ${Math.round(ap)} for home, draw and away.`
            ], id + 1);
    out.push(read + (gap < 8 && b.k !== "X" ? " The gap between the two sides is small, so small changes in team news matter." : ""));

    // 3) Price against model
    const e = b.odd ? edgeOf(b.pct, b.odd) : null;
    if (e !== null) {
      out.push(e >= 0.06
        ? pickBy([
            `At ${fmtOdd(b.odd)} the price looks generous next to the model, an edge of +${(e * 100).toFixed(1)}%.`,
            `The market is offering ${fmtOdd(b.odd)} on ${b.k === "X" ? "the draw" : b.k === "1" ? h : a}, which the model rates higher. That gap is worth noting: +${(e * 100).toFixed(1)}%.`
          ], id + 2)
        : e <= -0.08
          ? pickBy([
              `The market is shorter than the model on ${b.k === "X" ? "the draw" : b.k === "1" ? h : a}: ${fmtOdd(b.odd)} is not much of a price for the chance involved.`,
              `At ${fmtOdd(b.odd)} the bookmakers already agree with the model, so there is little left in the price.`
            ], id + 2)
          : pickBy([
              `The price of ${fmtOdd(b.odd)} sits close to where the model has it, so the market and our numbers agree.`,
              `Market and model are close here: ${fmtOdd(b.odd)} against our ${Math.round(b.pct)}%.`
            ], id + 2));
    }
  }

  // 4) Shape of the game
  const bits = [];
  if (num(p.over_25_pct) !== null) {
    const ov = p.over_25_pct;
    bits.push(ov >= 58 ? `goals are likely (over 2.5 at ${Math.round(ov)}%)` : ov <= 42 ? `a low-scoring game is the expectation (over 2.5 only ${Math.round(ov)}%)` : `over 2.5 sits in the middle at ${Math.round(ov)}%`);
  }
  if (num(p.btts_yes_pct) !== null) bits.push(`both teams scoring is ${Math.round(p.btts_yes_pct)}%`);
  if (p.most_likely_score) bits.push(`the single most likely scoreline is ${p.most_likely_score}`);
  if (p.expected_goals && num(p.expected_goals.home) !== null) bits.push(`expected goals are ${Number(p.expected_goals.home).toFixed(1)} for ${h} and ${Number(p.expected_goals.away).toFixed(1)} for ${a}`);
  if (bits.length) out.push(pickBy([
    `On the shape of the game: ${bits.join(", ")}.`,
    `How it may play out: ${bits.join("; ")}.`
  ], id + 3).replace(/^On the shape of the game: (.)/, (m0, c) => `On the shape of the game: ${c}`));

  // 5) What would change the read
  out.push(pickBy([
    "The things to watch are late team news, rotation and any move in the odds. A sharp move in the favourite's price is usually the first sign that the numbers have changed.",
    "Before you decide, check the team news and the lineups. If the favourite's price drifts out sharply, the model may be ahead of the market, or it may have missed something.",
    "Model numbers are set before the final lineups. Injuries and rest decisions can shift the picture, so read the odds again close to kick-off."
  ], id + 4));

  out.push("This is a model estimate and not a promise. Check team news before kick-off.");
  return out;
}

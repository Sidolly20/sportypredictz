NEXT FIX - one zip (SportyPredictz repo, root folder)

Replace these files in the root of the repo, then commit:
  logic.js     - Under 3.5 market and picker; date labels for cards
  content.js   - Under 3.5 goals category (new)
  server.js    - weekend page route, sitemap entries, thin-page rules
  views.js     - weekend page layout, date labels on cards
  styles.css   - betting categories wrap on phones (no sideways slide)
  data.js      - live: games show once kick-off has passed

What is new
  /predictions/weekend-match-predictions   Friday, Saturday, Sunday match predictions, hot picks,
                                           fallbacks (coming week, then last weekend's results)
  /predictions/under-3-5-goals             new category
  Date and time on every match card

Indexing rules
  - Tip pages with no picks are marked noindex until they have content.
  - Sitemap lists only matches that have a prediction and odds.
  - Match pages without a prediction are already noindex.

Not included: Over 0.5 (the odds feed does not carry that price yet).
Over 1.5 and Over 3.5 already exist as pages.

SCOUT AI HELPER (added)
- Scout is the small button in the bottom-right corner on every page (scout.js, styles.css, assets/scout-logo.svg).
- Scout answers from a fixed list of plain answers in scout.js. It uses no paid service and no language model.
- New page /ai-football-predictions (in content.js, slug "ai-football-predictions"). It is in the top menu as "Scout AI" and in the footer.
- New page /notes (noindex). Its microphone uses the browser's built-in speech recognition. Notes are saved in the visitor's own browser only.
- To change Scout's answers, edit the ANSWERS list in scout.js.

AI SLIP BUILDER (added)
- Page: /build-slip (linked from the top menu pill "Build an AI slip", from Scout, and in the sitemap).
- Three taps: odds (2, 3 or 5), day (today, tomorrow or both), and combo style (more or fewer). Type box and "Surprise me" also work.
- The result shows in a white popup: Swap one game, Shuffle, Copy, WhatsApp and Telegram share, Add to My slip (with a stake calculator), and "Why these picks".
- Engine: slip-engine.js (no language model, no paid service). Tune the leg counts in LEGS, the odds bands in TARGETS, and the risk levels in THRESHOLDS_BY_MODE.
- Data: /api/slip-data returns today's and tomorrow's upcoming matches with prices and model chances. It is cached for 2 minutes.
- More combo: legs at 75% or more (80% first). Fewer combo: legs at 65% or more, with a note on the bigger risk.

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

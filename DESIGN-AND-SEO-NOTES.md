# SportyPredictz v5: design and SEO notes

## What changed
- **Look**: navy ink, ivory type, brass accent; Newsreader (serif) for headlines and reading text, Hanken Grotesk for interface and numbers. Scanlines, all-caps labels and neon lime are gone.
- **The rule**: one hairline that shows our chance against the market's chance. It appears on the pick of the day, spotlight cards, bet-type cards and match pages.
- **Fixture card** (`matchRow` in views.js): time, two teams with win shares, split bar, one pick, odds, and an "All odds" drawer. Same class hooks as before, so slip, search, live scores and saved matches still work.
- **Bet-type card** (`pickRow`): pick, rule, odds, edge and result chip.
- **Header**: one short row plus a "Bet types" menu. The 20-pill strip that filled the first phone screen is gone.
- **Sponsor system**: `sponsors.js` (edit only this file), slots top / feed / side / match, and a new `/advertise` page.

## SEO changes
- Match page: the analysis and the Q&A were hidden inside collapsed sections; both are now visible text under proper H2/H3 headings.
- FAQ is visible on home, day, bet-type, league and match pages, with FAQPage markup.
- Every title is trimmed to fit (about 60 characters), descriptions are dynamic (date, counts, strongest pick), and a "Updated hh:mm" line shows freshness.
- Structured data added: WebPage (with dateModified), ItemList of matches, BreadcrumbList, Organization and WebSite on the home page.
- Removed SportsEvent markup from match pages: Google requires a venue (`location`) for it and we have no venue data, which creates errors in Search Console.
- Heading order fixed (one H1, H2 sections, H3 items). Twitter tags, robots max-snippet and hreflang added.
- Sponsored links use rel="sponsored nofollow noopener".

## Things only you can do
- Fill the media kit in `sponsors.js` with real analytics numbers, or leave it null (those lines are hidden).
- Confirm the sponsorship rules written on /advertise (licensed brands only, sponsors never change picks).
- Sponsor placeholders are now hidden. Add a sponsor in `sponsors.js` and it appears; set `SHOW_AD_SLOTS=1` on Render only if you want the "Your brand here" cards back.
- In Search Console: submit /sitemap.xml, then look at "Crawled, currently not indexed". Thin, near-identical match pages are the usual cause. Pages with no prediction are already set to noindex.

## Honest limits
No file can guarantee rankings or indexing. These changes remove the things that hurt (hidden text, thin repeated copy, bad markup) and add real content and structure. Rankings still depend on your site's age, links and how Google judges the pages over weeks.
Fonts load from Google Fonts. My screenshots used fallback fonts, so check the real typography once deployed.
`index.html` in the project root is an old file the server does not serve. It can be deleted.

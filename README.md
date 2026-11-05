# SportyPredictz

Football predictions site. Express server that builds every page on the server (good for Google and slow phones).
It reads matches, odds, predictions, live scores, results and tables from your odds-api.

## Files (all in the main folder)
server.js, data.js, logic.js, content.js, views.js, demo.js, app.js, styles.css, package.json

## Render environment variables
| Name | Needed | What |
|---|---|---|
| ODDS_API_KEY_SPORTY | yes | the key for this site from your odds-api api_keys table |
| SITE_URL | no | only if you want to force your site address (your onrender.com link). It is worked out automatically otherwise |
| ODDS_API_BASE | no | defaults to https://odds-api-g6vq.onrender.com |
| SITE_TZ | no | defaults to Africa/Lagos (used to decide what "today" is) |
| BOARD_PAGES | no | pages of 20 matches loaded per day, default 3 |

Without a key the site shows clearly marked DEMO data and tells Google not to index it.

## Render settings
Build command `npm install`, start command `npm start`.

## Where to change the words
Prediction pages, FAQs, About, Terms and Privacy text are all in content.js.

## Useful addresses
/api/status shows connection health. /sitemap.xml and /robots.txt are made automatically.

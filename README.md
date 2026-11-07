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
| STORE_KEEP_DAYS | no | how long saved matches are kept in Supabase, default 14 |

Without a key the site shows clearly marked DEMO data and tells Google not to index it.

## Render settings
Build command `npm install`, start command `npm start`.

## Where to change the words
Prediction pages, FAQs, About, Terms and Privacy text are all in content.js.

## Useful addresses
/api/status shows connection health. /sitemap.xml and /robots.txt are made automatically.

## Permanent record (Supabase, optional)
Check it worked (SQL Editor, one query at a time):
select count(*) from pick_log;
select final, count(*) from match_store group by final;

Expect `match_store` to hold rows after the site has been up for a few minutes, with `final = false` for upcoming matches and `final = true` for finished ones. If a query says a column is missing, run `supabase-setup.sql` again.

1. Supabase → SQL Editor → New query → paste all of `supabase-setup.sql` → Run. It is safe to run again: it only adds what is missing (for example, columns from an older version) and never deletes rows. Then run the check in the section below.
2. Supabase → Project Settings → API: copy the Project URL and the `service_role` key.
3. Render → SportyPredictz → Environment: add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`. Save.
4. Open `/api/status` — `pickLog` should say it is on.
Picks are saved before kick-off and marked won/lost at full time.

## Match store (Supabase, optional but recommended)
With the same two Supabase variables, the site also keeps a copy of every match and result in the `match_store` table (created by `supabase-setup.sql`). If odds-api is asleep or down:
- the home page still shows today's and tomorrow's matches straight after a restart,
- match pages still open for matches the site has seen before,
- recent results still show.
Rows older than `STORE_KEEP_DAYS` (default 14) are removed automatically. `/api/status` shows `store` health.

## Search and sharing (added in the 2027 update)
- Social cards use `/assets/og.png` (1200x630). Replace the file to change the picture shared on WhatsApp, Telegram, X and LinkedIn.
- App icons live in `/assets` (`icon-192.png`, `icon-512.png`, `apple-touch-icon.png`). `/site.webmanifest` lets phones install the site to the home screen.
- `/llms.txt` gives AI assistants a short, accurate summary of the site. It is only published once live data is on (not in demo mode).
- Security headers are set in server.js. If a browser console shows a blocked resource after an update, set `CSP_MODE=report` in Render to log violations without blocking, then fix the source and switch back.

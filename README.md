# SportyPredictz

Football predictions and odds board. Express server + plain HTML/CSS/JS.

The server calls your odds-api (`/v1/matches`, `/v1/matches/:id`, `/v1/live`) and keeps the
key in an environment variable. Browsers only talk to this site's own `/api/...` routes.

## Environment variables (Render)
| Name | Needed | What |
|---|---|---|
| `ODDS_API_KEY_SPORTY` | yes | key from the odds-api `api_keys` table |
| `ODDS_API_BASE` | no | defaults to https://odds-api-g6vq.onrender.com |

With no key set the site shows clearly labelled DEMO data.

## Render settings
Build command `npm install`, start command `npm start`.

## Files
`server.js`, `index.html`, `styles.css`, `app.js`, `package.json`. Only the three web files are public.

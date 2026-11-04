# SportyPredictz - Odds Radar

Odds comparison site with a live ticker, ticket carousel, bookmaker board and value finder.

## Run locally

    npm install
    ODDS_API_KEY=your_key_here npm start

Then open http://localhost:3000

Without a key the site runs on demo data.

## Deploy on Render

1. Push this folder to a GitHub repository.
2. On Render, create a new Web Service from that repo.
3. Build command: npm install
4. Start command: npm start
5. Under Environment, add ODDS_API_KEY with your key.

The key stays on the server and is never sent to the browser.

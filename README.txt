ALL FIXES - one zip

Copy each file into the matching place in your GitHub repo (replace the old file), then commit.

odds-api repo
  odds-api/lib/bzz.js                 -> lib/bzz.js                 (daily Bzzoiro cap + usage counter)
  odds-api/lib/footballDataLive.js    -> lib/footballDataLive.js    (football-data finished matches backup)
  odds-api/routes/results.js          -> routes/results.js          (results with football-data backup)

SportyPredictz repo (root folder)
  sportypredictz/data.js              -> data.js                    (live only after kick-off + minute/score; backup results mapped by name)
  sportypredictz/views.js             -> views.js                   (live cards are not links)

Not included on purpose:
  - league order change (logic.js): not part of this set; ask first.
  - per-match Bzzoiro call reduction (routes/matches.js): needs your usage numbers first.

After deploying:
  - odds-api: open yoursite/api/status and check bzzoiro.calls_today and daily_cap.
  - SportyPredictz: check Live page counts only started games; check Results page.

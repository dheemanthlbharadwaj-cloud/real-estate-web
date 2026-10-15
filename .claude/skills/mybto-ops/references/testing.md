# Testing

Two suites. Run both before any commit that touches `public/`, `dev.js`, `firebase.json`, `pipeline/` or `apps-script/`.

```
npm test                                                       # node --no-warnings --test test/*.test.js
CHROMIUM=/opt/pw-browsers/chromium node test/e2e.browser.js    # last line must be: ALL BROWSER CHECKS PASSED
```

## Requirements
- Node >= 20. Python 3 with `openpyxl` (`pip install openpyxl`): `test/real_data.test.js` runs `build_real_data.py`, which exits non-zero without it.
- The browser test loads Playwright from the global modules folder (`npm root -g`/playwright). Set `CHROMIUM` to a Chromium binary Playwright can drive; the path differs per machine (cloud sandbox: `/opt/pw-browsers/chromium`). Without `CHROMIUM` it uses Playwright's own browser. Do not run `playwright install` in the cloud sandbox. On your own machine, `npm i -g playwright && npx playwright install chromium` is fine.
- The browser test starts `node dev.js` itself on port 3123 with `DEV_FAKE_SHEETS=1`. Free that port first. `SHOTS_DIR=<dir>` saves screenshots.
- Nothing in either suite talks to the live Sheet, Google Analytics or AdSense.

## Unit tests (`npm test`, 25 tests)
`test/scoring.test.js` (24):
- Filters, weight direction, floor preference by block height, dense ranks, facility has/near (1 / 0.5), 2-Room Flexi as one housing type, highest/middlemost/lowest storeys.
- Wind and car park features and labels; every published unit has boolean `wind_open`, `mscp_near` consistent with `mscp_m <= 100`, and `sample_fields` matching `index.json` `sample`.
- `FACTOR_KEYS` in `Analytics.js` equals `Scoring.FACTORS` keys; Rankings has the `weight_*` columns.
- Row layout round trip, long full ranking split over extra columns, bad submissions rejected, latest ranking per user, no unit ids in analytics output, fewer than 5 users refused, only the 7 project keys accepted, user and project must be strings, unit id pattern (and every real unit id passes it), byte-counted body limit, sample users fit the row layout, `factor_shares` / `facility_shares` / `sun_shares`.
`test/real_data.test.js` (1): runs `build_real_data.py --in test/fixtures/real --out <tmp> --publish` on a 5-unit Sembawang Brook fixture and checks the site schema (ids, address, facing, gt30m, chute_near, roof_access, mscp_near, nulls, facilities, same keys as the real published data, index entry).

## Browser test (`test/e2e.browser.js`)
Main checks, in order (exact texts matter):
- Rank page before ranking: count 0, blank By floor boxes, buttons hidden, no CSV/Save/queue, no menu button, header has only "Rank units" (active).
- After Rank: no ad pop-up (ads archived), no survey, top 100 rows, "Showing the top 100.", no intro paragraph under the title, Shortlisted button but no Analytics button, table headings `#||Unit|Score|Type · facing|Chute|MRT` plus facility columns with ✓ ✗ (– allowed for chute), support card link `https://buymeacoffee.com/mybto`, footer is only the credit line with a single `/privacy` link, By floor only from the top 100, tags limited to corner/corridor/near MRT/chute.
- Fake Sheet: exactly one ranking row with consent, full ranking and `top50` of 50; pressing Rank again adds no row; `mybto:uid` and `mybto:last:<project>` kept.
- The test starts on Kebun Baru Breeze (first project), then switches to Berlayar Rise: changing project clears the ranking; housing type radios are `radio:2-Room Flexi,radio:3-Room,radio:4-Room`; floor priority Higher by default, Higher again per project and on fresh visits, an old saved Lower is not restored; Higher with all weights 0 puts the top storey first.
- Importance groups in order `Blocks|Sun direction|Wind direction|Distance|Others|Facilities nearby (within 30 m)`; Others is only "Corner unit" (no roof access in real data); block and design meters follow the selection.
- Shortlist: count, debounced send (3 units, one row), new tab, reorder, persistence across reloads, rank and "was" numbers, the parameter note, Clear all (cancel and confirm, synced), Share (clipboard and Web Share API), shared link banner and buttons, read-only view, unknown id ignored, Save as my shortlist (confirm), max 100 units.
- Archived Analytics (fake Sheet, `ANALYTICS_SOURCE` from the test route): no gate, heading "<Project> Analytics", no controls or unit ids, 4 KPI titles, 8 insight boxes in rows of 4, 7 canvases, watermark plugin, non-interactive charts.
- `firebase.json` redirects (through `dev.js`), no `/api`, archived home (7 project cards, Prime filter shows 2), legend drawer with 11 entries and 11 pictures, `?legend=` deep link, bad `?legend=` value safe.
- `/privacy`, `/ads.txt`, `/robots.txt` (no `Disallow: /data/`, has `Disallow: /shortlist`) and `/sitemap.xml` (contains the live address) are served. <!-- DOMAIN-SWITCH: update when mybto.sg is primary --> (the sitemap check and the watermark text check move to mybto.sg; the switch also adds a check that `#mybto-migrate=` data is imported by `js/host.js`)
- No SVG and no em dash on `/` and on every other page in its loop.
- Switch tests with a routed `config.js`: `ANALYTICS_ENABLED: true` brings back the tab and button; `ADS_ENABLED: true` restores the pop-up ("Not now" ranks nothing, consent saved after the countdown) and the video gate; `SHEETS_URL: ''` sends nothing and Analytics says "Analytics will appear here soon." with a quiet console; `ANALYTICS_SOURCE: 'sample'` shows "Based on 71 saved rankings" for Berlayar Rise without calling the Sheet.
- Phone width (390 px): no sideways scroll on home, rank, header and Analytics; tile layout.
- No browser errors in the whole run.

## Updating tests when behaviour changes on purpose
1. Make the code change, run the suites, read the failing `FAIL: <message>` lines.
2. Change only the checks that describe the intended new behaviour (exact copy, counts, orders). Keep the guard checks (no em dash, no SVG, no unit ids in analytics, nothing sent with `SHEETS_URL` empty, phone overflow) unless the owner changes the rule.
3. Counts tied to data or projects: legend entries (11), project cards (7), Prime filter (2), housing types for Berlayar Rise, the 816 2-Room Flexi units, "Based on 71 saved rankings" (from `sample_submissions.json`), real unit ids in `scoring.test.js`.
4. Factor changes: update the group-order check and `FACTOR_KEYS`.
5. Note the test change in the commit message and in this file if a check is added or removed.

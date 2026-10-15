# Runbooks

Every recipe ends the same way: run the tests, update this skill in the same commit, commit by file name, deploy only with approval (see `hosting-domain-deploy.md`).

## Change page copy
1. Find the text: page bodies, titles, descriptions and the support card are in `pipeline/build_pages.py`; meter help texts are `FACTOR_HELP`, `FACILITY_HELP`, `FUTURE_FAC_HELP` near the top of `public/js/app.js`; other JS messages are in `app.js`; header and footer in `public/js/site.js`; legend texts in `public/js/legend.js`; the archive home in `public/archive/home.html`.
2. Write plain, short sentences. No em dashes. Keep the owner's exact words where they gave them.
3. If you edited `build_pages.py`: `python3 pipeline/build_pages.py`, commit the script and the regenerated html together.
4. Check the e2e test for exact-text checks (grep the old text in `test/e2e.browser.js`); update them only when the change is intended.

## Add or change a factor
1. `public/js/scoring.js`: add to `FACTORS` (label and feature function), to `GROUPS` if it belongs in a panel group, and to `availability()`.
2. `public/js/app.js`: help text in `FACTOR_HELP`; results-table column or tag only if the owner wants one.
3. `public/js/legend.js`: an entry with a picture in `public/img/legend/` and its place in the `order` list.
4. `apps-script/Analytics.js`: add the key to `FACTOR_KEYS` (a unit test compares it with `Scoring.FACTORS`). This adds a `weight_<key>` column to Rankings, so the owner must fix the header row in Rankings and Sample and publish a new Apps Script version (`backend-apps-script.md`). Run `python3 pipeline/build_pages.py` to refresh `analytics-core.js`.
5. Data: add the field to the raw real files and to `unit_rows()` in `pipeline/build_real_data.py`, then publish (`data-pipeline.md`).
6. Tests: `test/scoring.test.js` (feature and availability), e2e checks for group order and legend count (`testing.md`).
7. Privacy page and `llms.txt` if the factor list there changes.

## Re-publish unit data
1. Edit `pipeline/raw/real/<key>.json` (stack fields, and the `blocks` entry for block-wide fields). Add a dated line to `notes`.
2. `python3 pipeline/build_real_data.py`, read warnings and errors, share `review/mybto-units-review.xlsx` with the owner if the change matters.
3. After approval: `python3 pipeline/build_real_data.py --publish`.
4. `npm test` and the browser test. Commit the raw file and `public/data/units/` together. Deploy.

## Add a page
1. Add an entry to `PAGES` in `pipeline/build_pages.py` (`title`, `h1`, `lede`, `desc`, `body`; `plain=True` for a page without `app.js`; `robots=True` for `noindex`; `out=` for a sub-folder). Run the script.
2. `firebase.json`: add a rewrite `{"source": "/name", "destination": "/name.html"}` AND a redirect `{"source": "/name.html", "destination": "/name", "type": 301}`. `cleanUrls` stays false.
3. `public/sitemap.xml`: add the URL with today's `lastmod` if it should be indexed. Check `robots.txt`.
4. Link it from where the owner wants (the footer stays one credit line plus Privacy unless the owner says otherwise).
5. Add the path to the e2e loops that check no em dashes and no SVG, and a redirect check if you added one.
6. Possible next page: About or FAQ (idea only, not agreed).

## Update the Apps Script backend
1. Edit `apps-script/Code.gs` / `Analytics.js`. `npm test`. `python3 pipeline/build_pages.py`.
2. Commit. Tell the owner: paste `Code.gs` into `Code.gs` and `Analytics.js` into `Analytics.gs`, Save, Deploy > Manage deployments > pencil > Version: New version > Deploy.
3. Verify without writing: `?action=analytics&project=<key>` and a POST with `{"type":"probe"}` (answers `unknown type`).

## Rotate or change ads
AdSense Auto ads are the only live ads. To change what shows, the owner edits Auto ads settings in AdSense (recommended set in `seo-analytics-ads.md`). To turn AdSense off, empty `ADSENSE_CLIENT` in `config.js` and deploy.

Old placeholders (rarely):
- `ADS_ENABLED: true` in `config.js` brings back the 5 s interstitial and 15 s Analytics video gate (placeholders). A real network would plug into `PROVIDERS` in `public/js/ads.js` and need CSP changes. Not wanted now; AdSense Auto ads replace it.

## Change AdSense ids or GA settings
- AdSense placement, formats and ad load: owner only, in the AdSense dashboard (Ads > By site). Code changes only for the publisher id (`ADSENSE_CLIENT`, the meta tag in `build_pages.py`, `ads.txt`) or the live-host check in `adsense.js`.
- GA: new events through `window.track`; the id lives in `GA_ID`.

## Respond to an AdSense rejection
1. Read the reason in AdSense (Sites > the site > status) with the owner.
2. Common reasons and fixes:
   - "Low value content": add useful text pages (About, FAQ explaining the factors and data sources), make sure the home page text explains the tool, then request review again.
   - "Site down or unavailable" / "Not found": check `https://<host>/`, `/ads.txt` and `/privacy` return 200 and the AdSense meta tag is present.
   - Policy or navigation issues: make sure the privacy page is linked, the site has no broken links, and nothing looks like a placeholder ad.
   - Ownership: `ads.txt` must be at the domain root with `pub-6178711736030963`, and the meta tag on every page.
3. Fix, deploy with approval, then the owner presses "Request review". Reviews can take days to weeks.

## Clean the Sheet
See `backend-apps-script.md`. Always: identify rows, show the owner, the owner deletes after making a copy. Never write test rows.

## Check the mybto.sg domain status
See `hosting-domain-deploy.md` (Hosting API call with a firebase-tools access token, `dig` against `ns1.vodien.com`, `curl -sI https://mybto.sg/`). Expect `mybto.sg` HOST_ACTIVE and CERT_ACTIVE, and `www.mybto.sg` a redirect to `mybto.sg` (its certificate was CERT_VALIDATING at switch time and activates on its own).

## After a deploy, check both addresses
1. `curl -sI https://mybto.sg/ | head -1` gives 200, and `https://www.mybto.sg/` redirects to `https://mybto.sg/`.
2. A browser visit to `https://mybto.web.app/shortlist` lands on `https://mybto.sg/shortlist` with the saved shortlist (host.js carries localStorage in `#mybto-migrate=`).
3. Static files (`robots.txt`, `ads.txt`, `googled48848b9b3ea2809.html`) still load on both hosts without redirect.
4. Apps Script `SAMPLE_URL` still points at mybto.web.app and keeps working. Update it only with the next re-paste of `Code.gs`.

## Hand over to the next agent
- Make sure `SKILL.md` "Open items" is current, and add the day's decisions to `decisions-and-history.md`.

# Backend: Google Sheet + Apps Script

Free, no server, no secrets. The browser posts to an Apps Script web app that writes to a private Google Sheet. Repo source: `apps-script/Code.gs`, `apps-script/Analytics.js`, `apps-script/appsscript.json`. Owner-facing setup steps: `apps-script/README.md`.

## Where things are
- Sheet: "MyBTO user data", id `1OtKFdWeVztq-IOXe0jkrelAUsCmxnLnaWJJ5febl2vI`, in the owner's Google account. Private: share only with the team, never make it public. (`apps-script/README.md` says to name it "MyBTO data"; the live sheet is called "MyBTO user data".)
- Apps Script: container-bound (Sheet > Extensions > Apps Script). Files there: `Code.gs`, `Analytics.gs` (paste of `Analytics.js`), `appsscript.json`.
- Web app URL: `SHEETS_URL` in `public/js/config.js` (ends `...94lPew/exec`). Public by design, not a secret. The hardened version was deployed on 2026-10-14; older deployments were archived.
- Manifest: time zone Asia/Singapore, V8, `executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`, scopes `spreadsheets.currentonly` and `script.external_request`.

## Tabs
| Tab | Content |
|---|---|
| `Rankings` | One row per ranking sent. Columns = `RANKING_COLUMNS` in `Analytics.js` |
| `Shortlists` | One row per user + project, updated in place: `user, project, updated_at, unit_ids` |
| `Sample` | Same columns as Rankings, for `importSample()`. Empty: the owner chose not to import sample users |
| `Settings` | `B1` = INCLUDE_SAMPLE. Now FALSE, so Analytics counts only real rankings |

`RANKING_COLUMNS`: `received_at, user, project, project_type, housing_type, blocks, min_storey, max_storey, floor_pref, weight_clearance, weight_corner, weight_roof, weight_chute, weight_mrt, weight_mscp, weight_wind_facing, weight_wind_open, sun_weights, design_weights, block_weights, facility_weights, consent, consented_at, units_ranked, top50, full_ranking, full_ranking_2, full_ranking_3, full_ranking_4`. Weight groups are stored as readable `name: value; name: value` lists. The full ranking is split over 4 columns at 49,000 characters each (a cell holds 50,000). Rows are written by column ORDER, so a column change needs the header row fixed too.

## Request contract
`doPost` takes a JSON body sent as `text/plain` (a simple request, no CORS preflight; the browser uses `mode: 'no-cors'` and `keepalive`, and ignores the answer):
- Ranking: `{type:'ranking', user, project, project_type, housing_type, blocks:[...], min_storey, max_storey, floor_pref, weights:{block:{}, sun:{}, design:{}, facility:{}, clearance, corner, roof, chute, mrt, mscp, wind_facing, wind_open}, consent:true, consented_at, ranking:[unit ids]}`.
- Shortlist: `{type:'shortlist', user, project, unit_ids:[...]}`.
- Answers `{ok:true}` or `{ok:false, error}`. Errors include `empty body`, `body too large`, `bad json`, `unknown type`, `bad project`, `bad user`, `consent required`, `bad weight <k>`, `bad ranking`, `bad unit_ids`, `slow down`, `busy, try again`, `full`.

`doGet ?action=analytics&project=<key>` returns `analyseProject(...)`: aggregates only (never unit ids or rows), from the LATEST ranking per user + project, plus Sample rows when Settings!B1 is TRUE. Cached 5 minutes. Other actions answer `unknown action`; a bad key answers `bad project`; fewer than 5 users answers `not enough data yet`.

## Checks and limits
In `Analytics.js` (shared with Node tests and `dev.js`):
- Body at most 200 KB counted in UTF-8 bytes. Known `type` only.
- `PROJECT_KEYS` allowlist (the 7 keys). `user` must match `^[A-Za-z][A-Za-z0-9_-]{7,63}$`. `typeof` checks on user and project.
- Weights are integers -5..5. Names (blocks, facings, designs, facilities, housing type) match a safe pattern; at most 80 per group, 60 blocks.
- Unit ids start with a letter or digit, max 40 chars; up to 5,000 ranked ids, 500 shortlist ids.
- Text starting with `= + - @` gets a leading apostrophe (no formula injection).
In `Code.gs`:
- Per-user throttle (`USER_GAP_SECONDS`): one ranking per 5 s, one shortlist write per 2 s.
- Hourly ceilings (`HOURLY_CEILING`): 2,000 rankings and 5,000 shortlist writes per clock hour across everyone.
- Row caps: 200,000 rankings, 100,000 shortlists (last resort; archive rows if reached).
- `LockService` around writes. Analytics reads only the columns up to `consent` and only the requested project.
- `SAMPLE_URL` = `https://mybto.web.app/data/sample_submissions.json` (used only by `importSample()`). <!-- DOMAIN-SWITCH: update when mybto.sg is primary -->

## Client side (`public/js/store.js`, `app.js`)
- `saveRanking` sends the full order of all matching units after each Rank press. Before sending, `app.js` hashes the payload (without `consented_at`) and stores it in `mybto:sent:<project>`; an identical ranking (Rank pressed again with nothing changed, double tap) is not sent again.
- `saveShortlist` is debounced 2 s and flushed on `pagehide`.
- Failures are swallowed with `console.warn`; the site never shows a Sheet error.

## Changing the backend
1. Edit `apps-script/Code.gs` and/or `apps-script/Analytics.js`. Run `npm test` and `python3 pipeline/build_pages.py` (refreshes `public/js/analytics-core.js`).
2. Commit, then ask the owner to paste BOTH files into the Apps Script editor (`Analytics.js` goes into `Analytics.gs`), Save, then Deploy > Manage deployments > pencil (edit) > Version: New version > Deploy. The `/exec` URL stays the same. Saving alone does not update the live web app.
3. If columns changed (for example a new factor adds `weight_<key>`), the owner must also fix the header row of Rankings and Sample (or clear a tab and run `setup()`), because rows are written by column order.
4. Agents do not publish Apps Script versions themselves.

## Safe verification (never write test rows)
```
URL=$(grep -o "https://script.google.com/macros/s/[^']*/exec" public/js/config.js)
curl -sL "$URL?action=analytics&project=berlayar-rise-7"          # {"ok":true,...} or {"ok":false,"error":"not enough data yet"}
curl -sL "$URL?action=nothing"                                     # {"ok":false,"error":"unknown action"}
curl -sL -H 'Content-Type: text/plain' -d '{"type":"probe"}' "$URL"   # {"ok":false,"error":"unknown type"}, writes nothing
```
For full write tests use the fake Sheet: `DEV_FAKE_SHEETS=1 PORT=3000 node dev.js`, then `/fake-sheets?action=dump` shows what it holds (tests only).

## Cleanup recipes (ask the owner first; they act in the Sheet)
- Duplicates: on 2026-10-14 the Rankings tab was cleaned: 11 sample-era rows (12 and 13 Oct) and 33 exact duplicate rows were removed, leaving 448 rows. Before the client fix about 7% of rows were repeats. Analytics already uses only each user's latest ranking per project, so duplicates do not skew it.
- To find exact duplicates: copy the tab, sort by `user`, `project`, `received_at`, and compare every column except `received_at` and `consented_at`. Or, with read access through the Google Sheets API or connector, list candidate rows and send the owner the row numbers. Delete only after the owner agrees. Keep a copy (File > Make a copy) before any bulk delete.
- Old test or sample-era rows: identify by date and user id; the owner deletes them.
- Excel export: File > Download > Microsoft Excel (.xlsx). Users appear only as the anonymous id.
- Settings!B1: keep FALSE unless the owner wants the sample users back in Analytics.

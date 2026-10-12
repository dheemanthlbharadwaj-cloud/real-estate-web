---
name: mybto-ops
description: Operate the MyBTO website (BTO unit ranker, https://mybto.web.app) end to end. Use for ANY work on the MyBTO site, its unit data, scoring, page copy, Firebase Hosting deploys, the Google Sheet and Apps Script backend (rankings, shortlists, analytics), the Analytics page, the ad pop-ups, local dev servers or tests. Works for any agent with a shell.
---

# MyBTO operations

> **Maintenance rule: whenever you change the website or the Sheet/Apps Script backend, update this skill in the same commit.**
> Stale facts here mislead the next agent. Also keep `AGENTS.md` and `CLAUDE.md` accurate.

Repo: `/home/user/real-estate-web`. Branch `claude/jolly-meitner-llfg6y`. Node >= 20, Python 3. `README.md` has the long-form setup.

## What the site is
- Static site served from `public/` on **Firebase Hosting** (Spark plan, free; `firebase.json`: `public`, `cleanUrls`, no trailing slash, redirects `/analysis` -> `/analytics` and `/account`, `/archive/account`, `/archive/dashboard` -> `/`, cache headers for `/data/**` and `/img/**`). No Cloud Functions, no server code, no sign-in.
- Production: https://mybto.web.app. `.firebaserc` project id is the placeholder `mybto` until the human confirms the real Firebase project id. The old Vercel site and the old Firestore project (`sgrealestate-5fbd4`) are retired: nothing in the repo uses them. Never delete anything in that old Firestore.
- Data lives in a **Google Sheet** behind a **Google Apps Script web app** (code in `apps-script/`, see Backend below). The browser finds it through `window.MYBTO_CONFIG.SHEETS_URL` in `public/js/config.js`. Empty = not connected: rankings are not sent and Analytics says "Analytics will appear here soon."
- Unit attributes are currently SAMPLE placeholders (no banner on the site any more). Only Berlayar Rise's unit list is real.
- Pages: `/` (same as `/rank`, generated), `/shortlist`, `/analytics` (generated, `noindex`, one project, not interactive, behind a rewarded video placeholder; opened in a new tab from the buttons above a ranking) and `/archive/home` (old home page). The header (`site.js`) has the logo and two tabs: "Rank units" (`/`) and "<Project> Analytics" (`/analytics?project=`); the project comes from localStorage `project` (written by `app.js loadProject`) and the tab updates live through the `mybto:project` window event. The active tab has `aria-current="page"`. No hamburger menu; on phones the tabs sit on a second row. The footer "More" list has "What each factor means" and "HDB Homes". There are no sign-in links anywhere.
- Seven projects: Plus (Kebun Baru Breeze, Kebun Baru Ridge), Prime (Berlayar Rise, Lakeview Cascadia), Standard (Sembawang Brook, Sembawang Portico, Woodgrove Acres).

## User flow (verify in `public/js/app.js`)
1. Pick project, one housing type (`Scoring.HOUSING_TYPES`), blocks, storey range, floor priority (higher / lower / none; **default Higher**, `loadProject` and the `checked` radio in `build_pages.py`, `restoreLast` restores the last settings kept in this browser), importance -5..+5 per factor.
2. Press **Rank units**. The first time in a browser session (sessionStorage `mybto:ad-consent`) a pop-up opens with a placeholder ad slot (300x250, no third-party script), the NUS research notice and a "Show my ranking" button that turns on after a 5 second countdown ("Not now" cancels). Agreeing is the consent (`consent: true`, `consented_at`). There is no survey and no queue number. The ad logic lives in `public/js/ads.js` (`MyBTOAds.interstitial()` and `MyBTOAds.rewarded(projectKey)`); the single place to plug in a real ad network is `PROVIDERS` in that file. Tests may shorten countdowns with `window.MYBTO_AD_SECONDS = { interstitial, rewarded }`; production is 5 s and 15 s.
3. Ranking shows the **top 50** (`SHOW_TOP`); the **full order** of matching units is sent to the sheet (`ranking` = list of unit ids).
4. Buttons above the ranking: **Shortlisted** (`/shortlist`, star units, drag or arrows to reorder) and **<Project> Analytics** (`/analytics?project=`). Both open in a new tab.
- Ranks are dense: equal scores share a rank and the next score gets the next number (1, 1, 2). Ties break by higher storey then id. Rows with score below 0 are shaded below a red line.
- Facings are only NE, SE, SW, NW. Sun direction means where the living room windows face.
- Chute factor: unit is **more than 10 m** from the nearest refuse chute (`CHUTE_FAR_M = 10`, `chute_m > 10`).
- Score = sum of importance x feature (0..1). Factors in `public/js/scoring.js`: block, sun, design (2-Room Flexi Type 1/2), clearance (>30 m from nearest visible unit), corner, roof, chute (label "10 m away from rubbish chute"), mrt (label "Within 100 m from MRT"; `MRT_NEAR_M = 100` in both pipelines), mscp (label "Within 100 m from a multi-storey car park", `mscp_near`, `MSCP_NEAR_M = 100` in both pipelines and `Scoring`), wind_facing (label "Faces the prevailing wind (SE to E)": 1 for NE or SE facing, because both catch east wind; Singapore's wind is from SE to E, bearing 90 to 135), wind_open (label "Not blocked from the wind", unit field `wind_open`: no other block within 30 m on the SE to E side), facilities (has = 1, near = 0.5; one meter per facility, see Facilities below), floor (fixed weight 5). A meter shows only when some unit in scope has that feature.
- localStorage keys: `project`, `flags:<project>` (shortlist), `mybto:flagcount`, `mybto:uid` (anonymous random user id, starts with `u`), `mybto:last:<project>` (last filters and weights, restored on return; also drives the rank shown on the shortlist page). Always wrapped in try/catch.

## File map
| Path | Purpose |
|---|---|
| `pipeline/build_pages.py` | Source of truth for `public/{index,rank,shortlist,analytics}.html`. Run `python3 pipeline/build_pages.py`. **Never hand-edit those html files.** Every page loads `/js/config.js` before `app.js`. |
| `public/archive/home.html`, `public/css/*` | Hand-edited: old home page, styles |
| `public/js/app.js` | Rank, shortlist, analytics UI (one file, branches on `data-page`) |
| `public/js/scoring.js` | Scoring and ranking; used by browser AND Node (tests, sample generator) |
| `public/js/config.js` | `window.MYBTO_CONFIG = { SHEETS_URL }`. The only place the backend address lives |
| `public/js/store.js` | Sheet client: `userId()`, `saveRanking`, `saveShortlist` (debounced 2 s), `getAnalytics`. POSTs are `text/plain`, `no-cors`, `keepalive`; failures are swallowed with `console.warn` |
| `public/js/ads.js` | Placeholder ad pop-up (Rank) and rewarded video gate (Analytics); plug-in point for a real ad network |
| `public/js/site.js` | Header (logo and the two tabs) and footer on every page. `legend.js`: factor legend entries and image captions. `home.js`: archive home |
| `apps-script/Code.gs` | Apps Script web app: `doPost`, `doGet`, `setup()`, `importSample()` |
| `apps-script/Analytics.js` | Row layout, input checks and analytics maths. Works in Apps Script (paste as `Analytics.gs`) AND Node (`module.exports`). **Single source of truth**, tests and `dev.js` require it |
| `apps-script/appsscript.json`, `apps-script/README.md` | Manifest and the step-by-step setup for the human |
| `public/data/units/*.json` + `index.json` | Unit data per project. Generated, do not hand-edit |
| `public/data/sample_submissions.json` | 420 sample users (`npm run sample`); downloaded by `importSample()` from the live site and used by the fake sheet in `dev.js` |
| `pipeline/make_sample_data.py` | Writes sample `public/data/units/*.json` (has the `PROJECTS` and `FACILITIES` lists) |
| `pipeline/raw/facilities_1st_storey.json` | Facilities at the 1st storey (void deck) read off the 7 HDB brochures, incl. FUTURE ones: `{project_key: [{block|null, facility, storey, future, source}]}`. Read by both pipelines |
| `pipeline/raw/mscp_distance.json` | Hand estimates (from the 7 brochure site plans, scale bar) of metres from each block's centre to the nearest edge of its project's multi-storey car park: `{project: {block: m}}` plus `_method`, `_confidence`, `_edge_to_edge`, `_geometry` (pixel positions used). Keys starting `_` are not projects. Read by both pipelines (`mscp_m`, `mscp_near`, `mscp_estimated`) |
| `pipeline/build_dataset.py` | Real-data build from `pipeline/raw/` extractions; also writes the Excel workbook |
| `lib/make_sample_submissions.js` | `npm run sample` -> `public/data/sample_submissions.json` |
| `firebase.json`, `.firebaserc` | Hosting config (static only) and project id (placeholder `mybto`) |
| `dev.js` | Local server: serves `public/`, applies the `firebase.json` redirects, and with `DEV_FAKE_SHEETS=1` a fake Apps Script at `/fake-sheets` plus a `config.js` that points at it |
| `test/scoring.test.js`, `test/e2e.browser.js` | Unit tests (scoring, Analytics.js), browser test against the fake sheet |

## Recipes
**Change page copy.** Rank/shortlist/analytics/index text: edit `pipeline/build_pages.py`, run `python3 pipeline/build_pages.py`, commit both. Copy built in JS: `public/js/app.js` (`FACTOR_HELP` texts near the top), `site.js`, `legend.js`. Archive home: edit `public/archive/home.html`.

**Change a factor or scoring.** Edit `public/js/scoring.js` (`FACTORS`, `scoreUnit`, `availability`), the matching text and meters in `app.js`, a legend entry in `legend.js`, then update `test/scoring.test.js` expectations (if you are allowed to touch tests). If factor keys change, update `FACTOR_KEYS` in `apps-script/Analytics.js` (a test compares it to `Scoring.FACTORS`; the Rankings header gets a new `weight_<key>` column, so also fix the header in the live sheet and redeploy the Apps Script). Rerun `npm run sample` if sample weights depend on it. Run all tests.

**Regenerate data.** Sample: `python3 pipeline/make_sample_data.py && npm run sample`. Real: `python3 pipeline/build_dataset.py` (exits non-zero and prints `BUILD FAILED` on missing positions). Commit `public/data/units/` and `public/data/sample_submissions.json`. After a deploy, run `importSample()` again in Apps Script if the sample changed.

**Facilities (void deck and future).** Real entries come from `pipeline/raw/facilities_1st_storey.json` (site plan legend markers plus the unit distribution pages, which label the 1st storey of a block). In `make_sample_data.py` a facility in a listed block goes to `facilities_has` of that block's units, and to `facilities_near` of the project's other blocks; entries with `block: null` (standalone MSCP or low-rise blocks such as 325 or 436, or legend-only items) go to `facilities_near` for every unit of the project. They are applied after the random draw, so other attributes do not reshuffle. Random placeholders use `FACILITIES_RANDOM`; "Mini-mart" and "Future amenities/facilities" are never random. "Future amenities/facilities" is explained in `FUTURE_FAC_HELP` (`app.js`, meter tooltip) and in the facilities entry of `legend.js`. `build_dataset.py` merges the same JSON.

**Wind and car park data.** `wind_open` in `make_sample_data.py` is a placeholder (own seeded Random `bto-sample-wind-<key>`, NE/SE stacks 85% open, others 50%; in `SAMPLE_FIELDS`). In `build_dataset.py` it is an explicit raw stack field `wind_open` if present, else computed: no stack of another block within `WIND_OPEN_M = 30` at bearing 90 to 135 (uses `site["north_bearing_deg"]`, default 0 = plan up is north; TODO footprints instead of stack points). `mscp_m` comes from `mscp_distance.json` per block; to refine, edit that file and regenerate. Legend pictures `lg-wind-facing`, `lg-wind-open`, `lg-mscp` are PIL drawings over brochure crops (12 legend entries; the e2e test counts them).

**Add a facility.** Brochure facility: add an entry to `pipeline/raw/facilities_1st_storey.json` (block null if you cannot tell the block), regenerate. Sample placeholder: add the name to `FACILITIES_RANDOM` in `pipeline/make_sample_data.py`. Real data: add it to the site-plan extraction in `pipeline/raw/` (`build_dataset.py` reads `site["facilities"]`, near = within 50 m). Regenerate data. Facility meters appear automatically; add a legend note if needed.

**Add a project.** Add to `PROJECTS` in `pipeline/make_sample_data.py` and `build_dataset.py`, regenerate, check `public/data/units/index.json`, update README project table and this skill.

**Run locally.**
- `node dev.js` (http://localhost:3000): static site. `SHEETS_URL` comes from `public/js/config.js` (empty by default).
- `DEV_FAKE_SHEETS=1 PORT=3123 node dev.js` (`npm run dev:fake` is the same on port 3000): an in-memory fake sheet at `/fake-sheets`. POST uses the same checks and row layout as the real one (`Analytics.js`), GET `?action=analytics&project=` runs `analyseProject` over the posted rows plus the sample users, and `?action=dump` (tests only) returns everything held. `/js/config.js` is overridden to `SHEETS_URL: '/fake-sheets'`.

**Tests.**
- `npm test` (scoring + `apps-script/Analytics.js` unit tests, `node --test`).
- `CHROMIUM=/opt/pw-browsers/chromium node test/e2e.browser.js` (starts its own dev server on 3123 with the fake sheet; loads Playwright from the global `npm root -g`). Do NOT run `playwright install`.
- Browser test asserts: no SVG elements and no em dashes on any page; ad pop-up and countdown; the fake sheet got one ranking row with consent, top 50, full ranking, anonymous id and no queue number; starring sends one shortlist row; header tabs follow the project; Analytics gate, charts from the fake endpoint, no unit ids; with `SHEETS_URL` empty nothing is sent and Analytics says "Analytics will appear here soon." with a quiet console; the `firebase.json` redirects; phone layouts do not scroll sideways.

**Deploy (Firebase Hosting).** Needs explicit human approval. Run the tests, commit, then the human (or an approved agent) runs `npx firebase-tools deploy --only hosting --project <project id>` after `npx firebase-tools login`. There is no auto-deploy from git. Never deploy functions, firestore or auth: the project has none of those. Never force-push this branch; stage files by name.

## Backend (Google Sheet + Apps Script)
- Lives in a Google Sheet "MyBTO data" in the project's Google account: Extensions > Apps Script (container-bound). The repo copy in `apps-script/` is the source; the human pastes `Code.gs`, `Analytics.js` (as `Analytics.gs`) and `appsscript.json` into the editor. Full steps for the human: `apps-script/README.md`.
- Tabs: `Rankings` (one row per ranking press, `RANKING_COLUMNS` in `Analytics.js`), `Shortlists` (one row per user + project, updated in place), `Sample` (420 made-up users from `importSample()`, same columns), `Settings` (`B1` INCLUDE_SAMPLE, TRUE mixes Sample into Analytics).
- `doPost` takes a JSON body sent as `text/plain` (avoids a CORS preflight): `{type:'ranking', user, project, project_type, housing_type, blocks, min_storey, max_storey, floor_pref, weights, consent:true, consented_at, ranking:[unit ids]}` or `{type:'shortlist', user, project, unit_ids}`. Checks (all in `Analytics.js`): body <= 200 KB, known type, project key and user id formats, weights integers -5..5, name formats, up to 5000 ranked ids, 500 shortlist ids, row caps in `Code.gs`, `LockService` around writes, text starting with `= + - @` gets an apostrophe. The full ranking is split over `full_ranking`, `full_ranking_2..4` (50,000 characters per cell).
- `doGet ?action=analytics&project=<key>` returns `analyseProject(...)` JSON: aggregates only, never unit ids or rows, computed from the LATEST ranking per user + project, cached 5 minutes in `CacheService`.
- The `/exec` URL is public by design and is NOT a secret (it is in `config.js`). Abuse limits are the checks above. The sheet itself is private; share it only with the team.
- **Change the backend:** edit `apps-script/`, run `npm test`, tell the human to paste the changed files into the Apps Script editor and publish a new version: Deploy > Manage deployments > pencil > Version: New version > Deploy. The URL stays the same. If columns changed, the human must also fix the header row in the sheet (or clear the tab and run `setup()`), because rows are written by column order.
- Excel: sheet > File > Download > Microsoft Excel (.xlsx). Users appear only as the anonymous browser id.
- Status: NOT created yet. `SHEETS_URL` is empty until the human sends the `/exec` URL; then put it in `public/js/config.js`, test, commit, and have the human deploy. Update this note when done.

## Keys and secrets
There are none in the repo and the code reads no environment variables. The Apps Script `/exec` URL and the Firebase project id are public. Do not add a Firebase service account or any key. If you ever see credentials in the diff, stop and remove them. (An old `.env.local` from the Vercel days may exist on a machine; it is unused and git-ignored.)

## Sandbox and safety rules
- Need explicit human approval: Firebase Hosting deploys, domain changes, publishing a new Apps Script version, anything that discards data. Automated agents may be blocked from these. If blocked, STOP, do not look for a workaround, and hand the human the exact command or console steps.
- No force-push on `claude/jolly-meitner-llfg6y`. Stage files by name.
- Do not edit generated html by hand; edit `pipeline/build_pages.py`. If another agent is editing `build_pages.py`, `public/*.html` or tests, coordinate, do not overwrite.
- Cloud sandboxes send outbound HTTPS through a proxy (`HTTPS_PROXY`, CA bundle `/root/.ccr/ca-bundle.crt`). On TLS or 403/407 errors read `/root/.ccr/README.md`; never disable TLS verification or unset the proxy. The site loads Chart.js from jsDelivr and fonts from Google Fonts, which may not load in a sandbox; the tests do not depend on them.
- Playwright Chromium is at `/opt/pw-browsers/chromium`; set `CHROMIUM=` to it. Do not run `playwright install`.

## House style for site copy
- No em dashes (U+2014) anywhere visible on the site. Use commas, colons or short sentences. The e2e test fails on them.
- No SVG on the site: no `<svg>` elements, no inline icons. Use text characters (e.g. the star) or the webp images in `public/img/`. The e2e test counts `svg` nodes.
- Plain, human wording; short sentences; address the reader as "you". No marketing filler.
- Units: write "10 m", "30 m". Facings: NE, SE, SW, NW only.
- Images in `public/img/` are HDB brochure drawings; keep the footer credit.

## Before you finish
1. `npm test` passes; e2e passes if you touched the UI.
2. Regenerated html/data are committed with their sources.
3. This skill (and `AGENTS.md` / `CLAUDE.md` if relevant) updated in the same commit.
4. No secrets in the diff: `git diff --cached | grep -i "private_key\|service_account"` returns nothing.
5. Nothing was pushed or deployed unless the human approved it.

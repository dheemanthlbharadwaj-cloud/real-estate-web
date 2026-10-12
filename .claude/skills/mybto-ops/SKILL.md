---
name: mybto-ops
description: Operate the MyBTO website (BTO unit ranker, https://mybto.vercel.app) end to end. Use for ANY work on the MyBTO site, its unit data, scoring, page copy, Firestore or Firebase (rules, auth, submissions, flags), Vercel deploys and env vars, the Analytics page, the ad pop-ups, the data dashboard, local dev servers or tests. Works for any agent with a shell.
---

# MyBTO operations

> **Maintenance rule: whenever you change the website or database, update this skill in the same commit.**
> Stale facts here mislead the next agent. Also keep `AGENTS.md` and `CLAUDE.md` accurate.

Repo: `/home/user/real-estate-web`. Branch `claude/jolly-meitner-llfg6y`. Node >= 20, Python 3. `README.md` has the long-form setup.

## What the site is
- Static site served from `public/` on Vercel (`vercel.json`: `outputDirectory: public`, `cleanUrls: true`, redirects `/account` -> `/archive/account` and `/analysis` -> `/analytics`), plus three functions in `api/` (`analysis`, `config`, `export`).
- Production: https://mybto.vercel.app (target domain mybto.sg). Every push to the branch above deploys production within a minute or two (Vercel Git integration, set up in the Vercel dashboard, not in the repo).
- Unit attributes are currently SAMPLE placeholders (no banner on the site any more). Only Berlayar Rise's unit list is real.
- Pages: `/` (same as `/rank`, generated), `/shortlist`, `/analytics` (generated, `noindex`, one project, not interactive, behind a rewarded video placeholder; opened in a new tab from the buttons above a ranking), `/archive/home` (old home page), `/archive/account` (optional sign-in, `noindex`, generated, not linked) and `/archive/dashboard` (hand-written, `noindex`, not linked: data dashboard, see Dashboard below). The header (`site.js`) has the logo and two tabs: "Rank units" (`/`) and "<Project> Analytics" (`/analytics?project=`); the project comes from localStorage `project` (written by `app.js loadProject`) and the tab updates live through the `mybto:project` window event. The active tab has `aria-current="page"`. No hamburger menu; on phones the tabs sit on a second row. The footer "More" list has "What each factor means" and "HDB Homes". `dev.js` does not apply the vercel.json redirects locally.
- Seven projects: Plus (Kebun Baru Breeze, Kebun Baru Ridge), Prime (Berlayar Rise, Lakeview Cascadia), Standard (Sembawang Brook, Sembawang Portico, Woodgrove Acres).

## User flow (verify in `public/js/app.js`)
1. Pick project, one housing type (`Scoring.HOUSING_TYPES`), blocks, storey range, floor priority (higher / lower / none), importance -5..+5 per factor.
2. Press **Rank units**. The first time in a browser session (sessionStorage `mybto:ad-consent`) a pop-up opens with a placeholder ad slot (300x250, no third-party script), the NUS research notice and a "Show my ranking" button that turns on after a 5 second countdown ("Not now" cancels). Agreeing is the consent. There is no survey any more. The ad logic lives in `public/js/ads.js` (`MyBTOAds.interstitial()` and `MyBTOAds.rewarded(projectKey)`); the single place to plug in a real ad network is `PROVIDERS` in that file. Tests may shorten countdowns with `window.MYBTO_AD_SECONDS = { interstitial, rewarded }`; production is 5 s and 15 s.
3. Ranking shows the **top 50** (`SHOW_TOP`); the **full order** of matching units is saved (`ranking` = list of unit ids).
4. Buttons above the ranking: **Shortlisted** (`/shortlist`, star units, drag or arrows to reorder) and **<Project> Analytics** (`/analytics?project=`). Both open in a new tab.
- Ranks are dense: equal scores share a rank and the next score gets the next number (1, 1, 2). Ties break by higher storey then id. Rows with score below 0 are shaded below a red line.
- Facings are only NE, SE, SW, NW. Sun direction means where the living room windows face.
- Chute factor: unit is **more than 10 m** from the nearest refuse chute (`CHUTE_FAR_M = 10`, `chute_m > 10`).
- Score = sum of importance x feature (0..1). Factors in `public/js/scoring.js`: block, sun, design (2-Room Flexi Type 1/2), clearance (>30 m from nearest visible unit), corner, roof, chute (label "10 m away from rubbish chute"), mrt (label "Within 100 m from MRT"; `MRT_NEAR_M = 100` in both pipelines), facilities (has = 1, near = 0.5; one meter per facility, see Facilities below), floor (fixed weight 5). A meter shows only when some unit in scope has that feature.
- Other localStorage key: `mybto:flagcount`. Always wrapped in try/catch.

## File map
| Path | Purpose |
|---|---|
| `pipeline/build_pages.py` | Source of truth for `public/{index,rank,shortlist,analytics}.html` and `public/archive/account.html`. Run `python3 pipeline/build_pages.py`. **Never hand-edit those html files.** |
| `public/archive/home.html`, `public/css/*` | Hand-edited: old home page, styles |
| `public/js/app.js` | Rank, shortlist, analytics UI (one file, branches on `data-page`) |
| `public/js/scoring.js` | Scoring and ranking; used by browser AND Node (tests, sample generator) |
| `public/js/store.js` | Firebase Auth + Firestore client (anonymous sign-in, `saveList`, `loadList`, `saveFlags`) |
| `public/js/ads.js` | Placeholder ad pop-up (Rank) and rewarded video gate (Analytics); plug-in point for a real ad network |
| `public/archive/dashboard.html` | Hidden data dashboard page (password, summary, Download Excel) |
| `api/export.js` | `POST /api/export` with `{password, format}` (summary or xlsx); see Dashboard |
| `public/js/site.js` | Header (logo and the two tabs) and footer on every page. `legend.js`: factor legend entries and image captions. `home.js`: archive home |
| `public/data/units/*.json` + `index.json` | Unit data per project. Generated, do not hand-edit |
| `pipeline/make_sample_data.py` | Writes sample `public/data/units/*.json` (has the `PROJECTS` and `FACILITIES` lists) |
| `pipeline/raw/facilities_1st_storey.json` | Facilities at the 1st storey (void deck) read off the 7 HDB brochures, incl. FUTURE ones: `{project_key: [{block|null, facility, storey, future, source}]}`. Read by both pipelines |
| `pipeline/build_dataset.py` | Real-data build from `pipeline/raw/` extractions; also writes the Excel workbook |
| `lib/make_sample_submissions.js` | `npm run sample` -> `lib/sample_submissions.json` (420 sample users, never written to Firestore) |
| `api/analysis.js`, `lib/analysis.js` | `GET /api/analysis?group=...&value=` (needs a Firebase ID token; the Analytics page calls `group=project&value=<key>`); aggregation maths. The result has no unit ids (`most_flagged` and demographics were removed) |
| `lib/firebase.js`, `lib/verify-token.js` | Admin SDK singleton; token check against Google public certs when no service account |
| `api/config.js` | Serves public Firebase web config from env vars |
| `firestore.rules`, `firebase.json`, `.firebaserc` | Rules, auth providers (anonymous + emailPassword), project `sgrealestate-5fbd4` |
| `dev.js` | Local server: serves `public/` and `/api/*` |
| `test/scoring.test.js`, `test/e2e.browser.js`, `test/fake-firebase/` | Unit tests, browser test with Firebase stubbed |
| `.env.example` | Env var template (no values) |

## Recipes
**Change page copy.** Rank/shortlist/analytics/archived account/index text: edit `pipeline/build_pages.py`, run `python3 pipeline/build_pages.py`, commit both. Copy built in JS: `public/js/app.js` (`FACTOR_HELP` texts near the top), `site.js`, `legend.js`. Archive home: edit `public/archive/home.html`.

**Change a factor or scoring.** Edit `public/js/scoring.js` (`FACTORS`, `scoreUnit`, `availability`), the matching text and meters in `app.js`, a legend entry in `legend.js`, then update `test/scoring.test.js` expectations (if you are allowed to touch tests). If analysis keys change, update `FACTOR_KEYS` in `lib/analysis.js`. Rerun `npm run sample` if sample weights depend on it. Run all tests.

**Regenerate data.** Sample: `python3 pipeline/make_sample_data.py && npm run sample`. Real: `python3 pipeline/build_dataset.py` (exits non-zero and prints `BUILD FAILED` on missing positions). Commit `public/data/units/` and `lib/sample_submissions.json`. `vercel.json` ships `public/data/units/index.json` and `lib/sample_submissions.json` with the analysis function, so keep both paths.

**Facilities (void deck and future).** Real entries come from `pipeline/raw/facilities_1st_storey.json` (site plan legend markers plus the unit distribution pages, which label the 1st storey of a block). In `make_sample_data.py` a facility in a listed block goes to `facilities_has` of that block's units, and to `facilities_near` of the project's other blocks; entries with `block: null` (standalone MSCP or low-rise blocks such as 325 or 436, or legend-only items) go to `facilities_near` for every unit of the project. They are applied after the random draw, so other attributes do not reshuffle. Random placeholders use `FACILITIES_RANDOM`; "Mini-mart" and "Future amenities/facilities" are never random. "Future amenities/facilities" is explained in `FUTURE_FAC_HELP` (`app.js`, meter tooltip) and in the facilities entry of `legend.js`. `build_dataset.py` merges the same JSON.

**Add a facility.** Brochure facility: add an entry to `pipeline/raw/facilities_1st_storey.json` (block null if you cannot tell the block), regenerate. Sample placeholder: add the name to `FACILITIES_RANDOM` in `pipeline/make_sample_data.py`. Real data: add it to the site-plan extraction in `pipeline/raw/` (`build_dataset.py` reads `site["facilities"]`, near = within 50 m). Regenerate data. Facility meters appear automatically; add a legend note if needed.

**Add a project.** Add to `PROJECTS` in `pipeline/make_sample_data.py` and `build_dataset.py`, regenerate, check `public/data/units/index.json`, update README project table and this skill.

**Run locally.**
- `node dev.js` (real Firebase using `.env.local`), http://localhost:3000.
- `DEV_FAKE_FIREBASE=1 PORT=3123 node dev.js` needs no keys: `/api/config` returns fake values, `/api/analysis` accepts any token starting `fake-` and uses sample data only; `/api/export` accepts password `test` and the sample submissions. `npm run dev:fake` is the same on port 3000.

**Tests.**
- `npm test` (scoring + analysis unit tests, `node --test`).
- `CHROMIUM=/opt/pw-browsers/chromium node test/e2e.browser.js` (starts its own dev server on 3123; loads Playwright from the global `npm root -g`). Do NOT run `playwright install`.
- Browser test asserts: no SVG elements and no em dashes on any page; ad pop-up and countdown; consent-only `survey`; header tabs follow the project; Analytics gate, no filters, no unit ids; dashboard wrong password and an xlsx readable with ExcelJS (run `npm install` first, `exceljs` is a dependency).

**Commit and push (deploys).** Run the tests, then `git add` specific files, commit, `git push origin claude/jolly-meitner-llfg6y`. Pushing deploys production, so run the tests first and follow the human's instructions on when to push. Never force-push this branch. Check status afterwards in the Vercel dashboard or with the Vercel MCP `list_deployments`.

## Database (Firestore, project `sgrealestate-5fbd4`, region asia-southeast1)
- `submissions/<uid>_<projectKey>`: one doc per user per project, overwritten on every ranking. Fields written by `store.saveList` + `app.js saveRanking`: `uid`, `project`, `project_type`, `flat_types`, `blocks`, `min_storey`, `max_storey`, `floor_pref` (none|higher|lower), `weights` (map), `survey` (map, now only `{ consent: true, consented_at }`; the deployed rules require the key to be a map. Old rows may still hold the ten legacy answers `age`, `household`, `application`, `current_home`, `bto_attempts`, `work_area`, `car`, `children_plan`, `income`, `queue_position`, which the Excel export keeps as `survey_*` columns), `ranking` (list of unit ids, all matching units), `updated_at`.
- `flags/<uid>_<projectKey>`: `uid`, `project`, `unit_ids` (shortlist order, max 500).
- `firestore.rules`: a user may read, create, update, delete only docs whose id starts with their own uid (`owns`), with `request.resource.data.uid == auth.uid`. Submissions: `weights`, `survey` maps, `survey.size() <= 14`, `ranking` list <= 3000, doc < 20 fields. Flags: `unit_ids` list <= 500. Everything else denied. Aggregates are computed server-side only.
- Analytics read path (`api/analysis.js`): with `FIREBASE_SERVICE_ACCOUNT` set, Admin SDK reads all `submissions` (60 s cache) and mixes in sample users. Without it, tokens are verified against Google certs and ONLY sample data is shown. `SAMPLE_ANALYSIS=0` removes the sample users. Only submissions with `survey.consent` count.
- Deploy rules and auth providers (human approval needed, see safety): `npx firebase-tools deploy --only auth,firestore:rules`. Console route: Authentication > Sign-in method > enable Anonymous (and Email/Password, Google); Firestore > Rules > paste `firestore.rules` > Publish. Authorized domains must include the Vercel domain.
- **Status as of 2026-10-12:** anonymous sign-in and the current `firestore.rules` are NOT deployed yet (an agent's deploy was blocked; the human has the command). Until they are live the site degrades: rankings show but are not saved for visitors who are not signed in, and Analytics says "Analytics isn’t switched on yet". Check live state before assuming (`firebase_get_security_rules` in the Firebase MCP, or the console). Update this note when done.
- Never delete Firestore data. Read-only inspection is fine when credentials exist.

## Dashboard and Excel export
- Page: `/archive/dashboard` (hidden, `noindex`, unlinked). Enter the shared password, see rankings per project and the latest update, press "Download Excel".
- `api/export.js`: POST JSON `{password, format}`. `ADMIN_PASSWORD` unset -> 503 "Dashboard not set up"; wrong password -> 401 after about 1 s (compared with `crypto.timingSafeEqual`); `FIREBASE_SERVICE_ACCOUNT` missing -> 503 with a clear message. `format: 'xlsx'` returns `mybto-rankings-YYYY-MM-DD.xlsx` (ExcelJS; sheets Rankings, Shortlists, Read me). Users appear as the first 10 hex chars of sha256(uid). Long full rankings are split over `full_ranking_part_N` columns (Excel cell limit).
- Set the password: Vercel project > Settings > Environment Variables > add `ADMIN_PASSWORD` (Production and Preview), then redeploy. The human does this; never write the value in the repo or chat. Status as of 2026-10-12: not set yet (the Vercel connector got 403 for this team; the human has the steps).
- Local fake mode (`DEV_FAKE_FIREBASE=1`): password `test`, sample submissions.

## Keys and secrets
Env vars the code reads (`grep -rn process.env api lib dev.js`):
| Var | Read in | Secret? | Purpose |
|---|---|---|---|
| `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_APP_ID` | `api/config.js` (`FIREBASE_PROJECT_ID` also `api/analysis.js`) | No, public web config by design; access is enforced by Auth + rules | Browser Firebase init |
| `FIREBASE_SERVICE_ACCOUNT` | `lib/firebase.js`, `api/analysis.js`, `api/export.js` | **YES** | Whole service-account JSON, one line; enables real data in Analytics and the export |
| `ADMIN_PASSWORD` | `api/export.js` | **YES** | Shared password for `/archive/dashboard` and the Excel export. Unset: the export answers 503 "Dashboard not set up" |
| `SAMPLE_ANALYSIS` | `api/analysis.js` | No | `0` hides sample users |
| `DEV_FAKE_FIREBASE`, `PORT` | `dev.js` | No | Local dev only |

Where they live: Vercel project > Settings > Environment Variables (Production and Preview); locally `.env.local` (gitignored by `.env*`, only `.env.example` is tracked; `dev.js` loads it).
- Never print, log, commit, paste into chat, or write into this skill any value of `FIREBASE_SERVICE_ACCOUNT` or any private key. Do not `cat .env.local` or echo env values; check presence only (`grep -c '^FIREBASE_SERVICE_ACCOUNT=' .env.local`).
- The human adds the service account in Vercel (Firebase console > Project settings > Service accounts > Generate new private key). Do not ask for it in chat.

## Sandbox and safety rules
- Need explicit human approval: production Firebase deploys (rules, auth), Vercel production changes (env vars, promotes, rollbacks, domain changes), anything that discards data. Automated agents may be blocked from these. If blocked, STOP, do not look for a workaround, and hand the human the exact command or console steps.
- No force-push on `claude/jolly-meitner-llfg6y`. Stage files by name.
- Do not edit generated html by hand; edit `pipeline/build_pages.py`. If another agent is editing `build_pages.py`, `public/*.html` or tests, coordinate, do not overwrite.
- Cloud sandboxes send outbound HTTPS through a proxy (`HTTPS_PROXY`, CA bundle `/root/.ccr/ca-bundle.crt`). On TLS or 403/407 errors read `/root/.ccr/README.md`; never disable TLS verification or unset the proxy. The site loads Firebase JS from `gstatic.com` and fonts from Google Fonts, which may not load in a sandbox, so browser tests use `test/fake-firebase/`.
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

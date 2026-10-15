---
name: mybto-ops
description: Operate the MyBTO website (Singapore HDB BTO unit ranker, live at https://mybto.web.app, custom domain mybto.sg being connected) end to end. Use for ANY work on MyBTO - site pages and copy, unit data and the real-data pipeline, scoring, the Google Sheet and Apps Script backend, Firebase Hosting deploys, the mybto.sg domain and Vodien DNS, Google Analytics 4, Google AdSense, Search Console, SEO files, local dev servers and tests. Works for any agent with a shell (opencode, Claude Code, Codex).
---

# MyBTO operations manual

Read this file first. It is short on purpose. Open the files in `references/` when a task needs them (see the router below).

> **Maintenance rule.** Every commit that changes the website, the data, or the Sheet/Apps Script backend also updates this skill (this file and the matching reference) in the same commit. Keep `AGENTS.md` and `CLAUDE.md` consistent too. A stale fact here misleads the next agent.

## What the project is
- MyBTO ranks every sale unit of the HDB June 2026 BTO exercise (7 projects, 6,952 units) by the visitor's own importance weights, shows the top 100, and lets them shortlist and share units.
- Owner: the user, based in Singapore. All unit data is real, read from the HDB brochures and an annotated board, and published for all 7 projects.
- Static site in `public/` on Firebase Hosting (project `mybto-ce84f`, site `mybto`, Spark plan). No server code, no sign-in, no Cloud Functions.
- Live address: https://mybto.web.app. <!-- DOMAIN-SWITCH: update when mybto.sg is primary -->
- Custom domain mybto.sg. Status: being connected on 2026-10-15; once live, mybto.sg is the primary address. Details in `references/hosting-domain-deploy.md`.
- Rankings and shortlists go to a private Google Sheet through a Google Apps Script web app (`apps-script/`). The browser finds it via `SHEETS_URL` in `public/js/config.js`.
- Google Analytics 4 (`G-9ZTH2V44EX`) and Google AdSense Auto ads (`ca-pub-6178711736030963`) load on the live host only.
- Repo path in past sessions: `/home/user/real-estate-web`, branch `claude/jolly-meitner-llfg6y`. Node >= 20, Python 3 (plus `openpyxl` for one test).

## Golden rules
1. No em dashes (U+2014) anywhere on the site. No SVG on the site (no `<svg>`, no inline icons). The browser test fails on either.
2. No secrets in the repo. Public ids (Firebase appId, GA id, AdSense pub id, Apps Script `/exec` URL, Sheet id) are fine.
3. Production deploys need explicit human approval (CLAUDE.md). The owner has approved routine deploys of tested changes in past sessions; when in doubt, ask.
4. Never write test rows to the live Sheet. Ask before any destructive action on the Sheet (deleting rows, clearing tabs).
5. Never delete or rename `public/googled48848b9b3ea2809.html` (Search Console verification).
6. Never hand-edit generated pages (`public/index.html`, `rank.html`, `shortlist.html`, `privacy.html`, `archive/analytics.html`, `js/analytics-core.js`). Edit `pipeline/build_pages.py` and run it.
7. Never run `pipeline/make_sample_data.py` now: it overwrites the real unit data in `public/data/units/` with sample data.
8. Copy style: plain, short sentences, "you", no marketing tone. Keep the owner's exact words where noted (Buy Me a Coffee card, shortlist subtitle).
9. Footer stays one credit line plus the Privacy link. No blue link-style words inside analytics boxes.
10. Never edit the owner's Canva designs. No force-push. Stage files by name. Do not commit unless asked.

## Quick start
```
npm install                                   # no runtime deps; sets up the lockfile only
DEV_FAKE_SHEETS=1 PORT=3000 node dev.js       # site + in-memory fake Sheet at /fake-sheets (same as npm run dev:fake)
node dev.js                                   # site only; uses the real SHEETS_URL from config.js (avoid: it would post to the live Sheet)
npm test                                      # node --test test/*.test.js (scoring, Analytics.js, build_real_data.py); needs python3 + openpyxl
CHROMIUM=/opt/pw-browsers/chromium node test/e2e.browser.js   # full browser test; must end with ALL BROWSER CHECKS PASSED
python3 pipeline/build_pages.py               # regenerate pages after editing build_pages.py
```
- The browser test starts its own dev server on port 3123 with the fake Sheet and loads Playwright from the global `npm root -g`. The `CHROMIUM` path differs per machine; point it at any Chromium that Playwright can drive. Do not run `playwright install` in the cloud sandbox.
- Cloud sandboxes send HTTPS through a proxy (`HTTPS_PROXY`, CA bundle `/root/.ccr/ca-bundle.crt`). Never disable TLS checks. Google Fonts and jsDelivr may not load there; the tests do not need them.

## Deploy (after approval)
```
npm test && CHROMIUM=/opt/pw-browsers/chromium node test/e2e.browser.js
git add <files by name> && git commit
npx firebase-tools deploy --only hosting:site --project mybto-ce84f --non-interactive
curl -s -o /dev/null -w '%{http_code}\n' https://mybto.web.app/      # expect 200
curl -s https://mybto.web.app/js/config.js | head -3                   # spot-check a changed file
```
- Needs `npx firebase-tools login` with an account that has access to `mybto-ce84f`.
- Use the CLI. The Firebase MCP deploy tool once reported success without releasing anything.
- There is no auto-deploy from git. Never deploy functions, firestore or auth (the project has none).

## Task router
| If you need to... | Read |
|---|---|
| Find a file, page, route, config switch, localStorage key or header | `references/architecture.md` |
| Change the rank or shortlist UI, a factor, scoring, legend, or copy | `references/frontend-and-scoring.md` |
| Edit or re-publish unit data, or add a new BTO exercise | `references/data-pipeline.md` |
| Change the Sheet, Apps Script, limits, or clean the Sheet | `references/backend-apps-script.md` |
| Deploy, roll back, or work on mybto.sg / Vodien DNS | `references/hosting-domain-deploy.md` |
| Work on Search Console, robots, sitemap, llms.txt, GA4, AdSense, privacy page | `references/seo-analytics-ads.md` |
| Know which account owns what and what needs the owner's login | `references/accounts-and-access.md` |
| Know why something is the way it is | `references/decisions-and-history.md` |
| Follow a step-by-step recipe | `references/runbooks.md` |
| Understand or update the tests | `references/testing.md` |

## Open items (2026-10-15)
- Finish the mybto.sg switch: canonical, sitemap, robots, llms.txt, live-host checks in `ga.js` and `adsense.js`, redirect from mybto.web.app carrying localStorage. <!-- DOMAIN-SWITCH: update when mybto.sg is primary -->
- After the switch: add mybto.sg to Search Console (Domain property, DNS TXT at Vodien) and use Change of address; add mybto.sg as a site in AdSense.
- AdSense review requested 2026-10-14; ads show only after approval.
- Ideas: an About or FAQ page. Analytics page stays archived (`ANALYTICS_ENABLED: false`, `ANALYTICS_SOURCE: 'sample'`).
- Owner to clean up: the old Vercel project and the old Firebase project `sgrealestate-5fbd4` (anonymous auth). Do not touch them yourself.

## Before you finish any task
1. `npm test` passes; the browser test passes if you touched anything under `public/`, `dev.js` or `firebase.json`.
2. Generated pages and data are committed together with their sources.
3. This skill, its references, and `AGENTS.md` / `CLAUDE.md` are updated in the same commit.
4. `git diff --cached | grep -iE "private_key|service_account|password|secret"` shows nothing sensitive.
5. Nothing was pushed or deployed without the owner's approval. A new Apps Script version was not published by you (the owner does that).

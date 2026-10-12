# MyBTO (BTO unit ranker)

Static site in `public/` on Firebase Hosting (https://mybto.web.app, Spark plan, no functions, no sign-in). Rankings and shortlists go to a Google Sheet through a Google Apps Script web app (`apps-script/`); the address is `SHEETS_URL` in `public/js/config.js`.

Read `.claude/skills/mybto-ops/SKILL.md` before any change, and update it in the same commit as any website or backend change.

Basics: never hand-edit generated pages (edit `pipeline/build_pages.py`, then run it); no em dashes and no SVG on the site; no secrets in the repo; production deploys need explicit human approval; no force-push.

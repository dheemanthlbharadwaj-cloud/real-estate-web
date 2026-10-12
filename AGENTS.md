# MyBTO (BTO unit ranker)

Static site in `public/` on Vercel (https://mybto.vercel.app) with Firebase Auth and Firestore (project `sgrealestate-5fbd4`) and analytics and export functions in `api/`.

Read `.claude/skills/mybto-ops/SKILL.md` before any change, and update it in the same commit as any website or database change.

Basics: never hand-edit generated pages (edit `pipeline/build_pages.py`, then run it); no em dashes and no SVG on the site; never print or commit `FIREBASE_SERVICE_ACCOUNT`; production deploys and data deletion need explicit human approval; no force-push.

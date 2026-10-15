# Accounts and access

No passwords, tokens or card numbers are recorded here or anywhere in the repo. Ask the owner when a login is needed.

## Who owns what
| Service | Owner / account | Notes |
|---|---|---|
| Firebase project `mybto-ce84f` (Hosting, Analytics link) | The owner's new Google account | dheemanthlbharadwaj@gmail.com is also an Owner (the account agents have used for `npx firebase-tools login`) |
| Google Analytics 4 property (`G-9ZTH2V44EX`) | Linked to `mybto-ce84f` | sataneko169@gmail.com has the IAM role `roles/firebase.analyticsViewer` on the project (view-only, owner's request 2026-10-14) |
| Google Sheet "MyBTO user data" and its Apps Script | The owner's new Google account | Private. Only the owner can paste code and publish a new web app version |
| Google AdSense `ca-pub-6178711736030963` | The owner (account created through AdMob) | Settings and payments only in the owner's login |
| Google Search Console property `https://mybto.web.app/` (old; a Domain property `mybto.sg` is the owner to-do) | The owner | Verified by HTML file |
| Domain mybto.sg at Vodien | The owner | Registrar and DNS host. Auto renew on, expires 15 Oct 2028 |
| Buy Me a Coffee page https://buymeacoffee.com/mybto | The owner | |
| Canva designs (legend pictures) | The owner | Never edit them. The legend webp files came from the owner's Canva legend |
| GitHub repo `dheemanthlbharadwaj-cloud/real-estate-web` (branch `claude/jolly-meitner-llfg6y`) | The owner | Push only when asked; never force-push |

## Retired (do not use, do not delete)
- Old Vercel project (the site before Firebase). The owner will remove it.
- Old Firebase project `sgrealestate-5fbd4` (Firestore, Auth with anonymous sign-in). Nothing in the repo uses it. Never delete data in it; the owner will clean it up.
- An old `.env.local` from the Vercel days may exist on a machine. It is git-ignored and unused; never commit it or copy values from it.

## What needs the owner
- Logging in to Vodien (DNS, renewal), AdSense, Search Console, the Sheet, Buy Me a Coffee.
- Publishing a new Apps Script version (Deploy > Manage deployments > edit > New version).
- Deleting rows in the Sheet.
- Approving production deploys (agents may run the deploy command once approved).
- Adding people: Sheet via its Share button; Apps Script project via its own Share button; Firebase via IAM in the Google Cloud console; Analytics viewers via `roles/firebase.analyticsViewer`.

## What agents can do with a login the owner provides
- `npx firebase-tools login` with an account that has access to `mybto-ce84f`: deploy Hosting, read the Hosting API (custom domain status), read the web app config.
- Read the Sheet through a Google Sheets connector or API if one is attached and authorised by the owner. Writing to the live Sheet still needs the owner's explicit OK.

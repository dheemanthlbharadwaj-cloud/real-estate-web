# Hosting, domain and deploy

## Firebase
- Project `mybto-ce84f`, Spark (free) plan. Hosting site `mybto` (https://mybto.web.app). The project's default site `mybto-ce84f.web.app` is unused.
- `.firebaserc`: default project `mybto-ce84f`, hosting target `site` -> site `mybto`. `firebase.json` uses `"target": "site"`, `"public": "public"`, ignores `firebase.json`, dotfiles and `node_modules`.
- Registered web app "MyBTO web", appId `1:988755619847:web:f26d8cbb32088f29c6baa2`. It exists for Google Analytics; no Firebase JS runs on the site (removed 2026-10-13).
- No Cloud Functions, Firestore, Auth or Storage in this project. `.firebase/` (deploy cache) is git-ignored.

## Deploy
Needs explicit human approval (CLAUDE.md). The owner has approved routine deploys of tested changes before; when in doubt, ask.
```
npm test
CHROMIUM=/opt/pw-browsers/chromium node test/e2e.browser.js     # ALL BROWSER CHECKS PASSED
git status && git add <files by name> && git commit -m "..."
npx firebase-tools login                                          # once per machine, account with access to mybto-ce84f
npx firebase-tools deploy --only hosting:site --project mybto-ce84f --non-interactive
```
Verify after every deploy:
```
curl -s -o /dev/null -w '%{http_code}\n' https://mybto.web.app/            # 200
curl -sI https://mybto.web.app/rank.html | grep -i '^location'             # /rank (301)
curl -s https://mybto.web.app/googled48848b9b3ea2809.html                  # google-site-verification: ...
curl -sI https://mybto.web.app/ | grep -i content-security-policy          # headers are live
```
Run the same checks against https://mybto.sg/ (the primary address), and check that a page on https://mybto.web.app/ hands visitors over to mybto.sg. Static files such as `robots.txt`, `ads.txt` and the Search Console file load on mybto.web.app without redirect.

Notes:
- Use the CLI. On 2026-10-12 the Firebase MCP `firebase_deploy` tool reported success for `hosting:site` without releasing anything.
- HTML, JS and CSS are served `no-cache`, so a deploy reaches browsers at once. Before that, a 1 h default cache kept an old `config.js` in browsers.
- There is no CI and no auto-deploy from git. The branch is `claude/jolly-meitner-llfg6y`; never force-push it.
- If an automated agent is blocked from deploying, stop and give the owner the exact command.

## Rollback
- Console: Firebase console > Hosting > site `mybto` > Release history > pick an older release > Roll back.
- CLI: list releases with the Hosting API or the console, then copy an older version to live:
  `npx firebase-tools hosting:clone mybto@<VERSION_ID> mybto:live --project mybto-ce84f`
  (version ids look like `sites/mybto/versions/<id>`; use the `<id>` part).
- Or check out the last good commit and deploy it again (approval needed either way).

## firebase.json behaviour
See `architecture.md` for the full route table and headers. Key points: `cleanUrls: false` with explicit rewrites for `/rank`, `/shortlist`, `/privacy`, `/archive/analytics`, `/archive/home`; 301s from each `.html` path; 301s from `/analysis`, `/analytics`, `/account`, `/archive/account`, `/archive/dashboard` to `/`; strict CSP and security headers on everything; `/data/**` cached 1 h with `X-Robots-Tag: noindex`; `/img/**` cached 7 days immutable.

## Custom domain mybto.sg
Status: LIVE since 2026-10-15 (deployed about 16:40 UTC). mybto.sg is the primary address.

- Registrar: Vodien. Registered for 2 years, expires 15 Oct 2028, auto renew on. The owner logs in to Vodien; agents cannot.
- DNS is hosted at Vodien (nameservers ns1.vodien.com, ns2.vodien.com, ns3.vodien.com). Records added for Firebase:

| Type | Host | Value |
|---|---|---|
| A | mybto.sg | 199.36.158.100 |
| TXT | mybto.sg | hosting-site=mybto |
| CNAME | www.mybto.sg | mybto.web.app |

- Other Vodien default records (mail, ftp, cpanel, buynewlaunch and similar) were left untouched. Do not remove them without asking the owner.
- Firebase custom domains on site `mybto` (added through the Hosting API on 2026-10-15): `mybto.sg` (primary, serves the site) and `www.mybto.sg` (redirects to `mybto.sg`).
- Firebase state at the switch: `mybto.sg` HOST_ACTIVE and CERT_ACTIVE; `www.mybto.sg` redirect with its certificate still CERT_VALIDATING (activates on its own). TTL on the records is 14400. Firebase saw the old cached A record 103.9.103.5 (Vodien parking) for about 3 hours before validating.
- 2026-10-15 18:38 UTC: `www.mybto.sg` certificate issued (CERT_PROPAGATING then CERT_ACTIVE); https://www.mybto.sg/<path> 301-redirects to https://mybto.sg/<path>. Both domains are fully live.

### What the switch changed (done, live 2026-10-15)
- `SITE` in `pipeline/build_pages.py` is https://mybto.sg (canonical, Open Graph, Twitter, JSON-LD). `public/sitemap.xml`, the `robots.txt` Sitemap line and `llms.txt` use https://mybto.sg. Privacy text and chart and CSS watermarks say mybto.sg.
- `ga.js` and `adsense.js` run only when `location.hostname === 'mybto.sg'`.
- `public/js/host.js` (first script in the head of every generated page) sends visits on mybto.web.app, mybto.firebaseapp.com, mybto-ce84f.web.app and mybto-ce84f.firebaseapp.com to the same path and query on https://mybto.sg with `location.replace`, carrying `project`, `mybto:uid`, `mybto:flagcount`, `flags:*` and `mybto:last:*` in `#mybto-migrate=<encoded JSON>`. On mybto.sg it imports only keys not already present, ignores others, then strips the fragment. `mybto:lastrank:*` and `mybto:sent:*` are not carried.
- Firebase still serves the files on mybto.web.app; only pages redirect (static files have no host.js).
- `Code.gs` `SAMPLE_URL` still uses mybto.web.app (works; optional update with the next re-paste).
- Owner to-dos: Search Console Domain property + Change of address, AdSense site, optional GA4 stream URL (see `seo-analytics-ads.md` and `docs/GOOGLE_INDEXING.md`).

### Check domain status
Firebase console > Hosting > site `mybto` > Custom domains shows the state. From a shell, with firebase-tools logged in:
```
npx firebase-tools projects:list >/dev/null      # refreshes the stored access token
TOKEN=$(node -e "const c=require(require('os').homedir()+'/.config/configstore/firebase-tools.json');process.stdout.write(c.tokens.access_token)")
curl -s -H "Authorization: Bearer $TOKEN" \
  https://firebasehosting.googleapis.com/v1beta1/projects/mybto-ce84f/sites/mybto/customDomains/mybto.sg
```
Read `hostState`, `ownershipState`, `cert.state` and `requiredDnsUpdates` in the answer. Never print or commit the token. Also check DNS directly:
```
dig +short A mybto.sg @ns1.vodien.com      # 199.36.158.100
dig +short TXT mybto.sg @ns1.vodien.com    # "hosting-site=mybto"
dig +short CNAME www.mybto.sg              # mybto.web.app.
curl -sI https://mybto.sg/ | head -1        # HTTP/2 200
```

### Troubleshooting
- Firebase says records are missing: compare `requiredDnsUpdates` with the Vodien zone. Remove any extra A or AAAA record on `mybto.sg` that points elsewhere (ask the owner; it is their DNS).
- Old IP 103.9.103.5 still answers: cached at resolvers. Wait for the TTL; check against `@ns1.vodien.com` to see the true value.
- Certificate pending for hours: the TXT `hosting-site=mybto` and the A record must both resolve. Firebase retries on its own.
- `www.mybto.sg` must stay a CNAME to `mybto.web.app` with the Firebase redirect to `mybto.sg`.

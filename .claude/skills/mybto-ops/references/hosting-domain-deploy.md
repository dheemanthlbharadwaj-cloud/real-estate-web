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
<!-- DOMAIN-SWITCH: update when mybto.sg is primary --> (run the same checks against https://mybto.sg/ and check that https://mybto.web.app/ hands visitors over to mybto.sg)

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
Status: being connected on 2026-10-15; once live, mybto.sg is the primary address. <!-- DOMAIN-SWITCH: update when mybto.sg is primary -->

- Registrar: Vodien. Registered for 2 years, expires 15 Oct 2028, auto renew on. The owner logs in to Vodien; agents cannot.
- DNS is hosted at Vodien (nameservers ns1.vodien.com, ns2.vodien.com, ns3.vodien.com). Records added for Firebase:

| Type | Host | Value |
|---|---|---|
| A | mybto.sg | 199.36.158.100 |
| TXT | mybto.sg | hosting-site=mybto |
| CNAME | www.mybto.sg | mybto.web.app |

- Other Vodien default records (mail, ftp, cpanel, buynewlaunch and similar) were left untouched. Do not remove them without asking the owner.
- Firebase custom domains on site `mybto` (added through the Hosting API on 2026-10-15): `mybto.sg` (primary, serves the site) and `www.mybto.sg` (redirects to `mybto.sg`).
- At the time of writing Firebase was still validating: some resolvers still returned the old cached A record 103.9.103.5 (Vodien parking). Certificate issue follows once Firebase sees the new records; this can take from minutes to 24 h.

### What changes when mybto.sg becomes primary
<!-- DOMAIN-SWITCH: update when mybto.sg is primary -->
The switch was in progress (uncommitted) on 2026-10-15. Planned changes: canonical and Open Graph `SITE` in `pipeline/build_pages.py`, `public/sitemap.xml`, `robots.txt` sitemap line, `llms.txt`, privacy page text, live-host checks in `ga.js` and `adsense.js`, the Analytics watermark text, `Code.gs` `SAMPLE_URL`, and a new `public/js/host.js` that sends visitors on mybto.web.app (and the project's other default hosts) to the same page on mybto.sg, carrying the localStorage keys `project`, `mybto:uid`, `mybto:flagcount`, `flags:*` and `mybto:last:*` once in a `#mybto-migrate=` URL fragment (never sent to a server) and importing them only where that browser has nothing saved. Update this section and every DOMAIN-SWITCH marker in this skill once it is committed and live. Then: Search Console Domain property and Change of address, AdSense site for mybto.sg (see `seo-analytics-ads.md`).

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
curl -sI https://mybto.sg/ | head -1        # HTTP/2 200 once the certificate is live
```

### Troubleshooting
- Firebase says records are missing: compare `requiredDnsUpdates` with the Vodien zone. Remove any extra A or AAAA record on `mybto.sg` that points elsewhere (ask the owner; it is their DNS).
- Old IP 103.9.103.5 still answers: cached at resolvers. Wait for the TTL; check against `@ns1.vodien.com` to see the true value.
- Certificate pending for hours: the TXT `hosting-site=mybto` and the A record must both resolve. Firebase retries on its own.
- `www.mybto.sg` must stay a CNAME to `mybto.web.app` with the Firebase redirect to `mybto.sg`.

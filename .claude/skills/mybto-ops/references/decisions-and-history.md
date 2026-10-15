# Decisions and history

Dated log of the decisions that shape the project, from `git log` and the owner's instructions. Newest last. Add a line for every decision you make with the owner.

## 2026-10-08 to 2026-10-10: first versions
- 10-08: First ranker app (scoring, accounts, flags, analysis).
- 10-09: Sample data for all 7 projects. Moved to Vercel + Firebase (Auth, Firestore project `sgrealestate-5fbd4`). Renamed to MyBTO. Several redesigns; SVG and em dashes removed from the site.
- 10-10: One housing type at a time (2-Room Flexi covers Type 1 and 2); tied scores share a rank; highest, middlemost and lowest units; one meter per facility type; Middle floor priority, privacy filter and lift distance removed. Light theme with cyan accent, Poppins + Inter.

## 2026-10-11: copy and legend
- Legend pictures come from the owner's Canva legend (temporary import pages were added and removed). Agents never edit Canva designs.
- Site copy rewritten in plain style; near MRT means within 100 m; facilities near means within 30 m.
- The ranking page became the home page; the old home page moved to `/archive/home`.

## 2026-10-12: Firebase Hosting and the Sheet
- Survey and NUS research notice tried, then replaced by an ad pop-up (consent kept). Queue number removed. Header menu removed.
- Factors renamed: "10 m away from rubbish chute", "Within 100 m from MRT". Wind (facing SE to E, not blocked) and multi-storey car park factors added. Floor priority defaults to Higher.
- Moved to Firebase Hosting (static, project `mybto-ce84f`, site `mybto`) with a Google Sheet + Apps Script backend. Reason: free, no server, no secrets. First live deploy and Sheet connected on 10-12.
- Deploy with the CLI only: the Firebase MCP deploy tool reported success without releasing.
- JS, CSS and HTML served `no-cache` so a deploy (for example a new `SHEETS_URL`) reaches browsers at once.
- Analytics page redesigned as a BI-style dashboard with one watermark per chart. `ANALYTICS_SOURCE: 'sample'` until launch.
- The owner chose not to run `importSample()`: the Sample tab stays empty.
- `build_real_data.py` added: per-project analysis files, review workbook, publish only after owner approval.

## 2026-10-13: real data, archive, security
- Real per-unit analysis for all 7 projects from the brochures and the owner's board, each followed by an independent review and fixes.
- "Roof at 2nd storey only" is not roof access (same rule for every project). No unit has roof access, so the roof meter hides and the roof legend entry was removed.
- Block-wide rule (owner): facilities near, MRT distance and car park distance are per block; any touch of a 30 m circle on the block outline counts. Real data published for all 7 projects (6,952 units).
- Floor priority always starts at Higher, even for returning visitors (an old saved Lower surprised a user). Research notice text removed from the pop-up.
- Top 100 shown (full ranking still saved). Shortlist gains rank and "was" numbers, Share and Clear all.
- Ads (`ADS_ENABLED`) and the Analytics page (`ANALYTICS_ENABLED`) archived: code kept, switched off.
- Chute and MRT columns shown as ticks and crosses; By floor uses only the top 100.
- Buy Me a Coffee support card added.
- Pentest follow-up: Apps Script hardened (project allowlist, type checks, per-user throttle, hourly ceilings, at least 5 users for analytics); strict CSP and security headers; SRI on Chart.js; unused Firebase JS removed; robots.txt, sitemap, canonical and social tags.

## 2026-10-14: launch polish, Google services
- Legend sources are just the HDB brochure link plus "measured with its scale bar"; no placeholder or estimate wording.
- Hardened Apps Script deployed by the owner; `SHEETS_URL` points at it; old deployments archived.
- Search Console: verified by `public/googled48848b9b3ea2809.html`. `cleanUrls` replaced by explicit rewrites so the file is served without a redirect.
- Footer cut to the single HDB credit line (plus the Privacy link added later that day). New Buy Me a Coffee text in the owner's words.
- Intro paragraph under the rank page title removed.
- robots.txt opened to every search engine and AI bot (except `/archive/` and `/shortlist`); `/data/` crawlable but `noindex`; `llms.txt` added. Home page indexed.
- Google Analytics 4 added (live host only, signals and ad personalisation off). CSP widened for www.google.com collect. sataneko169@gmail.com given Analytics viewer access.
- Shortlist page title "Your Shortlist", subtitle "Drag to reorder your shortlisted units".
- Google AdSense Auto ads added (meta tag, `ads.txt`, live-only loader, CSP), privacy page `/privacy`. AdSense account upgraded for web and review requested. Recommended Auto ads settings given to the owner (see `seo-analytics-ads.md`).
- Sheet cleaned: 11 sample-era rows (12 and 13 Oct) and 33 exact duplicates removed from Rankings (448 left). Settings!B1 INCLUDE_SAMPLE is FALSE (date of that change not recorded).
- Client no longer sends a ranking identical to the last one sent for that project (`mybto:sent:<project>`). Before the fix about 7% of rows were repeats.

## 2026-10-15: domain and handover
- mybto.sg bought at Vodien (2 years, auto renew). DNS at Vodien: A 199.36.158.100, TXT `hosting-site=mybto`, CNAME `www` to `mybto.web.app`. Firebase custom domains `mybto.sg` (primary) and `www.mybto.sg` (redirect) added through the Hosting API; validation pending at writing time.
- Skill restructured into `SKILL.md` + `references/`, `AGENTS.md` rewritten, `.opencode/skills/mybto-ops` symlinked so opencode, Claude Code and Codex share one skill.
- Later that day (about 16:40 UTC): the custom domain switch went LIVE. https://mybto.sg is the primary address. Firebase Hosting custom domains on site `mybto`: `mybto.sg` (HOST_ACTIVE, CERT_ACTIVE) and `www.mybto.sg` (Firebase redirect to `mybto.sg`; its certificate was still CERT_VALIDATING and activates on its own). Firebase first saw the old cached A record 103.9.103.5 for about 3 hours before validating.
- Code changes in the switch: `SITE` in `pipeline/build_pages.py` is https://mybto.sg (canonical, Open Graph, Twitter, JSON-LD); `sitemap.xml`, the `robots.txt` Sitemap line and `llms.txt` use mybto.sg; privacy text, chart watermark text and CSS watermarks say mybto.sg; `ga.js` and `adsense.js` run only on `mybto.sg`; new `public/js/host.js` redirects the old hosts to mybto.sg and carries saved data (see `architecture.md`). Verified live in a browser: a shortlist saved on mybto.web.app appeared on mybto.sg/shortlist. The e2e test covers the migrate import and the sitemap address.
- `apps-script/Code.gs` `SAMPLE_URL` was left on mybto.web.app on purpose (still works).
- Owner to-dos after the switch: Search Console Domain property and Change of address, AdSense site, optional GA4 stream URL (see `seo-analytics-ads.md`).

## Standing owner preferences
- Plain, human copy (humanizer style), short sentences, no marketing tone. No em dashes. No SVG.
- No blue link-style words in analytics boxes. Footer: only the credit line and Privacy link.
- Keep the owner's exact words where given.
- Update the skill in the same commit as any site or backend change.
- Never edit Canva designs. Never publish secrets. Ask before destructive actions on the Sheet. Never delete the Search Console file.

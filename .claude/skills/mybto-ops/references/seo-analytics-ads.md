# SEO, analytics and ads

## Search Console
- Property: URL prefix `https://mybto.web.app/`, verified on 2026-10-14 with the HTML file `public/googled48848b9b3ea2809.html`. NEVER delete or rename that file, or verification is lost. It is served directly because `firebase.json` has `cleanUrls: false`.
- Sitemap `sitemap.xml` submitted; the home page was indexed on 2026-10-14.
- Owner-facing steps: `docs/GOOGLE_INDEXING.md` (still written for mybto.web.app).
- After the switch to mybto.sg: <!-- DOMAIN-SWITCH: update when mybto.sg is primary -->
  1. Add a **Domain** property `mybto.sg` in Search Console. Verify with the DNS TXT record Google gives (`google-site-verification=...`), added by the owner in the Vodien DNS zone next to the Firebase records. Do not remove `hosting-site=mybto`.
  2. Keep the old mybto.web.app property and its file.
  3. In the old property: Settings > Change of address > pick mybto.sg. This needs the old site to redirect to the new one.
  4. Submit `https://mybto.sg/sitemap.xml` in the new property and request indexing of `https://mybto.sg/`.
  5. Update `docs/GOOGLE_INDEXING.md`.

## Crawling files
- `public/robots.txt` (owner's call 2026-10-14): every crawler and AI search bot may crawl everything except `/archive/` and `/shortlist`. `/data/` must stay crawlable (the page needs it to render; Search Console showed "Couldn't load" when it was blocked). Sitemap line points at the live address. <!-- DOMAIN-SWITCH: update when mybto.sg is primary -->
- `/data/**` sends `X-Robots-Tag: noindex`, so the JSON never shows in results. The unit JSON must stay public for the ranker to work; the Sheet is private.
- `public/sitemap.xml` lists `/` and `/privacy` with `lastmod`. Add new public pages here.
- `public/llms.txt`: plain description of the site for AI search tools (projects, factors, 6,952 flats, data source, page links). Keep its facts in sync with the site.
- `/` and `/rank` carry the canonical link, description, Open Graph and Twitter tags (image `img/og-mybto.jpg`) and JSON-LD `WebApplication`, all built from `SITE` and `SEO` in `pipeline/build_pages.py`. `SITE` was `https://mybto.web.app` in the last commit. <!-- DOMAIN-SWITCH: update when mybto.sg is primary -->
- `/shortlist` and `/archive/analytics` have `<meta name="robots" content="noindex">`.
- Title of the rank page: "Unofficial HDB BTO Flat Unit Ranker · MyBTO".

## Google Analytics 4
- Measurement id `G-9ZTH2V44EX` (`GA_ID` in `public/js/config.js`), linked to the Firebase project `mybto-ce84f` and web app "MyBTO web". `npx firebase-tools apps:sdkconfig web 1:988755619847:web:f26d8cbb32088f29c6baa2 --project mybto-ce84f` shows it.
- Loader `public/js/ga.js`: runs gtag only on the live host, so dev and tests never send data. `allow_google_signals: false`, `allow_ad_personalization_signals: false`. `window.track(name, params)` is always safe to call. <!-- DOMAIN-SWITCH: update when mybto.sg is primary -->
- Events:

| Event | Params | Sent from |
|---|---|---|
| `rank_units` | `project`, `housing_type`, `units` | `app.js runRank` |
| `shortlist_add` / `shortlist_remove` | `project` | `app.js toggleFlag` |
| `share_shortlist` | `project`, `units` | `app.js` share button |
| `open_legend` | `factor` | `app.js openLegend` |
| `coffee_click` | none | `ga.js` click listener on buymeacoffee.com links |

- CSP allows www.googletagmanager.com, *.google-analytics.com, *.analytics.google.com and www.google.com (GA4 also posts to www.google.com/g/collect).
- Reports: analytics.google.com or Firebase console > Analytics. Realtime shows visits within a minute; standard reports take 24 to 48 h.
- The footer says visits are counted with Google Analytics; the privacy page explains it.
- New event: call `window.track('name', {...})` in `app.js`, list it here, and mention it in the privacy page if it collects something new.

## Google AdSense
- Publisher `ca-pub-6178711736030963`. The account was first created through AdMob and upgraded for web on 2026-10-14. Site verified via `ads.txt`; review requested 2026-10-14. Ads show only after approval.
- `ADSENSE_CLIENT` in `config.js`; loader `public/js/adsense.js` adds `adsbygoogle.js` only on the live host. Every generated page has `<meta name="google-adsense-account" content="ca-pub-6178711736030963">`. <!-- DOMAIN-SWITCH: update when mybto.sg is primary -->
- `public/ads.txt`: `google.com, pub-6178711736030963, DIRECT, f08c47fec0942fa0`.
- Auto ads: Google decides placement. Settings the owner was given (AdSense > Ads > By site): Auto ads on, Banner (in-page) on, Multiplex off, Anchor on, Side rail on, Vignette off, Ad intents off, Auto optimize off.
- CSP for ads: script, connect and frame-src allow *.googlesyndication.com, *.doubleclick.net, *.google.com, *.adtrafficquality.google, www.googletagservices.com (plus *.gstatic.com for scripts); img-src any https; style-src `'unsafe-inline'`; COOP `same-origin-allow-popups`. Blank ads usually mean a CSP violation: check the console and widen the list.
- Video ads: only through AdSense itself (Auto ads may serve some), Offerwall (rewarded), or Google Ad Manager. None of these is set up.
- The old placeholder ad pop-up and video gate (`public/js/ads.js`) stay off with `ADS_ENABLED: false`. Its `PROVIDERS` object is the plug-in point if a real interstitial network is ever wanted.
- After the switch: add mybto.sg in AdSense (Sites > Add site), keep `ads.txt` served at `https://mybto.sg/ads.txt`, and request review for it.
- If AdSense rejects the site: see `runbooks.md`.

## Privacy page
- `/privacy` is generated by `build_pages.py` (`privacy` page, `plain=True`: no `app.js`). Linked from the footer. Required by AdSense.
- It covers: no accounts; rankings, shortlist and settings with a random browser id in a private Google Sheet; local storage; Google Analytics with signals and ad personalisation off and the opt-out add-on; AdSense cookies with links to Google Ads Settings, aboutads.info and Google's partner-sites page; unit data from HDB brochures. "Last updated 14 October 2026".
- Keep it in sync whenever data collection, analytics or ads change, and update the date.

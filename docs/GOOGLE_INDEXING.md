# Getting mybto.sg into Google

Google only lets the site owner request indexing, so these steps need your Google account (about 5 minutes).
The site side is already done: `robots.txt` lets every crawler in except `/archive/` and `/shortlist` (`/data/` is crawlable but marked noindex),
`sitemap.xml` lists https://mybto.sg/, and the home page has a canonical link, a description and social preview tags.

The live address is https://mybto.sg (since 2026-10-15). The old address https://mybto.web.app redirects pages to it.
Sections A and B below are the steps for mybto.sg. The numbered sections after them are the history of the original
mybto.web.app property (verified 2026-10-14). Keep that property and its verification file.

## A. Add a Domain property for mybto.sg
1. In Search Console, Add property > **Domain** > `mybto.sg`.
2. Google shows a TXT record like `google-site-verification=...`. In Vodien DNS add a TXT record on `mybto.sg` with that value.
   Keep the existing records (`hosting-site=mybto`, the A record and the `www` CNAME).
3. Wait a few minutes (TTL is 14400, so it can take longer), then press **Verify**.
4. Sitemaps > enter `https://mybto.sg/sitemap.xml` > Submit. URL inspection > `https://mybto.sg/` > **Request indexing**.

## B. Change of address from the old property
1. Open the old property `https://mybto.web.app/` in Search Console.
2. Settings > **Change of address** > pick `mybto.sg` > follow the checks (the old site redirects to the new one) > Submit.
3. Do not remove the old property or the file `public/googled48848b9b3ea2809.html`. It stays served on mybto.web.app.

## 1. (History) Add the old mybto.web.app site to Search Console
1. Open https://search.google.com/search-console and sign in with the account that owns the Firebase project.
2. Add property > **URL prefix** > `https://mybto.web.app/` (a Domain property is not possible on web.app).
3. Choose **HTML file** verification and download the file (named like `google1234abcd.html`).

## 2. (History) Put the verification file on the site
1. Save the file in `public/` exactly as downloaded (do not rename or edit it).
2. Deploy: `npx firebase-tools deploy --only hosting:site --project mybto-ce84f`.
3. Check that https://mybto.web.app/google1234abcd.html opens, then press **Verify** in Search Console.
   Keep the file in `public/` for good, or Google drops the verification.

(Alternative: the **HTML tag** method. Paste the `<meta name="google-site-verification" ...>` line into the `<head>` in
`pipeline/build_pages.py` and `public/index.html`, then run `python3 pipeline/build_pages.py` and deploy.)

## 3. Submit the sitemap and request indexing
1. Search Console > **Sitemaps** > enter `sitemap.xml` > Submit (for mybto.sg use `https://mybto.sg/sitemap.xml`).
2. **URL inspection** > paste `https://mybto.sg/` > **Request indexing**.
3. Indexing usually takes a few days to two weeks. Check **Pages** in Search Console for progress.

## Optional
- Bing: https://www.bing.com/webmasters > Import from Google Search Console (one click after step 1).
- A link to the site from somewhere Google already crawls (a forum post, social profile) speeds up discovery.

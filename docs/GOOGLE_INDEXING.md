# Getting mybto.web.app into Google

Google only lets the site owner request indexing, so these steps need your Google account (about 5 minutes).
The site side is already done: `robots.txt` allows the pages and blocks `/data/`, `/archive/` and `/shortlist`,
`sitemap.xml` lists https://mybto.web.app/, and the home page has a canonical link, a description and social preview tags.

## 1. Add the site to Search Console
1. Open https://search.google.com/search-console and sign in with the account that owns the Firebase project.
2. Add property > **URL prefix** > `https://mybto.web.app/` (a Domain property is not possible on web.app).
3. Choose **HTML file** verification and download the file (named like `google1234abcd.html`).

## 2. Put the verification file on the site
1. Save the file in `public/` exactly as downloaded (do not rename or edit it).
2. Deploy: `npx firebase-tools deploy --only hosting:site --project mybto-ce84f`.
3. Check that https://mybto.web.app/google1234abcd.html opens, then press **Verify** in Search Console.
   Keep the file in `public/` for good, or Google drops the verification.

(Alternative: the **HTML tag** method. Paste the `<meta name="google-site-verification" ...>` line into the `<head>` in
`pipeline/build_pages.py` and `public/index.html`, then run `python3 pipeline/build_pages.py` and deploy.)

## 3. Submit the sitemap and request indexing
1. Search Console > **Sitemaps** > enter `sitemap.xml` > Submit.
2. **URL inspection** > paste `https://mybto.web.app/` > **Request indexing**.
3. Indexing usually takes a few days to two weeks. Check **Pages** in Search Console for progress.

## Optional
- Bing: https://www.bing.com/webmasters > Import from Google Search Console (one click after step 1).
- A link to the site from somewhere Google already crawls (a forum post, social profile) speeds up discovery.

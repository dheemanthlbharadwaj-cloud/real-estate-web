// Site settings. SHEETS_URL is the "web app" address of the Google Apps Script that stores rankings and
// answers the Analytics page (the URL ends in /exec; see apps-script/README.md). It is public by design.
// Empty means "not connected yet": rankings are not sent and Analytics says it will appear soon.
// ANALYTICS_SOURCE: 'sample' shows charts built from public/data/sample_submissions.json (made-up rankings) until launch;
// switch to 'sheet' to show real rankings from the Google Sheet. Rankings are saved to the Sheet either way.
// ADS_ENABLED: false archives all ads (no pop-up before ranking, no video gate before Analytics). Set true to switch them back on (js/ads.js).
// ANALYTICS_ENABLED: false hides the Analytics tab and button (the page itself lives at /archive/analytics; /analytics redirects to /). true brings them back.
window.MYBTO_CONFIG = { ADS_ENABLED: false, ANALYTICS_ENABLED: false, ANALYTICS_SOURCE: 'sample', SHEETS_URL: 'https://script.google.com/macros/s/AKfycbyhsuuDNnbhm_tlYIl-3o69peyRSHudmwVuyH-j1QKF7gxCnjMYl8LgbjyavONK94lPew/exec' };

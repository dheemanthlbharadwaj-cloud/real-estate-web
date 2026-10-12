// Site settings. SHEETS_URL is the "web app" address of the Google Apps Script that stores rankings and
// answers the Analytics page (the URL ends in /exec; see apps-script/README.md). It is public by design.
// Empty means "not connected yet": rankings are not sent and Analytics says it will appear soon.
// ANALYTICS_SOURCE: 'sample' shows charts built from public/data/sample_submissions.json (made-up rankings) until launch;
// switch to 'sheet' to show real rankings from the Google Sheet. Rankings are saved to the Sheet either way.
window.MYBTO_CONFIG = { ANALYTICS_SOURCE: 'sample', SHEETS_URL: 'https://script.google.com/macros/s/AKfycbw_SbvkBX-6FoP8J1GPfQEuSR-5rwOmLr1gKs_Ur1c3Ws0Fuok_LcsswOZebJykW3sOag/exec' };

// Stand-in for the Firebase app module from gstatic (browser tests only, no network).
export function initializeApp(config) { window.__firebaseApp = config; return { options: config }; }

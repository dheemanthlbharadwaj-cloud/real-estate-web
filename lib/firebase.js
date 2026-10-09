// firebase-admin singleton for Vercel functions.
// FIREBASE_SERVICE_ACCOUNT = the full service-account JSON (Project settings → Service accounts → Generate key).
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

function app() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT is not set');
  return initializeApp({ credential: cert(JSON.parse(raw)) });
}

module.exports = { auth: () => getAuth(app()), db: () => getFirestore(app()) };

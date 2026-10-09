// Verifies a Firebase ID token with Google's published signing certificates, without needing a
// service account. Checks signature (RS256), issuer, audience (project id), expiry and subject.
// https://firebase.google.com/docs/auth/admin/verify-id-tokens#verify_id_tokens_using_a_third-party_jwt_library
const crypto = require('node:crypto');

const CERTS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
let certs = { at: 0, ttl: 0, keys: null };

async function getCerts() {
  if (certs.keys && Date.now() - certs.at < certs.ttl) return certs.keys;
  const r = await fetch(CERTS_URL);
  if (!r.ok) throw new Error('could not fetch signing certificates');
  const maxAge = Number(/max-age=(\d+)/.exec(r.headers.get('cache-control') || '')?.[1] || 3600);
  certs = { at: Date.now(), ttl: maxAge * 1000, keys: await r.json() };
  return certs.keys;
}

const b64json = s => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

async function verifyIdToken(token, projectId, now = Math.floor(Date.now() / 1000)) {
  const parts = String(token).split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const [h, p, sig] = parts;
  const header = b64json(h), payload = b64json(p);
  if (header.alg !== 'RS256') throw new Error('bad alg');
  const cert = (await getCerts())[header.kid];
  if (!cert) throw new Error('unknown key id');
  const ok = crypto.createVerify('RSA-SHA256').update(`${h}.${p}`).verify(cert, Buffer.from(sig, 'base64url'));
  if (!ok) throw new Error('bad signature');
  if (payload.aud !== projectId) throw new Error('bad audience');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('bad issuer');
  if (!(payload.exp > now) || !(payload.iat <= now + 300) || !(payload.auth_time <= now + 300)) throw new Error('expired');
  if (!payload.sub) throw new Error('no subject');
  return { ...payload, uid: payload.sub };
}

module.exports = { verifyIdToken };

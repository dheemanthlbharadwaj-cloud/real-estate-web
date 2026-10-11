// In-memory/localStorage fake of the Firebase Auth SDK surface used by store.js (browser tests only).
const KEY = 'fake-auth';
const users = () => JSON.parse(localStorage.getItem('fake-users') || '{}');
const saveUsers = u => localStorage.setItem('fake-users', JSON.stringify(u));
const listeners = [];
const auth = { currentUser: null };
function wrap(rec) {
  if (!rec) return null;
  return { uid: rec.uid, email: rec.email, isAnonymous: !!rec.anonymous, getIdToken: async () => 'fake-token' };
}
function setUser(rec) {
  auth.currentUser = wrap(rec);
  if (rec) localStorage.setItem(KEY, rec.email); else localStorage.removeItem(KEY);
  listeners.forEach(cb => cb(auth.currentUser));
}
const err = code => Object.assign(new Error(code), { code });
export const getAuth = () => auth;
export function onAuthStateChanged(a, cb) {
  listeners.push(cb);
  const email = localStorage.getItem(KEY);
  auth.currentUser = email ? wrap(users()[email]) : null;
  setTimeout(() => cb(auth.currentUser), 0);
}
export async function createUserWithEmailAndPassword(a, email, password) {
  const u = users();
  if (u[email]) throw err('auth/email-already-in-use');
  u[email] = { uid: `uid${Object.keys(u).length + 1}`, email, password };
  saveUsers(u); setUser(u[email]);
  return { user: auth.currentUser };
}
export async function signInWithEmailAndPassword(a, email, password) {
  const r = users()[email];
  if (!r || r.password !== password) throw err('auth/invalid-credential');
  setUser(r);
  return { user: auth.currentUser };
}
export async function signOut() { setUser(null); }
export async function sendPasswordResetEmail() {}
export async function signInAnonymously() {
  const u = users();
  const key = `anon${Object.keys(u).length + 1}`;
  u[key] = { uid: key, email: key, anonymous: true };
  saveUsers(u); setUser(u[key]);
  return { user: auth.currentUser };
}
export class GoogleAuthProvider {}
// Fake Google popup: signs in as a Google account.
export async function signInWithPopup() {
  const u = users();
  const email = 'google.user@gmail.com';
  u[email] = u[email] || { uid: `g${Object.keys(u).length + 1}`, email, password: null };
  saveUsers(u); setUser(u[email]);
  return { user: auth.currentUser };
}

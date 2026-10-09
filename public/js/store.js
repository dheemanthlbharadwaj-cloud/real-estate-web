// Firebase Auth (email + password, email verification) and Firestore persistence.
// Docs: submissions/<uid>_<project>, flags/<uid>_<project>  (see firestore.rules)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  sendEmailVerification, sendPasswordResetEmail, reload,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let auth = null, db = null, ready = null;

const FRIENDLY = {
  'auth/email-already-in-use': 'That email is already registered — sign in instead.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'Wrong email or password.',
  'auth/too-many-requests': 'Too many attempts — try again in a few minutes.',
  'auth/network-request-failed': 'Network error — check your connection.',
};
const friendly = e => new Error(FRIENDLY[e.code] || e.message);
const toUser = u => (u ? { uid: u.uid, email: u.email, verified: u.emailVerified } : null);
const continueUrl = () => `${location.origin}/#account?verified=1`;

// Resolves with the first auth state; `onChange` is called on every later change.
export function init(onChange) {
  ready = (async () => {
    const r = await fetch('/api/config');
    if (!r.ok) throw new Error('Sign-in is not configured yet (Firebase settings missing on the server).');
    const app = initializeApp(await r.json());
    auth = getAuth(app);
    db = getFirestore(app);
    return new Promise(resolve => {
      let first = true;
      onAuthStateChanged(auth, u => {
        if (first) { first = false; resolve(toUser(u)); } else onChange(toUser(u));
      });
    });
  })();
  return ready;
}

export async function register(email, password) {
  try {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(user, { url: continueUrl() });
    return toUser(user);
  } catch (e) { throw friendly(e); }
}
export async function login(email, password) {
  try { return toUser((await signInWithEmailAndPassword(auth, email, password)).user); } catch (e) { throw friendly(e); }
}
export const logout = () => signOut(auth);
export async function resendVerification() {
  try { await sendEmailVerification(auth.currentUser, { url: continueUrl() }); } catch (e) { throw friendly(e); }
}
export async function resetPassword(email) {
  try { await sendPasswordResetEmail(auth, email); } catch (e) { throw friendly(e); }
}
// Re-reads the user from Firebase so a just-clicked verification link is picked up.
export async function refreshUser() {
  if (!auth?.currentUser) return null;
  await reload(auth.currentUser);
  await auth.currentUser.getIdToken(true);
  return toUser(auth.currentUser);
}
export const idToken = () => auth.currentUser?.getIdToken();

const key = project => `${auth.currentUser.uid}_${project}`;
export async function loadList(project) {
  const s = await getDoc(doc(db, 'submissions', key(project)));
  return s.exists() ? s.data() : null;
}
export async function saveList(project, data) {
  await setDoc(doc(db, 'submissions', key(project)), { ...data, uid: auth.currentUser.uid, project, updated_at: serverTimestamp() });
}
export async function loadFlags(project) {
  const s = await getDoc(doc(db, 'flags', key(project)));
  return s.exists() ? s.data().unit_ids || [] : [];
}
export async function saveFlags(project, unitIds) {
  await setDoc(doc(db, 'flags', key(project)), { uid: auth.currentUser.uid, project, unit_ids: unitIds.slice(0, 500) });
}

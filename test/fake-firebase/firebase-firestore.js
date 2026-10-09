// localStorage fake of the Firestore calls used by store.js (browser tests only).
export const getFirestore = () => ({});
export const doc = (db, col, id) => ({ path: `${col}/${id}` });
export const serverTimestamp = () => null;
export async function getDoc(ref) {
  const v = localStorage.getItem(`fs:${ref.path}`);
  return { exists: () => v != null, data: () => JSON.parse(v) };
}
export async function setDoc(ref, data) { localStorage.setItem(`fs:${ref.path}`, JSON.stringify(data)); }

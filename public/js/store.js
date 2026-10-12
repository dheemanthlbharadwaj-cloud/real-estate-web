// Talks to the Google Sheet through the Apps Script web app (window.MYBTO_CONFIG.SHEETS_URL, see js/config.js).
// Nothing here ever throws or shows an error to the visitor: when the sheet is not connected or a send fails,
// the site simply keeps working from the browser.
const url = () => (window.MYBTO_CONFIG && window.MYBTO_CONFIG.SHEETS_URL) || '';
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } };

export const connected = () => !!url();

// Anonymous random id for this browser, kept in localStorage `mybto:uid`. Starts with a letter.
export function userId() {
  let id = lsGet('mybto:uid');
  if (!/^[A-Za-z][A-Za-z0-9_-]{7,63}$/.test(id || '')) {
    const bytes = crypto.getRandomValues(new Uint8Array(12));
    id = `u${[...bytes].map(b => b.toString(16).padStart(2, '0')).join('')}`;
    lsSet('mybto:uid', id);
  }
  return id;
}

// text/plain keeps this a "simple" request, so the browser sends no CORS preflight (Apps Script cannot answer one).
function post(payload) {
  if (!url()) return Promise.resolve(false);
  return fetch(url(), { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) })
    .then(() => true, err => { console.warn('not sent to the sheet:', err.message); return false; });
}

export const saveRanking = data => post({ type: 'ranking', user: userId(), ...data });

let timer = null, pending = null;
function flushShortlist() {
  clearTimeout(timer);
  timer = null;
  if (pending) { const p = pending; pending = null; post({ type: 'shortlist', user: userId(), project: p.project, unit_ids: p.ids }); }
}
// Debounced: a burst of stars or reorders becomes one send, about 2 seconds after the last change.
export function saveShortlist(project, ids) {
  if (!url()) return;
  pending = { project, ids: [...ids] };
  clearTimeout(timer);
  timer = setTimeout(flushShortlist, 2000);
}
window.addEventListener('pagehide', flushShortlist);

// Resolves with the Analytics JSON, or null when the sheet is not connected or cannot be reached.
export async function getAnalytics(project) {
  if (!url()) return null;
  try {
    const r = await fetch(`${url()}${url().includes('?') ? '&' : '?'}action=analytics&project=${encodeURIComponent(project)}`);
    const data = await r.json();
    return data && data.ok ? data : null;
  } catch (err) {
    console.warn('analytics not available:', err.message);
    return null;
  }
}

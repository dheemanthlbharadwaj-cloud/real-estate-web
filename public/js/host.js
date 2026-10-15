// One public address: mybto.sg. Firebase also serves the site at mybto.web.app (and the project's default
// *.web.app / *.firebaseapp.com hosts); visits there move to the same page on mybto.sg. Saved shortlists and settings live
// in localStorage, which belongs to one address, so they travel along once in the URL fragment (never sent to a server)
// and are imported on mybto.sg only where that browser has nothing saved yet.
(function () {
  const PRIMARY = 'mybto.sg';
  const OLD = ['mybto.web.app', 'mybto.firebaseapp.com', 'mybto-ce84f.web.app', 'mybto-ce84f.firebaseapp.com'];
  const TAG = 'mybto-migrate=';
  const keep = k => k === 'project' || k === 'mybto:uid' || k === 'mybto:flagcount' || k.startsWith('flags:') || k.startsWith('mybto:last:');
  const host = location.hostname;
  if (OLD.includes(host)) {
    let frag = '';
    try {
      const data = {};
      for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (keep(k)) data[k] = localStorage.getItem(k); }
      if (Object.keys(data).length) frag = `#${TAG}${encodeURIComponent(JSON.stringify(data))}`;
    } catch { /* storage unavailable: move without data */ }
    location.replace(`https://${PRIMARY}${location.pathname}${location.search}${frag}`);
    return;
  }
  if (!location.hash.startsWith(`#${TAG}`)) return;
  try {
    const data = JSON.parse(decodeURIComponent(location.hash.slice(TAG.length + 1)));
    for (const [k, v] of Object.entries(data)) {
      if (keep(k) && typeof v === 'string' && localStorage.getItem(k) === null) localStorage.setItem(k, v);
    }
  } catch { /* ignore a damaged fragment */ }
  history.replaceState(null, '', location.pathname + location.search);
})();

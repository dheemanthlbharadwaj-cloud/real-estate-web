// Home page: project grid + live unit count from the published data.
(async function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BLURB = {
    'berlayar-rise-7': 'Car-lite towers beside Telok Blangah MRT, across the road from Keppel Bay.',
    'lakeview-cascadia-2': 'Garden terraces and a play garden at the heart of Bishan.',
    'kebun-baru_breeze-5': 'Twin towers wrapped around a rooftop garden above the car park.',
    'kebun-baru_ridge-1': 'Courtyard living around a central garden playground.',
    'sembawang-brook-6': 'Four blocks framing a landscaped fitness garden in the north.',
    'sembawang-portico-4': 'Garden courts and family playgrounds in Sembawang.',
    'woodgrove-acres-3': 'Blocks set around a wooded central garden in Woodlands.',
  };
  const ORDER = ['berlayar-rise-7', 'lakeview-cascadia-2', 'kebun-baru_breeze-5', 'kebun-baru_ridge-1', 'sembawang-brook-6', 'sembawang-portico-4', 'woodgrove-acres-3'];
  let index;
  try { index = await (await fetch('/data/units/index.json')).json(); } catch { return; }
  const byKey = Object.fromEntries(index.projects.map(p => [p.key, p]));
  const total = index.projects.reduce((s, p) => s + p.units, 0);
  const statEl = document.querySelector('[data-stat="units"]');
  if (statEl) statEl.textContent = total.toLocaleString();

  const grid = document.getElementById('project-grid');
  const types = p => p.flat_types.map(t => t.replace(/ \(Type \d\)/, '')).filter((t, j, a) => a.indexOf(t) === j);
  grid.innerHTML = ORDER.filter(k => byKey[k]).map((k, i) => {
    const p = byKey[k];
    const wide = i < 2 || i > 4 ? ' wide' : ''; // 2, 3, 2 layout
    return `<a class="pcard${wide} reveal${i % 3 ? ` d${i % 3}` : ''}" href="/rank?project=${encodeURIComponent(k)}" data-type="${esc(p.project_type)}">
      <div class="ph"><img src="/img/${esc(k)}.webp" alt="${esc(p.name)} (artist's impression)" loading="lazy"><span class="badge-type ${esc(p.project_type)}">${esc(p.project_type)}</span></div>
      <div class="body"><h3>${esc(p.name)}</h3><span class="go" aria-hidden="true">→</span><span class="town">${esc(p.town)}</span>
        <p class="blurb">${esc(BLURB[k] || '')}</p>
        <div class="facts"><span><b>${p.units.toLocaleString()}</b>units</span><span><b>${p.blocks.length}</b>blocks</span><span>${types(p).map(esc).join(', ')}</span></div></div></a>`;
  }).join('');
  window.revealAll && window.revealAll(grid);

  document.querySelectorAll('.filters-tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.filters-tabs button').forEach(x => x.classList.toggle('on', x === b));
    grid.querySelectorAll('.pcard').forEach(c => { c.hidden = b.dataset.type !== 'all' && c.dataset.type !== b.dataset.type; c.classList.add('in'); });
  }));
})();

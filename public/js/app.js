/* global Scoring, Chart */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FACTOR_HELP = {
  lift: 'Walking distance from your door to the lift lobby. Positive = you prefer further from the lift.',
  clearance: 'No other block within 30 m of the unit (more privacy / openness).',
  corner: 'Unit at the end of a row (windows on two sides) vs a corridor unit.',
  roof: 'Unit looks onto / adjoins a podium or 2nd-storey roof.',
  chute: 'Distance from your door to the refuse chute. Positive = you prefer further from the chute.',
  mrt: 'Block within 400 m of an MRT station.',
  facilities: 'Facilities in your own block (has) or right beside it (near), e.g. playground, fitness station, green roof.',
};

const state = {
  index: null, project: null, units: [], ranked: [], shown: 0,
  user: null, flags: [], charts: {},
};

async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

// ---------- routing ----------
function route() {
  const name = (location.hash.replace('#', '').split('?')[0]) || 'rank';
  $$('.view').forEach(v => { v.hidden = v.id !== `view-${name}`; });
  $$('nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${name}`));
  if (name === 'flagged') renderFlags();
  if (name === 'analysis') loadAnalysis();
  if (name === 'legend') renderLegend();
  if (name === 'account') renderAccount();
}
window.addEventListener('hashchange', route);

// ---------- projects & controls ----------
async function init() {
  state.index = await api('/api/projects');
  state.user = (await api('/api/me')).user;
  const opts = ['Plus', 'Prime', 'Standard'].map(t => `<optgroup label="${t}">${state.index.projects.filter(p => p.project_type === t)
    .map(p => `<option value="${p.key}">${esc(p.name)} (${esc(p.town)})</option>`).join('')}</optgroup>`).join('');
  $('#project').innerHTML = opts;
  $('#l-project').innerHTML = opts;
  $('#project').value = lsGet('project', state.index.projects[0].key);
  if (!$('#project').value) $('#project').value = state.index.projects[0].key;
  $('#project').addEventListener('change', () => loadProject($('#project').value));
  $('#l-project').addEventListener('change', renderLegend);
  $('#btn-rank').addEventListener('click', runRank);
  $('#btn-more').addEventListener('click', () => renderResults(false));
  $('#btn-save').addEventListener('click', saveList);
  $('#btn-csv').addEventListener('click', downloadCsv);
  $$('[data-blocks]').forEach(b => b.addEventListener('click', () => {
    $$('#f-blocks input').forEach(i => { i.checked = b.dataset.blocks === 'all'; });
    renderWeights();
  }));
  await loadProject($('#project').value);
  route();
}

async function loadProject(key) {
  state.project = state.index.projects.find(p => p.key === key);
  lsSet('project', key);
  state.units = await api(`/api/units/${key}`);
  const p = state.project;
  $('#project-meta').textContent = `${p.project_type} · ${p.units} units · blocks ${p.blocks.join(', ')}`;
  const types = [...new Set(state.units.map(u => u.flat_type))].sort();
  $('#f-types').innerHTML = types.map(t => `<label><input type="checkbox" value="${esc(t)}" checked> ${esc(t)}</label>`).join('');
  $('#f-blocks').innerHTML = p.blocks.map(b => `<label><input type="checkbox" value="${esc(b)}" checked> ${esc(b)}</label>`).join('');
  $('#f-blocks').onchange = renderWeights;
  const storeys = state.units.map(u => u.storey);
  const lo = Math.min(...storeys), hi = Math.max(...storeys);
  const opt = Array.from({ length: hi - lo + 1 }, (_, i) => `<option>${lo + i}</option>`).join('');
  $('#f-min').innerHTML = opt; $('#f-max').innerHTML = opt;
  $('#f-min').value = lo; $('#f-max').value = hi;
  state.flags = await loadFlags();
  updateFlagCount();
  renderWeights();
  // Restore a saved list for this project.
  if (state.user) {
    const { list } = await api(`/api/lists/${key}`).catch(() => ({ list: null }));
    if (list) applySaved(list);
  }
  runRank();
}

function slider(group, key, label, help, value = 0) {
  return `<div class="w"><label title="${esc(help || '')}"><span>${esc(label)}</span>
    <input type="range" min="-5" max="5" step="1" value="${value}" data-group="${group}" data-key="${esc(key)}">
    <output>${value}</output></label></div>`;
}

function renderWeights() {
  const prev = readWeights();
  const blocks = selectedBlocks();
  const hasDesign = state.units.some(u => u.unit_design);
  let h = `<h3>Blocks</h3>${blocks.length ? blocks.map(b => slider('block', b, `Block ${b}`, '', prev.block?.[b] ?? 0)).join('') : '<p class="muted small">Select at least one block above.</p>'}`;
  h += `<h3>Sun direction (unit facing)</h3>${Scoring.SUN_DIRECTIONS.map(d => slider('sun', d, d, 'Direction the living room windows face', prev.sun?.[d] ?? 0)).join('')}`;
  if (hasDesign) h += `<h3>Unit design (2-Room Flexi)</h3>${Scoring.UNIT_DESIGNS.map(d => slider('design', d, d, '2-Room Flexi layout type', prev.design?.[d] ?? 0)).join('')}`;
  h += `<h3>Other factors</h3>${Object.entries(Scoring.FACTORS).map(([k, [label]]) => slider('factor', k, label, FACTOR_HELP[k], prev[k] ?? 0)).join('')}`;
  $('#weights').innerHTML = h;
  $$('#weights input[type=range]').forEach(r => r.addEventListener('input', () => { r.nextElementSibling.value = r.value; }));
}

function selectedBlocks() { return $$('#f-blocks input:checked').map(i => i.value); }

function readWeights() {
  const w = { block: {}, sun: {}, design: {} };
  $$('#weights input[type=range]').forEach(r => {
    const v = Number(r.value);
    if (r.dataset.group === 'factor') w[r.dataset.key] = v; else w[r.dataset.group][r.dataset.key] = v;
  });
  return w;
}

function readFilters() {
  let min = Number($('#f-min').value), max = Number($('#f-max').value);
  if (min > max) [min, max] = [max, min];
  return { flatTypes: $$('#f-types input:checked').map(i => i.value), blocks: selectedBlocks(), minStorey: min, maxStorey: max };
}
const readPref = () => $('#f-pref input:checked').value;

function applySaved(list) {
  $$('#f-types input').forEach(i => { i.checked = !list.flat_types.length || list.flat_types.includes(i.value); });
  $$('#f-blocks input').forEach(i => { i.checked = !list.blocks.length || list.blocks.includes(i.value); });
  if (list.min_storey != null) $('#f-min').value = list.min_storey;
  if (list.max_storey != null) $('#f-max').value = list.max_storey;
  $$('#f-pref input').forEach(i => { i.checked = i.value === list.floor_pref; });
  $('#queue').value = list.queue_number || '';
  renderWeights();
  $$('#weights input[type=range]').forEach(r => {
    const g = r.dataset.group, k = r.dataset.key;
    const v = g === 'factor' ? list.weights[k] : list.weights[g]?.[k];
    if (typeof v === 'number') { r.value = v; r.nextElementSibling.value = v; }
  });
  $('#save-msg').textContent = `Loaded your saved list (${list.updated_at} UTC).`;
}

// ---------- ranking ----------
function runRank() {
  state.ranked = Scoring.rank(state.units, readFilters(), readWeights(), readPref());
  state.shown = 0;
  $('#result-count').textContent = `${state.ranked.length} units match`;
  renderResults(true);
}

const COLS = [
  ['rank', '#'], ['flag', '★'], ['score', 'Score'], ['block', 'Block'], ['storey', 'Storey'], ['unit', 'Unit'], ['flat_type', 'Type'],
  ['facing', 'Facing'], ['position', 'Position'], ['lift_m', 'Lift (m)'], ['chute_m', 'Chute (m)'], ['gt30m', '>30 m'], ['roof_access', 'Roof'],
  ['mrt_m', 'MRT (m)'], ['facilities', 'Facilities'],
];
function cell(u, k) {
  if (k === 'flag') return `<button class="star ${state.flags.includes(u.id) ? 'on' : ''}" data-id="${esc(u.id)}" title="Flag / unflag">★</button>`;
  if (k === 'gt30m' || k === 'roof_access') return u[k] ? 'Yes' : 'No';
  if (k === 'flat_type') return esc(u.flat_type.replace('2-Room Flexi', '2RF'));
  if (k === 'facilities') return `<span title="${esc([...u.facilities_has.map(f => `has: ${f}`), ...u.facilities_near.map(f => `near: ${f}`)].join('\n'))}">${u.fac_has_count} has / ${u.fac_near_count} near</span>`;
  if (typeof u[k] === 'number' && k.endsWith('_m')) return Math.round(u[k]);
  return esc(u[k] ?? '–');
}
function renderResults(reset) {
  if (reset) {
    $('#results thead').innerHTML = `<tr>${COLS.map(([, l]) => `<th>${l}</th>`).join('')}</tr>`;
    $('#results tbody').innerHTML = '';
  }
  const next = state.ranked.slice(state.shown, state.shown + 100);
  $('#results tbody').insertAdjacentHTML('beforeend', next.map(u => `<tr>${COLS.map(([k]) => `<td>${cell(u, k)}</td>`).join('')}</tr>`).join(''));
  state.shown += next.length;
  $('#btn-more').hidden = state.shown >= state.ranked.length;
}
$('#results').addEventListener('click', e => {
  const b = e.target.closest('.star');
  if (!b) return;
  toggleFlag(b.dataset.id);
  b.classList.toggle('on', state.flags.includes(b.dataset.id));
});

async function saveList() {
  if (!state.user) { $('#save-msg').textContent = 'Log in (Account tab) to save your list.'; return; }
  const f = readFilters();
  await api(`/api/lists/${state.project.key}`, { method: 'PUT', body: {
    queue_number: $('#queue').value.trim(), flat_types: f.flatTypes, blocks: f.blocks, min_storey: f.minStorey, max_storey: f.maxStorey,
    floor_pref: readPref(), weights: readWeights(), ranked_ids: state.ranked.map(u => u.id),
  } });
  $('#save-msg').textContent = 'Saved.';
}

function downloadCsv() {
  const keys = COLS.map(([k]) => k).filter(k => k !== 'flag');
  const rows = [keys.concat('id').join(',')].concat(state.ranked.map(u => keys.concat('id').map(k => {
    const v = k === 'facilities' ? `${u.fac_has_count} has / ${u.fac_near_count} near` : u[k];
    return `"${String(v ?? '').replace(/"/g, '""')}"`;
  }).join(',')));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
  a.download = `${state.project.key}-ranked.csv`;
  a.click();
}

// ---------- flags ----------
async function loadFlags() {
  if (state.user) return (await api(`/api/flags/${state.project.key}`)).unit_ids;
  return lsGet(`flags:${state.project.key}`, []);
}
async function persistFlags() {
  lsSet(`flags:${state.project.key}`, state.flags);
  if (state.user) await api(`/api/flags/${state.project.key}`, { method: 'PUT', body: { unit_ids: state.flags } });
  updateFlagCount();
}
function toggleFlag(id) {
  state.flags = state.flags.includes(id) ? state.flags.filter(x => x !== id) : [...state.flags, id];
  persistFlags();
}
function updateFlagCount() { $('#flag-count').textContent = state.flags.length; }

function renderFlags() {
  $('#flag-project').textContent = state.project?.name || '';
  const byId = Object.fromEntries(state.units.map(u => [u.id, u]));
  const scored = Object.fromEntries(state.ranked.map(u => [u.id, u]));
  const list = $('#flag-list');
  if (!state.flags.length) { list.innerHTML = '<p class="muted">No flagged units yet — click ★ in the ranked list.</p>'; return; }
  list.innerHTML = state.flags.map((id, i) => {
    const u = byId[id];
    if (!u) return '';
    const s = scored[id];
    return `<li draggable="true" data-i="${i}"><span class="grip">⋮⋮</span>
      <b>${esc(u.block)} #${String(u.storey).padStart(2, '0')}-${esc(u.unit)}</b> ${esc(u.flat_type)} · ${esc(u.facing)} · ${esc(u.position)}
      ${s ? `<span class="muted">· rank ${s.rank}, score ${s.score}</span>` : ''}
      <span class="spacer"></span>
      <button data-act="up" ${i === 0 ? 'disabled' : ''}>↑</button><button data-act="down" ${i === state.flags.length - 1 ? 'disabled' : ''}>↓</button><button data-act="rm">✕</button></li>`;
  }).join('');
}
$('#flag-list').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const i = Number(b.closest('li').dataset.i);
  const f = [...state.flags];
  if (b.dataset.act === 'up') [f[i - 1], f[i]] = [f[i], f[i - 1]];
  if (b.dataset.act === 'down') [f[i + 1], f[i]] = [f[i], f[i + 1]];
  if (b.dataset.act === 'rm') f.splice(i, 1);
  state.flags = f; persistFlags(); renderFlags();
});
let dragFrom = null;
$('#flag-list').addEventListener('dragstart', e => { dragFrom = Number(e.target.closest('li')?.dataset.i); });
$('#flag-list').addEventListener('dragover', e => e.preventDefault());
$('#flag-list').addEventListener('drop', e => {
  e.preventDefault();
  const to = Number(e.target.closest('li')?.dataset.i);
  if (dragFrom == null || Number.isNaN(to) || to === dragFrom) return;
  const f = [...state.flags];
  const [m] = f.splice(dragFrom, 1);
  f.splice(to, 0, m);
  state.flags = f; dragFrom = null; persistFlags(); renderFlags();
});

// ---------- analysis ----------
function chart(id, type, labels, datasets, extra = {}) {
  state.charts[id]?.destroy();
  state.charts[id] = new Chart(document.getElementById(id), {
    type, data: { labels, datasets },
    options: { responsive: true, animation: false, plugins: { legend: { display: datasets.length > 1 } }, ...extra },
  });
}
function distText(d) {
  if (!d.count) return 'No data yet.';
  return `n = ${d.count} users · mean ${d.mean.toFixed(1)} · std ${d.std.toFixed(2)} · binomial fit B(${d.n}, ${d.p.toFixed(3)}) std ${d.binomial_std.toFixed(2)}`;
}
async function loadAnalysis() {
  const group = $('#a-group').value;
  const sel = $('#a-value');
  const values = group === 'project' ? state.index.projects.map(p => [p.key, p.name])
    : group === 'project_type' ? ['Plus', 'Prime', 'Standard'].map(t => [t, t])
    : group === 'flat_type' ? state.index.flat_types.map(t => [t, t]) : [];
  sel.hidden = !values.length;
  if (values.length && !values.some(([v]) => v === sel.value)) sel.innerHTML = values.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  const q = new URLSearchParams({ group, ...(values.length ? { value: sel.value } : {}) });
  const a = await api(`/api/analysis?${q}`);
  $('#a-basis').textContent = `${a.users} saved lists. ` + Object.entries(a.basis).map(([p, b]) => `${p}: ${b.used} (${b.verified} verified / ${b.total})`).join(' · ');
  for (const [k, d] of [['min', a.min_storey], ['max', a.max_storey]]) {
    const labels = d.histogram.map((_, i) => i);
    chart(`c-${k}`, 'bar', labels, [
      { label: 'Users', data: d.histogram, backgroundColor: '#2b6cb0' },
      { label: 'Binomial fit', data: d.binomial_expected.map(v => +v.toFixed(2)), type: 'line', borderColor: '#dd6b20', pointRadius: 0 },
    ]);
    $(`#t-${k}`).textContent = distText(d);
  }
  const bar = (id, rows, label) => chart(id, 'bar', rows.map(r => r.key), [{ label, data: rows.map(r => +r.mean.toFixed(2)), backgroundColor: '#2f855a' }], { indexAxis: 'y' });
  bar('c-sun', a.sun_directions, 'Avg importance');
  bar('c-block', a.blocks, 'Avg importance');
  const fl = Object.fromEntries(Object.entries(Scoring.FACTORS).map(([k, [l]]) => [k, l]));
  chart('c-factor', 'bar', a.factors.map(r => fl[r.key] || r.key), [{ label: 'Avg importance', data: a.factors.map(r => +r.mean.toFixed(2)), backgroundColor: '#6b46c1' }], { indexAxis: 'y' });
  chart('c-pref', 'doughnut', Object.keys(a.floor_preference), [{ data: Object.values(a.floor_preference) }]);
  chart('c-types', 'bar', Object.keys(a.flat_types), [{ label: 'Lists', data: Object.values(a.flat_types), backgroundColor: '#2c7a7b' }]);
  $('#a-flagged').innerHTML = a.most_flagged.map(f => `<li>${esc(f.unit_id)} — ${f.count}</li>`).join('') || '<li class="muted">None yet</li>';
  $('#a-queue').textContent = a.queue.count ? `Median queue number among ${a.queue.count} users: ${a.queue.median}` : '';
}
$('#a-group').addEventListener('change', loadAnalysis);
$('#a-value').addEventListener('change', loadAnalysis);

// ---------- legend ----------
async function renderLegend() {
  const key = $('#l-project').value || state.project.key;
  const legend = await fetch(`/data/legend/${key}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!legend) { $('#legend-cards').innerHTML = '<p class="muted">Legend not available for this project.</p>'; return; }
  $('#legend-cards').innerHTML = legend.cards.map(c => `<div class="card"><h3>${esc(c.title)}</h3>
    ${c.image ? `<a href="/data/${esc(c.image)}" target="_blank"><img src="/data/${esc(c.image)}" alt="${esc(c.title)}" loading="lazy"></a>` : ''}
    <p class="small">${esc(c.text)}</p></div>`).join('');
}

// ---------- account ----------
function renderAccount() {
  $('#acct-in').hidden = !state.user;
  $('#acct-out').hidden = !!state.user;
  if (state.user) {
    $('#acct-email').textContent = state.user.email;
    $('#acct-verified').textContent = state.user.verified ? 'verified ✓' : 'not verified (check your verification link)';
  }
}
async function afterAuth() {
  state.user = (await api('/api/me')).user;
  // Merge locally flagged units into the account.
  const local = lsGet(`flags:${state.project.key}`, []);
  const remote = (await api(`/api/flags/${state.project.key}`)).unit_ids;
  state.flags = [...new Set([...remote, ...local])];
  await persistFlags();
  renderAccount();
}
for (const [id, url] of [['#form-login', '/api/login'], ['#form-register', '/api/register']]) {
  $(id).addEventListener('submit', async e => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(e.target));
    try {
      const r = await api(url, { method: 'POST', body: fd });
      if (r.verify_link) $('#acct-verify-link').innerHTML = `Verification link (dev mode): <a href="${esc(r.verify_link)}">verify my email</a>`;
      await afterAuth();
    } catch (err) { e.target.querySelector('.err').textContent = err.message; }
  });
}
$('#btn-logout').addEventListener('click', async () => {
  await api('/api/logout', { method: 'POST' });
  state.user = null; state.flags = lsGet(`flags:${state.project.key}`, []); updateFlagCount(); renderAccount();
});

init().catch(err => { document.body.insertAdjacentHTML('afterbegin', `<p class="err">Failed to load: ${esc(err.message)}</p>`); });

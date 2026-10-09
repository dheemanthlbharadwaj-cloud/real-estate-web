/* global Scoring, Chart, LEGEND */
import * as store from './store.js';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const on = (sel, ev, fn) => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.addEventListener(ev, fn); };
const PAGE = document.body.dataset.page;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FACTOR_HELP = {
  lift: 'Metres from your door to the lift lobby. + prefers further away.',
  clearance: 'No unit of another block within 30 m.',
  corner: 'End-of-row unit with windows on two sides.',
  roof: 'Looks onto a podium / 2nd-storey roof.',
  chute: 'Metres from your door to the refuse chute. + prefers further away.',
  mrt: 'Block within 400 m of an MRT station.',
  facilities: 'Facilities in your block (has) or within 50 m (near).',
};
const BEARING = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

const state = { index: null, project: null, units: [], ranked: [], shown: 0, user: null, flags: [], charts: {}, weights: {} };

async function api(path, opts = {}) {
  const r = await fetch(path, opts);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(data.error || r.statusText); e.status = r.status; e.code = data.code; throw e; }
  return data;
}
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

// ---------------------------------------------------------------- page dispatch
function route() {
  if (PAGE === 'shortlist') renderShortlist();
  if (PAGE === 'analysis') loadAnalysis();
  if (PAGE === 'guide') renderLegend();
  if (PAGE === 'account') renderAccount();
}

// ---------------------------------------------------------------- init / project
async function init() {
  state.index = await api('/data/units/index.json');
  try {
    state.user = await store.init(onAuthChange);
  } catch (err) {
    state.authError = err.message;
    state.user = null;
  }
  // Project: ?project= in the URL wins, then the last one used, then the first.
  const valid = k => state.index.projects.some(p => p.key === k);
  const fromUrl = new URLSearchParams(location.search).get('project');
  const key = valid(fromUrl) ? fromUrl : valid(lsGet('project', null)) ? lsGet('project', null) : state.index.projects[0].key;
  if ($('#project')) {
    $('#project').innerHTML = ['Prime', 'Plus', 'Standard'].map(t => `<optgroup label="${t}">${state.index.projects.filter(p => p.project_type === t)
      .map(p => `<option value="${p.key}">${esc(p.name)}</option>`).join('')}</optgroup>`).join('');
    $('#project').value = key;
    on('#project', 'change', () => loadProject($('#project').value));
  }
  on('#btn-rank', 'click', runRank);
  on('#btn-more', 'click', () => renderResults(false));
  on('#btn-save', 'click', saveList);
  on('#btn-csv', 'click', downloadCsv);
  $$('[data-blocks]').forEach(b => b.addEventListener('click', () => {
    $$('#f-blocks input').forEach(i => { i.checked = b.dataset.blocks === 'all'; });
    renderWeights();
  }));
  on('#f-types', 'change', renderWeights);
  on('#f-blocks', 'change', renderWeights);
  if (PAGE === 'rank' || PAGE === 'shortlist') await loadProject(key);
  else { state.project = state.index.projects.find(p => p.key === key); state.flags = await loadFlags(); }
  renderTitleBlock();
  route();
}

// Sample-data note on the page hero, plus hints the shared header reads on every page.
function renderTitleBlock() {
  const p = state.project;
  if ($('#sample-note') && state.index?.sample && p && (PAGE === 'rank' || PAGE === 'shortlist')) {
    $('#sample-note').hidden = false;
    $('#sample-text').textContent = p.data_status === 'sample data'
      ? `${p.name}: units and attributes shown are placeholders until the brochure data is verified.`
      : `${p.name}: blocks, storeys, unit numbers and flat types are real (${p.units.toLocaleString()} units); facing, distances and facilities are placeholders.`;
  }
  lsSet('mybto:user', state.user ? { verified: !!state.user.verified } : null);
  const link = $('#account-link');
  if (link) link.textContent = state.user ? 'My account' : 'Sign in';
}

async function loadProject(key) {
  state.project = state.index.projects.find(p => p.key === key);
  lsSet('project', key);
  state.units = await api(`/data/units/${key}.json`);
  const p = state.project;
  if (PAGE !== 'rank') {
    state.flags = await loadFlags();
    updateFlagCount();
    const list = state.user ? await store.loadList(key).catch(() => null) : null;
    state.ranked = list ? Scoring.rank(state.units, { flatTypes: list.flat_types, blocks: list.blocks, minStorey: list.min_storey, maxStorey: list.max_storey, oppositeGt30: list.opposite_gt30 }, list.weights, list.floor_pref) : [];
    renderTitleBlock();
    if (PAGE === 'shortlist') renderShortlist();
    return;
  }
  $('#project-meta').textContent = `${p.town} · ${p.project_type} · ${p.units.toLocaleString()} units · ${p.blocks.length} blocks`;
  $('#f-types').innerHTML = p.flat_types.map(t => `<label class="chip"><input type="checkbox" value="${esc(t)}" checked><span>${esc(t)}</span></label>`).join('');
  $('#f-blocks').innerHTML = p.blocks.map(b => `<label class="chip block"><input type="checkbox" value="${esc(b)}" checked><span>${esc(b)}</span></label>`).join('');
  const storeys = state.units.map(u => u.storey);
  const lo = Math.min(...storeys), hi = Math.max(...storeys);
  const opt = Array.from({ length: hi - lo + 1 }, (_, i) => `<option value="${lo + i}">${String(lo + i).padStart(2, '0')}</option>`).join('');
  $('#f-min').innerHTML = opt; $('#f-max').innerHTML = opt;
  $('#f-min').value = lo; $('#f-max').value = hi;
  $('#f-opposite').checked = false;
  $('#f-pref input[value=none]').checked = true;
  $('#queue').value = '';
  state.weights = {};
  state.flags = await loadFlags();
  updateFlagCount();
  renderWeights();
  renderTitleBlock();
  $('#save-msg').textContent = '';
  if (state.user) {
    const list = await store.loadList(key).catch(() => null);
    if (list) applySaved(list);
  }
  runRank();
}

// ---------------------------------------------------------------- importance meters
function selectedBlocks() { return $$('#f-blocks input:checked').map(i => i.value); }
function selectedTypes() { return $$('#f-types input:checked').map(i => i.value); }

function captureWeights() {
  $$('#weights input[type=range]').forEach(r => {
    const g = r.dataset.group, k = r.dataset.key;
    if (g === 'factor') state.weights[k] = Number(r.value);
    else (state.weights[g] = state.weights[g] || {})[k] = Number(r.value);
  });
}

function meter(group, key, label, help) {
  const v = group === 'factor' ? state.weights[key] ?? 0 : state.weights[group]?.[key] ?? 0;
  const id = `w-${group}-${key}`.replace(/[^a-z0-9-]/gi, '_');
  return `<div class="meter"><label for="${id}" title="${esc(help || '')}">${esc(label)}</label>
    <input id="${id}" type="range" min="-5" max="5" step="1" value="${v}" data-group="${group}" data-key="${esc(key)}">
    <span class="val ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}">${v > 0 ? '+' : ''}${v}</span></div>`;
}

// Only factors present among units in the selected blocks (and unit types) get a meter.
function renderWeights() {
  captureWeights();
  const blocks = selectedBlocks();
  const scope = Scoring.filterUnits(state.units, { blocks, flatTypes: selectedTypes() });
  const av = Scoring.availability(scope);
  const hidden = [];
  let h = '';
  h += `<div class="meter-group"><span class="eyebrow"><span>Blocks</span><span>${blocks.length}</span></span>${blocks.length
    ? blocks.map(b => meter('block', b, `Block ${b}`)).join('') : '<p class="small muted">Select at least one block.</p>'}</div>`;
  if (av.sun.length) h += `<div class="meter-group"><span class="eyebrow"><span>Sun direction</span><span>${av.sun.length}/8</span></span>${av.sun.map(d => meter('sun', d, d, 'Direction the living room windows face')).join('')}</div>`;
  const missingSun = Scoring.SUN_DIRECTIONS.filter(d => !av.sun.includes(d));
  if (missingSun.length && scope.length) hidden.push(`facing ${missingSun.join(', ')}`);
  if (av.design.length) h += `<div class="meter-group"><span class="eyebrow"><span>Unit design · 2-Room Flexi</span></span>${av.design.map(d => meter('design', d, d)).join('')}</div>`;
  const facs = Object.entries(Scoring.FACTORS).filter(([k]) => av[k]);
  Object.entries(Scoring.FACTORS).filter(([k]) => !av[k]).forEach(([, [l]]) => hidden.push(l.toLowerCase()));
  if (facs.length) h += `<div class="meter-group"><span class="eyebrow"><span>Unit &amp; site</span></span>${facs.map(([k, [label]]) => meter('factor', k, label, FACTOR_HELP[k])).join('')}</div>`;
  $('#weights').innerHTML = h;
  $('#hidden-factors').textContent = hidden.length && scope.length ? `Not in your selection, so hidden: ${hidden.join(' · ')}.` : '';
  $$('#weights input[type=range]').forEach(r => r.addEventListener('input', () => {
    const v = Number(r.value), out = r.nextElementSibling;
    out.textContent = `${v > 0 ? '+' : ''}${v}`;
    out.className = `val ${v > 0 ? 'pos' : v < 0 ? 'neg' : ''}`;
  }));
}

// Weights actually in effect = meters currently shown.
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
  return { flatTypes: selectedTypes(), blocks: selectedBlocks(), minStorey: min, maxStorey: max, oppositeGt30: $('#f-opposite').checked };
}
const readPref = () => $('#f-pref input:checked').value;

function applySaved(list) {
  $$('#f-types input').forEach(i => { i.checked = !list.flat_types.length || list.flat_types.includes(i.value); });
  $$('#f-blocks input').forEach(i => { i.checked = !list.blocks.length || list.blocks.includes(i.value); });
  if (list.min_storey != null) $('#f-min').value = list.min_storey;
  if (list.max_storey != null) $('#f-max').value = list.max_storey;
  $$('#f-pref input').forEach(i => { i.checked = i.value === list.floor_pref; });
  $('#f-opposite').checked = !!list.opposite_gt30;
  $('#queue').value = list.queue_number || '';
  state.weights = { ...list.weights };
  renderWeights();
  const when = list.updated_at?.toDate ? list.updated_at.toDate().toLocaleString() : '';
  $('#save-msg').textContent = `Loaded your saved list${when ? ` · ${when}` : ''}`;
}

// ---------------------------------------------------------------- schedule
function runRank() {
  state.ranked = Scoring.rank(state.units, readFilters(), readWeights(), readPref());
  state.shown = 0;
  $('#result-count').innerHTML = `${state.ranked.length.toLocaleString()}<small>units</small>`;
  renderResults(true);
}

const compass = d => `<span class="compass"><svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-opacity=".3"/><path d="M8 2 L10.5 9 H5.5Z" fill="currentColor" transform="rotate(${BEARING[d] ?? 0} 8 8)"/></svg>${esc(d)}</span>`;

const dist = m => (m == null ? '–' : `${Math.round(m)} m`);

function tags(u) {
  const t = [];
  if (u.position === 'Corner') t.push('<span class="tag">corner</span>');
  if (u.roof_access) t.push('<span class="tag">roof</span>');
  if (u.mrt_near) t.push('<span class="tag">mrt</span>');
  if (u.opposite_gt30m) t.push('<span class="tag">private</span>');
  if (u.chute_near) t.push('<span class="tag warn">chute</span>');
  return `<div class="tags">${t.join('')}</div>`;
}

function renderResults(reset) {
  const head = ['#', '', 'Unit', 'Type · facing', 'Lift · chute', 'Opposite · MRT', 'Facilities', 'Score'];
  if (reset) {
    $('#results thead').innerHTML = `<tr>${head.map(h => `<th>${h}</th>`).join('')}</tr>`;
    $('#results tbody').innerHTML = '';
    state.maxAbs = Math.max(1, ...state.ranked.map(u => Math.abs(u.score)));
  }
  if (!state.ranked.length) {
    $('#results tbody').innerHTML = `<tr><td colspan="${head.length}"><div class="empty">No units match these filters.</div></td></tr>`;
    $('#btn-more').hidden = true;
    return;
  }
  const next = state.ranked.slice(state.shown, state.shown + 100);
  $('#results tbody').insertAdjacentHTML('beforeend', next.map(u => {
    const pct = Math.min(100, (Math.abs(u.score) / state.maxAbs) * 100);
    return `<tr class="${u.rank <= 3 ? 'top3' : ''}">
      <td class="rk">${u.rank}</td>
      <td><button class="star ${state.flags.includes(u.id) ? 'on' : ''}" data-id="${esc(u.id)}" aria-label="Flag ${esc(u.address)}" title="Add to shortlist">★</button></td>
      <td class="addr">#${String(u.storey).padStart(2, '0')}-${esc(u.unit)}<small>Blk ${esc(u.block)}</small>${tags(u)}</td>
      <td><span class="type">${esc(u.flat_type.replace('2-Room Flexi', '2RF'))}</span><div class="sub">${compass(u.facing)}</div></td>
      <td class="num">${dist(u.lift_m)}<div class="sub">${dist(u.chute_m)}</div></td>
      <td class="num">${dist(u.opposite_m)}<div class="sub">${dist(u.mrt_m)}</div></td>
      <td class="num" title="${esc([...u.facilities_has.map(f => `In block: ${f}`), ...u.facilities_near.map(f => `Near: ${f}`)].join('\n'))}">${u.fac_has_count} in block<div class="sub">${u.fac_near_count} nearby</div></td>
      <td><span class="scorebar ${u.score < 0 ? 'neg' : ''}">${u.score > 0 ? '+' : ''}${u.score.toFixed(1)}<i><b style="width:${pct}%"></b></i></span></td></tr>`;
  }).join(''));
  state.shown += next.length;
  $('#btn-more').hidden = state.shown >= state.ranked.length;
}

on('#results', 'click', e => {
  const b = e.target.closest('.star');
  if (!b) return;
  toggleFlag(b.dataset.id);
  b.classList.toggle('on', state.flags.includes(b.dataset.id));
});

async function saveList() {
  if (!state.user) { $('#save-msg').innerHTML = 'Sign in to save your list — <a href="/account">sign in here</a>.'; return; }
  const f = readFilters();
  try {
    await store.saveList(state.project.key, {
      project_type: state.project.project_type, queue_number: $('#queue').value.trim().slice(0, 40), flat_types: f.flatTypes, blocks: f.blocks,
      min_storey: f.minStorey, max_storey: f.maxStorey, floor_pref: readPref(), opposite_gt30: f.oppositeGt30, weights: readWeights(),
    });
    $('#save-msg').textContent = `Saved · ${state.ranked.length} units · queue ${$('#queue').value.trim() || '—'}`;
  } catch (err) { $('#save-msg').textContent = err.message; }
}

function downloadCsv() {
  const cols = ['rank', 'score', 'address', 'block', 'storey', 'unit', 'flat_type', 'unit_design', 'facing', 'position', 'lift_m', 'chute_m',
    'opposite_m', 'neighbour_m', 'roof_access', 'mrt_name', 'mrt_m', 'fac_has_count', 'fac_near_count', 'id'];
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = [cols.join(','), ...state.ranked.map(u => cols.map(k => q(u[k])).join(','))];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
  a.download = `${state.project.key}-ranked.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------------------------------------------------------------- shortlist
async function loadFlags() {
  if (state.user) return store.loadFlags(state.project.key).catch(() => lsGet(`flags:${state.project.key}`, []));
  return lsGet(`flags:${state.project.key}`, []);
}
async function persistFlags() {
  lsSet(`flags:${state.project.key}`, state.flags);
  updateFlagCount();
  if (state.user) await store.saveFlags(state.project.key, state.flags).catch(err => console.error(err));
}
function toggleFlag(id) {
  state.flags = state.flags.includes(id) ? state.flags.filter(x => x !== id) : [...state.flags, id];
  persistFlags();
}
function updateFlagCount() {
  if ($('#flag-count')) $('#flag-count').textContent = state.flags.length;
  try { localStorage.setItem('mybto:flagcount', String(state.flags.length)); } catch { /* storage unavailable */ }
}

function renderShortlist() {
  const byId = Object.fromEntries(state.units.map(u => [u.id, u]));
  const ranked = Object.fromEntries(state.ranked.map(u => [u.id, u]));
  const list = $('#flag-list');
  const items = state.flags.filter(id => byId[id]);
  if (!items.length) { list.innerHTML = '<div class="empty">Nothing here yet — star ★ units on the Rank page.</div>'; return; }
  list.innerHTML = items.map((id, i) => {
    const u = byId[id], r = ranked[id];
    return `<li draggable="true" data-id="${esc(id)}">
      <div><div class="addr">Blk ${esc(u.block)} #${String(u.storey).padStart(2, '0')}-${esc(u.unit)}</div>
        <div class="meta">${esc(u.flat_type)} · faces ${esc(u.facing)} · ${esc(u.position.toLowerCase())}${r ? ` · rank ${r.rank} in your saved list` : ''}</div></div>
      <div></div>
      <div class="ctrl"><button data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button data-act="down" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button><button data-act="rm" aria-label="Remove">✕</button></div></li>`;
  }).join('');
}
function moveFlag(from, to) {
  const f = [...state.flags];
  const [m] = f.splice(from, 1);
  f.splice(to, 0, m);
  state.flags = f;
  persistFlags();
  renderShortlist();
}
on('#flag-list', 'click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  const i = state.flags.indexOf(b.closest('li').dataset.id);
  if (b.dataset.act === 'up') moveFlag(i, i - 1);
  if (b.dataset.act === 'down') moveFlag(i, i + 1);
  if (b.dataset.act === 'rm') { state.flags.splice(i, 1); persistFlags(); renderShortlist(); }
});
let dragId = null;
on('#flag-list', 'dragstart', e => { const li = e.target.closest('li'); dragId = li?.dataset.id; li?.classList.add('dragging'); });
on('#flag-list', 'dragend', () => { $$('#flag-list li').forEach(l => l.classList.remove('dragging', 'over')); });
on('#flag-list', 'dragover', e => {
  e.preventDefault();
  $$('#flag-list li').forEach(l => l.classList.toggle('over', l === e.target.closest('li')));
});
on('#flag-list', 'drop', e => {
  e.preventDefault();
  const to = state.flags.indexOf(e.target.closest('li')?.dataset.id);
  const from = state.flags.indexOf(dragId);
  if (from < 0 || to < 0 || from === to) return;
  moveFlag(from, to);
});

// ---------------------------------------------------------------- analysis
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
function chart(id, config) {
  state.charts[id]?.destroy();
  Chart.defaults.font.family = "'Hanken Grotesk', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = css('--ink-2');
  Chart.defaults.borderColor = css('--line');
  state.charts[id] = new Chart(document.getElementById(id), config);
}
function statsHtml(d) {
  if (!d.count) return '<span>No data yet.</span>';
  return `<span><b>${d.mean.toFixed(1)}</b>mean storey</span><span><b>${d.std.toFixed(2)}</b>std</span>
    <span><b>${d.binomial_std.toFixed(2)}</b>binomial std</span><span><b>B(${d.n}, ${d.p.toFixed(2)})</b>binomial fit</span><span><b>${d.count}</b>users</span>`;
}
function ranklist(el, rows, fmtKey = k => k) {
  $(el).innerHTML = rows.length ? rows.map((r, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span><span>${esc(fmtKey(r.key))}</span><span>${r.mean > 0 ? '+' : ''}${r.mean.toFixed(2)}</span><span class="sd">±${(r.std ?? 0).toFixed(2)}</span></li>`).join('')
    : '<li><span></span><span class="muted">No data</span><span></span><span></span></li>';
}

async function loadAnalysis() {
  const locked = $('#analysis-locked'), body = $('#analysis-body');
  if (!state.user || !state.user.verified) {
    locked.hidden = false; body.hidden = true;
    $('#locked-text').textContent = state.user
      ? 'Your account isn\'t verified yet. Open the verification link from your sign-up to unlock the analysis.'
      : 'Create an account and verify your email to unlock the analysis.';
    return;
  }
  locked.hidden = true; body.hidden = false;
  const group = $('#a-group').value;
  const sel = $('#a-value');
  const values = group === 'project' ? state.index.projects.map(p => [p.key, p.name])
    : group === 'project_type' ? ['Plus', 'Prime', 'Standard'].map(t => [t, t])
    : group === 'flat_type' ? state.index.flat_types.map(t => [t, t]) : [];
  $('#a-value-wrap').hidden = !values.length;
  if (values.length && !values.some(([v]) => v === sel.value)) sel.innerHTML = values.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  let a;
  try {
    a = await api(`/api/analysis?${new URLSearchParams({ group, ...(values.length ? { value: sel.value } : {}) })}`,
      { headers: { Authorization: `Bearer ${await store.idToken()}` } });
  } catch (err) {
    $('#a-basis').textContent = err.message;
    return;
  }
  const names = Object.fromEntries(state.index.projects.map(p => [p.key, p.name]));
  $('#a-basis').textContent = `${a.users} saved lists${a.sample_users ? ` · includes ${a.sample_users} SAMPLE users for demonstration` : ''} — `
    + Object.entries(a.basis).map(([p, b]) => `${names[p] || p}: ${b.used} (${b.verified} verified of ${b.total})`).join(' · ');

  const ink = css('--forest'), signal = css('--rose'), green = css('--brass'), rule = css('--line-2');
  const prefOrder = ['higher', 'middle', 'lower', 'none'];
  for (const [k, d] of [['min', a.min_storey], ['max', a.max_storey]]) {
    chart(`c-${k}`, {
      data: { labels: d.histogram.map((_, i) => i), datasets: [
        { type: 'bar', label: 'Users', data: d.histogram, backgroundColor: ink, barPercentage: 1, categoryPercentage: .9 },
        { type: 'line', label: 'Binomial fit', data: d.binomial_expected.map(v => +v.toFixed(2)), borderColor: signal, borderWidth: 2, pointRadius: 0, tension: .3 },
      ] },
      options: { animation: false, plugins: { legend: { labels: { boxWidth: 10 } } }, scales: { x: { title: { display: true, text: 'Storey' }, grid: { display: false } }, y: { beginAtZero: true } } },
    });
    $(`#s-${k}`).innerHTML = statsHtml(d);
  }
  const fl = Object.fromEntries(Object.entries(Scoring.FACTORS).map(([k, [l]]) => [k, l]));
  ranklist('#r-sun', a.sun_directions);
  ranklist('#r-block', a.blocks, k => `Block ${k}`);
  ranklist('#r-factor', a.factors, k => fl[k] || k);
  chart('c-factor', {
    type: 'bar',
    data: { labels: a.factors.map(r => fl[r.key] || r.key), datasets: [
      { label: 'Mean importance', data: a.factors.map(r => +r.mean.toFixed(2)), backgroundColor: a.factors.map(r => (r.mean >= 0 ? green : signal)) },
    ] },
    options: { indexAxis: 'y', animation: false, plugins: { legend: { display: false } },
      scales: { x: { min: -5, max: 5 }, y: { grid: { display: false } } } },
  });
  const pref = a.floor_preference;
  const prefLabels = { higher: 'Higher', middle: 'Middle', lower: 'Lower', none: 'No preference' };
  chart('c-pref', {
    type: 'doughnut',
    data: { labels: prefOrder.map(k => prefLabels[k]), datasets: [{ data: prefOrder.map(k => pref[k] || 0), backgroundColor: [ink, green, signal, rule], borderWidth: 0 }] },
    options: { animation: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } } },
  });
  const pv = a.privacy_filter;
  $('#s-privacy').innerHTML = pv.total ? `<span><b>${Math.round((pv.on / pv.total) * 100)}%</b>use the 30 m privacy filter</span>` : '';
  chart('c-types', {
    type: 'bar',
    data: { labels: Object.keys(a.flat_types), datasets: [{ label: 'Lists', data: Object.values(a.flat_types), backgroundColor: ink }] },
    options: { animation: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } },
  });
  $('#r-flagged').innerHTML = a.most_flagged.length ? a.most_flagged.slice(0, 10).map((f, i) => {
    const [, block, storey, unit] = f.unit_id.split('-');
    return `<li><span>${String(i + 1).padStart(2, '0')}</span><span>Blk ${esc(block)} #${esc(storey)}-${esc(unit)}</span><span>${f.count}×</span></li>`;
  }).join('') : '<li><span></span><span class="muted">No flags yet</span><span></span></li>';
  $('#s-queue').innerHTML = a.queue.count ? `<span><b>${a.queue.median}</b>median queue no. (${a.queue.count} users)</span>` : '';
}
on('#a-group', 'change', loadAnalysis);
on('#a-value', 'change', loadAnalysis);

// ---------------------------------------------------------------- legend
function renderLegend() {
  if ($('#legend').childElementCount) return;
  $('#legend').innerHTML = LEGEND.map((c, i) => `<article class="lg reveal"><span class="eyebrow">${String(i + 1).padStart(2, '0')} · ${esc(c.tag)}</span>
    <h3>${esc(c.title)}</h3>${c.svg}<p>${esc(c.text)}</p><p class="rule-txt">${esc(c.rule)}</p></article>`).join('');
  window.revealAll && window.revealAll($('#legend'));
}

// ---------------------------------------------------------------- account
function renderAccount() {
  if (PAGE !== 'account') return;
  $('#acct-in').hidden = !state.user;
  $('#acct-out').hidden = !!state.user;
  $('#auth-error').hidden = !state.authError;
  $('#auth-error').textContent = state.authError || '';
  if (state.user) {
    $('#acct-email').textContent = state.user.email;
    const b = $('#acct-badge');
    b.textContent = state.user.verified ? 'Verified' : 'Not verified';
    b.className = `badge ${state.user.verified ? 'ok' : 'no'}`;
    $('#verify-box').hidden = state.user.verified;
  }
  const q = new URLSearchParams(location.search);
  if (q.get('verified') === '1' && state.user && !state.user.verified) refreshVerification();
}
function note(msg) { if (!$('#acct-note')) return; $('#acct-note').hidden = !msg; $('#acct-note').textContent = msg || ''; }

async function refreshVerification() {
  state.user = await store.refreshUser();
  renderTitleBlock();
  renderAccount();
  note(state.user?.verified ? 'Email verified — Analysis is unlocked.' : "Not verified yet. Open the link in the email we sent you, then press this again.");
}

// Called by Firebase whenever the signed-in user changes (sign in / out in this or another tab).
async function onAuthChange(user) {
  const was = state.user?.uid;
  state.user = user;
  renderTitleBlock();
  renderAccount();
  if (!state.project) return;
  if (user && user.uid !== was) {
    // Merge flags made while signed out into the account.
    const local = lsGet(`flags:${state.project.key}`, []);
    const remote = await store.loadFlags(state.project.key).catch(() => []);
    state.flags = [...new Set([...remote, ...local])];
    await persistFlags();
    const list = await store.loadList(state.project.key).catch(() => null);
    if (list && PAGE === 'rank') { applySaved(list); runRank(); }
    if (PAGE === 'shortlist') loadProject(state.project.key);
  } else if (!user) {
    state.flags = lsGet(`flags:${state.project.key}`, []);
    updateFlagCount();
  }
  if (PAGE === 'analysis') loadAnalysis();
}

on('#form-login', 'submit', async e => {
  e.preventDefault();
  const err = e.target.querySelector('.err');
  err.textContent = '';
  const fd = new FormData(e.target);
  try { await store.login(fd.get('email'), fd.get('password')); e.target.reset(); note(''); } catch (ex) { err.textContent = ex.message; }
});
on('#form-register', 'submit', async e => {
  e.preventDefault();
  const err = e.target.querySelector('.err');
  err.textContent = '';
  const fd = new FormData(e.target);
  try {
    await store.register(fd.get('email'), fd.get('password'));
    e.target.reset();
    note(`We've sent a verification link to ${fd.get('email')}. Open it to unlock Analysis.`);
  } catch (ex) { err.textContent = ex.message; }
});
on('#btn-forgot', 'click', async () => {
  const email = $('#form-login [name=email]').value.trim();
  const err = $('#form-login .err');
  if (!email) { err.textContent = 'Type your email above first.'; return; }
  try { await store.resetPassword(email); err.textContent = `Password reset email sent to ${email}.`; } catch (ex) { err.textContent = ex.message; }
});
on('#btn-resend', 'click', async () => {
  try { await store.resendVerification(); note(`Verification email re-sent to ${state.user.email}.`); } catch (ex) { note(ex.message); }
});
on('#btn-refresh', 'click', refreshVerification);
$$('[data-google]').forEach(b => b.addEventListener('click', async () => {
  const err = b.closest('form').querySelector('.err');
  err.textContent = '';
  try { await store.loginWithGoogle(); note(''); } catch (ex) { err.textContent = ex.message; }
}));
on('#btn-logout', 'click', () => store.logout());

init().catch(err => {
  console.error(err);
  ($('.tool .wrap') || document.body).insertAdjacentHTML('afterbegin', `<p class="err">Couldn't load: ${esc(err.message)}</p>`);
});

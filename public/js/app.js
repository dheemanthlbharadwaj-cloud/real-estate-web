/* global Scoring, Chart, LEGEND */
import * as store from './store.js';
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const on = (sel, ev, fn) => { const el = typeof sel === 'string' ? $(sel) : sel; if (el) el.addEventListener(ev, fn); };
const PAGE = document.body.dataset.page;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const FACTOR_HELP = {
  clearance: 'More than 30 m from the nearest visible unit in the same or neighbouring block.',
  corner: 'Sits at the end of the corridor.',
  roof: 'On the same floor as an accessible roof.',
  chute: 'The front door is more than 10 m from the nearest refuse chute.',
  mrt: 'Block within 100 m of an MRT station.',
  mscp: 'Block within 100 m of a multi-storey car park.',
  wind_facing: 'The unit faces NE or SE. Singapore’s prevailing wind comes from the south-east to east, and a NE or SE window both catch wind from the east side.',
  wind_open: 'No other block stands within 30 m of the unit on its SE to E side, so the wind is not blocked.',
};
const FACILITY_HELP = 'In the unit’s block (has) or within 30 m of any part of the block (near).';
const FUTURE_FAC_HELP = 'Future amenities/facilities: void deck space HDB has set aside for things like preschools, eldercare or a residents’ network centre.';
const facilityHelp = name => (name === 'Future amenities/facilities' ? `${FUTURE_FAC_HELP} ${FACILITY_HELP}` : FACILITY_HELP);
const BEARING = { NE: 45, SE: 135, SW: 225, NW: 315 };
const SHOW_TOP = 100; // the full ranking is saved, only the top 100 are shown
const MAX_SHARE = 100; // most units in a shared shortlist link
const state = { index: null, project: null, units: [], ranked: [], hasRanked: false, flags: [], shared: null, charts: {}, weights: {}, consentedAt: null };

async function api(path) {
  const r = await fetch(path);
  if (!r.ok) throw new Error(r.statusText || `HTTP ${r.status}`);
  return r.json();
}
const lsGet = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };

// ---------------------------------------------------------------- page dispatch
function route() {
  if (PAGE === 'shortlist') renderShortlist();
  if (PAGE === 'analytics') openAnalytics();
  if (PAGE === 'rank' && new URLSearchParams(location.search).has('legend')) openLegend(new URLSearchParams(location.search).get('legend'));
  // The header's "Rank units" tab ranks too: from another page it opens /?rank=1, on this page it acts like the button.
  if (PAGE === 'rank' && new URLSearchParams(location.search).has('rank')) {
    history.replaceState(null, '', location.pathname);
    rankFromTab();
  }
  on('#tab-rank', 'click', e => { if (PAGE === 'rank') { e.preventDefault(); rankFromTab(); } });
}

async function rankFromTab() {
  await onRankClick();
  if (state.hasRanked) $('.results-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------- init / project
async function init() {
  state.index = await api('/data/units/index.json');
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
  on('#btn-rank', 'click', onRankClick);
  $$('[data-blocks]').forEach(b => b.addEventListener('click', () => {
    $$('#f-blocks input').forEach(i => { i.checked = b.dataset.blocks === 'all'; });
    renderWeights();
  }));
  on('#f-types', 'change', renderWeights);
  on('#f-blocks', 'change', renderWeights);
  if (PAGE === 'rank' || PAGE === 'shortlist') await loadProject(key);
  else state.project = state.index.projects.find(p => p.key === key);
  route();
}

async function loadProject(key) {
  state.project = state.index.projects.find(p => p.key === key);
  lsSet('project', key);
  window.dispatchEvent(new CustomEvent('mybto:project', { detail: key })); // the header's Analytics tab follows the project
  state.units = await api(`/data/units/${key}.json`);
  const p = state.project;
  if (PAGE !== 'rank') {
    state.flags = loadFlags();
    updateFlagCount();
    if (PAGE === 'shortlist') { readSharedLink(); renderShortlist(); }
    return;
  }
  $('#project-meta').textContent = `This is a ${p.project_type} project in ${p.town}, with ${p.units.toLocaleString()} flat units and ${p.blocks.length} ${p.blocks.length === 1 ? 'block' : 'blocks'}.`;
  // One housing type at a time (one application per queue); 2-Room Flexi covers Type 1 and Type 2.
  const housing = Scoring.HOUSING_TYPES.filter(h => p.flat_types.some(t => Scoring.housingOf(t) === h));
  const first = housing.includes('4-Room') ? '4-Room' : housing[0];
  $('#f-types').innerHTML = housing.map(h => `<label class="chip"><input type="radio" name="housing" value="${esc(h)}"${h === first ? ' checked' : ''}><span>${esc(h === '2-Room Flexi' ? '2-Room Flexi (Type 1 and 2)' : h)}</span></label>`).join('');
  $('#f-blocks').innerHTML = p.blocks.map(b => `<label class="chip block"><input type="checkbox" value="${esc(b)}" checked><span>${esc(b)}</span></label>`).join('');
  const storeys = state.units.map(u => u.storey);
  const lo = Math.min(...storeys), hi = Math.max(...storeys);
  const opt = Array.from({ length: hi - lo + 1 }, (_, i) => `<option value="${lo + i}">${String(lo + i).padStart(2, '0')}</option>`).join('');
  $('#f-min').innerHTML = opt; $('#f-max').innerHTML = opt;
  $('#f-min').value = lo; $('#f-max').value = hi;
  $('#f-pref input[value=higher]').checked = true;
  state.weights = {};
  // Analytics is archived: its button shows only when ANALYTICS_ENABLED is true in config.js.
  if ((window.MYBTO_CONFIG || {}).ANALYTICS_ENABLED === true) {
    $('#analytics-name').textContent = p.name;
    $('#btn-analytics').href = `/archive/analytics?project=${encodeURIComponent(key)}`;
  } else $('#btn-analytics')?.remove();
  $('#btn-shortlisted').href = `/shortlist?project=${encodeURIComponent(key)}`;
  state.flags = loadFlags();
  updateFlagCount();
  renderWeights();
  $('#save-msg').textContent = '';
  const last = lsGet(`mybto:last:${key}`, null);
  if (last) restoreLast(last);
  showBlank();
}

// ---------------------------------------------------------------- importance meters
function selectedBlocks() { return $$('#f-blocks input:checked').map(i => i.value); }
// Flat types (as stored on units) covered by the chosen housing type.
function selectedTypes() {
  const h = $('#f-types input:checked')?.value;
  return h ? state.project.flat_types.filter(t => Scoring.housingOf(t) === h) : [];
}

function captureWeights() {
  $$('#weights input[type=range]').forEach(r => {
    const g = r.dataset.group, k = r.dataset.key;
    if (g === 'factor') state.weights[k] = Number(r.value);
    else (state.weights[g] = state.weights[g] || {})[k] = Number(r.value);
  });
}

const LEGEND_KEY = { sun: 'sun', design: 'design', facility: null, block: null };
const helpBtn = key => (key ? `<button type="button" class="help" data-legend="${key}" aria-label="What does this mean?">?</button>` : '');

function meter(group, key, label, help) {
  const v = group === 'factor' ? state.weights[key] ?? 0 : state.weights[group]?.[key] ?? 0;
  const id = `w-${group}-${key}`.replace(/[^a-z0-9-]/gi, '_');
  const lk = group === 'factor' ? key : LEGEND_KEY[group];
  return `<div class="meter"><label for="${id}" title="${esc(help || '')}">${esc(label)}${helpBtn(lk)}</label>
    <input id="${id}" type="range" min="-5" max="5" step="1" value="${esc(v)}" data-group="${group}" data-key="${esc(key)}">
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
  h += `<div class="meter-group"><span class="eyebrow"><span>Blocks</span></span>${blocks.length
    ? blocks.map(b => meter('block', b, `Block ${b}`)).join('') : '<p class="small muted">Select at least one block.</p>'}</div>`;
  const factorGroup = g => {
    const facs = g.keys.filter(k => av[k]);
    g.keys.filter(k => !av[k]).forEach(k => hidden.push(Scoring.FACTORS[k][0].toLowerCase()));
    return facs.length ? `<div class="meter-group"><span class="eyebrow"><span>${esc(g.title)}</span></span>${facs.map(k => meter('factor', k, Scoring.FACTORS[k][0], FACTOR_HELP[k])).join('')}</div>` : '';
  };
  const group = id => factorGroup(Scoring.GROUPS.find(g => g.id === id));
  if (av.sun.length) h += `<div class="meter-group"><span class="eyebrow"><span>Sun direction</span></span>${av.sun.map(d => meter('sun', d, d, 'The direction the living room windows face')).join('')}</div>`;
  const missingSun = Scoring.SUN_DIRECTIONS.filter(d => !av.sun.includes(d));
  if (missingSun.length && scope.length) hidden.push(`facing ${missingSun.join(', ')}`);
  h += group('wind');
  if (av.design.length) h += `<div class="meter-group"><span class="eyebrow"><span>Unit design · 2-Room Flexi</span></span>${av.design.map(d => meter('design', d, d)).join('')}</div>`;
  h += group('distance') + group('others');
  if (av.facilities.length) h += `<div class="meter-group"><span class="eyebrow"><span>Facilities nearby (within 30 m)${helpBtn('facilities')}</span></span>${av.facilities.map(f => meter('facility', f, f, facilityHelp(f))).join('')}</div>`;
  else if (scope.length) hidden.push('facilities');
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
  const w = { block: {}, sun: {}, design: {}, facility: {} };
  $$('#weights input[type=range]').forEach(r => {
    const v = Number(r.value);
    if (r.dataset.group === 'factor') w[r.dataset.key] = v; else w[r.dataset.group][r.dataset.key] = v;
  });
  return w;
}

function readFilters() {
  let min = Number($('#f-min').value), max = Number($('#f-max').value);
  if (min > max) [min, max] = [max, min];
  return { flatTypes: selectedTypes(), blocks: selectedBlocks(), minStorey: min, maxStorey: max };
}
const readPref = () => $('#f-pref input:checked').value;

// A returning visitor gets the filters and weights of their last ranking for this project (kept in this browser only).
function restoreLast(list) {
  const savedHousing = (list.flat_types || []).map(Scoring.housingOf);
  const radio = $$('#f-types input').find(i => savedHousing.includes(i.value));
  if (radio) radio.checked = true;
  $$('#f-blocks input').forEach(i => { i.checked = !list.blocks.length || list.blocks.includes(i.value); });
  if (list.min_storey != null) $('#f-min').value = list.min_storey;
  if (list.max_storey != null) $('#f-max').value = list.max_storey;
  // Floor priority is not restored: it always starts at Higher (set in loadProject), so an old choice cannot surprise anyone.
  state.weights = { ...list.weights };
  renderWeights();
  $('#save-msg').textContent = 'Your last settings for this project are filled in. Press Rank units to see the ranking.';
}

// ---------------------------------------------------------------- schedule
// Nothing is ranked until Rank units is pressed (and the ad and research notice have been seen).
function showBlank() {
  state.ranked = [];
  state.hasRanked = false;
  $('#result-count').innerHTML = '0<small>units</small>';
  $('#top-note').textContent = '';
  $('#after-rank').hidden = true;
  renderResults();
  renderFloorGroups();
}

// First press in a browser session: the ad pop-up with the research notice (public/js/ads.js). Later presses go straight through.
async function onRankClick() {
  const at = await window.MyBTOAds.interstitial();
  if (!at) return;
  state.consentedAt = at;
  runRank();
}

function runRank() {
  state.ranked = Scoring.rank(state.units, readFilters(), readWeights(), readPref());
  state.hasRanked = true;
  $('#result-count').innerHTML = `${state.ranked.length.toLocaleString()}<small>units</small>`;
  $('#top-note').textContent = state.ranked.length > SHOW_TOP ? `Showing the top ${SHOW_TOP}.` : '';
  $('#after-rank').hidden = false;
  if ($('#support')) $('#support').hidden = false;
  $('#save-msg').textContent = '';
  renderResults();
  renderFloorGroups();
  saveRanking();
  if (window.track) window.track('rank_units', { project: state.project.key, housing_type: selectedTypes().join(', '), units: state.ranked.length });
}

// Highest, middlemost and lowest storeys among the shown top units (SHOW_TOP), with every one of those units on them.
function renderFloorGroups() {
  const el = $('#floor-groups');
  if (!el) return;
  const g = Scoring.floorGroups(state.ranked.slice(0, SHOW_TOP));
  const card = (key, title) => {
    const ss = g.storeys[key], units = g[key];
    const label = ss.length ? `Storey ${ss.map(s => String(s).padStart(2, '0')).join(' and ')}` : '';
    return `<div class="fg-card"><div class="fg-head"><h3>${title}</h3><span>${label} · ${units.length} unit${units.length === 1 ? '' : 's'}</span></div>
      <ol class="fg-list">${units.map(u => `<li><span class="rk">${u.rank}</span><span class="u">Blk ${esc(u.block)} #${String(u.storey).padStart(2, '0')}-${esc(u.unit)}<small>${esc(u.flat_type.replace('2-Room Flexi', '2RF'))} · ${esc(u.facing)} facing${u.position === 'Corner' ? ' · corner' : ''}</small></span><span class="s ${u.score < 0 ? 'neg' : ''}">${u.score > 0 ? '+' : ''}${u.score.toFixed(1)}</span></li>`).join('')}</ol></div>`;
  };
  const blank = title => `<div class="fg-card blank"><div class="fg-head"><h3>${title}</h3><span>–</span></div><p class="small muted">–</p></div>`;
  el.hidden = false;
  el.innerHTML = state.ranked.length ? card('highest', 'Highest unit(s)') + card('middle', 'Middlemost unit(s)') + card('lowest', 'Lowest unit(s)')
    : blank('Highest unit(s)') + blank('Middlemost unit(s)') + blank('Lowest unit(s)');
}

const compass = d => `<span class="compass"><i style="transform:rotate(${BEARING[d] ?? 0}deg)" aria-hidden="true">↑</i>${esc(d)}</span>`;

const yes = '<span class="yn yes" aria-label="Yes">✓</span>', no = '<span class="yn no" aria-label="No">✗</span>';

// Under each unit: corner or corridor, near MRT, and a warning when the chute is within 10 m.
function tags(u) {
  const t = [`<span class="tag">${u.position === 'Corner' ? 'corner' : 'corridor'}</span>`];
  if (u.mrt_near) t.push('<span class="tag">near MRT</span>');
  if (u.chute_m != null && u.chute_m <= Scoring.CHUTE_FAR_M) t.push(`<span class="tag warn">chute within ${Scoring.CHUTE_FAR_M} m</span>`);
  return `<div class="tags">${t.join('')}</div>`;
}

function renderResults() {
  // One column per facility found among the matching units: ticked when it's in the block or within 30 m.
  const facs = Scoring.availability(state.ranked).facilities;
  const head = ['#', '', 'Unit', 'Score', 'Type · facing', `Chute<small>more than ${Scoring.CHUTE_FAR_M} m</small>`, 'MRT<small>within 100 m</small>', ...facs];
  $('#results thead').innerHTML = `<tr>${head.map((h, i) => `<th${i >= 7 ? ' class="fac"' : ''}>${h}</th>`).join('')}</tr>`;
  if (!state.ranked.length) {
    $('#results tbody').innerHTML = `<tr><td colspan="${head.length}"><div class="empty">${state.hasRanked ? 'No units match these filters.' : 'Set your filters and importance, then press Rank units.'}</div></td></tr>`;
    return;
  }
  const maxAbs = Math.max(1, ...state.ranked.map(u => Math.abs(u.score)));
  const shown = state.ranked.slice(0, SHOW_TOP);
  $('#results tbody').innerHTML = shown.map((u, i) => {
    const pct = Math.min(100, (Math.abs(u.score) / maxAbs) * 100);
    const firstNeg = u.score < 0 && (i === 0 || shown[i - 1].score >= 0);
    const near = new Set([...u.facilities_has, ...u.facilities_near]);
    return `<tr class="${[u.rank <= 3 && u.score >= 0 ? 'top3' : '', u.score < 0 ? 'neg-row' : '', firstNeg ? 'first-neg' : ''].join(' ').trim()}">
      <td class="rk">${u.rank}</td>
      <td><button class="star ${state.flags.includes(u.id) ? 'on' : ''}" data-id="${esc(u.id)}" aria-label="Shortlist ${esc(u.address)}" title="Add to shortlist">★</button></td>
      <td class="addr">#${String(u.storey).padStart(2, '0')}-${esc(u.unit)}<small>Blk ${esc(u.block)}</small>${tags(u)}</td>
      <td><span class="scorebar ${u.score < 0 ? 'neg' : ''}">${u.score > 0 ? '+' : ''}${u.score.toFixed(1)}<i><b style="width:${pct}%"></b></i></span></td>
      <td><span class="type">${esc(u.flat_type.replace('2-Room Flexi', '2RF'))}</span><div class="sub">${compass(u.facing)}</div></td>
      <td class="fac">${u.chute_m == null ? '–' : (u.chute_m > Scoring.CHUTE_FAR_M ? yes : no)}</td>
      <td class="fac">${u.mrt_near ? yes : no}</td>
      ${facs.map(f => `<td class="fac">${near.has(f) ? yes : no}</td>`).join('')}</tr>`;
  }).join('');
}

on('#results', 'click', e => {
  const b = e.target.closest('.star');
  if (!b) return;
  toggleFlag(b.dataset.id);
  b.classList.toggle('on', state.flags.includes(b.dataset.id));
});

// Settings are kept in this browser; the ranking itself goes to the Google Sheet (js/store.js) once the research notice was accepted.
function saveRanking() {
  const f = readFilters();
  const last = { flat_types: f.flatTypes, blocks: f.blocks, min_storey: f.minStorey, max_storey: f.maxStorey, floor_pref: readPref(), weights: readWeights() };
  lsSet(`mybto:last:${state.project.key}`, last);
  rememberRanking(f, last);
  if (!state.consentedAt) return;
  const row = {
    project: state.project.key, project_type: state.project.project_type, housing_type: $('#f-types input:checked')?.value || 'Any', blocks: f.blocks,
    min_storey: f.minStorey, max_storey: f.maxStorey, floor_pref: last.floor_pref, weights: last.weights,
    consent: true, consented_at: state.consentedAt, ranking: state.ranked.map(u => u.id),
  };
  // Pressing Rank again with nothing changed (or a double tap) would add an identical row to the Sheet: send only new rankings.
  const sig = hashText(JSON.stringify({ ...row, consented_at: undefined }));
  const sentKey = `mybto:sent:${state.project.key}`;
  if (lsGet(sentKey, null) === sig) return;
  lsSet(sentKey, sig);
  store.saveRanking(row);
}
function hashText(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return `${text.length}:${h >>> 0}`;
}

// The latest ranking per project (ordered ids, dense ranks, scores, a short description and the time) plus the one before it,
// so the shortlist page can show where each starred unit is now and where it was. Kept in this browser only.
function describeRanking(f, last) {
  const p = state.project;
  const housing = $('#f-types input:checked')?.value || 'Any';
  const blocks = f.blocks.length === p.blocks.length ? 'all blocks' : `${f.blocks.length} of ${p.blocks.length} blocks`;
  const pref = { higher: 'higher floors first', lower: 'lower floors first', none: 'no floor preference' }[last.floor_pref] || '';
  const set = Object.values(last.weights).flatMap(v => (typeof v === 'object' ? Object.values(v) : [v])).filter(v => v !== 0).length;
  return `${housing}, ${blocks}, storeys ${String(f.minStorey).padStart(2, '0')} to ${String(f.maxStorey).padStart(2, '0')}, ${pref}, ${set} factor${set === 1 ? '' : 's'} rated`;
}
function rememberRanking(f, last) {
  const key = `mybto:lastrank:${state.project.key}`;
  const old = lsGet(key, null);
  const cur = { at: new Date().toISOString(), desc: describeRanking(f, last), ids: state.ranked.map(u => u.id), ranks: state.ranked.map(u => u.rank), scores: state.ranked.map(u => +u.score.toFixed(2)) };
  const same = old && old.ids.join() === cur.ids.join() && old.scores.join() === cur.scores.join();
  const rec = same ? { ...old, at: cur.at, desc: cur.desc } : { ...cur, prev: old ? { at: old.at, desc: old.desc, ids: old.ids, ranks: old.ranks, scores: old.scores } : null };
  lsSet(key, rec);
}
const rankOf = (r, id) => { const i = r ? r.ids.indexOf(id) : -1; return i < 0 ? null : { rank: r.ranks[i], score: r.scores[i] }; };
const whenText = iso => { const d = new Date(iso); return Number.isNaN(+d) ? '' : d.toLocaleString('en-SG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };

// ---------------------------------------------------------------- shortlist
const loadFlags = () => lsGet(`flags:${state.project.key}`, []);
function persistFlags() {
  lsSet(`flags:${state.project.key}`, state.flags);
  updateFlagCount();
  store.saveShortlist(state.project.key, state.flags);
}
function toggleFlag(id) {
  if (window.track) window.track(state.flags.includes(id) ? 'shortlist_remove' : 'shortlist_add', { project: state.project.key });
  state.flags = state.flags.includes(id) ? state.flags.filter(x => x !== id) : [...state.flags, id];
  persistFlags();
}
function updateFlagCount() {
  if ($('#flag-count')) $('#flag-count').textContent = state.flags.length;
  try { localStorage.setItem('mybto:flagcount', String(state.flags.length)); } catch { /* storage unavailable */ }
}

// A shared link is /shortlist?project=<key>&units=<id,id,...>. It is shown read-only and never touches the visitor's own list
// unless they press Save. Unknown ids are ignored and at most MAX_SHARE units are used.
function readSharedLink() {
  const q = new URLSearchParams(location.search);
  state.shared = null;
  if (!q.has('units') || q.get('project') !== state.project.key) return;
  const known = new Set(state.units.map(u => u.id));
  const ids = [...new Set(q.get('units').split(',').map(x => x.trim()).filter(x => known.has(x)))].slice(0, MAX_SHARE);
  state.shared = { ids };
}

function shortlistUrl() {
  return `${location.origin}/shortlist?project=${encodeURIComponent(state.project.key)}&units=${state.flags.slice(0, MAX_SHARE).map(encodeURIComponent).join(',')}`;
}
function say(msg) { const el = $('#sl-msg'); if (el) el.textContent = msg; }

function renderShortlist() {
  const byId = new Map(state.units.map(u => [u.id, u]));
  const shared = !!state.shared;
  const list = $('#flag-list');
  const items = (shared ? state.shared.ids : state.flags).filter(id => byId.has(id));
  $('#shared-banner').hidden = !shared;
  $('#picker-row').hidden = shared;
  $('#sl-tools').hidden = shared || !items.length;
  if (shared) $('#shared-name').textContent = state.project.name;
  list.classList.toggle('readonly', shared);
  const cur = shared ? null : lsGet(`mybto:lastrank:${state.project.key}`, null);
  const note = $('#rank-note');
  note.textContent = cur ? `Rank and score are from your latest ranking (${cur.desc}, ${whenText(cur.at)}).${cur.prev ? ` The “was” number is from the one before (${cur.prev.desc}, ${whenText(cur.prev.at)}).` : ''}` : '';
  if (!items.length) {
    list.innerHTML = `<div class="empty">${shared ? 'This link has no units for this project.' : 'Nothing here yet. Tap the ★ next to a unit in your ranking to shortlist it.'}</div>`;
    return;
  }
  list.innerHTML = items.map((id, i) => {
    const u = byId.get(id), now = rankOf(cur, id), was = cur?.prev ? rankOf(cur.prev, id) : null;
    const rk = !cur ? '' : now ? ` · <span class="rk-now">Rank ${esc(String(now.rank))}${was && was.rank !== now.rank ? ` (was ${esc(String(was.rank))})` : ''} · score ${Number(now.score) > 0 ? "+" : ""}${Number(now.score).toFixed(1)}</span>` : ' · not in your latest ranking';
    return `<li${shared ? '' : ' draggable="true"'} data-id="${esc(id)}">
      <div><div class="addr">Blk ${esc(u.block)} #${String(u.storey).padStart(2, '0')}-${esc(u.unit)}</div>
        <div class="meta">${esc(u.flat_type)} · faces ${esc(u.facing)} · ${esc(u.position.toLowerCase())}${rk}</div></div>
      <div></div>
      ${shared ? '' : `<div class="ctrl"><button data-act="up" ${i === 0 ? 'disabled' : ''} aria-label="Move up">↑</button><button data-act="down" ${i === items.length - 1 ? 'disabled' : ''} aria-label="Move down">↓</button><button data-act="rm" aria-label="Remove">✕</button></div>`}</li>`;
  }).join('');
}

// Another tab changed the shortlist: pick it up, so every open page shows the same starred units.
window.addEventListener('storage', e => {
  if (!state.project || e.key !== `flags:${state.project.key}`) return;
  state.flags = loadFlags();
  updateFlagCount();
  if (PAGE === 'shortlist') renderShortlist();
  if (PAGE === 'rank') $$('#results .star').forEach(b => b.classList.toggle('on', state.flags.includes(b.dataset.id)));
});

on('#btn-clear', 'click', () => {
  if (!state.flags.length || !window.confirm(`Are you sure you want to clear your whole shortlist for ${state.project.name}?`)) return;
  state.flags = [];
  persistFlags();
  say('');
  renderShortlist();
});
on('#btn-share', 'click', async () => {
  const url = shortlistUrl();
  if (window.track) window.track('share_shortlist', { project: state.project.key, units: state.flags.length });
  if (navigator.share) {
    try { await navigator.share({ title: `${state.project.name} shortlist`, text: `My shortlist for ${state.project.name}`, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  let ok = false;
  try { await navigator.clipboard.writeText(url); ok = true; } catch { /* try the old way */ }
  if (!ok) {
    const t = document.createElement('textarea');
    t.value = url; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.append(t); t.select();
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
  }
  if (ok) say('Link copied');
  else window.prompt('Copy this link to share your shortlist', url);
});
on('#btn-back-mine', 'click', () => { location.href = `/shortlist?project=${encodeURIComponent(state.project.key)}`; });
on('#btn-save-shared', 'click', () => {
  if (!state.shared) return;
  const mine = loadFlags();
  if (mine.length && !window.confirm(`Replace your shortlist for ${state.project.name} with this shared one?`)) return;
  state.flags = [...state.shared.ids];
  persistFlags();
  state.shared = null; // stay on the page (no reload) so the Sheet send is not cut off
  history.replaceState(null, '', `/shortlist?project=${encodeURIComponent(state.project.key)}`);
  renderShortlist();
});
function moveFlag(from, to) {
  const f = [...state.flags];
  const [m] = f.splice(from, 1);
  f.splice(to, 0, m);
  state.flags = f;
  persistFlags();
  renderShortlist();
}
on('#flag-list', 'click', e => {
  if (state.shared) return;
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

// ---------------------------------------------------------------- analytics
// Analytics: one project (?project= or the last one used), read-only. A rewarded video comes first (public/js/ads.js).
async function openAnalytics() {
  const urlKey = new URLSearchParams(location.search).get('project');
  const key = state.index.projects.some(p => p.key === urlKey) ? urlKey : state.project.key;
  const proj = state.index.projects.find(p => p.key === key);
  lsSet('project', key);
  window.dispatchEvent(new CustomEvent('mybto:project', { detail: key }));
  document.title = `${proj.name} Analytics · MyBTO`;
  $('#analytics-name').textContent = proj.name;
  if (!(await window.MyBTOAds.rewarded(key))) { location.href = '/'; return; }
  await loadAnalytics(proj);
}

// Dashboard colours come from the site tokens in site.css :root (checked with the dataviz validator).
// Importance charts use pos/neg but never rely on colour: bars sit right/left of a zero line and carry signed labels.
const WATERMARK = 'mybto.web.app';
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const VIZ = { main: css('--accent-ink'), second: css('--accent'), pos: css('--pos'), neg: css('--neg'), neutral: css('--muted'),
  ink: css('--text'), mute: css('--text-2'), axis: css('--line-2') };
// Draws one faint "mybto.web.app" per chart canvas, in the free space nearest the centre of the plot (not over bars, areas or
// value labels, and not in a corner), so removing it means cropping the chart itself. It survives screenshots and saved images.
// The doughnut tile gets one copy in its hole. chart.$wmCount and chart.$wmBox are kept for the tests.
function watermarkOccupied(chart) {
  const ca = chart.chartArea, boxes = [], pad = 6, horiz = chart.options.indexAxis === 'y';
  const labels = (chart.config.plugins || []).some(p => p.id === 'mybtoValueLabels');
  chart.data.datasets.forEach((_, di) => {
    const meta = chart.getDatasetMeta(di);
    if (meta.hidden) return;
    const pts = meta.data;
    pts.forEach((el, i) => {
      if (meta.type === 'bar') {
        const e = el.getProps(['x', 'y', 'base', 'width', 'height'], true);
        let x0, x1, y0, y1;
        if (horiz) { x0 = Math.min(e.x, e.base); x1 = Math.max(e.x, e.base); y0 = e.y - e.height / 2; y1 = e.y + e.height / 2; if (labels) { if (e.x >= e.base) x1 += 44; else x0 -= 44; } }
        else { x0 = e.x - e.width / 2; x1 = e.x + e.width / 2; y0 = Math.min(e.y, e.base); y1 = Math.max(e.y, e.base); if (labels) y0 -= 20; }
        boxes.push({ x0: x0 - pad, x1: x1 + pad, y0: y0 - pad, y1: y1 + pad });
      } else if (meta.type === 'line') {
        const prev = pts[i - 1] || el, next = pts[i + 1] || el;
        const half = Math.max((next.x - prev.x) / 4, 2);
        boxes.push({ x0: el.x - half - pad, x1: el.x + half + pad, y0: el.y - pad, y1: ca.bottom });
      }
    });
  });
  return boxes;
}
if (window.Chart) {
  Chart.register({
    id: 'mybtoWatermark',
    beforeDatasetsDraw(chart) {
      const ca = chart.chartArea, ctx = chart.ctx;
      if (!ca) return;
      const w = ca.right - ca.left, h = ca.bottom - ca.top;
      const small = chart.config.type === 'doughnut' && chart.width < 220;
      ctx.save();
      ctx.fillStyle = VIZ.ink;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let box;
      if (small) {
        const el = chart.getDatasetMeta(0).data[0], e = el.getProps(['x', 'y', 'innerRadius'], true);
        let size = 8;
        ctx.font = `600 ${size}px Inter, sans-serif`;
        const tw = ctx.measureText(WATERMARK).width, maxW = e.innerRadius * 1.7;
        if (tw > maxW) { size = Math.max(5, Math.floor(size * maxW / tw)); ctx.font = `600 ${size}px Inter, sans-serif`; }
        const bw = ctx.measureText(WATERMARK).width;
        ctx.globalAlpha = 0.3;
        ctx.fillText(WATERMARK, e.x, e.y);
        box = { x: e.x - bw / 2, y: e.y - size * 0.6, w: bw, h: size * 1.2 };
      } else {
        const size = Math.max(11, Math.round(w * 0.045));
        ctx.font = `600 ${size}px Inter, sans-serif`;
        const bw = ctx.measureText(WATERMARK).width, bh = size * 1.2, m = 8;
        const occ = watermarkOccupied(chart);
        const overlap = (cx, cy) => {
          const x0 = cx - bw / 2, x1 = cx + bw / 2, y0 = cy - bh / 2, y1 = cy + bh / 2;
          let area = 0;
          for (const o of occ) { const ix = Math.min(x1, o.x1) - Math.max(x0, o.x0), iy = Math.min(y1, o.y1) - Math.max(y0, o.y0); if (ix > 0 && iy > 0) area += ix * iy; }
          return area;
        };
        const midX = ca.left + w / 2, midY = ca.top + h / 2;
        const minX = ca.left + m + bw / 2, maxX = ca.right - m - bw / 2, minY = ca.top + m + bh / 2, maxY = ca.bottom - m - bh / 2;
        let best = null;
        for (let gy = 0; gy < 12; gy++) for (let gx = 0; gx < 24; gx++) {
          const cx = minX + (maxX - minX) * (gx / 23), cy = minY + (maxY - minY) * (gy / 11);
          if (maxX < minX || maxY < minY) continue;
          const ov = overlap(cx, cy), d = Math.hypot((cx - midX) / w, (cy - midY) / h);
          if (!best || ov < best.ov || (ov === best.ov && d < best.d)) best = { cx, cy, ov, d };
        }
        if (!best) best = { cx: midX, cy: midY };
        ctx.globalAlpha = 0.12;
        ctx.fillText(WATERMARK, best.cx, best.cy);
        box = { x: best.cx - bw / 2, y: best.cy - bh / 2, w: bw, h: bh };
      }
      ctx.restore();
      chart.$wmCount = 1;
      chart.$wmBox = box;
    },
  });
}
// Signed value at the end of each horizontal bar (so positive and negative never rely on colour alone).
const barValueLabels = {
  id: 'mybtoValueLabels',
  afterDatasetsDraw(chart) {
    const meta = chart.getDatasetMeta(0), data = chart.data.datasets[0].data, ctx = chart.ctx, horiz = chart.options.indexAxis === 'y';
    ctx.save();
    ctx.fillStyle = VIZ.ink; ctx.font = '600 11px Inter, sans-serif';
    meta.data.forEach((el, i) => {
      const v = data[i];
      const txt = horiz ? `${v > 0 ? '+' : ''}${v}` : String(v);
      if (horiz) { ctx.textAlign = v >= 0 ? 'left' : 'right'; ctx.textBaseline = 'middle'; ctx.fillText(txt, el.x + (v >= 0 ? 5 : -5), el.y); }
      else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(txt, el.x, el.y - 4); }
    });
    ctx.restore();
  },
};
function wrapLabel(s, n = 24) {
  const out = []; let line = '';
  for (const w of String(s).split(' ')) {
    if (line && (line + ' ' + w).length > n) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
  }
  if (line) out.push(line);
  return out.length > 1 ? out : out[0];
}
function chart(id, config) {
  state.charts[id]?.destroy();
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = VIZ.mute;
  const o = config.options = config.options || {};
  o.animation = false; o.responsive = true; o.maintainAspectRatio = false;
  o.events = []; // not interactive: no hover, no tooltips
  o.plugins = Object.assign({ tooltip: { enabled: false } }, o.plugins);
  if (o.plugins.legend && o.plugins.legend.display !== false) o.plugins.legend.onClick = () => {};
  state.charts[id] = new Chart(document.getElementById(id), config);
}
const AXIS = { color: VIZ.axis, width: 1 };

// ---- Insight boxes: eight small facts in four pairs between the big charts. Small canvases skip the canvas watermark
// (the box carries the faint CSS one). A box whose data is missing (for example an older Sheet script without factor_shares)
// is skipped and the next idea takes its place; a pair with one box stays tidy.
const insLabels = fmt => ({
  id: 'mybtoInsLabels',
  afterDatasetsDraw(chart) {
    const meta = chart.getDatasetMeta(0), data = chart.data.datasets[0].data, ctx = chart.ctx;
    ctx.save(); ctx.fillStyle = VIZ.ink; ctx.font = '600 10px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    meta.data.forEach((el, i) => ctx.fillText(fmt(data[i]), el.x + 4, el.y));
    ctx.restore();
  },
});
const insChart = (id, config) => { config.options = config.options || {}; config.options.plugins = Object.assign({ legend: { display: false }, mybtoWatermark: false }, config.options.plugins); chart(id, config); };
// Phone: wrap bar names to fit the narrow label column, splitting a single long word with a hyphen.
const insBarLabel = t => {
  if (window.innerWidth >= 761) return t;
  const lines = [].concat(wrapLabel(t, 9));
  return lines.flatMap(l => (l.length > 9 ? [`${l.slice(0, Math.ceil(l.length / 2))}-`, l.slice(Math.ceil(l.length / 2))] : [l]));
};
const pctOf = (n, d) => (d ? Math.round(100 * n / d) : 0);

function insightBuilders(a, av) {
  const fs = a.factor_shares || {};
  const shareBox = (key, title, sub, vis) => () => {
    const sh = fs[key];
    if (!sh || !sh.n || av[key] === false) return null;
    return { title, fig: `${pctOf(sh.want, sh.n)}%`, sub: `of users ${sub}`, vis: vis || 'ring', want: sh.want, total: sh.n, sh };
  };
  const B = {
    chute: shareBox('chute', 'Ew! The smell', 'want to live 10 m away from the rubbish chute'),
    clearance: shareBox('clearance', 'Don\u2019t want to see your neighbours?', 'want a distance of 30 m from the nearest visible unit'),
    wind_facing: shareBox('wind_facing', 'Catch the breeze', 'want to face the prevailing wind (SE to E)'),
    wind_open: shareBox('wind_open', 'Room to breathe', 'want a unit not blocked from the wind'),
    mscp: shareBox('mscp', 'Car owners', 'want a multi-storey car park within 100 m'),
    mrt: shareBox('mrt', 'Train lovers', 'want to be within 100 m of an MRT'),
    roof: shareBox('roof', 'Sky high', 'want access to the roof'),
    corner: shareBox('corner', 'Corner seekers', 'want a corner unit', 'split'),
    sun() {
      const ss = a.sun_shares || {};
      const rows = ['NE', 'SE', 'SW', 'NW'].filter(d => ss[d] && ss[d].n).map(d => ({ k: d, v: pctOf(ss[d].want, ss[d].n) }));
      if (!rows.length) return null;
      const top = rows.reduce((m, r) => (r.v > m.v ? r : m), rows[0]);
      return { title: 'Sun chasers', fig: top.k, sub: `is the most wanted facing, ${top.v}% of users want it`, vis: 'bars', rows: rows.map(r => ({ label: r.k, v: r.v })), max: 100, fmt: v => `${v}%` };
    },
    block() {
      const rows = (a.blocks || []).filter(r => r.n).slice(0, 3);
      if (!rows.length) return null;
      return { title: 'Most wanted block', fig: `Block ${rows[0].key}`, long: true, sub: `average importance ${rows[0].mean > 0 ? '+' : ''}${rows[0].mean.toFixed(1)}`, vis: 'bars', rows: rows.map(r => ({ label: r.key, v: +r.mean.toFixed(1) })), max: 5, fmt: v => `${v > 0 ? '+' : ''}${v}` };
    },
    facility() {
      const rows = (a.facilities || []).filter(r => r.n).slice(0, 3);
      if (!rows.length) return null;
      return { title: 'The most popular facility is', fig: rows[0].key, long: true, sub: `average importance ${rows[0].mean > 0 ? '+' : ''}${rows[0].mean.toFixed(1)}`, vis: 'bars', rows: rows.map(r => ({ label: r.key, v: +r.mean.toFixed(1) })), max: 5, fmt: v => `${v > 0 ? '+' : ''}${v}` };
    },
  };
  return B;
}

async function renderInsights(a, proj) {
  let av = {};
  try { av = Scoring.availability(await api(`/data/units/${proj.key}.json`)); } catch { av = {}; }
  const B = insightBuilders(a, av);
  const fixed = [['sun'], ['wind_facing'], ['block'], ['clearance'], ['chute'], ['corner'], ['facility'], ['mscp', 'mrt']];
  const pool = ['roof', 'mrt', 'mscp', 'wind_open', 'chute', 'clearance', 'corner', 'wind_facing'];
  const used = new Set(), boxes = [];
  for (const cands of fixed) {
    let box = null;
    for (const id of [...cands, ...pool]) { if (used.has(id)) continue; const b = B[id] && B[id](); if (b) { box = b; used.add(id); break; } }
    boxes.push(box);
  }
  boxes.forEach((b, i) => {
    const pair = $(`#ins-${Math.floor(i / 4) + 1}`);
    if (!b) return;
    const el = document.createElement('div');
    el.className = 'ins';
    const cid = `c-ins-${i}`;
    const vis = b.vis === 'ring' ? `<div class="ins-ring"><canvas id="${cid}"></canvas></div>` : '';
    const under = b.vis === 'bars' ? `<div class="ins-bars"><canvas id="${cid}"></canvas></div>`
      : b.vis === 'split' ? `<div class="ins-split"><canvas id="${cid}"></canvas></div><p class="ins-key">Want ${pctOf(b.sh.want, b.sh.n)}% · Don’t mind ${pctOf(b.sh.neutral, b.sh.n)}% · Avoid ${pctOf(b.sh.avoid, b.sh.n)}%</p>` : '';
    el.innerHTML = `<div class="ins-title">${esc(b.title)}</div><div class="ins-main"><div class="ins-text"><b class="ins-fig${b.long ? ' long' : ''}">${esc(b.fig)}</b><span class="ins-sub">${esc(b.sub)}</span></div>${vis}</div>${under}`;
    pair.append(el);
  });
  boxes.forEach((b, i) => {
    if (!b) return;
    const id = `c-ins-${i}`;
    if (b.vis === 'ring') {
      insChart(id, { type: 'doughnut', data: { labels: ['Want', 'Others'], datasets: [{ data: [b.want, b.total - b.want], backgroundColor: [VIZ.main, VIZ.axis], borderWidth: 0 }] }, options: { cutout: '68%' } });
    } else if (b.vis === 'split') {
      const sh = b.sh;
      insChart(id, { type: 'bar', data: { labels: [''], datasets: [[sh.want, VIZ.pos], [sh.neutral, VIZ.neutral], [sh.avoid, VIZ.neg]].map(([v, c]) => ({ data: [v], backgroundColor: c, borderWidth: 1, borderColor: '#fff' })) },
        options: { indexAxis: 'y', layout: { padding: 0 }, scales: { x: { stacked: true, display: false }, y: { stacked: true, display: false } } } });
    } else if (b.vis === 'bars') {
      insChart(id, { type: 'bar', data: { labels: b.rows.map(r => insBarLabel(r.label)), datasets: [{ data: b.rows.map(r => r.v), backgroundColor: b.rows.map(r => (r.v >= 0 ? VIZ.main : VIZ.neg)), borderRadius: 3, barPercentage: .75, categoryPercentage: .9 }] },
        options: { indexAxis: 'y', layout: { padding: { right: window.innerWidth < 761 ? 28 : 34 } }, scales: { x: { display: false, min: b.max === 100 ? 0 : -5, max: b.max }, y: { grid: { display: false }, border: AXIS, ticks: { color: VIZ.ink, font: { size: window.innerWidth < 761 ? 9 : 11 }, autoSkip: false } } } },
        plugins: [insLabels(b.fmt)] });
    }
  });
}

async function loadAnalytics(proj) {
  $('#analysis-body').hidden = false;
  const a = await store.getAnalytics(proj.key);
  if (!a) { $('#a-basis').textContent = 'Analytics will appear here soon.'; return; }
  $('#a-basis').textContent = `Based on ${a.users} saved ${a.users === 1 ? 'ranking' : 'rankings'} for ${proj.name}.`;
  $('#analysis-body').classList.add('ready');

  // KPI tiles
  const pref = a.floor_preference || {};
  const prefTotal = (pref.higher || 0) + (pref.lower || 0) + (pref.none || 0);
  const pct = k => (prefTotal ? Math.round(100 * (pref[k] || 0) / prefTotal) : 0);
  const kpi = (id, num, sub) => { $(`#${id} .kpi-num`).textContent = num; $(`#${id} .kpi-sub`).textContent = sub; };
  kpi('k-rankings', String(a.users), `for ${proj.name}`);
  kpi('k-min', a.min_storey.count ? String(Math.round(a.min_storey.mean)) : '-', a.min_storey.n ? `out of ${a.min_storey.n} storeys` : '');
  kpi('k-max', a.max_storey.count ? String(Math.round(a.max_storey.mean)) : '-', a.max_storey.n ? `out of ${a.max_storey.n} storeys` : '');

  // Floor preference doughnut (tile) with a square-swatch legend
  const prefDefs = [['higher', 'Higher', VIZ.main], ['lower', 'Lower', VIZ.second], ['none', 'No preference', VIZ.neutral]];
  $('#pref-legend').innerHTML = prefDefs.map(([k, l, c]) => `<li><i style="background:${c}"></i>${l} <b>${pct(k)}%</b></li>`).join('');
  chart('c-pref', {
    type: 'doughnut',
    data: { labels: prefDefs.map(d => d[1]), datasets: [{ data: prefDefs.map(d => pref[d[0]] || 0), backgroundColor: prefDefs.map(d => d[2]), borderWidth: 2, borderColor: css('--card') }] },
    options: { cutout: '58%', plugins: { legend: { display: false } } },
  });

  // Lowest / highest storey: overlapping smooth areas
  const n = Math.max(a.min_storey.histogram.length, a.max_storey.histogram.length);
  // Gaussian kernel smoothing over storeys (bandwidth 2), as a share of rankings in %
  const smooth = d => {
    const h = d.histogram, tot = d.count || 1, bw = 2;
    return Array.from({ length: n }, (_, i) => {
      let v = 0;
      for (let j = 0; j < h.length; j++) v += (h[j] || 0) * Math.exp(-0.5 * ((i - j) / bw) ** 2);
      return +(100 * v / (tot * bw * Math.sqrt(2 * Math.PI))).toFixed(2);
    });
  };
  const area = (label, d, fill, line) => ({ label, data: smooth(d), fill: true, backgroundColor: fill, borderColor: line, borderWidth: 2, pointRadius: 0, tension: .4 });
  chart('c-storey', {
    type: 'line',
    data: { labels: Array.from({ length: n }, (_, i) => i), datasets: [
      area('Lowest storey accepted', a.min_storey, 'rgba(10,135,160,.55)', VIZ.main),
      area('Highest storey considered', a.max_storey, 'rgba(53,228,255,.55)', VIZ.main),
    ] },
    options: { plugins: { legend: { position: 'top', align: 'start', labels: { usePointStyle: true, pointStyle: 'rect', boxWidth: 10, boxHeight: 10, color: VIZ.ink } } },
      scales: {
        x: { grid: { display: false }, border: AXIS, title: { display: true, text: 'Storey' }, ticks: { maxTicksLimit: 10, maxRotation: 0 } },
        y: { beginAtZero: true, grid: { display: false }, border: AXIS, title: { display: true, text: 'Share of rankings' }, ticks: { callback: v => `${v}%` } },
      } },
  });

  // Diverging horizontal bars: right of the zero line = wanted, left = avoided
  const fl = Object.fromEntries(Object.entries(Scoring.FACTORS).map(([k, [l]]) => [k, l]));
  const hbar = (id, rows, label, cardId, plotId) => {
    if (!rows.length) {
      $(`#${cardId}`).classList.add('nocanvas');
      $(`#${cardId} .plot`).innerHTML = '<p class="muted nodata">No data yet.</p>';
      return;
    }
    if (plotId) $(`#${plotId}`).style.height = `${rows.length * 34 + 64}px`;
    chart(id, {
      type: 'bar',
      data: { labels: rows.map(r => wrapLabel(label(r.key))), datasets: [{ data: rows.map(r => +r.mean.toFixed(1)),
        backgroundColor: rows.map(r => (r.mean >= 0 ? VIZ.pos : VIZ.neg)), borderRadius: 3, barPercentage: .7, categoryPercentage: .85 }] },
      options: { indexAxis: 'y', layout: { padding: { right: 18 } }, plugins: { legend: { display: false } },
        scales: {
          x: { min: -5, max: 5, border: { display: false }, ticks: { stepSize: 5, callback: v => (v > 0 ? `+${v}` : v) },
            grid: { color: c => (c.tick.value === 0 ? VIZ.ink : 'transparent'), lineWidth: 1 },
            title: { display: true, text: 'Avoided  ←  average importance  →  Wanted' } },
          y: { grid: { display: false }, border: AXIS, ticks: { color: VIZ.ink, autoSkip: false } },
        } },
      plugins: [barValueLabels],
    });
  };
  hbar('c-sun', a.sun_directions, k => k, 'card-sun');
  hbar('c-block', a.blocks, k => `Block ${k}`, 'card-block', 'p-block');
  hbar('c-factor', a.factors, k => fl[k] || k, 'card-factor', 'p-factor');
  hbar('c-facility', (a.facilities || []).slice(0, 10), k => k, 'card-facility', 'p-facility');

  await renderInsights(a, proj);

  const types = Object.entries(a.flat_types || {});
  if (!types.length) { $('#card-types').classList.add('nocanvas'); $('#card-types .plot').innerHTML = '<p class="muted nodata">No data yet.</p>'; return; }
  chart('c-types', {
    type: 'bar',
    data: { labels: types.map(t => wrapLabel(t[0], 14)), datasets: [{ data: types.map(t => t[1]), backgroundColor: VIZ.main, borderRadius: 3, barPercentage: .6 }] },
    options: { layout: { padding: { top: 16 } }, plugins: { legend: { display: false } },
      scales: { x: { grid: { display: false }, border: AXIS, ticks: { color: VIZ.ink } },
        y: { beginAtZero: true, grid: { display: false }, border: AXIS, title: { display: true, text: 'Rankings' }, ticks: { precision: 0 } } } },
    plugins: [barValueLabels],
  });
}
// ---------------------------------------------------------------- legend (drawer on the Rank page)
function legendFigure(c) {
  return `<figure class="lg-fig"><img src="/img/legend/${c.img}" alt="${esc(c.alt)}" loading="lazy"></figure>`;
}
function renderLegend() {
  if (!$('#legend') || $('#legend').childElementCount) return;
  $('#legend').innerHTML = LEGEND.map((c, i) => `<article class="lg" id="lg-${c.key}">
    <h3>${esc(c.title)}</h3>${legendFigure(c)}<p>${esc(c.text)}</p><p class="rule-txt">Source: <a href="https://homes.hdb.gov.sg" target="_blank" rel="noopener">HDB sales brochure</a>${c.rule === 'scale' ? ', measured with its scale bar' : ''}.</p></article>`).join('');
}
function openLegend(key) {
  if (window.track) window.track('open_legend', { factor: String(key || '') });
  renderLegend();
  const d = $('#legend-drawer');
  if (!d) return;
  d.hidden = false;
  document.body.classList.add('drawer-open');
  requestAnimationFrame(() => d.classList.add('open'));
  const target = key ? document.getElementById('lg-' + String(key)) : null;
  if (target) target.scrollIntoView({ block: 'start' });
  else d.querySelector('.drawer-body').scrollTop = 0;
}
function closeLegend() {
  const d = $('#legend-drawer');
  if (!d) return;
  d.classList.remove('open');
  document.body.classList.remove('drawer-open');
  setTimeout(() => { d.hidden = true; }, 300);
}
document.addEventListener('click', e => {
  const h = e.target.closest('[data-legend]');
  if (h) { e.preventDefault(); openLegend(h.dataset.legend); }
  if (e.target.closest('[data-close-legend]')) closeLegend();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLegend(); });

init().catch(err => {
  console.error(err);
  ($('.tool .wrap') || document.body).insertAdjacentHTML('afterbegin', `<p class="err">Couldn’t load: ${esc(err.message)}</p>`);
});

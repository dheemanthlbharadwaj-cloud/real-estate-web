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
};
const FACILITY_HELP = 'In the unit’s block (has) or within 30 m of it (near).';
const FUTURE_FAC_HELP = 'Future amenities/facilities: void deck space HDB has set aside for things like preschools, eldercare or a residents’ network centre.';
const facilityHelp = name => (name === 'Future amenities/facilities' ? `${FUTURE_FAC_HELP} ${FACILITY_HELP}` : FACILITY_HELP);
const BEARING = { NE: 45, SE: 135, SW: 225, NW: 315 };
const SHOW_TOP = 50; // the full ranking is saved, only the top 50 are shown
const SURVEY_KEY = 'mybto:survey';
const SURVEY_VERSION = 2; // answers saved without v === 2 come from the old 4-question survey and are asked again
const SURVEY_TITLES = { age: 'Age', household: 'Living with', application: 'Application status', current_home: 'Living now', bto_attempts: 'BTO tries so far',
  work_area: 'Work or study area', car: 'Car', children_plan: 'Children in 5 years', income: 'Household income', queue_position: 'Queue position' };
const SURVEY_KEYS = Object.keys(SURVEY_TITLES);
const SURVEY_LABELS = {
  age: { '21-24': '21 to 24', '25-29': '25 to 29', '30-34': '30 to 34', '35-39': '35 to 39', '40-44': '40 to 44', '45-49': '45 to 49', '50-54': '50 to 54', '55-plus': '55 and above', 'prefer-not': 'Prefer not to say' },
  household: { partner: 'Partner or spouse', children: 'Children', parents: 'Parents', grandparents: 'Grandparents', siblings: 'Siblings', others: 'Others', alone: 'No one, I will live alone', 'prefer-not': 'Prefer not to say' },
  application: { 'single-first': 'Single applicant, first-timer', 'single-second': 'Single applicant, second-timer', 'couple-first': 'Couple, both first-timers', 'couple-second': 'Couple, both second-timers', 'couple-mixed': 'Couple, one first-timer and one second-timer', 'prefer-not': 'Prefer not to say' },
  current_home: { 'with-family': 'With family', rental: 'Rental flat', owned: 'Owned flat', others: 'Others', 'prefer-not': 'Prefer not to say' },
  bto_attempts: { never: 'Never', '1-2': '1 to 2 times', '3-5': '3 to 5 times', '6-plus': 'More than 5 times', 'prefer-not': 'Prefer not to say' },
  work_area: { central: 'Central', north: 'North', south: 'South', east: 'East', west: 'West', varies: 'Varies or works remotely', none: 'Not working or studying', 'prefer-not': 'Prefer not to say' },
  car: { yes: 'Yes', no: 'No', undecided: 'Undecided', 'prefer-not': 'Prefer not to say' },
  children_plan: { yes: 'Yes', no: 'No', already: 'Already have children', unsure: 'Unsure', 'prefer-not': 'Prefer not to say' },
  income: { '3000-below': '$3,000 and below', '3001-4500': '$3,001 to $4,500', '4501-6000': '$4,501 to $6,000', '6001-7500': '$6,001 to $7,500', '7501-9000': '$7,501 to $9,000', '9000-above': 'Above $9,000', 'prefer-not': 'Prefer not to say' },
  queue_position: { 'top-quarter': 'Top quarter of applicants', middle: 'Middle', 'bottom-quarter': 'Bottom quarter', none: 'Don’t have one or don’t know', 'prefer-not': 'Prefer not to say' },
};

const state = { index: null, project: null, units: [], ranked: [], hasRanked: false, user: null, flags: [], charts: {}, weights: {} };

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
  if (PAGE === 'rank' && new URLSearchParams(location.search).has('legend')) openLegend(new URLSearchParams(location.search).get('legend'));
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
  on('#btn-rank', 'click', onRankClick);
  $$('[data-blocks]').forEach(b => b.addEventListener('click', () => {
    $$('#f-blocks input').forEach(i => { i.checked = b.dataset.blocks === 'all'; });
    renderWeights();
  }));
  on('#f-types', 'change', renderWeights);
  on('#f-blocks', 'change', renderWeights);
  if (PAGE === 'rank' || PAGE === 'shortlist') await loadProject(key);
  else { state.project = state.index.projects.find(p => p.key === key); state.flags = await loadFlags(); }
  route();
}

async function loadProject(key) {
  state.project = state.index.projects.find(p => p.key === key);
  lsSet('project', key);
  state.units = await api(`/data/units/${key}.json`);
  const p = state.project;
  if (PAGE !== 'rank') {
    state.flags = await loadFlags();
    updateFlagCount();
    const list = await store.loadList(key).catch(() => null);
    state.ranked = list ? Scoring.rank(state.units, { flatTypes: list.flat_types, blocks: list.blocks, minStorey: list.min_storey, maxStorey: list.max_storey }, list.weights, list.floor_pref) : [];
    if (PAGE === 'shortlist') renderShortlist();
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
  $('#f-pref input[value=none]').checked = true;
  state.weights = {};
  $('#analysis-name').textContent = p.name;
  $('#btn-analysis').href = `/analysis?project=${encodeURIComponent(key)}`;
  $('#btn-shortlisted').href = `/shortlist?project=${encodeURIComponent(key)}`;
  state.flags = await loadFlags();
  updateFlagCount();
  renderWeights();
  $('#save-msg').textContent = '';
  const list = await store.loadList(key).catch(() => null);
  if (list) applySaved(list);
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
  h += `<div class="meter-group"><span class="eyebrow"><span>Blocks</span></span>${blocks.length
    ? blocks.map(b => meter('block', b, `Block ${b}`)).join('') : '<p class="small muted">Select at least one block.</p>'}</div>`;
  if (av.sun.length) h += `<div class="meter-group"><span class="eyebrow"><span>Sun direction</span></span>${av.sun.map(d => meter('sun', d, d, 'The direction the living room windows face')).join('')}</div>`;
  const missingSun = Scoring.SUN_DIRECTIONS.filter(d => !av.sun.includes(d));
  if (missingSun.length && scope.length) hidden.push(`facing ${missingSun.join(', ')}`);
  if (av.design.length) h += `<div class="meter-group"><span class="eyebrow"><span>Unit design · 2-Room Flexi</span></span>${av.design.map(d => meter('design', d, d)).join('')}</div>`;
  const facs = Object.entries(Scoring.FACTORS).filter(([k]) => av[k]);
  Object.entries(Scoring.FACTORS).filter(([k]) => !av[k]).forEach(([, [l]]) => hidden.push(l.toLowerCase()));
  if (facs.length) h += `<div class="meter-group"><span class="eyebrow"><span>Unit &amp; site</span></span>${facs.map(([k, [label]]) => meter('factor', k, label, FACTOR_HELP[k])).join('')}</div>`;
  if (av.facilities.length) h += `<div class="meter-group"><span class="eyebrow"><span>Facilities nearby${helpBtn('facilities')}</span></span>${av.facilities.map(f => meter('facility', f, f, facilityHelp(f))).join('')}</div>`;
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

function applySaved(list) {
  const savedHousing = (list.flat_types || []).map(Scoring.housingOf);
  const radio = $$('#f-types input').find(i => savedHousing.includes(i.value));
  if (radio) radio.checked = true;
  $$('#f-blocks input').forEach(i => { i.checked = !list.blocks.length || list.blocks.includes(i.value); });
  if (list.min_storey != null) $('#f-min').value = list.min_storey;
  if (list.max_storey != null) $('#f-max').value = list.max_storey;
  const pref = Scoring.FLOOR_PREFS.includes(list.floor_pref) ? list.floor_pref : 'none';
  $$('#f-pref input').forEach(i => { i.checked = i.value === pref; });
  state.weights = { ...list.weights };
  renderWeights();
  $('#save-msg').textContent = 'Your last settings for this project are filled in. Press Rank units to see the ranking.';
}

// ---------------------------------------------------------------- schedule
// Nothing is ranked until Rank units is pressed (and the survey is done).
function showBlank() {
  state.ranked = [];
  state.hasRanked = false;
  $('#result-count').innerHTML = '0<small>units</small>';
  $('#top-note').textContent = '';
  $('#after-rank').hidden = true;
  renderResults();
  renderFloorGroups();
}

function onRankClick() {
  if (surveyDone()) runRank();
  else openSurvey();
}

function runRank() {
  state.ranked = Scoring.rank(state.units, readFilters(), readWeights(), readPref());
  state.hasRanked = true;
  $('#result-count').innerHTML = `${state.ranked.length.toLocaleString()}<small>units</small>`;
  $('#top-note').textContent = state.ranked.length > SHOW_TOP ? `Showing the top ${SHOW_TOP}.` : '';
  $('#after-rank').hidden = false;
  $('#save-msg').textContent = '';
  renderResults();
  renderFloorGroups();
  saveRanking();
}

// Highest, middlemost and lowest storeys among the matching units, with every ranked unit on them.
function renderFloorGroups() {
  const el = $('#floor-groups');
  if (!el) return;
  const g = Scoring.floorGroups(state.ranked);
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
const nearFar = near => `<span class="nf ${near ? 'near' : 'far'}">${near ? 'Near' : 'Far'}</span>`;

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
      <td>${u.chute_m == null ? '–' : nearFar(u.chute_m <= Scoring.CHUTE_FAR_M)}</td>
      <td>${nearFar(u.mrt_near)}</td>
      ${facs.map(f => `<td class="fac">${near.has(f) ? yes : no}</td>`).join('')}</tr>`;
  }).join('');
}

on('#results', 'click', e => {
  const b = e.target.closest('.star');
  if (!b) return;
  toggleFlag(b.dataset.id);
  b.classList.toggle('on', state.flags.includes(b.dataset.id));
});

// Every ranking is saved (anonymously unless signed in) with the survey answers, so Analysis can use it.
async function saveRanking() {
  const survey = lsGet(SURVEY_KEY, null);
  if (!surveyDone()) return;
  const f = readFilters();
  try {
    await store.saveList(state.project.key, {
      project_type: state.project.project_type, flat_types: f.flatTypes, blocks: f.blocks,
      min_storey: f.minStorey, max_storey: f.maxStorey, floor_pref: readPref(), weights: readWeights(),
      survey: { ...Object.fromEntries(SURVEY_KEYS.map(k => [k, survey[k]])), consent: true, consented_at: survey.consented_at },
      ranking: state.ranked.map(u => u.id),
    });
  } catch (err) { console.warn('ranking not saved:', err.message); }
}

// ---------------------------------------------------------------- survey (once per browser)
function surveyDone() {
  const sv = lsGet(SURVEY_KEY, null);
  return !!(sv && sv.consent && sv.v === SURVEY_VERSION);
}
function openSurvey() {
  const m = $('#survey');
  if (!m) return;
  const prev = lsGet(SURVEY_KEY, null) || {};
  const form = $('#survey-form');
  for (const k of SURVEY_KEYS) $$(`#survey-form input[name=${k}]`).forEach(i => { i.checked = Array.isArray(prev[k]) ? prev[k].includes(i.value) : i.value === prev[k]; });
  $('#survey-err').textContent = '';
  m.hidden = false;
  document.body.classList.add('drawer-open');
  form.querySelector('input').focus();
}
function closeSurvey() {
  if (!$('#survey')) return;
  $('#survey').hidden = true;
  document.body.classList.remove('drawer-open');
}
// "No one, I will live alone" and "Prefer not to say" stand alone; any other choice clears them.
on('#survey-form', 'change', e => {
  const i = e.target;
  if (i.name !== 'household' || i.type !== 'checkbox' || !i.checked) return;
  const solo = ['alone', 'prefer-not'];
  $$('#survey-form input[name=household]').forEach(o => { if (o !== i && (solo.includes(i.value) || solo.includes(o.value))) o.checked = false; });
});
on('#survey-form', 'submit', e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const ans = {};
  for (const k of SURVEY_KEYS) ans[k] = k === 'household' ? fd.getAll(k) : fd.get(k);
  if (SURVEY_KEYS.some(k => k === 'household' ? !ans[k].length : !ans[k])) { $('#survey-err').textContent = 'Please answer every question.'; return; }
  lsSet(SURVEY_KEY, { v: SURVEY_VERSION, ...ans,
    consent: true, consented_at: new Date().toISOString() });
  closeSurvey();
  runRank();
});
document.addEventListener('click', e => {
  if (e.target.closest('[data-close-survey]')) closeSurvey();
  if (e.target.closest('#btn-edit-survey')) openSurvey();
});

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
  if (!items.length) { list.innerHTML = '<div class="empty">Nothing here yet. Tap the ★ next to a unit in your ranking to shortlist it.</div>'; return; }
  list.innerHTML = items.map((id, i) => {
    const u = byId[id], r = ranked[id];
    return `<li draggable="true" data-id="${esc(id)}">
      <div><div class="addr">Blk ${esc(u.block)} #${String(u.storey).padStart(2, '0')}-${esc(u.unit)}</div>
        <div class="meta">${esc(u.flat_type)} · faces ${esc(u.facing)} · ${esc(u.position.toLowerCase())}${r ? ` · rank ${r.rank} in your last ranking` : ''}</div></div>
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
  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.font.size = 12;
  Chart.defaults.color = css('--text-2');
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
  if (!surveyDone()) { locked.hidden = false; body.hidden = true; return; }
  locked.hidden = true; body.hidden = false;
  // Opened from a ranking: start on that project.
  const urlKey = new URLSearchParams(location.search).get('project');
  const fromUrl = state.index.projects.some(p => p.key === urlKey) ? urlKey : state.project?.key;
  if (!state.analysisInit && fromUrl) {
    $('#a-group').value = 'project';
    $('#a-value').innerHTML = state.index.projects.map(p => `<option value="${esc(p.key)}">${esc(p.name)}</option>`).join('');
    $('#a-value').value = fromUrl;
  }
  state.analysisInit = true;
  const group = $('#a-group').value;
  const sel = $('#a-value');
  const values = group === 'project' ? state.index.projects.map(p => [p.key, p.name])
    : group === 'project_type' ? ['Plus', 'Prime', 'Standard'].map(t => [t, t])
    : group === 'flat_type' ? state.index.housing_types.map(t => [t, t]) : [];
  $('#a-value-wrap').hidden = !values.length;
  if (values.length && !values.some(([v]) => v === sel.value)) sel.innerHTML = values.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('');
  let a;
  try {
    a = await api(`/api/analysis?${new URLSearchParams({ group, ...(values.length ? { value: sel.value } : {}) })}`,
      { headers: { Authorization: `Bearer ${await store.idToken()}` } });
  } catch (err) {
    $('#a-basis').textContent = /operation-not-allowed|admin-restricted/.test(err.code || err.message)
      ? 'Analysis isn’t switched on yet. Please check back soon.' : err.message;
    return;
  }
  const names = Object.fromEntries(state.index.projects.map(p => [p.key, p.name]));
  const projName = group === 'project' ? names[sel.value] : null;
  if (projName) document.title = `${projName} Analysis · MyBTO`;
  $('#a-basis').textContent = `Based on ${a.users} saved ${a.users === 1 ? 'ranking' : 'rankings'}`
    + (group === 'project' ? '.' : `: ${Object.entries(a.basis).map(([p, n]) => `${names[p] || p} ${n}`).join(' · ')}.`);
  if ($('#r-who')) $('#r-who').innerHTML = Object.entries(SURVEY_LABELS).map(([q, labels]) => {
    const counts = a.demographics?.[q] || {}, total = q === 'household' ? a.users : Object.values(counts).reduce((x, y) => x + y, 0); // household: several answers each, so percent of rankings
    const title = SURVEY_TITLES[q];
    return `<div><h4>${title}</h4><ol class="ranklist">${Object.entries(labels).map(([k, l]) => [l, counts[k] || 0]).sort((x, y) => y[1] - x[1])
      .map(([l, n]) => `<li><span></span><span>${esc(l)}</span><span>${total ? Math.round((n / total) * 100) : 0}%</span></li>`).join('')}</ol></div>`;
  }).join('');

  const ink = css('--accent'), signal = css('--neg'), green = css('--pos'), rule = css('--muted');
  const prefOrder = ['higher', 'lower', 'none'];
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
  const prefLabels = { higher: 'Higher', lower: 'Lower', none: 'No preference' };
  chart('c-pref', {
    type: 'doughnut',
    data: { labels: prefOrder.map(k => prefLabels[k]), datasets: [{ data: prefOrder.map(k => pref[k] || 0), backgroundColor: [ink, signal, rule], borderWidth: 0 }] },
    options: { animation: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } } },
  });
  ranklist('#r-facility', a.facilities || []);
  chart('c-types', {
    type: 'bar',
    data: { labels: Object.keys(a.flat_types), datasets: [{ label: 'Lists', data: Object.values(a.flat_types), backgroundColor: ink }] },
    options: { animation: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { beginAtZero: true } } },
  });
  $('#r-flagged').innerHTML = a.most_flagged.length ? a.most_flagged.slice(0, 10).map((f, i) => {
    const [, block, storey, unit] = f.unit_id.split('-');
    return `<li><span>${String(i + 1).padStart(2, '0')}</span><span>Blk ${esc(block)} #${esc(storey)}-${esc(unit)}</span><span>${f.count}×</span></li>`;
  }).join('') : '<li><span></span><span class="muted">No flags yet</span><span></span></li>';
}
on('#a-group', 'change', loadAnalysis);
on('#a-value', 'change', loadAnalysis);

// ---------------------------------------------------------------- legend (drawer on the Rank page)
function legendFigure(c) {
  return `<figure class="lg-fig"><img src="/img/legend/${c.img}" alt="${esc(c.alt)}" loading="lazy"></figure>`;
}
function renderLegend() {
  if (!$('#legend') || $('#legend').childElementCount) return;
  $('#legend').innerHTML = LEGEND.map((c, i) => `<article class="lg" id="lg-${c.key}">
    <h3>${esc(c.title)}</h3>${legendFigure(c)}<p>${esc(c.text)}</p><p class="rule-txt">${esc(c.rule)}</p></article>`).join('');
}
function openLegend(key) {
  renderLegend();
  const d = $('#legend-drawer');
  if (!d) return;
  d.hidden = false;
  document.body.classList.add('drawer-open');
  requestAnimationFrame(() => d.classList.add('open'));
  const target = key && $(`#lg-${key}`);
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

// ---------------------------------------------------------------- account
function renderAccount() {
  if (PAGE !== 'account') return;
  $('#acct-in').hidden = !state.user;
  $('#acct-out').hidden = !!state.user;
  $('#auth-error').hidden = !state.authError;
  $('#auth-error').textContent = state.authError || '';
  if (state.user) $('#acct-email').textContent = state.user.email;
}
function note(msg) { if (!$('#acct-note')) return; $('#acct-note').hidden = !msg; $('#acct-note').textContent = msg || ''; }

// Called by Firebase whenever the signed-in user changes (sign in / out in this or another tab).
async function onAuthChange(user) {
  const was = state.user?.uid;
  state.user = user;
  renderAccount();
  if (!state.project) return;
  if (user && user.uid !== was) {
    // Merge flags made while signed out into the account.
    const local = lsGet(`flags:${state.project.key}`, []);
    const remote = await store.loadFlags(state.project.key).catch(() => []);
    state.flags = [...new Set([...remote, ...local])];
    await persistFlags();
    const list = await store.loadList(state.project.key).catch(() => null);
    if (list && PAGE === 'rank' && !state.hasRanked) applySaved(list);
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
    note('');
  } catch (ex) { err.textContent = ex.message; }
});
on('#btn-forgot', 'click', async () => {
  const email = $('#form-login [name=email]').value.trim();
  const err = $('#form-login .err');
  if (!email) { err.textContent = 'Type your email above first.'; return; }
  try { await store.resetPassword(email); err.textContent = `Password reset email sent to ${email}.`; } catch (ex) { err.textContent = ex.message; }
});
$$('[data-google]').forEach(b => b.addEventListener('click', async () => {
  const err = b.closest('form').querySelector('.err');
  err.textContent = '';
  try { await store.loginWithGoogle(); note(''); } catch (ex) { err.textContent = ex.message; }
}));
on('#btn-logout', 'click', () => store.logout());

init().catch(err => {
  console.error(err);
  ($('.tool .wrap') || document.body).insertAdjacentHTML('afterbegin', `<p class="err">Couldn’t load: ${esc(err.message)}</p>`);
});

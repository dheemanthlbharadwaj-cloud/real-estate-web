// MyBTO backend: a Google Sheet plus this Apps Script web app. Free, no server.
// Files in this project: Code.gs (this file), Analytics.gs (paste apps-script/Analytics.js here), appsscript.json.
// Read apps-script/README.md for the setup steps.
//
// doPost: the browser sends JSON as text/plain (a "simple" request, so no CORS preflight).
//   {type:'ranking', ...}   adds a row to the sheet "Rankings"
//   {type:'shortlist', ...} adds or replaces the one row for that user + project in "Shortlists"
// doGet:  ?action=analytics&project=<key> returns the combined results for the Analytics page.
// Unit ids are never returned. Sheet names and limits are set below and in Analytics.js.

const RANKINGS = 'Rankings';
const SHORTLISTS = 'Shortlists';
const SAMPLE = 'Sample';
const SETTINGS = 'Settings';
const SAMPLE_URL = 'https://mybto.web.app/data/sample_submissions.json';
// Safety caps on sheet size (a Google Sheet holds 10 million cells; a ranking row is about 30). These are a last resort:
// the hourly ceilings below are the real flood control, so a burst of junk can never lock the site out for good.
// If a cap is ever reached, archive or delete old rows in the sheet and writes resume at once.
const MAX_RANKING_ROWS = 200000;
const MAX_SHORTLIST_ROWS = 100000;
// Rate limits (CacheService, shared by all visitors). A throttled write answers {ok:false,error:'slow down'}; the website
// sends with no-cors and ignores the answer, so a throttled visitor sees nothing different.
const USER_GAP_SECONDS = { ranking: 5, shortlist: 2 }; // at most one write per user per type in this many seconds
const HOURLY_CEILING = { ranking: 2000, shortlist: 5000 }; // writes accepted per clock hour across all users
const CACHE_SECONDS = 300;

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (headers && sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

// Run once from the editor (see README). Creates the sheets with their header rows.
function setup() {
  sheet_(RANKINGS, RANKING_COLUMNS);
  sheet_(SHORTLISTS, SHORTLIST_COLUMNS);
  sheet_(SAMPLE, RANKING_COLUMNS);
  const st = sheet_(SETTINGS);
  if (st.getLastRow() === 0) {
    st.getRange('A1:C1').setValues([['INCLUDE_SAMPLE', true, 'TRUE adds the sample users to the Analytics page. Set to FALSE once real rankings come in.']]);
  }
  const first = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1');
  if (first && first.getLastRow() === 0) SpreadsheetApp.getActiveSpreadsheet().deleteSheet(first);
  Logger.log('Sheets ready: ' + [RANKINGS, SHORTLISTS, SAMPLE, SETTINGS].join(', '));
}

// Run once from the editor. Downloads the sample users from the website and writes them to the "Sample" sheet.
function importSample() {
  const res = UrlFetchApp.fetch(SAMPLE_URL, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Could not download ' + SAMPLE_URL + ' (HTTP ' + res.getResponseCode() + '). Is the website deployed?');
  const subs = JSON.parse(res.getContentText()).submissions;
  const now = new Date().toISOString();
  const rows = [];
  subs.forEach(function (s) {
    const r = sampleToRow(s, now);
    if (r.ok) rows.push(RANKING_COLUMNS.map(function (c) { return r.row[c] === undefined ? '' : r.row[c]; }));
  });
  const sh = sheet_(SAMPLE, RANKING_COLUMNS);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, RANKING_COLUMNS.length).setValues(rows);
  CacheService.getScriptCache().removeAll(subs.map(function (s) { return 'an:' + s.project; }));
  Logger.log('Imported ' + rows.length + ' sample users.');
}

function doPost(e) {
  const text = e && e.postData ? e.postData.contents : '';
  if (text && Utilities.newBlob(text).getBytes().length > MAX_BODY_BYTES) return json_({ ok: false, error: 'body too large' }); // bytes, not characters
  const parsed = parseSubmission(text, new Date().toISOString());
  if (!parsed.ok) return json_({ ok: false, error: parsed.error });
  const cache = CacheService.getScriptCache();
  const type = parsed.kind;
  // per-user throttle: the first write in the window sets the marker, later ones are refused
  const userKey = 'rl:' + type + ':' + parsed.row.user;
  if (cache.get(userKey)) return json_({ ok: false, error: 'slow down' });
  cache.put(userKey, '1', Math.max(1, USER_GAP_SECONDS[type]));
  const lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (err) { return json_({ ok: false, error: 'busy, try again' }); }
  try {
    // global hourly ceiling, counted inside the lock so concurrent requests cannot overshoot it
    const hourKey = 'hr:' + type + ':' + Math.floor(Date.now() / 3600000);
    const used = Number(cache.get(hourKey)) || 0;
    if (used >= HOURLY_CEILING[type]) return json_({ ok: false, error: 'slow down' });
    cache.put(hourKey, String(used + 1), 3700);
    if (parsed.kind === 'ranking') {
      const sh = sheet_(RANKINGS, RANKING_COLUMNS);
      if (sh.getLastRow() >= MAX_RANKING_ROWS) return json_({ ok: false, error: 'full' });
      sh.appendRow(RANKING_COLUMNS.map(function (c) { return parsed.row[c] === undefined ? '' : parsed.row[c]; }));
    } else {
      const sh = sheet_(SHORTLISTS, SHORTLIST_COLUMNS);
      const last = sh.getLastRow();
      const values = last > 1 ? sh.getRange(2, 1, last - 1, 2).getValues() : [];
      let at = 0;
      for (let i = 0; i < values.length; i++) { if (values[i][0] === parsed.row.user && values[i][1] === parsed.row.project) { at = i + 2; break; } }
      const out = SHORTLIST_COLUMNS.map(function (c) { return parsed.row[c]; });
      if (at) sh.getRange(at, 1, 1, out.length).setValues([out]);
      else if (last >= MAX_SHORTLIST_ROWS) return json_({ ok: false, error: 'full' });
      else sh.appendRow(out);
    }
    return json_({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

// Reads only the columns Analytics needs (not top50 / full_ranking) and only the rows of one project.
function readRows_(name, project) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getRange(1, 1, sh.getLastRow(), ANALYTICS_COLUMNS.length).getValues();
  const head = values[0];
  const pi = head.indexOf('project');
  const out = [];
  for (let r = 1; r < values.length; r++) {
    const v = values[r];
    if (v[pi] !== project) continue;
    const o = {};
    head.forEach(function (h, i) { o[h] = v[i]; });
    out.push(o);
  }
  return out;
}

function includeSample_() {
  const st = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SETTINGS);
  if (!st) return false;
  const v = st.getRange('B1').getValue();
  return v === true || String(v).toUpperCase() === 'TRUE';
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action !== 'analytics') return json_({ ok: false, error: 'unknown action' });
  if (typeof p.project !== 'string' || PROJECT_KEYS.indexOf(p.project) < 0) return json_({ ok: false, error: 'bad project' });
  const key = 'an:' + p.project;
  const cache = CacheService.getScriptCache();
  const hit = cache.get(key);
  if (hit) return ContentService.createTextOutput(hit).setMimeType(ContentService.MimeType.JSON);
  const result = analyseProject(readRows_(RANKINGS, p.project), includeSample_() ? readRows_(SAMPLE, p.project) : [], p.project);
  const out = JSON.stringify(result);
  try { cache.put(key, out, CACHE_SECONDS); } catch (err) { /* too big to cache: skip */ }
  return ContentService.createTextOutput(out).setMimeType(ContentService.MimeType.JSON);
}

// Browser test of the full flow with Firebase stubbed (run: node test/e2e.browser.js; needs Playwright).
// Starts the dev server in fake-Firebase mode and routes the Firebase CDN modules to test/fake-firebase/.
const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));
const ExcelJS = require('exceljs');

const SHOTS = process.env.SHOTS_DIR;
const PORT = 3123;
const base = `http://localhost:${PORT}`;
const check = (cond, msg) => { if (!cond) { throw new Error(`FAIL: ${msg}`); } console.log(`ok - ${msg}`); };

(async () => {
  const server = spawn('node', ['dev.js'], { env: { ...process.env, DEV_FAKE_FIREBASE: '1', PORT: String(PORT) }, stdio: 'inherit' });
  await new Promise(r => setTimeout(r, 1200));
  const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await ctx.addInitScript(() => { window.MYBTO_AD_SECONDS = { rewarded: 2 }; }); // the 5 s Rank pop-up stays real; the 15 s video is shortened
    await ctx.route(/gstatic\.com\/firebasejs\/.*\/(firebase-[a-z]+\.js)$/, (route) => {
      const name = route.request().url().split('/').pop();
      route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(__dirname, 'fake-firebase', name), 'utf8') });
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    const rows = () => p.$$eval('#results tbody tr', r => r.filter(x => x.querySelector('.rk')).length);
    await p.goto(`${base}/rank`);
    await p.waitForSelector('#floor-groups .fg-card');
    check((await p.textContent('#result-count')).startsWith('0') && (await rows()) === 0, 'nothing ranked before pressing Rank units');
    check((await p.$$eval('#floor-groups .fg-card.blank', c => c.length)) === 3, 'highest, middlemost and lowest are blank before ranking');
    check(await p.isHidden('#after-rank'), 'Shortlisted and Analytics buttons hidden before ranking');
    check(!(await p.$('#btn-csv')) && !(await p.$('#btn-save')) && !(await p.$('#queue')), 'no CSV, Save list or queue box on the page');
    check(!(await p.$('.site-header .nav')) && !(await p.$('.menu-btn')), 'header has no menu button');
    await p.waitForFunction(() => document.querySelector('#tab-analytics-name').textContent === 'Kebun Baru Breeze');
    check((await p.$$eval('.site-header .tab', t => t.map(x => x.textContent.trim()))).join() === 'Rank units,Kebun Baru Breeze Analytics', 'header tabs: Rank units and the project Analytics');
    check((await p.getAttribute('#tab-rank', 'aria-current')) === 'page' && !(await p.getAttribute('#tab-analytics', 'aria-current')), 'Rank units tab is marked active');

    await p.click('#btn-rank');
    await p.waitForSelector('.ad-panel');
    check((await p.textContent('.ad-panel .ad-tag')) === 'Advertisement' && (await p.$$eval('.ad-panel iframe, .ad-panel script', n => n.length)) === 0, 'first Rank click opens the ad pop-up (placeholder, no iframe or ad script)');
    check((await p.isDisabled('[data-ad-go]')) && /^Show my ranking in \d/.test(await p.textContent('[data-ad-go]')), 'Show my ranking is disabled during the countdown');
    check((await p.textContent('.ad-panel .consent')).includes('21 or older') && (await p.$$eval('.ad-panel .consent a[href^="mailto:"]', a => a.length)) === 2, 'research notice with two mailto links under the ad');
    check(!(await p.$('#survey')) && !(await p.$('#btn-edit-survey')) && !(await p.$('.ad-panel input')), 'no survey questions and no Edit survey link');
    await p.click('[data-ad-cancel]');
    check(!(await p.$('.ad-panel')) && (await rows()) === 0, 'Not now closes the pop-up and ranks nothing');
    await p.click('#btn-rank');
    await p.waitForSelector('[data-ad-go][disabled]');
    await p.waitForSelector('[data-ad-go]:not([disabled])', { timeout: 8000 });
    check((await p.textContent('[data-ad-go]')) === 'Show my ranking', 'button turns on after the 5 second countdown');
    await p.click('[data-ad-go]');
    await p.waitForSelector('#results tbody .rk');
    check(Number((await p.textContent('#result-count')).replace(/\D/g, '')) > 0, 'ranking loads after agreeing');
    check((await rows()) === 50, 'only the top 50 units are shown');
    check(await p.isVisible('#after-rank'), 'Shortlisted and Analytics buttons appear after ranking');
    const head = await p.$$eval('#results thead th', h => h.map(x => x.childNodes[0]?.textContent || ''));
    check(head.slice(0, 7).join('|') === '#||Unit|Score|Type · facing|Chute|MRT' && head.length > 7, `chute, MRT and one column per facility (${head.length - 7} facilities)`);
    check((await p.$$eval('#results tbody tr td:nth-child(6) .nf', n => n.every(x => /^(Near|Far)$/.test(x.textContent)))), 'chute shows near or far');
    check((await p.$$eval('#results tbody td.fac', n => n.every(x => /^[✓✗]$/.test(x.textContent.trim())))), 'facility columns are ticks and crosses');
    const tagText = await p.$$eval('#results .tags .tag', t => [...new Set(t.map(x => x.textContent.replace(/\d+/, 'N')))]);
    check(tagText.every(t => ['corner', 'corridor', 'near MRT', 'chute within N m'].includes(t)), `only corner/corridor, MRT and chute tags (${tagText.join(', ')})`);
    const saved = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fs:submissions/')).map(k => JSON.parse(localStorage.getItem(k))));
    check(saved.length === 1 && saved[0].survey.consent === true && Object.keys(saved[0].survey).sort().join() === 'consent,consented_at' && saved[0].ranking.length > 50, `ranking saved with consent only and every unit (${saved[0]?.ranking.length})`);

    await p.selectOption('#project', 'berlayar-rise-7');
    await p.waitForFunction(() => document.querySelector('#result-count').textContent.startsWith('0'));
    check(true, 'changing project clears the ranking');
    check((await p.$$eval('#f-types input', i => i.map(x => x.type + ':' + x.value))).join() === 'radio:2-Room Flexi,radio:3-Room,radio:4-Room', 'one housing type at a time, 2-Room Flexi as one choice');
    check((await p.textContent('#analytics-name')) === 'Berlayar Rise', 'Analytics button names the project');
    await p.waitForFunction(() => document.querySelector('#tab-analytics').textContent.trim() === 'Berlayar Rise Analytics');
    check((await p.getAttribute('#tab-analytics', 'href')) === '/analytics?project=berlayar-rise-7', 'Analytics tab follows the selected project live');
    await p.click('#btn-rank');
    await p.waitForFunction(() => document.querySelector('#result-count').textContent.startsWith('988'));
    check(!(await p.$('.ad-panel')), 'ad pop-up only on the first Rank click of the session');
    check((await p.$$eval('#results tbody .rk', r => r.map(x => x.textContent))).every(x => x === '1'), 'all importances 0: every unit ranks 1');
    check((await p.$$eval('#floor-groups h3', h => h.map(x => x.textContent))).join() === 'Highest unit(s),Middlemost unit(s),Lowest unit(s)', 'highest, middlemost and lowest units shown');
    await p.click('#f-pref label:has-text("Higher")');
    await p.click('#btn-rank');
    const ranks = [...new Set(await p.$$eval('#results tbody .rk', r => r.map(x => Number(x.textContent))))];
    check(ranks[0] === 1 && ranks.every((r, i) => r === i + 1), `ranks go 1, 2, 3 with no gaps (${ranks.slice(0, 4)})`);
    await p.click('#f-pref label:has-text("No preference")');
    await p.$eval('#weights input[data-group=factor][data-key=corner]', r => { r.value = '-3'; r.dispatchEvent(new Event('input')); });
    await p.$eval('#f-min', s => { s.value = s.options[s.options.length - 1].value; });
    await p.click('#btn-rank');
    check((await p.$$eval('#results tr.first-neg', r => r.length)) === 1 && (await p.$$eval('#results tr.neg-row', r => r.length)) > 0, 'line and shading between plus and minus scores');
    await p.$eval('#f-min', s => { s.value = s.options[0].value; });
    await p.click('#f-types label:has-text("2-Room Flexi")');
    await p.click('#btn-rank');
    await p.waitForFunction(() => document.querySelector('#result-count').textContent.startsWith('816'));
    check(true, '2-Room Flexi covers Type 1 and Type 2 (816 units)');
    const fac = await p.$$eval('#weights .meter-group', g => g.filter(x => /Facilities nearby/.test(x.textContent)).map(x => x.querySelectorAll('.meter').length));
    check(fac.length === 1 && fac[0] > 1, `one meter per facility type (${fac[0]})`);
    await p.selectOption('#project', 'sembawang-brook-6');
    await p.waitForFunction(() => document.querySelector('#result-count').textContent.startsWith('0'));
    const brookMeters = await p.$$eval('#weights .meter label', m => m.map(x => x.childNodes[0].textContent));
    check(brookMeters.includes('Future amenities/facilities') && brookMeters.includes('Mini-mart'), 'Sembawang Brook shows Future amenities/facilities and Mini-mart meters (from the brochure)');
    await p.click('#btn-rank');
    await p.waitForSelector('#results tbody .rk');
    check((await p.$$eval('#results thead th', h => h.map(x => x.childNodes[0]?.textContent || ''))).includes('Future amenities/facilities'), 'Future amenities/facilities has a tick column');
    await p.selectOption('#project', 'berlayar-rise-7');
    await p.waitForFunction(() => document.querySelector('#result-count').textContent.startsWith('0'));
    await p.click('#f-types label:has-text("2-Room Flexi")');
    await p.click('[data-blocks=none]');
    await p.click('#f-blocks label:has-text("200B")');
    const meters = await p.$$eval('#weights .meter label', m => m.map(x => x.textContent));
    check(meters.includes('Block 200B') && !meters.includes('Block 200A'), 'only selected blocks get a meter');
    check(!meters.some(m => m.startsWith('Type 1')) && meters.some(m => m.startsWith('Type 2')), '2RF Type 1 meter hidden when block 200B has none');
    await p.click('#btn-rank');
    check(await p.$$eval('#results tbody .addr small', s => s.every(x => x.textContent === 'Blk 200B')), 'block filter applied');

    await p.click('.star >> nth=0'); await p.click('.star >> nth=1'); await p.click('.star >> nth=2');
    check((await p.textContent('#flag-count')) === '3', 'Shortlisted button counts three starred units');
    check((await p.getAttribute('#btn-shortlisted', 'target')) === '_blank' && (await p.getAttribute('#btn-analytics', 'target')) === '_blank', 'Shortlisted and Analytics open in a new tab');
    const [sl] = await Promise.all([ctx.waitForEvent('page'), p.click('#btn-shortlisted')]);
    await sl.waitForSelector('#flag-list li .addr');
    const first = await sl.textContent('#flag-list li:nth-child(1) .addr');
    await sl.click('#flag-list li:nth-child(2) [data-act=up]');
    check((await sl.textContent('#flag-list li:nth-child(2) .addr')) === first, 'shortlist reorders');
    await sl.close();
    const [an] = await Promise.all([ctx.waitForEvent('page'), p.click('#btn-analytics')]);
    await an.waitForSelector('.ad-panel');
    check((await an.isHidden('#analysis-body')) && (await an.isDisabled('[data-ad-go]')) && /^Continue in \d/.test(await an.textContent('[data-ad-go]')), 'Analytics shows the rewarded video gate with a countdown before any content');
    check((await an.textContent('.ad-panel .ad-tag')) === 'Advertisement', 'rewarded video placeholder is labelled Advertisement');
    await an.waitForSelector('[data-ad-go]:not([disabled])', { timeout: 8000 });
    await an.click('[data-ad-go]');
    await an.waitForSelector('#analysis-body:not([hidden])');
    await an.waitForFunction(() => /Based on/.test(document.querySelector('#a-basis').textContent));
    check((await an.title()).startsWith('Berlayar Rise Analytics') && (await an.textContent('h1')).includes('want'), 'Analytics opens on the ranked project');
    check((await an.$$eval('#r-sun li', l => l.length)) === 4, 'analytics shows the 4 sun directions');
    check((await an.$$eval('#analysis-body select, #analysis-body input, #analysis-body button', n => n.length)) === 0 && !(await an.$('#a-group')), 'analytics has no filters or controls');
    const anText = await an.evaluate(() => document.body.innerText);
    check(!/[A-Z]{2}-\d{3}[A-Z]?-\d{2}-\d{3}/.test(anText) && !/Most shortlisted|Who ranked|Analysis/.test(anText), 'analytics page shows no unit ids, no shortlist list, no Who ranked');
    const apiJson = await an.evaluate(async () => { const r = await fetch('/api/analysis?group=project&value=berlayar-rise-7', { headers: { Authorization: 'Bearer fake-x' } }); return r.json(); });
    check(!('most_flagged' in apiJson) && !('demographics' in apiJson) && apiJson.users > 0, 'API response has no most_flagged or demographics');
    await an.reload();
    await an.waitForSelector('#analysis-body:not([hidden])');
    check(!(await an.$('.ad-panel')), 'unlock is remembered for the browser session');
    await an.close();
    const redirectOk = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8')).redirects.some(r => r.source === '/analysis' && r.destination === '/analytics');
    check(redirectOk, 'vercel.json redirects /analysis to /analytics');

    const fresh = await browser.newContext();
    await fresh.route(/gstatic\.com\/firebasejs\/.*\/(firebase-[a-z]+\.js)$/, (route) => {
      route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(__dirname, 'fake-firebase', route.request().url().split('/').pop()), 'utf8') });
    });
    const g = await fresh.newPage();
    await g.goto(`${base}/analytics?project=sembawang-brook-6`);
    await g.waitForSelector('.ad-panel');
    check((await g.isHidden('#analysis-body')) && (await g.textContent('#a-basis')) === '', 'a new browser session gets the video gate and nothing loads behind it');
    await fresh.close();

    const dash = await ctx.newPage();
    await dash.goto(`${base}/archive/dashboard`);
    check((await dash.getAttribute('meta[name=robots]', 'content')).includes('noindex'), 'dashboard is noindex');
    await dash.fill('#pw', 'wrong');
    await dash.click('#login button');
    await dash.waitForFunction(() => /Wrong password/.test(document.querySelector('#msg').textContent), null, { timeout: 8000 });
    check(await dash.isHidden('#panel'), 'dashboard rejects a wrong password');
    await dash.fill('#pw', 'test');
    await dash.click('#login button');
    await dash.waitForSelector('#panel:not([hidden])');
    check((await dash.$$eval('#rows tr', r => r.length)) > 0 && /rankings saved/.test(await dash.textContent('#totals')), 'dashboard shows the summary after the right password');
    const [dl] = await Promise.all([dash.waitForEvent('download'), dash.click('#dl')]);
    check(/^mybto-rankings-\d{4}-\d{2}-\d{2}\.xlsx$/.test(dl.suggestedFilename()), `Excel download named ${dl.suggestedFilename()}`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(await dl.path());
    check(['Rankings', 'Shortlists', 'Read me'].every(n => wb.getWorksheet(n)), 'workbook has Rankings, Shortlists and Read me sheets');
    check(wb.getWorksheet('Rankings').rowCount > 1 && wb.getWorksheet('Shortlists').rowCount > 1, `Rankings has ${wb.getWorksheet('Rankings').rowCount - 1} rows`);
    const headers = wb.getWorksheet('Rankings').getRow(1).values.filter(Boolean);
    check(['project', 'anonymous_user', 'floor_pref', 'weight_corner', 'sun_weights', 'consent', 'survey_age', 'top_50_units'].every(h => headers.includes(h)), 'Rankings has the expected columns, including legacy survey answers');
    const raw = await dash.evaluate(async () => { const r = await fetch('/api/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: 'test', format: 'xlsx' }) }); return [r.headers.get('content-type'), r.headers.get('content-disposition')]; });
    check(raw[0].includes('spreadsheetml') && raw[1].startsWith('attachment'), 'export returns the xlsx content type as an attachment');
    await dash.close();

    await p.goto(`${base}/archive/account`);
    await p.fill('#form-register [name=email]', 'buyer@example.com');
    await p.fill('#form-register [name=password]', 'password123');
    await p.click('#form-register button.primary');
    await p.waitForSelector('#acct-in:not([hidden])');
    check(!(await p.$('#acct-badge')) && !(await p.$('#verify-box')), 'no email verification step');
    await p.goto(`${base}/rank`);
    await p.waitForFunction(() => /last settings/.test(document.querySelector('#save-msg').textContent) || true);
    check((await p.textContent('#flag-count')) === '3', 'starred units carried into the new account');
    await p.goto(`${base}/archive/account`);
    await p.click('#btn-logout');
    await p.waitForSelector('#acct-out:not([hidden])');
    await p.fill('#form-login [name=email]', 'buyer@example.com');
    await p.fill('#form-login [name=password]', 'wrong-password');
    await p.click('#form-login button.primary');
    await p.waitForFunction(() => /Wrong email or password/.test(document.querySelector('#form-login .err').textContent));
    check(true, 'wrong password rejected with friendly message');
    await p.click('#form-login [data-google]');
    await p.waitForSelector('#acct-in:not([hidden])');
    check(true, 'Google sign-in works');
    await p.goto(`${base}/`);
    await p.waitForSelector('#floor-groups .fg-card');
    check(true, 'the first page is the ranking page');
    check(!(await p.$('.site-header .nav')) && !(await p.$('.menu-btn')), 'header still has no menu button');
    check(!(await p.$('.site-footer a[href="/account"]')), 'no account link in the footer');
    await p.goto(`${base}/archive/home`);
    check((await p.title()).startsWith('MyBTO'), 'archived home page is titled MyBTO');
    await p.waitForSelector('#project-grid .pcard');
    check((await p.$$eval('#project-grid .pcard', c => c.length)) === 7, 'archived home shows all 7 projects');
    await p.click('.filters-tabs [data-type=Prime]');
    check((await p.$$eval('#project-grid .pcard:not([hidden])', c => c.length)) === 2, 'Prime filter shows 2 projects');
    await p.click('#project-grid .pcard:not([hidden]) >> nth=0');
    await p.waitForSelector('#floor-groups .fg-card');
    check((await p.inputValue('#project')) === 'berlayar-rise-7', 'project card opens Rank for that project');
    await p.goto(`${base}/rank`);
    await p.waitForSelector('#weights .help');
    await p.click('#weights .help >> nth=0');
    await p.waitForSelector('#legend-drawer.open #legend .lg');
    check((await p.$$eval('#legend .lg', c => c.length)) === 9, 'legend drawer opens with all 9 factors');
    check((await p.$$eval('#legend img', i => i.length)) === 9, 'legend has one picture per factor');
    await p.click('.drawer-head [data-close-legend]');
    await p.waitForSelector('#legend-drawer', { state: 'hidden' });
    check(true, 'legend drawer closes');
    for (const path of ['/rank?legend=mrt']) {
      await p.goto(`${base}${path}`);
      await p.waitForSelector('#legend-drawer.open');
      check(true, 'legend deep link opens the drawer');
    }
    check((await p.$$eval('svg', s => s.length)) === 0, 'no SVG on the page');
    const text = await p.evaluate(() => document.body.innerText);
    check(!text.includes('\u2014'), 'no em dashes on rank page');
    for (const path of ['/', '/rank', '/shortlist', '/analytics', '/archive/account', '/archive/home', '/archive/dashboard']) {
      const r = await p.goto(`${base}${path}`);
      check(r.status() === 200, `${path} loads`);
      await p.waitForTimeout(300);
      check(!(await p.evaluate(() => document.body.innerText)).includes('\u2014'), `${path}: no em dashes`);
      check((await p.$$eval('svg', s => s.length)) === 0, `${path}: no SVG`);
    }

    const phone = await ctx.newPage();
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.goto(`${base}/archive/home`);
    await phone.waitForSelector('#project-grid .pcard');
    const ov2 = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(ov2 <= 0, `home: no horizontal scroll on phone (overflow ${ov2}px)`);
    if (SHOTS) await phone.screenshot({ path: `${SHOTS}/phone-home.png`, fullPage: true });
    await phone.goto(`${base}/rank`);
    await phone.waitForSelector('#floor-groups .fg-card');
    await phone.click('#btn-rank');
    await phone.waitForSelector('[data-ad-go]:not([disabled])', { timeout: 8000 }); // a new tab is a new browser session, so the ad shows again
    await phone.click('[data-ad-go]');
    await phone.waitForSelector('#results tbody .rk');
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `no horizontal page scroll on phone (overflow ${overflow}px)`);
    if (SHOTS) await phone.screenshot({ path: `${SHOTS}/phone.png` });

    // Phone (390 px): header tabs, ad pop-up, Analytics gate and page, none of them scroll sideways.
    const pc = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await pc.addInitScript(() => { window.MYBTO_AD_SECONDS = { rewarded: 2 }; });
    await pc.route(/gstatic\.com\/firebasejs\/.*\/(firebase-[a-z]+\.js)$/, (route) => {
      route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(__dirname, 'fake-firebase', route.request().url().split('/').pop()), 'utf8') });
    });
    const ph = await pc.newPage();
    const over = () => ph.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    await ph.goto(`${base}/rank`);
    await ph.waitForFunction(() => document.querySelector('#tab-analytics-name').textContent === 'Kebun Baru Breeze');
    check((await over()) <= 0, `phone: header with tabs does not scroll sideways (overflow ${await over()}px)`);
    if (SHOTS) await ph.screenshot({ path: `${SHOTS}/phone-header.png`, clip: { x: 0, y: 0, width: 390, height: 260 } });
    await ph.click('#btn-rank');
    await ph.waitForSelector('.ad-panel');
    check((await over()) <= 0 && (await ph.$eval('.ad-slot', e => e.getBoundingClientRect().width)) === 300, 'phone: ad pop-up fits, ad slot is 300 wide');
    if (SHOTS) await ph.screenshot({ path: `${SHOTS}/phone-ad-modal.png` });
    await ph.click('[data-ad-cancel]');
    await ph.goto(`${base}/analytics?project=berlayar-rise-7`);
    await ph.waitForSelector('.ad-panel');
    check((await over()) <= 0, 'phone: Analytics gate fits');
    if (SHOTS) await ph.screenshot({ path: `${SHOTS}/phone-analytics-gate.png` });
    await ph.waitForSelector('[data-ad-go]:not([disabled])', { timeout: 8000 });
    await ph.click('[data-ad-go]');
    await ph.waitForFunction(() => /Based on/.test(document.querySelector('#a-basis').textContent));
    await ph.waitForTimeout(400);
    check((await over()) <= 0, `phone: Analytics page does not scroll sideways (overflow ${await over()}px)`);
    if (SHOTS) await ph.screenshot({ path: `${SHOTS}/phone-analytics.png`, fullPage: true });
    await pc.close();

    check(errors.length === 0, `no browser errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
    console.log('ALL BROWSER CHECKS PASSED');
  } finally {
    await browser.close();
    server.kill();
  }
})().catch(e => { console.error(e.message); process.exit(1); });

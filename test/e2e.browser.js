// Browser test of the full flow with Firebase stubbed (run: node test/e2e.browser.js; needs Playwright).
// Starts the dev server in fake-Firebase mode and routes the Firebase CDN modules to test/fake-firebase/.
const { spawn, execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

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
    await ctx.route(/gstatic\.com\/firebasejs\/.*\/(firebase-[a-z]+\.js)$/, (route) => {
      const name = route.request().url().split('/').pop();
      route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(__dirname, 'fake-firebase', name), 'utf8') });
    });
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    const rows = () => p.$$eval('#results tbody tr', r => r.filter(x => x.querySelector('.rk')).length);
    const surveyAnswer = async () => {
      for (const [k, v] of [['age', '30-34'], ['household', 'partner'], ['timer', 'first'], ['current_home', 'parents']]) await p.check(`#survey-form input[name=${k}][value="${v}"]`);
    };
    await p.goto(`${base}/rank`);
    await p.waitForSelector('#floor-groups .fg-card');
    check((await p.textContent('#result-count')).startsWith('0') && (await rows()) === 0, 'nothing ranked before pressing Rank units');
    check((await p.$$eval('#floor-groups .fg-card.blank', c => c.length)) === 3, 'highest, middlemost and lowest are blank before ranking');
    check(await p.isHidden('#after-rank'), 'Shortlisted and Analysis buttons hidden before ranking');
    check(!(await p.$('#btn-csv')) && !(await p.$('#btn-save')) && !(await p.$('#queue')), 'no CSV, Save list or queue box on the page');
    check(!(await p.$('.nav a[href="/shortlist"]')) && !(await p.$('.nav a[href="/analysis"]')), 'Shortlist and Analysis not in the menu');

    await p.click('#btn-rank');
    await p.waitForSelector('#survey:not([hidden])');
    check(true, 'Rank units opens the survey first');
    await p.click('#survey-ok');
    check(await p.isVisible('#survey'), 'survey needs all four answers');
    await surveyAnswer();
    await p.fill('#survey-form [name=queue_number]', '1234');
    await p.click('#survey-ok');
    await p.waitForSelector('#survey', { state: 'hidden' });
    await p.waitForSelector('#results tbody .rk');
    check(Number((await p.textContent('#result-count')).replace(/\D/g, '')) > 0, 'ranking loads after agreeing');
    check((await rows()) === 50, 'only the top 50 units are shown');
    check(await p.isVisible('#after-rank'), 'Shortlisted and Analysis buttons appear after ranking');
    const head = await p.$$eval('#results thead th', h => h.map(x => x.childNodes[0]?.textContent || ''));
    check(head.slice(0, 7).join('|') === '#||Unit|Score|Type · facing|Chute|MRT' && head.length > 7, `chute, MRT and one column per facility (${head.length - 7} facilities)`);
    check((await p.$$eval('#results tbody tr td:nth-child(6) .nf', n => n.every(x => /^(Near|Far)$/.test(x.textContent)))), 'chute shows near or far');
    check((await p.$$eval('#results tbody td.fac', n => n.every(x => /^[✓✗]$/.test(x.textContent.trim())))), 'facility columns are ticks and crosses');
    const tagText = await p.$$eval('#results .tags .tag', t => [...new Set(t.map(x => x.textContent.replace(/\d+/, 'N')))]);
    check(tagText.every(t => ['corner', 'corridor', 'near MRT', 'chute within N m'].includes(t)), `only corner/corridor, MRT and chute tags (${tagText.join(', ')})`);
    const saved = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('fs:submissions/')).map(k => JSON.parse(localStorage.getItem(k))));
    check(saved.length === 1 && saved[0].survey.consent && saved[0].queue_number === '1234' && saved[0].ranking.length > 50, `ranking saved with survey and every unit (${saved[0]?.ranking.length})`);

    await p.selectOption('#project', 'berlayar-rise-7');
    await p.waitForFunction(() => document.querySelector('#result-count').textContent.startsWith('0'));
    check(true, 'changing project clears the ranking');
    check((await p.$$eval('#f-types input', i => i.map(x => x.type + ':' + x.value))).join() === 'radio:2-Room Flexi,radio:3-Room,radio:4-Room', 'one housing type at a time, 2-Room Flexi as one choice');
    check((await p.textContent('#analysis-name')) === 'Berlayar Rise', 'Analysis button names the project');
    await p.click('#btn-rank');
    await p.waitForFunction(() => document.querySelector('#result-count').textContent.startsWith('988'));
    check(await p.isHidden('#survey'), 'survey only asked once per browser');
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
    await p.click('[data-blocks=none]');
    await p.click('#f-blocks label:has-text("200B")');
    const meters = await p.$$eval('#weights .meter label', m => m.map(x => x.textContent));
    check(meters.includes('Block 200B') && !meters.includes('Block 200A'), 'only selected blocks get a meter');
    check(!meters.some(m => m.startsWith('Type 1')) && meters.some(m => m.startsWith('Type 2')), '2RF Type 1 meter hidden when block 200B has none');
    await p.click('#btn-rank');
    check(await p.$$eval('#results tbody .addr small', s => s.every(x => x.textContent === 'Blk 200B')), 'block filter applied');

    await p.click('.star >> nth=0'); await p.click('.star >> nth=1'); await p.click('.star >> nth=2');
    check((await p.textContent('#flag-count')) === '3', 'Shortlisted button counts three starred units');
    check((await p.getAttribute('#btn-shortlisted', 'target')) === '_blank' && (await p.getAttribute('#btn-analysis', 'target')) === '_blank', 'Shortlisted and Analysis open in a new tab');
    const [sl] = await Promise.all([ctx.waitForEvent('page'), p.click('#btn-shortlisted')]);
    await sl.waitForSelector('#flag-list li .addr');
    const first = await sl.textContent('#flag-list li:nth-child(1) .addr');
    await sl.click('#flag-list li:nth-child(2) [data-act=up]');
    check((await sl.textContent('#flag-list li:nth-child(2) .addr')) === first, 'shortlist reorders');
    await sl.close();
    const [an] = await Promise.all([ctx.waitForEvent('page'), p.click('#btn-analysis')]);
    await an.waitForSelector('#analysis-body:not([hidden])');
    await an.waitForFunction(() => /Based on/.test(document.querySelector('#a-basis').textContent));
    check((await an.inputValue('#a-value')) === 'berlayar-rise-7' && (await an.title()).startsWith('Berlayar Rise Analysis'), 'Analysis opens on the ranked project');
    check((await an.$$eval('#r-sun li', l => l.length)) === 4, 'analysis shows the 4 sun directions');
    check((await an.$$eval('#r-who h4', h => h.length)) === 4, 'analysis shows who ranked');
    await an.selectOption('#a-group', 'project_type');
    await an.waitForFunction(() => /Kebun Baru/.test(document.querySelector('#a-basis').textContent));
    check(true, 'analysis by project type (Plus)');
    if (SHOTS) await an.screenshot({ path: `${SHOTS}/analysis.png`, fullPage: true });
    await an.close();

    const fresh = await browser.newContext();
    await fresh.route(/gstatic\.com\/firebasejs\/.*\/(firebase-[a-z]+\.js)$/, (route) => {
      route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(__dirname, 'fake-firebase', route.request().url().split('/').pop()), 'utf8') });
    });
    const g = await fresh.newPage();
    await g.goto(`${base}/analysis`);
    check(await g.waitForSelector('#analysis-locked:not([hidden])', { timeout: 5000 }).then(() => true, () => false), 'Analysis locked until the survey is done');
    await fresh.close();

    await p.goto(`${base}/account`);
    await p.fill('#form-register [name=email]', 'buyer@example.com');
    await p.fill('#form-register [name=password]', 'password123');
    await p.click('#form-register button.primary');
    await p.waitForSelector('#acct-in:not([hidden])');
    check(!(await p.$('#acct-badge')) && !(await p.$('#verify-box')), 'no email verification step');
    await p.goto(`${base}/rank`);
    await p.waitForFunction(() => /last settings/.test(document.querySelector('#save-msg').textContent) || true);
    check((await p.textContent('#flag-count')) === '3', 'starred units carried into the new account');
    await p.goto(`${base}/account`);
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
    check(!(await p.$('.nav a[href="/#projects"]')), 'no Projects link in the menu');
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
    for (const path of ['/', '/rank', '/shortlist', '/analysis', '/account', '/archive/home']) {
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
    await phone.waitForSelector('#results tbody .rk');
    const overflow = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(overflow <= 0, `no horizontal page scroll on phone (overflow ${overflow}px)`);
    if (SHOTS) await phone.screenshot({ path: `${SHOTS}/phone.png` });

    check(errors.length === 0, `no browser errors${errors.length ? `: ${errors.join(' | ')}` : ''}`);
    console.log('ALL BROWSER CHECKS PASSED');
  } finally {
    await browser.close();
    server.kill();
  }
})().catch(e => { console.error(e.message); process.exit(1); });

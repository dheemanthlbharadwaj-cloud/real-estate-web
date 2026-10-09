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

    await p.goto(`${base}/rank`);
    await p.waitForSelector('#results tbody tr');
    check(Number((await p.textContent('#result-count')).replace(/\D/g, '')) > 0, 'schedule renders units');
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/rank.png`, fullPage: true });

    await p.selectOption('#project', 'berlayar-rise-7');
    await p.waitForFunction(() => document.querySelector('#result-count').textContent.startsWith('1,976'));
    check(true, 'Berlayar Rise loads 1,976 units');
    await p.click('[data-blocks=none]');
    await p.click('#f-blocks label:has-text("200B")');
    const meters = await p.$$eval('#weights .meter label', m => m.map(x => x.textContent));
    check(meters.includes('Block 200B') && !meters.includes('Block 200A'), 'only selected blocks get a meter');
    check(!meters.includes('Type 1'), '2RF Type 1 meter hidden when block 200B has none');
    await p.click('#btn-rank');
    const allIn200B = await p.$$eval('#results tbody .addr small', s => s.every(x => x.textContent === 'Blk 200B'));
    check(allIn200B, 'block filter applied');
    const before = Number((await p.textContent('#result-count')).replace(/\D/g, ''));
    await p.click('#f-opposite'); await p.click('#btn-rank');
    const after = Number((await p.textContent('#result-count')).replace(/\D/g, ''));
    check(after < before, `privacy filter reduces units (${before} -> ${after})`);

    await p.click('.star >> nth=0'); await p.click('.star >> nth=1'); await p.click('.star >> nth=2');
    check((await p.textContent('#flag-count')) === '3', 'three units flagged');
    await p.goto(`${base}/shortlist`);
    const first = await p.textContent('#flag-list li:nth-child(1) .addr');
    await p.click('#flag-list li:nth-child(2) [data-act=up]');
    check((await p.textContent('#flag-list li:nth-child(2) .addr')) === first, 'shortlist reorders');

    await p.goto(`${base}/analysis`);
    check(await p.isVisible('#analysis-locked'), 'analysis locked for guests');

    await p.goto(`${base}/account`);
    await p.fill('#form-register [name=email]', 'buyer@example.com');
    await p.fill('#form-register [name=password]', 'password123');
    await p.click('#form-register button.primary');
    await p.waitForSelector('#acct-in:not([hidden])');
    check((await p.textContent('#acct-badge')) === 'Not verified', 'new account is unverified');
    check(await p.evaluate(() => window.__verifySent === 1), 'verification email sent');
    check((await p.textContent('#flag-count')) === '3', 'guest flags merged into account');
    await p.goto(`${base}/analysis`);
    check(await p.isVisible('#analysis-locked'), 'analysis locked for unverified user');

    await p.goto(`${base}/account`);
    await p.waitForSelector('#btn-refresh', { state: 'visible' });
    await p.evaluate(() => window.__fakeVerify('buyer@example.com'));
    await p.click('#btn-refresh');
    await p.waitForFunction(() => document.querySelector('#acct-badge').textContent === 'Verified');
    check(true, 'verification picked up');
    await p.goto(`${base}/analysis`);
    await p.waitForSelector('#analysis-body:not([hidden])');
    await p.waitForFunction(() => /saved lists/.test(document.querySelector('#a-basis').textContent));
    check((await p.$$eval('#r-sun li', l => l.length)) === 8, 'analysis shows 8 sun directions');
    await p.selectOption('#a-group', 'project_type');
    await p.waitForFunction(() => /Kebun Baru/.test(document.querySelector('#a-basis').textContent));
    check(true, 'analysis by project type (Plus)');
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/analysis.png`, fullPage: true });

    await p.goto(`${base}/rank`);
    await p.waitForTimeout(300);
    await p.waitForSelector('#results tbody tr');
    if (!(await p.isChecked('#f-opposite'))) await p.click('#f-opposite');
    await p.fill('#queue', '1234');
    await p.click('#btn-save');
    await p.waitForFunction(() => /Saved/.test(document.querySelector('#save-msg').textContent));
    await p.reload();
    await p.waitForFunction(() => document.querySelector('#queue').value === '1234');
    check((await p.isChecked('#f-opposite')), 'saved list (queue, privacy filter) restored after reload');
    check((await p.textContent('#flag-count')) === '3', 'flags restored after reload');

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
    check((await p.textContent('#acct-badge')) === 'Verified', 'Google sign-in gives a verified account');
    await p.goto(`${base}/analysis`);
    await p.waitForSelector('#analysis-body:not([hidden])');
    check(true, 'Google user can open Analysis');
    await p.goto(`${base}/`);
    check((await p.title()).startsWith('MyBTO'), 'home page is titled MyBTO');
    await p.waitForSelector('#project-grid .pcard');
    check((await p.$$eval('#project-grid .pcard', c => c.length)) === 7, 'home shows all 7 projects');
    await p.click('.filters-tabs [data-type=Prime]');
    check((await p.$$eval('#project-grid .pcard:not([hidden])', c => c.length)) === 2, 'Prime filter shows 2 projects');
    await p.click('#project-grid .pcard:not([hidden]) >> nth=0');
    await p.waitForSelector('#results tbody tr');
    check((await p.inputValue('#project')) === 'berlayar-rise-7', 'project card opens Rank for that project');
    await p.goto(`${base}/guide`);
    await p.waitForSelector('#legend .lg');
    check((await p.$$eval('#legend .lg', c => c.length)) >= 8, 'guide shows the factor legend');
    for (const path of ['/', '/rank', '/shortlist', '/analysis', '/guide', '/account']) {
      const r = await p.goto(`${base}${path}`);
      check(r.status() === 200, `${path} loads`);
    }

    const phone = await ctx.newPage();
    await phone.setViewportSize({ width: 390, height: 844 });
    await phone.goto(`${base}/`);
    await phone.waitForSelector('#project-grid .pcard');
    const ov2 = await phone.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(ov2 <= 0, `home: no horizontal scroll on phone (overflow ${ov2}px)`);
    if (SHOTS) await phone.screenshot({ path: `${SHOTS}/phone-home.png`, fullPage: true });
    await phone.goto(`${base}/rank`);
    await phone.waitForSelector('#results tbody tr');
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

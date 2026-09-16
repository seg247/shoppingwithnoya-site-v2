import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
test('guide discovery, reading and navigation work at phone and desktop widths', { skip: process.env.UI_BROWSER !== '1' }, async () => {
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE);
  const child = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'preview', '--host', '127.0.0.1', '--port', '4418'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    await new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error('preview timeout')), 20000);
      child.stdout.on('data', b => { if (b.toString().includes('4418')) { clearTimeout(timer); res(); } });
      child.once('exit', c => { clearTimeout(timer); rej(new Error(`preview exited ${c}`)); });
    });
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    await context.route('**/*', r => r.request().url().startsWith('http://127.0.0.1:4418/') ? r.continue() : r.abort());
    const page = await context.newPage();
    for (const width of [320, 390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const path of ['/', '/guides/', '/guides/amazon-coupons-subscribe-save/']) {
        assert.equal((await page.goto(`http://127.0.0.1:4418${path}`)).status(), 200);
        if (path === '/') await page.locator('.compact-menu > summary').click();
        const geometry = await page.evaluate(() => ({
          width: innerWidth, scroll: document.documentElement.scrollWidth,
          offscreen: [...document.querySelectorAll('[aria-label="Primary navigation"] a, .guide-navigation a')].filter(a => {
            const r = a.getBoundingClientRect(); return r.width === 0 || r.left < -1 || r.right > innerWidth + 1;
          }).map(a => a.textContent.trim())
        }));
        assert.ok(geometry.scroll <= width, `${path} at ${width}: ${JSON.stringify(geometry)}`);
        assert.deepEqual(geometry.offscreen, [], `${path} at ${width}`);
        assert.ok(await page.locator('.guide-navigation a').isVisible());
      }
      await page.goto('http://127.0.0.1:4418/');
      await page.locator('.compact-menu > summary').click();
      await page.locator('.guide-navigation a').click();
      assert.ok(page.url().endsWith('/guides/'));
      await page.locator('.guide-card').click();
      assert.ok(page.url().endsWith('/guides/amazon-coupons-subscribe-save/'));
      await page.locator('article a[href="#source-2"]').first().click();
      assert.ok(page.url().endsWith('#source-2'));
      assert.ok(await page.locator('#source-2').isVisible());
      await page.goto('http://127.0.0.1:4418/guides/amazon-coupons-subscribe-save/');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
    }
  } finally { if (browser) await browser.close(); child.kill(); }
});

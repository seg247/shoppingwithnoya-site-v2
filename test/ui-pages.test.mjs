import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { JSDOM } from 'jsdom';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const data = JSON.parse(await readFile(resolve(root, 'src/data/site-data.json'), 'utf8'));
const html = async (route = 'index.html') => readFile(resolve(dist, route), 'utf8');
const doc = async route => new JSDOM(await html(route)).window.document;
const dealRoute = `deals/${(await readdir(resolve(dist, 'deals')))[0]}/index.html`;
const categories = await readdir(resolve(dist, 'category'));
const pages = ['index.html', 'contact/index.html', 'privacy/index.html', 'terms/index.html', 'blog/index.html', 'about/index.html', 'beauty/index.html', `category/${categories[0]}/index.html`, dealRoute];

for (const route of pages) test(`${route}: actual skip link targets the single main landmark`, async () => {
  const d = await doc(route);
  assert.equal(d.querySelectorAll('main').length, 1, 'exactly one main');
  const main = d.querySelector('main');
  assert.equal(main.id, 'main-content');
  assert.equal(main.getAttribute('tabindex'), '-1');
  const skip = d.querySelector('body > a[href="#main-content"]');
  assert.ok(skip && /skip to/i.test(skip.textContent), 'real first-level skip anchor');
  assert.ok(d.querySelector('nav[aria-label="Primary navigation"]'), 'named primary navigation');
  assert.ok(!main.contains(d.querySelector('footer')), 'footer is outside main');
});

for (const route of ['contact', 'privacy', 'terms']) test(`${route}: social metadata describes existing page`, async () => {
  const d = await doc(`${route}/index.html`);
  for (const selector of ['meta[property="og:title"]', 'meta[property="og:description"]', 'meta[property="og:type"]', 'meta[property="og:url"]', 'meta[name="twitter:card"]', 'meta[name="twitter:title"]', 'meta[name="twitter:description"]']) {
    assert.ok(d.querySelector(selector)?.content, selector);
  }
  assert.equal(d.querySelector('meta[property="og:title"]').content, d.title);
  assert.equal(d.querySelector('meta[property="og:description"]').content, d.querySelector('meta[name="description"]').content);
});

function priority(d) {
  const imgs = [...d.querySelectorAll('#deals-grid img')];
  assert.ok(imgs.length > 1);
  assert.equal(imgs[0].getAttribute('loading'), 'eager');
  assert.equal(imgs[0].getAttribute('fetchpriority'), 'high');
  assert.equal(imgs.filter(i => i.getAttribute('fetchpriority') === 'high').length, 1);
  for (const i of imgs) {
    assert.equal(i.getAttribute('width'), '300');
    assert.equal(i.getAttribute('height'), '300');
  }
  assert.equal(imgs.at(-1).getAttribute('loading'), 'lazy');
}
test('homepage SSR prioritizes only the first image and reserves image space', async () => priority(await doc('index.html')));

async function hydrate(query = '', fixture = data) {
  const dom = new JSDOM(await html(), { url: `https://deals.shoppingwithnoya.com/${query}`, runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.fetch = async () => ({ json: async () => fixture });
  const script = [...dom.window.document.scripts].find(s => s.textContent.includes('const DATA_URL'));
  assert.ok(script, 'built homepage runtime script');
  dom.window.eval(script.textContent);
  await new Promise(r => setTimeout(r, 20));
  return dom;
}
test('homepage client render retains first-image priority and dimensions', async () => {
  const dom = await hydrate();
  try {
    priority(dom.window.document);
    const ssr = await doc('index.html');
    assert.equal(dom.window.document.querySelector('#deals-grid img').src, ssr.querySelector('#deals-grid img').src, 'same first image before/after client render');
  } finally { dom.window.close(); }
});
test('GET query is applied to homepage input and actual rendered results', async () => {
  const dom = await hydrate('?q=unmatchable-noya-test-query-9281');
  try {
    const d = dom.window.document;
    assert.equal(d.querySelector('#search-input').value, 'unmatchable-noya-test-query-9281');
    assert.equal(d.querySelectorAll('#deals-grid .deal-card').length, 0);
    assert.match(d.querySelector('#deals-grid').textContent, /No deals found/);
    d.querySelector('#search-clear').click();
    assert.ok(d.querySelectorAll('#deals-grid .deal-card').length > 0);
  } finally { dom.window.close(); }
});
test('homepage search and result status have accessible names and semantics', async () => {
  const d = await doc();
  assert.ok(d.querySelector('label[for="search-input"]')?.textContent.trim());
  assert.equal(d.querySelector('#search-input').name, 'q');
  assert.equal(d.querySelector('#deal-count').getAttribute('role'), 'status');
});
test('All and Promo filters expose and update pressed state without losing filtering', async () => {
  const dom = await hydrate();
  try {
    const d = dom.window.document;
    const all = d.querySelector('[data-cat="all"]');
    const promo = d.querySelector('[data-cat="__promo__"]');
    assert.equal(all.getAttribute('aria-pressed'), 'true');
    promo.click();
    assert.equal(promo.getAttribute('aria-pressed'), 'true');
    assert.equal(all.getAttribute('aria-pressed'), 'false');
    const urls = new Set(data.posts.filter(p => p.promoCode).map(p => p.url));
    for (const link of d.querySelectorAll('#deals-grid .card-link')) assert.ok(urls.has(link.href));
    all.click();
    assert.equal(all.getAttribute('aria-pressed'), 'true');
    assert.equal(promo.getAttribute('aria-pressed'), 'false');
    assert.ok(d.querySelectorAll('#deals-grid .deal-card').length > 0);
  } finally { dom.window.close(); }
});
test('share controls are not nested in another interactive control', async () => {
  const dom = await hydrate();
  try {
    const buttons = [...dom.window.document.querySelectorAll('.share-btn')];
    assert.ok(buttons.length);
    assert.ok(buttons.every(b => !b.closest('a')), 'share buttons outside card links');
    assert.ok([...dom.window.document.querySelectorAll('.card-link')].every(a => a.textContent.trim() || a.getAttribute('aria-label')));
  } finally { dom.window.close(); }
});
test('feed text stays text and unsafe link schemes cannot create interactive cards', async () => {
  const title = 'Puzzle <img id="feed-injection" src=x> & "Friends"';
  const url = 'https://www.amazon.com/dp/B000000001?tag=noya0b-20&th=1';
  const fixture = { posts: [
    { title, url, category: 'Toys & Kids', asin: 'B000000001', ts: new Date().toISOString(), imageUrl: 'javascript:alert(1)' },
    { title: 'Bad destination', url: 'javascript:alert(1)', category: 'Toys & Kids', asin: 'B000000002', ts: new Date().toISOString() },
  ] };
  const dom = await hydrate('', fixture);
  try {
    const d = dom.window.document;
    assert.equal(d.querySelector('#feed-injection'), null, 'feed text injected HTML');
    assert.equal(d.querySelector('.card-title')?.textContent, title);
    assert.equal(d.querySelectorAll('.card-link').length, 1);
    assert.equal(d.querySelector('.card-link').getAttribute('href'), url);
    assert.equal(d.querySelector('.card-link').getAttribute('aria-label'), title);
    assert.equal(d.querySelector('#deals-grid img'), null, 'unsafe image URL');
    assert.equal(d.querySelector('#deal-count').textContent, '1 deals');
  } finally { dom.window.close(); }
});

test('contact keeps labelled Formspree form and accessible status (no submission)', async () => {
  const d = await doc('contact/index.html');
  assert.equal(d.querySelector('form').action, 'https://formspree.io/f/xjgpqnkw');
  for (const input of d.querySelectorAll('input, select, textarea')) assert.ok(d.querySelector(`label[for="${input.id}"]`));
  assert.equal(d.querySelector('#success-msg').getAttribute('role'), 'status');
});
test('Base renders one footer wrapper, not nested duplicate wrappers', async () => {
  const d = await doc(dealRoute);
  assert.equal(d.querySelectorAll('footer .footer-inner').length, 1);
});
test('branded static 404 is noindex, has GET search, and links only built categories', async () => {
  assert.ok(existsSync(resolve(dist, '404.html')), 'Astro emits dist/404.html');
  const d = await doc('404.html');
  assert.match(d.title, /Shopping With Noya/);
  assert.match(d.querySelector('h1')?.textContent || '', /not found/i);
  assert.match(d.querySelector('meta[name="robots"]')?.content || '', /noindex/);
  assert.equal(d.querySelectorAll('main').length, 1);
  assert.ok(d.querySelector('a[href="#main-content"]'));
  const form = d.querySelector('form[role="search"]');
  assert.equal(form?.method, 'get');
  assert.equal(form?.getAttribute('action'), '/');
  assert.ok(form.querySelector('input[name="q"]'));
  assert.ok(d.querySelector('label[for="not-found-search"]'));
  const links = [...d.querySelectorAll('a[href^="/category/"]')];
  assert.deepEqual(links.map(a => a.getAttribute('href').split('/')[2]).sort(), categories.slice().sort());
  for (const a of links) await access(resolve(dist, a.getAttribute('href').slice(1), 'index.html'));
});

// Run with UI_BROWSER=1. Uses isolated Playwright Chromium; all remote requests blocked.
test('browser: real HTTP 404, responsive geometry, computed button contrast, keyboard and filtering', { skip: process.env.UI_BROWSER !== '1' }, async t => {
  const require = createRequire(import.meta.url);
  const { chromium } = require(process.env.PLAYWRIGHT_MODULE || resolve(root, '../tools/node_modules/playwright'));
  const child = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'preview', '--host', '127.0.0.1', '--port', '4408'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
  let browser;
  try {
    await new Promise((res, rej) => {
      const timer = setTimeout(() => rej(new Error('preview readiness timeout')), 20000);
      child.stdout.on('data', x => { if (x.toString().includes('4408')) { clearTimeout(timer); res(); } });
      child.once('exit', code => { clearTimeout(timer); rej(new Error(`preview exited ${code}`)); });
    });
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.route('**/*', route => {
      if (route.request().url().startsWith('http://127.0.0.1:4408/')) return route.continue();
      // Geometry fixture only: use an existing local image, never request remote products/analytics.
      if (route.request().resourceType() === 'image') return route.fulfill({ path: resolve(dist, 'favicon-32.png'), contentType: 'image/png' });
      return route.abort();
    });
    const page = await context.newPage();
    await t.test('missing route is branded HTTP 404 with working search', async () => {
    const response = await page.goto('http://127.0.0.1:4408/does-not-exist-ui-test/');
    assert.equal(response.status(), 404, 'missing URL must not soft-404');
    assert.match(await page.title(), /Shopping With Noya/);
    await page.getByLabel('Search deals').fill('unmatchable-noya-test-query-9281');
    await page.getByRole('button', { name: 'Search', exact: true }).click();
    await page.waitForSelector('.no-results');
    assert.ok(page.url().includes('?q='));
    });
    for (const route of ['/', '/contact/', '/blog/', `/${dealRoute.replace('index.html', '')}`, '/404.html']) {
      for (const width of [320, 390, 1280]) {
        await t.test(`${route}: nav geometry at ${width}px`, async () => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`http://127.0.0.1:4408${route}`);
        const overflow = await page.evaluate(() => {
          const nav = document.querySelector('nav[aria-label="Primary navigation"], .nav-inner, body > nav');
          return [...nav.querySelectorAll('a')].filter(a => { const r = a.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(a => a.textContent.trim());
        });
        assert.deepEqual(overflow, [], `${route} nav at ${width}px`);
        if (process.env.UI_SCREENSHOT_DIR && ['/', '/contact/', '/404.html'].includes(route) && [390, 1280].includes(width)) {
          if (route === '/') {
            await page.waitForSelector('.share-btn');
            await page.waitForFunction(() => [...document.querySelectorAll('.deal-card')].every(card => Number(getComputedStyle(card).opacity) >= .99));
          }
          await page.screenshot({ path: resolve(process.env.UI_SCREENSHOT_DIR, `ui-${route === '/' ? 'home' : route.replaceAll('/', '')}-${width}.png`) });
        }
        });
      }
    }
    await page.goto('http://127.0.0.1:4408/');
    await page.waitForSelector('.share-btn');
    await t.test('first rendered image is eager/high and above the fold', async () => {
      const image = page.locator('#deals-grid img').first();
      assert.equal(await image.getAttribute('loading'), 'eager');
      assert.equal(await image.getAttribute('fetchpriority'), 'high');
      assert.equal(await page.locator('#deals-grid img[fetchpriority="high"]').count(), 1);
      const rect = await image.boundingBox();
      assert.ok(rect && rect.width > 0 && rect.height > 0 && rect.y < 900);
    });
    await t.test('keyboard skip link moves focus to main', async () => {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), '#main-content');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'main-content');
    });
    await t.test('desktop category arrow is visible and scrolls', async () => {
    const arrow = page.locator('#cat-arrow-right');
    assert.equal(await arrow.evaluate(el => getComputedStyle(el).display), 'flex');
    await arrow.click();
    await page.waitForFunction(() => document.querySelector('#chips').scrollLeft > 0);
    });
    const contrast = async selector => page.locator(selector).first().evaluate(el => {
      const s = getComputedStyle(el);
      const lum = rgb => { const c = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return c[0] * .2126 + c[1] * .7152 + c[2] * .0722; };
      let ancestor = el;
      while (ancestor && getComputedStyle(ancestor).backgroundColor === 'rgba(0, 0, 0, 0)') ancestor = ancestor.parentElement;
      const bg = getComputedStyle(ancestor).backgroundColor;
      return { ratio: (Math.max(lum(s.color), lum(bg)) + .05) / (Math.min(lum(s.color), lum(bg)) + .05), image: s.backgroundImage };
    });
    for (const selector of ['button.shop-cat.active', '.share-btn', '.card-cta', '.nav-tg']) {
      await t.test(`${selector}: computed contrast`, async () => {
      const c = await contrast(selector);
      assert.equal(c.image, 'none', `${selector}: measurable solid background`);
      assert.ok(c.ratio >= 4.5, `${selector} contrast ${c.ratio}`);
      t.diagnostic(`${selector}: computed contrast ${c.ratio.toFixed(2)}:1`);
      });
    }
    await t.test('mobile deal link remains visible and covers the card', async () => {
      await page.setViewportSize({ width: 390, height: 900 });
      const link = page.locator('.card-link').first();
      assert.ok(await link.isVisible(), 'mobile card has a visible usable link');
      const result = await link.evaluate(a => {
        const card = a.closest('.deal-card');
        const rect = card.getBoundingClientRect();
        const overlay = getComputedStyle(a, '::after');
        return { position: overlay.position, inset: overlay.inset, width: rect.width };
      });
      assert.equal(result.position, 'absolute');
      assert.equal(result.inset, '0px');
    });
    await t.test('narrow fine-pointer category arrow does not cover category text', async () => {
      await page.setViewportSize({ width: 390, height: 900 });
      await page.evaluate(() => { document.querySelector('#chips').scrollLeft = 0; });
      const geometry = await page.evaluate(() => ({
        arrow: document.querySelector('#cat-arrow-right').getBoundingClientRect().left,
        strip: document.querySelector('#chips').getBoundingClientRect().right,
      }));
      assert.ok(geometry.arrow >= geometry.strip, JSON.stringify(geometry));
    });
    await page.goto('http://127.0.0.1:4408/contact/');
    await t.test('contact submit computed contrast', async () => {
    const c = await contrast('.submit-btn');
    assert.equal(c.image, 'none');
    assert.ok(c.ratio >= 4.5, `submit contrast ${c.ratio}`);
    t.diagnostic(`contact submit: computed contrast ${c.ratio.toFixed(2)}:1`);
    });
    await context.close();
  } finally {
    if (browser) await browser.close();
    child.kill();
  }
});

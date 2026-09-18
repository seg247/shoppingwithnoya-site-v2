import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';

const data = JSON.parse(readFileSync(new URL('../src/data/site-data.json', import.meta.url), 'utf8'));
const html = route => readFileSync(new URL(`../dist/${route}`, import.meta.url), 'utf8');
const home = () => new JSDOM(html('index.html')).window.document;
async function hydrate(fixture = data, query = '') {
  const dom = new JSDOM(html('index.html'), { url: `https://deals.shoppingwithnoya.com/${query}`, runScripts: 'outside-only', pretendToBeVisual: true });
  dom.window.fetch = async () => ({ json: async () => fixture });
  for (const script of dom.window.document.scripts) {
    if (script.textContent.includes('const DATA_URL') || script.hasAttribute('data-compact-controls')) dom.window.eval(script.textContent);
  }
  await new Promise(r => setTimeout(r, 30));
  return dom;
}
const change = (dom, el, value) => { el.value = value; el.dispatchEvent(new dom.window.Event('change', { bubbles: true })); };

test('compact header keeps original destinations in a keyboard-operable disclosure', () => {
  const d = home();
  const menu = d.querySelector('.compact-menu');
  assert.ok(menu, 'compact navigation disclosure is missing');
  assert.ok(menu.querySelector('summary'));
  for (const href of ['/blog/', '/beauty/', '/guides/', '/category/grocery-food/', '/category/home-kitchen/', 'https://www.facebook.com/groups/1224964507605101', 'https://t.me/shoppingwithnoya', 'https://shoppingwithnoya.com']) {
    assert.ok(menu.querySelector(`a[href="${href}"]`), `menu destination ${href}`);
  }
});

test('menu Escape returns focus and outside click closes without a modal focus trap', async () => {
  const dom = await hydrate();
  try {
    const d = dom.window.document, menu = d.querySelector('.compact-menu');
    assert.ok(menu, 'compact menu missing');
    menu.open = true;
    menu.querySelector('a').focus();
    d.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert.equal(menu.open, false);
    assert.equal(d.activeElement, menu.querySelector('summary'));
    menu.open = true;
    d.querySelector('#search-input').click();
    assert.equal(menu.open, false);
  } finally { dom.window.close(); }
});

test('compact CSS explicitly supplies mobile two-column and desktop four-column image-led cards', () => {
  const path = new URL('../src/components/CompactDealsStyles.astro', import.meta.url);
  assert.ok(existsSync(path), 'shared compact stylesheet is missing');
  const css = readFileSync(path, 'utf8');
  assert.match(css, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /min-width:\s*1200px/);
  assert.match(css, /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(css, /object-fit:\s*contain/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /data-view="list"/);
});

test('homepage first-fold structure is search, paired controls, then grid (not a hero or guide banner)', () => {
  const d = home(), main = d.querySelector('main');
  assert.ok(d.body.classList.contains('compact-deals'));
  assert.ok(main.firstElementChild.classList.contains('visually-hidden'), 'accessible page heading remains');
  // Category filters are chips in the open, no longer a disclosure beside sort.
  assert.ok(d.querySelector('.chip-row #chips'), 'filter chips are surfaced, not in a drawer');
  assert.equal(d.querySelector('.browse-controls .category-picker'), null, 'no duplicate category control above the feed');
  assert.ok([...d.querySelectorAll('.chip-row .shop-cat')].length > 1, 'chips rendered');
  assert.ok(d.querySelector('.section-header #sort-order'), 'sort sits in the results header, beside the count it reorders');
  const grid = d.querySelector('#deals-grid');
  assert.ok(d.querySelector('.chip-row').compareDocumentPosition(grid) & 4, 'chips precede the grid');
  // Category guide links moved to the footer so the homepage stops showing two
  // category lists, without orphaning /category/ pages from internal linking.
  assert.ok(d.querySelector('footer .footer-cats a[href^="/category/"]'), 'category guides still linked from footer');
  assert.ok(grid.compareDocumentPosition(d.querySelector('.hero-strip')) & 4, 'marketing content must follow grid');
  assert.equal(grid.dataset.view, 'grid');
});

test('view toggle changes layout and pressed label without losing rendered links or filters', async () => {
  const dom = await hydrate();
  try {
    const d = dom.window.document, toggle = d.querySelector('#view-toggle');
    assert.ok(toggle, 'list view control missing');
    const links = [...d.querySelectorAll('.card-link')].map(a => a.href);
    toggle.click();
    assert.equal(d.querySelector('#deals-grid').dataset.view, 'list');
    assert.equal(toggle.getAttribute('aria-pressed'), 'true');
    assert.match(toggle.textContent, /Grid view/);
    assert.deepEqual([...d.querySelectorAll('.card-link')].map(a => a.href), links);
    toggle.click();
    assert.equal(d.querySelector('#deals-grid').dataset.view, 'grid');
  } finally { dom.window.close(); }
});

test('default view pages at 60 with a Load More control, and filters reset paging', async () => {
  const fixture = { posts: Array.from({ length: 145 }, (_, i) => ({ title: `QA item ${i}`, url: `https://example.com/test-only/${i}`, category: 'Home & Kitchen', ts: '2026-09-16T12:00:00Z' })) };
  const dom = await hydrate(fixture);
  try {
    const d = dom.window.document;
    // The default view used to hard-stop at 30 with no way forward while the
    // hero advertised the full catalogue. Now it pages, and the counter
    // reports the true match total rather than the visible slice.
    assert.equal(d.querySelectorAll('.card-link').length, 60);
    assert.equal(d.querySelector('#deal-count').textContent, '145 deals');
    const btn = d.querySelector('#load-more-btn');
    assert.ok(btn, 'Load More control is present when deals remain');
    assert.match(btn.textContent, /85 remaining/);
    btn.click();
    assert.equal(d.querySelectorAll('.card-link').length, 120);
    d.querySelector('#load-more-btn').click();
    assert.equal(d.querySelectorAll('.card-link').length, 145);
    assert.equal(d.querySelector('#load-more-btn'), null, 'control disappears at the end');
    // Filtering resets paging so the user is never left deep in a stale page.
    d.querySelector('.chip[data-cat="Home & Kitchen"]').click();
    assert.equal(d.querySelectorAll('.card-link').length, 60);
    assert.equal(d.querySelector('#deal-count').textContent, '145 deals');
  } finally { dom.window.close(); }
});

test('ordinary cards have one main action row and an honest missing-image slot', async () => {
  const dom = await hydrate({ posts: [{ title: 'QA product - test only', url: 'https://example.com/test-only', category: 'Home & Kitchen', ts: '2026-09-16T12:00:00Z' }] });
  try {
    const d = dom.window.document;
    assert.ok(d.querySelector('.image-placeholder'), 'missing images need a consistent neutral slot');
    assert.ok(d.querySelector('.card-actions .card-link'), 'main action belongs in compact shared row');
    assert.ok(d.querySelector('.card-actions .share-btn'), 'share remains available beside primary action');
    assert.equal(d.querySelectorAll('.card-link').length, 1);
  } finally { dom.window.close(); }
});

test('sort uses real timestamps/discount fields and category filters remain independently usable', async () => {
  const dom = await hydrate();
  try {
    const d = dom.window.document, sort = d.querySelector('#sort-order');
    assert.ok(sort, 'sort control missing');
    assert.equal(sort.value, 'newest');
    change(dom, sort, 'discount');
    const discounts = [...d.querySelectorAll('.card-link')].map(a => Number(data.posts.find(p => p.url === a.href).discount) || 0);
    assert.deepEqual(discounts, discounts.slice().sort((a, b) => b - a));
    const cat = d.querySelector('.chip[data-cat="Home & Kitchen"]');
    assert.ok(cat, 'on-page category filter missing');
    cat.click();
    for (const a of d.querySelectorAll('.card-link')) assert.equal(data.posts.find(p => p.url === a.href).category, 'Home & Kitchen');
  } finally { dom.window.close(); }
});

test('coupon conditions and full titles survive compact rendering; copy and share use literal values', async () => {
  // Test-only fixture, never written into the feed or preview artifacts.
  const title = 'Long product title requiring Subscribe & Save and a clipped coupon for the stated offer';
  const url = 'https://www.amazon.com/dp/B000000001?tag=noya0b-20&th=1';
  const dom = await hydrate({ posts: [{ title, url, slug: 'test-only', category: 'Home & Kitchen', asin: 'B000000001', ts: '2026-09-16T12:00:00Z', promoCode: 'SAVE<&20', discount: 0 }] });
  try {
    const d = dom.window.document;
    const copies = [];
    Object.defineProperty(dom.window.navigator, 'clipboard', { value: { writeText: async text => copies.push(text) } });
    assert.equal(d.querySelector('.card-title')?.textContent, title);
    assert.equal(d.querySelector('.card-title')?.getAttribute('title'), title);
    assert.ok(d.querySelector('.deal-card').classList.contains('has-conditions'), 'offer title must not be visually clamped');
    assert.equal(d.querySelector('.promo-copy')?.dataset.code, 'SAVE<&20');
    d.querySelector('.promo-copy').click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(copies[0], 'SAVE<&20');
    d.querySelector('.share-btn').click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(copies[1], url);
    // The outbound link names its destination rather than a generic action.
    // It is a text line now, not a button — Slickdeals-style — but it must
    // still state where the tap goes, which is also the FTC disclosure.
    const outLink = d.querySelector('.card-link');
    assert.match(outLink?.textContent || '', /Amazon/);
    assert.match(outLink?.getAttribute('rel') || '', /sponsored/);
    // The destination stays in the accessible name rather than the visible
    // label, which wrapped to two lines in the compact card.
    assert.match(d.querySelector('.card-link')?.getAttribute('aria-label') || '', /on Amazon/);
    assert.equal(d.querySelector('.price-current'), null);
  } finally { dom.window.close(); }
});

test('category page retains cards and SEO prose below the grid, with compact navigation and view toggle', () => {
  const d = new JSDOM(html('category/grocery-food/index.html')).window.document;
  assert.ok(d.querySelector('.compact-menu'));
  assert.ok(d.querySelector('.category-picker summary'));
  const grid = d.querySelector('#deals-grid');
  assert.ok(grid, 'shared category grid missing');
  assert.equal(grid.dataset.view, 'grid');
  assert.ok(grid.compareDocumentPosition(d.querySelector('.hero-intro')) & 4);
  assert.ok(d.querySelector('#view-toggle'));
  for (const a of grid.querySelectorAll('a.card')) assert.match(a.getAttribute('href'), /^\/deals\/.+\/$/);
  for (const title of grid.querySelectorAll('.card-title')) assert.equal(title.title, title.textContent);
});

test('private UI changes leave tracked feed files byte-for-byte untouched', () => {
  const diff = execFileSync('git', ['diff', '--name-only', '--', 'src/data', 'public/site-data.json'], { encoding: 'utf8' });
  assert.equal(diff, '');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
const url = 'https://deals.shoppingwithnoya.com/guides/compare-beauty-deals/';
const expectedSources = ["https://www.fda.gov/cosmetics/cosmetics-labeling-regulations/cosmetics-labeling-guide", "https://www.fda.gov/regulatory-information/search-fda-guidance-documents/cpg-sec140500-metric-declarations-quantity-contents-product-labels", "https://theordinary.com/en-us/the-daily-set-100649.html", "https://www.charlottetilbury.com/us/product/charlottes-magic-cream-moisturiser-refill-50ml", "https://www.ulta.com/guestservices/ways-to-shop/replenish-and-save", "https://www.ulta.com/guestservices/all", "https://theordinary.com/en-us/niacinamide-10-zinc-1-serum-100436.html", "https://theordinary.com/en-us/niacinamide-5-face-body-serum-100661.html"];
test('approved beauty guide preserves every prose block, hypothetical example and official source', () => {
  const dom = new JSDOM(readFileSync(new URL('../dist/guides/compare-beauty-deals/index.html', import.meta.url), 'utf8'));
  try {
    const d = dom.window.document, article = d.querySelector('article.shopping-guide');
    assert.equal(d.querySelectorAll('h1').length, 1);
    assert.equal(d.querySelector('link[rel="canonical"]').href, url);
    assert.ok(!d.querySelector('meta[name="robots"]')?.content.includes('noindex'));
    assert.equal(article.querySelector('.review-date').textContent, 'Published November 9, 2026 · Sources checked November 8, 2026');
    const blocks = [...article.querySelectorAll('h1,h2,h3,p,li')].filter(e => !e.matches('.review-date'));
    const prose = blocks.map(e => e.textContent).join(' ').replace(/\s+/g,' ').trim();
    assert.equal(createHash('sha256').update(prose).digest('hex'), 'ac0f6e061da006122a9600b7ce3cb85aee6dc84e4d9fb2ef0544edc22755a0d5');
    assert.deepEqual([...article.querySelectorAll('.sources a')].map(a=>a.href), expectedSources);
    for (const a of article.querySelectorAll('a[href^="#source-"]')) assert.ok(d.getElementById(a.hash.slice(1)), a.hash);
    assert.equal(article.querySelectorAll('.sources p').length, 8);
    assert.ok(article.querySelector('a[href="https://deals.shoppingwithnoya.com/category/beauty/"]'));
    assert.ok(!prose.includes('Draft for Sarah'));
  } finally { dom.window.close(); }
});
test('beauty guide is discoverable in hub and framework sitemap without publishing deferred drafts', () => {
  const dom = new JSDOM(readFileSync(new URL('../dist/guides/index.html',import.meta.url),'utf8'));
  try {
    const d=dom.window.document;
    assert.ok(d.querySelector('main a.guide-card[href="/guides/compare-beauty-deals/"]'));
    assert.equal(d.querySelectorAll('main a[href^="/guides/"]').length,2);
    for (const a of d.querySelectorAll('main a')) assert.ok(!/compare-unit-prices|seint/i.test(a.href));
  } finally { dom.window.close(); }
  assert.ok(readFileSync(new URL('../dist/sitemap-0.xml',import.meta.url),'utf8').includes(url+'</loc>'));
});

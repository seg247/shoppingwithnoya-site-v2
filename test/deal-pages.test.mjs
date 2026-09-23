import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { cleanText, dealMetadata } from '../src/lib/deal-metadata.mjs';

const { posts } = JSON.parse(readFileSync(new URL('../src/data/site-data.json', import.meta.url)));
const documents = posts.map(deal => {
  const path = new URL(`../dist/deals/${deal.slug}/index.html`, import.meta.url);
  assert.ok(existsSync(path), `Missing built route ${deal.slug}`);
  const window = new JSDOM(readFileSync(path, 'utf8')).window;
  const doc = window.document;
  const result = {
    deal,
    title: doc.title,
    description: doc.querySelector('meta[name="description"]')?.content,
    h1: doc.querySelector('h1')?.textContent.trim(),
    affiliateUrl: doc.querySelector('.deal-btn')?.getAttribute('href'),
    summary: doc.querySelector('.deal-summary')?.textContent.trim(),
    schemas: [...doc.querySelectorAll('script[type="application/ld+json"]')].map(el => JSON.parse(el.textContent)),
  };
  window.close();
  return result;
});

test('every rendered deal uses concise metadata and keeps its full visible title', () => {
  for (const { deal, title, description, h1, affiliateUrl } of documents) {
    const expected = dealMetadata(deal);
    assert.equal(title, expected.title, deal.slug);
    assert.equal(description, expected.description, deal.slug);
    assert.equal(h1, cleanText(deal.title), deal.slug);
    assert.equal(affiliateUrl, deal.url, 'Affiliate URL changed');
  }
});

test('description does not repeat the full product heading before the purchase link', () => {
  for (const { h1, summary } of documents) {
    assert.ok(summary && !summary.includes(h1), 'Repeated product heading pushes the shopping action down');
  }
});

test('deal schema does not manufacture offers, sellers, stock or expiry from feed entries', () => {
  for (const { deal, schemas } of documents) {
    // The feed has no approved exact price/timestamp contract. Rich-result
    // eligibility cannot be manufactured from titles, discounts or post dates.
    const inspect = (node) => {
      if (!node || typeof node !== 'object') return;
      for (const [key, value] of Object.entries(node)) {
        assert.ok(!['offers', 'seller', 'availability', 'price', 'priceCurrency', 'priceValidUntil'].includes(key), `Unsupported ${key} on ${deal.slug}`);
        inspect(value);
      }
    };
    for (const schema of schemas) inspect(schema);
  }
});

test('deal pages retain WebPage metadata without unsupported Product rich-result entities', () => {
  for (const { deal, title, description, schemas } of documents) {
    const schema = schemas.find(s => s['@type'] === 'WebPage');
    assert.ok(schema, `No WebPage metadata for ${deal.slug}`);
    assert.equal(schema.name, title);
    assert.equal(schema.description, description);
    // Trailing slash is required: Astro builds /deals/<slug>/ and the host 301s
    // the slashless form. A canonical pointing at the redirect source split
    // every deal page's indexing signals. Must match the sitemap exactly.
    assert.equal(schema.url, `https://deals.shoppingwithnoya.com/deals/${deal.slug}/`);
    // Google detects Product even when nested under WebPage.about or @graph.
    // Until an approved offer/review source exists, do not emit that entity.
    const inspect = (node) => {
      if (!node || typeof node !== 'object') return;
      const types = [].concat(node['@type'] || []);
      for (const type of types) {
        assert.doesNotMatch(type, /(?:^|[/#:])Product(?:Group|Model)?$/, `Unsupported product entity on ${deal.slug}`);
      }
      for (const value of Object.values(node)) inspect(value);
    };
    for (const item of schemas) inspect(item);
  }
});

test('sitemap lastmod reflects real content dates, not build time', async () => {
  // Regression guard. The sitemap previously used `lastmod: new Date()`, so all
  // 636 URLs claimed to change on every rebuild (the bot rebuilds constantly).
  // Google documents that it ignores lastmod it judges unreliable, and a site
  // where every URL shares one ever-moving timestamp is exactly that case.
  const xml = readFileSync(new URL('../dist/sitemap-0.xml', import.meta.url), 'utf8');
  const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);

  assert.ok(lastmods.length > 100, 'expected a populated sitemap');

  // The core assertion: dates must vary. One shared value means build time.
  const distinct = new Set(lastmods);
  assert.ok(
    distinct.size > 50,
    `expected many distinct lastmod values, got ${distinct.size} across ${lastmods.length} URLs ` +
      '(all-identical means lastmod regressed to build time)'
  );

  // Old content must keep old dates rather than being stamped with today.
  const oldest = lastmods.slice().sort()[0];
  const ageDays = (Date.now() - new Date(oldest).getTime()) / 86400000;
  assert.ok(
    ageDays > 7,
    `oldest lastmod is only ${ageDays.toFixed(1)} days old; historical pages are being re-stamped`
  );

  // Date-addressed pages must agree with the date in their own URL.
  const pairs = [...xml.matchAll(/<url><loc>([^<]+)<\/loc>(?:(?!<\/url>)[\s\S])*?<lastmod>([^<]+)<\/lastmod>/g)];
  let checked = 0;
  for (const [, loc, lastmod] of pairs) {
    const m = loc.match(/\/(?:blog|beauty)\/(\d{4}-\d{2}-\d{2})\//);
    if (!m) continue;
    assert.equal(
      lastmod.slice(0, 10),
      m[1],
      `${loc} declares lastmod ${lastmod} but its URL says ${m[1]}`
    );
    checked += 1;
  }
  assert.ok(checked > 10, `expected to verify several date-addressed pages, checked ${checked}`);
});

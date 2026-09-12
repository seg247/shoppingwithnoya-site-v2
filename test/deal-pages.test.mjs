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
    assert.equal(schema.url, `https://deals.shoppingwithnoya.com/deals/${deal.slug}`);
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

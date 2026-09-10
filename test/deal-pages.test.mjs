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

test('descriptive schema matches visible copy, without claiming merchant rich-result eligibility', () => {
  for (const { deal, h1, summary, schemas } of documents) {
    const schema = schemas.find(s => s['@type'] === 'WebPage');
    assert.ok(schema, `No WebPage description for ${deal.slug}`);
    assert.equal(schema.about['@type'], 'Product');
    assert.equal(schema.about.name, h1);
    assert.equal(schema.about.description, summary);
    assert.ok(schema.about.description.length > 0);
    assert.equal(schema.about.brand, undefined, 'No verified brand is present in this captured feed');
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

// A missing implementation is an assertion failure, not a broken test import.
let api = {};
try { api = await import('../src/lib/deal-metadata.mjs'); }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const metadata = (deal) => {
  assert.equal(typeof api.dealMetadata, 'function', 'Missing dealMetadata implementation');
  return api.dealMetadata(deal);
};

test('short product title retains the complete name and site identity', () => {
  const value = metadata({ title: 'LEGO City Fire Truck', discount: 30 });
  assert.equal(value.title, 'LEGO City Fire Truck | Shopping With Noya');
  assert.match(value.description, /LEGO City Fire Truck/);
});

test('long title ends on a word boundary; full on-page name is unchanged', () => {
  const deal = { title: 'OBABALA Black Ceiling Fan No Light 52 Inch with Remote Control Reversible Motor Indoor Outdoor Patio', discount: 30 };
  const before = structuredClone(deal);
  const value = metadata(deal);
  assert.ok(Array.from(value.title).length <= 60);
  assert.match(value.title, /^OBABALA Black Ceiling Fan No Light… \| Shopping With Noya$/);
  assert.deepEqual(deal, before);
});

test('description fits editorial budget and never invents price or scarcity', () => {
  const value = metadata({ title: 'Comfortable family essentials '.repeat(30), discount: 0 });
  assert.ok(Array.from(value.description).length <= 155);
  assert.match(value.description, /retailer/);
  assert.doesNotMatch(value.description, /\$|verified|in stock|lowest|before it.s gone/i);
});

test('clean whitespace and control characters without breaking Unicode', () => {
  const value = metadata({ title: '  Café\nKids\t🌈\u0000 Rain Boots  ' });
  assert.match(value.title, /^Café Kids 🌈 Rain Boots \|/);
  assert.doesNotMatch(value.title, /\ufffd|[\n\t\u0000]/);
});

test('malformed source emoji does not leak a broken character into search snippets', () => {
  const value = metadata({ title: '\udecd\ufe0f T MARIE Appreciation Cards' });
  assert.equal(value.title, 'T MARIE Appreciation Cards | Shopping With Noya');
});

test('empty or nonstring product title receives a neutral fallback', () => {
  for (const title of ['', null, undefined, 12]) {
    assert.equal(metadata({ title }).title, 'Product deal | Shopping With Noya');
  }
});

test('very long unbroken product name does not produce broken surrogate characters', () => {
  const value = metadata({ title: '🌈'.repeat(100) });
  assert.ok(Array.from(value.title).length <= 60);
  assert.doesNotMatch(value.title, /\ufffd/);
});

test('all captured feed titles/descriptions fit budgets without altering data', async () => {
  const { posts } = JSON.parse(await readFile(new URL('../src/data/site-data.json', import.meta.url)));
  assert.ok(posts.length > 0);
  for (const deal of posts) {
    const value = metadata(deal);
    assert.ok(Array.from(value.title).length <= 60, deal.slug);
    assert.ok(Array.from(value.description).length <= 155, deal.slug);
    assert.ok(value.description.length > 0);
  }
});

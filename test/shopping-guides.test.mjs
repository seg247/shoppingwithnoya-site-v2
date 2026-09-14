import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const root = new URL('../dist/', import.meta.url);
const guidePath = 'guides/amazon-coupons-subscribe-save/index.html';
const doc = path => new JSDOM(readFileSync(new URL(path, root), 'utf8')).window.document;

test('approved Amazon guide is a built, indexable page with sources and honest subscription cautions', () => {
  assert.ok(existsSync(new URL(guidePath, root)), 'Approved guide must be built');
  const d = doc(guidePath);
  assert.equal(d.querySelectorAll('h1').length, 1);
  assert.equal(d.querySelector('h1').textContent, 'Amazon Coupons & Subscribe & Save: Check What You’ll Actually Pay');
  assert.equal(d.querySelector('link[rel="canonical"]').href, 'https://deals.shoppingwithnoya.com/guides/amazon-coupons-subscribe-save/');
  assert.ok(!d.querySelector('meta[name="robots"]')?.content.includes('noindex'));
  const text = d.querySelector('article').textContent.replace(/\s+/g, ' ');
  for (const phrase of ['As an Amazon Associate, I earn from qualifying purchases.', 'Do not assume a first-delivery coupon repeats on later orders.', 'Last day to update this order', 'Cancel my subscription', 'Do I need Amazon Prime?']) assert.ok(text.includes(phrase), phrase);
  assert.equal(d.querySelectorAll('article .sources a').length, 4);
  assert.ok(d.querySelector('article a[href="https://deals.shoppingwithnoya.com/"]'));
  for (const a of d.querySelectorAll('article a[href^="#"]')) assert.ok(d.getElementById(a.hash.slice(1)), a.hash);
});

test('home and shared layout expose a static Shopping Guides link; hub links to approved guide only', () => {
  for (const file of ['index.html', guidePath]) {
    assert.ok(doc(file).querySelector('a[href="/guides/"]'), `${file}: visible guide navigation required`);
  }
  assert.ok(existsSync(new URL('guides/index.html', root)), 'Guide hub must be built');
  const d = doc('guides/index.html');
  assert.ok(d.querySelector('main a[href="/guides/amazon-coupons-subscribe-save/"]'));
  assert.equal(d.querySelectorAll('main a[href^="/guides/"]').length, 1);
});

test('both permanent guide URLs appear in the sitemap', () => {
  const sitemap = readFileSync(new URL('sitemap-0.xml', root), 'utf8');
  for (const path of ['/guides/', '/guides/amazon-coupons-subscribe-save/']) assert.ok(sitemap.includes(`https://deals.shoppingwithnoya.com${path}</loc>`), path);
});

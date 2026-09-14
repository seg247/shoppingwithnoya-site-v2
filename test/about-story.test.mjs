import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../dist/about/index.html', import.meta.url), 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;
const normalize = value => value.replace(/\s+/g, ' ').trim();

test('About introduction preserves Sarah’s approved wording', () => {
  const paragraphs = [...doc.querySelectorAll('main > p')].slice(0, 3).map(p => normalize(p.textContent));
  assert.deepEqual(paragraphs, [
    'Hi, I’m Sarah, the person behind Shopping With Noya.',
    'I grew up with a mom who used coupons and knew how to find a good bargain. Now, I want to help other people save money, too.',
    'Shopping With Noya is for anyone looking to make their money go further, whether you’re shopping for everyday essentials or something special.',
  ]);
});

test('About metadata and author FAQ do not retain the unconfirmed origin story', () => {
  assert.doesNotMatch(html, /got tired|sharing deals with friends and family|It started as deals shared/);
  assert.match(doc.querySelector('meta[name="description"]').content, /Sarah/);
  const objects = [...doc.querySelectorAll('script[type="application/ld+json"]')].map(e => JSON.parse(e.textContent));
  const faq = objects.find(x => x['@type'] === 'FAQPage');
  assert.match(faq.mainEntity.find(x => x.name === 'Who runs Shopping With Noya?').acceptedAnswer.text, /mom who used coupons/);
  assert.equal(doc.querySelector('link[rel="canonical"]').href, 'https://deals.shoppingwithnoya.com/about/');
  assert.ok([...doc.querySelectorAll('a')].some(a => a.href === 'https://t.me/shoppingwithnoya'));
});

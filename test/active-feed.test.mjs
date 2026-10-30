import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const policy = new Proxy({}, {get: (_, name) => (...args) => require('../src/lib/active-feed.cjs')()[name](...args)});
const data = JSON.parse(readFileSync(new URL('../src/data/site-data.json', import.meta.url)));
const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
async function hydrate(fixture = data, query = '') {
 const dom = new JSDOM(html, { url: 'https://deals.shoppingwithnoya.com/' + query, runScripts: 'outside-only' });
 dom.window.fetch = async () => ({ json: async () => fixture });
 for (const script of dom.window.document.scripts) if (script.textContent.includes('NoyaFeedPolicy') || script.textContent.includes('const DATA_URL')) dom.window.eval(script.textContent);
 await new Promise(resolve => setTimeout(resolve, 20));return dom;
}
test('server and actual inline client share exact eligibility implementation', () => {
 const d = new JSDOM(html).window.document;
 const source = [...d.scripts].find(s => s.textContent.includes('window.NoyaFeedPolicy ='));
 assert.ok(source);const vm = new JSDOM('', {runScripts:'outside-only'});vm.window.eval(source.textContent);
 const fixture = [{url:'https://example.com', imageUrl:'https://example.com/image.jpg'}, {url:'https://example.com', imageUrl:null}, {url:'https://example.com',imageUrl:'https://example.com/image.jpg',expiresAt:'2026-10-25T06:59Z'}];
 for(const p of fixture) assert.equal(vm.window.NoyaFeedPolicy.eligibility(p, Date.parse('2026-10-29T20:00Z')), policy.eligibility(p, Date.parse('2026-10-29T20:00Z')));
 vm.window.close();
});
test('SSR and hydrated Latest omit ineligible entries with full match counts and retained routes', async () => {
 const expected = policy.activeDeals(data.posts, { latest: true });
 const d = new JSDOM(html).window.document;
 assert.equal(d.querySelectorAll('#deals-grid .deal-card').length, Math.min(60, expected.length));
 assert.equal(d.querySelector('#deal-count').textContent, `${expected.length} deals`);
 assert.equal(Number(d.querySelector('#stat-total').textContent), policy.activeDeals(data.posts).length);
 for (const p of data.posts.filter(p => policy.eligibility(p) !== 'active')) {
  assert.ok(existsSync(new URL(`../dist/deals/${p.slug}/index.html`, import.meta.url)), p.slug);
  assert.ok(![...d.querySelectorAll('#deals-grid a')].some(a => a.getAttribute('href') === `/deals/${p.slug}/`));
 }
 const dom = await hydrate();try {
  const client=dom.window.document;
  assert.equal(client.querySelector('#deal-count').textContent, `${expected.length} deals`);
  assert.equal(client.querySelectorAll('#deals-grid .deal-card').length, Math.min(60, expected.length));
  assert.equal(Number(client.querySelector('#stat-total').textContent), policy.activeDeals(data.posts).length);
 } finally {dom.window.close();}
});
test('client search, category, promo and pagination never reintroduce expired/imageless entries', async () => {
 const good={title:'Current product',url:'https://example.com/current',imageUrl:'https://example.com/image.jpg',category:'Beauty',promoCode:'SAFE',ts:new Date().toISOString()};
 const fixture={posts:[{...good,title:'NYX Professional Makeup',imageUrl:null},{...good,title:'Expired product',expiresAt:'2026-10-25T06:59Z'},...Array.from({length:65},(_,i)=>({...good,title:`Current product ${i}`,asin:`B${String(i).padStart(9,'0')}`}))]};
 const dom=await hydrate(fixture);try {
 const d=dom.window.document;assert.equal(d.querySelector('#deal-count').textContent,'65 deals');assert.equal(d.querySelectorAll('#deals-grid .deal-card').length,60);
 d.querySelector('#load-more-btn').click();assert.equal(d.querySelectorAll('#deals-grid .deal-card').length,65);
 d.querySelector('[data-cat="__promo__"]').click();assert.equal(d.querySelector('#deal-count').textContent,'65 deals');
 d.querySelector('[data-cat="Beauty"]').click();assert.equal(d.querySelector('#deal-count').textContent,'65 deals');
 } finally {dom.window.close();}
 for(const q of ['NYX','Expired']) { const dom=await hydrate(fixture,`?q=${q}`);assert.equal(dom.window.document.querySelector('#deal-count').textContent,'0 deals');dom.window.close(); }
});

test('category grids use the same active policy while preserving category routes', () => {
 const ineligible = data.posts.filter(p => policy.eligibility(p) !== 'active');
 for (const category of ['beauty', 'fashion', 'home-kitchen']) {
  const path = new URL(`../dist/category/${category}/index.html`, import.meta.url);
  if (!existsSync(path)) continue;
  const d = new JSDOM(readFileSync(path, 'utf8')).window.document;
  for(const p of ineligible) assert.ok(![...d.querySelectorAll('a')].some(a => a.getAttribute('href') === `/deals/${p.slug}/`), p.slug);
 }
});

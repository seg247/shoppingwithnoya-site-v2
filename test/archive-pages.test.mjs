import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { archiveEntries } from '../src/lib/deal-archive.mjs';
const data=JSON.parse(readFileSync(new URL('../src/data/site-data.json',import.meta.url),'utf8'));
const archives=archiveEntries(data);
test('archived exact URLs render useful noindex pages without old offer claims',()=>{
 const sitemap=readFileSync(new URL('../dist/sitemap-0.xml',import.meta.url),'utf8');
 for(const p of archives){
  const path=new URL('../dist/deals/'+p.slug+'/index.html',import.meta.url);
  assert.ok(existsSync(path),'Missing archive page '+p.slug);
  const d=new JSDOM(readFileSync(path,'utf8')).window.document;
  assert.equal(d.querySelector('meta[name=robots]').content,'noindex, follow');
  assert.ok(!sitemap.includes('/deals/'+p.slug+'</loc>') && !sitemap.includes('/deals/'+p.slug+'/</loc>'));
  const article=d.querySelector('.archived-deal');
  assert.ok(article.textContent.includes('this offer has not been rechecked'));
  assert.ok(article.textContent.includes('The original discount may no longer be available'));
  assert.ok(!article.querySelector('img,.badge-price,.badge-discount,.badge-rating'));
  assert.ok(!article.textContent.includes('Grab This Deal'));
  assert.equal(article.querySelector('.archive-retailer').href,p.url);
  assert.equal(article.querySelector('.archive-retailer').textContent.trim(),'Check current price at Amazon');
  assert.ok(article.querySelector('a[href="/guides/"]'));
  for(const a of article.querySelectorAll('a[href^="/"]'))assert.ok(existsSync(new URL('../dist'+a.getAttribute('href')+'index.html',import.meta.url)));
  for(const s of d.querySelectorAll('script[type="application/ld+json"]'))assert.ok(!/"@type"\s*:\s*"(?:Product|Offer|AggregateOffer)"/.test(s.textContent));
 }
});
test('active routes are preserved alongside archives',()=>{
 for(const p of data.posts)assert.ok(existsSync(new URL('../dist/deals/'+p.slug+'/index.html',import.meta.url)));
});

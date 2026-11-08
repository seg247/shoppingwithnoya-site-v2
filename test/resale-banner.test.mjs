import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
const policy=createRequire(import.meta.url)('../src/lib/active-feed.cjs')();
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
const data=JSON.parse(readFileSync(new URL('../src/data/site-data.json',import.meta.url)));
const href='https://poshmark.com/closet/noyascloset';
function check(d,n){
 const grid=d.querySelector('#deals-grid');
 const cards=[...grid.querySelectorAll(':scope > .deal-card')];
 const banners=[...grid.querySelectorAll(':scope > .resale-banner')];
 assert.equal(cards.length,Math.min(n,60));
 assert.equal(banners.length,n>=15?1:0);
 assert.equal(d.querySelectorAll('.resale-banner').length,banners.length);
 assert.equal(d.querySelector('#deal-count').textContent,`${n} deals`);
 if(n>=15){const b=banners[0];assert.equal([...grid.children].indexOf(b),15);assert.equal(b.querySelector('a').getAttribute('href'),href);assert.equal(b.querySelector('a').rel,'noopener noreferrer');assert.ok(!b.matches('.deal-card'));assert.ok(!b.querySelector('button'));const img=b.querySelector('img');assert.equal(img.getAttribute('width'),'1600');assert.equal(img.getAttribute('height'),'1600');assert.equal(img.getAttribute('loading'),'lazy');assert.ok(!img.hasAttribute('fetchpriority'));assert.ok(!/\$|discount|promo code|starting at/i.test(b.textContent));}
 return cards;
}
const fixture=n=>({posts:Array.from({length:n},(_,i)=>({title:`Fixture product ${i}`,asin:`B${String(i).padStart(9,'0')}`,slug:`fixture-${i}`,url:`https://example.com/product/${i}`,imageUrl:'https://example.com/product.jpg',category:i<14?'Beauty':'Fashion',promoCode:i<15?'TEST':'',discount:i,ts:new Date(Date.now()-i*60000).toISOString()}))});
async function hydrate(feed,query=''){
 const dom=new JSDOM(html,{url:'https://deals.shoppingwithnoya.com/'+query,runScripts:'outside-only'});
 dom.window.fetch=async()=>({json:async()=>feed});
 for(const s of dom.window.document.scripts)if(s.textContent.includes('window.NoyaFeedPolicy =')||s.textContent.includes('const DATA_URL')||s.hasAttribute('data-deal-view-controls'))dom.window.eval(s.textContent);
 await new Promise(r=>setTimeout(r,30));return dom;
}
test('SSR real homepage inserts once after fifteen actual deals and keeps all detail URLs',()=>{const dom=new JSDOM(html);try{const expected=policy.activeDeals(data.posts,{latest:true});const cards=check(dom.window.document,expected.length);assert.deepEqual(cards.map(a=>a.getAttribute('href')),expected.slice(0,60).map(p=>`/deals/${p.slug}/`));for(const p of expected.slice(0,60))assert.ok(existsSync(new URL(`../dist/deals/${p.slug}/index.html`,import.meta.url)));}finally{dom.window.close();}});
for(const n of [0,14,15,16,60,61])test(`actual built client ${n} matches retains count, order and one banner`,async()=>{const feed=fixture(n),dom=await hydrate(feed);try{const d=dom.window.document;check(d,n);assert.deepEqual([...d.querySelectorAll('#deals-grid .card-link')].map(a=>a.href),feed.posts.slice(0,60).map(p=>p.url));if(n===61){assert.match(d.querySelector('#load-more-btn').textContent,/1 remaining/);d.querySelector('#load-more-btn').click();assert.equal(d.querySelectorAll('#deals-grid .deal-card').length,61);assert.equal(d.querySelectorAll('.resale-banner').length,1);assert.equal([...d.querySelector('#deals-grid').children].indexOf(d.querySelector('.resale-banner')),15);assert.equal(d.querySelector('#deal-count').textContent,'61 deals');assert.deepEqual([...d.querySelectorAll('#deals-grid .card-link')].map(a=>a.href),feed.posts.map(p=>p.url));}}finally{dom.window.close();}});
test('SSR to client hydration preserves full source match total and destinations without duplicate',async()=>{const dom=await hydrate(data);try{const expected=policy.activeDeals(data.posts,{latest:true});check(dom.window.document,expected.length);assert.deepEqual([...dom.window.document.querySelectorAll('#deals-grid .card-link')].map(a=>a.getAttribute('href')),expected.slice(0,60).map(p=>p.url));}finally{dom.window.close();}});
test('pagination resets on sort/categories/search/clear and banner follows actual matches',async()=>{const dom=await hydrate(fixture(61));try{const d=dom.window.document;d.querySelector('#load-more-btn').click();const sort=d.querySelector('#sort-order');sort.value='discount';sort.dispatchEvent(new dom.window.Event('change'));check(d,61);assert.equal(d.querySelector('.card-link').href,'https://example.com/product/60');d.querySelector('[data-cat="Beauty"]').click();check(d,14);d.querySelector('[data-cat="all"]').click();check(d,61);d.querySelector('[data-cat="__promo__"]').click();check(d,15);d.querySelector('[data-cat="all"]').click();d.querySelector('#load-more-btn').click();const input=d.querySelector('#search-input');input.value='no-such-product';input.dispatchEvent(new dom.window.Event('input'));await new Promise(r=>setTimeout(r,250));check(d,0);d.querySelector('#search-clear').click();check(d,61);assert.equal(d.activeElement,input);assert.equal(d.querySelector('[data-cat="all"]').getAttribute('aria-pressed'),'true');}finally{dom.window.close();}});
test('URL search below threshold never leaves SSR banner behind',async()=>{const dom=await hydrate(fixture(61),'?q=no-such-product');try{check(dom.window.document,0);dom.window.document.querySelector('#search-clear').click();check(dom.window.document,61);}finally{dom.window.close();}});
test('unrelated built pages never contain resale banner',()=>{for(const rel of ['about/index.html','category/beauty/index.html','blog/index.html']){const path=new URL('../dist/'+rel,import.meta.url);assert.ok(existsSync(path));const dom=new JSDOM(readFileSync(path,'utf8'));try{assert.equal(dom.window.document.querySelectorAll('.resale-banner').length,0);}finally{dom.window.close();}}});
if(process.env.BANNER_SSR_FIXTURES_DIR)for(const n of [0,14,15,16,60,61])test(`actual Astro SSR build ${n} matches`,()=>{const dom=new JSDOM(readFileSync(`${process.env.BANNER_SSR_FIXTURES_DIR}/ssr-${n}.html`,'utf8'));try{check(dom.window.document,n);}finally{dom.window.close();}});

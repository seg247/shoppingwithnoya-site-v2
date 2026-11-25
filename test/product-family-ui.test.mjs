import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {JSDOM} from 'jsdom';
const require=createRequire(import.meta.url);
const {activeDeals}=require('../src/lib/active-feed.cjs')();
const data=JSON.parse(readFileSync(new URL('../src/data/site-data.json',import.meta.url)));
const html=readFileSync(new URL('../dist/index.html',import.meta.url),'utf8');
for(const category of ['Electronics','Fashion','Home & Kitchen','Beauty']) test(`category ${category}: filter before grouping; exact order and count`,()=>{
 const slug=category.toLowerCase().replace(/[^a-z0-9]+/g,'-');
 const path=new URL(`../dist/category/${slug}/index.html`,import.meta.url);
 assert.ok(existsSync(path));
 const d=new JSDOM(readFileSync(path,'utf8')).window.document;
 const expected=activeDeals(data.posts,{categories:[category],sort:'discount'}).map(p=>`/deals/${p.slug}/`);
 const actual=[...d.querySelectorAll('a.card')].map(a=>a.getAttribute('href'));
 assert.deepEqual(actual,expected);
});
test('hydrated family projection handles search category sort and pagination with exact counts',async()=>{
 const dom=new JSDOM(html,{url:'https://deals.shoppingwithnoya.com/',runScripts:'outside-only'});
 dom.window.fetch=async()=>({json:async()=>data});
 for(const s of dom.window.document.scripts)if(s.textContent.includes('NoyaFeedPolicy')||s.textContent.includes('const DATA_URL'))dom.window.eval(s.textContent);
 await new Promise(r=>setTimeout(r,30));
 try{
 const d=dom.window.document;
 const check=opts=>{const expected=activeDeals(data.posts,{latest:true,...opts});assert.equal(d.querySelector('#deal-count').textContent,`${expected.length} deals`);assert.deepEqual([...d.querySelectorAll('#deals-grid .card-cta')].map(a=>a.getAttribute('href')),expected.slice(0,60).map(p=>p.url));};
 check({});d.querySelector('[data-cat="Electronics"]').click();check({categories:['Electronics']});
 d.querySelector('[data-cat="all"]').click();
 const input=d.querySelector('#search-input');input.value='Silver';input.dispatchEvent(new dom.window.Event('input'));await new Promise(r=>setTimeout(r,350));check({search:'Silver'});
 input.value='';input.dispatchEvent(new dom.window.Event('input'));await new Promise(r=>setTimeout(r,350));
 const sort=d.querySelector('#sort-order');sort.value='discount';sort.dispatchEvent(new dom.window.Event('change'));check({sort:'discount'});
 d.querySelector('#load-more-btn').click();const expected=activeDeals(data.posts,{latest:true,sort:'discount'});assert.equal(d.querySelectorAll('#deals-grid .deal-card').length,Math.min(120,expected.length));
 }finally{dom.window.close();}
});

test('homepage footer counts equal each category projection, not globally selected representatives',()=>{
 const d=new JSDOM(html).window.document;
 for(const a of d.querySelectorAll('.footer-cats-links a')){
 const name=a.textContent.replace(/^[^a-z]+/i,'').replace(/\s*\(\d+\)\s*$/,'').trim();
 const count=Number(a.textContent.match(/\((\d+)\)/)[1]);
 assert.equal(count,activeDeals(data.posts,{categories:[name]}).length,name);
 }
});

test('zero-eligible historical category does not create a dead homepage filter chip',()=>{
 // A dedicated isolated build fixture adds only an expired category record.
 // Without that fixture, test the same invariant on the current build.
 const d=new JSDOM(html).window.document;
 for(const chip of d.querySelectorAll('#chips [data-cat]')){
 const category=chip.getAttribute('data-cat');if(['all','__promo__'].includes(category))continue;
 assert.ok(activeDeals(data.posts,{categories:[category]}).length>0,category);
 }
});

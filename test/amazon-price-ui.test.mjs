import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {JSDOM} from 'jsdom';
const root=new URL('../',import.meta.url);
const data=JSON.parse(readFileSync(new URL('src/data/site-data.json',root)));
const amazon=data.posts.find(x=>x.asin&&x.url.includes('amazon.com'));
const route='dist/deals/'+amazon.slug+'/index.html';
function dom(){return new JSDOM(readFileSync(new URL(route,root),'utf8'),{url:'https://deals.shoppingwithnoya.com/deals/'+amazon.slug+'/',runScripts:'outside-only'});}
test('built Amazon detail has a safe price placeholder and policy disclaimers',()=>{
 const d=dom();try{assert.ok(d.window.document.querySelector('[data-amazon-price]'));assert.match(d.window.document.body.textContent,/Product prices and availability are accurate/);assert.match(d.window.document.body.textContent,/CERTAIN CONTENT THAT APPEARS/);}finally{d.window.dispatchEvent(new d.window.Event("pagehide"));d.window.close()}
});
test('price runtime exists; fresh price renders, stale/mismatched/non-API prices fail closed',async()=>{
 const path=new URL('public/amazon-prices.js',root);assert.ok(existsSync(path),'missing API price runtime');
 const code=readFileSync(path,'utf8');
 for(const [change,valid] of [[{},true],[{observedAt:new Date(Date.now()-3600001).toISOString()},false],[{observedAt:new Date(Date.now()+60000).toISOString()},false],[{source:'scrape'},false],[{asin:'B000000000'},false],[{currency:'EUR'},false],[{amount:0},false],[{condition:'USED'},false],[{amount:NaN},false]]){
  const d=dom();try{
   const record={asin:amazon.asin,source:'AmazonCreatorsAPI',amount:4.99,currency:'USD',displayAmount:'$4.99',condition:'NEW',isBuyBoxWinner:true,observedAt:new Date().toISOString(),...change};record.expiresAt=new Date(Date.parse(record.observedAt)+3600000).toISOString();
   d.window.fetch=async()=>({ok:true,json:async()=>({version:1,items:{[amazon.asin]:record}})});
   d.window.eval(code);await new Promise(r=>setTimeout(r,15));
   const node=d.window.document.querySelector('[data-amazon-price]');assert.equal(node.hidden,!valid,JSON.stringify(change));if(valid){assert.match(node.textContent,/Amazon.com: \$4.99/);assert.match(node.textContent,/as of/);assert.ok(!node.textContent.includes('.xx'));}
  }finally{d.window.dispatchEvent(new d.window.Event("pagehide"));d.window.close()}
 }
});
test('price fetch failure leaves retailer link intact without numeric price',async()=>{
 const path=new URL('public/amazon-prices.js',root);assert.ok(existsSync(path));const d=dom();try{d.window.fetch=async()=>{throw Error('fixture offline')};d.window.eval(readFileSync(path,'utf8'));await new Promise(r=>setTimeout(r,15));assert.equal(d.window.document.querySelector('[data-amazon-price]').hidden,true);assert.equal(d.window.document.querySelector('.deal-btn').getAttribute('href'),amazon.url);}finally{d.window.dispatchEvent(new d.window.Event("pagehide"));d.window.close()}
});

test('browser runtime schedules clearing at the exact observed-price expiry',async()=>{
 const d=dom(),now=Date.now(),scheduled=[];let clock=now;
 try{d.window.Date.now=()=>clock;d.window.setTimeout=(fn,delay)=>{scheduled.push({fn,delay});return scheduled.length};const observedAt=new Date(now-3600000+750).toISOString();const record={asin:amazon.asin,source:'AmazonCreatorsAPI',amount:4.99,currency:'USD',displayAmount:'$4.99',condition:'NEW',isBuyBoxWinner:true,observedAt,expiresAt:new Date(now+750).toISOString()};d.window.fetch=async()=>({ok:true,json:async()=>({version:1,items:{[amazon.asin]:record}})});d.window.eval(readFileSync(new URL('public/amazon-prices.js',root),'utf8'));await new Promise(r=>setTimeout(r,15));assert.ok(scheduled.some(x=>x.delay>0&&x.delay<=751),'must schedule exact price expiry');clock=now+751;scheduled.find(x=>x.delay<=751).fn();assert.equal(d.window.document.querySelector('[data-amazon-price]').hidden,true);
 }finally{d.window.dispatchEvent(new d.window.Event('pagehide'));d.window.close()}
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const source = new URL('../public/qa-traffic.js', import.meta.url);
const fixture = '<a id="internal" href="/guides/?q=real#source">Guide</a><a id="fragment" href="#main">Skip</a><a id="merchant" href="https://www.amazon.com/dp/B000000001?tag=noya0b-20">Shop</a><a id="download" download href="/guide.pdf">File</a><form id="get" action="/"><input name="q"></form><form id="post" method="post" action="/contact/"></form>';
function run(query='') {
 const dom=new JSDOM(fixture,{url:'https://deals.shoppingwithnoya.com/'+query,runScripts:'outside-only'});
 assert.ok(existsSync(source),'QA marker runtime is missing');
 dom.window.eval(readFileSync(source,'utf8')); dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded')); return dom;
}
test('normal and malformed visits do not change links, forms, storage or analytics',()=>{
 for(const q of ['', '?noya_test=', '?noya_test=a&noya_test=b','?noya_test=user%40example.com','?noya_test='+('x'.repeat(65))]) {
  const d=run(q);try{assert.equal(d.window.document.body.innerHTML,new JSDOM(fixture).window.document.body.innerHTML);assert.equal(d.window.dataLayer,undefined);assert.equal(d.window.sessionStorage.length,0);assert.equal(d.window.localStorage.length,0);}finally{d.window.close();}
 }
});
test('explicit QA visit labels events before config and propagates only internal GET navigation',()=>{
 const d=run('?noya_test=qa-20261106');try{
  const doc=d.window.document;
  assert.deepEqual(JSON.parse(JSON.stringify(d.window.dataLayer[0])),{'0':'set','1':{noya_test:'qa-20261106'}});
  assert.equal(doc.querySelector('#internal').href,'https://deals.shoppingwithnoya.com/guides/?q=real&noya_test=qa-20261106#source');
  assert.equal(doc.querySelector('#fragment').getAttribute('href'),'#main');
  assert.equal(doc.querySelector('#merchant').getAttribute('href'),'https://www.amazon.com/dp/B000000001?tag=noya0b-20');
  assert.equal(doc.querySelector('#download').getAttribute('href'),'/guide.pdf');
  assert.equal(doc.querySelector('#get input[name=noya_test]').value,'qa-20261106');
  assert.equal(doc.querySelector('#post input[name=noya_test]'),null);
  assert.equal(d.window.sessionStorage.length,0);assert.equal(d.window.localStorage.length,0);
 } finally {d.window.close();}
});
test('new hydrated internal links are marked without changing merchant destinations',async()=>{
 const d=run('?noya_test=qa-next');try{
  const a=d.window.document.createElement('a');a.href='/deals/test/';d.window.document.body.append(a);
  await new Promise(r=>setTimeout(r,0));assert.equal(new URL(a.href).searchParams.get('noya_test'),'qa-next');
 }finally{d.window.close();}
});
test('all analytics-bearing emitted pages load QA treatment before the existing GA config',()=>{
 for(const route of ['index.html','about/index.html','contact/index.html','privacy/index.html','terms/index.html','blog/index.html','beauty/index.html','category/beauty/index.html','guides/index.html','404.html']){
  const html=readFileSync(new URL('../dist/'+route,import.meta.url),'utf8');
  const qa=html.indexOf('src="/qa-traffic.js"');
  assert.ok(qa>=0,'missing QA treatment: '+route);assert.ok(qa<html.indexOf('googletagmanager.com'),'QA must run before GA: '+route);
  assert.equal((html.match(/googletagmanager\.com\/gtag\/js\?id=G-T75YM7DVKJ/g)||[]).length,1,'no duplicate tag loader');
 }
});

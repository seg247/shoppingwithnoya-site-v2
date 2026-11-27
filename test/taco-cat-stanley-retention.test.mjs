import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {archiveEntries} from '../src/lib/deal-archive.mjs';
const d=JSON.parse(readFileSync(new URL('../src/data/site-data.json',import.meta.url),'utf8'));
test('Taco Cat displacement preserves exact historic Stanley as safe no-offer utility archive',()=>{
const p=archiveEntries(d).find(p=>p.slug==='b0cn1mvgwk-stanley-quencher-h2-o-flowstate-tumbler-40-oz-forrest-gloss-');assert.ok(p,'historic Stanley URL must survive');assert.equal(p.asin,'B0CN1MVGWK');assert.equal(p.url,'https://www.amazon.com/dp/B0CN1MVGWK?tag=noya0b-20');assert.equal(p.ts,'2026-11-17T02:00:57.797Z');assert.equal(p.category,'Home & Kitchen');assert.equal(p.status,'archived');assert.equal(p.price,undefined);assert.equal(p.imageUrl,undefined);
});

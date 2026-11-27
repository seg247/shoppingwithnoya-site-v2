import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { archiveEntries } from '../src/lib/deal-archive.mjs';
const data=JSON.parse(readFileSync(new URL('../src/data/site-data.json',import.meta.url),'utf8'));
const eeroSlug='b09hjgsnxb-amazon-eero-max-7-mesh-wifi-router-10-gbps-ethernet';
test('approved OXO insertion retains exact historic eero as safe utility archive',()=>{
 const eero=archiveEntries(data).find(p=>p.slug===eeroSlug);
 assert.ok(eero,'historic eero must survive latest-500 displacement');
 assert.equal(eero.asin,'B09HJGSNXB');
 assert.equal(eero.title,'Amazon eero Max 7 mesh wifi router | 10 Gbps Ethernet');
 assert.equal(eero.url,'https://www.amazon.com/dp/B09HJGSNXB?tag=noya0b-20');
 assert.equal(eero.ts,'2026-11-16T23:40:42.497Z');
 assert.equal(eero.status,'archived');
 assert.equal(eero.category,'Networking');
 assert.equal(eero.imageUrl,undefined);
 assert.equal(eero.price,undefined);
});
test('approved OXO has own destination and corrected campaign image without scraped offer claims',()=>{
 const p=[...data.posts,...archiveEntries(data)].find(p=>p.asin==='B00004OCKR');
 assert.ok(p);
 assert.equal(p.title,'OXO Good Grips Salad Spinner — White, Large 6.22 qt');
 assert.equal(p.url,'https://www.amazon.com/dp/B00004OCKR?tag=noya0b-20');
 if(p.status!=='archived') {
  assert.equal(p.imageUrl,'https://deals.shoppingwithnoya.com/images/B00004OCKR-feed-black-friday-v2.png');
  assert.ok(p.description.startsWith('BLACK FRIDAY FINDS'));
  assert.equal(p.discount,0);assert.equal(p.expiresAt,null);
 }
 assert.equal(p.price,undefined);assert.equal(p.campaign,undefined);
});

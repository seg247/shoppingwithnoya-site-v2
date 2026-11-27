import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {archiveEntries} from '../src/lib/deal-archive.mjs';
const data=JSON.parse(readFileSync(new URL('../src/data/site-data.json',import.meta.url),'utf8'));
test('approved exact Telescopic mascara persists with own destination and campaign art',()=>{
 const p=[...data.posts,...archiveEntries(data)].find(p=>p.asin==='B004BD107O');assert.ok(p,'approved mascara must be published');
 assert.equal(p.title,'L’Oreal Paris Original Telescopic Mascara, Lengthening, Blackest Black');
 assert.equal(p.url,'https://www.amazon.com/dp/B004BD107O?tag=noya0b-20');
 if(p.status!=='archived'){
  assert.equal(p.imageUrl,'https://deals.shoppingwithnoya.com/images/B004BD107O-feed-black-friday.png');
  assert.ok(p.description.startsWith('BLACK FRIDAY FINDS'));
  assert.ok(p.description.includes('Washable Blackest Black, 0.27 fl oz, single pack.'));
  assert.equal(p.discount,0);assert.equal(p.expiresAt,null);
 }
 assert.equal(p.price,undefined);assert.equal(p.campaign,undefined);
});

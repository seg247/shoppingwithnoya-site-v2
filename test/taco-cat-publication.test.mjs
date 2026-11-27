import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const d=JSON.parse(readFileSync(new URL('../src/data/site-data.json',import.meta.url),'utf8'));
test('approved original Taco Cat persists with unchanged own link and campaign artwork',()=>{
 const p=d.posts.find(p=>p.asin==='B077Z1R28P');assert.ok(p,'approved original game must be present');
 assert.equal(p.title,'Taco Cat Goat Cheese Pizza — Original card game');
 assert.equal(p.url,'https://www.amazon.com/dp/B077Z1R28P?tag=noya0b-20');
 assert.equal(p.category,'Toys & Kids');
 assert.equal(p.imageUrl,'https://deals.shoppingwithnoya.com/images/B077Z1R28P-feed-black-friday.png');
 assert.ok(p.description.startsWith('BLACK FRIDAY FINDS'));
 assert.ok(p.description.includes('Original card game for 2–8 players.'));
 assert.equal(p.discount,0);assert.equal(p.price,undefined);assert.equal(p.expiresAt,null);
 assert.equal(p.campaign.kind,'black-friday');assert.equal(p.campaign.validityBasis,'freshness-ttl');
});

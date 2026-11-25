import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require=createRequire(import.meta.url);
const { activeDeals }=require('../src/lib/active-feed.cjs')();
const now=Date.parse('2026-11-25T04:20:00Z');
const base={imageUrl:'https://example.com/image.jpg',url:'https://example.com/product',category:'Electronics',ts:'2026-11-24T00:00:00Z'};
const p=(title,i=1,extra={})=>({...base,title,asin:`B${String(i).padStart(9,'0')}`,...extra});
const snapshot=JSON.parse(readFileSync(new URL('../test/fixtures/product-family.json',import.meta.url)));
const families=[
 ['Beats Studio Pro',/^(Beats Studio Pro Over-Ear)/,1],
 ['Beats Apple adapter bundle',/^Beats Studio Pro Bluetooth.*Apple 20W/,1],
 ['Beats Solo 4',/^Beats Solo 4 On-Ear/,1],
 ['Oura Ring 5',/^Oura Ring 5 Smart Ring/,1],
 ['Samsung 8GB 256GB',/^Samsung Galaxy Tab A11\+ 8GB/,1],
 ['Samsung Kids 128GB',/^Samsung Galaxy Tab A11\+ Kids/,1],
 ['DualSense standard',/^PlayStation DualSense[™®]? Wireless Controller(?!.*Edition)/,1],
 ['adidas women VL Court 3.0',/^adidas Women's VL Court 3\.0/,1],
 ['STANLEY 30oz nonfluted',/^STANLEY Quencher H2\.0 Flow State Tumbler, 30 oz/,1],
 ['STANLEY 14oz',/^STANLEY Quencher H2\.0 Flow State Tumbler, 14 oz/,1],
 ['Sony WH1000XM6',/^Sony WH-1000XM6/,1],
 ['KitchenAid KSM150PS',/^KitchenAid KSM150PS(?!ACS)/,1],
 ['Keurig K-Express',/^Keurig K-Express Single Serve/,1],
 ['Skullcandy Crusher Evo',/^Skullcandy Crusher Evo Wireless/,1],
 ['Carhartt K288',/^Carhartt Men's Iconic K288 Logo Sweatshirt/,1],
 ['Pixel 11 Pro XL 256GB',/^Google Pixel 11 Pro XL.*256 GB/,1],
 ['STANLEY fluted 30oz',/^STANLEY Quencher H2\.0 Tumbler with Handle and Straw 30 oz/,1],
 ['STANLEY IceFlow 2.0',/STANLEY IceFlow 2\.0 Flip Straw Tumbler, 30 oz/,1],
 ['Owala FreeSip 32oz',/^Owala FreeSip Stainless Steel Water Bottle 32 oz/,1],
 ['Levis 505 explicit stretch',/^Levi's Men's 505 Regular Fit Jeans.*(?:Stretch|stretch)/,1],

];
for(const [name,re,count]of families)test(`snapshot: one card for ${name}`,()=>{
 const records=snapshot.posts.filter(x=>re.test(x.title));assert.ok(records.length>1,`${name}: fixture needs variants`);
 assert.equal(activeDeals(records,{now}).length,count);
});
test('newest matching variant wins regardless of input order; no records mutated',()=>{
 const old=p('Oura Ring 5 Smart Ring - Silver - Size 8',1);
 const fresh=p('Oura Ring 5 Smart Ring - Gold - Size 9',2,{ts:'2026-11-25T00:00:00Z'});
 const input=[old,fresh];const before=JSON.stringify(input);
 assert.deepEqual(activeDeals(input,{now}),[fresh]);assert.equal(JSON.stringify(input),before);
});
test('search and category match variants before grouping',()=>{
 const silver=p('Oura Ring 5 Smart Ring - Silver - Size 8',1,{category:'Sports & Fitness'});
 const gold=p('Oura Ring 5 Smart Ring - Gold - Size 9',2,{category:'Gold Box Deal',ts:'2026-11-25T00:00:00Z'});
 assert.deepEqual(activeDeals([silver,gold],{now,search:'silver'}),[silver]);
 assert.deepEqual(activeDeals([silver,gold],{now,categories:['Sports & Fitness']}),[silver]);
 assert.deepEqual(activeDeals([silver,gold],{now}),[gold]);
});
test('discount sorting selects highest-discount matching variant then newest tie',()=>{
 const cheap=p('Beats Solo 4 On-Ear Headphones - Black',1,{discount:30});
 const fresh=p('Beats Solo 4 On-Ear Headphones - Pink',2,{discount:10,ts:'2026-11-25T00:00:00Z'});
 assert.deepEqual(activeDeals([fresh,cheap],{now,sort:'discount'}),[cheap]);
});
test('expired variants cannot suppress eligible matching variants',()=>{
 const old=p('Oura Ring 5 Smart Ring - Silver - Size 8',1);
 const expired=p('Oura Ring 5 Smart Ring - Gold - Size 9',2,{expiresAt:'2026-11-24'});
 assert.deepEqual(activeDeals([expired,old],{now}),[old]);
});
const distinct=[
 ['Beats Studio Pro Over-Ear Headphones - Black','Beats Studio Pro Bluetooth Noise Cancelling Headphones with Apple 20W USB-C Power Adapter - Black'],
 ['Beats Solo 4 On-Ear Headphones - Pink','Beats Solo 3 On-Ear Headphones - Pink'],
 ['Oura Ring 5 Smart Ring - Silver - Size 8','Oura Ring 4 Smart Ring - Silver - Size 8'],
 ['Oura Ring 5 Smart Ring - Silver - Size 8','Oura Ring 5 Sizing Kit'],
 ['Samsung Galaxy Tab A11+ 8GB RAM, 256GB Storage, Gray','Samsung Galaxy Tab A11+ 6GB RAM, 128GB Storage, Gray'],
 ['Samsung Galaxy Tab A11+ 6GB RAM, 128GB Storage, Gray','Samsung Galaxy Tab A11+ Kids Edition, 128 GB Android Tablet, Blue'],
 ['Samsung Galaxy Tab A11+ 8GB RAM, 256GB Storage, Gray','Samsung Galaxy Tab A11+ 8GB RAM, 256GB Storage, Gray, 5G'],
 ['PlayStation DualSense Wireless Controller - Black','PlayStation DualSense Edge Wireless Controller - Black'],
 ['PlayStation DualSense Wireless Controller - Black','PlayStation DualSense Wireless Controller - Black with Charging Station Bundle'],
 ['STANLEY Quencher H2.0 Flow State Tumbler, 30 oz, Blue','STANLEY Quencher H2.0 Flow State Tumbler, 40 oz, Blue'],
 ['STANLEY Quencher H2.0 Flow State Tumbler, 30 oz, Blue','STANLEY Quencher H2.0 Tumbler with Handle and Straw'],
 ['STANLEY Quencher H2.0 Flow State Tumbler, 30 oz, Blue','STANLEY Quencher H2.0 Tumbler with Handle and Straw 30 oz | Fluted Blue'],
 ['STANLEY Quencher H2.0 Flow State Tumbler, 30 oz, Blue','STANLEY Quencher H2.0 Flow State Tumbler, 30 oz, Blue, 2-Pack'],
 ["adidas Women's VL Court 3.0, Blue, 5","adidas Men's VL Court 3.0, Blue, 5"],
 ["adidas Women's VL Court 3.0, Blue, 5","adidas Women's VL Court 3.0 Wide, Blue, 5"],
 ['KitchenAid KSM150PSBY Artisan Series 5-Qt. Stand Mixer - Blue','KitchenAid KSM150PSACS 5-Qt. Architect Series - Silver'],
 ['Sony WH-1000XM6 Wireless Headphones, Black','Sony WH-1000XM5 Wireless Headphones, Black'],
 ['Keurig K-Express Single Serve Coffee Maker, Black','Keurig K-Express Essentials Single Serve Coffee Maker, Black'],
 ['PlayStation DualSense Wireless Controller - Black','PlayStation DualSense Wireless Controller - Icon Blue Special Edition'],
 ['Google Pixel 11 Pro XL - Unlocked Smartphone - 256 GB - Blue','Google Pixel 11 Pro XL - Unlocked Smartphone - 1 TB - Blue'],
 ["Levi's Men's 505 Regular Fit Jeans, Caraway (Stretch), 29W x 30L","Levi's Men's 505 Regular Fit Jeans, Dark Slate, 29W x 30L"],
 ["Levi's Men's 505 Regular Fit Jeans | (Also Available in Big & Tall)","Levi's Men's 505 Regular Fit Jeans, Dark Slate, 29W x 30L"],
 ['Owala FreeSip Stainless Steel Water Bottle 32 oz Denim','Owala FreeSip Stainless Steel Water Bottle 24 oz Denim'],
 ['Generic shirt - Blue - Large','Generic shirt - Red - Small'],
 ['Unknown laptop 128GB Blue','Unknown laptop 256GB Blue'],
];
for(const [a,b]of distinct)test(`preserves distinction: ${a} / ${b}`,()=>assert.equal(activeDeals([p(a,1),p(b,2)],{now}).length,2));
test('next feed refresh recognizes new ASIN color without a stored family field',()=>{
 const input=[p('Beats Studio Pro Over-Ear Headphones - Deep Brown',3),p('Beats Studio Pro Over-Ear Headphones - Black',4)];
 assert.equal(activeDeals(input,{now}).length,1);
});

for(const [plain,extra]of [
 ['Oura Ring 5 Smart Ring - Gold - Size 8','with extra charger'],
 ['Oura Ring 5 Smart Ring - Gold - Size 8','Special Edition'],
 ['Samsung Galaxy Tab A11+ 8GB RAM, 256GB Storage, Silver','with keyboard and case'],
 ['KitchenAid KSM150PSBY Artisan Series 5-Qt. Stand Mixer - Blue','with extra bowl'],
 ['Skullcandy Crusher Evo Wireless Multi-Sensory Bass Headphones - Black','with adapter'],
])test(`explicit extra stays separate: ${plain} ${extra}`,()=>assert.equal(activeDeals([p(plain,1),p(`${plain} ${extra}`,2)],{now}).length,2));

test('missing or malformed titles retain identity and do not crash the feed',()=>{
 for(const title of [42,{},false,undefined,null]){
 assert.equal(activeDeals([p(title,1),p(title,2)],{now}).length,2);
 assert.equal(activeDeals([p(title,1,{category:42})],{now,search:'test'}).length,0);
 }
});

for(const [plain,extra]of [
 ['KitchenAid KSM150PSER Artisan Series 5-Qt. Stand Mixer - Red','with 2 Bowls'],
 ['Owala FreeSip Stainless Steel Water Bottle 24 oz Blue','with Cleaning Brush'],
 ['Beats Solo 4 On-Ear Headphones - Black','with mystery bonus'],
 ['Beats Studio Pro Bluetooth Noise Cancelling Headphones with Apple 20W USB-C Power Adapter - Sandstone','with Cleaning Brush'],
])test(`arbitrary explicit extra stays separate: ${plain} ${extra}`,()=>assert.equal(activeDeals([p(plain,1),p(`${plain} ${extra}`,2)],{now}).length,2));

test('independently verified 2026 Ring doorbell-only color ASINs group',()=>{
 const records=['B0G2D1R15Q','B0FHJ7TKZM','B0G2D25MF2'].map(asin=>p('Ring Battery Doorbell | Video Doorbell Camera',1,{asin}));
 assert.equal(activeDeals(records,{now}).length,1);
});
test('Ring unknown generation or changed bundle title stays separate',()=>{
 const plain=p('Ring Battery Doorbell | Video Doorbell Camera',1,{asin:'B0G2D1R15Q'});
 for(const extra of [p(plain.title,2),p(plain.title+' with Chime',3,{asin:'B0FHJ7TKZM'})])assert.equal(activeDeals([plain,extra],{now}).length,2);
});

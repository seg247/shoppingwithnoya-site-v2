import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
const moduleUrl=new URL('../src/lib/deal-archive.mjs',import.meta.url);
const old={slug:'b00nhqf6mg-old-brick-box',asin:'B00NHQF6MG',title:'LEGO Classic Large Creative Brick Box',url:'https://www.amazon.com/dp/B00NHQF6MG?tag=noya0b-20',category:'Toys & Kids',ts:'2026-09-01T12:00:00Z',archivedAt:'2026-09-14T12:00:00Z',status:'archived',discount:90,price:'$1.xx',rating:'FIRE',promoCode:'STALE',imageUrl:'https://example.com/old.jpg'};
test('archive renderer accepts minimal verified records but never renders stale promotion fields',async()=>{
 assert.ok(existsSync(moduleUrl),'archive route module required');
 const {archiveEntries}=await import(moduleUrl);
 const [result]=archiveEntries({posts:[],archivedPosts:[old]});
 assert.equal(result.slug,old.slug);
 assert.deepEqual(Object.keys(result).sort(),['archivedAt','asin','category','slug','status','title','ts','url'].sort());
});
test('current slug wins; old alias remains for same product; unsafe inputs fail closed',async()=>{
 assert.ok(existsSync(moduleUrl),'archive route module required');
 const {archiveEntries}=await import(moduleUrl);
 assert.equal(archiveEntries({posts:[old],archivedPosts:[old]}).length,0);
 assert.equal(archiveEntries({posts:[{...old,slug:'b00nhqf6mg-new-brick-box'}],archivedPosts:[old]}).length,1);
 for(const change of [{slug:'../../etc/passwd'},{url:'javascript:alert(1)'},{url:'https://amazon.com.evil.test/dp/B00NHQF6MG'},{url:'https://www.amazon.com/dp/B000000000'},{asin:'malformed'},{ts:'invalid'},{title:'LEGO 90% OFF Today Only $1.xx'},{title:'LEGO Classic Brick Box Today Only'},{status:'active'}]) assert.equal(archiveEntries({posts:[],archivedPosts:[{...old,...change}]}).length,0,JSON.stringify(change));
 assert.equal(archiveEntries({posts:[],archivedPosts:[old,old]}).length,1);
});
test('archive category links only point to built category routes',async()=>{
 assert.ok(existsSync(moduleUrl),'archive route module required');
 const {archiveCategoryLink}=await import(moduleUrl);
 assert.equal(archiveCategoryLink('Toys & Kids',[{category:'Toys & Kids'}]),null);
 assert.equal(archiveCategoryLink('Toys & Kids',Array.from({length:12},()=>({category:'Toys & Kids'}))),'/category/toys-kids/');
});

test('same product identity accepts changed tracking query but rejects mismatches',async()=>{
 const module=await import(moduleUrl);assert.equal(typeof module.amazonProductAsin,'function');
 assert.equal(module.amazonProductAsin('https://www.amazon.com/descriptive-title/dp/B00NHQF6MG?tag=other-20'),'B00NHQF6MG');
 assert.equal(module.amazonProductAsin('https://amazon.com/gp/product/B00NHQF6MG'),'B00NHQF6MG');
 assert.equal(module.amazonProductAsin('https://amazon.com.evil.test/dp/B00NHQF6MG'),null);
 assert.equal(module.amazonProductAsin('https://www.amazon.com/gp/help/'),null);
});

test('review regressions: malformed records, invalid dates, endpoints and stale promotion prose',async()=>{
 const {archiveEntries,amazonProductAsin}=await import(moduleUrl);
 assert.deepEqual(archiveEntries({posts:[],archivedPosts:{bad:true}}),[]);
 for(const change of [{asin:1234567890},{url:123},{ts:'0'},{ts:'2026-02-30'},{ts:'2026-02-30T10:00:00Z'},{archivedAt:'0'},{title:'LEGO Classic Large Creative Brick Box HALF PRICE LIMITED TIME'}])assert.deepEqual(archiveEntries({posts:[],archivedPosts:[{...old,...change}]}),[],JSON.stringify(change));
 assert.equal(amazonProductAsin('https://www.amazon.com:444/dp/B00NHQF6MG'),null);
 assert.equal(amazonProductAsin('https://www.amazon.com/gp/redirect.html/dp/B00NHQF6MG?location=https://example.com'),null);
 assert.equal(amazonProductAsin('https://www.amazon.com/dp/B00NHQF6MG?location=https://example.com'),null);
});

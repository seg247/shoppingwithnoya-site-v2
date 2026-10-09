'use strict';
// Read-only Amazon queries, separate website cache. Never imports posters or writes posting history.
const fs=require('node:fs'),path=require('node:path');
const {ApiClient,DefaultApi,GetItemsRequestContent}=require('amazon-creators-api');
const {isFresh,priceFromItem,prunePrices}=require('./price-contract.cjs');
const {createHash}=require('node:crypto');
const hashTitle=d=>createHash('sha256').update(String(d.title||'')).digest('hex');
const {assertTargetIdentity}=require('./product-identity.cjs');
async function refresh(input,output){
 const config={amazonAccessKey:process.env.AMAZON_CREATORS_CREDENTIAL_ID,amazonSecretKey:process.env.AMAZON_CREATORS_CREDENTIAL_SECRET,amazonPartnerTag:'noya0b-20'};
 const feed=JSON.parse(fs.readFileSync(input,'utf8'));if(!Array.isArray(feed.posts))throw Error('Invalid input feed');
 let prior={};
 try{const response=await fetch('https://deals.shoppingwithnoya.com/amazon-price-data.json?v='+Date.now(),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(response.ok){const p=await response.json();if(p.version===1)prior=p.items||{}}}catch{}
 // Network result is untrusted; cache reuse validates identity, fields and age below.
 const now=Date.now(),deals=new Map(),items=Object.create(null),reused=new Set();
 for(const d of feed.posts){try{const u=new URL(d.url);if(u.hostname!=='www.amazon.com'||u.protocol!=='https:'||u.searchParams.get('tag')!==config.amazonPartnerTag||assertTargetIdentity(d.url)!==d.asin)continue;if(!deals.has(d.asin))deals.set(d.asin,d)}catch{}}
 const pending=[];
 for(const [asin,deal] of deals){const old=prior[asin];if(old&&old.asin===asin&&old.titleHash===hashTitle(deal)&&isFresh(old,now)&&now-Date.parse(old.observedAt)<2700000){items[asin]=old;reused.add(asin);}else pending.push(deal)}
 let calls=0,unavailable=0,failed=0;
 const client=new ApiClient();client.credentialId=config.amazonAccessKey;client.credentialSecret=config.amazonSecretKey;client.version='3.1';client.marketplace='www.amazon.com';client.timeout=12000;
 const api=new DefaultApi(client),deadline=Date.now()+150000;
 if(!config.amazonAccessKey||!config.amazonSecretKey){failed=pending.length;console.warn('[WebsitePrices] Credentials unavailable; no invented fallback');}
 else for(let offset=0;offset<pending.length;offset+=10){
  if(Date.now()>deadline){failed+=pending.length-offset;break;}
  const batch=pending.slice(offset,offset+10);
  const req=new GetItemsRequestContent();req.itemIds=batch.map(d=>d.asin);req.itemIdType='ASIN';req.partnerTag=config.amazonPartnerTag;req.partnerType='Associates';req.resources=['itemInfo.title','offersV2.listings.price','offersV2.listings.condition','offersV2.listings.isBuyBoxWinner'];
  try{
   calls++;
   const data=await api.getItems('www.amazon.com',req),observedAt=new Date().toISOString();
   const returned=new Map((data?.itemsResult?.items||[]).map(x=>[x.asin,x]));
   for(const d of batch){const price=priceFromItem(returned.get(d.asin),d,observedAt);if(price)items[d.asin]={...price,titleHash:hashTitle(d)};else unavailable++;}
  }catch(e){failed+=batch.length;const status=e.status||e.statusCode||e.response?.status;console.warn('[WebsitePrices] Batch failed; status='+String(status||'network'));if(status===403||status===429){failed+=Math.max(0,pending.length-offset-batch.length);break;}}
  if(offset+10<pending.length)await new Promise(r=>setTimeout(r,1100));
 }
 // Never retain expired cache entries or old records on successful no-price responses.
 const validItems=prunePrices(items,reused);
 const snapshot={version:1,generatedAt:new Date().toISOString(),total:Object.keys(validItems).length,items:validItems};
 fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output+'.tmp',JSON.stringify(snapshot,null,2));fs.renameSync(output+'.tmp',output);
 console.log(JSON.stringify({event:'WebsitePrices',candidates:deals.size,verifiedPrices:snapshot.total,calls,unavailable,failed}));return snapshot;
}
if(require.main===module){const [input,output]=process.argv.slice(2);if(!input||!output){console.error('Usage: refresh-amazon-prices.cjs INPUT OUTPUT');process.exitCode=1;}else refresh(input,output).catch(()=>{console.error('[WebsitePrices] Refresh unavailable; fail closed with no displayed prices');fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({version:1,generatedAt:new Date().toISOString(),total:0,items:{}}));})}
module.exports={refresh};

'use strict';
const {assertProductIdentity,assertTargetIdentity}=require('./product-identity.cjs');
const MAX_AGE_MS=3600000;
function isFresh(p,now=Date.now()){
 const observed=Date.parse(p?.observedAt),expiry=Date.parse(p?.expiresAt);
 return p?.source==='AmazonCreatorsAPI'&&/^[A-Z0-9]{10}$/.test(p.asin||'')&&p.currency==='USD'&&typeof p.amount==='number'&&Number.isFinite(p.amount)&&p.amount>0&&p.condition==='NEW'&&p.isBuyBoxWinner===true&&typeof p.displayAmount==='string'&&/^\$[\d,]+\.\d{2}$/.test(p.displayAmount)&&Number(p.displayAmount.replace(/[$,]/g,''))===p.amount&&Number.isFinite(observed)&&observed<=now&&now-observed<MAX_AGE_MS&&expiry===observed+MAX_AGE_MS;
}
function priceFromItem(item,deal,observedAt){
 try{
  if(item?.asin!==deal?.asin||assertTargetIdentity(deal.url)!==deal.asin)return null;
  assertProductIdentity({asin:deal.asin,sourceTitle:deal.title,merchantTitle:item.itemInfo?.title?.displayValue,requireSource:true});
  const listing=(item.offersV2?.listings||[]).find(x=>String(x.condition?.value||'').toUpperCase()==='NEW'&&x.isBuyBoxWinner===true&&x.violatesMAP!==true);
  const money=listing?.price?.money;
  const record={asin:deal.asin,source:'AmazonCreatorsAPI',amount:money?.amount,currency:money?.currency,displayAmount:money?.displayAmount,condition:'NEW',isBuyBoxWinner:true,observedAt,expiresAt:new Date(Date.parse(observedAt)+MAX_AGE_MS).toISOString()};
  return isFresh(record,Date.parse(observedAt))?record:null;
 }catch{return null;}
}
function prunePrices(records,reused,now=Date.now()){
 const out=Object.create(null);
 for(const [asin,p] of Object.entries(records))if(p.asin===asin&&isFresh(p,now)&&(!reused.has(asin)||now-Date.parse(p.observedAt)<2700000))out[asin]=p;
 return out;
}
module.exports={MAX_AGE_MS,isFresh,priceFromItem,prunePrices};

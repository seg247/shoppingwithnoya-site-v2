/* Exact API-only website prices. No storage, credentials, scraped prices or social posts. */
(()=>{
 'use strict';
 const MAX_AGE=3600000;let items=Object.create(null),busy=false,queued=false,active=true,expiryTimer=null;
 const valid=(p,asin,now)=>{
  const observed=Date.parse(p?.observedAt);
  return p?.asin===asin&&p.source==='AmazonCreatorsAPI'&&p.currency==='USD'&&p.condition==='NEW'&&p.isBuyBoxWinner===true&&typeof p.amount==='number'&&Number.isFinite(p.amount)&&p.amount>0&&typeof p.displayAmount==='string'&&/^\$[\d,]+\.\d{2}$/.test(p.displayAmount)&&Number(p.displayAmount.replace(/[$,]/g,''))===p.amount&&Number.isFinite(observed)&&observed<=now&&now-observed<MAX_AGE&&Date.parse(p.expiresAt)===observed+MAX_AGE;
 };
 function paint(){
  if(!active || typeof document === "undefined" || !document?.body)return;
  const now=Date.now();let earliest=Infinity;clearTimeout(expiryTimer);
  document.querySelectorAll('[data-amazon-price]').forEach(el=>{
   const asin=el.getAttribute('data-amazon-price'),p=items[asin];
   const ok=/^[A-Z0-9]{10}$/.test(asin||'')&&valid(p,asin,now);
   if(!ok){if(!el.hidden)el.hidden=true;if(el.textContent)el.textContent='';return;}
   earliest=Math.min(earliest,Date.parse(p.expiresAt));
   const time=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/New_York',timeZoneName:'short'}).format(new Date(p.observedAt));
   const text='Amazon.com: '+p.displayAmount+' (as of '+time+')';
   if(el.textContent!==text)el.textContent=text;
   if(el.hidden)el.hidden=false;
  });
  if(Number.isFinite(earliest))expiryTimer=setTimeout(paint,Math.max(1,earliest-Date.now()));
 }
 async function load(){if(busy)return;busy=true;try{const r=await fetch('/amazon-price-data.json?v='+Date.now(),{cache:'no-store',credentials:'omit'});if(!r.ok)throw Error('price feed unavailable');const feed=await r.json();items=feed?.version===1&&feed.items&&typeof feed.items==='object'?feed.items:Object.create(null);}catch{items=Object.create(null);}finally{busy=false;paint()}}
 const observer=new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;paint()})}});
 observer.observe(document.body,{childList:true,subtree:true});
 let paintTimer=setInterval(paint,30000),loadTimer=setInterval(load,600000);
 window.addEventListener('pagehide',()=>{items=Object.create(null);paint();active=false;observer.disconnect();clearInterval(paintTimer);clearInterval(loadTimer);clearTimeout(expiryTimer)});
 window.addEventListener('pageshow',event=>{if(event.persisted){active=true;observer.observe(document.body,{childList:true,subtree:true});paintTimer=setInterval(paint,30000);loadTimer=setInterval(load,600000);load()}});
 load();document.addEventListener('visibilitychange',()=>{if(active){paint();if(!document.hidden)load()}});
})();

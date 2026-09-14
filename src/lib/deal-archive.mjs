import { cleanText } from './deal-metadata.mjs';
const categories=new Set(['Grocery & Food','Home & Kitchen','Beauty','Electronics','Fashion','Garden & Outdoor','Health','Toys & Kids','Cleaning Supplies','Pet Supplies']);
const fields=['slug','asin','title','url','category','ts','archivedAt','status'];
const queryKeys=new Set(['tag','th','psc','linkCode','linkId','camp','creative','creativeASIN','ascsubtag','ref_','language','smid','gaOptInStatus']);
export function amazonProductAsin(value) {
 if(typeof value!=='string')return null;
 let url;try{url=new URL(value);}catch{return null;}
 if(url.protocol!=='https:' || url.username || url.password || url.port || !['amazon.com','www.amazon.com'].includes(url.hostname))return null;
 if([...url.searchParams.keys()].some(k=>!queryKeys.has(k)))return null;
 const match=url.pathname.match(new RegExp('^/(?:dp/|gp/product/|[^/]+/dp/)([A-Za-z0-9]{10})(?:/ref=[^/]+)?/?$','i'));
 return match ? match[1].toUpperCase() : null;
}
function validTimestamp(value) {
 if(typeof value!=='string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(?:[.][0-9]{1,3})?Z$/.test(value))return false;
 const n=Date.parse(value);if(!Number.isFinite(n))return false;
 const canonical=value.includes('.') ? value.replace(/[.]([0-9]{1,3})Z$/,(_,ms)=>'.'+ms.padEnd(3,'0')+'Z') : value.replace('Z','.000Z');
 return new Date(n).toISOString()===canonical;
}
export function archiveEntries(data) {
 const posts=Array.isArray(data?.posts)?data.posts:[];
 const currentSlugs=new Set(posts.filter(p=>p&&typeof p==='object').map(p=>p.slug));
 const entries=new Map();
 for(const p of Array.isArray(data?.archivedPosts)?data.archivedPosts:[]) {
  if(!p || typeof p!=='object' || Array.isArray(p) || p.status!=='archived' || typeof p.slug!=='string' || !/^[a-z0-9][a-z0-9-]{0,199}$/.test(p.slug) || currentSlugs.has(p.slug))continue;
  if(typeof p.asin!=='string' || !/^[A-Z0-9]{10}$/.test(p.asin) || !p.slug.startsWith(p.asin.toLowerCase()+'-'))continue;
  if(!validTimestamp(p.ts) || !validTimestamp(p.archivedAt))continue;
  const title=cleanText(p.title);
  if(title.length<15 || /[$%]|(?:^|[^a-z0-9])(?:coupon|promo code|today only|price drop|free shipping|half price|limited time|on sale|clearance|save big)(?:[^a-z0-9]|$)/i.test(title))continue;
  if(amazonProductAsin(p.url)!==p.asin)continue;
  const record=Object.fromEntries(fields.map(k=>[k,p[k]]));
  record.title=title;record.category=cleanText(p.category);
  if(!entries.has(p.slug))entries.set(p.slug,record);
 }
 return [...entries.values()];
}
export function archiveCategoryLink(category,posts) {
 if(!categories.has(category) || posts.filter(p=>p.category===category).length<12)return null;
 return '/category/'+category.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')+'/';
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
const sitemap=readFileSync(new URL('../dist/sitemap-0.xml',import.meta.url),'utf8');
test('dashboard remains built and noindex but is never advertised in the sitemap',()=>{
 assert.ok(existsSync(new URL('../dist/dashboard/index.html',import.meta.url)));
 assert.match(readFileSync(new URL('../dist/dashboard/index.html',import.meta.url),'utf8'),/noindex, nofollow/);
 assert.ok(![...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].some(m=>new URL(m[1]).pathname.replace(/\/$/,'')==='/dashboard'),'noindex dashboard must not be in sitemap');
});

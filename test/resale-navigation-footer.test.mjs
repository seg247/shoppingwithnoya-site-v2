import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
test('approved optional scope replaces stale boutique with ordinary exact Poshmark navigation and footer',()=>{
 const dom=new JSDOM(readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'));
 try {const d=dom.window.document;for(const sel of ['.compact-menu','footer']){const a=d.querySelector(`${sel} a[href="https://poshmark.com/closet/noyascloset"]`);assert.ok(a,sel);assert.equal(a.textContent,'Poshmark Closet ↗');assert.equal(a.rel,'noopener noreferrer');assert.equal(new URL(a.href).search,'');}assert.ok(!d.body.textContent.includes('Shop My Clothing Boutique'));assert.ok(!d.body.textContent.includes('Prices starting at just $10'));assert.ok(!d.querySelector('main a[href="https://shoppingwithnoya.com"]'));assert.equal(d.querySelector('footer a[href="https://amazon.com/shop/noya0b"]').textContent,'🛍️ Amazon Storefront');}finally{dom.window.close();}
});

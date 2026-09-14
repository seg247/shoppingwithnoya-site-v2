import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { archiveEntries } from '../src/lib/deal-archive.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const archives=archiveEntries(JSON.parse(readFileSync(new URL('../src/data/site-data.json',import.meta.url),'utf8')));
test('real archive HTTP, phone/desktop geometry, keyboard and alternatives', {skip:process.env.UI_BROWSER!=='1'||archives.length===0},async()=>{
 const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
 const child=spawn(process.execPath,['node_modules/astro/bin/astro.mjs','preview','--host','127.0.0.1','--port','4428'],{cwd:root,stdio:['ignore','pipe','pipe']});
 let browser;
 try{
  await new Promise((ok,bad)=>{const t=setTimeout(()=>bad(new Error('preview timeout')),20000);child.stdout.on('data',b=>{if(b.toString().includes('4428')){clearTimeout(t);ok();}});child.once('exit',c=>{clearTimeout(t);bad(new Error('preview exited '+c));});});
  browser=await chromium.launch({headless:true});const context=await browser.newContext();
  await context.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:4428/')?r.continue():r.abort());
  const page=await context.newPage();
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:900});
   const response=await page.goto('http://127.0.0.1:4428/deals/'+archives[0].slug+'/');assert.equal(response.status(),200);
   assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex, follow');
   assert.ok(await page.locator('.archive-notice').isVisible());
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const bad=await page.locator('.archived-deal a').evaluateAll(as=>as.filter(a=>{const r=a.getBoundingClientRect();return r.width===0||r.left<0||r.right>innerWidth+1;}).map(a=>a.textContent));assert.deepEqual(bad,[]);
   await page.keyboard.press('Tab');await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),'main-content');
   await page.locator('.archived-deal a[href="/guides/"]').click();assert.ok(page.url().endsWith('/guides/'));
  }
 }finally{if(browser)await browser.close();child.kill();}
});

"""Real-Chrome regression: uv run --with playwright python test/ui-controls.browser.py --url URL --output DIR
Uses existing local CDP9333; isolated contexts, blocked analytics, no merchant clicks.
"""
import argparse,asyncio,json,re
from pathlib import Path
from playwright.async_api import async_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url',required=True);parser.add_argument('--output',required=True);args=parser.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
async def main():
 results=[];owned=[];blocked=[]
 async with async_playwright() as p:
  browser=await p.chromium.connect_over_cdp('http://127.0.0.1:9333')
  for width in [320,375,390,420,1280]:
   ctx=await browser.new_context(viewport={'width':width,'height':844 if width<600 else 900},is_mobile=width<600,has_touch=width<600,service_workers='block',device_scale_factor=1)
   async def guard(route):
    if re.search(r'google-analytics|googletagmanager|analytics.google|doubleclick|facebook.net|facebook.com/tr|/g/collect|/collect\?',route.request.url,re.I):blocked.append(route.request.url.split('?')[0]);await route.abort()
    else:await route.continue_()
   await ctx.route('**/*',guard);page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   cd=await ctx.new_cdp_session(page);owned.append((await cd.send('Target.getTargetInfo'))['targetInfo']['targetId'])
   try:
    response=await page.goto(args.url,wait_until='networkidle',timeout=60000);await page.locator('.deal-card').first.wait_for();await page.evaluate('document.fonts.ready')
    d=await page.evaluate('''() => {const e=document.querySelector('.chip-row .shop-cat.active'),s=getComputedStyle(e),rgb=t=>t.match(/[\\d.]+/g).slice(0,3).map(Number),lum=c=>{const a=c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return .2126*a[0]+.7152*a[1]+.0722*a[2]},a=lum(rgb(s.color)),b=lum(rgb(s.backgroundColor)),width=document.documentElement.clientWidth,controls=Array.from(document.querySelectorAll('.section-header h2,.section-header #deal-count,.section-header #sort-order,.section-header #view-toggle')).map(e=>{const r=e.getBoundingClientRect();return {id:e.id,cls:e.className,text:e.textContent.trim(),x:r.x,right:r.right,y:r.y,bottom:r.bottom,width:r.width,height:r.height}});return {clientWidth:width,scrollWidth:document.documentElement.scrollWidth,innerWidth,contrast:(Math.max(a,b)+.05)/(Math.min(a,b)+.05),foreground:s.color,background:s.backgroundColor,controls,renderedCards:document.querySelectorAll('.deal-card').length,links:Array.from(document.querySelectorAll('.card-link')).map(a=>a.getAttribute('href'))}}''')
    d['requested_width']=width;d['http_status']=response.status;d['errors']=errors
    d['checks']={'selected_chip_contrast':d['contrast']>=4.5,'no_document_overflow':d['scrollWidth']<=d['clientWidth']+1,'all_toolbar_controls_fit':all(x['x']>=-1 and x['right']<=d['clientWidth']+1 and x['width']>0 and x['height']>0 for x in d['controls']),'all_four_controls_present':len(d['controls'])==4,'page_errors_absent':not errors}
    await page.screenshot(path=str(out/f'viewport-{width}.png'))
    # Exercise internal controls only, without merchant or Share navigation.
    links=d.pop('links');await page.locator('#view-toggle').focus();await page.keyboard.press('Space');await page.wait_for_function("document.querySelector('#deals-grid').dataset.view==='list'")
    d['checks']['keyboard_list_toggle']=await page.locator('#view-toggle').get_attribute('aria-pressed')=='true'
    d['checks']['list_links_preserved']=await page.locator('.card-link').evaluate_all('(es)=>es.map(e=>e.getAttribute("href"))')==links
    await page.keyboard.press('Space');await page.wait_for_function("document.querySelector('#deals-grid').dataset.view==='grid'")
    await page.locator('#sort-order').select_option(index=1)
    d['checks']['sort_selection_retained']=await page.locator('#sort-order').evaluate('(e)=>e.selectedIndex')==1
    await page.locator('.chip-row .shop-cat[data-cat="Beauty"]').click()
    d['checks']['category_filter_active']=await page.locator('.chip-row .shop-cat[data-cat="Beauty"]').evaluate('(e)=>e.classList.contains("active")')
    await page.locator('.chip-row .shop-cat').first.click()
    results.append(d)
   finally:await ctx.close()
  cd=await browser.new_browser_cdp_session();live=(await cd.send('Target.getTargets'))['targetInfos'];closed=not any(t['targetId'] in owned for t in live)
 result={'url':args.url,'results':results,'owned_targets':owned,'all_closed_verified':closed,'blocked_analytics':blocked,'passed':closed and all(all(x['checks'].values()) for x in results)}
 (out/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
 print(json.dumps({'passed':result['passed'],'all_closed_verified':closed,'viewports':[{'width':x['requested_width'],'contrast':round(x['contrast'],3),'clientWidth':x['clientWidth'],'scrollWidth':x['scrollWidth'],'checks':x['checks']} for x in results]},indent=2))
 if not result['passed']:raise SystemExit(1)
asyncio.run(main())

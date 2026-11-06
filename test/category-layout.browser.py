import argparse,asyncio,json,re,threading,functools,http.server,contextlib,subprocess
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright
parser=argparse.ArgumentParser();parser.add_argument('--url');parser.add_argument('--dist');parser.add_argument('--output',required=True);args=parser.parse_args();out=Path(args.output);out.mkdir(parents=True,exist_ok=True)
async def main(base):
 results=[];owned=[];blocked=[]
 async with async_playwright() as p:
  browser=await p.chromium.connect_over_cdp('http://127.0.0.1:9333')
  for width in [320,390,1280]:
   ctx=await browser.new_context(viewport={'width':width,'height':900},is_mobile=width<600,has_touch=width<600,service_workers='block')
   async def guard(route):
    u=route.request.url
    if re.search(r'google-analytics|googletagmanager|analytics.google|doubleclick|facebook.net|facebook.com/tr|/g/collect|/collect\?',u,re.I):blocked.append(u.split('?')[0]);await route.abort()
    elif urlparse(u).netloc==urlparse(base).netloc or route.request.resource_type=='image':await route.continue_()
    else:await route.abort()
   await ctx.route('**/*',guard);page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));cd=await ctx.new_cdp_session(page);owned.append((await cd.send('Target.getTargetInfo'))['targetInfo']['targetId'])
   try:
    for suffix in ['','?noya_test=qa-20261106-browser']:
     errors.clear();response=await page.goto(base+'/'+suffix,wait_until='networkidle');await page.locator('.deal-card').first.wait_for()
     d=await page.evaluate('''() => ({url:location.href,queue:(window.dataLayer||[]).map(x=>Array.from(x)),links:Array.from(document.querySelectorAll('a[href]')).map(a=>({href:a.href,raw:a.getAttribute('href'),download:a.hasAttribute('download')})),shares:Array.from(document.querySelectorAll('.share-btn')).map(b=>b.dataset.url),canonical:document.querySelector('link[rel=canonical]').href,localStorage:Object.keys(localStorage),sessionStorage:Object.keys(sessionStorage)})''')
     marked=bool(suffix);marker=[x for x in d['queue'] if x[0]=='set' and 'noya_test' in x[1]]
     internal=[a for a in d['links'] if urlparse(a['href']).netloc==urlparse(base).netloc and not a['raw'].startswith('#') and not re.search(r'\.[a-z0-9]+/?$',urlparse(a['href']).path,re.I) and not a['download']]
     checks={'http200':response.status==200,'expected_marker':bool(marker)==marked,'internal_navigation_marked':all(('noya_test=qa-20261106-browser' in a['href'])==marked for a in internal),'merchant_unmodified':all('noya_test' not in a['href'] for a in d['links'] if urlparse(a['href']).netloc!=urlparse(base).netloc),'share_unmodified':all('noya_test' not in x for x in d['shares']),'canonical_unmodified':'noya_test' not in d['canonical'],'no_qa_storage':not any('noya_test' in x for x in d['localStorage']+d['sessionStorage']),'no_page_errors':not errors}
     if marked:
      checks['set_before_config']=bool(marker) and next(i for i,x in enumerate(d['queue']) if x[0]=='set')<next(i for i,x in enumerate(d['queue']) if x[0]=='config')
      if marker:
       await page.locator('a[href*="/guides/"]').first.evaluate('(a)=>a.click()');await page.wait_for_url('**/guides/?noya_test=qa-20261106-browser');checks['actual_internal_navigation']=await page.evaluate("Array.from(window.dataLayer||[]).some(x=>x[0]==='set'&&x[1].noya_test==='qa-20261106-browser')")
      else:checks['actual_internal_navigation']=False
     results.append({'width':width,'marked':marked,'internal_links':len(internal),'checks':checks,'errors':errors[:]})
    # Revalidate historical category layout without changing it.
    for path in ['/category/beauty/','/category/home-kitchen/']:
     response=await page.goto(base+path+'?noya_test=qa-20261106-layout',wait_until='networkidle')
     if response.status!=200:continue
     geom=await page.evaluate('''() => ({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,inner:innerWidth,controls:Array.from(document.querySelectorAll('.section-header')).map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}})})''')
     await page.screenshot(path=str(out/f'category-{path.split("/")[2]}-{width}.png'))
     results.append({'width':width,'path':path,'layout_only':True,'geometry':geom,'overflow':geom['scroll']>geom['client']+1})
   finally:await ctx.close()
  cd=await browser.new_browser_cdp_session();live={t['targetId'] for t in (await cd.send('Target.getTargets'))['targetInfos']};closed=not any(i in live for i in owned)
 result={'base':base,'results':results,'owned_targets':owned,'all_closed_verified':closed,'blocked_analytics':sorted(set(blocked)),'passed':closed and all(all(x['checks'].values()) for x in results if 'checks' in x)}
 (out/'results.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2));assert result['passed']; assert all(not x['overflow'] for x in results if x.get('layout_only')), 'Category document overflow'
if args.dist:
 class Handler(http.server.SimpleHTTPRequestHandler):
  def log_message(self,*a):pass
 handler=functools.partial(Handler,directory=args.dist)
 server=http.server.ThreadingHTTPServer(('127.0.0.1',0),handler);threading.Thread(target=server.serve_forever,daemon=True).start()
 try:asyncio.run(main('http://127.0.0.1:'+str(server.server_port)))
 finally:server.shutdown();server.server_close()
else:asyncio.run(main(args.url.rstrip('/')))

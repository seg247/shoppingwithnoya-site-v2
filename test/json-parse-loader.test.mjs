import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build, createServer } from 'vite';
const root=process.cwd();
const enabled=process.env.JSON_LOADER_RED!=='1';
async function plugin(files) { return enabled ? [(await import('../scripts/json-parse-loader.mjs')).jsonParseLoader(files)] : []; }
const raw=String.raw`{"posts":["\ud800","\udfff","\ud83d\ude00","\\ud800","\";globalThis.__jsonInjection=true;//","</script>","\u2028\u2029","\u0000"],"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}},"default":"value","a-b":2,"n":-0,"huge":1e400,"duplicate":1,"duplicate":2}`;
async function bundled(file, plugins, ssr=false) {
 const result=await build({configFile:false,root,logLevel:'silent',plugins,build:{write:false,minify:true,ssr:ssr?file:false,lib:ssr?undefined:{entry:file,formats:['es']},rolldownOptions:{output:{codeSplitting:false}}}});
 const dir=await mkdtemp(resolve(tmpdir(), 'json-output-'));
 try { const p=resolve(dir,'output.mjs');await writeFile(p,(Array.isArray(result)?result[0]:result).output.find(x=>x.type==='chunk').code);return await import(pathToFileURL(p).href); }
 finally {await rm(dir,{recursive:true,force:true});}
}
test('native JSON.parse values survive client and SSR build including adversarial UTF16 and keys',async()=>{
 const dir=await mkdtemp(resolve(tmpdir(), 'json-fixture-'));const file=resolve(dir,'fixture.json');
 try {await writeFile(file,raw);for(const ssr of [false,true]){const m=await bundled(file,await plugin([file]),ssr);assert.deepStrictEqual(m.default,JSON.parse(raw));assert.strictEqual(m.posts,m.default.posts);assert.strictEqual(m.__proto__,m.default.__proto__);assert.strictEqual(m.constructor,m.default.constructor);assert.equal(Object.getPrototypeOf(m.default),Object.prototype);assert.equal(Object.hasOwn(m.default,'__proto__'),true);assert.equal({}.polluted,undefined);assert.equal(globalThis.__jsonInjection,undefined);assert.ok(Object.is(m.default.n,-0));}}
 finally{await rm(dir,{recursive:true,force:true});}
});
test('each actual imported source JSON matches exact Node JSON.parse values in client and SSR',async()=>{
 for(const name of ['site-data','blog-data','beauty-blog-data']){const f=resolve(root,'src/data/'+name+'.json');const expected=JSON.parse(await readFile(f,'utf8'));for(const ssr of [false,true]){const m=await bundled(f,await plugin([f]),ssr);assert.deepStrictEqual(m.default,expected);for(const key of Object.keys(expected).filter(k=>/^[A-Za-z_$][\w$]*$/.test(k)&&k!=='default'))assert.strictEqual(m[key],m.default[key]);}}
});
test('native valid-pair control and nonallowlisted files keep Vite semantics',async()=>{
 const dir=await mkdtemp(resolve(tmpdir(), 'json-control-'));
 try {const f=resolve(dir,'control.json');await writeFile(f,String.raw`{"posts":["\ud83d\ude00","\\ud800"]}`);const m=await bundled(f,await plugin([]));assert.deepStrictEqual(m.default,{posts:['😀','\\ud800']});const bad=resolve(dir,'bad.json');await writeFile(bad,String.raw`{"posts":["\ud800"]}`);await assert.rejects(bundled(bad,await plugin([])),/surrogate|hex escape/);}
 finally{await rm(dir,{recursive:true,force:true});}
});
test('invalid JSON rejects without evaluation; raw/url queries bypass custom loader',async()=>{
 if(!enabled)return;
 const dir=await mkdtemp(resolve(tmpdir(), 'json-invalid-'));const f=resolve(dir,'fixture.json');
 try{await writeFile(f,'{"a":1,}');await assert.rejects(bundled(f,await plugin([f])),/JSON|property|position/i);const p=(await plugin([f]))[0];assert.equal(await p.resolveId(f+'?raw'),null);assert.equal(await p.resolveId(f+'?url'),null);assert.equal(await p.resolveId(f+'?anything'),null);assert.equal(await p.resolveId(resolve(dir,'else.json')),null);}
 finally{await rm(dir,{recursive:true,force:true});}
});
test('dev SSR invalidates on file changes and client transforms preserve exports',async()=>{
 const dir=await mkdtemp(resolve(tmpdir(), 'json-watch-'));const f=resolve(dir,'fixture.json');
 const server=await createServer({configFile:false,root,logLevel:'silent',plugins:await plugin([f]),server:{fs:{allow:[dir]},middlewareMode:true,watch:{usePolling:true,interval:30}},appType:'custom'});
 try{await writeFile(f,raw);const a=await server.ssrLoadModule(f);assert.deepStrictEqual(a.default,JSON.parse(raw));const client=await server.transformRequest('/@fs'+f);assert.ok(client.code.includes('export'));const changed=String.raw`{"posts":["\udfff","changed"]}`;const change=new Promise((ok,bad)=>{const t=setTimeout(()=>bad(new Error('watch timeout')),5000);server.watcher.on('change',p=>{if(p===f){clearTimeout(t);setTimeout(ok,100);}});});await writeFile(f,changed);await change;const b=await server.ssrLoadModule(f);assert.deepStrictEqual(b.default,JSON.parse(changed));assert.notDeepStrictEqual(a.default,b.default);}
 finally{await server.close();await rm(dir,{recursive:true,force:true});}
});

test('all surrogate code units, pairs, escaping and nonobject roots preserve JSON.parse',async()=>{
 const dir=await mkdtemp(resolve(tmpdir(), 'json-exhaustive-'));const f=resolve(dir,'fixture.json');
 try{
 const all=[];for(let i=0xd800;i<=0xdfff;i++)all.push('"\\u'+i.toString(16)+'"');
 const inputs=['['+all.join(',')+']','null','false','-0','1e400',String.raw`"\ud800"`,String.raw`{"data":1,"value0":2,"await":3,"class":4,"$":5,"_":6,"__proto__":{"x":1}}`];
 for(const source of inputs){await writeFile(f,source);const m=await bundled(f,await plugin([f]));assert.deepStrictEqual(m.default,JSON.parse(source));}
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('production watch rebuild reloads physical JSON rather than stale virtual module',async()=>{
 const dir=await mkdtemp(resolve(tmpdir(), 'json-buildwatch-'));const f=resolve(dir,'fixture.json');let watcher;
 try{
 await writeFile(f,raw);
 watcher=await build({configFile:false,root,logLevel:'silent',plugins:await plugin([f]),build:{watch:{},outDir:resolve(dir,'output'),emptyOutDir:true,minify:true,lib:{entry:f,formats:['es'],fileName:()=> 'bundle.mjs'}}});
 async function end(){await new Promise((ok,bad)=>{const done=e=>{if(e.code==='ERROR'){watcher.off('event',done);bad(e.error);}if(e.code==='END'){watcher.off('event',done);ok();}};watcher.on('event',done);});}
 await end();const a=await import(pathToFileURL(resolve(dir,'output/bundle.mjs')).href+'?v=1');assert.deepStrictEqual(a.default,JSON.parse(raw));
 const wait=end();const changed=String.raw`{"posts":["new","\ud800"]}`;await writeFile(f,changed);await wait;const b=await import(pathToFileURL(resolve(dir,'output/bundle.mjs')).href+'?v=2');assert.deepStrictEqual(b.default,JSON.parse(changed));
 }finally{await watcher?.close();await rm(dir,{recursive:true,force:true});}
});
test('browser executes client module safely and dev HMR reloads new UTF16 values',{skip:process.env.UI_BROWSER!=='1'},async()=>{
 const {createRequire}=await import('node:module');const require=createRequire(import.meta.url);const {chromium}=require(process.env.PLAYWRIGHT_MODULE);
 const dir=await mkdtemp(resolve(tmpdir(), 'json-browser-'));const f=resolve(dir,'fixture.json');let server,browser;
 try{
 await writeFile(f,raw);await writeFile(resolve(dir,'index.html'),'<script type="module">import data,{posts} from "./fixture.json"; window.result={data,posts};</script>');
 server=await createServer({configFile:false,root:dir,logLevel:'silent',plugins:await plugin([f]),server:{host:'127.0.0.1',port:0}});await server.listen();const port=server.httpServer.address().port;
 browser=await chromium.launch({headless:true});const context=await browser.newContext();await context.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:'+port+'/')?r.continue():r.abort());const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(String(e)));await page.goto('http://127.0.0.1:'+port+'/');await page.waitForFunction(()=>window.result);
 const actual=await page.evaluate(()=>({json:JSON.stringify(window.result.data),identity:result.posts===result.data.posts,negativeZero:Object.is(result.data.n,-0),infinite:result.data.huge===Infinity,ownProto:Object.hasOwn(result.data,'__proto__'),polluted:{}.polluted===undefined,injected:globalThis.__jsonInjection===undefined}));assert.deepStrictEqual(actual,{json:JSON.stringify(JSON.parse(raw)),identity:true,negativeZero:true,infinite:true,ownProto:true,polluted:true,injected:true});
 const changed=String.raw`{"posts":["changed","\udfff"]}`;await writeFile(f,changed);await page.waitForFunction(()=>window.result?.data.posts[0]==='changed');assert.equal(await page.evaluate(()=>JSON.stringify(result.data)),JSON.stringify(JSON.parse(changed)));assert.deepStrictEqual(errors,[]);
 // The same loader also runs through production minification and a real browser.
 const output=await build({configFile:false,root:dir,logLevel:'silent',plugins:await plugin([f]),build:{write:false,minify:true,lib:{entry:f,formats:['es']}}});const chunk=(Array.isArray(output)?output[0]:output).output.find(x=>x.type==='chunk');await page.route('**/production.mjs',route=>route.fulfill({contentType:'text/javascript',body:chunk.code}));const prod=await page.evaluate(async()=>JSON.stringify((await import('/production.mjs')).default));assert.equal(prod,JSON.stringify(JSON.parse(changed)));
 }finally{await browser?.close();await server?.close();await rm(dir,{recursive:true,force:true});}
});

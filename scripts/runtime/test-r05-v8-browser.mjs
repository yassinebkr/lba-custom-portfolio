/**
 * Genuine pinned js-dos 8.5.4 browser smoke: local ZIP -> DOSBox Worker.
 * Synthetic DOS autoexec only (no copyrighted game data). It proves that
 * the isolated test page can start its real backend, NOT LBA1 fidelity.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve, join, extname, sep} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(new URL('../..',import.meta.url).pathname);
const webRoot=join(root,'web_deploy');
const bytes=await readFile(resolve(process.argv[2]||'output/r05-browser-fixture/v8-synthetic.jsdos'));
const prefix='/lba-custom-portfolio/web_deploy/';
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript',
 '.css':'text/css','.wasm':'application/wasm','.json':'application/json'};
const allowed=new Set(['v8-local.html','v8-local.mjs','local-bundle.mjs','r05-diagnostics.mjs']);
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(!url.pathname.startsWith(prefix)){res.writeHead(404);return res.end();}
 const part=decodeURIComponent(url.pathname.slice(prefix.length));
 if(!(allowed.has(part)||part.startsWith('vendor/jsdos854/'))){
   res.writeHead(404);return res.end();
 }
 const path=resolve(webRoot,part);
 if(!path.startsWith(webRoot+sep)){res.writeHead(403);return res.end();}
 try {
   const data=await readFile(path);
   res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream',
                      'cache-control':'no-store'});
   res.end(data);
 } catch {
   res.writeHead(404);res.end();
 }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1100,height:780}});
  const errors=[];
  page.on('pageerror',err=>errors.push('JS: '+err.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push('console: '+msg.text());});
  page.on('response',res=>{if(res.status()>=400)errors.push('HTTP '+res.status()+' '+res.url());});
  const url='http://127.0.0.1:'+server.address().port+prefix+'v8-local.html';
  const response=await page.goto(url);
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>typeof window.Dos==='function',null,{timeout:20000});
  await page.locator('#bundle').setInputFiles({
    name:'r05-v8-synthetic.jsdos',mimeType:'application/octet-stream',buffer:bytes
  });
  await page.waitForFunction(()=>{
    const state=window.r05V8DiagnosticReport?.();
    return state?.events?.some(x=>x.type==='emulator-event'&&x.value==='ci-ready')
      || state?.errors?.length>0
      || document.querySelector('#status')?.textContent?.startsWith('v8 startup failed');
  },null,{timeout:90000});
  const result=await page.evaluate(()=>window.r05V8DiagnosticReport());
  assert.ok(result.events.some(x=>x.type==='emulator-event'&&x.value==='ci-ready'),
    'Real v8 DOSBox backend not ready: '+JSON.stringify({result,errors}));
  assert.equal(result.backend,'dosbox');
  assert.ok(result.version,'Expected pinned v8 version');
  assert.deepEqual(result.errors,[],'unexpected startup diagnostic errors');
  assert.ok(!errors.some(x=>/404|wasm|Uncaught|ReferenceError/i.test(x)),
    'Asset or initialization failures: '+errors.join('; '));
  console.log('js-dos 8.5.4 pinned local frontend + real DOSBox Worker started using synthetic local ZIP.');
  console.log('No real LBA1 executable is run by this smoke test.');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}

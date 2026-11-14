/**
 * Genuine pinned js-dos 8.5.4 portfolio homepage smoke: local ZIP -> DOSBox Worker.
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
const allowed=new Set(['index.html','v6-local.html','v8-local.html','v8-local.mjs','local-bundle.mjs','r05-diagnostics.mjs']);
const server=createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(!url.pathname.startsWith(prefix)){res.writeHead(404);return res.end();}
 const part=decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html';
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
  const url='http://127.0.0.1:'+server.address().port+prefix;
  const response=await page.goto(url);
  assert.equal(response.status(),200);
  await page.waitForFunction(()=>typeof window.Dos==='function',null,{timeout:20000});
  assert.match(await page.locator('h1').textContent(),/Yassine Benkhira/);
  assert.equal(await page.locator('.loc-card').count(),6,'Portfolio landing must be preserved');
  assert.equal(await page.locator('#volume-slider').inputValue(),'30','default volume should protect ears');
  assert.equal(await page.locator('#volume-value').textContent(),'30%');
  assert.equal(await page.locator('a[href="./v6-local.html"]').count(),1,'Legacy route must remain linked');
  await page.locator('#bundle-file').setInputFiles({
    name:'r05-v8-synthetic.jsdos',mimeType:'application/octet-stream',buffer:bytes
  });
  await page.waitForFunction(()=>{
    const state=window.r05V8DiagnosticReport?.();
    return state?.events?.some(x=>x.type==='emulator-event'&&x.value==='ci-ready')
      || state?.errors?.length>0
      || document.querySelector('#bundle-status')?.textContent?.startsWith('v8 startup failed');
  },null,{timeout:90000});
  const result=await page.evaluate(()=>window.r05V8DiagnosticReport());
  assert.ok(result.events.some(x=>x.type==='emulator-event'&&x.value==='ci-ready'),
    'Real v8 DOSBox backend not ready: '+JSON.stringify({result,errors}));
  assert.equal(result.backend,'dosbox');
  assert.equal(result.outputVolume,0.3,'real v8 player starts with reduced output volume');
  assert.equal(await page.locator('#game-overlay.active').count(),1,'Main portfolio must present the v8 player');
  assert.equal(await page.locator('#stop').isEnabled(),true);
  assert.equal(await page.locator('#inspect-frame').isEnabled(),true);
  await page.locator('#volume-slider').evaluate(el=>{
    el.value='12';
    el.dispatchEvent(new Event('input',{bubbles:true}));
  });
  assert.equal(await page.locator('#volume-value').textContent(),'12%');
  assert.equal((await page.evaluate(()=>window.r05V8DiagnosticReport())).outputVolume,0.12,
    'runtime audio slider must affect active player without a restart');
  await page.locator('#inspect-frame').click();
  await page.waitForFunction(()=>{
    const report=window.r05V8DiagnosticReport();
    return report?.frameCheck || report?.events?.some(e=>e.type==='frame-check-error');
  },null,{timeout:15000});
  const screenReport=await page.evaluate(()=>window.r05V8DiagnosticReport());
  assert.ok(screenReport.frameCheck,
    'Real v8 screenshot/guest-state diagnostic failed: '+JSON.stringify(screenReport.warnings));
  assert.ok(screenReport.frameCheck.changedFraction>=0 && screenReport.frameCheck.changedFraction<=1);
  assert.ok(screenReport.frameCheck.darkFraction>=0 && screenReport.frameCheck.darkFraction<=1);
  assert.ok(screenReport.frameCheck.runningProgram!==undefined);
  assert.equal(await page.locator('#inspect-frame').isEnabled(),true);

  assert.match(await page.locator('#player-status').textContent(),/Screen:.*pixels changed/i,
    'After clicking Inspect screen, status must reflect the frame comparison');
  assert.ok(result.version,'Expected pinned v8 version');
  assert.deepEqual(result.errors,[],'unexpected startup diagnostic errors');
  assert.ok(!errors.some(x=>/404|wasm|Uncaught|ReferenceError/i.test(x)),
    'Asset or initialization failures: '+errors.join('; '));
  console.log('Portfolio / loads js-dos 8.5.4 and starts the real pinned DOSBox Worker from a synthetic local ZIP.');
  console.log('No real LBA1 executable is run by this smoke test.');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}

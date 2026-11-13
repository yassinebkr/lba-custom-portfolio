/**
 * R05 browser integration: import the output from the real Linux packer
 * using the actual js-dos 6.22 ZIP extractor.
 *
 * The private fixture EXE/HQR bytes are synthetic. DOS main() is intercepted,
 * so this test checks archive loading rather than pretending to boot LBA1.
 */
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {resolve,join,extname} from 'node:path';
import {chromium} from 'playwright';

const root=resolve(new URL('../..',import.meta.url).pathname);
const zipPath=resolve(process.argv[2]||'output/r05-browser-fixture/synthetic.jsdos');
const zipBytes=await readFile(zipPath);
assert.equal(zipBytes.subarray(0,4).toString('hex'),'504b0304');
const base='/lba-custom-portfolio/web_deploy/';
const files=new Set([
  'index.html','local-bundle.mjs','r05-diagnostics.mjs',
  'vendor/jsdos622/js-dos.js',
  'vendor/jsdos622/wdosbox.js',
  'vendor/jsdos622/wdosbox.wasm.js',
]);
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8'};
const server=createServer(async(req,res)=>{
  const path=new URL(req.url,'http://127.0.0.1').pathname;
  if(!path.startsWith(base)){res.writeHead(404);return res.end();}
  const part=path.slice(base.length)||'index.html';
  if(!files.has(part)){res.writeHead(404);return res.end();}
  try{
    const content=await readFile(join(root,'web_deploy',part));
    res.writeHead(200,{'content-type':types[extname(part)]||'application/octet-stream','cache-control':'no-store'});
    res.end(content);
  }catch{
    res.writeHead(404);res.end();
  }
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  const port=server.address().port;
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:760}});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  const response=await page.goto('http://127.0.0.1:'+port+base);
  assert.equal(response.status(),200,'public Pages-like route must serve importer');
  await page.waitForFunction(()=>typeof window.Dos==='function',null,{timeout:15000});
  await page.evaluate(()=>{
    const realDos=window.Dos;
    window.__bundleFixture=null;
    window.Dos=(canvas,options)=>{
      const instance=realDos(canvas,options);
      return {
        ready(callback){
          return instance.ready((fs,_main)=>{
            callback(fs,commands=>{
              const read=name=>fs.fs.readFile('/'+name);
              const iso=read('LBA.ISO');
              const exe=read('RELENT.EXE');
              const decoded=new TextDecoder();
              window.__bundleFixture={
                commands,root:fs.fs.readdir('/'),
                config:decoded.decode(read('.jsdos/dosbox.conf')),
                samples:fs.fs.analyzePath('/SAMPLES.HQR').exists,
                scene:fs.fs.analyzePath('/SCENE.HQR').exists,
                save:fs.fs.analyzePath('/S003.LBA').exists,
                saveArea:(()=>{
                  const save=read('S003.LBA');
                  const titleEnd=save.indexOf(0,1)+1;
                  return save[titleEnd+0x100];
                })(),
                patch2:Array.from(exe.slice(0x10af1,0x10af3)),
                descriptor:decoded.decode(iso.slice(16*2048+1,16*2048+6)),
                volume:decoded.decode(iso.slice(16*2048+40,16*2048+72)).trim()
              };
            });
          });
        }
      };
    };
  });
  await page.locator('#bundle-file').setInputFiles({
    name:'synthetic-private.jsdos',
    mimeType:'application/octet-stream',buffer:zipBytes
  });
  await page.waitForFunction(
    ()=>window.__bundleFixture!==null || document.querySelector('#bundle-status')?.textContent.includes('Import failed'),
    null,{timeout:45000}
  );
  const result=await page.evaluate(()=>({
    state:window.__bundleFixture,
    status:document.querySelector('#bundle-status').textContent,
    hidden:document.querySelector('#bundle-import').hidden,
    overlay:document.querySelector('#game-overlay').classList.contains('active')
  }));
  assert.ok(result.state,'Real js-dos 6.22 ZIP extraction failed: '+result.status+'; '+errors.join(', '));
  assert.equal(result.hidden,true,'selection UI hides only after extraction');
  assert.equal(result.overlay,true);
  assert.equal(result.state.samples,true);
  assert.equal(result.state.scene,true);
  assert.equal(result.state.save,true,'Legacy Museum DOS save slot must exist at ZIP root');
  assert.equal(result.state.saveArea,0x2B,'Legacy Museum save points to scene index 43');
  assert.equal(result.state.descriptor,'CD001');
  assert.equal(result.state.volume,'ADELINE');
  assert.deepEqual(result.state.patch2,[235,15]);
  assert.match(result.state.config,/machine=svga_s3/);
  assert.deepEqual(result.state.commands,['-c','imgmount d LBA.ISO -t iso','-c','RELENT.EXE']);
  assert.deepEqual(errors,[],'no uncaught errors');
  console.log('R05: actual js-dos 6.22 ZIP extraction accepted the output of the Debian builder');
  console.log('R05: ISO descriptor, volume label, patched EXE, HQR entries and DOS main arguments validated');
  console.log('R05: synthetic executable not run; actual LBA1 boot remains unverified');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}

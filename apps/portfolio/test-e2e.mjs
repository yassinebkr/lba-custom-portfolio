/** Browser acceptance smoke for the public static bundle under a GitHub Pages project subpath. */
import { chromium } from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join, extname} from 'node:path';
import assert from 'node:assert/strict';

const PORT=18765;
const ROOT=new URL('../../dist/',import.meta.url);
const base='/lba-custom-portfolio/';
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.css':'text/css; charset=utf-8'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost:'+PORT);
  if(!url.pathname.startsWith(base)){res.writeHead(404);return res.end();}
  const requested=url.pathname.slice(base.length)||'index.html';
  const name=requested==='sprite-demo/'?'sprite-demo/index.html':requested==='web_deploy/'?'web_deploy/index.html':requested;
  if(!/^(?:index\.html|game\.mjs|rules\.mjs|rooms\.mjs|approved-runtime\.mjs|modules\/(?:asset-core|scene-core|public-manifest)\.mjs|assets\/approved-worlds\.json|assets\/atlases\/[a-z0-9-]+\.png|web_deploy\/(?:index\.html|local-bundle\.mjs|vendor\/jsdos622\/(?:js-dos|wdosbox|wdosbox\.wasm)\.js)|sprite-demo\/(?:index\.html|compare\.html|compare\.css|compare\.mjs|scene-lab\.html|scene-lab\.css|scene-lab\.mjs|telemetry-receiver\.png|scene\/(?:background\.png|foreground\.png|layout\.json)|compare\/(?:matrix\.json|source-(?:ne|nw|sw|se)\.png|(?:192|224|256)px-(?:lanczos|box)-(?:96|160|256|truecolor)\.png)))$/.test(name)){res.writeHead(404);return res.end();}
  try{
    const file=await readFile(new URL(name,ROOT));
    res.writeHead(200,{'content-type':types[extname(name)],'cache-control':'no-store'});
    res.end(file);
  }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(PORT,'127.0.0.1',resolve));
let browser;
try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1280,height:900}});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto('http://127.0.0.1:'+PORT+base);
  assert.equal(response.status(),200,'nested Pages path must load');
  await page.locator('#list .project').first().waitFor();
  assert.equal(await page.locator('#list .project').count(),4,'HTML fallback exposes four room projects');
  assert.equal(await page.locator('#room-nav button').count(),6,'all six rooms are navigable');
  await page.locator('#room-nav button').nth(2).click();
  assert.match((await page.locator('.stage .bar').textContent())||'',/ELECTRONICS/);
  await page.locator('#room-nav button').first().click();
  assert.equal(await page.locator('#game').evaluate(el=>el.width),960,'drawing canvas mounted');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('e');
  await page.locator('#list .project').first().click();
  await page.locator('#info h2').waitFor({state:'visible'});
  assert.equal(await page.locator('#info h2').textContent(),'CinePi','directory can select a project without gameplay');
  assert.deepEqual(errors,[],'no browser uncaught errors');
  await page.screenshot({path:'portfolio-desktop.png',fullPage:true});

  // Standalone original atlas demo: all four directions, real public-path image.
  const demoResponse=await page.goto('http://127.0.0.1:'+PORT+base+'sprite-demo/');
  assert.equal(demoResponse.status(),200,'Pages sprite-demo/ route opens');
  assert.equal(await page.locator('input[name="direction"]').count(),4);
  const actualSprite=await page.locator('.sheet img').evaluate(img=>({
   loaded:img.complete,width:img.naturalWidth,height:img.naturalHeight
  }));
  assert.deepEqual(actualSprite,{loaded:true,width:1024,height:256},'real generated atlas reaches browser');
  const firstPosition=await page.locator('.sprite').evaluate(x=>getComputedStyle(x).backgroundPositionX);
  await page.locator('label[for="dir-sw"]').click();
  const secondPosition=await page.locator('.sprite').evaluate(x=>getComputedStyle(x).backgroundPositionX);
  assert.notEqual(firstPosition,secondPosition,'direction selection must change the rendered sprite');
  await page.locator('label[for="crisp"]').click();
  assert.equal(await page.locator('.sprite').evaluate(x=>getComputedStyle(x).imageRendering),'pixelated',
    'crisp pixels should be opt-in rather than forcing enlarged 96px artifacts');
  await page.screenshot({path:'sprite-demo-desktop.png',fullPage:true});

  // V6 verifies actual stage pixels and all 24 production QA variants.
  const v6=await page.goto('http://127.0.0.1:'+PORT+base+'sprite-demo/compare.html');
  assert.equal(v6.status(),200,'V6 page served under GitHub Pages subpath');
  await page.waitForFunction(()=>document.body.dataset.rendered==='256px-lanczos-160.png',{timeout:10000});
  assert.equal(await page.locator('canvas').count(),3);
  assert.equal(await page.locator('#alpha-levels').textContent(),'256');
  assert.equal(await page.locator('#resolution').inputValue(),'256');
  assert.ok(await page.locator('#quantized-canvas').evaluate(c=>c.getContext('2d').getImageData(128,128,1,1).data.length===4));
  await page.locator('#direction').selectOption('sw');
  await page.locator('#resolution').selectOption('224');
  await page.locator('#filter').selectOption('box');
  await page.locator('#palette').selectOption('96');
  await page.waitForFunction(()=>document.body.dataset.rendered==='224px-box-96.png');
  assert.equal(await page.locator('#source-canvas').evaluate(c=>c.width),224);
  const metric=Number(await page.locator('#rmse-dark').textContent());
  assert.ok(metric>0,'quantized V6 output has measured color loss');
  await page.locator('#zoom').selectOption('2');
  assert.equal(await page.locator('#quantized-canvas').evaluate(c=>c.style.width),'448px');
  await page.locator('#background').selectOption('light');
  assert.equal(await page.locator('body').getAttribute('data-background'),'light');
  await page.locator('#crisp').check();
  assert.equal(await page.locator('body').evaluate(x=>getComputedStyle(x.querySelector('canvas')).imageRendering),'pixelated');
  await page.locator('#resolution').selectOption('256');
  await page.locator('#filter').selectOption('lanczos');
  await page.locator('#palette').selectOption('160');
  await page.waitForFunction(()=>document.body.dataset.rendered==='256px-lanczos-160.png');
  await page.locator('#zoom').selectOption('1');
  await page.screenshot({path:'sprite-compare-desktop.png',fullPage:true});
  assert.deepEqual(errors,[],'no JS errors while switching V6 real images');

  // V7: a REAL original Blender room, layered with actual 256px V5 sprite.
  const v7response=await page.goto('http://127.0.0.1:'+PORT+base+'sprite-demo/scene-lab.html');
  assert.equal(v7response.status(),200);
  await page.waitForFunction(()=>document.getElementById('scene').dataset.rendered==='ne-160',null,{timeout:12000});
  assert.deepEqual(await page.locator('#scene').evaluate(c=>[c.width,c.height]),[960,640]);
  assert.equal(await page.locator('#size-out').textContent(),'75%');
  assert.equal(await page.locator('#occlusion').isChecked(),true);
  await page.locator('#view').selectOption('sw');
  await page.waitForFunction(()=>document.getElementById('scene').dataset.rendered==='sw-160');
  await page.locator('#variant').selectOption('truecolor');
  await page.waitForFunction(()=>document.getElementById('scene').dataset.rendered==='sw-truecolor');
  await page.locator('#size').evaluate(el=>{el.value='95';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(()=>document.getElementById('size-out').textContent==='95%');
  await page.locator('#inspect').click();
  assert.match(await page.locator('#inspection-title').textContent(),/selected/i);
  await page.locator('#occlusion').uncheck();
  await page.locator('#anchor').check();
  await page.locator('#reset').click();
  assert.equal(await page.locator('#occlusion').isChecked(),true);
  assert.equal(await page.locator('#view').inputValue(),'ne');
  await page.screenshot({path:'sprite-scene-v7-desktop.png',fullPage:true});
  assert.deepEqual(errors,[],'V7 must not cause uncaught browser errors');


  // R04 public Pages route: local ZIP selection, failure recovery and import UI.
  const dosPreview=await page.goto('http://127.0.0.1:'+PORT+base+'web_deploy/');
  assert.equal(dosPreview.status(),200,'DOS import route served under Pages project subpath');
  assert.equal(await page.locator('#bundle-import').isVisible(),true);
  await page.screenshot({path:'dos-import-desktop.png',fullPage:true});
  await page.locator('#bundle-file').setInputFiles({
    name:'bad.jsdos',mimeType:'application/octet-stream',buffer:Buffer.from('not a ZIP')
  });
  await page.waitForFunction(()=>document.querySelector('#bundle-status').textContent.includes('Import failed'));
  assert.equal(await page.locator('#bundle-import').isVisible(),true,'invalid files keep importer visible');
  await page.waitForFunction(()=>typeof window.Dos==='function');
  await page.evaluate(()=>{
    window.__dosSmoke={mainCalls:0,extractions:0,blobUrl:''};
    window.Dos=(_canvas,_options)=>({
      ready(callback){
        callback({
          extract:async url=>{
            window.__dosSmoke.blobUrl=url;
            const response=await fetch(url);
            const bytes=new Uint8Array(await response.arrayBuffer());
            if(bytes[0]!==80||bytes[1]!==75)throw Error('ZIP signature missing');
            window.__dosSmoke.extractions++;
          },
          fs:{analyzePath:()=>({exists:true})}
        },commands=>{
          window.__dosSmoke.commands=commands;
          window.__dosSmoke.mainCalls++;
        });
      }
    });
  });
  await page.locator('#bundle-file').setInputFiles({
    name:'local-test.jsdos',
    mimeType:'application/octet-stream',
    buffer:Buffer.from([0x50,0x4b,0x03,0x04,0,0,0,0])
  });
  await page.waitForFunction(()=>window.__dosSmoke.mainCalls===1);
  assert.equal(await page.locator('#bundle-import').isVisible(),false,'hide import only after success');
  assert.equal(await page.locator('#game-overlay').isVisible(),true);
  assert.deepEqual(await page.evaluate(()=>window.__dosSmoke.commands),[
    '-c','imgmount d LBA.ISO -t iso','-c','RELENT.EXE'
  ]);
  assert.match(await page.evaluate(()=>window.__dosSmoke.blobUrl),/^blob:/);
  assert.deepEqual(errors,[],'DOS import route reports no uncaught browser exceptions');

  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const mobileResponse=await mobile.goto('http://127.0.0.1:'+PORT+base);
  assert.equal(mobileResponse.status(),200);
  await mobile.locator('#list .project').first().waitFor();
  await mobile.locator('[data-direction="w"]').click();
  await mobile.locator('#interact').click();
  await mobile.screenshot({path:'portfolio-mobile.png',fullPage:true});
  const spriteMobileResponse=await mobile.goto('http://127.0.0.1:'+PORT+base+'sprite-demo/');
  assert.equal(spriteMobileResponse.status(),200);
  await mobile.locator('label[for="dir-nw"]').click();
  assert.equal(await mobile.locator('.sheet img').evaluate(el=>el.naturalWidth),1024);
  await mobile.screenshot({path:'sprite-demo-mobile.png',fullPage:true});
  const mcompare=await mobile.goto('http://127.0.0.1:'+PORT+base+'sprite-demo/compare.html');
  assert.equal(mcompare.status(),200);
  await mobile.waitForFunction(()=>document.body.dataset.rendered==='256px-lanczos-160.png');
  await mobile.locator('#direction').selectOption('nw');
  await mobile.locator('#palette').selectOption('256');
  await mobile.waitForFunction(()=>document.body.dataset.rendered==='256px-lanczos-256.png');
  assert.equal(await mobile.locator('#alpha-levels').textContent(),'256');
  await mobile.screenshot({path:'sprite-compare-mobile.png',fullPage:true});
  const v7mobile=await mobile.goto('http://127.0.0.1:'+PORT+base+'sprite-demo/scene-lab.html');
  assert.equal(v7mobile.status(),200);
  await mobile.waitForFunction(()=>document.getElementById('scene').dataset.rendered==='ne-160');
  await mobile.locator('#view').selectOption('nw');
  await mobile.waitForFunction(()=>document.getElementById('scene').dataset.rendered==='nw-160');
  const v7Width=await mobile.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(v7Width.page<=v7Width.viewport+1,'V7 QA room must not create horizontal overflow on mobile');
  await mobile.screenshot({path:'sprite-scene-v7-mobile.png',fullPage:true});

  const mobileOverflow=await mobile.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(mobileOverflow.scroll<=mobileOverflow.viewport+1,'V7 mobile must not overflow document');


  // M5: test a rights-approved original sprite via intercepted fixtures.
  // Neither this one-pixel test image nor this in-memory catalog enters dist/.
  const authored=await browser.newPage({viewport:{width:960,height:720}});
  await authored.addInitScript(()=>{
    window.__originalSpriteDraws=0;
    const original=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(...args){
      window.__originalSpriteDraws++;
      return original.apply(this,args);
    };
  });
  const source={origin:'original-art',creator:'synthetic browser fixture',
    license:'original',reviewStatus:'approved',allowedForPublicBuild:true};
  const doc={schemaVersion:1,assets:{
    originalbench:{atlasRef:'atlases/originalbench.png',reviewStatus:'approved',
      allowedForPublicBuild:true,source,
      pivot:{x:0,y:0},frames:[{action:'idle',direction:'se',rect:[0,0,1,1]}]}
  },rooms:{showroom:{scene:{schemaVersion:1,id:'showroom',width:10,depth:10,
    instances:[{id:'bench1',assetId:'originalbench',x:2,y:0,z:2}]}}}};
  await authored.route('**/assets/approved-worlds.json',route=>
    route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(doc)}));
  const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO96Zp4AAAAASUVORK5CYII=','base64');
  await authored.route('**/assets/atlases/originalbench.png',route=>
    route.fulfill({status:200,contentType:'image/png',body:pixel}));
  await authored.goto('http://127.0.0.1:'+PORT+base);
  await authored.waitForFunction(()=>window.__originalSpriteDraws>0,null,{timeout:10000});
  await authored.locator('#room-nav button').nth(1).click();
  await authored.locator('#list .project').first().waitFor();
  await authored.close();

  const scroll=await mobile.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(scroll.width<=scroll.viewport+1,'mobile must not horizontally overflow');
  console.log('Browser E2E: desktop, mobile, controls, nested path, and project fallback passed');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}

/** Browser acceptance smoke for the public static bundle under a GitHub Pages project subpath. */
import { chromium } from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join, extname} from 'node:path';
import assert from 'node:assert/strict';

const PORT=18765;
const ROOT=new URL('../../dist/',import.meta.url);
const base='/lba-custom-portfolio/';
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost:'+PORT);
  if(!url.pathname.startsWith(base)){res.writeHead(404);return res.end();}
  const requested=url.pathname.slice(base.length)||'index.html';
  const name=requested==='sprite-demo/'?'sprite-demo/index.html':requested;
  if(!/^(?:index\.html|game\.mjs|rules\.mjs|rooms\.mjs|approved-runtime\.mjs|modules\/(?:asset-core|scene-core|public-manifest)\.mjs|assets\/approved-worlds\.json|assets\/atlases\/[a-z0-9-]+\.png|sprite-demo\/(?:index\.html|telemetry-receiver\.png))$/.test(name)){res.writeHead(404);return res.end();}
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
  assert.deepEqual(actualSprite,{loaded:true,width:384,height:112},'real generated atlas reaches browser');
  const firstPosition=await page.locator('.sprite').evaluate(x=>getComputedStyle(x).backgroundPositionX);
  await page.locator('label[for="dir-sw"]').click();
  const secondPosition=await page.locator('.sprite').evaluate(x=>getComputedStyle(x).backgroundPositionX);
  assert.notEqual(firstPosition,secondPosition,'direction selection must change the rendered sprite');
  await page.screenshot({path:'sprite-demo-desktop.png',fullPage:true});

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
  assert.equal(await mobile.locator('.sheet img').evaluate(el=>el.naturalWidth),384);
  await mobile.screenshot({path:'sprite-demo-mobile.png',fullPage:true});

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

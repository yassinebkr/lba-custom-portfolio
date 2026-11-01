/** Browser acceptance smoke for the public static bundle under a GitHub Pages project subpath. */
import { chromium } from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {join, extname} from 'node:path';
import assert from 'node:assert/strict';

const PORT=18765;
const ROOT=new URL('../../dist/',import.meta.url);
const base='/lba-custom-portfolio/';
const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8'};
const server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://localhost:'+PORT);
  if(!url.pathname.startsWith(base)){res.writeHead(404);return res.end();}
  const name=url.pathname.slice(base.length)||'index.html';
  if(!/^(?:index\.html|game\.mjs|rules\.mjs|rooms\.mjs)$/.test(name)){res.writeHead(404);return res.end();}
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

  const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
  const mobileResponse=await mobile.goto('http://127.0.0.1:'+PORT+base);
  assert.equal(mobileResponse.status(),200);
  await mobile.locator('#list .project').first().waitFor();
  await mobile.locator('[data-direction="w"]').click();
  await mobile.locator('#interact').click();
  await mobile.screenshot({path:'portfolio-mobile.png',fullPage:true});
  const scroll=await mobile.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(scroll.width<=scroll.viewport+1,'mobile must not horizontally overflow');
  console.log('Browser E2E: desktop, mobile, controls, nested path, and project fallback passed');
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}

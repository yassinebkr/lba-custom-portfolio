/** Asset Studio UX E2E: real browser, data editing, import/export and responsive capture. */
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import assert from 'node:assert/strict';

const url='http://127.0.0.1:4173/';
const child=spawn('npm',['run','preview','--','--host','127.0.0.1','--port','4173'],{cwd:new URL('../',import.meta.url),stdio:'pipe',shell:false});
let browser;
async function ready(){
 for(let i=0;i<60;i++){
  try{const response=await fetch(url);if(response.ok)return;}catch{}
  if(child.exitCode!==null)throw Error('Studio preview exited early: '+child.exitCode);
  await sleep(200);
 }
 throw Error('Vite preview not ready');
}
try{
 await ready();
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url,{waitUntil:'networkidle'});
 await page.getByText('ASSET LIBRARY').waitFor();
 assert.equal(await page.locator('.scene-item').count(),6,'Original scene has six editable objects');
 await page.locator('.asset-card').filter({hasText:'Workshop Door'}).click();
 const svg=page.locator('svg.iso-canvas');
 const rect=await svg.boundingBox();assert.ok(rect);
 // x=1, z=1 -> screen (460,133) inside open tile.
 await page.mouse.click(rect.x+(460/920)*rect.width,rect.y+(133/540)*rect.height);
 assert.equal(await page.locator('.scene-item').count(),7,'Click-to-place adds an object');
 await page.locator('.inspector').getByLabel('Display label').fill('Main gallery entrance');
 assert.equal(await page.locator('.selection-title h2').textContent(),'Main gallery entrance');
 const downloadPromise=page.waitForEvent('download');
 await page.getByRole('button',{name:/Export/}).click();
 const download=await downloadPromise;
 assert.equal(download.suggestedFilename(),'workshop-01.json');
 const downloadPath=await download.path();assert.ok(downloadPath);
 await page.getByRole('button',{name:/Save/}).click();
 assert.match((await page.locator('.dirty-state').textContent())||'',/Saved/);
 await page.locator('input[type=file]').setInputFiles(downloadPath);
 assert.equal(await page.locator('.scene-item').count(),7,'Reimport preserves instance count');
 await page.screenshot({path:'studio-desktop.png',fullPage:true});
 assert.deepEqual(errors,[],'no uncaught browser errors');

 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await mobile.goto(url,{waitUntil:'networkidle'});
 await mobile.getByText('ASSET LIBRARY').waitFor();
 const dims=await mobile.evaluate(()=>({doc:document.documentElement.scrollWidth,screen:window.innerWidth}));
 assert.ok(dims.doc<=dims.screen+3,'Studio has no page-wide horizontal overflow');
 await mobile.screenshot({path:'studio-mobile.png',fullPage:true});
 console.log('Studio E2E passed: layout, edit, export/reimport, save, mobile, zero page errors');
} finally {
 await browser?.close();
 child.kill('SIGTERM');
}

/** Browser UX smoke with a bounded preview server and guaranteed cleanup. */
import {chromium} from 'playwright';
import {preview} from 'vite';
import assert from 'node:assert/strict';

const server=await preview({
 configFile:new URL('../vite.config.ts',import.meta.url).pathname,
 preview:{host:'127.0.0.1',port:4173,strictPort:true}
});
let browser;
const url='http://127.0.0.1:4173/';
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox'],timeout:15000});
 const page=await browser.newPage({viewport:{width:1440,height:900},acceptDownloads:true});
 page.setDefaultTimeout(9000);
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url,{waitUntil:'domcontentloaded',timeout:15000});
 await page.locator('.asset-grid .asset-card').first().waitFor();
 assert.equal(await page.locator('.scene-item').count(),6,'initial original scene fixtures');
 await page.locator('.asset-card').filter({hasText:'Workshop Door'}).click();
 const bounds=await page.locator('svg.iso-canvas').boundingBox();assert.ok(bounds);
 await page.mouse.click(bounds.x+(460/920)*bounds.width,bounds.y+(133/540)*bounds.height);
 assert.equal(await page.locator('.scene-item').count(),7,'scene placement works');
 await page.locator('.full-label input').fill('Main entrance');
 assert.equal(await page.locator('.selection-title h2').textContent(),'Main entrance');
 const downloadEvent=page.waitForEvent('download',{timeout:9000});
 await page.locator('.top-actions').getByRole('button',{name:'Export'}).click();
 const dl=await downloadEvent;
 assert.equal(dl.suggestedFilename(),'workshop-01.json');
 const downloadPath=await dl.path();assert.ok(downloadPath);
 await page.locator('.top-actions').getByRole('button',{name:'Save'}).click();
 await page.locator('input[type=file]').setInputFiles(downloadPath);
 assert.equal(await page.locator('.scene-item').count(),7,'export/import round trip');
 await page.screenshot({path:'studio-desktop.png',fullPage:true});
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 mobile.setDefaultTimeout(9000);
 await mobile.goto(url,{waitUntil:'domcontentloaded',timeout:15000});
 await mobile.locator('.asset-grid .asset-card').first().waitFor();
 const overflow=await mobile.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:window.innerWidth}));
 assert.ok(overflow.width<=overflow.viewport+3,'no mobile page-wide overflow');
 await mobile.screenshot({path:'studio-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log('Studio browser E2E passed (desktop, mobile, editor, export/import)');
}finally{
 await browser?.close();
 await new Promise(resolve=>server.httpServer.close(resolve));
}

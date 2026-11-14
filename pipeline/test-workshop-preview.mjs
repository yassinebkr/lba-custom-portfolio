/**
 * Browser acceptance on the generated, unapproved artist preview only.
 * Uses genuine rendered sprite atlases and the existing portfolio navigation.
 */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const root=resolve(new URL('..',import.meta.url).pathname);
const folder=join(root,'output/workshop-preview');
const mime={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.json':'application/json; charset=utf-8','.png':'image/png','.css':'text/css; charset=utf-8'};
const server=createServer(async(req,res)=>{
 const requested=new URL(req.url,'http://localhost').pathname;
 const path=resolve(folder,'.'+(requested==='/'?'/index.html':requested));
 if(!path.startsWith(folder+sep)){res.writeHead(403);res.end();return;}
 try{
  const bytes=await readFile(path);
  res.writeHead(200,{'content-type':mime[extname(path)]||'application/octet-stream'});
  res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:920}});
 const errors=[];
 page.on('pageerror',error=>errors.push('JS: '+error.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
 page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
 await page.addInitScript(()=>{
  window.__drawnAtlases={};
  window.__walkFrames=[];
  const draw=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(img,...args){
   const path=String(img?.src||'');
   if(path.includes('/assets/atlases/')){
    const name=path.split('/').pop();
    window.__drawnAtlases[name]=(window.__drawnAtlases[name]||0)+1;
    if(name==='workshop-guide.png'&&args.length>=8){
     window.__walkFrames.push(args.slice(0,4).join(','));
     if(window.__walkFrames.length>80)window.__walkFrames.shift();
    }
   }
   return draw.call(this,img,...args);
  };
 });
 const url='http://127.0.0.1:'+server.address().port+'/';
 assert.equal((await page.goto(url)).status(),200);
 await page.waitForFunction(()=>Object.keys(window.__drawnAtlases||{}).length>=6,
                            null,{timeout:20000});
 assert.equal(await page.locator('#preview-note').isVisible(),true);
 assert.equal(await page.locator('.room-button').count(),6);
 const manifest=await page.evaluate(async()=> (await fetch('/assets/preview-worlds.json')).json());
 assert.equal(manifest.previewOnly,true);
 assert.equal(Object.keys(manifest.assets).length,8);
 assert.equal(manifest.rooms.showroom.scene.instances.length,8);
 for(const a of Object.values(manifest.assets)){
  assert.equal(a.reviewStatus,'pending');
  assert.equal(a.allowedForPublicBuild,false);
 }
 const publicCatalog=await page.evaluate(async()=> (await fetch('/assets/approved-worlds.json')).json());
 assert.equal(Object.keys(publicCatalog.assets).length,0,'Preview cannot silently approve public art');

 // The existing gameplay UI opens a project by proximity and the E key.
 await page.keyboard.press('ArrowRight'); // start (5,8) -> (6,8), near ShellFolio (7,7)
 await page.keyboard.press('e');
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent==='Viewing ShellFolio');
 assert.equal(await page.locator('#info h2').textContent(),'ShellFolio');
 assert.equal(await page.locator('#info .project-link').getAttribute('href'),
              'https://github.com/yassinebkr/ShellFolio');
 await page.waitForTimeout(650);
 const frames=await page.evaluate(()=>window.__walkFrames);
 assert.ok(new Set(frames).size>=2,'The authored player gait must produce visibly different atlas frames');
 assert.ok((await page.evaluate(()=>window.__drawnAtlases['workshop-guide.png']))>2);
 await page.locator('#list .project[data-id="cinepi"]').click();
 assert.equal(await page.locator('#info h2').textContent(),'CinePi');
 assert.match(await page.locator('#info .project-link').getAttribute('href'),/cinematepi5/);

 await page.screenshot({path:'workshop-preview-desktop.png',fullPage:true});
 // Change room: the preview art must NOT leak into unrelated rooms.
 await page.locator('.room-button[data-room="origin"]').click();
 await page.waitForFunction(()=>document.querySelector('.stage .bar')?.textContent.includes('ORIGIN'));
 assert.deepEqual(errors,[]);
 console.log('Workshop local preview passed: original sprite atlases, animated player, interaction link, and room isolation.');
} finally {
 await browser?.close();
 await new Promise(resolve=>server.close(resolve));
}

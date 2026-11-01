import test from 'node:test';import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';import {mkdtemp,rm,readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';import pngjs from 'pngjs';
import {paletteFromRGBA,convertOriginalRGBA,exportOriginalPNG} from './encode.mjs';
import {decodeBrick,decodeSprite} from '../../packages/asset-core/index.mjs';
const {PNG}=pngjs;
function sample(){
 const png=new PNG({width:48,height:38});
 for(let y=0;y<png.height;y++)for(let x=0;x<png.width;x++){
  const k=(y*png.width+x)*4;
  png.data[k]=x%2?200:66;png.data[k+1]=x+y;png.data[k+2]=160;
  png.data[k+3]=x>4&&y>4&&x<42&&y<32?255:0;
 }
 return {png,bytes:PNG.sync.write(png)};
}
test('palette comes solely from owned image and preserves transparent zero',()=>{
 const palette=paletteFromRGBA(Uint8Array.from([10,20,30,0,15,80,120,255]));
 assert.deepEqual([...palette.slice(0,3)],[0,0,0]);
 assert.deepEqual([...palette.slice(3,6)],[15,80,120]);
});
test('PNG-derived indexed sprite and brick round-trip geometry and offsets',()=>{
 const {png}=sample();
 for(const kind of ['sprite','brick']){
  const a=convertOriginalRGBA({width:48,height:38,rgba:png.data,kind,offsetX:-17,offsetY:12});
  const out=kind==='sprite'?decodeSprite(a.binary):decodeBrick(a.binary);
  assert.equal(out.width,48);assert.equal(out.height,38);
  assert.equal(out.offsetX,-17);assert.equal(out.offsetY,12);
  assert.equal(out.pixels[0],0);
  assert.ok(out.pixels[500]>0);
 }
});
test('export manifest remains pending and repeated builds are deterministic',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'asset-compat-'));
 try{
  const input=join(dir,'source.png');await writeFile(input,sample().bytes);
  const out=join(dir,'export');
  const options={id:'original-camera',creator:'project-owner',kind:'brick',offsetX:-3};
  const a=await exportOriginalPNG(input,out,options);
  assert.equal(a.allowedForPublicBuild,false);
  assert.equal(a.reviewStatus,'pending');
  const first=await readFile(join(out,a.binaryRef));
  await exportOriginalPNG(input,out,options);
  assert.deepEqual(await readFile(join(out,a.binaryRef)),first);
  const meta=JSON.parse(await readFile(join(out,'original-camera.json'),'utf8'));
  assert.match(meta.sourceSha256,/^[a-f0-9]{64}$/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('malformed and all-transparent sources are rejected',()=>{
 assert.throws(()=>paletteFromRGBA(new Uint8Array([0,0,0,0])));
 assert.throws(()=>convertOriginalRGBA({width:256,height:1,rgba:new Uint8Array(1024)}));
});

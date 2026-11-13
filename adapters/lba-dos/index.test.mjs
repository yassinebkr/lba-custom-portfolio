import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {cropRGBA,resizeRGBA,paletteFromImages,convertWorldImages} from './index.mjs';
import {decodeSprite,decodeBrick} from '../../packages/asset-core/index.mjs';

const world=JSON.parse(readFileSync(new URL('../../examples/world-package/telemetry.json',import.meta.url),'utf8'));
const rgba=(width,height,fill)=>({width,height,rgba:Uint8Array.from({length:width*height*4},(_,i)=>fill(i%4,Math.floor(i/4)%width,Math.floor(i/4/width)))});
test('R03 crop preserves exact source pixels',()=>{
  const image=rgba(4,3,(c,x,y)=>c===3?255:x*20+y*4+c);
  const crop=cropRGBA(image,[1,1,2,2]);
  assert.deepEqual([crop.width,crop.height],[2,2]);
  assert.equal(crop.rgba[0],image.rgba[(1*4+1)*4]);
  assert.throws(()=>cropRGBA(image,[3,0,2,2]),/Invalid RGBA crop/);
});
test('R03 premultiplied resize avoids dark transparent fringe',()=>{
  const original={width:2,height:1,rgba:Uint8Array.from([255,255,0,255,0,0,0,0])};
  const sampled=resizeRGBA(original,1,1);
  assert.deepEqual([...sampled.rgba],[255,255,0,128]);
});
test('R03 palette index zero remains reserved and deterministic',()=>{
  const image=rgba(3,2,(c,x,y)=>c===3?255:c===0?x*30:c===1?y*60:160);
  const a=paletteFromImages([image]);
  const b=paletteFromImages([image]);
  assert.deepEqual(a,b);
  assert.deepEqual([...a.slice(0,3)],[0,0,0]);
});
test('R03 binary payloads are independent indexed frames and one original-scene brick',()=>{
  const base=rgba(768,192,(c,x,y)=>c===3?(x%192===0?100:255):c===0?(x%160):c===1?(y%180):82);
  const bg=rgba(300,200,(c,x,y)=>c===3?255:c===0?(x%256):c===1?(y%256):60);
  const result=convertWorldImages({world,assetId:'telemetry-receiver',atlas:base,background:bg,target:128});
  assert.deepEqual(Object.keys(result.sprites),['ne','nw','sw','se']);
  assert.deepEqual(result.report.dimensions.sprite,[128,128]);
  assert.deepEqual(result.report.dimensions.sceneBrick,[128,85]);
  assert.deepEqual(result.report.offsets,{x:-64,y:-127});
  for(const sprite of Object.values(result.sprites)){
    const decoded=decodeSprite(sprite.payload);
    assert.equal(decoded.width,128);
    assert.equal(decoded.height,128);
    assert.equal(decoded.offsetY,-127);
    assert.equal(sprite.preview.rgba.length,128*128*4);
  }
  assert.equal(decodeBrick(result.scenery.payload).height,85);
  assert.ok(result.report.fourSpriteBytes>0);
  assert.ok(result.report.sceneMetrics.snappedPixels>=0);
});
test('R03 refuses 192px source with an unrepresentable signed Y pivot',()=>{
  const base=rgba(768,192,(c,x,y)=>c===3?255:c===0?x%255:c===1?y%255:77);
  const bg=rgba(30,20,(c,x,y)=>c===3?255:c===0?x:c===1?y:44);
  assert.throws(()=>convertWorldImages({world,assetId:'telemetry-receiver',atlas:base,background:bg,target:192}),
    /signed-offset limit/);
});
test('R03 uses an explicitly supplied shared DOS palette',()=>{
  const base=rgba(768,192,(c,x,y)=>c===3?255:c===0?70:c===1?130:180);
  const bg=rgba(30,20,(c,x,y)=>c===3?255:c===0?70:c===1?130:180);
  const palette=new Uint8Array(768);
  palette.set([70,130,180],3);
  const data=convertWorldImages({world,assetId:'telemetry-receiver',atlas:base,background:bg,palette,target:128});
  assert.equal(data.report.paletteSource,'private-dos-palette');
  assert.deepEqual(data.palette,palette);
});

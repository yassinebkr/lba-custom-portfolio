import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeSprite,decodeSprite} from '../../packages/asset-core/index.mjs';
import {inspectSpriteFrames,replaceSpriteFrame} from './sprite-frames.mjs';

const make=(w,h,x,y,color)=>{
 const pixels=new Uint8Array(w*h).fill(color);
 return encodeSprite({width:w,height:h,offsetX:x,offsetY:y,pixels});
};
function multi(...singleFrames){
 const frames=singleFrames.map(s=>s.subarray(4));
 const size=frames.reduce((n,f)=>n+f.byteLength,frames.length*4);
 const out=new Uint8Array(size),view=new DataView(out.buffer);
 let offset=frames.length*4;
 frames.forEach((f,i)=>{view.setUint32(i*4,offset,true);out.set(f,offset);offset+=f.length});
 return out;
}
test('one-frame sprite is supported with the familiar four-byte table',()=>{
 const original=make(24,30,-12,-23,7);
 const parsed=inspectSpriteFrames(original);
 assert.equal(parsed.frameCount,1);
 assert.equal(parsed.frames[0].decoded.width,24);
 const modified=replaceSpriteFrame(original,make(24,30,-12,-23,23));
 assert.equal(modified.changedFrame,0);
 assert.equal(modified.frameCount,1);
 assert.deepEqual(modified.payload,make(24,30,-12,-23,23));
});
test('two-frame DOS entry retains all bytes of untouched frame and moves the offset table safely',()=>{
 const original=multi(make(24,30,-12,-23,7),make(32,34,-20,-21,8));
 assert.equal(new DataView(original.buffer).getUint32(0,true),8);
 const parsed=inspectSpriteFrames(original);
 assert.equal(parsed.frameCount,2);
 const gradient=Uint8Array.from({length:24*30},(_,i)=>1+(i%180));
 const newFrame=encodeSprite({width:24,height:30,offsetX:-12,offsetY:-23,pixels:gradient});
 const out=replaceSpriteFrame(original,newFrame,0);
 assert.equal(out.frameCount,2);
 const after=inspectSpriteFrames(out.payload);
 assert.equal(after.frameCount,2);
 assert.deepEqual(after.frames[0].decoded.pixels,decodeSprite(newFrame).pixels);
 assert.deepEqual(after.frames[1].bytes,parsed.frames[1].bytes);
 assert.deepEqual(inspectSpriteFrames(original).frames[1].bytes,parsed.frames[1].bytes);
 assert.ok(after.frames[1].offset!==parsed.frames[1].offset,
  'different size replacement must update all offsets');
});
test('three-frame entry preserves first and final raw frames if editing middle',()=>{
 const original=multi(
  make(24,26,-10,-20,8),make(32,34,-20,-21,11),make(24,35,-12,-24,9)
 );
 const after=inspectSpriteFrames(replaceSpriteFrame(original,make(32,34,-20,-21,15),1).payload);
 const before=inspectSpriteFrames(original);
 assert.equal(after.frameCount,3);
 for(const idx of [0,2])assert.deepEqual(after.frames[idx].bytes,before.frames[idx].bytes);
 assert.equal(after.frames[1].decoded.pixels[0],15);
});
test('reject mismatched native dimensions, offsets, and out-of-range frame',()=>{
 const original=multi(make(24,30,-12,-23,7),make(32,34,-20,-21,8));
 assert.throws(()=>replaceSpriteFrame(original,make(24,30,-11,-23,21),0),/native offsetX/);
 assert.throws(()=>replaceSpriteFrame(original,make(25,30,-12,-23,21),0),/native width/);
 assert.throws(()=>replaceSpriteFrame(original,make(24,30,-12,-23,21),3),/outside/);
});
test('unknown/corrupted offset tables are rejected, never guessed or rewritten',()=>{
 const original=multi(make(24,30,-12,-23,7),make(32,34,-20,-21,8));
 const malformed=Uint8Array.from(original);
 new DataView(malformed.buffer).setUint32(0,10,true);
 assert.throws(()=>inspectSpriteFrames(malformed),/Unsupported sprite frame offset/);
 const duplicate=Uint8Array.from(original);
 new DataView(duplicate.buffer).setUint32(4,8,true);
 assert.throws(()=>inspectSpriteFrames(duplicate),/Invalid sprite frame offset/);
 const trunc=original.subarray(0,20);
 assert.throws(()=>inspectSpriteFrames(trunc),/sprite frame 0|Sprite frame 0|Truncated|Invalid/);
});

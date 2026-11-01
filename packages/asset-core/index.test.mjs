import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeBrick,decodeBrick,encodeSprite,decodeSprite,rgbaToIndexed,indexedToRGBA,projectIso,painterSort} from './index.mjs';
const p=(w,h,fn)=>Uint8Array.from({length:w*h},(_,i)=>fn(i%w,Math.floor(i/w)));
const roundTrip=(w,h,pixels,offsetX=-7,offsetY=11)=>{
 for(const [encoder,decoder] of [[encodeBrick,decodeBrick],[encodeSprite,decodeSprite]]){
  const frame={width:w,height:h,offsetX,offsetY,pixels};
  const decoded=decoder(encoder(frame));
  assert.deepEqual(decoded,frame);
 }
};
test('original indexed RLE encoding retains offsets, transparency and literal runs',()=>{
 roundTrip(11,7,p(11,7,(x,y)=>y===0?0:x<4?22:(x+y)%2?8:9));
});
test('minimum/maximum dimensions and long run boundaries',()=>{
 roundTrip(1,1,new Uint8Array([0]),-128,127);
 roundTrip(255,255,p(255,255,(x,y)=>(x*13+y*7)%17),127,-128);
 roundTrip(255,1,new Uint8Array(255).fill(77));
 roundTrip(1,255,new Uint8Array(255));
});
test('seeded fuzz: 80 distinct synthetic images survive both codecs',()=>{
 let seed=0xabcdef01;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
 for(let n=0;n<80;n++){
  const w=1+Math.floor(random()*120),h=1+Math.floor(random()*85);
  const density=random();
  roundTrip(w,h,p(w,h,()=>random()<density?0:1+Math.floor(random()*254)));
 }
});
test('fail closed on malformed, oversized, truncated and trailing bytes',()=>{
 assert.throws(()=>encodeBrick({width:256,height:1,pixels:new Uint8Array(256)}));
 assert.throws(()=>encodeSprite({width:8,height:1,pixels:new Uint8Array(7)}));
 assert.throws(()=>decodeBrick(new Uint8Array([1,1,0,0,1,0xc0])));
 assert.throws(()=>decodeBrick(new Uint8Array([2,1,0,0,1,0])));
 assert.throws(()=>decodeBrick(new Uint8Array([1,1,0,0,1,0x40])));
 assert.throws(()=>decodeSprite(new Uint8Array([5,0,0,0,1,1,0,0,1,0x80,2])));
 const good=encodeBrick({width:1,height:1,pixels:new Uint8Array([2])});
 assert.throws(()=>decodeBrick(Uint8Array.from([...good,99])));
 assert.throws(()=>encodeBrick({width:1,height:1,offsetX:128,pixels:new Uint8Array([1])}));
});
test('external ORIGINAL palette is required; index zero stays transparent',()=>{
 const palette=new Uint8Array(768);for(let i=1;i<256;i++){palette[i*3]=i;palette[i*3+1]=200;palette[i*3+2]=i;}
 const rgba=Uint8Array.from([1,2,3,0,20,200,20,255,17,200,18,255]);
 const indexed=rgbaToIndexed({width:3,height:1,rgba,palette});
 assert.deepEqual([...indexed.pixels],[0,20,17]);assert.equal(indexed.snapped,1);
 assert.deepEqual([...indexedToRGBA(indexed.pixels,palette).slice(0,4)],[0,0,0,0]);
 assert.throws(()=>rgbaToIndexed({width:3,height:1,rgba,palette,strict:true}));
});
test('isometric projection and stable depth ordering match original geometry',()=>{
 assert.deepEqual(projectIso(2,1,1),{x:24,y:21});
 const a=[{id:'a',x:4,z:3,y:0},{id:'b',x:2,z:2,y:0},{id:'c',x:2,z:2,y:1}];
 assert.deepEqual(painterSort(a).map(x=>x.id),['b','c','a']);
 assert.equal(a[0].id,'a','sort does not mutate input');
});

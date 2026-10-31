import test from 'node:test';import assert from 'node:assert/strict';
import {validateClip,createClip,frameAt} from './animation.mjs';
test('deterministic frame changes and loop',()=>{
 const c=createClip('door',3);
 assert.deepEqual(validateClip(c),[]);
 assert.equal(frameAt(c,159).index,0);
 assert.equal(frameAt(c,160).index,1);
 assert.equal(frameAt(c,320).index,2);
 assert.equal(frameAt(c,480).index,0);
});
test('non-loop holds last state',()=>{
 const c=createClip('door',3);c.loop=false;
 assert.equal(frameAt(c,100000).index,2);
});
test('invalid times and frame metadata rejected',()=>{
 const c=createClip('camera',2);
 assert.throws(()=>frameAt(c,-1));
 assert.throws(()=>frameAt(c,NaN));
 c.frames[0].durationMs=0;c.frames[1].glow=3;
 assert.equal(validateClip(c).length,2);
});
test('blank and oversized sequences rejected',()=>{
 assert.ok(validateClip({id:'bad',loop:true,frames:[]}).length);
 assert.ok(validateClip({id:'bad',loop:true,frames:Array(121).fill({})}).length);
});

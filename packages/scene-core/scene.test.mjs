import test from 'node:test';import assert from 'node:assert/strict';
import {validateScene,commandsForScene,drawScene,occupiedCells} from './scene.mjs';
const catalog={
 floor:{atlasRef:'original/floor.png',frames:[{action:'idle',direction:'se',rect:[0,0,48,26]}],pivot:{x:24,y:13},solid:false},
 table:{atlasRef:'original/bench.png',frames:[{action:'idle',direction:'se',rect:[0,0,96,112]}],pivot:{x:48,y:108},footprint:{width:2,depth:1},solid:true},
 lamp:{atlasRef:'original/lamp.png',frames:[0,1].map(i=>({action:'active',direction:'se',rect:[i*32,0,32,48]})),pivot:{x:16,y:47},solid:false}
};
const scene=()=>({schemaVersion:1,id:'original-workshop',width:12,depth:12,instances:[
 {id:'floor-a',assetId:'floor',x:2,z:2,y:0},
 {id:'floor-b',assetId:'floor',x:3,z:2,y:0},
 {id:'bench',assetId:'table',x:5,z:5,y:0},
 {id:'lamp',assetId:'lamp',x:7,z:5,y:1,action:'active'}
]});
test('scene preserves separate instances of same brick (no destructive merging)',()=>{
 const commands=commandsForScene(scene(),catalog);
 assert.equal(commands.length,4);
 assert.equal(new Set(commands.map(c=>c.instanceId)).size,4);
 assert.equal(commands.filter(c=>c.assetId==='floor').length,2);
});
test('screen coordinates use main-branch dimetric projection and offsets',()=>{
 const commands=commandsForScene(scene(),catalog,{originX:480,originY:110});
 const floor=commands.find(c=>c.instanceId==='floor-a');
 assert.equal(floor.screenX,480-24);
 assert.equal(floor.screenY,110+48-13);
});
test('state timeline selects true atlas frames, not cartoon primitives',()=>{
 const frames=commandsForScene(scene(),catalog,{frameIndex:1});
 assert.equal(frames.find(c=>c.instanceId==='lamp').sourceX,32);
});
test('draw call uses original full frame bounds and independent atlas',()=>{
 const calls=[];const ctx={drawImage(...args){calls.push(args)}};
 const cmds=commandsForScene(scene(),catalog);
 drawScene(ctx,cmds,{'original/floor.png':{},'original/bench.png':{},'original/lamp.png':{}});
 assert.equal(calls.length,4);assert.equal(calls[0].length,9);
 assert.throws(()=>drawScene(ctx,cmds,{}),/Missing approved atlas/);
});
test('collision footprint marks two bench cells but not floor or lamp',()=>{
 const blocks=occupiedCells(scene(),catalog);
 assert.deepEqual([...blocks].sort(),['5:5','6:5']);
});
test('reject bad positions, duplicated identities, unknown art and overflow',()=>{
 const s=scene();s.instances[1].id=s.instances[0].id;
 assert.throws(()=>validateScene(s,catalog),/Duplicate/);
 s.instances[1].id='floor-b';s.instances[1].assetId='legacy-lba-asset';
 assert.throws(()=>validateScene(s,catalog),/Unknown/);
 s.instances[1].assetId='floor';s.instances[1].x=130;
 assert.throws(()=>validateScene(s,catalog),/outside/);
});

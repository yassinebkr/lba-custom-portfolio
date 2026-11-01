import test from 'node:test';import assert from 'node:assert/strict';
import {validateApprovedManifest} from './index.mjs';
const doc=()=>({schemaVersion:1,assets:{},rooms:{}});
const source={origin:'original-art',license:'original',creator:'project-owner',reviewStatus:'approved',allowedForPublicBuild:true};
const asset={source,reviewStatus:'approved',allowedForPublicBuild:true,atlasRef:'atlases/bench.png',
 pivot:{x:24,y:30},frames:[{action:'idle',direction:'se',rect:[0,0,48,60]}]};
test('no unapproved assets published by default',()=>assert.equal(validateApprovedManifest(doc()),true));
test('original approved assets pass without game data',()=>{
 const d=doc();d.assets.bench=asset;
 d.rooms.workshop={scene:{schemaVersion:1,id:'workshop',instances:[{id:'a',assetId:'bench'}]}};
 assert.equal(validateApprovedManifest(d),true);
});
test('pending, traversal and invalid room refs fail closed',()=>{
 const d=doc();d.assets.bench={...asset,reviewStatus:'pending'};
 assert.throws(()=>validateApprovedManifest(d));
 d.assets.bench={...asset,atlasRef:'../bad.png'};
 assert.throws(()=>validateApprovedManifest(d));
 d.assets.bench=asset;
 d.rooms.workshop={scene:{id:'workshop',schemaVersion:1,instances:[{assetId:'unknown'}]}};
 assert.throws(()=>validateApprovedManifest(d));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {SCHEMA_VERSION,validateAssetCatalog,validateSceneDocument,validateSource,validateAnimation,assertValid,makeApprovedSource} from './index.mjs';
const asset=(id='prop')=>({id,name:'Original prop',kind:'prop',source:makeApprovedSource()});
const scene=()=>({schemaVersion:SCHEMA_VERSION,id:'workshop',name:'Workshop',width:10,depth:10,instances:[{id:'obj1',assetId:'prop',x:1,z:2,layer:1,rotation:0,interactive:false,label:'Workbench'}]});
test('original assets and scenes validate',()=>{
 assert.deepEqual(validateAssetCatalog([asset()]),[]);
 assert.deepEqual(validateSceneDocument(scene(),new Set(['prop'])),[]);
});
test('duplicate catalog identifiers rejected',()=>assert.ok(validateAssetCatalog([asset(),asset()]).some(e=>e.code==='asset.duplicate')));
test('source license and provenance required',()=>{
 const s=makeApprovedSource();s.allowedForPublicBuild=true;s.reviewStatus='pending';
 assert.ok(validateSource(s).some(e=>e.code==='source.not-approved'));
 const missing={...s,license:'UNLICENSED'};assert.ok(validateSource(missing).some(e=>e.code==='source.license'));
});
test('attribution required for CC-BY',()=>{
 const s={...makeApprovedSource(),license:'CC-BY-4.0',attribution:null};
 assert.ok(validateSource(s).some(e=>e.code==='source.attribution'));
});
test('unsafe path rejected',()=>assert.ok(validateAssetCatalog([{...asset(),atlasRef:'../../secret.png'}]).some(e=>e.code==='asset.path')));
test('cross-reference and bounds rejected',()=>{
 const s=scene();s.instances[0].assetId='unknown';s.instances[0].x=100;
 assert.ok(validateSceneDocument(s,new Set(['prop'])).length>=2);
});
test('bad schema version and duplicate instance IDs rejected',()=>{
 const s=scene();s.schemaVersion=900;s.instances.push({...s.instances[0]});
 const errs=validateSceneDocument(s,new Set(['prop']));
 assert.ok(errs.some(e=>e.code==='scene.version'));
 assert.ok(errs.some(e=>e.code==='instance.duplicate'));
});
test('invalid animation durations and paths rejected',()=>{
 const errors=validateAnimation({id:'blink',loop:true,frames:[{durationMs:0,imageRef:'../../secret.png'}]});
 assert.ok(errors.some(e=>e.code==='animation.duration'));
 assert.ok(errors.some(e=>e.code==='animation.image'));
});
test('assertValid raises with explainable error',()=>assert.throws(()=>assertValid(validateSceneDocument({},new Set())),/scene/));
test('reject malformed and huge inputs without crash',()=>{
 assert.ok(validateSceneDocument(null).length);
 assert.ok(validateAssetCatalog({}).length);
 assert.ok(validateAnimation({frames:Array(250).fill({})}).length);
});

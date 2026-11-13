import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateWorldPackage,assertWorldPackage,referencedImages,safeImageRef} from '../packages/world-package/index.mjs';

const fixture=JSON.parse(readFileSync(new URL('../examples/world-package/telemetry.json',import.meta.url),'utf8'));
const clone=()=>structuredClone(fixture);
const hasCode=(world,code,options)=>validateWorldPackage(world,options).some(e=>e.code===code);

test('R02 validates original runtime-neutral world metadata',()=>{
  assert.deepEqual(validateWorldPackage(clone()),[]);
  assert.equal(referencedImages(clone()).length,2);
});
test('R02 requires explicit rights approval for public release',()=>{
  assert.equal(hasCode(clone(),'world.approval',{requireApproved:true}),true);
  const approved=clone();
  approved.assets[0].source.reviewStatus='approved';
  approved.assets[0].source.allowedForPublicBuild=true;
  assert.deepEqual(validateWorldPackage(approved,{requireApproved:true}),[]);
});
test('R02 prevents path traversal and absolute URLs',()=>{
  for(const bad of ['../private.png','/private.png','https://example.org/x.png','../../foo.png','abc\\def.png','foo.png?x=1']){
    assert.equal(safeImageRef(bad),false,bad);
  }
  const world=clone();
  world.assets[0].sprite.imageRef='../private.png';
  assert.equal(hasCode(world,'sprite.path'),true);
});
test('R02 checks direction completeness, frame bounds and pivots',()=>{
  const world=clone();
  delete world.assets[0].sprite.views.sw;
  assert.equal(hasCode(world,'sprite.directions'),true);
  assert.equal(hasCode(world,'sprite.view'),true);
  world.assets[0].sprite.views.sw={x:800,y:0,durationMs:0};
  world.assets[0].sprite.pivotPx.x=400;
  assert.equal(hasCode(world,'sprite.rect'),true);
  assert.equal(hasCode(world,'sprite.duration'),true);
  assert.equal(hasCode(world,'sprite.pivot'),true);
});
test('R02 rejects unknown assets and duplicate scenes',()=>{
  const world=clone();
  world.scenes[0].instances[0].assetId='missing';
  assert.equal(hasCode(world,'instance.asset'),true);
  world.scenes.push(structuredClone(world.scenes[0]));
  assert.equal(hasCode(world,'scene.duplicate'),true);
});
test('R02 checks scene placement footprints and entry scene references',()=>{
  const world=clone();
  world.scenes[0].instances[0].x=11;
  assert.equal(hasCode(world,'scene.footprint'),true);
  world.entrySceneId='other-world';
  assert.equal(hasCode(world,'world.entry'),true);
});
test('R02 asserts errors using structured issue records',()=>{
  const world=clone();
  world.schemaVersion=2;
  assert.throws(()=>assertWorldPackage(world),error=>{
    assert.equal(error.issues[0].code,'world.version');
    return true;
  });
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeArchive,validateSpriteEntryIndices,replaceSpriteEntries} from './overlay.mjs';
import {encodeSprite} from '../../packages/asset-core/index.mjs';

const mockSprites=()=>{
  const pixels=new Uint8Array(4*4).fill(1);
  const frame={width:4,height:4,offsetX:-1,offsetY:-2,pixels};
  return Object.fromEntries(['ne','nw','sw','se'].map(d=>[d,{payload:encodeSprite(frame)}]));
};
test('R03 explicitly selected indices are unique and within the HQR table',()=>{
  assert.deepEqual(validateSpriteEntryIndices([1,2,3,4],10),[1,2,3,4]);
  assert.throws(()=>validateSpriteEntryIndices([0,0,2,3],10));
  assert.throws(()=>validateSpriteEntryIndices([1,2,3,20],10));
  assert.throws(()=>validateSpriteEntryIndices([1,2,3],10));
});
test('R03 patches only selected entries and preserves remaining references',()=>{
  const previous=Array.from({length:8},(_,i)=>({id:i}));
  const archive={entries:[...previous]};
  replaceSpriteEntries(archive,mockSprites(),[2,3,4,5]);
  assert.equal(archive.entries[0],previous[0]);
  assert.equal(archive.entries[1],previous[1]);
  assert.equal(archive.entries[6],previous[6]);
  assert.equal(archive.entries[7],previous[7]);
  for(const index of [2,3,4,5])assert.ok(archive.entries[index].content);
});
test('R03 refuses missing directional sprite entries',()=>{
  const sprites=mockSprites();delete sprites.sw;
  assert.throws(()=>replaceSpriteEntries({entries:new Array(8)},sprites,[0,1,2,3]));
});

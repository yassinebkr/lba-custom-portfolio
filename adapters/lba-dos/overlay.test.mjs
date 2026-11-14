import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeArchive,validateSpriteEntryIndices,replaceSpriteEntries,replaceSingleSpriteEntry} from './overlay.mjs';
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

test('R06 one DOS museum entry patch preserves its original geometry and other HQR entries',()=>{
  const source=encodeSprite({
    width:28,height:36,offsetX:-11,offsetY:-32,
    pixels:new Uint8Array(28*36).fill(12)
  });
  const replacement=encodeSprite({
    width:28,height:36,offsetX:-11,offsetY:-32,
    pixels:new Uint8Array(28*36).fill(6)
  });
  const archive={entries:Array.from({length:65},(_,i)=>({
    content: i===58?source:new Uint8Array([i+1])
  }))};
  const other=archive.entries[57];
  const info=replaceSingleSpriteEntry(archive,58,replacement);
  assert.deepEqual(info,{index:58,width:28,height:36,offsetX:-11,offsetY:-32});
  assert.equal(archive.entries[57],other);
  assert.deepEqual(new Uint8Array(archive.entries[58].content),replacement);
  assert.throws(()=>replaceSingleSpriteEntry(archive,999,replacement),/existing private/);
  assert.throws(()=>replaceSingleSpriteEntry(archive,58,encodeSprite({
    width:29,height:36,offsetX:-11,offsetY:-32,
    pixels:new Uint8Array(29*36)
  })),/native width/);
  assert.throws(()=>replaceSingleSpriteEntry(archive,58,encodeSprite({
    width:28,height:36,offsetX:0,offsetY:-32,
    pixels:new Uint8Array(28*36)
  })),/native offsetX/);
});

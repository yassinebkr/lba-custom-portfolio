import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {decodeSprite,encodeSprite} from '../../packages/asset-core/index.mjs';
import {ENTRY_INDEX,verifyMuseumEntry,makeReplacement} from './museum-sprite-probe.mjs';

const root=resolve(new URL('../..',import.meta.url).pathname);
const atlas=()=>readFile(resolve(root,'apps/portfolio/sprite-demo/compare/192px-lanczos-160.png'));
const palette=Uint8Array.from({length:768},(_,i)=>i%256);
const old=(w=40,h=45)=>encodeSprite({
  width:w,height:h,offsetX:-15,offsetY:-34,pixels:new Uint8Array(w*h).fill(24)
});

test('R06 metadata contains the genuine museum sprite reference and shows global impact',async()=>{
  const data=JSON.parse(await readFile(resolve(root,'metadata-ui/public/scene-sprites.json'),'utf8'));
  assert.equal(ENTRY_INDEX,58);
  assert.deepEqual(verifyMuseumEntry(data),{
    sceneIndex:43,entryIndex:58,sharedScenes:[1,43],
  });
  assert.throws(()=>verifyMuseumEntry({scenes:{'43':{sprites:[11]}},spriteToScenes:{'58':[43]}}),
    /not verified/);
});

test('R06 actual original Blender source generates a palette-correct DOS padlock replacement',async()=>{
  const source=await atlas();
  const out=makeReplacement({
    atlasBytes:source,palette,previousPayload:old(),direction:'se'
  });
  const restored=decodeSprite(out.payload);
  assert.deepEqual([restored.width,restored.height],[40,45]);
  assert.deepEqual([restored.offsetX,restored.offsetY],[-15,-34]);
  assert.ok(out.measurements.opaquePixels>80);
  assert.ok(out.measurements.paletteSnappedPixels>=0);
  assert.ok(out.preview.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')));
  assert.notDeepEqual(restored.pixels,new Uint8Array(40*45).fill(24));
});

test('R06 fail-closed rejects undocumented frames, unsupported dimensions and missing visibility',async()=>{
  const source=await atlas();
  assert.throws(()=>makeReplacement({atlasBytes:source,palette,previousPayload:old(),
    direction:'west'}),/Unsupported source view/);
  assert.throws(()=>makeReplacement({atlasBytes:source,palette,
    previousPayload:old(8,8)}),/too small/);
  assert.throws(()=>makeReplacement({atlasBytes:Buffer.from('not-png'),
    palette,previousPayload:old()}));
  const corrupt=Uint8Array.from(old());
  corrupt[0]=8; // multiframe pointer unsupported until verified
  assert.throws(()=>makeReplacement({atlasBytes:source,palette,
    previousPayload:corrupt}),/single-frame/);
});

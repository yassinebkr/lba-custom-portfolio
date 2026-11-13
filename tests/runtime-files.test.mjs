import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,symlinkSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inspectWorldFiles} from '../scripts/runtime/validate-world.mjs';

const world=JSON.parse(readFileSync(new URL('../examples/world-package/telemetry.json',import.meta.url),'utf8'));
test('R02 checks real original sprite and workshop PNG dimensions',async()=>{
  const result=await inspectWorldFiles(world,'.');
  assert.equal(result.imageCount,2);
  assert.ok(result.totalBytes>0);
  assert.deepEqual(result.images[0].width,768);
  assert.deepEqual(result.images[0].height,192);
});
test('R02 rejects source refs whose PNG bytes are unavailable',async()=>{
  const altered=structuredClone(world);
  altered.assets[0].sprite.imageRef='nonexistent/receiver.png';
  await assert.rejects(()=>inspectWorldFiles(altered,'.'));
});

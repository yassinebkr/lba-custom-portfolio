import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyPath,inspectTrackedPaths,trackedPaths,assertAudit} from '../scripts/runtime/audit.mjs';

test('R01 separates the authoring tool from the DOS launcher',()=>{
  assert.equal(classifyPath('pipeline/visual_matrix.py'),'authoring');
  assert.equal(classifyPath('web_deploy/index.html'),'dosRuntime');
  assert.equal(classifyPath('scripts/hqr-tools/patch-relent.js'),'dosTools');
  assert.equal(classifyPath('apps/portfolio/game.mjs'),'canvasPrototype');
});
test('R01 detects proprietary archive formats by extension',()=>{
  const result=inspectTrackedPaths(['web_deploy/index.html','web_deploy/game.jsdos','base_game/RESS.HQR','game/RELENT.EXE']);
  assert.deepEqual(result.protectedFiles,['web_deploy/game.jsdos','base_game/RESS.HQR','game/RELENT.EXE']);
});
test('R01 audit verifies tracked repository without private binary assets',()=>{
  const result=inspectTrackedPaths(trackedPaths());
  assert.deepEqual(result.protectedFiles,[]);
  assert.doesNotThrow(()=>assertAudit(result));
});

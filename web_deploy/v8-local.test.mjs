import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonOptions,setupV8Test} from './v8-local.mjs';

test('v8 comparison is DOSBox worker-only with local private blob URL and no auto saves',()=>{
 const fn=()=>{};
 const config=comparisonOptions('blob:r05-private',fn);
 assert.equal(config.backend,'dosbox');
 assert.equal(config.backendLocked,true);
 assert.equal(config.workerThread,true);
 assert.equal(config.autoStart,true);
 assert.equal(config.autoSave,false);
 assert.equal(config.mouseCapture,false);
 assert.equal(config.fullScreen,false);
 assert.equal(config.pathPrefix,'./vendor/jsdos854/emulators/');
 assert.deepEqual(config.fsChanges,{local:false});
 assert.equal(config.onEvent,fn);
 assert.throws(()=>comparisonOptions('https://server/gog.jsdos',fn),/owner-selected/);
});
test('separate v8 test UI never initializes without required controls',()=>{
 setupV8Test({getElementById:()=>null},{});
});

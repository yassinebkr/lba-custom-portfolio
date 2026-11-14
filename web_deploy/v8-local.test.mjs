import test from 'node:test';
import assert from 'node:assert/strict';
import {comparisonOptions,setupV8Test,volumeToGain,sampleFrameBrightness,sampleFrameDifference,DEFAULT_VOLUME_PERCENT} from './v8-local.mjs';

test('v8 comparison is DOSBox worker-only with local private blob URL and no auto saves',()=>{
 const fn=()=>{};
 const config=comparisonOptions('blob:r05-private',fn);
 assert.equal(config.backend,'dosbox');
 assert.equal(config.backendLocked,true);
 assert.equal(config.workerThread,true);
 assert.equal(config.autoStart,true);
 assert.equal(config.autoSave,false);
 assert.equal(config.mouseCapture,false);
 assert.equal(config.countDownStart,1);
 assert.equal(config.volume,0.30);
 assert.ok(!Object.hasOwn(config,'fullScreen'));
 assert.equal(config.pathPrefix,'./vendor/jsdos854/emulators/');
 assert.deepEqual(config.fsChanges,{local:false});
 assert.equal(config.onEvent,fn);
 assert.throws(()=>comparisonOptions('https://server/gog.jsdos',fn),/owner-selected/);
});
test('separate v8 test UI never initializes without required controls',()=>{
 setupV8Test({getElementById:()=>null},{});
});

test('emulator output slider clamps and normalizes volume safely',()=>{
 assert.equal(DEFAULT_VOLUME_PERCENT,30);
 assert.equal(volumeToGain('0'),0);
 assert.equal(volumeToGain('30'),0.3);
 assert.equal(volumeToGain('100'),1);
 assert.equal(volumeToGain(101),1);
 assert.equal(volumeToGain(-99),0);
 assert.equal(volumeToGain('nan'),0.3);
});
test('sampled DOSBox image reports only aggregate brightness, no frame contents',()=>{
 const img={width:2,height:2,data:new Uint8ClampedArray([
   0,0,0,255, 255,255,255,255,
   10,10,10,255, 50,50,50,255
 ])};
 assert.deepEqual(sampleFrameBrightness(img),{
   width:2,height:2,sampledPixels:4,darkFraction:0.5,brightFraction:0.25
 });
 assert.throws(()=>sampleFrameBrightness({width:2,height:2,data:new Uint8Array(4)}),/Unsupported/);
});

test('two DOS frames can distinguish frozen black buffer from changing frame',()=>{
 const mk=(a,b,c,d)=>({width:2,height:2,data:new Uint8ClampedArray([
   a,a,a,255,b,b,b,255,c,c,c,255,d,d,d,255
 ])});
 assert.equal(sampleFrameDifference(mk(0,0,0,0),mk(0,0,0,0)),0);
 assert.equal(sampleFrameDifference(mk(0,0,0,0),mk(0,0,80,0)),0.25);
 assert.equal(sampleFrameDifference(mk(0,0,0,0),mk(0,10,11,0)),0);
 assert.throws(()=>sampleFrameDifference(mk(0,0,0,0),{width:1,height:2,data:new Uint8Array(8)}),/incompatible/);
});

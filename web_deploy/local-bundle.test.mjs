import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLocalBundle,extractLocalBundle,buildDos622Arguments,assertDos622BundleName} from './local-bundle.mjs';

const bytes=Uint8Array.from([0x50,0x4b,0x03,0x04,1,2,3,4]);
const file=(name,data=bytes,size=data.length)=>({
  name,size,
  slice(start,end){return {arrayBuffer:async()=>data.slice(start,end).buffer};}
});

test('requires a local jsdos ZIP signature with bounded size',async()=>{
 await validateLocalBundle(file('private.jsdos'));
 await assert.rejects(validateLocalBundle(file('private.zip')),/\.jsdos/);
 await assert.rejects(validateLocalBundle(file('private.jsdos',Uint8Array.from([1,2,3,4]))),/ZIP/);
 await assert.rejects(validateLocalBundle(file('private.jsdos',Uint8Array.from([1,2,3]))),/truncated/);
 await assert.rejects(validateLocalBundle(file('private.jsdos',bytes,512*1024*1024+1)),/limit/);
 await assert.rejects(validateLocalBundle(null),/Select/);
});

test('extracts by a temporary local blob URL and revokes it after success',async()=>{
 const events=[];
 const urlApi={
  createObjectURL(f){assert.equal(f.name,'private.jsdos');events.push('created');return 'blob:test-zip';},
  revokeObjectURL(url){assert.equal(url,'blob:test-zip');events.push('revoked');}
 };
 const fs={
  extract:async url=>{assert.equal(url,'blob:test-zip');events.push('extracted');},
  fs:{analyzePath:p=>({exists:['/RELENT.EXE','/LBA.ISO'].includes(p)})}
 };
 await extractLocalBundle(fs,file('private.jsdos'),urlApi);
 assert.deepEqual(events,['created','extracted','revoked']);
});

test('rejects incomplete bundle and revokes its blob URL',async()=>{
 const events=[];
 const urlApi={createObjectURL(){return 'blob:broken';},revokeObjectURL(){events.push('revoked');}};
 const fs={extract:async()=>{},fs:{analyzePath:p=>({exists:p==='/RELENT.EXE'})}};
 await assert.rejects(extractLocalBundle(fs,file('private.jsdos'),urlApi),/LBA\.ISO/);
 assert.deepEqual(events,['revoked']);
});

test('rejects extractor failures and always revokes the blob URL',async()=>{
 let revoked=0;
 const fs={extract:async()=>{throw Error('Cannot read ZIP');}};
 await assert.rejects(extractLocalBundle(fs,file('private.jsdos'),{
  createObjectURL:()=> 'blob:bad',revokeObjectURL:()=>{revoked++;}
 }),/Cannot read ZIP/);
 assert.equal(revoked,1);
});

test('6.22 must explicitly load its bundled DOSBox config',()=>{
 assert.deepEqual(buildDos622Arguments(),[
   '-conf','.jsdos/dosbox.conf','-c','imgmount d LBA.ISO -t iso','-c','RELENT.EXE'
 ]);
 assert.deepEqual(buildDos622Arguments({legacyConfig:true}),[
   '-c','imgmount d LBA.ISO -t iso','-c','RELENT.EXE'
 ]);
 assert.deepEqual(buildDos622Arguments({cdImage:'LBA.CUE'}),[
   '-conf','.jsdos/dosbox.conf','-c','imgmount d LBA.CUE -t iso','-c','RELENT.EXE'
 ]);
 assert.throws(()=>buildDos622Arguments({cdImage:'unsafe;rm -rf /'}),/Unsupported/);
});

test('6.22 test UI rejects v8-only DOS archive before ZIP extraction',()=>{
 assert.throws(
   ()=>assertDos622BundleName('r05-v8-english-voices.jsdos'),
   /js-dos 8\.5\.4.*main player/
 );
 assert.throws(
   ()=>assertDos622BundleName('R05-V8-SB16-16BIT.JSDOS'),
   /js-dos 8/
 );
 assert.doesNotThrow(()=>assertDos622BundleName('r05-sb16-8.jsdos'));
});

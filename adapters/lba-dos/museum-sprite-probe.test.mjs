import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {decodeSprite,encodeSprite} from '../../packages/asset-core/index.mjs';
import {ENTRY_INDEX,verifyMuseumEntry,makeReplacement,createProbe,inspectPrivateMuseumSprite} from './museum-sprite-probe.mjs';
import hqrPackage from '@lbalab/hqr';
const {HQR,HQREntry,CompressionType}=hqrPackage;
import {inspectSpriteFrames} from './sprite-frames.mjs';

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
  corrupt[0]=8; // invalid two-frame table (no second valid offset)
  assert.throws(()=>makeReplacement({atlasBytes:source,palette,
    previousPayload:corrupt}),/Invalid sprite frame offset|Unsupported sprite frame offset/);
});

test('R06 genuine HQR packer produces a private overlay and leaves every other entry intact',async()=>{
  await mkdir(join(root,'output'),{recursive:true});
  const tmp=await mkdtemp(join(root,'output','r06-private-test-'));
  const base=join(tmp,'owner-fixture');
  const out=join(tmp,'probe');
  try{
    await mkdir(base,{recursive:true});
    const ress=new HQR();
    const paletteBytes=Uint8Array.from({length:768},(_,i)=>i%256);
    ress.entries.push(new HQREntry(paletteBytes.buffer,CompressionType.NONE));
    const sprites=new HQR();
    for(let i=0;i<76;i++){
      const payload=encodeSprite({
        width:40,height:45,offsetX:-15,offsetY:-34,
        pixels:new Uint8Array(40*45).fill((i%250)+1)
      });
      sprites.entries.push(new HQREntry(
        payload.buffer.slice(payload.byteOffset,payload.byteOffset+payload.byteLength),
        CompressionType.NONE));
    }
    await writeFile(join(base,'RESS.HQR'),Buffer.from(ress.toArrayBuffer()));
    await writeFile(join(base,'SPRITES.HQR'),Buffer.from(sprites.toArrayBuffer()));
    const result=await createProbe({privateBase:base,outputDir:out,direction:'se'});
    assert.deepEqual(result.scene,{sceneIndex:43,entryIndex:58,sharedScenes:[1,43]});
    assert.equal(result.nativeGeometry.width,40);
    assert.equal(result.nativeGeometry.offsetX,-15);
    assert.equal(result.retainedDecodedHqrEntries,75);
    const bytes=await readFile(join(out,'SPRITES.HQR'));
    const archive=HQR.fromArrayBuffer(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    assert.equal(archive.entries.length,76);
    const changed=decodeSprite(new Uint8Array(archive.entries[58].content));
    assert.ok(new Set(changed.pixels).size>3,'real original art must survive indexed compression');
    const before=decodeSprite(new Uint8Array(sprites.entries[58].content));
    assert.notDeepEqual(changed.pixels,before.pixels);
    assert.deepEqual(new Uint8Array(archive.entries[57].content),
                     new Uint8Array(sprites.entries[57].content));
    const saved=JSON.parse(await readFile(join(out,'report.json'),'utf8'));
    assert.equal(saved.retainedDecodedHqrEntries,75);
    assert.match(saved.status,/pending actual private DOS game/);
    const png=await readFile(join(out,'sprite-58-preview.png'));
    assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    await assert.rejects(createProbe({privateBase:base,outputDir:out}),
      /EEXIST/,'existing private trial must never be silently overwritten');
  }finally{await rm(tmp,{recursive:true,force:true})}
});

test('R06 actual original Blender artwork can replace just the first frame in a multi-frame DOS sprite',async()=>{
 const source=await atlas();
 const make=(width,height,x,y,color)=>encodeSprite({
  width,height,offsetX:x,offsetY:y,pixels:new Uint8Array(width*height).fill(color)
 });
 const first=make(40,45,-15,-34,12).subarray(4);
 const second=make(48,50,-20,-38,13).subarray(4);
 const raw=new Uint8Array(8+first.length+second.length);
 const v=new DataView(raw.buffer);
 v.setUint32(0,8,true);v.setUint32(4,8+first.length,true);
 raw.set(first,8);raw.set(second,8+first.length);
 const converted=makeReplacement({atlasBytes:source,palette,previousPayload:raw,frameIndex:0});
 assert.equal(converted.frameCount,2);
 assert.equal(converted.changedFrame,0);
 assert.deepEqual(converted.originalFrame,{width:40,height:45,offsetX:-15,offsetY:-34});
 assert.ok(converted.measurements.opaquePixels>80);
 assert.throws(()=>makeReplacement({
  atlasBytes:source,palette,previousPayload:raw,frameIndex:2
 }),/not present/);
});

test('R06 owner-local read-only inspector and overlay preserve untouched multi-frame sprite',async()=>{
 await mkdir(join(root,'output'),{recursive:true});
 const dir=await mkdtemp(join(root,'output','r06-multiframe-'));
 const base=join(dir,'source'),out=join(dir,'converted');
 try{
  await mkdir(base,{recursive:true});
  const pal=new HQR();
  pal.entries.push(new HQREntry(palette.buffer.slice(0),CompressionType.NONE));
  await writeFile(join(base,'RESS.HQR'),Buffer.from(pal.toArrayBuffer()));
  const sprites=new HQR();
  const mk=(w,h,x,y,color)=>encodeSprite({width:w,height:h,offsetX:x,offsetY:y,pixels:new Uint8Array(w*h).fill(color)});
  const f0=mk(40,45,-15,-34,22).subarray(4);
  const f1=mk(42,47,-19,-35,32).subarray(4);
  const original=new Uint8Array(8+f0.length+f1.length);
  new DataView(original.buffer).setUint32(0,8,true);
  new DataView(original.buffer).setUint32(4,8+f0.length,true);
  original.set(f0,8);original.set(f1,8+f0.length);
  for(let i=0;i<65;i++){
   const content=i===58?original:mk(12,14,-3,-6,12);
   sprites.entries.push(new HQREntry(
    content.buffer.slice(content.byteOffset,content.byteOffset+content.byteLength),
    CompressionType.NONE
   ));
  }
  await writeFile(join(base,'SPRITES.HQR'),Buffer.from(sprites.toArrayBuffer()));
  const inspection=await inspectPrivateMuseumSprite(base);
  assert.equal(inspection.format,'validated native sprite frame data');
  assert.equal(inspection.layout,'offset-table');
  assert.equal(inspection.frameCount,2);
  assert.equal(inspection.frames.length,2);
  assert.deepEqual(inspection.frames.map(x=>[x.width,x.height]),[[40,45],[42,47]]);
  const result=await createProbe({privateBase:base,outputDir:out,frameIndex:0});
  assert.equal(result.frameCount,2);
  assert.equal(result.changedFrame,0);
  const buf=await readFile(join(out,'SPRITES.HQR'));
  const after=HQR.fromArrayBuffer(buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength));
  const frames=inspectSpriteFrames(new Uint8Array(after.entries[58].content));
  const before=inspectSpriteFrames(original);
  assert.equal(frames.frameCount,2);
  assert.deepEqual(frames.frames[1].bytes,before.frames[1].bytes);
  assert.notDeepEqual(frames.frames[0].bytes,before.frames[0].bytes);
  assert.deepEqual(new Uint8Array(after.entries[57].content),
                   new Uint8Array(sprites.entries[57].content));
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('R06 actual owner-like end-offset header is one frame and repacks safely',async()=>{
 await mkdir(join(root,'output'),{recursive:true});
 const dir=await mkdtemp(join(root,'output','r06-terminal-'));
 const base=join(dir,'source'),out=join(dir,'converted');
 try{
  await mkdir(base,{recursive:true});
  const ress=new HQR();
  ress.entries.push(new HQREntry(palette.buffer.slice(0),CompressionType.NONE));
  await writeFile(join(base,'RESS.HQR'),Buffer.from(ress.toArrayBuffer()));
  const sprites=new HQR();
  const sample=encodeSprite({width:79,height:47,offsetX:0,offsetY:0,
   pixels:Uint8Array.from({length:79*47},(_,i)=>i%17===0?0:11)});
  const raw=sample.subarray(4);
  const native=new Uint8Array(8+raw.length);
  new DataView(native.buffer).setUint32(0,8,true);
  new DataView(native.buffer).setUint32(4,raw.length,true);
  native.set(raw,8);
  const other=encodeSprite({width:12,height:14,offsetX:-3,offsetY:-6,
   pixels:new Uint8Array(12*14).fill(12)});
  for(let i=0;i<65;i++){
   const payload=i===58?native:other;
   sprites.entries.push(new HQREntry(
    payload.buffer.slice(payload.byteOffset,payload.byteOffset+payload.byteLength),
    CompressionType.NONE
   ));
  }
  await writeFile(join(base,'SPRITES.HQR'),Buffer.from(sprites.toArrayBuffer()));
  const inspection=await inspectPrivateMuseumSprite(base);
  assert.equal(inspection.firstOffset,8);
  assert.equal(inspection.secondOffset,native.length-8);
  assert.equal(inspection.tableEntryCount,2);
  assert.equal(inspection.layout,'single-frame-end-offset');
  assert.equal(inspection.frameCount,1);
  assert.deepEqual(inspection.frames.map(x=>[x.width,x.height]),[[79,47]]);
  const result=await createProbe({privateBase:base,outputDir:out,frameIndex:0});
  assert.equal(result.frameCount,1);
  const packed=await readFile(join(out,'SPRITES.HQR'));
  const rebuilt=HQR.fromArrayBuffer(packed.buffer.slice(
   packed.byteOffset,packed.byteOffset+packed.byteLength));
  const changed=new Uint8Array(rebuilt.entries[58].content);
  const parsed=inspectSpriteFrames(changed);
  assert.equal(parsed.layout,'single-frame-end-offset');
  assert.equal(parsed.frameCount,1);
  assert.equal(new DataView(changed.buffer,changed.byteOffset,changed.byteLength).getUint32(4,true),changed.length-8);
  assert.deepEqual([parsed.frames[0].decoded.width,parsed.frames[0].decoded.height],[79,47]);
  assert.deepEqual(new Uint8Array(rebuilt.entries[57].content),
                   new Uint8Array(sprites.entries[57].content));
 }finally{await rm(dir,{recursive:true,force:true})}
});

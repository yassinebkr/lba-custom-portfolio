import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {decodeSprite,encodeSprite} from '../../packages/asset-core/index.mjs';
import {ENTRY_INDEX,verifyMuseumEntry,makeReplacement,createProbe} from './museum-sprite-probe.mjs';
import hqrPackage from '@lbalab/hqr';
const {HQR,HQREntry,CompressionType}=hqrPackage;

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

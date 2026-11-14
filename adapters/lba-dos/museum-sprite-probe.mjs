/**
 * R06 first DOS-native original-art replacement (strictly owner-local).
 *
 * Replaces one frame of an existing, scene-43-referenced SPRITES.HQR entry
 * using the versioned Blender telemetry receiver atlas. Never edits base_game,
 * source PNGs, RELENT.EXE, scene scripts, or public dist/.
 *
 * The existing sprite 58 is a door padlock shared by scenes 1 and 43. This
 * proves the DOS integration path, not final artistic quality or a new object.
 */
import hqrPackage from '@lbalab/hqr';
import pngjs from 'pngjs';
import {readFile,writeFile,mkdir,lstat} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute,sep,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {cropRGBA,resizeRGBA} from './index.mjs';
import {decodeArchive,loadPrivateGamePalette,replaceOneSpriteFrameEntry} from './overlay.mjs';
import {inspectSpriteFrames} from './sprite-frames.mjs';
import {rgbaToIndexed,indexedToRGBA,encodeSprite,decodeSprite} from '../../packages/asset-core/index.mjs';

const {PNG}=pngjs;
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const outputRoot=join(root,'output');
const atlasPath=join(root,'apps/portfolio/sprite-demo/compare/192px-lanczos-160.png');
const sceneIndex=43;
export const ENTRY_INDEX=58;
const framePosition={ne:0,nw:1,sw:2,se:3};
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');

function safeOutput(path){
 const absolute=resolve(path);
 const rel=relative(outputRoot,absolute);
 if(rel===''||rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel))
  throw Error('Private sprite probe output must be below ignored output/');
 return absolute;
}
async function ensureNoSymlink(path){
 try{if((await lstat(path)).isSymbolicLink())throw Error('Symlinks are not allowed: '+path)}
 catch(e){if(e.code!=='ENOENT')throw e}
}
function imageBuffer(frame){
 return PNG.sync.write({width:frame.width,height:frame.height,
   data:Buffer.from(frame.rgba)});
}

export function verifyMuseumEntry(metadata,index=ENTRY_INDEX){
 const museum=metadata?.scenes?.[String(sceneIndex)];
 const linked=metadata?.spriteToScenes?.[String(index)];
 if(!museum||!Array.isArray(museum.sprites)||!museum.sprites.includes(index)||
    !Array.isArray(linked)||!linked.includes(sceneIndex)){
  throw Error('Requested sprite is not verified as referenced by Museum scene 43');
 }
 return {sceneIndex,entryIndex:index,sharedScenes:[...linked].sort((a,b)=>a-b)};
}

/** Pure conversion; uses the real DOS palette and preserves old draw anchor. */
export function makeReplacement({atlasBytes,palette,previousPayload,direction='se',frameIndex=0}){
 if(!Object.hasOwn(framePosition,direction))throw Error('Unsupported source view');
 const png=PNG.sync.read(Buffer.from(atlasBytes),{checkCRC:true});
 if(png.width!==768||png.height!==192)
  throw Error('Unexpected telemetry source atlas dimensions');
 const parsed=inspectSpriteFrames(previousPayload);
 if(!Number.isInteger(frameIndex)||frameIndex<0||frameIndex>=parsed.frameCount)
  throw Error('Requested frame is not present in the original sprite');
 const previous=parsed.frames[frameIndex].decoded;
 if(previous.width>255||previous.height>255)
  throw Error('Original DOS sprite exceeds indexed format limits');
 if(previous.width<12||previous.height<12)
  throw Error('Target DOS sprite too small for a meaningful source-art trial');
 const view=cropRGBA({width:png.width,height:png.height,rgba:Uint8Array.from(png.data)},
                    [framePosition[direction]*192,0,192,192]);
 const reduced=resizeRGBA(view,previous.width,previous.height);
 const indexed=rgbaToIndexed({...reduced,palette,alphaThreshold:128});
 const opaque=reduced.width*reduced.height-indexed.transparent;
 if(opaque<Math.max(20,Math.floor(reduced.width*reduced.height*.03)))
  throw Error('Original artwork becomes nearly transparent at the target size');
 const newPayload=encodeSprite({
  width:previous.width,height:previous.height,
  offsetX:previous.offsetX,offsetY:previous.offsetY,pixels:indexed.pixels
 });
 const decoded=decodeSprite(newPayload);
 if(decoded.pixels.some((v,i)=>v!==indexed.pixels[i]))
  throw Error('Encoded private DOS sprite did not round-trip');
 const quantized=indexedToRGBA(decoded.pixels,palette);
 return {
  payload:newPayload,
  frameCount:parsed.frameCount,changedFrame:frameIndex,
  originalFrame:{width:previous.width,height:previous.height,
    offsetX:previous.offsetX,offsetY:previous.offsetY},
  preview:imageBuffer({width:previous.width,height:previous.height,rgba:quantized}),
  measurements:{opaquePixels:opaque,paletteSnappedPixels:indexed.snapped,
    transparencyPixels:indexed.transparent,payloadBytes:newPayload.byteLength}
 };
}

export async function createProbe({privateBase,outputDir,direction='se',frameIndex=0}){
 if(!privateBase)throw Error('--private-base requires an owner-local DOS game');
 const base=resolve(privateBase);
 const dest=safeOutput(outputDir);
 const stats=await lstat(base);
 if(!stats.isDirectory()||stats.isSymbolicLink())throw Error('Unsafe private game directory');
 await ensureNoSymlink(dest);
 await ensureNoSymlink(join(dest,'SPRITES.HQR'));
 await ensureNoSymlink(join(dest,'report.json'));
 await ensureNoSymlink(join(dest,'sprite-58-preview.png'));
 const metadata=JSON.parse(await readFile(join(root,'metadata-ui/public/scene-sprites.json'),'utf8'));
 const scene=verifyMuseumEntry(metadata);
 const [original,atlasBytes,palette,paletteArchive]=await Promise.all([
  readFile(join(base,'SPRITES.HQR')),readFile(atlasPath),
  loadPrivateGamePalette(base),readFile(join(base,'RESS.HQR'))
 ]);
 const oldArchive=decodeArchive(original);
 if(oldArchive.entries.length<=ENTRY_INDEX)throw Error('Private archive missing sprite 58');
 const originalEntries=oldArchive.entries.map(entry=>Buffer.from(entry?.content||[]));
 const previousPayload=new Uint8Array(oldArchive.entries[ENTRY_INDEX].content);
 const replacement=makeReplacement({
  atlasBytes,palette,previousPayload,direction,frameIndex
 });
 const changed=replaceOneSpriteFrameEntry(oldArchive,ENTRY_INDEX,replacement.payload,frameIndex);
 const packed=Buffer.from(oldArchive.toArrayBuffer());
 const rebuilt=decodeArchive(packed);
 if(rebuilt.entries.length!==oldArchive.entries.length)
  throw Error('Private HQR entry count changed during repacking');
 let unchanged=0;
 for(let i=0;i<rebuilt.entries.length;i++){
  const output=Buffer.from(rebuilt.entries[i]?.content||[]);
  const prior=originalEntries[i];
  if(i===ENTRY_INDEX){
   if(!output.equals(Buffer.from(replacement.payload)))
    throw Error('Sprite replacement failed HQR repack verification');
  }else{
   if(!output.equals(prior))throw Error('Unrelated private HQR entry changed at '+i);
   unchanged++;
  }
 }
 await mkdir(dest,{recursive:true});
 await writeFile(join(dest,'SPRITES.HQR'),packed,{flag:'wx'});
 await writeFile(join(dest,'sprite-58-preview.png'),replacement.preview,{flag:'wx'});
 const report={
  status:'prepared; pending actual private DOS game visibility and art review',
  source:'versioned-original-blender-telemetry-atlas',scene,
  targetDescription:'Door padlock (Forger\'s house)',direction,
  changedFrame:frameIndex,frameCount:changed.frameCount,
  nativeGeometry:changed,
  ...replacement.measurements,
  retainedDecodedHqrEntries:unchanged,
  originalArchiveSHA256:hash(original),
  paletteArchiveSHA256:hash(paletteArchive),
  privateOverlaySHA256:hash(packed),
  sourceAtlasSHA256:hash(atlasBytes),
  caveat:'Shared across scenes; image quality at original small sprite scale is unverified.'
 };
 await writeFile(join(dest,'report.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
 return report;
}

function option(args,key){
 const i=args.indexOf(key);
 return i<0?null:args[i+1]||null;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const base=option(process.argv,'--private-base');
 const out=option(process.argv,'--out');
 const direction=option(process.argv,'--direction')||'se';
 const rawFrame=option(process.argv,'--frame');
 const frameIndex=rawFrame===null?0:Number(rawFrame);
 if(!base||!out){
  console.error('Usage: node adapters/lba-dos/museum-sprite-probe.mjs --private-base /private/DOS/game --out output/r06-museum-58 --direction se');
  process.exitCode=2;
 }else{
  createProbe({privateBase:base,outputDir:out,direction,frameIndex})
   .then(report=>process.stdout.write(JSON.stringify(report,null,2)+'\n'))
   .catch(error=>{console.error('Private DOS sprite probe: '+error.message);process.exitCode=1});
 }
}

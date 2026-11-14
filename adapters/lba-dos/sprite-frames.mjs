/**
 * Strict LBA1 SPRITES.HQR entry parser with an offset table for N frames.
 * This is an authoring adapter, not a browser game renderer.
 *
 * A one-frame entry begins with 0x00000004. A multi-frame entry normally
 * begins with 4*N. Malformed or unknown layouts are rejected rather than
 * rewritten. All untouched frame bytes survive verbatim.
 */
import {decodeBrick,decodeSprite} from '../../packages/asset-core/index.mjs';

const MAX_FRAMES=256;
function bytesOf(source){
 if(!(source instanceof Uint8Array))throw Error('Sprite entry must contain bytes');
 return source;
}
export function inspectSpriteFrames(source){
 const bytes=bytesOf(source);
 if(bytes.byteLength<9)throw Error('Sprite entry is too short');
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const start=view.getUint32(0,true);
 if(start<4||start%4!==0||start>Math.min(MAX_FRAMES*4,bytes.length-5)){
  throw Error('Unsupported sprite frame offset table (first offset='+start+
    ', bytes='+bytes.length+'). Entry left unchanged.');
 }
 const count=start/4;
 const offsets=[];
 for(let i=0;i<count;i++){
  const offset=view.getUint32(i*4,true);
  if(offset<start||offset>=bytes.length||
     (i===0&&offset!==start)||(i>0&&offset<=offsets[i-1])){
   throw Error('Invalid sprite frame offset at position '+i);
  }
  offsets.push(offset);
 }
 const frames=[];
 for(let i=0;i<count;i++){
  const begin=offsets[i],end=i+1<count?offsets[i+1]:bytes.length;
  const raw=bytes.subarray(begin,end);
  try{
   const decoded=decodeBrick(raw); // Exact row-RLE parse, no trailing bytes.
   frames.push({index:i,offset:begin,bytes:raw,decoded});
  }catch(error){
   throw Error('Sprite frame '+i+' is not a supported DOS row-RLE frame: '+
     error.message);
  }
 }
 return {frameCount:count,tableBytes:start,frames};
}
export function replaceSpriteFrame(source,payload,frameIndex=0){
 const initial=inspectSpriteFrames(source);
 if(!Number.isInteger(frameIndex)||frameIndex<0||frameIndex>=initial.frameCount){
  throw Error('Sprite frame index is outside the verified original offset table');
 }
 const replacement=bytesOf(payload);
 // No changes to codec semantics: the authoring exporter already emits
 // validated single-frame DOS sprite payloads with a four-byte offset table.
 const newFrame=decodeSprite(replacement);
 const oldFrame=initial.frames[frameIndex].decoded;
 for(const field of ['width','height','offsetX','offsetY']){
  if(newFrame[field]!==oldFrame[field])
   throw Error('Replacement must retain native '+field+' at frame '+frameIndex);
 }
 const frameBytes=replacement.subarray(4);
 const sizes=initial.frames.map(f=>f.bytes.length);
 sizes[frameIndex]=frameBytes.length;
 const finalSize=initial.tableBytes+sizes.reduce((a,b)=>a+b,0);
 if(finalSize>16*1024*1024)throw Error('Replacement sprite entry is too large');
 const output=new Uint8Array(finalSize);
 const view=new DataView(output.buffer);
 let offset=initial.tableBytes;
 for(let i=0;i<initial.frameCount;i++){
  view.setUint32(i*4,offset,true);
  const raw=i===frameIndex?frameBytes:initial.frames[i].bytes;
  output.set(raw,offset);
  offset+=raw.length;
 }
 const checked=inspectSpriteFrames(output);
 if(checked.frameCount!==initial.frameCount)throw Error('Sprite frame count changed');
 for(let i=0;i<checked.frameCount;i++){
  const expected=i===frameIndex?frameBytes:initial.frames[i].bytes;
  if(checked.frames[i].bytes.length!==expected.length||
     checked.frames[i].bytes.some((v,k)=>v!==expected[k]))
   throw Error('Sprite frame '+i+' changed unexpectedly');
 }
 return {
  payload:output,
  frameCount:initial.frameCount,
  changedFrame:frameIndex,
  originalOffset:initial.frames[frameIndex].offset,
  geometry:Object.fromEntries(['width','height','offsetX','offsetY']
    .map(k=>[k,oldFrame[k]])),
 };
}

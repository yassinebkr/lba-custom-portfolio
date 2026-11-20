/**
 * Strict LBA1 SPRITES.HQR frame parser for owner-local authoring.
 *
 * Native sprite entries can use two uint32 fields with a single encoded
 * frame: the first points to byte 8, while the second records a terminal
 * offset relative to the end of that header (payload length).
 * Other verified offset-table layouts remain supported for compatibility.
 *
 * A sentinel is recognized ONLY if decoding the complete frame consumes all
 * remaining bytes. Never infer a playable frame from offset count alone.
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
 // ScummVM TwinE's SpriteData::loadFromStream treats offset2 + 8 >=
 // stream.size() as a single-frame terminal marker. Our strict variant
 // accepts the exact observed form only (second offset = bytes after header),
 // and requires an exact full-frame RLE decode. This also avoids confusing
 // a real second frame with an end marker when it happens to be eight bytes.
 if(start===8&&offsets[1]===bytes.length-8){
  const raw=bytes.subarray(8);
  try{
   const decoded=decodeBrick(raw);
   return {frameCount:1,tableBytes:8,layout:'single-frame-end-offset',
    frames:[{index:0,offset:8,bytes:raw,decoded}]};
  }catch{
   // Not a complete single frame: try the ordinary verified two-frame table.
  }
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
 return {frameCount:count,tableBytes:start,layout:'offset-table',frames};
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
 if(initial.layout==='single-frame-end-offset'){
  // Preserve the native two-word header even though only one frame exists.
  // The terminal field is payload length, not a second frame position.
  view.setUint32(0,8,true);
  view.setUint32(4,sizes[0],true);
  output.set(frameBytes,8);
 }else{
  let offset=initial.tableBytes;
  for(let i=0;i<initial.frameCount;i++){
   view.setUint32(i*4,offset,true);
   const raw=i===frameIndex?frameBytes:initial.frames[i].bytes;
   output.set(raw,offset);
   offset+=raw.length;
  }
 }
 const checked=inspectSpriteFrames(output);
 if(checked.frameCount!==initial.frameCount||checked.layout!==initial.layout)
  throw Error('Sprite frame layout changed unexpectedly');
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

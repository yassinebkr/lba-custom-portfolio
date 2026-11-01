/**
 * Project Atlas indexed-isometric core.
 * Extracted/adapted from main/scripts/hqr-tools/lib/sprite-codec.js
 * and main/scripts/hqr-tools/render-scene.js.
 *
 * No HQR loader, game assets, filesystem access, or LBA palettes.
 * HQR-compatible row encoding is an OPTIONAL output, not the public format.
 */
export const MAX_RUN=64;
const isInteger=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
const assertPixels=(width,height,pixels)=>{
 if(!isInteger(width,1,255)||!isInteger(height,1,255))throw Error('Indexed frame must be 1..255 pixels per axis');
 if(!(pixels instanceof Uint8Array)||pixels.length!==width*height)throw Error('Indexed frame buffer length mismatch');
};
function packRows(width,height,pixels){
 const rows=[];
 for(let y=0;y<height;y++)rows.push(encodeRow(pixels.subarray(y*width,(y+1)*width)));
 return rows;
}
export function encodeRow(row){
 if(!(row instanceof Uint8Array)||row.length<1||row.length>255)throw Error('Invalid indexed row');
 const bytes=[0],chunks=[];
 let x=0;
 while(x<row.length){
  if(row[x]===0){
   let n=1;while(n<MAX_RUN&&x+n<row.length&&row[x+n]===0)n++;
   chunks.push([n-1]);x+=n;continue;
  }
  let repeat=1;
  while(repeat<MAX_RUN&&x+repeat<row.length&&row[x+repeat]===row[x])repeat++;
  if(repeat>=3){chunks.push([0x80|(repeat-1),row[x]]);x+=repeat;continue;}
  const start=x;let length=0;
  while(x<row.length&&length<MAX_RUN&&row[x]!==0){
   if(length>0&&x+2<row.length&&row[x]===row[x+1]&&row[x]===row[x+2])break;
   x++;length++;
  }
  if(length===0)throw Error('Empty literal segment');
  chunks.push([0xc0|(length-1),...row.subarray(start,start+length)]);
 }
 if(chunks.length>255)throw Error('Indexed row has too many segments');
 bytes[0]=chunks.length;
 for(const c of chunks)bytes.push(...c);
 return Uint8Array.from(bytes);
}
export function encodeBrick({width,height,offsetX=0,offsetY=0,pixels}){
 assertPixels(width,height,pixels);
 if(!isInteger(offsetX,-128,127)||!isInteger(offsetY,-128,127))throw Error('Offset outside signed byte range');
 const parts=[[width,height,offsetX&255,offsetY&255],...packRows(width,height,pixels)];
 return Uint8Array.from(parts.flatMap(x=>Array.from(x)));
}
export function encodeSprite(frame){
 const brick=encodeBrick(frame);
 const out=new Uint8Array(brick.length+4);out[0]=4;out.set(brick,4);return out;
}
function decodeRows(buf,position,width,height){
 const pixels=new Uint8Array(width*height);
 let p=position;
 for(let y=0;y<height;y++){
  if(p>=buf.length)throw Error('Truncated indexed row');
  const segments=buf[p++];let x=0;
  for(let s=0;s<segments;s++){
   if(p>=buf.length)throw Error('Truncated indexed segment header');
   const header=buf[p++],n=(header&63)+1,type=header&0xc0;
   if(x+n>width)throw Error('Indexed segment extends beyond row');
   if(type===0){x+=n;continue;}
   if(type===0x80){
    if(p>=buf.length)throw Error('Truncated RLE color');
    pixels.fill(buf[p++],y*width+x,y*width+x+n);x+=n;continue;
   }
   if(type===0x40)throw Error('Reserved indexed segment opcode');
   if(p+n>buf.length)throw Error('Truncated literal data');
   pixels.set(buf.subarray(p,p+n),y*width+x);p+=n;x+=n;
  }
  if(x!==width)throw Error('Indexed row does not cover entire width');
 }
 if(p!==buf.length)throw Error('Unexpected trailing indexed bytes');
 return pixels;
}
export function decodeBrick(source){
 const b=source instanceof Uint8Array?source:new Uint8Array(source);
 if(b.length<5)throw Error('Truncated brick header');
 const width=b[0],height=b[1];
 if(!isInteger(width,1,255)||!isInteger(height,1,255))throw Error('Invalid brick dimensions');
 const sign=x=>x>127?x-256:x;
 return {width,height,offsetX:sign(b[2]),offsetY:sign(b[3]),pixels:decodeRows(b,4,width,height)};
}
export function decodeSprite(source){
 const b=source instanceof Uint8Array?source:new Uint8Array(source);
 if(b.length<9)throw Error('Truncated sprite table');
 const v=new DataView(b.buffer,b.byteOffset,b.byteLength);
 const start=v.getUint32(0,true);
 if(start!==4)throw Error('Only single-frame sprite tables are supported');
 return decodeBrick(b.subarray(start));
}
export function rgbaToIndexed({width,height,rgba,palette,strict=false,alphaThreshold=128}){
 if(!isInteger(width,1,255)||!isInteger(height,1,255))throw Error('Invalid indexed dimensions');
 if(!(rgba instanceof Uint8Array)||rgba.length!==width*height*4)throw Error('RGBA input mismatch');
 if(!(palette instanceof Uint8Array)||palette.length!==768)throw Error('Expected 256-entry RGB palette');
 if(!isInteger(alphaThreshold,0,255))throw Error('Invalid alpha threshold');
 const pixels=new Uint8Array(width*height),cache=new Map();let exact=0,snapped=0,transparent=0;
 for(let i=0;i<pixels.length;i++){
  const p=i*4;
  if(rgba[p+3]<alphaThreshold){transparent++;continue;}
  const key=(rgba[p]<<16)|(rgba[p+1]<<8)|rgba[p+2];
  let result=cache.get(key);
  if(result===undefined){
   let best=1,distance=Infinity;
   for(let j=1;j<256;j++){
    const dr=rgba[p]-palette[j*3],dg=rgba[p+1]-palette[j*3+1],db=rgba[p+2]-palette[j*3+2];
    const delta=dr*dr+dg*dg+db*db;
    if(delta<distance){distance=delta;best=j;if(!delta)break;}
   }
   result={index:best,matched:distance===0};cache.set(key,result);
  }
  if(!result.matched){snapped++;if(strict)throw Error('Off-palette RGB at pixel '+i);}
  else exact++;
  pixels[i]=result.index;
 }
 return {pixels,exact,snapped,transparent};
}
export function indexedToRGBA(pixels,palette){
 if(!(pixels instanceof Uint8Array)||!(palette instanceof Uint8Array)||palette.length!==768)throw Error('Invalid indexed frame or palette');
 const rgba=new Uint8Array(pixels.length*4);
 for(let i=0;i<pixels.length;i++){
  const idx=pixels[i];if(idx===0)continue;
  rgba.set(palette.subarray(idx*3,idx*3+3),i*4);rgba[i*4+3]=255;
 }
 return rgba;
}
/** Coordinates adapted from main/scripts/hqr-tools/render-scene.js. */
export function projectIso(x,y,z,{halfWidth=24,depth=12,height=15}={}){
 if(![x,y,z,halfWidth,depth,height].every(Number.isFinite)||halfWidth<=0||depth<=0||height<=0)throw Error('Invalid isometric position');
 return {x:(x-z)*halfWidth,y:(x+z)*depth-y*height};
}
export function painterSort(placements){
 if(!Array.isArray(placements))throw Error('Placements must be an array');
 return placements.map((p,i)=>({...p,__order:i})).sort((a,b)=>
  (a.x+a.z)-(b.x+b.z)||a.y-b.y||a.__order-b.__order
 ).map(({__order,...p})=>p);
}

/**
 * M2: Original PNG -> independent palette -> private indexed sprite/brick.
 * Existing sprite-codec algorithms reused via packages/asset-core.
 * No base_game, HQR or LBA palette is ever read.
 */
import pngjs from 'pngjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {rgbaToIndexed,indexedToRGBA,encodeSprite,encodeBrick,decodeSprite,decodeBrick} from '../../packages/asset-core/index.mjs';
const {PNG}=pngjs;
export function paletteFromRGBA(rgba){
 if(!(rgba instanceof Uint8Array)||rgba.length%4)throw Error('Invalid RGBA');
 const counts=new Map();
 for(let i=0;i<rgba.length;i+=4)if(rgba[i+3]>=128){
  const color=(rgba[i]<<16)|(rgba[i+1]<<8)|rgba[i+2];
  counts.set(color,(counts.get(color)||0)+1);
 }
 if(!counts.size)throw Error('No visible source pixels');
 const sorted=[...counts].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,255);
 const palette=new Uint8Array(768);
 for(let i=0;i<255;i++){
  const color=sorted[Math.min(i,sorted.length-1)][0],j=(i+1)*3;
  palette[j]=color>>>16&255;palette[j+1]=color>>>8&255;palette[j+2]=color&255;
 }
 return palette;
}
export function convertOriginalRGBA({width,height,rgba,offsetX=0,offsetY=0,kind='sprite'}){
 if(kind!=='sprite'&&kind!=='brick')throw Error('Unsupported indexed kind');
 const palette=paletteFromRGBA(rgba);
 const quantized=rgbaToIndexed({width,height,rgba,palette});
 const image={width,height,offsetX,offsetY,pixels:quantized.pixels};
 const binary=kind==='sprite'?encodeSprite(image):encodeBrick(image);
 const restored=kind==='sprite'?decodeSprite(binary):decodeBrick(binary);
 if(restored.width!==width||restored.height!==height||restored.offsetX!==offsetX||restored.offsetY!==offsetY||restored.pixels.some((v,i)=>v!==quantized.pixels[i]))
  throw Error('Lossy indexed codec round-trip');
 return {binary,palette,previewRGBA:indexedToRGBA(restored.pixels,palette),snapped:quantized.snapped};
}
export async function exportOriginalPNG(source,out,{id,creator,kind='sprite',offsetX=0,offsetY=0}){
 if(!/^[a-z][a-z0-9-]{0,63}$/.test(id))throw Error('Invalid original asset ID');
 if(typeof creator!=='string'||!creator.trim())throw Error('Creator is required');
 const sourceBytes=await readFile(source);
 const png=PNG.sync.read(sourceBytes,{checkCRC:true});
 const outData=convertOriginalRGBA({width:png.width,height:png.height,rgba:png.data,offsetX,offsetY,kind});
 await mkdir(out,{recursive:true});
 const manifest={
  schemaVersion:1,id,kind,creator,sourceSha256:createHash('sha256').update(sourceBytes).digest('hex'),
  width:png.width,height:png.height,offsetX,offsetY,sourcePNG:id+'.png',
  pivot:{x:Math.floor(png.width/2),y:png.height-1},paletteType:'original-generated',
  paletteRef:id+'.palette.bin',binaryRef:id+'.'+kind+'bin',
  snappedPixels:outData.snapped,reviewStatus:'pending',allowedForPublicBuild:false
 };
 await Promise.all([
  writeFile(join(out,id+'.png'),sourceBytes),
  writeFile(join(out,manifest.paletteRef),outData.palette),
  writeFile(join(out,manifest.binaryRef),outData.binary),
  writeFile(join(out,id+'.json'),JSON.stringify(manifest,null,2)+'\n')
 ]);
 return manifest;
}

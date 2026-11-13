/**
 * R03: original world images to DOS-compatible indexed sprite and brick bytes.
 *
 * Inputs are pure RGBA and a versioned world package. Output uses a single
 * global palette and the existing independent indexed codec.
 */
import {assertWorldPackage} from '../../packages/world-package/index.mjs';
import {rgbaToIndexed,indexedToRGBA,encodeSprite,decodeSprite,encodeBrick,decodeBrick} from '../../packages/asset-core/index.mjs';

const integer=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
const channels=4;
export function cropRGBA(image,rect){
  const {width,height,rgba}=image;
  const [x,y,w,h]=rect;
  if(!integer(width,1,4096)||!integer(height,1,4096)||
    !(rgba instanceof Uint8Array)||rgba.length!==width*height*channels||
    !integer(x,0,width-1)||!integer(y,0,height-1)||
    !integer(w,1,width)||!integer(h,1,height)||
    x+w>width||y+h>height)throw Error('Invalid RGBA crop');
  const out=new Uint8Array(w*h*channels);
  for(let row=0;row<h;row++){
    const start=((y+row)*width+x)*channels;
    out.set(rgba.subarray(start,start+w*channels),row*w*channels);
  }
  return {width:w,height:h,rgba:out};
}
/** Area coverage with premultiplied RGB to preserve antialiased edges. */
export function resizeRGBA(image,width,height){
  if(!integer(width,1,255)||!integer(height,1,255)||
    !(image.rgba instanceof Uint8Array)||image.rgba.length!==image.width*image.height*4||
    !integer(image.width,1,4096)||!integer(image.height,1,4096)){
    throw Error('Invalid resize inputs');
  }
  const out=new Uint8Array(width*height*channels);
  const sx=image.width/width,sy=image.height/height,area=sx*sy;
  for(let y=0;y<height;y++){
    for(let x=0;x<width;x++){
      let alpha=0,red=0,green=0,blue=0;
      const left=x*sx,right=(x+1)*sx,top=y*sy,bottom=(y+1)*sy;
      for(let iy=Math.floor(top);iy<Math.ceil(bottom);iy++){
        const overlapY=Math.min(iy+1,bottom)-Math.max(iy,top);
        if(overlapY<=0)continue;
        for(let ix=Math.floor(left);ix<Math.ceil(right);ix++){
          const overlapX=Math.min(ix+1,right)-Math.max(ix,left);
          if(overlapX<=0)continue;
          const p=(iy*image.width+ix)*4;
          const weight=overlapX*overlapY*(image.rgba[p+3]/255);
          alpha+=weight;
          red+=image.rgba[p]*weight;
          green+=image.rgba[p+1]*weight;
          blue+=image.rgba[p+2]*weight;
        }
      }
      const dest=(y*width+x)*4;
      out[dest+3]=Math.round(255*alpha/area);
      if(alpha>0){
        out[dest]=Math.round(red/alpha);
        out[dest+1]=Math.round(green/alpha);
        out[dest+2]=Math.round(blue/alpha);
      }
    }
  }
  return {width,height,rgba:out};
}
export function paletteFromImages(images){
  const counts=new Map();
  for(const image of images){
    if(!(image.rgba instanceof Uint8Array)||image.rgba.length!==image.width*image.height*4){
      throw Error('Invalid RGBA palette input');
    }
    for(let i=0;i<image.rgba.length;i+=4){
      if(image.rgba[i+3]<128)continue;
      const rgb=(image.rgba[i]<<16)|(image.rgba[i+1]<<8)|image.rgba[i+2];
      counts.set(rgb,(counts.get(rgb)||0)+1);
    }
  }
  if(!counts.size)throw Error('No visible pixels for palette');
  const colors=[...counts].sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,255);
  const result=new Uint8Array(768);
  for(let i=0;i<colors.length;i++){
    const rgb=colors[i][0],p=(i+1)*3;
    result[p]=(rgb>>>16)&255;
    result[p+1]=(rgb>>>8)&255;
    result[p+2]=rgb&255;
  }
  return result;
}
function compare(original,decoded){
  const stats={partialAlphaPixels:0,alphaThresholdChanges:0};
  let dark=0,light=0;
  for(let i=0;i<original.length;i+=4){
    const a=original[i+3]/255;
    const b=decoded[i+3]/255;
    if(a>0&&a<1)stats.partialAlphaPixels++;
    if(original[i+3]!==decoded[i+3])stats.alphaThresholdChanges++;
    for(const [background,key] of [[24,'dark'],[233,'light']]){
      for(let channel=0;channel<3;channel++){
        const left=original[i+channel]*a+background*(1-a);
        const right=decoded[i+channel]*b+background*(1-b);
        if(key==='dark')dark+=(left-right)**2;
        else light+=(left-right)**2;
      }
    }
  }
  const pixels=original.length/4;
  return {...stats,darkRMSE:Number(Math.sqrt(dark/(pixels*3)).toFixed(3)),
    lightRMSE:Number(Math.sqrt(light/(pixels*3)).toFixed(3))};
}
function encodeSingle(image,palette,pivot,kind){
  const offsetX=-pivot.x,offsetY=-pivot.y;
  if(!integer(offsetX,-128,127)||!integer(offsetY,-128,127)){
    throw Error('DOS signed-offset limit exceeded by current sprite pivot');
  }
  const indexed=rgbaToIndexed({...image,palette});
  const frame={...image,offsetX,offsetY,pixels:indexed.pixels};
  const payload=kind==='brick'?encodeBrick(frame):encodeSprite(frame);
  const restored=kind==='brick'?decodeBrick(payload):decodeSprite(payload);
  if(restored.width!==image.width||restored.height!==image.height||
     restored.offsetX!==offsetX||restored.offsetY!==offsetY||
     !restored.pixels.every((v,i)=>v===indexed.pixels[i])){
    throw Error('DOS indexed binary round-trip mismatch');
  }
  const rgba=indexedToRGBA(restored.pixels,palette);
  return {payload,preview:{width:image.width,height:image.height,rgba},
    snapped:indexed.snapped,transparent:indexed.transparent,
    metrics:compare(image.rgba,rgba)};
}
export function convertWorldImages({world,assetId,atlas,background,palette=null,target=128}){
  assertWorldPackage(world);
  if(!integer(target,32,255))throw Error('DOS sprite target must be 32..255 pixels');
  const asset=world.assets.find(item=>item.id===assetId);
  if(!asset)throw Error('Unknown original asset: '+assetId);
  if(atlas.width!==asset.sprite.widthPx||atlas.height!==asset.sprite.heightPx){
    throw Error('Original sprite atlas dimensions differ from world manifest');
  }
  if(!background||background.width<1||background.height<1){
    throw Error('Original scene background is required');
  }
  const ratio=target/asset.sprite.frameWidthPx;
  const pivot={x:Math.round(asset.sprite.pivotPx.x*ratio),
    y:Math.round(asset.sprite.pivotPx.y*ratio)};
  const images={};
  for(const [direction,frame] of Object.entries(asset.sprite.views)){
    images[direction]=resizeRGBA(cropRGBA(atlas,[
      frame.x,frame.y,asset.sprite.frameWidthPx,asset.sprite.frameHeightPx]),target,target);
  }
  const brickHeight=Math.max(1,Math.round(target*background.height/background.width));
  const sceneImage=resizeRGBA(background,target,brickHeight);
  const globalPalette=palette??paletteFromImages([...Object.values(images),sceneImage]);
  if(!(globalPalette instanceof Uint8Array)||globalPalette.length!==768){
    throw Error('DOS palette requires 768 RGB bytes');
  }
  const sprites={};
  for(const direction of ['ne','nw','sw','se']){
    sprites[direction]=encodeSingle(images[direction],globalPalette,pivot,'sprite');
  }
  const scenery=encodeSingle(sceneImage,globalPalette,{x:0,y:0},'brick');
  const spriteBytes=Object.values(sprites).reduce((n,s)=>n+s.payload.length,0);
  return {
    palette:globalPalette,
    sprites,scenery,
    report:{
      schemaVersion:1,worldId:world.id,assetId,targetPx:target,
      sourceFramePx:asset.sprite.frameWidthPx,
      paletteSource:palette?'private-dos-palette':'original-generated-global-palette',
      dimensions:{sprite:[target,target],sceneBrick:[sceneImage.width,sceneImage.height]},
      offsets:{x:-pivot.x,y:-pivot.y},
      paletteReservedIndex:0,
      fourSpriteBytes:spriteBytes,brickBytes:scenery.payload.length,
      totalIndexedBytes:spriteBytes+scenery.payload.length,
      spriteMetrics:Object.fromEntries(Object.entries(sprites).map(([d,s])=>[d,{...s.metrics,snappedPixels:s.snapped}])),
      sceneMetrics:{...scenery.metrics,snappedPixels:scenery.snapped},
      runtimeVerification:'pending-private-dos-game-test',
      roomGridIntegration:'pending-lba-gri-bll-authoring'
    }
  };
}

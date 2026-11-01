/**
 * M4: original independent isometric scene composition.
 * No GRI/BLL/HQR game resources; preserves every placed asset instance.
 */
import {projectIso,painterSort} from '../asset-core/index.mjs';
const idPattern=/^[a-z][a-z0-9-]{0,63}$/;
const fail=(message)=>{throw Error(message);};
export function validateScene(scene,catalog){
 if(!scene||scene.schemaVersion!==1||!idPattern.test(scene.id))fail('Invalid original scene document');
 if(!Number.isInteger(scene.width)||scene.width<1||scene.width>128||
 !Number.isInteger(scene.depth)||scene.depth<1||scene.depth>128)fail('Scene dimensions outside 1..128');
 if(!Array.isArray(scene.instances)||scene.instances.length>12000)fail('Too many scene instances');
 if(!catalog||typeof catalog!=='object')fail('Asset catalog required');
 const ids=new Set();
 for(const item of scene.instances){
  if(!item||typeof item.id!=='string'||!idPattern.test(item.id)||ids.has(item.id))fail('Duplicate or invalid instance ID');
  ids.add(item.id);
  if(!Object.hasOwn(catalog,item.assetId))fail('Unknown original scene asset: '+item.assetId);
  if(!Number.isInteger(item.x)||item.x<0||item.x>=scene.width||
     !Number.isInteger(item.z)||item.z<0||item.z>=scene.depth||
     !Number.isInteger(item.y)||item.y<0||item.y>16)fail('Placement outside original scene grid');
  if(item.action!==undefined&&!idPattern.test(item.action))fail('Invalid animation action');
  if(item.direction!==undefined&&!['ne','nw','sw','se'].includes(item.direction))fail('Invalid direction');
 }
 return true;
}
export function commandsForScene(scene,catalog,{
 originX=0,originY=0,scale=1,frameIndex=0,timeMs=null,projection={halfWidth:24,depth:12,height:15}
}={}){
 validateScene(scene,catalog);
 if(!Number.isFinite(scale)||scale<=0||scale>8||![originX,originY].every(Number.isFinite))fail('Invalid scene render transform');
 const placements=painterSort(scene.instances);
 return placements.map(item=>{
  const asset=catalog[item.assetId];
  if(!asset||!Array.isArray(asset.frames)||!asset.frames.length)fail('Asset missing frame metadata: '+item.assetId);
  const action=item.action||'idle',direction=item.direction||'se';
  const available=asset.frames.filter(f=>(f.action||'idle')===action&&(f.direction||'se')===direction);
  const candidates=available.length?available:asset.frames.filter(f=>(f.direction||'se')===direction);
  if(!candidates.length)fail('No frames for direction '+direction+' of '+item.assetId);
  let frame=candidates[frameIndex%candidates.length];
  if(timeMs!==null){
   if(!Number.isFinite(timeMs)||timeMs<0)fail('Invalid animation timestamp');
   const total=candidates.reduce((n,f)=>n+(Number.isInteger(f.durationMs)&&f.durationMs>=16?f.durationMs:150),0);
   let tick=timeMs%total;
   for(const candidate of candidates){
    const duration=Number.isInteger(candidate.durationMs)&&candidate.durationMs>=16?candidate.durationMs:150;
    if(tick<duration){frame=candidate;break;}
    tick-=duration;
   }
  }
  const rect=frame.rect;
  if(!Array.isArray(rect)||rect.length!==4||rect.some(n=>!Number.isInteger(n)||n<0)||!rect[2]||!rect[3])fail('Invalid atlas frame rect');
  const pivot=asset.pivot;
  if(!pivot||![pivot.x,pivot.y].every(Number.isFinite))fail('Missing original sprite pivot');
  const p=projectIso(item.x,item.y,item.z,projection);
  return {
   instanceId:item.id,assetId:item.assetId,atlasRef:asset.atlasRef,rect,
   sourceX:rect[0],sourceY:rect[1],sourceWidth:rect[2],sourceHeight:rect[3],
   screenX:originX+(p.x-pivot.x)*scale,
   screenY:originY+(p.y-pivot.y)*scale,
   width:rect[2]*scale,height:rect[3]*scale,
   depth:item.x+item.z, elevation:item.y
  };
 });
}
export function drawScene(ctx,commands,loadedImages){
 if(!ctx||typeof ctx.drawImage!=='function')fail('Canvas2D context required');
 for(const c of commands){
  const image=loadedImages[c.atlasRef];
  if(!image)fail('Missing approved atlas: '+c.atlasRef);
  ctx.drawImage(image,c.sourceX,c.sourceY,c.sourceWidth,c.sourceHeight,
   c.screenX,c.screenY,c.width,c.height);
 }
}
/** Cells are computed from independent footprints rather than a flattened background. */
export function occupiedCells(scene,catalog){
 validateScene(scene,catalog);
 const occupied=new Set();
 for(const item of scene.instances){
  const asset=catalog[item.assetId];
  if(!asset.solid)continue;
  const foot=asset.footprint||{width:1,depth:1};
  if(!Number.isInteger(foot.width)||!Number.isInteger(foot.depth)||foot.width<1||foot.depth<1||foot.width>16||foot.depth>16)
    fail('Invalid collision footprint');
  for(let x=item.x;x<item.x+foot.width;x++)for(let z=item.z;z<item.z+foot.depth;z++){
   if(x>=scene.width||z>=scene.depth)fail('Collision footprint escapes scene bounds');
   occupied.add(x+':'+z);
  }
 }
 return occupied;
}

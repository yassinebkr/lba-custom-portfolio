/**
 * R02 world package contract.
 *
 * Portable data between a creative tool and one or more game adapters.
 * The validator has no filesystem, DOS, emulator or rendering dependencies.
 */
import {validateAssetCatalog,validateSceneDocument} from '../asset-schema/index.mjs';

export const WORLD_SCHEMA_VERSION=1;
export const DIRECTIONS=Object.freeze(['ne','nw','sw','se']);
const idPattern=/^[a-z][a-z0-9-]{0,63}$/;
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const issue=(path,code,message)=>({path,code,message});
const integer=(x,min,max)=>Number.isInteger(x)&&x>=min&&x<=max;
export function safeImageRef(path){
  return typeof path==='string'&&path.length<=240&&
    /^[a-z0-9][a-z0-9/_\-.]*\.png$/i.test(path)&&
    !path.includes('..')&&!path.includes('//')&&!path.includes('\\');
}
const validateSprite=(sprite,path)=>{
  const errors=[];
  if(!record(sprite))return [issue(path,'sprite.required','Sprite metadata is required')];
  if(!safeImageRef(sprite.imageRef))errors.push(issue(path+'.imageRef','sprite.path','Invalid sprite PNG path'));
  if(!integer(sprite.widthPx,1,4096)||!integer(sprite.heightPx,1,4096)){
    errors.push(issue(path,'sprite.dimensions','Atlas dimensions must be 1..4096 pixels'));
    return errors;
  }
  if(!integer(sprite.frameWidthPx,1,1024)||!integer(sprite.frameHeightPx,1,1024)){
    errors.push(issue(path,'sprite.frame','Invalid frame dimensions'));
    return errors;
  }
  if(!record(sprite.pivotPx)||!integer(sprite.pivotPx.x,0,sprite.frameWidthPx)||
     !integer(sprite.pivotPx.y,0,sprite.frameHeightPx)){
    errors.push(issue(path+'.pivotPx','sprite.pivot','Frame pivot is outside sprite bounds'));
  }
  if(!record(sprite.views)){
    errors.push(issue(path+'.views','sprite.views','View directions are required'));
    return errors;
  }
  const names=Object.keys(sprite.views);
  if(names.length!==DIRECTIONS.length||names.some(name=>!DIRECTIONS.includes(name))){
    errors.push(issue(path+'.views','sprite.directions','Exactly four standard directions are required'));
  }
  for(const direction of DIRECTIONS){
    const frame=sprite.views[direction];
    if(!record(frame)){
      errors.push(issue(path+'.views.'+direction,'sprite.view','Missing view metadata'));
      continue;
    }
    if(!integer(frame.x,0,sprite.widthPx-1)||!integer(frame.y,0,sprite.heightPx-1)||
       frame.x+sprite.frameWidthPx>sprite.widthPx||
       frame.y+sprite.frameHeightPx>sprite.heightPx){
      errors.push(issue(path+'.views.'+direction,'sprite.rect','Sprite frame exceeds atlas'));
    }
    if(!integer(frame.durationMs,16,60000)){
      errors.push(issue(path+'.views.'+direction+'.durationMs','sprite.duration','Duration outside 16..60000 ms'));
    }
  }
  if(!record(sprite.footprint)||!integer(sprite.footprint.widthCells,1,16)||
     !integer(sprite.footprint.depthCells,1,16)){
    errors.push(issue(path+'.footprint','sprite.footprint','Invalid grid footprint'));
  }
  return errors;
};
export function validateWorldPackage(world,{requireApproved=false}={}){
  const errors=[];
  if(!record(world))return [issue('world','world.required','Expected a world object')];
  if(world.schemaVersion!==WORLD_SCHEMA_VERSION)errors.push(issue('schemaVersion','world.version','Unsupported world schema version'));
  if(!idPattern.test(world.id))errors.push(issue('id','world.id','Invalid world identifier'));
  if(typeof world.name!=='string'||!world.name.trim()||world.name.length>120)errors.push(issue('name','world.name','World title is required'));
  if(!Array.isArray(world.assets)||world.assets.length>512){
    errors.push(issue('assets','world.assets','Expected at most 512 asset definitions'));
    return errors;
  }
  errors.push(...validateAssetCatalog(world.assets));
  const assetIds=new Set();
  for(let i=0;i<world.assets.length;i++){
    const asset=world.assets[i];
    if(!record(asset))continue;
    assetIds.add(asset.id);
    errors.push(...validateSprite(asset.sprite,'assets['+i+'].sprite'));
    if(requireApproved&&(!asset.source||asset.source.reviewStatus!=='approved'||asset.source.allowedForPublicBuild!==true)){
      errors.push(issue('assets['+i+'].source','world.approval','Asset awaits public distribution review'));
    }
  }
  if(!Array.isArray(world.scenes)||world.scenes.length<1||world.scenes.length>64){
    errors.push(issue('scenes','world.scenes','Expected 1..64 scenes'));
    return errors;
  }
  const sceneIds=new Set();
  for(let i=0;i<world.scenes.length;i++){
    const scene=world.scenes[i];
    const base='scenes['+i+']';
    errors.push(...validateSceneDocument(scene,assetIds).map(error=>({...error,path:base+'.'+error.path})));
    if(!record(scene))continue;
    if(sceneIds.has(scene.id))errors.push(issue(base+'.id','scene.duplicate','Duplicate scene identifier'));
    sceneIds.add(scene.id);
    if(!safeImageRef(scene.backgroundRef))errors.push(issue(base+'.backgroundRef','scene.background','Invalid original scene background PNG'));
    if(scene.instances&&Array.isArray(scene.instances)){
      for(let j=0;j<scene.instances.length;j++){
        const item=scene.instances[j];
        if(!record(item))continue;
        const asset=world.assets.find(a=>record(a)&&a.id===item.assetId);
        if(asset&&record(asset.sprite)&&record(asset.sprite.footprint)){
          const f=asset.sprite.footprint;
          if(integer(item.x,0,64)&&integer(item.z,0,64)&&
             (item.x+f.widthCells>scene.width||item.z+f.depthCells>scene.depth)){
            errors.push(issue(base+'.instances['+j+']','scene.footprint','Asset footprint crosses scene boundary'));
          }
        }
      }
    }
  }
  if(!sceneIds.has(world.entrySceneId)){
    errors.push(issue('entrySceneId','world.entry','Entry scene must reference a declared scene'));
  }
  return errors;
}
export function assertWorldPackage(world,options){
  const errors=validateWorldPackage(world,options);
  if(errors.length){
    const error=new Error('Invalid world package: '+errors.map(e=>e.path+' ['+e.code+']').join(', '));
    error.issues=errors;
    throw error;
  }
  return world;
}
export function referencedImages(world){
  assertWorldPackage(world);
  return [...new Set([
    ...world.assets.map(a=>a.sprite.imageRef),
    ...world.scenes.map(scene=>scene.backgroundRef)
  ])];
}

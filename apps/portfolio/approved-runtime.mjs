/**
 * Shared original scene renderer, used for both the approved public manifest
 * and the isolated, unapproved local artist preview.
 * The public loadApprovedWorld entrypoint always enforces provenance approval.
 */
import {commandsForScene,drawScene,occupiedCells,validateScene} from '../../packages/scene-core/scene.mjs';
import {validateApprovedManifest} from '../../packages/public-manifest/index.mjs';

const catalogURL=new URL('./assets/approved-worlds.json',import.meta.url);
const assetRoot=new URL('./assets/',import.meta.url);
const loadImage=url=>new Promise((resolve,reject)=>{
 const img=new Image();
 img.onload=()=>resolve(img);
 img.onerror=()=>reject(Error('Unable to load original atlas image'));
 img.src=url;
});

/** Create a painter from already-validated scene data; never approve assets here. */
export async function createWorldRenderer(roomId,manifest,{imageLoader=loadImage,baseURL=assetRoot}={}){
 const room=manifest?.rooms?.[roomId];
 if(!room)return null;
 validateScene(room.scene,manifest.assets);
 const refs=new Set(room.scene.instances.map(i=>manifest.assets[i.assetId].atlasRef));
 if(room.playerAssetId){
  if(!Object.hasOwn(manifest.assets,room.playerAssetId))throw Error('Unknown player atlas');
  refs.add(manifest.assets[room.playerAssetId].atlasRef);
 }
 const images={};
 await Promise.all([...refs].map(async ref=>{
  if(!/^atlases\/[a-z][a-z0-9-]{0,63}\.png$/.test(ref))
   throw Error('Unsafe original atlas reference');
  images[ref]=await imageLoader(new URL(ref,baseURL));
 }));
 const blockedCells=occupiedCells(room.scene,manifest.assets);
 return {
  roomId,blockedCells,
  paint(ctx,player,timeMs=0,facing='se',playerAction='idle'){
   const actors=room.playerAssetId?[{
    id:'moving-player',assetId:room.playerAssetId,
    x:player.x,y:0,z:player.z,action:playerAction,direction:facing
   }]:[];
   const scene={...room.scene,instances:[...room.scene.instances,...actors]};
   const commands=commandsForScene(scene,manifest.assets,{
    originX:480,originY:110,scale:1.29,timeMs
   });
   drawScene(ctx,commands,images);
  }
 };
}

/** Fail closed: only human-approved original art can be displayed publicly. */
export async function loadApprovedWorld(roomId,{fetcher=fetch,imageLoader=loadImage}={}){
 const response=await fetcher(catalogURL);
 if(!response.ok)throw Error('Approved catalog missing');
 const manifest=await response.json();
 validateApprovedManifest(manifest);
 return createWorldRenderer(roomId,manifest,{imageLoader});
}

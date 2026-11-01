/**
 * M5 opt-in original renderer. Loads *only* reviewed atlas manifests.
 * Empty approved-worlds.json leaves the existing playable prototype intact.
 */
import {commandsForScene,drawScene} from '../../packages/scene-core/scene.mjs';
import {validateApprovedManifest} from '../../packages/public-manifest/index.mjs';
const catalogURL=new URL('./assets/approved-worlds.json',import.meta.url);
const loadImage=url=>new Promise((resolve,reject)=>{
 const img=new Image();
 img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Unable to load approved image'));
 img.src=url;
});
export async function loadApprovedWorld(roomId,{fetcher=fetch,imageLoader=loadImage}={}){
 const response=await fetcher(catalogURL);
 if(!response.ok)throw Error('Approved catalog missing');
 const manifest=await response.json();validateApprovedManifest(manifest);
 const room=manifest.rooms[roomId];
 if(!room)return null;
 const refs=new Set(room.scene.instances.map(i=>manifest.assets[i.assetId].atlasRef));
 if(room.playerAssetId)refs.add(manifest.assets[room.playerAssetId].atlasRef);
 const images={};
 await Promise.all([...refs].map(async ref=>{
  images[ref]=await imageLoader(new URL('./assets/'+ref,import.meta.url));
 }));
 return {roomId,paint(ctx,player,timeMs=0){
  const actors=room.playerAssetId?[{id:'moving-player',assetId:room.playerAssetId,
   x:player.x,y:0,z:player.z,action:'idle',direction:'se'}]:[];
  const scene={...room.scene,instances:[...room.scene.instances,...actors]};
  const commands=commandsForScene(scene,manifest.assets,{
   originX:480,originY:110,scale:1.29,frameIndex:Math.floor(timeMs/150)
  });
  drawScene(ctx,commands,images);
 }};
}

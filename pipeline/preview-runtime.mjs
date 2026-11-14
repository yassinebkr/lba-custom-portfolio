/**
 * Explicitly local-only adapter for the artist's unapproved asset review.
 * It shares the identical renderer with the public approved-worlds loader.
 * Never copy this module or preview-worlds.json into public dist/.
 */
import {createWorldRenderer} from './approved-runtime.mjs';

const previewURL=new URL('./assets/preview-worlds.json',import.meta.url);
export async function loadApprovedWorld(roomId,{fetcher=fetch}={}){
 const response=await fetcher(previewURL);
 if(!response.ok)throw Error('Private workshop preview manifest missing');
 const manifest=await response.json();
 if(manifest.schemaVersion!==1||manifest.previewOnly!==true||
    !manifest.assets||!manifest.rooms)throw Error('Not an isolated local asset preview');
 for(const [id,a] of Object.entries(manifest.assets)){
  if(!/^[a-z][a-z0-9-]*$/.test(id)||!a||a.reviewStatus!=='pending'||
     a.allowedForPublicBuild!==false||a.source?.reviewStatus!=='pending'||
     a.source?.allowedForPublicBuild!==false)
   throw Error('Unreviewed preview asset has unsafe provenance: '+id);
 }
 return createWorldRenderer(roomId,manifest);
}

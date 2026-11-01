/** Fail-closed validation for ONLY owner-approved, original public artwork. */
const id=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(x);
const error=s=>{throw Error('Public asset error: '+s)};
export function validateApprovedManifest(doc){
 if(!doc||doc.schemaVersion!==1||!doc.assets||!doc.rooms||
 Array.isArray(doc.assets)||Array.isArray(doc.rooms))error('Invalid catalog');
 for(const [name,a] of Object.entries(doc.assets)){
  if(!id(name)||!a||a.reviewStatus!=='approved'||a.allowedForPublicBuild!==true)error('Asset not approved: '+name);
  const s=a.source;
  if(!s||!['original-art','original-photo','original-model','licensed-asset'].includes(s.origin)||
     !['original','CC0-1.0','MIT','CC-BY-4.0'].includes(s.license)||!s.creator||
     s.reviewStatus!=='approved'||s.allowedForPublicBuild!==true)error('Invalid source rights: '+name);
  if(s.license==='CC-BY-4.0'&&!s.attribution)error('Missing attribution: '+name);
  if(typeof a.atlasRef!=='string'||!/^atlases\/[a-z0-9-]+\.png$/.test(a.atlasRef))error('Unsafe atlas path: '+name);
  if(!a.pivot||![a.pivot.x,a.pivot.y].every(Number.isFinite))error('Missing pivot: '+name);
  if(!Array.isArray(a.frames)||!a.frames.length||a.frames.length>240||
   !a.frames.every(f=>Array.isArray(f.rect)&&f.rect.length===4&&f.rect.every(x=>Number.isInteger(x)&&x>=0)&&f.rect[2]>0&&f.rect[3]>0))
   error('Malformed atlas frames: '+name);
 }
 for(const [roomId,room] of Object.entries(doc.rooms)){
  if(!id(roomId)||!room||!room.scene||room.scene.id!==roomId||room.scene.schemaVersion!==1||
   !Array.isArray(room.scene.instances))error('Invalid room: '+roomId);
  for(const p of room.scene.instances)if(!p||!Object.hasOwn(doc.assets,p.assetId))error('Unapproved room asset: '+roomId);
  if(room.playerAssetId&&!Object.hasOwn(doc.assets,room.playerAssetId))error('Unapproved player');
 }
 return true;
}

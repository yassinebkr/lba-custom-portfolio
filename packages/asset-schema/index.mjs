/**
 * Project Atlas content contract — v1.
 * Pure ESM. No runtime dependencies or proprietary game data.
 * Validation returns structured issues; the Studio decides how to display them.
 */
export const SCHEMA_VERSION=1;
const idPattern=/^[a-z][a-z0-9-]{0,63}$/;
const assetKinds=new Set(['character','furniture','prop','structure']);
const approvedLicenses=new Set(['original','CC0-1.0','MIT','CC-BY-4.0']);
const allowedOrigins=new Set(['original-art','original-photo','licensed-asset','original-model']);
const rotations=new Set([0,90,180,270]);
const text=(x,limit=160)=>typeof x==='string'&&x.trim().length>0&&x.length<=limit;
const isRecord=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const issue=(path,code,message)=>({path,code,message});
const safePath=(p)=>typeof p==='string'&&p.length>0&&p.length<=300&&
  !p.startsWith('/')&&!p.includes('\\')&&!p.includes('..')&&
  !p.includes('?')&&!p.includes('#')&&!/[\x00-\x1f]/.test(p)&&
  /^[a-z0-9][a-z0-9/_\-.]*$/i.test(p);
export function validateSource(value,path='source'){
 const errors=[];
 if(!isRecord(value)){errors.push(issue(path,'source.required','Source provenance is required'));return errors;}
 if(!allowedOrigins.has(value.origin))errors.push(issue(path+'.origin','source.origin','Unsupported origin'));
 if(!text(value.creator,100))errors.push(issue(path+'.creator','source.creator','Creator is required'));
 if(!approvedLicenses.has(value.license))errors.push(issue(path+'.license','source.license','License must be explicitly allowed'));
 if(value.reviewStatus!=='approved'&&value.reviewStatus!=='pending'&&value.reviewStatus!=='rejected')errors.push(issue(path+'.reviewStatus','source.review','Invalid review state'));
 if(typeof value.allowedForPublicBuild!=='boolean')errors.push(issue(path+'.allowedForPublicBuild','source.public','Public build approval must be boolean'));
 if(value.allowedForPublicBuild===true&&value.reviewStatus!=='approved')errors.push(issue(path+'.reviewStatus','source.not-approved','Public asset requires approved review'));
 if(value.sourceUrl!==null&&value.sourceUrl!==undefined&&
   (typeof value.sourceUrl!=='string'||!/^https:\/\/[a-z0-9.-]+\/\S*$/i.test(value.sourceUrl)))errors.push(issue(path+'.sourceUrl','source.url','Only HTTPS source URLs accepted'));
 if(value.license==='CC-BY-4.0'&&!text(value.attribution,500))errors.push(issue(path+'.attribution','source.attribution','CC-BY requires attribution'));
 return errors;
}
export function validateAssetCatalog(assets){
 const errors=[];
 if(!Array.isArray(assets)||assets.length>10000)return[issue('assets','catalog.invalid','Expected an array of at most 10000 assets')];
 const ids=new Set();
 assets.forEach((asset,i)=>{
  const p='assets['+i+']';
  if(!isRecord(asset)){errors.push(issue(p,'asset.invalid','Asset must be an object'));return;}
  if(!idPattern.test(asset.id))errors.push(issue(p+'.id','asset.id','Invalid asset identifier'));
  if(ids.has(asset.id))errors.push(issue(p+'.id','asset.duplicate','Duplicate asset identifier'));
  ids.add(asset.id);
  if(!text(asset.name,100))errors.push(issue(p+'.name','asset.name','Name required'));
  if(!assetKinds.has(asset.kind))errors.push(issue(p+'.kind','asset.kind','Unsupported asset kind'));
  if(asset.atlasRef!==undefined&&asset.atlasRef!==null&&!safePath(asset.atlasRef))errors.push(issue(p+'.atlasRef','asset.path','Unsafe asset path'));
  errors.push(...validateSource(asset.source,p+'.source'));
 });
 return errors;
}
export function validateSceneDocument(scene,assetIds=new Set()){
 const errors=[];
 if(!isRecord(scene))return[issue('scene','scene.invalid','Expected a scene object')];
 if(scene.schemaVersion!==SCHEMA_VERSION)errors.push(issue('scene.schemaVersion','scene.version','Unsupported schema version'));
 if(!idPattern.test(scene.id))errors.push(issue('scene.id','scene.id','Invalid scene ID'));
 if(!text(scene.name,120))errors.push(issue('scene.name','scene.name','Scene name required'));
 const width=scene.width,depth=scene.depth;
 if(!Number.isInteger(width)||width<3||width>64)errors.push(issue('scene.width','scene.width','Width must be 3–64 cells'));
 if(!Number.isInteger(depth)||depth<3||depth>64)errors.push(issue('scene.depth','scene.depth','Depth must be 3–64 cells'));
 if(!Array.isArray(scene.instances)||scene.instances.length>2000){
   errors.push(issue('scene.instances','scene.instances','Expected up to 2000 instances'));return errors;
 }
 const ids=new Set();
 scene.instances.forEach((obj,i)=>{
   const p='scene.instances['+i+']';
   if(!isRecord(obj)){errors.push(issue(p,'instance.invalid','Instance must be an object'));return;}
   if(!text(obj.id,100)||obj.id==='__proto__'||obj.id==='constructor')errors.push(issue(p+'.id','instance.id','Invalid instance ID'));
   if(ids.has(obj.id))errors.push(issue(p+'.id','instance.duplicate','Duplicate instance ID'));
   ids.add(obj.id);
   if(!assetIds.has(obj.assetId))errors.push(issue(p+'.assetId','instance.asset','Unknown asset reference'));
   if(!Number.isInteger(obj.x)||obj.x<0||obj.x>=width)errors.push(issue(p+'.x','instance.x','X outside scene grid'));
   if(!Number.isInteger(obj.z)||obj.z<0||obj.z>=depth)errors.push(issue(p+'.z','instance.z','Z outside scene grid'));
   if(!Number.isInteger(obj.layer)||obj.layer<0||obj.layer>31)errors.push(issue(p+'.layer','instance.layer','Layer must be 0–31'));
   if(!rotations.has(obj.rotation))errors.push(issue(p+'.rotation','instance.rotation','Rotation must be 0, 90, 180 or 270'));
   if(typeof obj.interactive!=='boolean')errors.push(issue(p+'.interactive','instance.interactive','Interactive must be boolean'));
   if(!text(obj.label,80))errors.push(issue(p+'.label','instance.label','Readable label required'));
 });
 return errors;
}
export function validateAnimation(anim,path='animation'){
 const errors=[];
 if(!isRecord(anim))return[issue(path,'animation.invalid','Animation must be an object')];
 if(!idPattern.test(anim.id))errors.push(issue(path+'.id','animation.id','Invalid animation ID'));
 if(!Array.isArray(anim.frames)||anim.frames.length<1||anim.frames.length>240)
   return [...errors,issue(path+'.frames','animation.frames','Expected 1–240 frames')];
 if(typeof anim.loop!=='boolean')errors.push(issue(path+'.loop','animation.loop','Loop must be boolean'));
 anim.frames.forEach((frame,i)=>{
   const p=path+'.frames['+i+']';
   if(!isRecord(frame)||!Number.isInteger(frame.durationMs)||frame.durationMs<16||frame.durationMs>60000)
     errors.push(issue(p+'.durationMs','animation.duration','Frame duration must be 16–60000 ms'));
   if(!isRecord(frame)||!safePath(frame.imageRef))errors.push(issue(p+'.imageRef','animation.image','Frame requires a safe relative image path'));
 });
 return errors;
}
export function assertValid(errors){
 if(errors.length)throw new Error(errors.map(e=>e.path+': '+e.message).join('; '));
}
export function makeApprovedSource(creator='project-owner'){
 return {origin:'original-art',creator,sourceUrl:null,license:'original',attribution:null,reviewStatus:'approved',allowedForPublicBuild:true};
}

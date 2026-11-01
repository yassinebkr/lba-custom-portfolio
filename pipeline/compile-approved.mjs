#!/usr/bin/env node
/**
 * One way bridge: reviewed asset_batch.py output + independently authored scenes
 * -> public PNG/JSON catalog. No game archive, no new art, no automatic approval.
 */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';
import {validateApprovedManifest} from '../packages/public-manifest/index.mjs';
import {validateScene} from '../packages/scene-core/scene.mjs';

const goodId=x=>typeof x==='string'&&/^[a-z][a-z0-9-]{0,63}$/.test(x);
const fail=m=>{throw Error('Approved asset compilation: '+m);};

export async function compileApproved(manifestPath,scenePath,outDir){
 const source=JSON.parse(await readFile(manifestPath,'utf8'));
 const sceneDocument=JSON.parse(await readFile(scenePath,'utf8'));
 if(!source||source.schemaVersion!==1||!Array.isArray(source.assets))fail('Expected sprite atlas manifest v1');
 const rawScenes=Array.isArray(sceneDocument.scenes)?sceneDocument.scenes:[sceneDocument];
 if(!rawScenes.length)fail('At least one original authored scene required');
 const compiled={schemaVersion:1,assets:{},rooms:{}};
 const sources=[];
 for(const asset of source.assets){
  if(!asset||!goodId(asset.id)||Object.hasOwn(compiled.assets,asset.id))fail('Invalid or duplicate asset ID');
  if(!/^atlases\/[a-z][a-z0-9-]{0,63}\.png$/.test(asset.atlasRef))fail('Unsafe original atlas path');
  const original=asset.source;
  if(!original||original.reviewStatus!=='approved'||original.allowedForPublicBuild!==true)
   fail('Asset has not passed explicit original-art rights and visual approval: '+asset.id);
  if(!Array.isArray(asset.frames)||!asset.frames.length)fail('Missing exported PNG frames');
  const frames=asset.frames.map(f=>({
   action:f.action||'idle',direction:String(f.direction||'SE').toLowerCase(),
   durationMs:f.durationMs||150,rect:f.rect
  }));
  compiled.assets[asset.id]={
   kind:asset.kind,atlasRef:asset.atlasRef,
   pivot:asset.pivot,frames,
   source:original,reviewStatus:'approved',allowedForPublicBuild:true,
   solid:asset.kind==='structure'||asset.kind==='furniture',
   footprint:asset.footprint||{width:1,depth:1}
  };
  const bytes=await readFile(join(dirname(resolve(manifestPath)),asset.atlasRef));
  if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')fail('Invalid source atlas PNG: '+asset.id);
  sources.push([asset.atlasRef,bytes]);
 }
 for(const rawScene of rawScenes){
  if(!rawScene||!goodId(rawScene.id)||Object.hasOwn(compiled.rooms,rawScene.id))fail('Invalid or duplicate scene ID');
  const scene={schemaVersion:1,id:rawScene.id,width:rawScene.width,depth:rawScene.depth,
   instances:rawScene.instances?.map(obj=>({
    id:obj.id,assetId:obj.assetId,x:obj.x,z:obj.z,y:obj.y??0,
    action:obj.action||'idle',direction:obj.direction||'se'
   }))
  };
  validateScene(scene,compiled.assets);
  compiled.rooms[scene.id]={scene};
  if(rawScene.playerAssetId)compiled.rooms[scene.id].playerAssetId=rawScene.playerAssetId;
 }
 validateApprovedManifest(compiled);
 // All files and references validated BEFORE starting writes to the output path.
 for(const [name,bytes] of sources){
  const target=join(outDir,name);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);
 }
 await mkdir(outDir,{recursive:true});
 await writeFile(join(outDir,'approved-worlds.json'),JSON.stringify(compiled,null,2)+'\n');
 return {assets:Object.keys(compiled.assets).length,rooms:Object.keys(compiled.rooms).length,outDir};
}

if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname)){
 const argv=process.argv.slice(2);
 const flag=name=>{const i=argv.indexOf(name);return i<0?null:argv[i+1];};
 const [assets,scenes,out]=['--assets','--scenes','--out'].map(flag);
 if(!assets||!scenes||!out){
  console.error('Usage: node pipeline/compile-approved.mjs --assets output/assets.json --scenes authored-scenes.json --out apps/portfolio/assets');
  process.exitCode=2;
 }else{
  try{console.log(await compileApproved(assets,scenes,out))}
  catch(e){console.error(e.message);process.exitCode=1;}
 }
}

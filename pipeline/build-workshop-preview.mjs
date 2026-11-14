#!/usr/bin/env node
/**
 * Deterministic local preview of an original workshop built with our existing:
 * original fixture + Blender source -> asset_batch -> scene-core renderer.
 *
 * NEVER modifies approved-worlds.json in source or checks in generated art.
 * No retail DOS game or third-party protected content is used.
 */
import {spawnSync} from 'node:child_process';
import {cp,mkdir,readFile,rm,writeFile,copyFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {validateScene,occupiedCells} from '../packages/scene-core/scene.mjs';
import {validateApprovedManifest} from '../packages/public-manifest/index.mjs';
import {ROOMS} from '../apps/portfolio/rooms.mjs';

const root=resolve(new URL('..',import.meta.url).pathname);
const stage=join(root,'output','workshop-sources');
const atlases=join(root,'output','workshop-atlases');
const out=join(root,'output','workshop-preview');
const scenePath=join(root,'examples','workshop','scene.json');
const fail=message=>{throw Error('Original workshop preview: '+message);};

function run(command,args){
 const result=spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:5_000_000});
 if(result.status!==0)fail(command+' '+args.join(' ')+'\n'+(result.stderr||result.stdout));
 process.stdout.write(result.stdout||'');
}

function compilePreview(source,authored){
 if(source.schemaVersion!==1||!Array.isArray(source.assets)||source.assets.length<8)
  fail('Missing 8 original atlas sources');
 if(authored.schemaVersion!==1||authored.id!=='showroom')
  fail('Expected the authored original showroom');
 const manifest={schemaVersion:1,previewOnly:true,assets:{},rooms:{}};
 for(const asset of source.assets){
  const rights=asset.source;
  if(!asset.id||Object.hasOwn(manifest.assets,asset.id)||
     !rights||!['original-art','original-model'].includes(rights.origin)||
     rights.reviewStatus!=='pending'||rights.allowedForPublicBuild!==false)
   fail('Unreviewed/unsafe original source: '+asset?.id);
  if(!/^atlases\/[a-z][a-z0-9-]{0,63}\.png$/.test(asset.atlasRef))
   fail('Invalid preview atlas reference');
  manifest.assets[asset.id]={
   kind:asset.kind,atlasRef:asset.atlasRef,pivot:asset.pivot,
   frames:asset.frames.map(f=>({
    action:f.action,direction:f.direction.toLowerCase(),
    durationMs:f.durationMs,rect:f.rect
   })),
   source:rights,reviewStatus:'pending',allowedForPublicBuild:false,
   solid:asset.kind==='furniture'||asset.kind==='structure',
   footprint:{width:1,depth:1}
  };
 }
 const instances=authored.instances.map(item=>({
  id:item.id,assetId:item.assetId,x:item.x,y:item.y??0,z:item.z,
  action:item.action||'idle',direction:item.direction||'se'
 }));
 const scene={schemaVersion:1,id:authored.id,width:authored.width,
  depth:authored.depth,instances};
 validateScene(scene,manifest.assets);
 if(!Object.hasOwn(manifest.assets,authored.playerAssetId))
  fail('Missing animated player asset');
 manifest.rooms.showroom={scene,playerAssetId:authored.playerAssetId};
 const player=manifest.assets[authored.playerAssetId];
 for(const direction of ['ne','nw','se','sw']){
  if(!player.frames.some(f=>f.direction===direction&&f.action==='idle'))
   fail('Player idle pose missing for '+direction);
  const walk=player.frames.filter(f=>f.direction===direction&&f.action==='walk');
  if(walk.length<4)fail('Player must have an authored 4-frame walk for '+direction);
  if(new Set(walk.map(f=>f.rect.join(','))).size<4)
   fail('Animated player frames share an atlas rectangle');
 }
 const active=manifest.assets['status-lamp'].frames.filter(f=>f.action==='active');
 if(active.length<4)fail('Animated workshop lamp must have four frames');
 const room=ROOMS.find(room=>room.id==='showroom');
 if(!room||room.projects.length!==4)fail('Missing project definitions for showcase');
 for(const project of room.projects){
  const instance=instances.find(item=>item.id===project.id);
  if(!instance||instance.x!==project.x||instance.z!==project.z)
   fail('Project interaction hotspot does not align with placed sprite: '+project.id);
 }
 const solids=occupiedCells(scene,manifest.assets);
 if(solids.has(room.start.x+':'+room.start.z))
  fail('Scene places solid furniture on player start');
 // The public publisher MUST reject this exact preview manifest.
 let rejected=false;
 try{validateApprovedManifest(manifest);}
 catch{rejected=true;}
 if(!rejected)fail('Pending preview data unexpectedly passed public rights gate');
 return manifest;
}

async function main(){
 run('python3',['pipeline/fixtures/generate_workshop.py','--out',stage]);
 run('python3',['pipeline/asset_batch.py',join(stage,'recipe.json'),'--out',atlases]);
 const source=JSON.parse(await readFile(join(atlases,'assets.json'),'utf8'));
 const authored=JSON.parse(await readFile(scenePath,'utf8'));
 const manifest=compilePreview(source,authored);
 // Build the *unmodified* public artifact, then create a private-only copy.
 // The one-module substitution below is made ONLY in ignored output/.
 run(process.execPath,['scripts/build-portfolio.mjs']);
 await rm(out,{recursive:true,force:true});
 await cp(join(root,'dist'),out,{recursive:true});
 const gamePath=join(out,'game.mjs');
 const game=await readFile(gamePath,'utf8');
 const original="from './approved-runtime.mjs';";
 if(!game.includes(original))fail('Public runtime import contract changed');
 await writeFile(gamePath,game.replace(original,"from './preview-loader.mjs';"));
 await copyFile(join(root,'pipeline','preview-runtime.mjs'),join(out,'preview-loader.mjs'));
 const htmlPath=join(out,'index.html');
 const html=await readFile(htmlPath,'utf8');
 if(!html.includes('<main>'))fail('Original portfolio HTML contract changed');
 const banner='<div id="preview-note" role="note" style="padding:10px 24px;background:#75552a;color:#fff1d2;text-align:center;font:600 13px system-ui;">LOCAL ASSET REVIEW · Original prototype artwork · Not approved for public release</div>';
 await writeFile(htmlPath,html.replace('<main>',banner+'\n<main>'));
 await mkdir(join(out,'assets','atlases'),{recursive:true});
 await writeFile(join(out,'assets','preview-worlds.json'),JSON.stringify(manifest,null,2)+'\n');
 for(const asset of Object.values(manifest.assets)){
  const from=join(atlases,asset.atlasRef),to=join(out,'assets',asset.atlasRef);
  const bytes=await readFile(from);
  if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
   fail('Corrupted generated atlas');
  await mkdir(dirname(to),{recursive:true});
  await writeFile(to,bytes);
 }
 console.log('LOCAL workshop scene built: '+out);
 console.log('Assets: '+Object.keys(manifest.assets).length+
             ', placed props: '+manifest.rooms.showroom.scene.instances.length+
             ', character directions: 4, walk poses: 4/direction');
 console.log('Browse via: python3 -m http.server 8766 --directory output/workshop-preview');
 console.log('No pending assets entered the public dist/ artifact.');
}
await main();

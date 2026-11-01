#!/usr/bin/env node
/** M5: allowlisted GitHub Pages build, never the complete builder or legacy assets. */
import {readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {validateApprovedManifest} from '../packages/public-manifest/index.mjs';
import {validateScene} from '../packages/scene-core/scene.mjs';
const root=resolve(new URL('..',import.meta.url).pathname),dist=join(root,'dist');
const entries=[
 ['apps/portfolio/index.html','index.html'],
 ['apps/portfolio/game.mjs','game.mjs'],
 ['apps/portfolio/rules.mjs','rules.mjs'],
 ['apps/portfolio/rooms.mjs','rooms.mjs'],
 ['apps/portfolio/approved-runtime.mjs','approved-runtime.mjs'],
 ['packages/asset-core/index.mjs','modules/asset-core.mjs'],
 ['packages/scene-core/scene.mjs','modules/scene-core.mjs'],
 ['packages/public-manifest/index.mjs','modules/public-manifest.mjs'],
 ['apps/portfolio/assets/approved-worlds.json','assets/approved-worlds.json'],
 ['apps/portfolio/sprite-demo/index.html','sprite-demo/index.html'],
 ['apps/portfolio/sprite-demo/compare.html','sprite-demo/compare.html'],
 ['apps/portfolio/sprite-demo/compare.css','sprite-demo/compare.css'],
 ['apps/portfolio/sprite-demo/compare.mjs','sprite-demo/compare.mjs'],
 ['apps/portfolio/sprite-demo/telemetry-receiver.png','sprite-demo/telemetry-receiver.png']
];
const manifest=JSON.parse(await readFile(join(root,'apps/portfolio/assets/approved-worlds.json'),'utf8'));
validateApprovedManifest(manifest);
for(const room of Object.values(manifest.rooms))validateScene(room.scene,manifest.assets);
const replacements={
 'approved-runtime.mjs':[['../../packages/scene-core/scene.mjs','./modules/scene-core.mjs'],
                            ['../../packages/public-manifest/index.mjs','./modules/public-manifest.mjs']],
 'modules/scene-core.mjs':[['../asset-core/index.mjs','./asset-core.mjs']]
};
const files=[];
for(const [source,target] of entries){
 let data=await readFile(join(root,source));
 if(target.endsWith('.mjs')){
  let text=data.toString('utf8');
  for(const [a,b] of replacements[target]||[]){
   if(!text.includes(a))throw Error('Source module import no longer matches: '+a);
   text=text.replace(a,b);
  }
  if(/\.HQR|\.jsdos|RELENT\.EXE/i.test(text))throw Error('Proprietary game dependency in public runtime');
  data=Buffer.from(text);
 }
 if(target==='sprite-demo/telemetry-receiver.png' &&
  (data.length>250000 || data.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'))
   throw Error('Generated original sprite demo must be a small valid PNG');
 files.push([target,data]);
}
for(const asset of Object.values(manifest.assets)){
 const file='assets/'+asset.atlasRef;
 const data=await readFile(join(root,'apps/portfolio/assets',asset.atlasRef));
 if(data.length<24||data.subarray(1,4).toString()!=='PNG')throw Error('Approved atlas is not a PNG: '+file);
 files.push([file,data]);
}
// V6: only the exact, checksum-pinned real Blender export matrix can be
// published. No builder, GLB, shader sources, or proprietary game archives.
const qaFolder=join(root,'apps/portfolio/sprite-demo/compare');
const qa=JSON.parse(await readFile(join(qaFolder,'matrix.json'),'utf8'));
if(qa.schemaVersion!==1 || !Array.isArray(qa.candidates)||qa.candidates.length!==24||
  qa.inputFrameSize?.[0]!==768||qa.inputFrameSize?.[1]!==768 ||
  JSON.stringify(qa.sharedCrop)!=='[103,35,665,597]' ||
  JSON.stringify(qa.directions)!=='["ne","nw","sw","se"]')
  throw Error('Original V6 comparison manifest is absent or does not match the pinned V5 build');
const pngMeta=bytes=>{
 if(bytes.length<32||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')
  throw Error('Invalid original QA PNG signature');
 return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
};
const names=new Set();
for(const candidate of qa.candidates){
 const name=candidate.file;
 if(typeof name!=='string'||!/^(?:192|224|256)px-(?:lanczos|box)-(?:96|160|256|truecolor)\.png$/.test(name)
  ||names.has(name))throw Error('Invalid or duplicate V6 candidate path');
 names.add(name);
 const bytes=await readFile(join(qaFolder,name));
 if(bytes.length!==candidate.bytes||
  createHash('sha256').update(bytes).digest('hex')!==candidate.sha256)
   throw Error('V6 sprite artifact differs from the verified Blender run: '+name);
 const dims=pngMeta(bytes);
 if(dims[0]!==candidate.size*4||dims[1]!==candidate.size)throw Error('Wrong V6 sprite grid: '+name);
 files.push(['sprite-demo/compare/'+name,bytes]);
}
if(names.size!==24)throw Error('Incomplete V6 comparison set');
for(const direction of ['ne','nw','sw','se']){
 const name='source-'+direction+'.png';
 const bytes=await readFile(join(qaFolder,name));
 if(bytes.length>1_000_000||JSON.stringify(pngMeta(bytes))!=='[768,768]')
   throw Error('Invalid V6 original Blender source: '+name);
 files.push(['sprite-demo/compare/'+name,bytes]);
}
files.push(['sprite-demo/compare/matrix.json',Buffer.from(JSON.stringify(qa,null,2)+'\n')]);

if(files.reduce((n,[_name,bytes])=>n+bytes.length,0)>35_000_000)throw Error('Public bundle exceeds 35MB');
await rm(dist,{recursive:true,force:true});
for(const [name,bytes] of files){
 const target=join(dist,name);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);
}
console.log('Public artifact: '+files.length+' allowlisted files; '+Object.keys(manifest.assets).length+' approved original assets');

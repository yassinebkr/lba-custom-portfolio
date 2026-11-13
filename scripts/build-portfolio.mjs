#!/usr/bin/env node
/** M5: allowlisted GitHub Pages build, never the complete builder or legacy assets. */
import {readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {validateApprovedManifest} from '../packages/public-manifest/index.mjs';
import {validateScene} from '../packages/scene-core/scene.mjs';
const root=resolve(new URL('..',import.meta.url).pathname),dist=join(root,'dist');
const entries=[
 ['web_deploy/index.html','web_deploy/index.html'],
 ['web_deploy/local-bundle.mjs','web_deploy/local-bundle.mjs'],
 ['web_deploy/vendor/jsdos622/js-dos.js','web_deploy/vendor/jsdos622/js-dos.js'],
 ['web_deploy/vendor/jsdos622/wdosbox.js','web_deploy/vendor/jsdos622/wdosbox.js'],
 ['web_deploy/vendor/jsdos622/wdosbox.wasm.js','web_deploy/vendor/jsdos622/wdosbox.wasm.js'],
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
 ['apps/portfolio/sprite-demo/scene-lab.html','sprite-demo/scene-lab.html'],
 ['apps/portfolio/sprite-demo/scene-lab.css','sprite-demo/scene-lab.css'],
 ['apps/portfolio/sprite-demo/scene-lab.mjs','sprite-demo/scene-lab.mjs'],
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
  if(!target.startsWith('web_deploy/') && /\.HQR|\.jsdos|RELENT\.EXE/i.test(text))throw Error('Proprietary game dependency in public runtime');
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

// V7: separate, unapproved visual QA scene with original Blender backgrounds,
// not a production room. Check the exact static render artefacts from green CI.
const v7folder=join(root,'apps/portfolio/sprite-demo/scene');
const v7Manifest=await readFile(join(v7folder,'layout.json'));
const layout=JSON.parse(v7Manifest.toString('utf8'));
if(layout.schemaVersion!==1||layout.approvedForPortfolio!==false||
   layout.reviewStatus!=='pending-artistic-review'||
   layout.width!==960||layout.height!==640||
   !Array.isArray(layout.anchor)||layout.anchor.length!==2||
   !Array.isArray(layout.depthLayers)||layout.depthLayers.length!==3||
   createHash('sha256').update(v7Manifest).digest('hex')!=='3bee5d7e5cb427ae903a09fac7d6e3447b90b22eac19721fa1ae06f278561d44')
 throw Error('V7 original review scene layout was unexpectedly changed');
files.push(['sprite-demo/scene/layout.json',v7Manifest]);
for(const [name,expectedHash] of [
 ['background.png','eca5acca67862051651c0698665a0af11288aa6266f9da5e960fea50835c1dd3'],
 ['foreground.png','5c8a3b3ae29835cd542caff09c2d855128f317dbd539fe3420f8fa0714c47d59']]){
 const data=await readFile(join(v7folder,name));
 const dims=pngMeta(data);
 if(dims[0]!==960||dims[1]!==640||
  createHash('sha256').update(data).digest('hex')!==expectedHash)
    throw Error('V7 Blender render differs from verified QA output: '+name);
 files.push(['sprite-demo/scene/'+name,data]);
}

if(files.reduce((n,[_name,bytes])=>n+bytes.length,0)>35_000_000)throw Error('Public bundle exceeds 35MB');
await rm(dist,{recursive:true,force:true});
for(const [name,bytes] of files){
 const target=join(dist,name);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);
}
console.log('Public artifact: '+files.length+' allowlisted files; '+Object.keys(manifest.assets).length+' approved original assets');

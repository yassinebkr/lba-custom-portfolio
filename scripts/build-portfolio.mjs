#!/usr/bin/env node
/** M5: allowlisted GitHub Pages build, never the complete builder or legacy assets. */
import {readFile,writeFile,rm,mkdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
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
 ['apps/portfolio/assets/approved-worlds.json','assets/approved-worlds.json']
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
 files.push([target,data]);
}
for(const asset of Object.values(manifest.assets)){
 const file='assets/'+asset.atlasRef;
 const data=await readFile(join(root,'apps/portfolio/assets',asset.atlasRef));
 if(data.length<24||data.subarray(1,4).toString()!=='PNG')throw Error('Approved atlas is not a PNG: '+file);
 files.push([file,data]);
}
if(files.reduce((n,[_name,bytes])=>n+bytes.length,0)>35_000_000)throw Error('Public bundle exceeds 35MB');
await rm(dist,{recursive:true,force:true});
for(const [name,bytes] of files){
 const target=join(dist,name);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes);
}
console.log('Public artifact: '+files.length+' allowlisted files; '+Object.keys(manifest.assets).length+' approved original assets');

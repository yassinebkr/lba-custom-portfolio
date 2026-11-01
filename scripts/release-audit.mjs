#!/usr/bin/env node
/**
 * M6: reproducible public shipping audit. The default --ci mode reports pending
 * art gates without blocking development. --strict requires actual approved art.
 * A passing green CI is NOT equivalent to an artistic approval or live deployment.
 */
import {readFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {validateApprovedManifest} from '../packages/public-manifest/index.mjs';
import {validateScene} from '../packages/scene-core/scene.mjs';
const root=resolve(new URL('..',import.meta.url).pathname),dist=join(root,'dist');
const strict=process.argv.includes('--strict');
const check=(ok,message)=>{if(!ok)throw Error(message);};
const built=spawnSync(process.execPath,['scripts/build-portfolio.mjs'],{cwd:root,encoding:'utf8'});
check(built.status===0,'Public build failed: '+built.stderr);
const m=JSON.parse(await readFile(join(dist,'assets/approved-worlds.json'),'utf8'));
validateApprovedManifest(m);
const files=[];
async function walk(path,relative=''){
 for(const item of await readdir(path,{withFileTypes:true})){
  const next=relative?relative+'/'+item.name:item.name;
  if(item.isDirectory())await walk(join(path,item.name),next);
  else if(item.isFile())files.push(next);
  else throw Error('Non-file or symlink in static public output: '+next);
 }
}
await walk(dist);
const disallowed=files.filter(path=>!/\.(?:mjs|html|json|png|css)$/.test(path));
check(!disallowed.length,'Non-allowlisted public file type: '+disallowed.join(', '));
check(!files.some(x=>/builder|pipeline|legacy|original-source|\.hqr|\.jsdos|\.exe/i.test(x)),
 'Builder or proprietary file in public distribution');
for(const a of Object.values(m.assets)){
 const path='assets/'+a.atlasRef;
 check(files.includes(path),'Approved image missing from dist: '+path);
 const bytes=await readFile(join(dist,path));
 check(bytes.length>24&&bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a','Invalid image signature: '+path);
}
for(const r of Object.values(m.rooms))validateScene(r.scene,m.assets);
const pending=[];
if(!Object.keys(m.assets).length)pending.push('No artwork has undergone source-rights and visual review');
if(!Object.keys(m.rooms).length)pending.push('No completed original playable room is included');
if(!Object.values(m.rooms).some(r=>r.playerAssetId))
 pending.push('No original animated playable character is integrated');
if(!Object.values(m.assets).some(a=>a.frames.length>=4))
 pending.push('No approved multi-frame asset is packaged');
// Release sign-off is a human artifact bound to the exact published manifest.
const manifestBytes=await readFile(join(dist,'assets/approved-worlds.json'));
const {createHash}=await import('node:crypto');
const currentHash=createHash('sha256').update(manifestBytes).digest('hex');
let approval=null;
try{approval=JSON.parse(await readFile(join(root,'docs/art-release-approval.json'),'utf8'));}
catch{}
if(!approval||approval.schemaVersion!==1||approval.manifestSha256!==currentHash||
  typeof approval.reviewedBy!=='string'||!approval.reviewedBy.trim()||
  typeof approval.confirmedPagesURL!=='string'||!/^https:\/\/[a-z0-9.-]+\/[a-z0-9_/-]+\/?$/i.test(approval.confirmedPagesURL)||
  !Array.isArray(approval.visualEvidence)||approval.visualEvidence.length<2||
  approval.confirmedRights!==true||
  approval.confirmedVisualQuality!==true||
  approval.confirmedMobileAndDesktop!==true)
 pending.push('Manual visual, ownership and live Pages approval record missing or outdated');
const report={
 status:pending.length?'TECHNICAL_ONLY':'READY_FOR_MANUAL_REVIEW',
 mode:strict?'strict':'ci',staticFileCount:files.length,approvedAssets:Object.keys(m.assets).length,
 originalRooms:Object.keys(m.rooms).length,files,pending
};
console.log(JSON.stringify(report,null,2));
if(strict&&pending.length)process.exitCode=2;

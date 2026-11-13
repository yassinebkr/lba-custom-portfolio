/**
 * R01: inspect versioned source boundaries using the Git index.
 * The command emits structured path metadata and never opens game archives.
 */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const categories={
  authoring:['pipeline/','apps/studio/','metadata-ui/','packages/asset-core/','packages/asset-schema/'],
  canvasPrototype:['apps/portfolio/','packages/scene-core/','packages/game-core/'],
  dosTools:['scripts/hqr-tools/','scripts/build-web-bundle.','scripts/test-game.'],
  dosRuntime:['web_deploy/']
};
export function classifyPath(path){
  return Object.keys(categories).find(category=>categories[category].some(prefix=>path.startsWith(prefix))) || 'support';
}
export function inspectTrackedPaths(paths){
  const protectedFiles=paths.filter(path=>/\.(?:hqr|exe|iso|jsdos|fla|vox|rom)$/i.test(path));
  const groups={};
  for(const name of [...Object.keys(categories),'support']){
    groups[name]=paths.filter(path=>classifyPath(path)===name);
  }
  return {
    schemaVersion:1,
    trackedFiles:paths.length,
    protectedFiles,
    groups,
    privateInputs:['base_game/','output/','modded_assets/'],
    engineExecutable:'RELENT.EXE',
    assetArchives:['SPRITES.HQR','RESS.HQR','LBA_BRK.HQR','LBA_GRI.HQR','LBA_BLL.HQR'],
    bundlePath:'web_deploy/lba1_portfolio.jsdos'
  };
}
export function trackedPaths(){
  return execFileSync('git',['ls-files','-z'],{cwd:root}).toString('utf8').split('\0').filter(Boolean);
}
export function assertAudit(report){
  if(report.protectedFiles.length)throw Error('Protected file in tracked sources: '+report.protectedFiles.join(', '));
  for(const path of ['web_deploy/index.html','scripts/hqr-tools/build-bundle.js','scripts/hqr-tools/patch-relent.js','pipeline/asset_batch.py']){
    if(!report.groups[classifyPath(path)].includes(path))throw Error('Missing source boundary: '+path);
  }
  const legacy=readFileSync(resolve(root,'scripts/hqr-tools/build-bundle.js'),'utf8');
  for(const word of ['base_game','RELENT.EXE','LBA.ISO','SPRITES.HQR']){
    if(!legacy.includes(word))throw Error('Changed DOS packaging contract: '+word);
  }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const report=inspectTrackedPaths(trackedPaths());
  assertAudit(report);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
}

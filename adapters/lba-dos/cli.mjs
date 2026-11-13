/**
 * R03 independent adapter command.
 *
 * Produces inspectable source-derived, DOS-compatible binary payloads.
 * Private SPRITES.HQR overlay requires an explicit base game directory.
 */
import pngjs from 'pngjs';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,join,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectWorldFiles} from '../../scripts/runtime/validate-world.mjs';
import {assertWorldPackage} from '../../packages/world-package/index.mjs';
import {convertWorldImages} from './index.mjs';
import {loadPrivateGamePalette,writePrivateSpriteArchive} from './overlay.mjs';

const {PNG}=pngjs;
function flag(args,key,defaultValue=null){
  const i=args.indexOf(key);
  return i<0?defaultValue:args[i+1]??null;
}
function loadPng(bytes){
  const png=PNG.sync.read(bytes,{checkCRC:true});
  return {width:png.width,height:png.height,rgba:Uint8Array.from(png.data)};
}
function writePng(image){
  return PNG.sync.write({
    width:image.width,height:image.height,
    data:Buffer.from(image.rgba)
  });
}
function pathInRoot(root,reference){
  const target=resolve(root,reference);
  const rel=relative(root,target);
  if(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)){
    throw Error('Image reference escapes world root');
  }
  return target;
}
async function run(argv){
  const worldPath=argv[0];
  if(!worldPath)throw Error('Usage: node adapters/lba-dos/cli.mjs world.json --root . --out /tmp/r03 [--asset id] [--target 128] [--private-base directory --indices a,b,c,d]');
  const root=resolve(flag(argv,'--root','.'));
  const out=resolve(flag(argv,'--out','output/r03-dos-compat'));
  const world=assertWorldPackage(JSON.parse(await readFile(resolve(worldPath),'utf8')));
  await inspectWorldFiles(world,root);
  const assetId=flag(argv,'--asset',world.assets[0]?.id);
  const asset=world.assets.find(item=>item.id===assetId);
  if(!asset)throw Error('Specified source asset is absent');
  const scene=world.scenes.find(item=>item.id===world.entrySceneId);
  if(!scene)throw Error('Missing entry scene');
  const atlas=loadPng(await readFile(pathInRoot(root,asset.sprite.imageRef)));
  const background=loadPng(await readFile(pathInRoot(root,scene.backgroundRef)));
  const privateBase=flag(argv,'--private-base');
  const privatePalette=privateBase?await loadPrivateGamePalette(privateBase):null;
  const target=Number(flag(argv,'--target','128'));
  const result=convertWorldImages({world,assetId,atlas,background,palette:privatePalette,target});
  await mkdir(out,{recursive:true});
  for(const [direction,sprite] of Object.entries(result.sprites)){
    await writeFile(join(out,'sprite-'+direction+'.bin'),sprite.payload);
    await writeFile(join(out,'preview-'+direction+'.png'),writePng(sprite.preview));
  }
  await writeFile(join(out,'original-scene-brick.bin'),result.scenery.payload);
  await writeFile(join(out,'preview-scene-brick.png'),writePng(result.scenery.preview));
  await writeFile(join(out,'palette.rgb'),result.palette);
  let privateArchive=null;
  if(privateBase){
    const value=flag(argv,'--indices');
    if(!value||!new RegExp('^[0-9]+(,[0-9]+){3}$').test(value)){
      throw Error('Private archive overlay requires --indices i,j,k,l');
    }
    const indices=value.split(',').map(Number);
    privateArchive=await writePrivateSpriteArchive({
      privateDir:privateBase,outputPath:join(out,'SPRITES.HQR'),
      sprites:result.sprites,indices
    });
  }
  const report={...result.report,privateArchive:privateArchive
    ?{status:'generated-in-ignored-output',entryIndices:privateArchive.entryIndices,archiveBytes:privateArchive.archiveBytes}
    :{status:'requires-private-source-files'}};
  await writeFile(join(out,'report.json'),JSON.stringify(report,null,2)+'\n');
  process.stdout.write(JSON.stringify({output:out,report},null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  run(process.argv.slice(2)).catch(error=>{
    console.error(error.message);
    process.exitCode=1;
  });
}

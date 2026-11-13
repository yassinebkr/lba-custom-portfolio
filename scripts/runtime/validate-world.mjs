/**
 * World package file integrity verification.
 * References are rooted at --root and resolved only within that directory.
 */
import {readFile,realpath,stat,open} from 'node:fs/promises';
import {resolve,relative,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertWorldPackage,referencedImages} from '../../packages/world-package/index.mjs';

export async function inspectWorldFiles(world,root){
  assertWorldPackage(world);
  const canonicalRoot=await realpath(root);
  const images=[];
  let totalBytes=0;
  for(const assetRef of referencedImages(world)){
    const target=resolve(canonicalRoot,assetRef);
    const canonical=await realpath(target);
    const rel=relative(canonicalRoot,canonical);
    if(rel==='..'||rel.startsWith('..'+sep)||isAbsolute(rel)){
      throw Error('Asset escapes package root: '+assetRef);
    }
    const metadata=await stat(canonical);
    if(!metadata.isFile()||metadata.size<24||metadata.size>16_000_000){
      throw Error('Invalid image size: '+assetRef);
    }
    const fd=await open(canonical,'r');
    let signature;
    try{
      signature=Buffer.alloc(24);
      const {bytesRead}=await fd.read(signature,0,24,0);
      if(bytesRead!==24)throw Error('Truncated PNG: '+assetRef);
    }finally{await fd.close();}
    if(signature.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'){
      throw Error('Invalid PNG signature: '+assetRef);
    }
    images.push({path:assetRef,bytes:metadata.size,width:signature.readUInt32BE(16),height:signature.readUInt32BE(20)});
    totalBytes+=metadata.size;
  }
  if(totalBytes>64_000_000)throw Error('World images exceed local import budget');
  for(const asset of world.assets){
    const image=images.find(x=>x.path===asset.sprite.imageRef);
    if(image.width!==asset.sprite.widthPx||image.height!==asset.sprite.heightPx){
      throw Error('Sprite atlas dimensions mismatch: '+asset.id);
    }
  }
  return {schemaVersion:1,id:world.id,imageCount:images.length,totalBytes,images};
}
async function main(argv){
  const [path,...options]=argv;
  if(!path)throw Error('Usage: node scripts/runtime/validate-world.mjs world.json [--root directory] [--require-approved]');
  const index=options.indexOf('--root');
  const root=index>=0?options[index+1]:'.';
  if(!root)throw Error('Missing --root value');
  const world=JSON.parse(await readFile(resolve(path),'utf8'));
  assertWorldPackage(world,{requireApproved:options.includes('--require-approved')});
  const report=await inspectWorldFiles(world,root);
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  main(process.argv.slice(2)).catch(error=>{
    console.error(error.message);
    process.exitCode=1;
  });
}

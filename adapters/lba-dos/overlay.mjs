/**
 * Private R03 HQR integration.
 *
 * Owner-controlled archives remain in ignored output directories.
 * All replacements are limited to explicitly selected sprite entry indices.
 */
import {HQR,HQREntry,CompressionType} from '@lbalab/hqr';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {decodeSprite} from '../../packages/asset-core/index.mjs';

export function decodeArchive(bytes){
  const source=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  return HQR.fromArrayBuffer(source.buffer.slice(source.byteOffset,source.byteOffset+source.byteLength));
}
export async function loadPrivateGamePalette(privateDir){
  const bytes=await readFile(resolve(privateDir,'RESS.HQR'));
  const archive=decodeArchive(bytes);
  const entry=archive.entries[0];
  if(!entry||!entry.content||entry.content.byteLength<768){
    throw Error('Private RESS.HQR palette entry is unavailable');
  }
  const source=new Uint8Array(entry.content).subarray(0,768);
  const max=Math.max(...source);
  const result=new Uint8Array(768);
  for(let i=0;i<768;i++)result[i]=max<=63?Math.min(255,source[i]*4):source[i];
  return result;
}
export function validateSpriteEntryIndices(indices,count){
  if(!Array.isArray(indices)||indices.length!==4||new Set(indices).size!==4||
     indices.some(index=>!Number.isInteger(index)||index<0||index>=count)){
    throw Error('Four distinct existing HQR sprite indices are required');
  }
  return indices;
}
export function replaceSpriteEntries(archive,sprites,indices){
  if(!archive||!Array.isArray(archive.entries)){
    throw Error('Invalid private SPRITES.HQR archive');
  }
  validateSpriteEntryIndices(indices,archive.entries.length);
  for(const [i,direction] of ['ne','nw','sw','se'].entries()){
    const sprite=sprites[direction];
    if(!sprite||!(sprite.payload instanceof Uint8Array)){
      throw Error('Missing DOS sprite payload: '+direction);
    }
    const decoded=decodeSprite(sprite.payload);
    if(decoded.width>255||decoded.height>255)throw Error('Sprite exceeds DOS byte header');
    const raw=sprite.payload;
    const bytes=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
    archive.entries[indices[i]]=new HQREntry(bytes,CompressionType.NONE);
  }
  return archive;
}
export async function writePrivateSpriteArchive({privateDir,outputPath,sprites,indices}){
  const bytes=await readFile(resolve(privateDir,'SPRITES.HQR'));
  const archive=replaceSpriteEntries(decodeArchive(bytes),sprites,indices);
  const binary=Buffer.from(archive.toArrayBuffer());
  const check=decodeArchive(binary);
  for(const [i,index] of indices.entries()){
    const expected=sprites[['ne','nw','sw','se'][i]].payload;
    const entry=check.entries[index];
    if(!entry||Buffer.compare(Buffer.from(entry.content),Buffer.from(expected))!==0){
      throw Error('Repacked private HQR entry failed round-trip at index '+index);
    }
  }
  await mkdir(dirname(resolve(outputPath)),{recursive:true});
  await writeFile(resolve(outputPath),binary);
  return {outputPath:resolve(outputPath),entryIndices:indices,archiveBytes:binary.byteLength};
}

#!/usr/bin/env node
import {exportOriginalPNG} from './encode.mjs';
const [source,out,...rest]=process.argv.slice(2);
const option=(name,defaultValue)=>{const i=rest.indexOf(name);return i<0?defaultValue:rest[i+1];};
try{
 if(!source||!out)throw Error('Usage: node cli.mjs source.png outdir --id original-asset --creator owner [--kind brick|sprite]');
 const x=await exportOriginalPNG(source,out,{id:option('--id'),creator:option('--creator'),kind:option('--kind','sprite'),offsetX:Number(option('--offset-x','0')),offsetY:Number(option('--offset-y','0'))});
 console.log('Generated local original asset',x.id,'with',x.snappedPixels,'snapped pixels; PUBLIC REVIEW PENDING');
}catch(e){console.error(e.message);process.exitCode=1;}

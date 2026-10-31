#!/usr/bin/env node
/** Build a fail-closed GitHub Pages artifact. It must never include LBA game data. */
import {readFile,writeFile,rm,mkdir,stat} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(new URL('..',import.meta.url).pathname);
const source=join(root,'apps/portfolio');
const output=join(root,'dist');
export const ALLOWED=['index.html','game.mjs','rules.mjs','rooms.mjs'];
const forbidden=/\.(?:exe|hqr|jsdos|iso|vox|fla|rom|dll|bin|zip)$/i;
const unsafeText=/(?:fetch\s*\(\s*['"]https?:|import\s*\(\s*['"]https?:|from\s*['"]https?:|<script[^>]*src\s*=\s*["']https?:|eval\s*\()/i;
const manifest=[];
for(const name of ALLOWED){
 if(forbidden.test(name))throw Error('Forbidden artifact type: '+name);
 const bytes=await readFile(join(source,name));
 const text=bytes.toString('utf8');
 if(unsafeText.test(text))throw Error('Unexpected remote/executable dependency: '+name);
 if(/(?:\.HQR|RELENT\.EXE|lba1_portfolio\.jsdos)/i.test(text))
   throw Error('Original game data reference in public source: '+name);
 manifest.push({name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const total=manifest.reduce((sum,file)=>sum+file.bytes,0);
if(total>500_000)throw Error('J8 static JS/HTML bundle budget exceeded: '+total);
if(!manifest.some(f=>f.name==='index.html'))throw Error('Missing public entrypoint');
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const name of ALLOWED)await writeFile(join(output,name),await readFile(join(source,name)));
console.log('Public-only bundle built: '+ALLOWED.length+' files, '+total+' bytes');
console.log('Original/proprietary game files excluded by explicit allowlist.');
for(const m of manifest)console.log(m.name+' '+m.bytes+'B '+m.sha256.slice(0,12));

import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';import {resolve,join} from 'node:path';
const root=resolve(new URL('../',import.meta.url).pathname);
test('public build emits runtime code and only approved art',async()=>{
 const run=spawnSync(process.execPath,['scripts/build-portfolio.mjs'],{cwd:root,encoding:'utf8'});
 assert.equal(run.status,0,run.stderr||run.stdout);
 assert.deepEqual((await readdir(join(root,'dist'))).sort(),['approved-runtime.mjs','assets','game.mjs','index.html','modules','rooms.mjs','rules.mjs']);
 assert.deepEqual((await readdir(join(root,'dist/modules'))).sort(),['asset-core.mjs','public-manifest.mjs','scene-core.mjs']);
});
test('default artwork catalog is empty instead of shipping fixture art',async()=>{
 const d=JSON.parse(await readFile(join(root,'dist/assets/approved-worlds.json'),'utf8'));
 assert.deepEqual(d.assets,{});assert.deepEqual(d.rooms,{});
});
test('public CSP allows ONLY same-origin manifest and images',async()=>{
 const html=await readFile(join(root,'dist/index.html'),'utf8');
 assert.match(html,/src="\.\/game\.mjs"/);assert.match(html,/connect-src 'self'/);
});
test('published executable source contains no legacy game archives',async()=>{
 for(const file of ['index.html','game.mjs','rooms.mjs','rules.mjs','approved-runtime.mjs',
 'modules/scene-core.mjs','modules/asset-core.mjs','modules/public-manifest.mjs']){
  assert.doesNotMatch(await readFile(join(root,'dist',file),'utf8'),/\.HQR|\.jsdos|RELENT\.EXE/i);
 }
});

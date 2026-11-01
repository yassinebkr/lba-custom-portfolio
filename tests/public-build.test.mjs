import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';import {resolve,join} from 'node:path';
const root=resolve(new URL('../',import.meta.url).pathname);
test('public build emits runtime code and only approved art',async()=>{
 const run=spawnSync(process.execPath,['scripts/build-portfolio.mjs'],{cwd:root,encoding:'utf8'});
 assert.equal(run.status,0,run.stderr||run.stdout);
 assert.deepEqual((await readdir(join(root,'dist'))).sort(),['approved-runtime.mjs','assets','game.mjs','index.html','modules','rooms.mjs','rules.mjs','sprite-demo']);
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

test('standalone sprite demo publishes actual generated PNG and no builder',async()=>{
 const html=await readFile(join(root,'dist/sprite-demo/index.html'),'utf8');
 const atlas=await readFile(join(root,'dist/sprite-demo/telemetry-receiver.png'));
 assert.match(html,/actual output of our Blender/i);
 assert.match(html,/id="dir-ne"/);
 assert.match(html,/id="dir-sw"/);
 assert.equal(atlas.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 assert.ok(atlas.length>1000 && atlas.length<250000);
 assert.equal(atlas.readUInt32BE(16),1024,'actual generated atlas width must be 4 × 256px');
 assert.equal(atlas.readUInt32BE(20),256,'actual generated sprite should be 256px tall');
 const source=await readFile(join(root,'apps/portfolio/sprite-demo/telemetry-receiver.png'));
 assert.deepEqual(atlas,source,'published sprite must be byte-identical to committed pipeline atlas');
 assert.equal((await readdir(join(root,'dist/sprite-demo'))).length,2);
});

test('V6 public comparison is copied from checksum-verified original Blender PNGs only',async()=>{
 const manifest=JSON.parse(await readFile(join(root,'dist/sprite-demo/compare/matrix.json'),'utf8'));
 assert.equal(manifest.candidates.length,24);
 assert.deepEqual(manifest.sharedCrop,[103,35,665,597]);
 const contents=await readdir(join(root,'dist/sprite-demo/compare'));
 assert.equal(contents.length,29,'24 variants, four original sources, one manifest');
 const png=await readFile(join(root,'dist/sprite-demo/compare/256px-lanczos-truecolor.png'));
 assert.equal(png.readUInt32BE(16),1024);
 assert.equal(png.readUInt32BE(20),256);
 const source=await readFile(join(root,'dist/sprite-demo/compare/source-ne.png'));
 assert.equal(source.readUInt32BE(16),768);
 assert.equal(source.readUInt32BE(20),768);
 for(const path of contents)assert.match(path,/^(?:matrix\.json|source-(?:ne|nw|sw|se)\.png|(?:192|224|256)px-(?:lanczos|box)-(?:truecolor|96|160|256)\.png)$/);
 const html=await readFile(join(root,'dist/sprite-demo/compare.html'),'utf8');
 assert.match(html,/id="quantized-canvas"/);
 assert.doesNotMatch(html,/base_game\/|RESS\.HQR|\.glb/i);
});

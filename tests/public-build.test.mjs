import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve,join} from 'node:path';
const root=resolve(new URL('../',import.meta.url).pathname);
test('public release creates only approved original app files',async()=>{
 const run=spawnSync(process.execPath,['scripts/build-portfolio.mjs'],{cwd:root,encoding:'utf8'});
 assert.equal(run.status,0,run.stderr||run.stdout);
 const files=(await readdir(join(root,'dist'))).sort();
 assert.deepEqual(files,['game.mjs','index.html','rooms.mjs','rules.mjs']);
});
test('public HTML remains script-relative and has explicit non-game directory',async()=>{
 const html=await readFile(join(root,'dist/index.html'),'utf8');
 assert.match(html,/src="\.\/game\.mjs"/);
 assert.match(html,/id="directory"/);
 assert.match(html,/id="room-nav"/);
 assert.match(html,/Content-Security-Policy/);
});
test('every public source is original and there is no copied js-dos bundle',async()=>{
 for(const name of ['game.mjs','rules.mjs','rooms.mjs','index.html']){
  const s=await readFile(join(root,'dist',name),'utf8');
  assert.doesNotMatch(s,/\.jsdos|\.HQR|RELENT\.EXE/i);
 }
});

import test from 'node:test';import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';import {resolve} from 'node:path';
const root=resolve(new URL('../',import.meta.url).pathname);
function run(mode){
 const p=spawnSync(process.execPath,['scripts/release-audit.mjs',mode],{cwd:root,encoding:'utf8'});
 return {code:p.status,output:JSON.parse(p.stdout),stderr:p.stderr};
}
test('public technical audit passes and reports UNAPPROVED art clearly',()=>{
 const r=run('--ci');
 assert.equal(r.code,0,r.stderr);
 assert.equal(r.output.approvedAssets,0);
 assert.equal(r.output.originalRooms,0);
 assert.equal(r.output.status,'TECHNICAL_ONLY');
 assert.ok(r.output.pending.some(x=>x.includes('artwork')));
});
test('strict release gate fails until actual approved original art exists',()=>{
 const r=run('--strict');
 assert.equal(r.code,2,r.stderr);
 assert.equal(r.output.mode,'strict');
});
test('release artifact never leaks builders or proprietary game formats',()=>{
 const r=run('--ci');
 assert.ok(r.output.files.every(name=>!/(?:builder|pipeline|\.hqr|\.exe|\.jsdos)/i.test(name)));
 assert.ok(r.output.files.includes('modules/scene-core.mjs'));
 assert.ok(r.output.files.includes('assets/approved-worlds.json'));
});

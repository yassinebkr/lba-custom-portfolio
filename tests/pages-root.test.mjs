import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
test('GitHub Pages branch-root entrypoint points to published interactive experience', async ()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/http-equiv="refresh"/);
 assert.match(html,/\.\/apps\/portfolio\//);
 assert.match(html,/<a href="\.\/apps\/portfolio\/">Enter the portfolio<\/a>/);
});
test('root entrypoint never references original LBA archives',async ()=>{
 const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
 assert.doesNotMatch(html,/\.jsdos|\.hqr|relent\.exe|\.iso/i);
});

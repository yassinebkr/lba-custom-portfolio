import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {validateOutputDirectory} from './cli.mjs';

test('R03 keeps generated DOS outputs outside public source directories',()=>{
  const root=resolve('/tmp/example-world');
  assert.doesNotThrow(()=>validateOutputDirectory(root,resolve(root,'output/private-r03')));
  assert.doesNotThrow(()=>validateOutputDirectory(root,resolve('/tmp/private-r03')));
  assert.throws(()=>validateOutputDirectory(root,root));
  assert.throws(()=>validateOutputDirectory(root,resolve(root,'apps/portfolio/sprite-demo')));
  assert.throws(()=>validateOutputDirectory(root,resolve(root,'web_deploy')));
  assert.throws(()=>validateOutputDirectory(root,resolve(root,'dist')));
});

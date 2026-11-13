import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {decodeSprite,decodeBrick} from '../../packages/asset-core/index.mjs';

test('R03 real V5 radio and V7 scenery produce authentic indexed codec buffers',()=>{
  const out=mkdtempSync(join(tmpdir(),'r03-actual-'));
  try{
    const command=spawnSync(process.execPath,['adapters/lba-dos/cli.mjs',
      'examples/world-package/telemetry.json','--root','.','--target','128','--out',out],
      {cwd:resolve(new URL('../..',import.meta.url).pathname),encoding:'utf8',timeout:120000});
    assert.equal(command.status,0,command.stderr||command.stdout);
    const result=JSON.parse(readFileSync(join(out,'report.json'),'utf8'));
    assert.equal(result.targetPx,128);
    assert.equal(result.sourceFramePx,192);
    assert.deepEqual(result.offsets,{x:-64,y:-127});
    assert.equal(result.runtimeVerification,'pending-private-dos-game-test');
    assert.equal(result.roomGridIntegration,'pending-lba-gri-bll-authoring');
    for(const direction of ['ne','nw','sw','se']){
      const payload=readFileSync(join(out,'sprite-'+direction+'.bin'));
      const restored=decodeSprite(payload);
      assert.deepEqual([restored.width,restored.height],[128,128]);
      assert.ok(new Set(restored.pixels).size>20,'Actual original radio has measurable color variation');
      assert.ok(result.spriteMetrics[direction].alphaThresholdChanges>0,'Legacy alpha threshold loses partial coverage');
    }
    const brick=decodeBrick(readFileSync(join(out,'original-scene-brick.bin')));
    assert.deepEqual([brick.width,brick.height],[128,85]);
    assert.equal(readFileSync(join(out,'palette.rgb')).byteLength,768);
    assert.equal(readdirSync(out).filter(p=>p.endsWith('.HQR')).length,0);
  }finally{rmSync(out,{recursive:true,force:true});}
});

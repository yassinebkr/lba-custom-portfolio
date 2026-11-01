import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {compileApproved} from './compile-approved.mjs';
const onePixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO96Zp4AAAAASUVORK5CYII=','base64');
const original={origin:'original-art',creator:'project-owner',license:'original',
 reviewStatus:'approved',allowedForPublicBuild:true};
async function sample(root,approved=true){
 const sources=join(root,'generated');await mkdir(join(sources,'atlases'),{recursive:true});
 await writeFile(join(sources,'atlases','bench.png'),onePixel);
 const asset={id:'bench',kind:'furniture',atlasRef:'atlases/bench.png',pivot:{x:0,y:0},
  source:{...original,reviewStatus:approved?'approved':'pending',allowedForPublicBuild:approved},
  frames:[{action:'idle',direction:'SE',durationMs:150,rect:[0,0,1,1]}]};
 const src=join(sources,'assets.json');
 await writeFile(src,JSON.stringify({schemaVersion:1,assets:[asset]}));
 const scenes=join(root,'scenes.json');
 await writeFile(scenes,JSON.stringify({schemaVersion:1,scenes:[
  {id:'showroom',width:10,depth:10,instances:[{id:'bench1',assetId:'bench',x:2,z:3}]},
  {id:'electronics',width:10,depth:10,instances:[{id:'bench2',assetId:'bench',x:5,z:4}]}
 ]}));
 return {src,scenes};
}
test('approved source→manifest→independent rooms→public atlas completes in one command',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'approved-compiler-'));
 try{
  const {src,scenes}=await sample(dir,true),out=join(dir,'dist-assets');
  const result=await compileApproved(src,scenes,out);
  assert.deepEqual([result.assets,result.rooms],[1,2]);
  const catalog=JSON.parse(await readFile(join(out,'approved-worlds.json'),'utf8'));
  assert.equal(catalog.assets.bench.frames[0].direction,'se');
  assert.equal(catalog.rooms.showroom.scene.instances[0].y,0);
  assert.deepEqual(await readFile(join(out,'atlases','bench.png')),onePixel);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('unreviewed source cannot reach public asset folder',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'unapproved-compiler-'));
 try{
  const {src,scenes}=await sample(dir,false),out=join(dir,'dist-assets');
  await assert.rejects(()=>compileApproved(src,scenes,out),/not passed explicit/);
  await assert.rejects(()=>readFile(join(out,'approved-worlds.json')));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('unknown scene refs fail without copying or writing published catalog',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bad-scene-'));
 try{
  const {src,scenes}=await sample(dir,true),out=join(dir,'dist-assets');
  const bad=JSON.parse(await readFile(scenes,'utf8'));
  bad.scenes[1].instances[0].assetId='copied-game-art';
  await writeFile(scenes,JSON.stringify(bad));
  await assert.rejects(()=>compileApproved(src,scenes,out),/Unknown original scene asset/);
  await assert.rejects(()=>readFile(join(out,'approved-worlds.json')));
 }finally{await rm(dir,{recursive:true,force:true});}
});

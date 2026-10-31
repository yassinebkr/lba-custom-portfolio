import test from 'node:test';
import assert from 'node:assert/strict';
import {scene,newGame,move,inspect,nearest,blocked,inside,validate} from './rules.mjs';
test('original fixture validates',()=>assert.equal(validate(scene),true));
test('starting tile is available',()=>assert.equal(blocked(scene,scene.start.x,scene.start.z),false));
test('movement rejects diagonal and fractional steps',()=>{
 const game=newGame();assert.equal(move(game,1,1),false);assert.equal(move(game,0.5,0),false);
 assert.equal(game.moves,0);
});
test('movement respects boundaries',()=>{
 const game=newGame();game.player={x:0,z:0};
 assert.equal(move(game,-1,0),false);assert.equal(move(game,0,-1),false);
 assert.equal(inside(scene,scene.width,1),false);
});
test('collision blocks exhibits',()=>{
 const game=newGame();game.player={x:2,z:3};
 assert.equal(move(game,0,-1),false);assert.deepEqual(game.player,{x:2,z:3});
});
test('valid movement updates coordinates',()=>{
 const game=newGame();assert.equal(move(game,0,-1),true);
 assert.deepEqual(game.player,{x:5,z:7});assert.equal(game.moves,1);
});
test('interaction requires proximity and exists only for known assets',()=>{
 const game=newGame();assert.equal(inspect(game,'cinepi'),null);
 game.player={x:2,z:3};
 assert.equal(nearest(game).id,'cinepi');assert.equal(inspect(game,'cinepi').id,'cinepi');
 assert.equal(inspect(game,'fake'),null);
});
test('invalid source URL and overlapping entries are rejected',()=>{
 const bad=structuredClone(scene);bad.projects[0].url='javascript:alert(1)';
 assert.throws(()=>validate(bad));
 const bad2=structuredClone(scene);bad2.projects[1].x=bad2.projects[0].x;bad2.projects[1].z=bad2.projects[0].z;
 assert.throws(()=>validate(bad2));
});

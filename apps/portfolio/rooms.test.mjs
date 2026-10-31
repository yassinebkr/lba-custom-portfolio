import test from 'node:test';import assert from 'node:assert/strict';
import {ROOMS,roomById} from './rooms.mjs';import {validate as validateScene,newGame,nearest} from './rules.mjs';
test('six original linked rooms are individually playable',()=>{
 assert.equal(ROOMS.length,6);
 assert.equal(new Set(ROOMS.map(r=>r.id)).size,6);
 for(const r of ROOMS){assert.equal(validateScene(r),true);assert.equal(r.projects.length,4);assert.ok(newGame(r).player);}
});
test('room lookup rejects unknown IDs',()=>{
 assert.equal(roomById('not-a-room'),null);
 assert.equal(roomById('origin').name,'Origin / Introduction');
});
test('individual exhibits remain reachable and named',()=>{
 for(const room of ROOMS){
  const ids=new Set(room.projects.map(p=>p.id));assert.equal(ids.size,room.projects.length);
  const game=newGame(room);const p=room.projects[0];game.player={x:p.x,z:p.z+1};
  assert.equal(nearest(game).id,p.id);
 }
});
test('all outgoing links use HTTPS GitHub',()=>{
 for(const r of ROOMS)for(const p of r.projects)if(p.url)assert.match(p.url,/^https:\/\/github\.com\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_.-]+)?\/?$/);
});

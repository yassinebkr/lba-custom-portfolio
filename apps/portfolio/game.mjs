import {loadApprovedWorld} from './approved-runtime.mjs';
import {scene,newGame,move,nearest,inspect} from './rules.mjs';
import {ROOMS} from './rooms.mjs';
let game=newGame(ROOMS[0]);let approvedWorld=null;let playerFacing='se';
const canvas=document.getElementById('game'),ctx=canvas.getContext('2d');
const info=document.getElementById('info'),msg=document.getElementById('status');
const list=document.getElementById('list');
const tw=62,th=31;
const pos=(x,z)=>({x:480+(x-z)*tw/2,y:110+(x+z)*th/2});
function polygon(points,fill,stroke){
 ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);
 for(const p of points.slice(1))ctx.lineTo(p[0],p[1]);
 ctx.closePath();ctx.fillStyle=fill;ctx.fill();
 if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
}
function tile(x,y,fill){polygon([[x,y-th/2],[x+tw/2,y],[x,y+th/2],[x-tw/2,y]],fill,'#3f5861');}
function station(p){
 const q=pos(p.x,p.z),x=q.x,y=q.y;
 const selected=p.id===game.active,near=nearest(game)?.id===p.id;
 if(selected||near){ctx.strokeStyle=selected?'#fff0b3':'#7fe5d1';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(x,y+7,37,16,0,0,7);ctx.stroke();}
 polygon([[x-23,y-24],[x,y-12],[x,y+10],[x-23,y-2]],'#506372');
 polygon([[x,y-12],[x+23,y-24],[x+23,y-2],[x,y+10]],'#293946');
 polygon([[x-23,y-24],[x,y-36],[x+23,y-24],[x,y-12]],'#c7a47b','#e8c79d');
 if((p.kind||p.id)==='antenna'||p.id==='lora'){
  ctx.strokeStyle='#a6e5df';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,y-35);ctx.lineTo(x,y-82);ctx.stroke();
  ctx.fillStyle='#d7e9d9';ctx.fillRect(x-8,y-66,16,6);
 }else if((p.kind||p.id)==='camera'||p.id==='cinepi'){
  ctx.fillStyle='#293848';ctx.fillRect(x-11,y-54,22,15);
  ctx.fillStyle='#83e7d7';ctx.beginPath();ctx.arc(x+7,y-47,6,0,7);ctx.fill();
 }else{
  ctx.fillStyle='#152d35';ctx.fillRect(x-16,y-65,32,25);
  ctx.strokeStyle='#76dcce';ctx.strokeRect(x-16,y-65,32,25);
  ctx.fillStyle=(p.kind==='character'||p.id==='bigbrain')?'#b4b0ff':'#8de9dc';ctx.fillRect(x-8,y-57,17,4);
 }
 ctx.font='600 14px system-ui';ctx.textAlign='center';ctx.fillStyle='#e9f2f0';
 ctx.fillText(p.label,x,y-92);
}
function player(){
 const q=pos(game.player.x,game.player.z);
 ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.ellipse(q.x,q.y+7,13,6,0,0,7);ctx.fill();
 ctx.fillStyle='#6adbc8';ctx.fillRect(q.x-9,q.y-27,18,29);
 ctx.fillStyle='#e3bf9b';ctx.beginPath();ctx.arc(q.x,q.y-34,9,0,7);ctx.fill();
 ctx.fillStyle='#293d49';ctx.fillRect(q.x-7,q.y-41,14,5);
}
function render(){
 if(approvedWorld&&approvedWorld.roomId===game.map.id){
  ctx.fillStyle='#101e29';ctx.fillRect(0,0,canvas.width,canvas.height);
  approvedWorld.paint(ctx,game.player,performance.now(),playerFacing);return;
 }
 ctx.fillStyle='#101e29';ctx.fillRect(0,0,canvas.width,canvas.height);
 for(let depth=0;depth<game.map.width+game.map.depth-1;depth++)
  for(let x=0;x<game.map.width;x++){const z=depth-x;if(z<0||z>=game.map.depth)continue;
    const q=pos(x,z);const edge=x===0||z===0||x===game.map.width-1||z===game.map.depth-1;
    tile(q.x,q.y,edge?'#3a515d':(x+z)%2?'#304650':'#364d56');
  }
 const elements=game.map.projects.map(p=>({depth:p.x+p.z,item:p})).concat({depth:game.player.x+game.player.z,item:null});
 elements.sort((a,b)=>a.depth-b.depth);
 for(const el of elements)el.item?station(el.item):player();
 ctx.fillStyle='#9cb4bc';ctx.textAlign='left';ctx.font='12px system-ui';
 ctx.fillText('PROJECT ATLAS  /  ROOM 01',22,30);
}
function show(p){
 game.active=p.id;info.replaceChildren();
 const eyebrow=document.createElement('p');eyebrow.className='eyebrow';eyebrow.textContent=p.category;
 const title=document.createElement('h2');title.textContent=p.label;
 const description=document.createElement('p');description.textContent=p.description;
 info.append(eyebrow,title,description);
 if(p.url){const link=document.createElement('a');link.href=p.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='View project source ↗';link.className='project-link';info.append(link);}
 msg.textContent='Viewing '+p.label;
 Array.from(list.children).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===p.id)));
 render();
}
function navigate(dx,dz){
 if(move(game,dx,dz)){playerFacing=dx>0?'se':dx<0?'nw':dz>0?'sw':'ne';const near=nearest(game);msg.textContent=near?'Near '+near.label+' — press E to inspect.':'Move toward an exhibit.';render();}
 else msg.textContent='Blocked: try another direction.';
}
function interact(){const near=nearest(game);if(near){inspect(game,near.id);show(near);}else msg.textContent='Move closer to an exhibit.';}
function populateList(){
 list.replaceChildren();
 for(const p of game.map.projects){
  const button=document.createElement('button');button.type='button';button.dataset.id=p.id;button.className='project';
  button.setAttribute('aria-pressed','false');button.textContent=p.label+' · '+p.category;
  button.addEventListener('click',()=>show(p));list.append(button);
 }
}
const nav=document.getElementById('room-nav');
const roomLabel=document.querySelector('.stage .bar');
function openRoom(room){
 game=newGame(room);approvedWorld=null;playerFacing='se';
 info.replaceChildren();
 const heading=document.createElement('p');heading.className='eyebrow';heading.textContent='ROOM INTRODUCTION';
 const title=document.createElement('h2');title.textContent=room.name;
 const body=document.createElement('p');body.textContent='Explore the stations or choose a project in the directory below.';
 const note=document.createElement('small');note.textContent='Original, locally-rendered scene. No download required.';
 info.append(heading,title,body,note);
 msg.textContent='Room changed: '+room.name;
 roomLabel.textContent='● '+room.name.toUpperCase()+' · ORIGINAL WORLD';
 document.documentElement.style.setProperty('--room-accent',room.accent||'#85e8d6');
 populateList();
 Array.from(nav.children).forEach(button=>button.setAttribute('aria-current',
  button.dataset.room===room.id?'page':'false'));
 render();
 loadApprovedWorld(room.id).then(world=>{
  if(game.map.id===room.id){approvedWorld=world;render();}
 }).catch(error=>console.warn('Using prototype fallback:',error.message));
}
for(const [index,room] of ROOMS.entries()){
 const button=document.createElement('button');button.type='button';button.dataset.room=room.id;
 button.className='room-button';button.textContent=(index+1).toString().padStart(2,'0')+'  '+room.name;
 button.setAttribute('aria-current','false');
 button.addEventListener('click',()=>openRoom(room));nav.append(button);
}
openRoom(ROOMS[0]);
const moves={ArrowUp:[0,-1],w:[0,-1],ArrowDown:[0,1],s:[0,1],ArrowLeft:[-1,0],a:[-1,0],ArrowRight:[1,0],d:[1,0]};
window.addEventListener('keydown',e=>{
 if(e.altKey||e.ctrlKey||e.metaKey||['INPUT','TEXTAREA'].includes(e.target.tagName))return;
 const direction=moves[e.key.toLowerCase()]||moves[e.key];
 if(direction){e.preventDefault();navigate(...direction);}
 else if(e.key==='e'||e.key==='E'){e.preventDefault();interact();}
 else if(e.key==='Escape'){game.active=null;msg.textContent='Selection cleared.';render();}
});
document.querySelectorAll('[data-direction]').forEach(b=>b.addEventListener('click',()=>navigate(...moves[b.dataset.direction])));
document.getElementById('interact').addEventListener('click',interact);
render();

window.setInterval(()=>{if(approvedWorld&&document.visibilityState==='visible')render();},150);

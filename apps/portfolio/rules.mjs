/** Original, framework-independent J1 scene rules. */
export const scene = {
  width: 10, depth: 10, start: {x:5,z:8},
  projects: [
    {id:'cinepi',x:2,z:2,label:'CinePi',category:'ELECTRONICS / CINEMA',
     description:'An experimental RAW cinema camera built using Raspberry Pi hardware and an open image-processing pipeline.',
     url:'https://github.com/yassinebkr/cinematepi5'},
    {id:'lora',x:7,z:2,label:'Long-range LoRa',category:'EMBEDDED / TELEMETRY',
     description:'Radio, navigation and embedded telemetry experiments, including field-tested long-distance LoRa links.',url:null},
    {id:'bigbrain',x:2,z:7,label:'BigBrain',category:'AI / INTERFACE DESIGN',
     description:'A multi-agent workspace exploring intuitive, adaptive and evidence-driven interfaces.',url:null},
    {id:'shellfolio',x:7,z:7,label:'ShellFolio',category:'OPEN SOURCE / WEB',
     description:'An interactive terminal-inspired portfolio built around accessible animated command-line experiences.',
     url:'https://github.com/yassinebkr/ShellFolio'}
  ]
};
export function inside(map,x,z){return Number.isInteger(x)&&Number.isInteger(z)&&x>=0&&z>=0&&x<map.width&&z<map.depth;}
export function blocked(map,x,z){return !inside(map,x,z)||map.projects.some(p=>p.x===x&&p.z===z);}
export function validate(map){
  if(!map||!Number.isInteger(map.width)||!Number.isInteger(map.depth)||!Array.isArray(map.projects)
    ||map.width<3||map.depth<3||!map.start||blocked(map,map.start.x,map.start.z))throw Error('Invalid scene');
  const ids=new Set(),cells=new Set();
  for(const p of map.projects){
    const pos=p.x+':'+p.z;
    if(!p.id||ids.has(p.id)||cells.has(pos)||!inside(map,p.x,p.z)||!p.label||!p.description||
      (p.url!==null&&!/^https:\/\/github\.com\/[a-z0-9_-]+(?:\/[a-z0-9_.-]+)?\/?$/i.test(p.url)))throw Error('Invalid project');
    ids.add(p.id);cells.add(pos);
  }
  return true;
}
export function newGame(map=scene){validate(map);return{map,player:{...map.start},active:null,moves:0};}
export function move(game,dx,dz){
  if(!Number.isInteger(dx)||!Number.isInteger(dz)||Math.abs(dx)+Math.abs(dz)!==1)return false;
  const x=game.player.x+dx,z=game.player.z+dz;
  if(blocked(game.map,x,z))return false;
  game.player={x,z};game.active=null;game.moves++;return true;
}
export function nearest(game,maxDist=2){
  return game.map.projects.map(p=>({...p,distance:Math.abs(p.x-game.player.x)+Math.abs(p.z-game.player.z)}))
    .filter(p=>p.distance<=maxDist).sort((a,b)=>a.distance-b.distance)[0]||null;
}
export function inspect(game,id){
  const p=game.map.projects.find(p=>p.id===id);
  if(!p||Math.abs(p.x-game.player.x)+Math.abs(p.z-game.player.z)>2)return null;
  game.active=id;return p;
}

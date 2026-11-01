/** V7: actual original Blender background + V5 sprite + physically rendered desk lip.
 * Does NOT add unapproved assets to the six public rooms. This is QA only.
 */
const $=id=>document.getElementById(id);
const canvas=$("scene"),ctx=canvas.getContext("2d",{alpha:true});
const directions=["ne","nw","sw","se"],imgs=new Map();
let layout=null,ready=false,offset={x:0,y:0},dragging=null,inspected=false;
function image(path){
 if(!imgs.has(path))imgs.set(path,new Promise((resolve,reject)=>{
  const img=new Image();img.onload=()=>resolve(img);
  img.onerror=()=>reject(new Error("Missing original scene render: "+path));
  img.src=path;
 }));
 return imgs.get(path);
}
function state(){
 return {dir:$("view").value,palette:$("variant").value,
  scale:Number($("size").value)/100,occlude:$("occlusion").checked,
  shadow:$("shadow").checked,anchor:$("anchor").checked};
}
const radioPath=()=> "./compare/256px-lanczos-"+state().palette+".png";
const getBox=()=>{
 const scale=state().scale*256;
 const x=layout.anchor[0]+offset.x-scale/2;
 const y=layout.anchor[1]+offset.y-scale*.84;
 return {x,y,w:scale,h:scale};
};
function inspectCopy(){
 const mode=state().palette==="160"?"160-color indexed":"RGBA truecolor";
 const b=getBox();
 $("size-out").textContent=Math.round(state().scale*100)+"%";
 $("scene-status").textContent="NEUTRAL QA / "+state().dir.toUpperCase()+" / "+mode;
 if(inspected){
  $("inspection-title").textContent="Telemetry receiver · selected";
  $("inspection-copy").textContent="Exact V5 "+mode+" sprite on the original Blender workbench. Frame "+state().dir.toUpperCase()+", "+Math.round(b.w)+" px on the 960px scene canvas. Compare light direction, desk contact and edge occlusion.";
 }else{
  $("inspection-title").textContent="In-scene fidelity";
  $("inspection-copy").textContent="Drag the instrument on the tabletop or change the controls to check scale, placement, palette and lighting. Select Inspect receiver for details.";
 }
}
async function render(){
 if(!ready)return;
 const cfg=state();
 const [background,foreground,sprite]=await Promise.all([
  image("./scene/background.png"),image("./scene/foreground.png"),image(radioPath())
 ]);
 if(!ready)return;
 canvas.width=layout.width;canvas.height=layout.height;
 ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.drawImage(background,0,0,canvas.width,canvas.height);
 const b=getBox();
 if(cfg.shadow){
  ctx.save();ctx.filter="blur(11px)";ctx.fillStyle="rgba(3,12,16,.32)";
  ctx.beginPath();ctx.ellipse(layout.anchor[0]+offset.x,layout.anchor[1]+offset.y+1,49*cfg.scale,16*cfg.scale,-.10,0,Math.PI*2);
  ctx.fill();ctx.restore();
 }
 const i=directions.indexOf(cfg.dir);
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
 ctx.drawImage(sprite,i*256,0,256,256,b.x,b.y,b.w,b.h);
 if(cfg.occlude)ctx.drawImage(foreground,0,0,canvas.width,canvas.height);
 if(cfg.anchor){
  const px=layout.anchor[0]+offset.x,py=layout.anchor[1]+offset.y;
  ctx.save();ctx.strokeStyle="#f7dc95";ctx.lineWidth=2;ctx.beginPath();
  ctx.moveTo(px-12,py);ctx.lineTo(px+12,py);ctx.moveTo(px,py-12);ctx.lineTo(px,py+12);ctx.stroke();ctx.restore();
 }
 if(inspected){
  ctx.save();ctx.strokeStyle="#b8f1e8";ctx.lineWidth=1.5;ctx.setLineDash([5,5]);
  ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.restore();
 }
 canvas.dataset.rendered=cfg.dir+"-"+cfg.palette;
 inspectCopy();
}
let serial=0;
async function refresh(){
 if(!ready)return;
 const token=++serial;
 try{
  await image(radioPath());
  if(token!==serial)return;
  await render();
 }catch(err){$("scene-status").textContent="Image error";$("inspection-copy").textContent=err.message;console.error(err)}
}
for(const id of ["view","variant","size","occlusion","shadow","anchor"]){
 $(id).addEventListener(id==="size"?"input":"change",refresh);
}
$("inspect").addEventListener("click",()=>{inspected=!inspected;refresh();});
$("reset").addEventListener("click",()=>{
 offset={x:0,y:0};inspected=false;
 $("view").value="ne";$("variant").value="160";$("size").value="75";
 $("occlusion").checked=true;$("shadow").checked=true;$("anchor").checked=false;
 refresh();
});
function point(event){
 const r=canvas.getBoundingClientRect();
 return {x:(event.clientX-r.left)/r.width*canvas.width,y:(event.clientY-r.top)/r.height*canvas.height};
}
canvas.addEventListener("pointerdown",event=>{
 if(!ready)return;
 const p=point(event),b=getBox();
 if(p.x<b.x||p.x>b.x+b.w||p.y<b.y||p.y>b.y+b.h)return;
 dragging={id:event.pointerId,start:p,original:{...offset}};
 canvas.setPointerCapture(event.pointerId);canvas.classList.add("dragging");
});
canvas.addEventListener("pointermove",event=>{
 if(!dragging||event.pointerId!==dragging.id)return;
 const p=point(event);
 offset.x=Math.max(-80,Math.min(80,dragging.original.x+p.x-dragging.start.x));
 offset.y=Math.max(-36,Math.min(36,dragging.original.y+p.y-dragging.start.y));
 refresh();
});
function release(event){
 if(!dragging||event.pointerId!==dragging.id)return;
 dragging=null;canvas.classList.remove("dragging");
 if(canvas.hasPointerCapture(event.pointerId))canvas.releasePointerCapture(event.pointerId);
}
canvas.addEventListener("pointerup",release);canvas.addEventListener("pointercancel",release);
window.addEventListener("keydown",event=>{
 if(!ready||event.ctrlKey||event.altKey||event.metaKey||["INPUT","SELECT","TEXTAREA","BUTTON"].includes(document.activeElement?.tagName))return;
 const key=event.key.toLowerCase();
 const movements={arrowleft:[-7,0],a:[-7,0],arrowright:[7,0],d:[7,0],arrowup:[0,-5],w:[0,-5],arrowdown:[0,5],s:[0,5]};
 if(movements[key]){
  event.preventDefault();offset.x=Math.max(-80,Math.min(80,offset.x+movements[key][0]));
  offset.y=Math.max(-36,Math.min(36,offset.y+movements[key][1]));refresh();
 }else if(key==="r")$("reset").click();
});
try{
 const response=await fetch("./scene/layout.json");
 if(!response.ok)throw Error("Original Blender scene manifest unavailable");
 const meta=await response.json();
 if(meta.schemaVersion!==1||meta.approvedForPortfolio!==false||meta.width!==960||meta.height!==640||
  !Array.isArray(meta.anchor)||meta.anchor.length!==2)throw Error("Original scene validation failed");
 layout=meta;
 await Promise.all([image("./scene/background.png"),image("./scene/foreground.png"),image(radioPath())]);
 ready=true;$("scene-loading").hidden=true;
 await render();
}catch(err){$("scene-loading").textContent="Cannot load V7 original render: "+err.message;console.error(err)}

/** V6: actual source/truecolor/palette frames, never synthetic replacements. */
const el=id=>document.getElementById(id);
const directions=["ne","nw","sw","se"];
const cache=new Map();
let matrix=null,epoch=0;
function imageFor(path){
 if(!cache.has(path))cache.set(path,new Promise((resolve,reject)=>{
   const img=new Image();
   img.onload=()=>resolve(img);
   img.onerror=()=>reject(Error("Missing original pipeline image: "+path));
   img.src=path;
 }));
 return cache.get(path);
}
function draw(id,img,rect,size,zoom){
 const c=el(id);c.width=size;c.height=size;
 const ctx=c.getContext("2d");ctx.clearRect(0,0,size,size);
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality="high";
 ctx.drawImage(img,rect[0],rect[1],rect[2],rect[3],0,0,size,size);
 c.style.width=String(size*zoom)+"px";
 c.style.height=String(size*zoom)+"px";
 c.dataset.frameSize=String(size);
}
async function update(){
 if(!matrix)return;
 const token=++epoch,dir=el("direction").value,size=Number(el("resolution").value);
 const filter=el("filter").value,palette=el("palette").value,zoom=Number(el("zoom").value);
 const a=matrix.candidates.find(v=>v.size===size&&v.downscale===filter&&String(v.palette)===palette);
 const b=matrix.candidates.find(v=>v.size===size&&v.downscale===filter&&v.palette==="truecolor");
 if(!a||!b)throw Error("Selected variant is absent from the verified V5 matrix");
 el("status").textContent="Loading original V5 images…";
 const images=await Promise.all([
  imageFor("./compare/source-"+dir+".png"),
  imageFor("./compare/"+b.file),
  imageFor("./compare/"+a.file)
 ]);
 if(token!==epoch)return;
 const ix=directions.indexOf(dir),crop=matrix.sharedCrop,rect=[ix*size,0,size,size];
 draw("source-canvas",images[0],[crop[0],crop[1],crop[2]-crop[0],crop[3]-crop[1]],size,zoom);
 draw("truecolor-canvas",images[1],rect,size,zoom);
 draw("quantized-canvas",images[2],rect,size,zoom);
 el("source-details").textContent="Original "+matrix.inputFrameSize.join(" × ")+" px · same crop for all views";
 el("truecolor-details").textContent=size+"px · "+filter+" · RGBA · "+(b.bytes/1024).toFixed(1)+" KiB atlas";
 el("quantized-details").textContent=size+"px · "+(palette==="truecolor"?"RGBA":palette+" colors")+" · "+(a.bytes/1024).toFixed(1)+" KiB atlas";
 el("rmse-dark").textContent=a.dark_rmse.toFixed(3);
 el("rmse-light").textContent=a.light_rmse.toFixed(3);
 el("alpha-levels").textContent=String(a.alpha_levels);
 el("file-size").textContent=(a.bytes/1024).toFixed(1)+" KiB";
 el("status").textContent="Real render · "+dir.toUpperCase()+" · "+size+"px · "+filter+" · "+palette;
 document.body.dataset.rendered=a.file;
}
for(const id of ["direction","resolution","filter","palette","zoom","background","crisp"]){
 el(id).addEventListener("change",()=>{
  if(id==="background"){document.body.dataset.background=el(id).value;return;}
  if(id==="crisp"){document.body.classList.toggle("crisp",el(id).checked);return;}
  update().catch(err=>{el("status").textContent=err.message;console.error(err);});
 });
}
try{
 const response=await fetch("./compare/matrix.json",{cache:"no-cache"});
 if(!response.ok)throw Error("V5 evidence unavailable: HTTP "+response.status);
 const doc=await response.json();
 if(doc.schemaVersion!==1||!Array.isArray(doc.candidates)||doc.candidates.length!==24||
 !Array.isArray(doc.sharedCrop)||doc.sharedCrop.length!==4||
 directions.some(dir=>!doc.directions.includes(dir)))throw Error("Unexpected V5 evidence catalog");
 matrix=doc;
 await update();
}catch(err){el("status").textContent="Could not load V5 evidence: "+err.message;console.error(err);}

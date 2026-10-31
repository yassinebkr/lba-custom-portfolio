import React,{useEffect,useMemo,useRef,useState} from 'react';
import {PanelsTopLeft,Boxes,Layers3,Clapperboard,Search,Save,Play,Pause,Undo2,Redo2,Download,Upload,Plus,Trash2,
  MousePointer2,Grid2X2,Eye,ChevronDown,ChevronRight,Check,AlertTriangle,Maximize,RotateCw,Move,Copy,Info,
  Camera,Armchair,Monitor,Leaf,DoorOpen,UserRound,RadioTower,SlidersHorizontal} from 'lucide-react';
import {ASSETS,INITIAL,findAsset,type SceneData,type Instance,type AssetKind} from './model';
import {ORIGINAL_SCENES,findScene} from './scenes';
import {createClip,validateClip,type AnimationClip} from '../../../packages/game-core/animation.mjs';
import {validateSceneDocument,validateAssetCatalog} from '../../../packages/asset-schema/index.mjs';
import './styles.css';

const VIEW_W=920,VIEW_H=540,TW=56,TH=28;
const project=(x:number,z:number)=>({x:VIEW_W/2+(x-z)*TW/2,y:105+(x+z)*TH/2});
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
const closestTile=(px:number,py:number,w:number,d:number)=>{
 const u=(px-VIEW_W/2)/(TW/2),v=(py-105)/(TH/2);
 return{x:clamp(Math.round((u+v)/2),0,w-1),z:clamp(Math.round((v-u)/2),0,d-1)};
};
const id=()=>String(Date.now())+'-'+Math.random().toString(36).slice(2,8);
type Tool='select'|'place';
function assetIcon(kind:AssetKind){return kind==='character'?<UserRound size={17}/>:kind==='furniture'?<Armchair size={17}/>:kind==='structure'?<DoorOpen size={17}/>:<Boxes size={17}/>;}
function Shape({assetId,active,frame=0}:{assetId:string;active?:boolean;frame?:number}){
 const asset=findAsset(assetId);
 const color=asset?.color||'#879fac';
 return <g>
  <ellipse cx="0" cy="12" rx="20" ry="8" fill="#0b1720" opacity=".48"/>
  <path d="M-20 -9 L0 1 L20 -9 L0 -19Z" fill={color} stroke="#dce6dc" strokeWidth=".8"/>
  <path d="M-20 -9 L0 1 L0 17 L-20 7Z" fill="#526572" stroke="#8099a1" strokeWidth=".6"/>
  <path d="M0 1 L20 -9 L20 7 L0 17Z" fill="#304451" stroke="#66838e" strokeWidth=".6"/>
  {assetId==='monitor'&& <g><rect x="-14" y="-43" width="28" height="26" rx="2" fill="#101e2b" stroke="#9eb8c6"/><rect x="-11" y="-40" width="22" height="18" fill={frame%2?'#2a778b':'#409ba7'}/><path d="M-7 -28h14" stroke="#b6f9de" strokeWidth="2"/></g>}
  {assetId==='camera'&&<g><rect x="-14" y="-33" width="29" height="18" rx="3" fill="#182632" stroke="#a8c6c9"/><circle cx="9" cy="-24" r="8" fill="#83ccc2" stroke="#d4efec" strokeWidth="2"/></g>}
  {assetId==='plant'&&<g><path d="M0 -16V-41M0 -29L-13 -41M0 -33L11 -48" stroke="#92c9a5" strokeWidth="3"/><ellipse cx="-13" cy="-41" rx="9" ry="5" fill="#88bc91"/><ellipse cx="11" cy="-48" rx="10" ry="5" fill="#6fa383"/></g>}
  {assetId==='antenna'&&<g><path d="M0 -19V-65" stroke="#bddadd" strokeWidth="3"/><path d="M-12 -46h24" stroke="#bddadd" strokeWidth="2"/><circle cx="0" cy="-65" r={frame%2?5:3} fill="#97eddf"/></g>}
  {assetId==='maker'&&<g><rect x="-10" y="-39" width="20" height="29" fill="#8cb8cd" rx="4"/><circle cx="0" cy="-46" r="10" fill="#e6bb91"/><path d="M-8 -50h16" stroke="#324b57" strokeWidth="4"/></g>}
  {assetId==='door'&&<g><path d="M-21 -16V-72L0 -83L21 -72V-16" stroke={color} strokeWidth="7" fill="none"/><path d={frame>=2?'M-15 -67L2 -57V-19L-15 -30Z':'M-15 -67L10 -65V-23L-15 -30Z'} fill="#6c8d94" stroke="#b9aa93"/></g>}
  {active&&<><path d="M-28 20H28M-28 -19V20M28 -19V20" stroke="#8af0db" strokeWidth="1.4" strokeDasharray="4 3" fill="none"/><circle cx="0" cy="17" r="3" fill="#8af0db"/></>}
 </g>;
}
function safeLoad(sceneId:string):SceneData{
 const baseline=findScene(sceneId);
 try{
   const raw=localStorage.getItem('atlas.studio.scene.'+sceneId);
   if(!raw)return structuredClone(baseline);
   const parsed:unknown=JSON.parse(raw);
   const issues=validateSceneDocument(parsed,new Set(ASSETS.map(a=>a.id)));
   if(issues.length||!parsed||typeof parsed!=='object'||(parsed as SceneData).id!==sceneId)
     return structuredClone(baseline);
   return parsed as SceneData;
 }catch{return structuredClone(baseline);}
}
export default function App(){
 const[scene,setScene]=useState<SceneData>(()=>safeLoad(INITIAL.id));
 const[history,setHistory]=useState<SceneData[]>([]),[future,setFuture]=useState<SceneData[]>([]);
 const[selection,setSelection]=useState<string|null>('obj-2');
 const[tool,setTool]=useState<Tool>('select');
 const[assetId,setAssetId]=useState('camera');
 const[filter,setFilter]=useState<AssetKind|'all'>('all');
 const[search,setSearch]=useState('');
 const[grid,setGrid]=useState(true),[colliders,setColliders]=useState(false);
 const[playing,setPlaying]=useState(false),[frame,setFrame]=useState(0);
 const[zoom,setZoom]=useState(1);
 const[notice,setNotice]=useState('Ready to edit');
 const[selectedTab,setSelectedTab]=useState<'props'|'animation'>('props');
 const fileInput=useRef<HTMLInputElement>(null);
 const selected=scene.instances.find(i=>i.id===selection)||null;
 const selectedAsset=selected?findAsset(selected.assetId):null;
 const[clips,setClips]=useState<Record<string,AnimationClip>>(()=>{
  try{const stored=JSON.parse(localStorage.getItem('atlas.studio.clips.v1')||'{}') as Record<string,AnimationClip>;
   return Object.fromEntries(ASSETS.map(a=>[a.id,stored[a.id]&&validateClip(stored[a.id]).length===0?stored[a.id]:createClip(a.id,a.frameCount)]));
  }catch{return Object.fromEntries(ASSETS.map(a=>[a.id,createClip(a.id,a.frameCount)]));}
 });
 const clip=selectedAsset?clips[selectedAsset.id]:null;
 const catalog=useMemo(()=>ASSETS.filter(a=>(filter==='all'||a.kind===filter)&&
 (a.name+' '+a.category).toLowerCase().includes(search.toLowerCase())),[filter,search]);
 const dirty=history.length>0;
 useEffect(()=>{
   if(!playing||!clip||clip.frames.length<=1)return;
   const timer=window.setTimeout(()=>setFrame(f=>(f+1)%clip.frames.length),clip.frames[frame%clip.frames.length]?.durationMs||160);
   return()=>window.clearTimeout(timer);
 },[playing,clip,frame]);
 const editClip=(next:AnimationClip)=>{
   const errors=validateClip(next);
   if(errors.length){setNotice('Invalid animation: '+errors[0]);return;}
   if(!selectedAsset)return;
   setClips(all=>({...all,[selectedAsset.id]:next}));
   setPlaying(false);setFrame(f=>Math.min(f,next.frames.length-1));setNotice('Unsaved animation edit');
 };
 const saveClips=()=>{
   if(Object.values(clips).some(c=>validateClip(c).length>0)){setNotice('Invalid animation data');return;}
   localStorage.setItem('atlas.studio.clips.v1',JSON.stringify(clips));setNotice('Animations saved locally');
 };
 const mutate=(next:SceneData)=>{
   const issues=validateSceneDocument(next,new Set(ASSETS.map(asset=>asset.id)));
   if(issues.length){setNotice(issues[0].message+' ('+issues[0].path+')');return;}
   setHistory(h=>[...h.slice(-40),structuredClone(scene)]);
   setFuture([]);setScene(next);setNotice('Unsaved changes');
 };
 const switchScene=(nextId:string)=>{
   if(nextId===scene.id)return;
   if(dirty&&!window.confirm('Unsaved changes in this scene will be discarded. Continue?'))return;
   const next=safeLoad(nextId);
   setScene(next);setHistory([]);setFuture([]);setSelection(next.instances[0]?.id||null);
   setFrame(0);setPlaying(false);setNotice('Scene opened: '+next.name);
 };
 const update=(patch:Partial<Instance>)=>{
   if(!selected)return;
   mutate({...scene,instances:scene.instances.map(i=>i.id===selected.id?{...i,...patch}:i)});
 };
 const addAt=(x:number,z:number,chosen=assetId)=>{
   if(scene.instances.some(i=>i.x===x&&i.z===z)){setNotice('Tile occupied. Choose another location.');return;}
   const asset=findAsset(chosen);if(!asset)return;
   const item:Instance={id:id(),assetId:chosen,x,z,layer:2,rotation:0,interactive:asset.kind!=='furniture',label:asset.name};
   mutate({...scene,instances:[...scene.instances,item]});setSelection(item.id);setTool('select');
   setNotice(asset.name+' placed');
 };
 const undo=()=>{if(!history.length)return;setFuture(f=>[structuredClone(scene),...f]);setScene(history.at(-1)!);setHistory(h=>h.slice(0,-1));setNotice('Undo');};
 const redo=()=>{if(!future.length)return;setHistory(h=>[...h,structuredClone(scene)]);setScene(future[0]);setFuture(f=>f.slice(1));setNotice('Redo');};
 const save=()=>{
   saveClips();
   const errors=validateAssetCatalog(ASSETS).concat(validateSceneDocument(scene,new Set(ASSETS.map(asset=>asset.id))));
   if(errors.length){setNotice('Save blocked: '+errors[0].message);return;}
   localStorage.setItem('atlas.studio.scene.'+scene.id,JSON.stringify(scene));setHistory([]);setFuture([]);setNotice('Saved locally: '+scene.name);};
 const exportJson=()=>{
   const errors=validateAssetCatalog(ASSETS).concat(validateSceneDocument(scene,new Set(ASSETS.map(asset=>asset.id))));
   if(errors.length){setNotice('Export blocked: '+errors[0].message);return;}
   const blob=new Blob([JSON.stringify(scene,null,2)],{type:'application/json'});
   const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=scene.id+'.json';a.click();
   window.setTimeout(()=>URL.revokeObjectURL(url),1000);setNotice('Scene exported');
 };
 const importJson=async(file:File)=>{
   if(file.size>250000){setNotice('File is too large');return;}
   try{const parsed:unknown=JSON.parse(await file.text());
     const doc=parsed as SceneData;
     const issues=validateSceneDocument(doc,new Set(ASSETS.map(asset=>asset.id)));
     if(issues.length||doc.id!==scene.id)throw Error('Invalid scene document');
     mutate({...scene,instances:doc.instances});setSelection(null);setNotice('Scene imported');
   }catch{setNotice('Import rejected: invalid scene JSON');}
 };
 const deleteSelection=()=>{if(!selected)return;mutate({...scene,instances:scene.instances.filter(i=>i.id!==selected.id)});setSelection(null);setNotice('Asset removed');};
 const pointerToTile=(clientX:number,clientY:number,svg:SVGSVGElement)=>{
   const rect=svg.getBoundingClientRect();
   return closestTile((clientX-rect.left)*VIEW_W/rect.width,(clientY-rect.top)*VIEW_H/rect.height,scene.width,scene.depth);
 };
 const handleCanvasClick=(e:React.MouseEvent<SVGSVGElement>)=>{
   const tile=pointerToTile(e.clientX,e.clientY,e.currentTarget);
   if(tool==='place')addAt(tile.x,tile.z);else setSelection(null);
 };
 const drop=(e:React.DragEvent<SVGSVGElement>)=>{
   e.preventDefault();const asset=e.dataTransfer.getData('asset-id');
   if(!findAsset(asset))return;
   const tile=pointerToTile(e.clientX,e.clientY,e.currentTarget);
   addAt(tile.x,tile.z,asset);
 };
 return <div className="studio">
  <header className="topbar">
   <div className="brand"><span className="brand-mark">◈</span><span>ATLAS <strong>STUDIO</strong></span><span className="beta">PREVIEW</span></div>
   <label className="project-name"><PanelsTopLeft size={15}/><select aria-label="Open scene" value={scene.id} onChange={e=>switchScene(e.target.value)}>{ORIGINAL_SCENES.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select><ChevronDown size={14}/></label>
   <div className="top-actions">
    <span className="dirty-state">{dirty?<span className="dirty-mark">●</span>:'✓'} {dirty?'Modified':'Saved'}</span>
    <button className="icon-button" title="Undo" aria-label="Undo" onClick={undo} disabled={!history.length}><Undo2 size={17}/></button>
    <button className="icon-button" title="Redo" aria-label="Redo" onClick={redo} disabled={!future.length}><Redo2 size={17}/></button>
    <button className="action muted" onClick={()=>fileInput.current?.click()}><Upload size={15}/> Import</button>
    <input type="file" accept=".json,application/json" ref={fileInput} hidden onChange={e=>{const f=e.target.files?.[0];if(f)void importJson(f);e.currentTarget.value='';}}/>
    <button className="action muted" onClick={exportJson}><Download size={15}/> Export</button>
    <button className="action primary" onClick={save}><Save size={15}/> Save</button>
   </div>
  </header>
  <div className="workspace">
   <aside className="asset-panel" aria-label="Asset library">
    <div className="panel-title"><span>ASSET LIBRARY</span><button className="icon-button" title="Assets"><Boxes size={16}/></button></div>
    <label className="search"><Search size={15}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search assets..." aria-label="Search assets"/></label>
    <div className="type-filters">
     {(['all','prop','furniture','character','structure'] as const).map(t=><button key={t} className={filter===t?'chosen':''} onClick={()=>setFilter(t)}>{t==='all'?'All':t==='prop'?'Props':t==='furniture'?'Furniture':t==='character'?'Characters':'Structure'}</button>)}
    </div>
    <div className="asset-count">{catalog.length} assets <span>Original artwork</span></div>
    <div className="asset-grid">{catalog.map(a=><button key={a.id}
      draggable onDragStart={e=>{e.dataTransfer.setData('asset-id',a.id);e.dataTransfer.effectAllowed='copy';}}
      className={'asset-card '+(assetId===a.id?'picked':'')}
      onClick={()=>{setAssetId(a.id);setTool('place');setNotice('Click a tile to place '+a.name);}}>
      <div className="asset-thumb"><svg viewBox="-38 -80 76 115" aria-hidden="true"><Shape assetId={a.id}/></svg></div>
      <span className="asset-name">{a.name}</span><span className="asset-category">{a.category}</span>
     </button>)}</div>
    <div className="library-tip"><Info size={14}/><span>Select an asset and click in the viewport to place it, or drag it onto a tile.</span></div>
   </aside>
   <section className="editor-area">
    <div className="editor-toolbar">
      <div className="toolbar-left">
       <span className="location-label"><Layers3 size={16}/> SCENE EDITOR <ChevronRight size={13}/> <strong>{scene.name}</strong></span>
      </div>
      <div className="toolbar-right">
       <button className={'tool '+(tool==='select'?'active':'')} onClick={()=>setTool('select')} title="Select"><MousePointer2 size={16}/> Select</button>
       <button className={'tool '+(tool==='place'?'active':'')} onClick={()=>setTool('place')} title="Place asset"><Plus size={16}/> Place</button>
       <span className="tool-divider"/>
       <button className={'icon-button '+(grid?'on':'')} onClick={()=>setGrid(!grid)} title="Toggle grid" aria-label="Toggle grid"><Grid2X2 size={17}/></button>
       <button className={'icon-button '+(colliders?'on':'')} onClick={()=>setColliders(!colliders)} title="Toggle collision footprint" aria-label="Toggle collision footprint"><Eye size={17}/></button>
       <select aria-label="Canvas zoom" value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[.75,1,1.25].map(z=><option key={z} value={z}>{Math.round(z*100)}%</option>)}</select>
      </div>
    </div>
    <div className="viewport-container">
     <div className="viewport-top"><span className="live-dot"/> ISOMETRIC VIEW <span className="viewer-meta">{scene.width} × {scene.depth} GRID · {scene.instances.length} OBJECTS</span></div>
     <div className="canvas-holder">
      <svg className="iso-canvas" viewBox={'0 0 '+VIEW_W+' '+VIEW_H} role="img" aria-label="Editable isometric scene: select and place assets" style={{transform:'scale('+zoom+')'}} onClick={handleCanvasClick}
       onDragOver={e=>e.preventDefault()} onDrop={drop}>
       <defs><pattern id="stars" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#243744"/></pattern></defs>
       <rect width={VIEW_W} height={VIEW_H} fill="#101c26"/><rect width={VIEW_W} height={VIEW_H} fill="url(#stars)"/>
       {Array.from({length:scene.width*scene.depth},(_,index)=>{
         const x=Math.floor(index/scene.depth),z=index%scene.depth,p=project(x,z);
         return <polygon key={index} points={[p.x+','+(p.y-TH/2),(p.x+TW/2)+','+p.y,p.x+','+(p.y+TH/2),(p.x-TW/2)+','+p.y].join(' ')}
           fill={(x+z)%2?'#253943':'#2a404a'} stroke={grid?'#3a535c':'#2a404a'} strokeWidth=".7"
           className={tool==='place'?'tile-clickable':''}/>;
       })}
       {scene.instances.slice().sort((a,b)=>a.x+a.z-(b.x+b.z)||a.layer-b.layer).map(item=>{
         const p=project(item.x,item.z);
         return <g key={item.id} transform={'translate('+p.x+' '+p.y+')'} className="scene-item"
          role="button" tabIndex={0} aria-label={'Select '+item.label}
          onClick={e=>{e.stopPropagation();setSelection(item.id);setTool('select');setFrame(0);}}
          onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setSelection(item.id);}}}>
          <g transform={'translate(0 '+(selection===item.id?-(clip?.frames[frame]?.offsetYPx||0):0)+')'}><Shape assetId={item.assetId} active={selection===item.id} frame={selection===item.id?frame:0}/></g>
          {colliders&&<ellipse cx="0" cy="12" rx="25" ry="12" fill="#83e4d3" fillOpacity=".13" stroke="#83e4d3" strokeDasharray="3 3"/>}
         </g>;
       })}
      </svg>
     </div>
     <div className="viewer-status"><div><span className="live-dot"/> READY <span className="status-label">{notice}</span></div><div>ISO · PX · FRAME 001</div></div>
    </div>
    <div className="bottom-panel">
      <div className="bottom-header"><span><Clapperboard size={16}/> ANIMATION TIMELINE</span><span className="timeline-state">{selectedAsset?.state||'No selection'}</span></div>
      <div className="timeline-body">
        <button className="icon-button play" onClick={()=>setPlaying(!playing)} title={playing?'Pause':'Preview animation'} disabled={!clip||clip.frames.length<=1}>{playing?<Pause size={17}/>:<Play size={17}/>}</button>
        <div className="frames">{Array.from({length:clip?.frames.length||1},(_,i)=><button key={i}
          className={'frame '+(frame===i?'current':'')}
          onClick={()=>{setFrame(i);setPlaying(false);}}><span>{('0'+(i+1)).slice(-2)}</span></button>)}</div>
        <span className="timeline-fps">{clip&&clip.frames.length>1?Math.round(1000/(clip.frames[frame]?.durationMs||160))+' FPS':'1 FRAME'}</span>
      </div>
    </div>
   </section>
   <aside className="inspector" aria-label="Inspector">
      <div className="panel-title"><span>INSPECTOR</span><SlidersHorizontal size={16}/></div>
      {selected && selectedAsset ? <>
       <div className="selection-preview"><svg viewBox="-38 -90 76 132"><g transform={'translate(0 '+-(clip?.frames[frame]?.offsetYPx||0)+')'}><Shape assetId={selected.assetId} active frame={frame}/></g></svg></div>
       <div className="selection-title"><h2>{selected.label}</h2><p>{selectedAsset.category} · {selected.id}</p></div>
       <div className="inspector-tabs"><button className={selectedTab==='props'?'active':''} onClick={()=>setSelectedTab('props')}>Properties</button><button className={selectedTab==='animation'?'active':''} onClick={()=>setSelectedTab('animation')}>Animation</button></div>
       {selectedTab==='props'?<>
        <div className="inspector-group"><h3><Move size={14}/> TRANSFORM</h3>
         <div className="fields"><label>X <span>cells</span><input type="number" min="0" max={scene.width-1} value={selected.x} onChange={e=>update({x:clamp(Number(e.target.value),0,scene.width-1)})}/></label>
          <label>Z <span>cells</span><input type="number" min="0" max={scene.depth-1} value={selected.z} onChange={e=>update({z:clamp(Number(e.target.value),0,scene.depth-1)})}/></label></div>
         <div className="fields"><label>Layer <span>index</span><input type="number" min="0" max="9" value={selected.layer} onChange={e=>update({layer:clamp(Number(e.target.value),0,9)})}/></label>
          <label>Rotation <span>degrees</span><select value={selected.rotation} onChange={e=>update({rotation:Number(e.target.value) as 0|90|180|270})}>{[0,90,180,270].map(d=><option key={d} value={d}>{d}°</option>)}</select></label></div>
        </div>
        <div className="inspector-group"><h3><Boxes size={14}/> ASSET</h3><label className="full-label">Display label<input value={selected.label} maxLength={80} onChange={e=>update({label:e.target.value})}/></label>
         <div className="detail-row"><span>Type</span><strong>{selectedAsset.kind}</strong></div>
         <div className="detail-row"><span>Palette</span><strong>{selectedAsset.palette}</strong></div>
         <label className="toggle"><input type="checkbox" checked={selected.interactive} onChange={e=>update({interactive:e.target.checked})}/><span>Interactive object</span></label>
        </div>
       </>:<div className="inspector-group"><h3><Clapperboard size={14}/> ANIMATION</h3>
        <div className="detail-row"><span>State</span><strong>{selectedAsset.state}</strong></div>
        <div className="detail-row"><span>Frames</span><strong>{clip?.frames.length||0}</strong></div>
        <label className="toggle"><input type="checkbox" checked={clip?.loop||false} onChange={e=>clip&&editClip({...clip,loop:e.target.checked})}/> Loop sequence</label>
        <div className="fields">
         <label>Duration <span>ms</span><input aria-label="Frame duration" type="number" min="16" max="60000" value={clip?.frames[frame]?.durationMs||160} onChange={e=>clip&&editClip({...clip,frames:clip.frames.map((f,i)=>i===frame?{...f,durationMs:Number(e.target.value)}:f)})}/></label>
         <label>Vertical offset <span>px</span><input aria-label="Frame vertical offset" type="number" min="-32" max="32" value={clip?.frames[frame]?.offsetYPx||0} onChange={e=>clip&&editClip({...clip,frames:clip.frames.map((f,i)=>i===frame?{...f,offsetYPx:Number(e.target.value)}:f)})}/></label>
        </div>
        <div className="detail-row"><span>Frame glow</span><strong>{Math.round((clip?.frames[frame]?.glow||0)*100)}%</strong></div>
        <input aria-label="Frame glow" type="range" min="0" max="1" step="0.05" value={clip?.frames[frame]?.glow||0} onChange={e=>clip&&editClip({...clip,frames:clip.frames.map((f,i)=>i===frame?{...f,glow:Number(e.target.value)}:f)})}/>
        <div className="animation-actions">
         <button onClick={()=>clip&&clip.frames.length<120&&editClip({...clip,frames:[...clip.frames,{...clip.frames.at(-1)!}]})}><Plus size={14}/> Add frame</button>
         <button disabled={!clip||clip.frames.length<=1} onClick={()=>clip&&editClip({...clip,frames:clip.frames.filter((_,i)=>i!==frame)})}><Trash2 size={14}/> Remove</button>
        </div>
        <button className="animation-save" onClick={saveClips}><Save size={14}/> Save animation</button>
        <p className="help-text">Timing, vertical motion and looping are editable. Frame-image binding and game interaction events need full J6 integration.</p>
       </div>}
       <div className="inspector-group provenance"><h3><Check size={14}/> SOURCE STATUS</h3><div className="approval"><Check size={15}/> Original procedural artwork</div></div>
       <div className="inspector-footer"><button onClick={()=>{const copy={...selected,id:id(),x:Math.min(scene.width-1,selected.x+1)};if(scene.instances.some(i=>i.x===copy.x&&i.z===copy.z)){setNotice('Target tile occupied');return;}mutate({...scene,instances:[...scene.instances,copy]});setSelection(copy.id);}}><Copy size={15}/> Duplicate</button>
        <button className="danger" onClick={deleteSelection}><Trash2 size={15}/> Delete</button></div>
      </>:<div className="empty-selection"><MousePointer2 size={28}/><h3>Nothing selected</h3><p>Choose a scene object to edit its position, layers, behavior and animation.</p></div>}
   </aside>
  </div>
 </div>;
}

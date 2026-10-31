export type AssetKind = 'character' | 'furniture' | 'prop' | 'structure';
export type AnimationState = 'idle' | 'active' | 'talk' | 'open';
import type {SourceProvenance} from '../../../packages/asset-schema/index.mjs';
export type SpriteAsset = {
  id:string; name:string; kind:AssetKind; category:string;
  color:string; icon:string; frameCount:number; state:AnimationState;
  notes:string; license:'original'; palette:string; source:SourceProvenance;
};
export type Instance = {
  id:string; assetId:string; x:number; z:number; layer:number; rotation:0|90|180|270;
  interactive:boolean; label:string;
};
export type SceneData={schemaVersion:1;id:string;name:string;width:number;depth:number;instances:Instance[]};
const originalSource:SourceProvenance={origin:'original-art',creator:'project-owner',sourceUrl:null,license:'original',attribution:null,reviewStatus:'approved',allowedForPublicBuild:true};
const rawAssets:Omit<SpriteAsset,'source'>[]=[
  {id:'camera',name:'Camera Rig',kind:'prop',category:'Electronics',color:'#83ccc2',icon:'camera',frameCount:4,state:'active',notes:'RAW imaging workstation',license:'original',palette:'Studio Natural'},
  {id:'workbench',name:'Workbench',kind:'furniture',category:'Furniture',color:'#bc9d7c',icon:'table',frameCount:1,state:'idle',notes:'Workbench and tabletop',license:'original',palette:'Studio Natural'},
  {id:'monitor',name:'Control Monitor',kind:'prop',category:'Electronics',color:'#8daadc',icon:'monitor',frameCount:6,state:'active',notes:'Animated status display',license:'original',palette:'Studio Natural'},
  {id:'plant',name:'Potted Plant',kind:'prop',category:'Decor',color:'#90bc94',icon:'leaf',frameCount:1,state:'idle',notes:'Original procedural leaves',license:'original',palette:'Studio Natural'},
  {id:'door',name:'Workshop Door',kind:'structure',category:'Architecture',color:'#b9aa93',icon:'door',frameCount:4,state:'open',notes:'Four-frame open animation',license:'original',palette:'Studio Natural'},
  {id:'maker',name:'Workshop Guide',kind:'character',category:'Characters',color:'#a3bbcd',icon:'person',frameCount:8,state:'talk',notes:'Original guide character',license:'original',palette:'Studio Natural'},
  {id:'antenna',name:'LoRa Antenna',kind:'prop',category:'Electronics',color:'#d1bd8c',icon:'antenna',frameCount:4,state:'active',notes:'Radio telemetry exhibit',license:'original',palette:'Studio Natural'},
];
export const ASSETS:SpriteAsset[]=rawAssets.map(a=>({...a,source:{...originalSource}}));
export const INITIAL:SceneData={
  schemaVersion:1,id:'workshop-01',name:'Workshop / Showroom',width:11,depth:11,
  instances:[
    {id:'obj-1',assetId:'workbench',x:3,z:3,layer:1,rotation:0,interactive:false,label:'Prototype table'},
    {id:'obj-2',assetId:'camera',x:3,z:4,layer:2,rotation:0,interactive:true,label:'CinePi station'},
    {id:'obj-3',assetId:'monitor',x:7,z:3,layer:2,rotation:0,interactive:true,label:'Status monitor'},
    {id:'obj-4',assetId:'antenna',x:7,z:7,layer:2,rotation:0,interactive:true,label:'Telemetry demo'},
    {id:'obj-5',assetId:'plant',x:2,z:8,layer:1,rotation:0,interactive:false,label:'Indoor plant'},
    {id:'obj-6',assetId:'maker',x:5,z:6,layer:3,rotation:0,interactive:true,label:'Workshop guide'}
  ]
};
export const findAsset=(id:string)=>ASSETS.find(a=>a.id===id);
export const keyOf=(i:Instance)=>i.x+':'+i.z;

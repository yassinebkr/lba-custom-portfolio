import {INITIAL,type SceneData,type Instance} from './model';

/** Original visual workshop concepts, with independently editable object instances. */
const make=(id:string,name:string,placements:Array<[string,number,number,string]>):SceneData=>({
 schemaVersion:1,id,name,width:11,depth:11,
 instances:placements.map(([assetId,x,z,label],i):Instance=>({
   id:id+'-obj-'+(i+1),assetId,x,z,label,layer:assetId==='maker'?3:2,
   rotation:0,interactive:assetId!=='plant'&&assetId!=='workbench'
 }))
});
export const ORIGINAL_SCENES:SceneData[]=[
 INITIAL,
 make('origin-studio','Origin / Introduction',[
   ['maker',5,5,'Meet the workshop guide'],['monitor',3,3,'About the maker'],
   ['plant',2,7,'Studio plants'],['workbench',7,4,'First electronics bench']]),
 make('electronics-lab','Electronics / Imaging',[
   ['camera',3,3,'RAW camera rig'],['monitor',7,3,'Image processing monitor'],
   ['workbench',3,7,'Test bench'],['maker',6,7,'Hardware engineer'],['antenna',8,6,'RF module']]),
 make('maker-workshop','Workshop / Fabrication',[
   ['workbench',3,3,'CNC and printing table'],['camera',6,3,'Inspection camera'],
   ['door',8,6,'Machine enclosure'],['monitor',5,7,'Job console'],['plant',2,7,'Plant']]),
 make('field-lab','Field Lab / Telemetry',[
   ['antenna',3,3,'LoRa antenna test'],['monitor',7,3,'GNSS signal monitor'],
   ['workbench',5,7,'Flight electronics'],['maker',8,7,'Flight systems guide']]),
 make('ai-studio','AI / Interfaces',[
   ['monitor',3,3,'Agent work surface'],['monitor',7,3,'Evidence review display'],
   ['maker',5,7,'Interface guide'],['door',8,7,'Workspace entrance']])
];
export const findScene=(sceneId:string)=>ORIGINAL_SCENES.find(s=>s.id===sceneId)||INITIAL;

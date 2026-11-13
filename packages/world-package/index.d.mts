export type WorldSource={
  origin:'original-art'|'original-photo'|'original-model'|'licensed-asset'
  creator:string
  sourceUrl:string|null
  license:'original'|'CC0-1.0'|'MIT'|'CC-BY-4.0'
  attribution:string|null
  reviewStatus:'approved'|'pending'|'rejected'
  allowedForPublicBuild:boolean
};
export type WorldSpriteFrame={x:number,y:number,durationMs:number};
export type WorldSprite={
  imageRef:string
  widthPx:number
  heightPx:number
  frameWidthPx:number
  frameHeightPx:number
  pivotPx:{x:number,y:number}
  footprint:{widthCells:number,depthCells:number}
  views:{ne:WorldSpriteFrame,nw:WorldSpriteFrame,sw:WorldSpriteFrame,se:WorldSpriteFrame}
};
export type WorldAsset={
  id:string
  name:string
  kind:'character'|'furniture'|'prop'|'structure'
  source:WorldSource
  sprite:WorldSprite
};
export type WorldInstance={
  id:string
  assetId:string
  x:number
  z:number
  layer:number
  rotation:0|90|180|270
  interactive:boolean
  label:string
};
export type WorldScene={
  schemaVersion:1
  id:string
  name:string
  width:number
  depth:number
  backgroundRef:string
  instances:WorldInstance[]
};
export type WorldPackage={
  schemaVersion:1
  id:string
  name:string
  entrySceneId:string
  assets:WorldAsset[]
  scenes:WorldScene[]
};
export type WorldIssue={path:string,code:string,message:string};
export declare const WORLD_SCHEMA_VERSION:1;
export declare const DIRECTIONS:readonly ['ne','nw','sw','se'];
export declare function safeImageRef(path:unknown):boolean;
export declare function validateWorldPackage(world:unknown,options?:{requireApproved?:boolean}):WorldIssue[];
export declare function assertWorldPackage(world:unknown,options?:{requireApproved?:boolean}):WorldPackage;
export declare function referencedImages(world:WorldPackage):string[];

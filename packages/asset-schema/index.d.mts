export type ValidationIssue={path:string;code:string;message:string};
export type SourceProvenance={
 origin:'original-art'|'original-photo'|'licensed-asset'|'original-model';
 creator:string;sourceUrl:string|null;license:'original'|'CC0-1.0'|'MIT'|'CC-BY-4.0';
 attribution:string|null;reviewStatus:'approved'|'pending'|'rejected';allowedForPublicBuild:boolean;
};
export function validateSource(value:unknown,path?:string):ValidationIssue[];
export function validateAssetCatalog(assets:unknown):ValidationIssue[];
export function validateSceneDocument(scene:unknown,assetIds?:Set<string>):ValidationIssue[];
export function validateAnimation(value:unknown,path?:string):ValidationIssue[];
export function assertValid(errors:ValidationIssue[]):void;
export function makeApprovedSource(creator?:string):SourceProvenance;
export const SCHEMA_VERSION:1;

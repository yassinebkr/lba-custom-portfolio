export type AnimationFrame={durationMs:number;offsetYPx:number;glow:number};
export type AnimationClip={id:string;loop:boolean;frames:AnimationFrame[]};
export function validateClip(clip:unknown):string[];
export function frameAt(clip:AnimationClip,timeMs:number):{index:number;frame:AnimationFrame};
export function createClip(id:string,count?:number):AnimationClip;

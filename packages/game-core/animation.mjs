/** Deterministic animation clips for original game objects. No image data included. */
export function validateClip(clip){
 const errors=[];
 if(!clip||typeof clip!=='object'||Array.isArray(clip))return['Invalid animation clip'];
 if(typeof clip.id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(clip.id))errors.push('Invalid clip ID');
 if(typeof clip.loop!=='boolean')errors.push('Loop must be boolean');
 if(!Array.isArray(clip.frames)||clip.frames.length<1||clip.frames.length>120)return [...errors,'Frames must contain 1..120 entries'];
 for(const [i,f] of clip.frames.entries()){
  if(!f||!Number.isInteger(f.durationMs)||f.durationMs<16||f.durationMs>60000)errors.push('Frame '+i+' duration outside 16..60000 ms');
  if(!f||!Number.isInteger(f.offsetYPx)||Math.abs(f.offsetYPx)>32)errors.push('Frame '+i+' Y offset outside ±32px');
  if(!f||typeof f.glow!=='number'||!Number.isFinite(f.glow)||f.glow<0||f.glow>1)errors.push('Frame '+i+' glow outside 0..1');
 }
 return errors;
}
export function frameAt(clip,timeMs){
 const problems=validateClip(clip);if(problems.length)throw Error(problems[0]);
 if(!Number.isFinite(timeMs)||timeMs<0)throw Error('Time must be finite and nonnegative');
 const duration=clip.frames.reduce((n,f)=>n+f.durationMs,0);
 const tick=clip.loop?timeMs%duration:Math.min(timeMs,duration-1);
 let pos=0;
 for(const [i,f] of clip.frames.entries()){pos+=f.durationMs;if(tick<pos)return {index:i,frame:f};}
 return {index:clip.frames.length-1,frame:clip.frames.at(-1)};
}
export function createClip(id,count=1){
 if(!/^[a-z][a-z0-9-]*$/.test(id)||!Number.isInteger(count)||count<1||count>120)throw Error('Invalid animation template');
 return {id:id+'-idle',loop:true,frames:Array.from({length:count},(_,i)=>({durationMs:160,offsetYPx:i%2,glow:i%2?0.8:0.35}))};
}

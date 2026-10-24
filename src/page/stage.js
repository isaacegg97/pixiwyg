// SECTION: the stage: its size and zoom
const KEY='pixiwyg.v1';let W=0,H=0;
const $=s=>document.querySelector(s);
const stage=$('#stage'),layer=$('#layer'),selbox=$('#selbox');
// INVARIANT: paint is the Paint Studio's active layer canvas; layers.js points it at another layer as you switch.
let paint=$('#paint');
let ctx=paint.getContext('2d',{willReadFrequently:true});
const dpr=Math.min(2,window.devicePixelRatio||1);
let sdpr=dpr;   // PERF: paint canvas density drops for big canvases; backing store is w*h*dpr^2*4 bytes.
// RULE: the stage grows with the window and never shrinks, so content is never clipped by a resize.
function sizeStage(w,h){
  w=Math.max(Math.round(w),W);h=Math.max(Math.round(h),H);if(w===W&&h===H)return;
  W=w;H=h;stage.style.width=W+'px';stage.style.height=H+'px';syncZoom();
}
// INVARIANT: the stage is CSS-scaled by Z; #zoomwrap carries the scaled size so the desk's scroll extent is right.
let Z=1;
function syncZoom(){const zw=$('#zoomwrap');stage.style.transform=Z===1?'':`scale(${Z})`;zw.style.width=W*Z+'px';zw.style.height=H*Z+'px';const p=$('#zPct');if(p)p.textContent=Math.round(Z*100)+'%'}


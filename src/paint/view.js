// SECTION: the canvas view (zoom, fit, pan)
// RULE: the drawing fits the view until you zoom. Ctrl/⌘+wheel zooms around the pointer, the middle button drags the
//   view, plain scrolling scrolls it, and from 200% up pixels show square, as pixel art wants.
const ZOOMS=[.125,.25,1/3,.5,2/3,1,1.5,2,3,4,6,8,12,16];
studio.zoom='fit';
function viewScale(){
  if(studio.zoom!=='fit')return studio.zoom;
  const r=sview.getBoundingClientRect();return Math.max(.05,Math.min(16,(r.width-24)/SW,(r.height-24)/SH));
}
function fitView(){
  const z=viewScale();sstack.style.width=SW*z+'px';sstack.style.height=SH*z+'px';sstack.classList.toggle('pix',z>=2);
  const b=$('#sZoomFit');b.textContent=(studio.zoom==='fit'?'Fit ':'')+Math.round(z*100)+'%';b.setAttribute('aria-pressed',String(studio.zoom==='fit'));
}
// INVARIANT: the point under `at` (client coordinates; the view's middle without it) stays put through a zoom.
function sZoomTo(z,at){
  const v=sview.getBoundingClientRect(),p=at||{x:v.left+v.width/2,y:v.top+v.height/2},r=sstack.getBoundingClientRect(),fx=(p.x-r.left)/r.width,fy=(p.y-r.top)/r.height;
  studio.zoom=Math.max(ZOOMS[0],Math.min(ZOOMS[ZOOMS.length-1],z));fitView();
  const r2=sstack.getBoundingClientRect();sview.scrollLeft+=r2.left+fx*r2.width-p.x;sview.scrollTop+=r2.top+fy*r2.height-p.y;
}
function sZoomStep(d,at){const z=viewScale();sZoomTo(d>0?ZOOMS.find(x=>x>z*1.01)||ZOOMS[ZOOMS.length-1]:[...ZOOMS].reverse().find(x=>x<z/1.01)||ZOOMS[0],at)}
function sZoomFit(){if(studio.zoom==='fit')sZoomTo(1);else{studio.zoom='fit';fitView()}}
new ResizeObserver(()=>{if(studio.zoom==='fit')fitView()}).observe(sview);
sview.addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();sZoomStep(e.deltaY<0?1:-1,{x:e.clientX,y:e.clientY})},{passive:false});
sview.addEventListener('pointerdown',e=>{
  if(e.button!==1)return;e.preventDefault();sview.setPointerCapture(e.pointerId);sview.classList.add('panning');
  const x0=e.clientX,y0=e.clientY,l0=sview.scrollLeft,t0=sview.scrollTop;
  const mv=ev=>{sview.scrollLeft=l0-(ev.clientX-x0);sview.scrollTop=t0-(ev.clientY-y0)};
  const up=()=>{sview.removeEventListener('pointermove',mv);sview.removeEventListener('pointerup',up);sview.removeEventListener('pointercancel',up);sview.classList.remove('panning')};
  sview.addEventListener('pointermove',mv);sview.addEventListener('pointerup',up);sview.addEventListener('pointercancel',up);
});
// FIX: the middle button pans; it must not autoscroll or (on Linux) paste the selection.
for(const t of ['mousedown','mouseup','auxclick'])sview.addEventListener(t,e=>{if(e.button===1)e.preventDefault()});
$('#sZoomIn').onclick=()=>{audio();sZoomStep(1)};$('#sZoomOut').onclick=()=>{audio();sZoomStep(-1)};$('#sZoomFit').onclick=()=>{audio();sZoomFit()};

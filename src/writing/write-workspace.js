// SECTION: Write
// RULE: the margins are a wall; too-wide text narrows to fit, pictures scale down.
function writeBox(el){if(isFixed())return contentRect(pageOf(el));const m=24;return{x:m,y:m,w:W-2*m,h:Infinity}}
function confine(el){
  const host=hostOf(el.id);if(!host)return false;
  const b=writeBox(el);let {w,h}=layoutBox(el,host),changed=false;
  if(w>b.w+.5){
    if(el.tag==='img'||isScaled(el)){const k=b.w/w;el.sx=Math.round((el.sx||1)*k*1e4)/1e4;el.sy=Math.round((el.sy||1)*k*1e4)/1e4;if(!isScaled(el)){delete el.sx;delete el.sy}}
    else el.w=Math.floor(b.w);
    renderEl(el);({w,h}=layoutBox(el));changed=true;
  }
  // HACK: two passes: an element squeezed against the stage edge can grow wider once moved inside.
  for(let k=0;k<2;k++){
    const x=Math.round(Math.min(Math.max(el.x,b.x),b.x+b.w-w)),y=Math.round(h>b.h?b.y:Math.min(Math.max(el.y,b.y),b.y+b.h-h));
    if(x===el.x&&y===el.y)break;
    el.x=x;el.y=y;const hh=hostOf(el.id);hh.style.left=x+'px';hh.style.top=y+'px';changed=true;({w,h}=layoutBox(el,hh));
  }
  return changed;
}
function confineAll(){let n=0;for(const el of state.els)if(!el.md&&confine(el))n++;if(n)updateSel();return n}
const writing=()=>document.body.dataset.ws==='write';


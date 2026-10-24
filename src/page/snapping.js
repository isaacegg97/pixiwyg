// SECTION: snapping (smart guides)
const SNAP=7,guidesEl=$('#guides');
const gridStep=()=>state.grid||0;
function snapData(el,me){
  if(!me)me=elBox(el);
  const xs=[],ys=[];
  if(isFixed())pageSnapLines(xs,ys);else xs.push({v:0,a:0,b:H},{v:W/2,a:0,b:H},{v:W,a:0,b:H}),ys.push({v:0,a:0,b:W},{v:H/2,a:0,b:W},{v:H,a:0,b:W});
  for(const o of state.els){if(o===el)continue;const oh=hostOf(o.id);if(!oh)continue;
    const r={x:oh.offsetLeft,y:oh.offsetTop,...elBox(o,oh)};
    for(const v of [r.x,r.x+r.w/2,r.x+r.w])xs.push({v,a:r.y,b:r.y+r.h});
    for(const v of [r.y,r.y+r.h/2,r.y+r.h])ys.push({v,a:r.x,b:r.x+r.w});}
  return{me,xs,ys};
}
function best(edges,lines){let bd=Infinity;for(const e of edges)for(const l of lines){const d=l.v-e;if(Math.abs(d)<Math.abs(bd))bd=d}return Math.abs(bd)<=SNAP?bd:null}
const snapping=e=>state.snap&&!e.ctrlKey&&!e.metaKey;
function snapMove(sd,x,y,on){
  if(!on){drawGuides([]);return{x:Math.round(x),y:Math.round(y)}}
  const {w,h}=sd.me;const dx=best([x,x+w/2,x+w],sd.xs),dy=best([y,y+h/2,y+h],sd.ys);
  const gs=gridStep();
  if(dx!==null)x+=dx;else if(gs)x=Math.round(x/gs)*gs;
  if(dy!==null)y+=dy;else if(gs)y=Math.round(y/gs)*gs;
  x=Math.round(x);y=Math.round(y);
  guidesFor(sd,x,y,w,h);return{x,y};
}
function guidesFor(sd,x,y,w,h){
  const g=[];
  for(const e of [x,x+w/2,x+w])for(const l of sd.xs)if(Math.abs(l.v-e)<.6)g.push({v:1,at:l.v,a:Math.min(y,l.a),b:Math.max(y+h,l.b)});
  for(const e of [y,y+h/2,y+h])for(const l of sd.ys)if(Math.abs(l.v-e)<.6)g.push({v:0,at:l.v,a:Math.min(x,l.a),b:Math.max(x+w,l.b)});
  drawGuides(g);
}
function drawGuides(list){
  const seen=new Set();guidesEl.replaceChildren();
  for(const g of list){const k=g.v+':'+g.at;if(seen.has(k))continue;seen.add(k);const d=document.createElement('div');
    d.className='guide '+(g.v?'v':'h');
    if(g.v)Object.assign(d.style,{left:g.at+'px',top:g.a+'px',height:(g.b-g.a)+'px'});else Object.assign(d.style,{top:g.at+'px',left:g.a+'px',width:(g.b-g.a)+'px'});
    guidesEl.append(d)}
}


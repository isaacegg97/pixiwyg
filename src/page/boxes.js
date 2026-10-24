// SECTION: Boxes: a fixed, Fluxbox/tiling-style layout mode
// RULE: with Boxes on, each page is a tree of boxes: split any box into columns or rows, drag the dividers to resize.
//   An element dropped into a box is tiled there (stacked with a gap, aligned the way the box says); Alt-drop leaves
//   it floating, as every element was before. Turning Boxes off freezes the tiles where they are; on again re-tiles.
// FORMAT: state.boxes = {on, gap, pad, roots:[Box per page]}; Box = {id, split:null|'col'|'row', kids:[Box], f:[fraction
//   per kid, summing to 1], ax:'stretch'|'start'|'center'|'end', ay:'start'|'center'|'end'|'spread'}.
//   A tiled element carries el.box (a leaf id) and el.bo (its order in that leaf).
// INVARIANT: only leaves hold elements; a box that splits hands its elements to its first new child.
const BOX_AX=['stretch','start','center','end'],BOX_AY=['start','center','end','spread'];
const boxNew=()=>({id:nid('x'),split:null,kids:[],f:[],ax:'stretch',ay:'start'});
const boxesOn=()=>!!(state.boxes&&state.boxes.on);
function boxPages(){return isFixed()?pageRects().map(r=>contentRect(r)):[{x:0,y:0,w:W,h:H}]}
function boxEnsure(){
  if(!state.boxes)state.boxes={on:false,gap:12,pad:12,roots:[]};
  const n=boxPages().length,R=state.boxes.roots;while(R.length<n)R.push(boxNew());if(R.length>n)R.length=n;
  return state.boxes;
}
function boxWalk(fn){const B=state.boxes;if(!B)return;const go=(b,p,i,page)=>{fn(b,p,i,page);b.kids.forEach((k,j)=>go(k,b,j,page))};B.roots.forEach((r,i)=>go(r,null,0,i))}
function boxFind(id){let hit=null;boxWalk((b,p,i)=>{if(b.id===id)hit={b,p,i}});return hit}
const boxLeaves=b=>b.split?b.kids.flatMap(boxLeaves):[b];
// PERF: one pass from the roots; every rect is derived from its parent's, nothing is stored.
function boxRects(){
  const out=new Map(),pages=boxPages(),B=state.boxes;if(!B)return out;
  const go=(b,r,page)=>{out.set(b.id,{...r,b,page});if(!b.split)return;let o=0;
    b.kids.forEach((k,i)=>{const s=(b.split==='col'?r.w:r.h)*b.f[i];go(k,b.split==='col'?{x:r.x+o,y:r.y,w:s,h:r.h}:{x:r.x,y:r.y+o,w:r.w,h:s},page);o+=s})};
  B.roots.forEach((root,i)=>{if(pages[i])go(root,pages[i],i)});
  return out;
}
function boxLeafAt(x,y){let best=null;for(const r of boxRects().values())if(!r.b.split&&x>=r.x&&y>=r.y&&x<r.x+r.w&&y<r.y+r.h)best=r;return best}

// SECTION: editing the tree
function boxSplit(id,dir){
  const hit=boxFind(id);if(!hit)return;const b=hit.b;pushUndo();
  if(b.split===dir){b.kids.push(boxNew());b.f=b.kids.map(()=>1/b.kids.length)}
  else if(!b.split){const a=boxNew(),c=boxNew();a.ax=c.ax=b.ax;a.ay=c.ay=b.ay;b.split=dir;b.kids=[a,c];b.f=[.5,.5];for(const el of state.els)if(el.box===b.id)el.box=a.id}
  else{const inner={...b,id:nid('x')},c=boxNew();b.split=dir;b.kids=[inner,c];b.f=[.5,.5]}
  boxChanged();
}
function boxRemove(id){
  const hit=boxFind(id);if(!hit||!hit.p)return;pushUndo();const {b,p,i}=hit;
  const sib=p.kids[i===0?1:i-1],to=boxLeaves(sib)[0],gone=new Set(boxLeaves(b).map(x=>x.id));
  for(const el of state.els)if(gone.has(el.box))el.box=to.id;
  const fr=p.f[i];p.kids.splice(i,1);p.f.splice(i,1);p.f[i===0?0:i-1]+=fr;
  // RULE: a split left with one child becomes that child (its elements follow it up).
  if(p.kids.length===1){const only=p.kids[0];if(only.split){p.split=only.split;p.kids=only.kids;p.f=only.f}else{p.split=null;p.kids=[];p.f=[];p.ax=only.ax;p.ay=only.ay;for(const el of state.els)if(el.box===only.id)el.box=p.id}}
  boxChanged();
}
function boxCycle(id,axis){const hit=boxFind(id);if(!hit)return;pushUndo();const L=axis==='x'?BOX_AX:BOX_AY,k=axis==='x'?'ax':'ay';hit.b[k]=L[(L.indexOf(hit.b[k])+1)%L.length];boxChanged()}

// SECTION: tiling
// RULE: a leaf stacks its elements top to bottom by el.bo, gap apart, inside its padding. Stretch makes each one the
//   leaf's inner width; start/center/end keep their own width. Spread shares the leftover height between the gaps.
function boxLayout(){
  if(!boxesOn())return;const B=state.boxes,rects=boxRects(),pad=B.pad,gap=B.gap;let moved=false;
  const byLeaf=new Map();
  for(const el of state.els){if(!el.box||el.md)continue;const r=rects.get(el.box);if(!r||r.b.split){delete el.box;delete el.bo;continue}
    if(!byLeaf.has(el.box))byLeaf.set(el.box,[]);byLeaf.get(el.box).push(el)}
  for(const [id,list] of byLeaf){
    const r=rects.get(id),b=r.b,iw=Math.max(8,r.w-2*pad);
    list.sort((p,q)=>(p.bo??p.y)-(q.bo??q.y)||p.y-q.y);list.forEach((el,i)=>el.bo=i);
    const sizes=list.map(el=>{
      if(b.ax==='stretch'){const w=Math.round(iw/(el.sx||1));if(el.w!==w){el.w=w;renderEl(el)}}
      const h=hostOf(el.id);return h?layoutBox(el,h):{w:el.w||100,h:40};
    });
    const total=sizes.reduce((a,s)=>a+s.h,0)+gap*(list.length-1),spare=r.h-2*pad-total;
    let y=r.y+pad+(b.ay==='center'?Math.max(0,spare/2):b.ay==='end'?Math.max(0,spare):0);
    const g=b.ay==='spread'&&list.length>1?gap+Math.max(0,spare)/(list.length-1):gap;
    list.forEach((el,i)=>{const s=sizes[i];
      const x=Math.round(b.ax==='center'?r.x+(r.w-s.w)/2:b.ax==='end'?r.x+r.w-pad-s.w:r.x+pad),yy=Math.round(y);
      if(el.x!==x||el.y!==yy){el.x=x;el.y=yy;const h=hostOf(el.id);if(h){h.style.left=x+'px';h.style.top=yy+'px'}moved=true}
      y+=s.h+g});
  }
  if(moved)updateSel();
  return moved;
}
let boxT=0;
// PERF: content edits re-tile once per frame at most, after the element has rendered and can be measured.
function boxLayoutLater(){if(!boxesOn()||boxT)return;boxT=requestAnimationFrame(()=>{boxT=0;boxLayout();drawBoxes()})}
function boxChanged(){boxLayout();drawBoxes();save()}
// RULE: an element let go over a leaf joins it at the place it was dropped; Alt (or outside every box) floats it.
function boxDrop(el,x,y,float){
  if(!boxesOn())return false;
  const r=float?null:boxLeafAt(x,y);if(!r){if(el.box){delete el.box;delete el.bo;return true}return false}
  const sib=state.els.filter(e=>e!==el&&e.box===r.b.id).sort((a,b)=>(a.bo??a.y)-(b.bo??b.y));
  let at=sib.findIndex(e=>{const h=hostOf(e.id),bx=h?layoutBox(e,h):{h:0};return y<e.y+bx.h/2});if(at<0)at=sib.length;
  sib.splice(at,0,el);sib.forEach((e,i)=>e.bo=i);el.box=r.b.id;boxLayout();drawBoxes();return true;
}

// SECTION: overlay
const boxLayer=$('#boxLayer');let boxHot=null;
// FIX: rebuilding after every save swapped out a divider mid-press; the overlay is rebuilt only when what it shows changes.
let boxSig='';
function drawBoxes(){
  boxLayer.hidden=!boxesOn();if(!boxesOn()){boxSig='';boxLayer.replaceChildren();return}
  const rects=boxRects(),B=state.boxes,count=new Map();for(const el of state.els)if(el.box)count.set(el.box,(count.get(el.box)||0)+1);
  const sig=JSON.stringify([[...rects.values()].map(r=>[r.b.id,r.b.split,r.b.ax,r.b.ay,Math.round(r.x),Math.round(r.y),Math.round(r.w),Math.round(r.h)]),[...count],boxHot]);
  if(sig===boxSig&&boxLayer.childElementCount)return;boxSig=sig;boxLayer.replaceChildren();
  for(const r of rects.values()){
    const b=r.b;
    if(!b.split){
      const d=mkEl('div',{className:'bx'+(boxHot===b.id?' hot':'')});Object.assign(d.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});d.dataset.id=b.id;
      const bar=mkEl('div',{className:'bxbar'}),btn=(t,title,fn)=>{const x=mkEl('button',{type:'button',textContent:t,title});x.onclick=e=>{e.stopPropagation();audio();fn()};x.onpointerdown=e=>e.stopPropagation();bar.append(x)};
      btn('◫','Split into columns',()=>boxSplit(b.id,'col'));btn('⊟','Split into rows',()=>boxSplit(b.id,'row'));
      btn('↔ '+b.ax,'Horizontal alignment (click to change)',()=>boxCycle(b.id,'x'));btn('↕ '+b.ay,'Vertical alignment (click to change)',()=>boxCycle(b.id,'y'));
      if(boxFind(b.id).p)btn('✕','Remove this box (its elements move next door)',()=>boxRemove(b.id));
      bar.append(mkEl('span',{textContent:count.get(b.id)?String(count.get(b.id)):''}));
      d.append(bar);boxLayer.append(d);
    }else{
      let o=0;b.f.forEach((fr,i)=>{o+=fr;if(i===b.f.length-1)return;
        const v=mkEl('div',{className:'bxdiv '+(b.split==='col'?'c':'r')});
        if(b.split==='col')Object.assign(v.style,{left:(r.x+r.w*o)+'px',top:r.y+'px',height:r.h+'px'});else Object.assign(v.style,{top:(r.y+r.h*o)+'px',left:r.x+'px',width:r.w+'px'});
        v.title='Drag to resize';v.onpointerdown=e=>boxDivDown(e,b,i,r);boxLayer.append(v)});
    }
  }
}
function boxDivDown(e,b,i,r){
  // FIX: the overlay is rebuilt on every move, which destroys this divider; the drag listens on window instead.
  if(e.button>0)return;e.preventDefault();e.stopPropagation();audio();pushUndo();const v=window;
  const p0=pt(e),f0=[...b.f],span=b.split==='col'?r.w:r.h,MIN=Math.max(.04,24/span);
  const mv=ev=>{const p=pt(ev),d=((b.split==='col'?p.x-p0.x:p.y-p0.y))/span,t=f0[i]+f0[i+1];
    b.f[i]=Math.max(MIN,Math.min(t-MIN,f0[i]+d));b.f[i+1]=t-b.f[i];boxLayout();drawBoxes()};
  const up=()=>{v.removeEventListener('pointermove',mv);v.removeEventListener('pointerup',up);v.removeEventListener('pointercancel',up);save()};
  v.addEventListener('pointermove',mv);v.addEventListener('pointerup',up);v.addEventListener('pointercancel',up);
}
function boxHover(x,y){const r=x==null?null:boxLeafAt(x,y),id=r?r.b.id:null;if(id!==boxHot){boxHot=id;for(const d of boxLayer.querySelectorAll('.bx'))d.classList.toggle('hot',d.dataset.id===id)}}
function setBoxes(on){
  boxEnsure();if(state.boxes.on===on)return;pushUndo();state.boxes.on=on;
  $('#boxesBtn').setAttribute('aria-pressed',on);$('#boxesBtn').textContent=on?'Boxes on':'Boxes off';document.body.classList.toggle('boxes',on);
  if(on){boxLayout();status('Boxes on: split boxes from their corner buttons, drag elements in to tile them. Alt-drop floats.')}else status('Boxes off: tiles stay put and move freely; turn Boxes on to re-tile them.');
  drawBoxes();save();
}
function boxesSync(){const on=boxesOn();$('#boxesBtn').setAttribute('aria-pressed',on);$('#boxesBtn').textContent=on?'Boxes on':'Boxes off';document.body.classList.toggle('boxes',on);if(on)boxEnsure();drawBoxes()}
// SAFETY: a stored tree is rebuilt field by field; unknown splits, bad fractions and deep nesting are dropped.
function cleanBoxes(x){
  if(!x||typeof x!=='object')return null;let n=0;
  const cb=(b,d)=>{if(!b||typeof b!=='object'||d>12||++n>400)return null;const o={id:typeof b.id==='string'&&/^[\w-]{1,40}$/.test(b.id)?b.id:nid('x'),split:['col','row'].includes(b.split)?b.split:null,kids:[],f:[],
    ax:BOX_AX.includes(b.ax)?b.ax:'stretch',ay:BOX_AY.includes(b.ay)?b.ay:'start'};
    if(o.split){o.kids=(Array.isArray(b.kids)?b.kids:[]).map(k=>cb(k,d+1)).filter(Boolean);
      if(o.kids.length<2){o.split=null;o.kids=[]}else{const f=o.kids.map((_,i)=>numIn(Array.isArray(b.f)?b.f[i]:0,1/o.kids.length,.01,1)),s=f.reduce((a,v)=>a+v,0);o.f=f.map(v=>v/s)}}
    return o};
  return{on:!!x.on,gap:Math.round(numIn(x.gap,12,0,200)),pad:Math.round(numIn(x.pad,12,0,200)),roots:(Array.isArray(x.roots)?x.roots:[]).slice(0,200).map(r=>cb(r,0)).filter(Boolean)};
}
$('#boxesBtn').onclick=()=>{audio();setBoxes(!boxesOn())};


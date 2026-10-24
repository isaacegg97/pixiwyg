// SECTION: stage pointer
let drag=null;const pressLog=[];
function pt(e){const r=stage.getBoundingClientRect();return{x:(e.clientX-r.left)/Z-stage.clientLeft,y:(e.clientY-r.top)/Z-stage.clientTop}}
stage.addEventListener('pointerdown',e=>{
  if(playing)return;
  // RULE: while playing, clicks belong to the page's elements.
  if(TL.run)tlReset();
  if(e.button>0)return;audio();
  const host=e.target.closest&&e.target.closest('.el');
  pressLog.unshift({id:host?host.dataset.id:null,was:!!host&&state.sel===host.dataset.id});pressLog.length=Math.min(pressLog.length,2);
  // RULE: in isolation only the isolated component and its handles answer the pointer.
  if(iso.id&&!(host&&host.dataset.id===iso.id)&&!e.target.classList.contains('h'))return;
  if(state.editing){if(host&&host.dataset.id===state.editing.id)return;finishEdit()}
  const p=pt(e);
  stage.setPointerCapture(e.pointerId);
  if(e.target.classList.contains('h')){const el=selected(),h=el&&hostOf(el.id);if(h){const W=inkW(h,el.sx||1)||1,H=h.offsetHeight||1;
    drag={type:'scale',el,d:e.target.dataset.d,px:p.x,py:p.y,x0:el.x,y0:el.y,W,H,w0:W*(el.sx||1),h0:H*(el.sy||1),moved:false,snap:snapData(el)}}return}
  if(host&&e.shiftKey){toggleInSel(host.dataset.id);return}
  if(host){const el=state.els.find(x=>x.id===host.dataset.id);if(!selIds().includes(el.id))select(el.id);
    if(el.md){const d=docById(el.md);status(`Part of “${d?d.name:'a manuscript'}”: it flows with the text. Double-click to edit it there, or convert it to move it freely.`);return}
    drag={type:'move',el,sx:p.x,sy:p.y,x0:el.x,y0:el.y,moved:false,snap:snapData(el),others:selEls().filter(o=>o!==el).map(o=>({o,x0:o.x,y0:o.y}))};return}
  select(null);
});
let mouse=null;
stage.addEventListener('pointermove',e=>{
  mouse=pt(e);
  if(!drag)return;const p=mouse;
  if(drag.type==='move'){const dx=p.x-drag.sx,dy=p.y-drag.sy;if(!drag.moved&&Math.hypot(dx,dy)<3)return;if(!drag.moved){pushUndo();drag.moved=true}
    const sn=snapMove(drag.snap,drag.x0+dx,drag.y0+dy,snapping(e));
    // RULE: in Write the margins are a wall.
    if(writing()){const b=writeBox(sn),me=drag.snap.me;sn.x=Math.round(Math.min(Math.max(sn.x,b.x),b.x+b.w-me.w));sn.y=Math.round(me.h>b.h?b.y:Math.min(Math.max(sn.y,b.y),b.y+b.h-me.h))}
    drag.el.x=sn.x;drag.el.y=sn.y;const h=hostOf(drag.el.id);h.style.left=drag.el.x+'px';h.style.top=drag.el.y+'px';
    // RULE: the rest of the selection moves by the same (snapped) amount as the element being dragged.
    for(const q of drag.others){q.o.x=q.x0+sn.x-drag.x0;q.o.y=q.y0+sn.y-drag.y0;const hq=hostOf(q.o.id);if(hq){hq.style.left=q.o.x+'px';hq.style.top=q.o.y+'px'}}
    updateSel();if(boxesOn()&&!drag.others.length)boxHover(p.x,p.y)}
  else if(drag.type==='scale')scaleDrag(e);
});
// RULE: scaling follows image editors: corner scales freely, side one axis; Shift keeps ratio, Alt scales from center,
//   Ctrl/Cmd disables snapping. Modifiers may change mid-drag.
function snapAxis(m,mid,o,s0,s,lines){
  // INVARIANT: o, s0 = axis start and original length; s = new length. Returns s with the moving edge snapped.
  const lo=mid?o+(s0-s)/2:m>0?o:o+s0-s,hi=lo+s;
  let bd=null,f=0;
  for(const [v,ff] of mid?[[hi,2],[lo,-2]]:m>0?[[hi,1]]:[[lo,-1]]){const d=best([v],lines);if(d!==null&&(bd===null||Math.abs(d)<Math.abs(bd))){bd=d;f=ff}}
  if(bd!==null)return s+bd*f;
  const gs=gridStep();if(gs&&!mid){const v=m>0?hi:lo;return s+(Math.round(v/gs)*gs-v)*m}
  return s;
}
function setScaleLive(el){
  const host=hostOf(el.id);if(!host)return;host.style.left=el.x+'px';host.style.top=el.y+'px';host.style.pointerEvents=isScaled(el)?'none':'';
  const root=host.shadowRoot.querySelector('.__html');if(!root)return;
  if(isScaled(el)){root.style.setProperty('transform',`scale(${el.sx||1},${el.sy||1})`,'important');root.style.transformOrigin='0 0';root.style.pointerEvents='auto'}else root.style.removeProperty('transform');
}
function scaleDrag(e){
  const d=drag,p=mouse,mx=d.d.includes('e')?1:d.d.includes('w')?-1:0,my=d.d.includes('s')?1:d.d.includes('n')?-1:0;
  if(!d.moved){if(Math.hypot(p.x-d.px,p.y-d.py)<2)return;pushUndo();d.moved=true}
  const mid=e.altKey,ratio=e.shiftKey,k=mid?2:1,sd=d.snap,snap=snapping(e),MIN=4;
  let w=mx?d.w0+mx*(p.x-d.px)*k:d.w0,h=my?d.h0+my*(p.y-d.py)*k:d.h0;
  if(snap){if(mx)w=snapAxis(mx,mid,d.x0,d.w0,w,sd.xs);if(my)h=snapAxis(my,mid,d.y0,d.h0,h,sd.ys)}
  w=Math.max(MIN,w);h=Math.max(MIN,h);
  if(ratio){
    // RULE: a side drag leads with that side; a corner follows whichever axis moved further.
    const kx=w/d.w0,ky=h/d.h0,f=!my?kx:!mx?ky:Math.abs(kx-1)>=Math.abs(ky-1)?kx:ky,fm=Math.max(MIN/d.w0,MIN/d.h0,f);
    w=d.w0*fm;h=d.h0*fm;
  }
  const x=mid||(!mx&&ratio)?d.x0+(d.w0-w)/2:mx<0?d.x0+d.w0-w:d.x0;
  const y=mid||(!my&&ratio)?d.y0+(d.h0-h)/2:my<0?d.y0+d.h0-h:d.y0;
  const el=d.el;el.x=Math.round(x);el.y=Math.round(y);
  el.sx=Math.round(w/d.W*1e4)/1e4;el.sy=Math.round(h/d.H*1e4)/1e4;if(el.sx===1&&el.sy===1){delete el.sx;delete el.sy}
  setScaleLive(el);
  if(snap)guidesFor(sd,el.x,el.y,w,h);else drawGuides([]);
  updateSel();
  $('#selLabel').textContent=`${Math.round(w)} × ${Math.round(h)} px · ${Math.round((el.sx||1)*100)}% × ${Math.round((el.sy||1)*100)}%${ratio?' · proportional':''}${mid?' · from center':''}`;
}
// RULE: modifier changes mid-drag rescale immediately, without waiting for a pointer move.
for(const t of ['keydown','keyup'])addEventListener(t,e=>{
  if(!drag||drag.type!=='scale'||!['Shift','Alt','Control','Meta'].includes(e.key))return;
  e.preventDefault();e.stopPropagation();if(drag.moved)scaleDrag(e);
},true);
function endDrag(e){
  if(!drag)return;const d=drag;drag=null;drawGuides([]);
  // RULE: in Boxes, letting go tiles the element into the box under the pointer (Alt floats it).
  if(d.type==='move'&&d.moved){if(boxesOn()&&mouse&&!(d.others&&d.others.length))boxDrop(d.el,mouse.x,mouse.y,e&&e.altKey);boxHover(null);save()}
  else if(d.type==='scale'&&d.moved){renderEl(d.el);if(writing())confine(d.el);updateSel();renderInspector();save()}
}
stage.addEventListener('pointerup',endDrag);
stage.addEventListener('pointercancel',endDrag);
stage.addEventListener('dblclick',e=>{if(playing)return;
  // HACK: the stage holds pointer capture during a press, so dblclick targets the stage; hit-test the point instead.
  const under=document.elementFromPoint(e.clientX,e.clientY),hit=under&&stage.contains(under)?under:e.target;
  if(hit.classList.contains('h')){const el=selected();if(el&&isScaled(el)){pushUndo();delete el.sx;delete el.sy;renderEl(el);updateSel();renderInspector();save();status('Back to 100%')}return}const host=hit.closest&&hit.closest('.el');if(!host)return;const el=state.els.find(x=>x.id===host.dataset.id);if(!el)return;
  // RULE: double-clicking a group drills into the member under the pointer; from there it behaves as one element.
  if(el.group&&state.drill!==el.group){state.drill=el.group;select(el.id);status('Inside the group: this one on its own. Esc or a click outside takes the group again.');return}
  // RULE: in XMB the strip's Properties is the "more", so a double-tap always goes to the thing itself.
  const first=pressLog[1];if(first&&first.id===el.id&&first.was&&!document.body.classList.contains('xmb')){chooseContext(el,hostOf(el.id).getBoundingClientRect());return}
  // RULE: double-click takes a thing back to where it was made: a block to its text, a song button to the
  //   Sequencer, a picture to Paint; anything else edits its text in place.
  if(el.md){openDoc(el.md);showText(el.mdB);return}
  const sg=songOfEl(el.id);if(sg!==undefined){askOpenSong(el,sg);return}
  if(el.tag==='img'){studioOpenImage(el.content||IMG_PH,{kind:'el',id:el.id},el.w);return}
  startEdit(el)});


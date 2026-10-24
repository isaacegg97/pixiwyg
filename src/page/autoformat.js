// SECTION: autoformat
const BLOCKY=new Set(['h1','h2','h3','p','ul','ol','blockquote','table','pre','div','hr','nav','textarea']);
const afOpt={layout:lsGetEarly('pixiwyg.af.layout','column'),width:+lsGetEarly('pixiwyg.af.width','640')||640,gap:+lsGetEarly('pixiwyg.af.gap','24'),sheet:''};
const AF_PRESETS=[
  {id:'article',name:'Article',note:'One readable column',layout:'column',width:640,gap:24},
  {id:'notes',name:'Notes',note:'Narrow and compact',layout:'column',width:480,gap:12},
  {id:'wide',name:'Wide',note:'One roomy column',layout:'column',width:880,gap:32},
  {id:'newsletter',name:'Newsletter',note:'Two columns',layout:'two',width:960,gap:24},
  {id:'tidy',name:'Tidy',note:'Keep places, fix overlaps',layout:'tidy',width:640,gap:16},
];
const snapV=v=>{const g=gridStep();return g&&state.snap?Math.round(v/g)*g:Math.round(v)};
// RULE: on pages, reading order is page by page; pages side by side in a spread are not one row.
function readingOrder(list){
  if(isFixed()){const by=new Map();for(const el of list){const i=pageOf(el).i;if(!by.has(i))by.set(i,[]);by.get(i).push(el)}
    return[...by.keys()].sort((a,b)=>a-b).flatMap(i=>rowOrder(by.get(i)))}
  return rowOrder(list);
}
function rowOrder(list){
  const items=list.map(el=>({el,top:el.y,h:hostOf(el.id)?layoutBox(el).h:20})).sort((a,b)=>a.top-b.top);
  const rows=[];
  for(const it of items){const row=rows[rows.length-1];if(row&&it.top<row.top+Math.min(row.h,it.h)/2)row.items.push(it);else rows.push({top:it.top,h:it.h,items:[it]})}
  return rows.flatMap(r=>r.items.sort((a,b)=>a.el.x-b.el.x).map(i=>i.el));
}
// FIX: scale was deleted here, undoing every deliberate resize; widths now account for it instead.
function sizeFor(el,width){
  const k=el.sx||1,ww=Math.round(width/k);
  if(TEXTY.has(el.tag))el.w=el.tag==='textarea'?Math.min(ww,480):ww;
  else if(el.tag==='input'||el.tag==='select')el.w=Math.min(ww,el.w||360);
  else if(el.tag==='img'){if(!el.w||el.w>ww){el.w=null;if(measure(el).w>ww)el.w=ww}}
  else if(BLOCKY.has(el.tag)&&el.w&&el.w>ww)el.w=ww;
}
// SECTION: autoformat intent
// RULE: autoformat reads the page as it is for what the person meant, and keeps it:
//   - overlays: an element mostly covering a bigger one is decoration on it (a sticker on a picture) and moves with it;
//   - rows: elements side by side stay side by side, squeezed to fit the column if they must;
//   - closeness: a gap that was tight (a caption under its picture) stays tight; looser ones become the chosen gap;
//   - widths: only text blocks fill the column; boxes, pictures and buttons keep their width and their alignment
//     (left, centred or right) from where they were;
//   - elements tiled in Boxes and manuscript text are left to their own layout.
const TEXTY=new Set(['h1','h2','h3','p','ul','ol','blockquote','pre','table','textarea']);
function afModel(list){
  const R=new Map(list.map(el=>{const h=hostOf(el.id),b=h?layoutBox(el,h):{w:el.w||100,h:40};return[el,{x:el.x,y:el.y,w:b.w,h:b.h}]}));
  const area=r=>Math.max(1,r.w*r.h),inter=(a,b)=>Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x))*Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  const overlays=[],anchorOf=new Map();
  // RULE: text blocks are never decoration, however they overlap (fresh imports overlap before their first layout);
  //   a group member is part of its group, not decoration on something else.
  for(const el of list){if(TEXTY.has(el.tag)||el.group)continue;const r=R.get(el);let best=null,bo=0;
    for(const o of list){if(o===el)continue;const q=R.get(o);if(area(q)<=area(r)*1.2)continue;const v=inter(r,q)/area(r);if(v>bo){bo=v;best=o}}
    if(best&&bo>=.5)anchorOf.set(el,best)}
  // INVARIANT: an overlay's anchor is resolved to a flowing element, so chains (a sticker on a sticker) follow the base.
  const root=el=>{let a=anchorOf.get(el),n=0;while(a&&anchorOf.has(a)&&n++<20)a=anchorOf.get(a);return a};
  for(const el of anchorOf.keys()){const a=root(el);if(a){const r=R.get(el),q=R.get(a);overlays.push({el,anchor:a,dx:r.x-q.x,dy:r.y-q.y})}}
  const flow=list.filter(el=>!anchorOf.has(el));
  // RULE: a group flows as one item: its union box, with every member riding along.
  const items=groupUnits(flow).map(ms=>{if(ms.length===1)return{el:ms[0],r:R.get(ms[0])};const rs=ms.map(m=>R.get(m)),x=Math.min(...rs.map(r=>r.x)),y=Math.min(...rs.map(r=>r.y));
    return{el:ms[0],members:ms,r:{x,y,w:Math.max(...rs.map(r=>r.x+r.w))-x,h:Math.max(...rs.map(r=>r.y+r.h))-y}}}).sort((a,b)=>a.r.y-b.r.y||a.r.x-b.r.x),rows=[];
  for(const it of items){
    const row=rows.find(rw=>rw.items.every(o=>{const a=o.r,b=it.r,ov=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);return ov>=Math.min(a.h,b.h)*.5&&(b.x>=a.x+a.w-4||b.x+b.w<=a.x+4)})&&rw===rows[rows.length-1]);
    if(row)row.items.push(it);else rows.push({items:[it]});
  }
  for(const rw of rows){rw.items.sort((a,b)=>a.r.x-b.r.x);const xs=rw.items.map(i=>i.r);rw.x=Math.min(...xs.map(r=>r.x));rw.y=Math.min(...xs.map(r=>r.y));
    rw.w=Math.max(...xs.map(r=>r.x+r.w))-rw.x;rw.h=Math.max(...xs.map(r=>r.y+r.h))-rw.y}
  return{rows,overlays,R};
}
// RULE: alignment is judged against the page: centred if its middle sat within a tenth of the page's middle.
function afAlign(r,pageW){const c=r.x+r.w/2;if(Math.abs(c-pageW/2)<pageW*.1)return'center';if(r.x+r.w>pageW*.85&&r.x>pageW*.45)return'right';return'left'}
function flowBlocks(rows,x0,y0,width,gap,pageW){
  let y=y0,prev=null;
  for(const [i,rw] of rows.entries()){
    const head=rw.items.length===1&&/^h[1-3]$/.test(rw.items[0].el.tag);
    if(prev){const g0=rw.y-(prev.y+prev.h);y+=g0>=0&&g0<gap*.6?Math.max(4,Math.round(g0)):head?Math.round(gap*1.75):prev.head?Math.round(gap/2):gap}
    if(rw.items.length===1&&rw.items[0].members){
      const it=rw.items[0],al=afAlign(it.r,pageW),nx=snapV(al==='center'?x0+(width-it.r.w)/2:al==='right'?x0+width-it.r.w:x0),ny=snapV(y);
      for(const m of it.members){m.x=Math.round(m.x+nx-it.r.x);m.y=Math.round(m.y+ny-it.r.y)}y=ny+it.r.h;
    }else if(rw.items.length===1){
      const el=rw.items[0].el;sizeFor(el,width);const m=measure(el),w=m.w*(el.sx||1),h=m.h*(el.sy||1),al=TEXTY.has(el.tag)?'left':afAlign(rw.items[0].r,pageW);
      el.x=snapV(al==='center'?x0+(width-w)/2:al==='right'?x0+width-w:x0);el.y=snapV(y);y=el.y+h;
    }else{
      // RULE: a row keeps its own spacing; one wider than the column is scaled down to fit, text widths and all.
      const k=Math.min(1,width/Math.max(1,rw.w)),al=k<1?'left':afAlign(rw,pageW),rx=al==='center'?x0+(width-rw.w*k)/2:al==='right'?x0+width-rw.w*k:x0;let hMax=0;
      for(const it of rw.items){
        if(it.members){const nx=Math.round(rx+(it.r.x-rw.x)*k),ny=Math.round(y+(it.r.y-rw.y));for(const m of it.members){m.x=Math.round(m.x+nx-it.r.x);m.y=Math.round(m.y+ny-it.r.y)}hMax=Math.max(hMax,ny-y+it.r.h);continue}
        const el=it.el;if(k<1&&el.w)el.w=Math.max(40,Math.round(el.w*k));el.x=snapV(rx+(it.r.x-rw.x)*k);el.y=snapV(y+(it.r.y-rw.y));
        const m=measure(el);hMax=Math.max(hMax,el.y-y+m.h*(el.sy||1))}
      y+=hMax;
    }
    prev={y:rw.y,h:rw.h,head};
  }
  return y;
}
// INVARIANT: no grid snap here: the anchor is already snapped, and the offset from it is the intent.
function placeOverlays(overlays){for(const o of overlays){o.el.x=Math.round(o.anchor.x+o.dx);o.el.y=Math.round(o.anchor.y+o.dy)}}
function flowColumn(list,x0,y0,width,gap){
  let y=y0;
  for(const [i,el] of list.entries()){
    sizeFor(el,width);
    const head=/^h[1-3]$/.test(el.tag);
    if(head&&i>0)y+=Math.round(gap*.75);
    el.x=snapV(x0);el.y=snapV(y);
    const h=measure(el).h;
    y=el.y+h+(head?Math.round(gap/2):el.tag==='label'?Math.round(gap/4):gap);
  }
  for(const el of list)renderEl(el);
  updateSel();return y;
}
// RULE: a plain p/blockquote reaching a page's foot splits at a word and continues on the next.
const SPLITS=new Set(['p','blockquote']);
function splitToFit(el,maxH){
  const html=el.content??(TAGS[el.tag]||{}).content??'';if(!SPLITS.has(el.tag)||!plainHTML(html)||maxH<40)return null;
  const parts=html.split(' ');if(parts.length<4)return null;
  let lo=1,hi=parts.length-1,best=0;
  while(lo<=hi){const mid=(lo+hi)>>1;el.content=parts.slice(0,mid).join(' ');if(measure(el).h<=maxH){best=mid;lo=mid+1}else hi=mid-1}
  // RULE: fewer than three words before the break is not worth a split.
  if(best<3){el.content=html;return null}
  el.content=parts.slice(0,best).join(' ');
  const rest={...JSON.parse(JSON.stringify(el)),id:nid('e'),content:parts.slice(best).join(' '),flow:el.flow||el.id,flowN:(el.flowN||0)+1};
  el.flow=rest.flow;el.flowN=el.flowN||0;state.els.push(rest);return rest;
}
// INVARIANT: split pieces rejoin before a new layout so autoformat always starts from whole text.
function joinSplits(){
  const groups=new Map();for(const el of state.els)if(el.flow&&!el.md){if(!groups.has(el.flow))groups.set(el.flow,[]);groups.get(el.flow).push(el)}
  for(const g of groups.values()){g.sort((a,b)=>a.flowN-b.flowN);const [first,...rest]=g;first.content=g.map(e=>e.content).join(' ');delete first.flow;delete first.flowN;
    state.els=state.els.filter(e=>!rest.includes(e));for(const e of rest)dropHost(e.id);renderEl(first)}
}
function autoformat(opt=afOpt,again){
  if(!state.els.length){status('Nothing on the page to autoformat');return}
  if(!again)pushUndo();
  const f=opt.sheet?state.files.find(x=>x.id===opt.sheet&&x.enabled):null;
  if(f)for(const el of state.els){if(el.md)continue;const st=bestStyleIn(f,el.tag);if(el.fileId!==st.fileId)el.extra='';el.fileId=st.fileId;el.selector=st.selector}
  renderAll();
  const mine=state.els.filter(e=>!e.md&&!(boxesOn()&&e.box)),order=readingOrder(mine),gap=Math.max(0,+opt.gap||0),top=40;
  opt={...opt,width:Math.max(160,Math.min(+opt.width||640,W-32))};
  if(isFixed()&&opt.layout!=='tidy'){
    joinSplits();const M=afModel(readingOrder(state.els.filter(e=>!e.md&&!(boxesOn()&&e.box))));
    order.splice(0,order.length,...readingOrder(M.rows.flatMap(r=>r.items.map(i=>i.el))));
    // RULE: on pages a group flows as its first member; the others follow it by the same move.
    const lead=M.rows.flatMap(r=>r.items).filter(i=>i.members).map(i=>({el:i.el,x0:i.el.x,y0:i.el.y,rest:i.members.filter(m=>m!==i.el)}));
    const frames=()=>pageRects().flatMap(r=>{const cr=contentRect(r);if(opt.layout!=='two')return[cr];const cg=Math.max(16,gap),cw=Math.round((cr.w-cg)/2);return[{...cr,w:cw},{...cr,x:cr.x+cw+cg,w:cw}]});
    // INVARIANT: one flow engine for autoformat and manuscripts; no obstacles here, everything is being placed.
    var overflow=flowText(order,frames,gap,[]).over;for(const g of lead)for(const m of g.rest){m.x+=g.el.x-g.x0;m.y+=g.el.y-g.y0}placeOverlays(M.overlays);for(const el of state.els)if(!el.md)renderEl(el);
  }else if(opt.layout==='tidy'){
    const g=gridStep()||8;
    for(const el of order){el.x=Math.round(el.x/g)*g;el.y=Math.round(el.y/g)*g}
    const xs=[...new Set(order.map(e=>e.x))].sort((a,b)=>a-b),snapTo=new Map();
    for(const x of xs){const near=[...snapTo.values()].find(v=>Math.abs(v-x)<=16);snapTo.set(x,near??x)}
    for(const el of order)el.x=snapTo.get(el.x);
    const placed=[];
    for(const el of order){let {w,h:hh}=measure(el),moved=true;
      while(moved){moved=false;for(const p of placed){if(el.x<p.x+p.w&&el.x+w>p.x&&el.y<p.y+p.h+gap/2&&el.y+hh>p.y){el.y=Math.ceil((p.y+p.h+gap)/g)*g;moved=true}}}
      placed.push({x:el.x,y:el.y,w,h:hh})}
    for(const el of order)renderEl(el);
  }else{
    const M=afModel(order);
    if(opt.layout==='two'){
      const colGap=Math.max(24,gap*2),cw=Math.round((opt.width-colGap)/2),x0=Math.max(16,Math.round((W-opt.width)/2));
      const heights=M.rows.map(rw=>rw.h+gap),total=heights.reduce((a,b)=>a+b,0);let acc=0,split=M.rows.length;
      for(let i=0;i<M.rows.length;i++){acc+=heights[i];if(acc>=total/2){split=i+1;break}}
      // RULE: a heading never ends a column.
      while(split>1&&M.rows[split-1].items.length===1&&/^h[1-3]$/.test(M.rows[split-1].items[0].el.tag))split--;
      flowBlocks(M.rows.slice(0,split),x0,top,cw,gap,W);flowBlocks(M.rows.slice(split),x0+cw+colGap,top,cw,gap,W);
    }else flowBlocks(M.rows,Math.max(16,Math.round((W-opt.width)/2)),top,opt.width,gap,W);
    placeOverlays(M.overlays);for(const el of mine)renderEl(el);
  }
  if(opt.layout!=='tidy'&&!again)desk.scrollTo({top:0,left:0,behavior:'smooth'});
  // HACK: a sheet's web fonts start loading at first layout; measure again once they arrive.
  if(!again&&document.fonts&&document.fonts.status==='loading'){save();const g=editGen;document.fonts.ready.then(()=>{if(editGen===g)autoformat(opt,true)});return}
  if(state.docs.length)flowDocs();
  updateSel();renderInspector();save();sfx('boing');
  status(typeof overflow==='number'&&overflow?`Out of pages: ${overflow} element${overflow===1?' runs':'s run'} off the last page. ${state.canvas.type==='minizine'?'A mini zine has eight pages; try a smaller stylesheet or less text.':''}`
    :`Autoformatted ${order.length} element${order.length===1?'':'s'}${f?` with ${f.name}`:''}. Undo puts it back.`);
}


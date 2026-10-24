// SECTION: canvas types
// FORMAT: 'web' is the open page that grows with the window; the others are fixed pages on the desk. Booklets and
//   mini zines show as spreads and print imposed on sheets so folding (and one cut for a mini zine) orders the pages.
const MM=96/25.4,IN=96;
const PAPER={a3:{name:'A3',w:297,h:420,u:'mm'},a4:{name:'A4',w:210,h:297,u:'mm'},a5:{name:'A5',w:148,h:210,u:'mm'},a6:{name:'A6',w:105,h:148,u:'mm'},
  letter:{name:'US Letter',w:8.5,h:11,u:'in'},half:{name:'Half letter',w:5.5,h:8.5,u:'in'},tabloid:{name:'Tabloid',w:11,h:17,u:'in'}};
const SCREENS={square:{name:'Square post',w:1080,h:1080},story:{name:'Story',w:1080,h:1920},slide:{name:'Slide',w:1920,h:1080},banner:{name:'Banner',w:1500,h:500}};
// FORMAT: a sheet folded once gives booklet pages; folded into eighths, a mini zine.
const SHEETS=['a4','letter','a3','tabloid'];
const KINDS={
  web:{name:'Web page',note:'Grows with the window. Exports a web page.'},
  page:{name:'Flyer or poster',note:'Single printed pages, any paper size.'},
  booklet:{name:'Zine',note:'A folded, stapled booklet. Prints in fold order.'},
  minizine:{name:'Mini zine',note:'Eight pages from one sheet, one cut.'},
  screen:{name:'Screen',note:'Fixed pixel sizes for posts, stories and slides.'},
};
const paperPx=k=>{const p=PAPER[k],u=p.u==='mm'?MM:IN;return{w:p.w*u,h:p.h*u}};
const paperCSS=(k,land)=>{const p=PAPER[k];return land?`${p.h}${p.u} ${p.w}${p.u}`:`${p.w}${p.u} ${p.h}${p.u}`};
function cleanCanvas(c){
  c=c&&typeof c==='object'?c:{};const type=KINDS[c.type]?c.type:'web';if(type==='web')return{type};
  const num=(v,d,lo,hi)=>Math.round(numIn(v,d,lo,hi));
  const o={type,margin:numIn(c.margin,type==='screen'?48:12,0,200),bleed:numIn(c.bleed,type==='screen'?0:3,0,20),guides:c.guides!==false,
    folios:['outer','center'].includes(c.folios)?c.folios:c.folios===undefined&&(type==='booklet'||type==='minizine')?'outer':'none'};
  if(type==='page'){o.size=PAPER[c.size]?c.size:'a4';o.orient=c.orient==='landscape'?'landscape':'portrait';o.pages=num(c.pages,1,1,200)}
  if(type==='booklet'){o.sheet=SHEETS.includes(c.sheet)?c.sheet:'a4';o.pages=Math.max(4,Math.ceil(num(c.pages,8,4,200)/4)*4)}
  if(type==='minizine'){o.sheet=SHEETS.includes(c.sheet)?c.sheet:'a4';o.pages=8}
  if(type==='screen'){o.size=SCREENS[c.size]?c.size:'square';o.pages=num(c.pages,1,1,200);o.bleed=0}
  return o;
}
const isFixed=()=>state.canvas&&state.canvas.type!=='web';
function pageDims(c=state.canvas){
  if(c.type==='screen'){const s=SCREENS[c.size];return{w:s.w,h:s.h,css:`${s.w}px ${s.h}px`}}
  if(c.type==='page'){const p=paperPx(c.size),land=c.orient==='landscape';return{w:Math.round(land?p.h:p.w),h:Math.round(land?p.w:p.h),css:paperCSS(c.size,land)}}
  const s=paperPx(c.sheet),P=PAPER[c.sheet];
  // FORMAT: booklet = landscape sheet folded once; mini zine = landscape sheet in a 4x2 grid.
  if(c.type==='booklet')return{w:Math.round(s.h/2),h:Math.round(s.w),css:`${P.h/2}${P.u} ${P.w}${P.u}`};
  return{w:Math.round(s.h/4),h:Math.round(s.w/2),css:`${P.h/4}${P.u} ${P.w/2}${P.u}`};
}
const unitPx=c=>c.type==='screen'?1:MM;           // FORMAT: margins and bleed are mm on paper, px on screens.
const CPAD=56,CGAP=56;
function pageRects(c=state.canvas){
  if(!c||c.type==='web')return[{i:0,x:0,y:0,w:W,h:H}];
  const {w,h}=pageDims(c),out=[],n=c.pages;
  if(c.type==='booklet'||c.type==='minizine'){
    // FORMAT: spreads: cover alone on the right, then 2-3, 4-5 ..., back cover alone on the left.
    let row=0;out.push({i:0,x:CPAD+w,y:CPAD,w,h});
    for(let p=1;p<n-1;p+=2){row++;const y=CPAD+row*(h+CGAP);out.push({i:p,x:CPAD,y,w,h},{i:p+1,x:CPAD+w,y,w,h})}
    row++;out.push({i:n-1,x:CPAD,y:CPAD+row*(h+CGAP),w,h});
  }else for(let p=0;p<n;p++)out.push({i:p,x:CPAD,y:CPAD+p*(h+CGAP),w,h});
  return out;
}
function canvasSize(){const rs=pageRects();return{w:Math.max(...rs.map(r=>r.x+r.w))+CPAD,h:Math.max(...rs.map(r=>r.y+r.h))+CPAD}}
const contentRect=r=>{const m=Math.round((state.canvas.margin||0)*unitPx(state.canvas));return{x:r.x+m,y:r.y+m,w:r.w-2*m,h:r.h-2*m}};
// RULE: folios sit in the bottom margin, outside corner on spreads else centered; covers unnumbered.
function folio(i,off=0){
  const c=state.canvas;if(!c||!c.folios||c.folios==='none')return null;
  const spread=c.type==='booklet'||c.type==='minizine';if(spread&&(i===0||i===c.pages-1))return null;
  const m=Math.round(c.margin*unitPx(c)),right=!spread||i%2===0,pos=c.folios==='center'?`left:${off}px;right:${off}px;text-align:center`:right?`right:${m+off}px`:`left:${m+off}px`;
  return{text:String(i+1),style:`${pos};bottom:${Math.round(m/2)+off}px`};
}
function pageLabel(i){const c=state.canvas,n=c.pages;if(c.type==='booklet'||c.type==='minizine'){if(i===0)return'Front cover';if(i===n-1)return'Back cover'}return`Page ${i+1}`}
function applyCanvas(){
  const fixed=isFixed(),was=stage.classList.contains('fixed');stage.classList.toggle('fixed',fixed);desk.classList.toggle('fixed',fixed);
  // RULE: resp mode only applies to web canvases; fixed canvases have their own page rects.
  const resp=!fixed&&respModeOn();desk.classList.toggle('resp',resp);
  if(resp)desk.style.setProperty('--resp-w',respWidth()+'px');else desk.style.removeProperty('--resp-w');
  if(fixed){const s=canvasSize();W=Math.round(s.w);H=Math.round(s.h);stage.style.width=W+'px';stage.style.height=H+'px';syncZoom()}
  else{if(was){W=0;H=0}fitStage()}
  renderSheets();renderBackground();syncRespHud();
}
function renderSheets(){
  const box=$('#sheets');box.replaceChildren();if(!isFixed())return;
  const c=state.canvas,b=Math.round(c.bleed*unitPx(c)),m=Math.round(c.margin*unitPx(c)),spread=c.type==='booklet'||c.type==='minizine';
  for(const r of pageRects()){
    const s=mkEl('div',{className:'sheet'});Object.assign(s.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});s.dataset.page=r.i;
    if(c.guides){
      if(b){const g=mkEl('div',{className:'bleedg'});g.style.inset=`-${b}px`;s.append(g)}
      if(m){const g=mkEl('div',{className:'marging'});g.style.inset=`${m}px`;s.append(g)}
    }
    const fo=folio(r.i);if(fo){const f=mkEl('span',{className:'folio',textContent:fo.text});f.style.cssText=fo.style;s.append(f)}
    const lab=mkEl('span',{className:'sheetno',textContent:pageLabel(r.i)});if(spread&&r.i%2===1)lab.classList.add('l');s.append(lab);
    box.append(s);
  }
}
function pageOf(el){const rs=pageRects();return rs.find(r=>el.x>=r.x-1&&el.x<r.x+r.w&&el.y>=r.y-1&&el.y<r.y+r.h)||rs.reduce((b,r)=>{const d=Math.hypot(r.x+r.w/2-el.x,r.y+r.h/2-el.y);return d<b.d?{r,d}:b},{r:rs[0],d:Infinity}).r}
const posUnit=()=>isFixed()?unitPx(state.canvas):1;
// INVARIANT: w/h are the displayed size, scale included; wrap is the width text wraps at.
function posShow(el,k){
  const u=posUnit(),f=v=>u===1?Math.round(v):Math.round(v/u*10)/10;
  if(k==='w'||k==='h'){const h=hostOf(el.id);if(!h)return'';const b=elBox(el,h);return f(k==='w'?b.w:b.h)}
  if(k==='wrap')return el.w?f(el.w):'';
  if(!isFixed())return k==='page'?'':el[k]??'';
  const r=pageOf(el);
  return k==='page'?String(r.i):k==='x'?f(el.x-r.x):f(el.y-r.y);
}
function posSet(el,k,v,lock){
  const u=posUnit();
  // RULE: typing W or H scales, as the handles do; with the lock, proportionally.
  if(k==='w'||k==='h'){const h=hostOf(el.id),n=+v*u;if(!h||!(n>0))return;const W0=inkW(h,el.sx||1)||1,H0=h.offsetHeight||1,b=elBox(el,h);
    const k2=k==='w'?n/b.w:n/b.h;if(lock){el.sx=(el.sx||1)*k2;el.sy=(el.sy||1)*k2}else if(k==='w')el.sx=n/W0;else el.sy=n/H0;
    el.sx=Math.round(Math.min(20,Math.max(.01,el.sx||1))*1e4)/1e4;el.sy=Math.round(Math.min(20,Math.max(.01,el.sy||1))*1e4)/1e4;if(!isScaled(el)){delete el.sx;delete el.sy}return}
  if(k==='wrap'){el.w=v===''?null:Math.max(8,Math.round(+v*u));return}
  if(!isFixed()){el[k]=Math.round(+v||0);return}
  const r=pageOf(el);
  if(k==='page'){const t=pageRects().find(p=>p.i===+v);if(t){el.x+=t.x-r.x;el.y+=t.y-r.y}}
  else el[k]=r[k]+Math.round((+v||0)*u);
}
function pageSnapLines(xs,ys){
  for(const r of pageRects()){const cr=contentRect(r);
    for(const v of [r.x,r.x+r.w/2,r.x+r.w,cr.x,cr.x+cr.w])xs.push({v,a:r.y,b:r.y+r.h});
    for(const v of [r.y,r.y+r.h/2,r.y+r.h,cr.y,cr.y+cr.h])ys.push({v,a:r.x,b:r.x+r.w});}
}
function pageInView(){const v=viewCenter(),rs=pageRects();return rs.reduce((b,r)=>{const d=Math.hypot(r.x+r.w/2-v.x,r.y+r.h/2-v.y);return d<b.d?{r,d}:b},{r:rs[0],d:Infinity}).r}
function scrollToPage(i,instant){const r=pageRects().find(p=>p.i===i),zw=$('#zoomwrap');if(r)desk.scrollTo({left:Math.max(0,zw.offsetLeft+(r.x-24)*Z),top:Math.max(0,zw.offsetTop+(r.y-24)*Z),behavior:instant?'auto':'smooth'})}
// INVARIANT: zoom keeps the point under (cx,cy) fixed on screen.
function setZoom(z,cx,cy){
  z=Math.max(.1,Math.min(4,Math.round(z*100)/100));if(z===Z)return;
  const d=desk.getBoundingClientRect();if(cx==null){cx=d.left+d.width/2;cy=d.top+d.height/2}
  const r=stage.getBoundingClientRect(),px=(cx-r.left)/Z,py=(cy-r.top)/Z;
  Z=z;fitStage();syncZoom();
  const r2=stage.getBoundingClientRect();desk.scrollLeft+=r2.left+px*Z-cx;desk.scrollTop+=r2.top+py*Z-cy;
  updateSel();
}
const ZSTEPS=[.1,.25,.33,.5,.67,.75,.9,1,1.25,1.5,2,3,4];
const zoomStep=d=>setZoom(d>0?ZSTEPS.find(s=>s>Z+.001)??4:[...ZSTEPS].reverse().find(s=>s<Z-.001)??.1);
// RULE: fit makes the widest row of pages fill the view; the web canvas is always 100%.
function zoomFit(){if(!isFixed()){setZoom(1);return}const rs=pageRects(),w=Math.max(...rs.map(r=>r.x+r.w))-Math.min(...rs.map(r=>r.x));setZoom(Math.min(2,(desk.clientWidth-48)/w));scrollToPage(pageInView().i,true)}
$('#zOut').onclick=()=>{audio();zoomStep(-1)};$('#zIn').onclick=()=>{audio();zoomStep(1)};$('#zPct').onclick=()=>{audio();setZoom(1)};$('#zFit').onclick=()=>{audio();zoomFit()};
$('#desk').addEventListener('wheel',e=>{if(!(e.ctrlKey||e.metaKey))return;e.preventDefault();setZoom(Z*Math.exp(-e.deltaY*.0015),e.clientX,e.clientY)},{passive:false});
// RULE: only autoformat/flow grows the canvas; mini zines are fixed at 8, everything caps at 200 pages.
function growCanvas(){const c=state.canvas;if(c.type==='minizine'||c.pages>=200)return false;// RULE: flowed text fills pages in order, so the back cover is just the next page here.
  remapCanvas({...c,pages:c.pages+(c.type==='booklet'?4:1)},{flow:true});return true}
// INVARIANT: switching canvas keeps each element on the same page at the same spot. A zine's back cover stays last
//   when pages change; elements on removed pages move to the last page.
function remapCanvas(next,{flow}={}){
  const was=isFixed(),oc=state.canvas,spread=c=>c.type==='booklet'||c.type==='minizine';
  const at=state.els.map(el=>{if(!was)return{el,i:0,dx:el.x,dy:el.y};const r=pageOf(el);return{el,i:r.i,back:!flow&&spread(oc)&&r.i===oc.pages-1,dx:el.x-r.x,dy:el.y-r.y}});
  state.canvas=cleanCanvas(next);applyCanvas();
  let moved=0;
  // RULE: back to web keeps desk positions; the pages were already laid out end to end.
  if(isFixed()){const rs=pageRects(),last=rs.reduce((a,b)=>b.i>a.i?b:a),nc=state.canvas;
    for(const a of at){const i=a.back&&spread(nc)?nc.pages-1:a.i;let r=rs.find(p=>p.i===i);if(!r){r=last;moved++}a.el.x=r.x+a.dx;a.el.y=r.y+a.dy}renderAll()}
  renderCanvasWin();return moved;
}
function setCanvas(next,{quiet}={}){
  pushUndo();const moved=remapCanvas(next);renderInspector();renderPagesWin();save();if(!quiet)sfx('click');
  if(moved)status(`${moved} element${moved===1?' was':'s were'} on pages that are gone; ${moved===1?'it is':'they are'} on the last page now. Undo puts the pages back.`);
}
function canvasSummary(c=state.canvas){
  if(!c||c.type==='web')return'Web page';const k=KINDS[c.type].name;
  if(c.type==='screen')return`${k} · ${SCREENS[c.size].name}${c.pages>1?` · ${c.pages} pages`:''}`;
  if(c.type==='page')return`${PAPER[c.size].name} ${c.orient}${c.pages>1?` · ${c.pages} pages`:''}`;
  return`${k} · ${PAPER[c.sheet].name} sheets · ${c.pages} pages`;
}

function canvasFields(c,onChange){
  const box=mkEl('div',{className:'cvfields'});
  const sel=(label,opts,key,fmt=x=>x)=>{const l=mkEl('label',{className:'field2'}),s=mkEl('select');
    for(const [v,t] of opts)s.append(mkEl('option',{value:v,textContent:t}));s.value=String(c[key]);s.onchange=()=>onChange({...c,[key]:fmt(s.value)});l.append(label+' ',s);box.append(l)};
  if(c.type==='page'){sel('Paper',Object.entries(PAPER).map(([k,p])=>[k,`${p.name} · ${p.w} × ${p.h} ${p.u}`]),'size');sel('Orientation',[['portrait','Portrait'],['landscape','Landscape']],'orient')}
  if(c.type==='booklet'){sel('Printed on',SHEETS.map(k=>[k,`${PAPER[k].name} sheets`]),'sheet');sel('Pages',Array.from({length:16},(_,i)=>[String((i+1)*4),String((i+1)*4)]),'pages',Number)}
  if(c.type==='minizine')sel('Printed on',SHEETS.map(k=>[k,`one ${PAPER[k].name} sheet`]),'sheet');
  if(c.type==='screen')sel('Size',Object.entries(SCREENS).map(([k,s])=>[k,`${s.name} · ${s.w} × ${s.h}`]),'size');
  if(c.type!=='web'){const d=pageDims(c),u=c.type==='screen';box.append(mkEl('small',{className:'credit',textContent:`Each page is ${u?`${d.w} × ${d.h} px`:d.css.replace(' ',' × ')}.`}))}
  return box;
}
function renderCanvasWin(){
  const wb=$('#canvasWb');if(!wb)return;wb.replaceChildren();const c=state.canvas||{type:'web'};
  $('#canvasTitle').textContent='Canvas · '+canvasSummary(c);
  const tl=mkEl('label',{className:'field2'}),ts=mkEl('select');for(const [k,v] of Object.entries(KINDS))ts.append(mkEl('option',{value:k,textContent:v.name}));ts.value=c.type;
  ts.onchange=()=>setCanvas({...c,type:ts.value,pages:ts.value==='booklet'?8:1});tl.append('Type ',ts);wb.append(tl);
  wb.append(mkEl('small',{className:'credit',textContent:KINDS[c.type].note}));
  if(c.type==='web')return;
  wb.append(canvasFields(c,n=>setCanvas(n)));
  const unit=c.type==='screen'?'px':'mm',row=mkEl('div',{className:'blrow'});
  for(const [k,label] of [['margin','Margin'],['bleed','Bleed']]){if(k==='bleed'&&c.type==='screen')continue;
    const l=mkEl('label'),i=mkEl('input',{type:'number',min:0,step:c.type==='screen'?4:1,value:c[k]});i.onchange=()=>setCanvas({...c,[k]:+i.value||0},{quiet:true});l.append(`${label} (${unit}) `,i);row.append(l)}
  const fl=mkEl('label',{className:'field2'}),fs=mkEl('select');for(const [v,t] of [['none','None'],['outer','Outside corner'],['center','Centered']])fs.append(mkEl('option',{value:v,textContent:t}));
  fs.value=c.folios;fs.onchange=()=>setCanvas({...c,folios:fs.value},{quiet:true});fl.append('Page numbers ',fs);wb.append(fl);
  const g=mkEl('label',{className:'tog2'}),gc=mkEl('input',{type:'checkbox',checked:c.guides});gc.onchange=()=>setCanvas({...c,guides:gc.checked},{quiet:true});g.append(gc,' Show margins and bleed');row.append(g);
  wb.append(row);
  const pg=mkEl('div',{className:'cvpages'});
  for(const r of pageRects()){const b=mkEl('button',{type:'button',className:'btn',textContent:r.i+1,title:pageLabel(r.i)});b.onclick=()=>{audio();scrollToPage(r.i)};pg.append(b)}
  wb.append(mkEl('span',{className:'shelp',textContent:'Pages'}),pg);
  if(c.type!=='minizine'){const step=c.type==='booklet'?4:1,r2=mkEl('div',{className:'row'});
    const add=mkEl('button',{type:'button',className:'btn',textContent:`Add ${step>1?step+' pages':'a page'}`});add.onclick=()=>setCanvas({...c,pages:c.pages+step});
    const rm=mkEl('button',{type:'button',className:'btn',textContent:`Remove ${step>1?'the last '+step:'the last page'}`,disabled:c.pages<=step});rm.onclick=()=>setCanvas({...c,pages:c.pages-step});
    r2.append(add,rm);wb.append(r2)}
  if(c.type==='booklet'||c.type==='minizine')wb.append(mkEl('small',{className:'credit',textContent:c.type==='booklet'?'Export HTML can print these pages imposed: two to a sheet, in the order that folds and staples into the zine. Print double-sided, flipping on the short edge.':'Export HTML can print all eight pages on one sheet, ready to fold and cut. The top row prints upside down on purpose.'}));
}
let newKind={type:'web',sheet:'a4',pages:8,size:'a4',orient:'portrait'};
// RULE: a kind keeps the last picked size when it fits that kind, else takes the kind's default.
function kindCanvas(k){const c={...newKind,type:k};if(k==='screen'&&!SCREENS[c.size])c.size='square';if(k==='page'&&!PAPER[c.size])c.size='a4';return c}
function renderKindPicker(){
  const box=$('#tKinds');box.replaceChildren();
  for(const [k,v] of Object.entries(KINDS)){const b=mkEl('button',{type:'button',className:'pal kind'});b.dataset.k=k;b.setAttribute('aria-pressed',newKind.type===k);
    b.append(mkEl('span',{className:'kicon '+k}),mkEl('b',{textContent:v.name}),mkEl('i',{textContent:v.note}));
    b.onclick=()=>{audio();sfx('click');newKind=kindCanvas(k);renderKindPicker()};box.append(b)}
  const opts=$('#tKindOpts');opts.replaceChildren(canvasFields(cleanCanvas(newKind),n=>{newKind={...newKind,...n};renderKindPicker()}));
}


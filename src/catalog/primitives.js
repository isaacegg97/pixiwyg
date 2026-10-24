// SECTION: primitives
const PKEY='pixiwyg.prims';
const prims={list:[],cols:[],view:'*',sel:null};
const primSheets=new Map();
// COMPAT: the library moved from localStorage (a few MB, filled fast by drawings) to IndexedDB; migrates once.
async function loadPrims(){
  let d=null;try{d=await tx(['kv'],'readonly',s=>s.get('prims'))}catch(e){}
  if(!d){try{d=JSON.parse(localStorage.getItem(PKEY))}catch(e){}if(d&&Array.isArray(d.prims)){prims.list=d.prims;prims.cols=Array.isArray(d.cols)?d.cols:[];if(await writePrims())try{localStorage.removeItem(PKEY)}catch(e){}return true}return false}
  if(!Array.isArray(d.prims))return false;prims.list=d.prims;prims.cols=Array.isArray(d.cols)?d.cols:[];return true;
}
const writePrims=()=>tx(['kv'],'readwrite',s=>{s.put({v:1,prims:prims.list,cols:prims.cols},'prims')}).then(()=>true,()=>{status('This browser would not keep the primitive library. Export a collection to keep a copy.');return false});
let primT;function savePrims(){clearTimeout(primT);primT=setTimeout(writePrims,300);return true}
function addPrim(p,{quiet}={}){
  const x={id:nid('p'),name:p.name||'Untitled',kind:p.kind,collection:p.collection??(prims.view!=='*'?prims.view:''),data:p.data,created:Date.now()};
  if(x.collection&&!prims.cols.includes(x.collection))prims.cols.push(x.collection);
  prims.list.unshift(x);prims.sel=x.id;savePrims();renderPrims();
  if(!quiet){status(`Saved “${x.name}” to Primitives`);sfx('boing')}
  return x;
}
function primFromElement(el){
  const f=fileById(el.fileId),data={el:{tag:el.tag,content:el.content,attrs:el.attrs?{...el.attrs}:undefined,extra:el.extra||'',w:el.w||null,sx:el.sx,sy:el.sy,anim:el.anim?cleanGraph(el.anim,{anim:true}):undefined,pal:el.pal||(el.nopal?'off':undefined),colors:el.colors?JSON.parse(JSON.stringify(el.colors)):undefined},style:null};
  if(f){const t=makeTree(el),nodes=[t.node,...t.node.querySelectorAll('*')],css=cssFrom(pruneRules(f.sheet.cssRules,nodes,false)),low=css.toLowerCase();
    const faces=parseFaces(f.fonts||'').filter(x=>x.fam&&low.includes(x.fam)).map(x=>x.css).join('\n');
    data.style={sheet:f.name,lib:f.lib||null,selector:el.selector,css:(faces?faces+'\n':'')+css}}
  return{kind:'element',name:`${el.tag}${f?' · '+showSel(el.selector):''}`,data};
}
// SAFETY: imported content is untrusted; cleaned before it can render.
function cleanHTML(h){const t=document.createElement('template');t.innerHTML=String(h??'');
  // SAFETY: SVG animation elements can rewrite an href to javascript: after sanitizing, so they are removed too.
  t.content.querySelectorAll('script,iframe,object,embed,link,meta,base,frame,frameset,style,animate,set,animateTransform,animateMotion,handler,listener,portal').forEach(n=>n.remove());
  t.content.querySelectorAll('*').forEach(n=>{for(const a of [...n.attributes])if(unsafeAttr(a.name,a.value))n.removeAttribute(a.name)});
  return t.innerHTML}
const okImg=u=>typeof u==='string'&&/^data:image\/(png|jpe?g|gif|webp|avif|bmp|svg\+xml)[;,]/i.test(u);
const okHex=c=>typeof c==='string'&&/^#[0-9a-f]{3,8}$/i.test(c);
const cleanColor=v=>v&&v.none?{none:true}:{c:okHex(v&&v.c)?v.c:'#000000',role:Number.isInteger(v&&v.role)&&v.role>=0&&v.role<18?v.role:null};
const pick=(v,list,d)=>list.some(([x])=>x===v)?v:d,numIn=(v,d,lo,hi)=>Number.isFinite(+v)?Math.max(lo,Math.min(hi,+v)):d;
function cleanLayer(l){
  if(!l||!LAYER_NAMES[l.type])return null;const o={id:nid('l'),type:l.type,hidden:!!l.hidden};
  if(l.type==='image'){if(!okImg(l.src))return null;Object.assign(o,{src:l.src,w:numIn(l.w,200,1,8192),h:numIn(l.h,200,1,8192),fit:pick(l.fit,FITS,'cover'),pos:pick(l.pos,POSITIONS,'center'),scale:numIn(l.scale,100,1,2000)})}
  else if(l.type==='pattern')Object.assign(o,{kind:pick(l.kind,PAT_KINDS,'dots'),a:cleanColor(l.a),b:cleanColor(l.b),size:numIn(l.size,20,2,800),thick:numIn(l.thick,2,1,400),angle:numIn(l.angle,0,-720,720)});
  else Object.assign(o,{a:cleanColor(l.a),b:cleanColor(l.b),c:l.c?cleanColor(l.c):undefined,mid:!!l.mid,angle:numIn(l.angle,180,-720,720),shape:l.shape==='ellipse'?'ellipse':'circle',pos:pick(l.pos,POSITIONS,'center')});
  return o;
}
// SAFETY: outside elements (primitive, project file): known tag only, no handlers, no script URLs.
function cleanElData(e){
  if(!e||!TAGS[e.tag])return null;const attrs={};
  for(const [k,v] of Object.entries(e.attrs||{}))if(/^[\w:-]+$/.test(k)&&!unsafeAttr(k,v))attrs[k]=String(v);
  const content=e.tag==='img'?(okImg(e.content)?e.content:undefined):(e.content==null?undefined:cleanHTML(e.content));
  let colors;if(e.colors&&typeof e.colors==='object')for(const [k] of EL_COLORS)if(e.colors[k])(colors||={})[k]=cleanColor(e.colors[k]);
  const flow=typeof e.flow==='string'&&/^[\w-]{1,40}$/.test(e.flow)?e.flow:undefined;
  const ag=e.anim?cleanGraph(e.anim,{anim:true}):null,anim=ag&&ag.nodes.length?ag:undefined;
  const scl=v=>{const n=Math.round(numIn(v,1,.01,20)*1e4)/1e4;return n===1?undefined:n},sx=scl(e.sx),sy=scl(e.sy);
  return{tag:e.tag,content,attrs,extra:String(e.extra||'').replace(/[^\w\s-]/g,''),w:numIn(e.w,0,0,8192)||null,pal:['on','off'].includes(e.pal)?e.pal:undefined,colors,flow,flowN:flow?Math.round(numIn(e.flowN,0,0,999)):undefined,anim,sx,sy};
}
function cleanPrim(p){
  if(!p||!p.data)return null;const d=p.data,name=String(p.name||'Untitled').slice(0,80),collection=typeof p.collection==='string'?p.collection.slice(0,60):undefined;
  // FORMAT: a drawing may carry fx, its layer effects as a second picture laid over it (layer-fx.js).
  if(p.kind==='drawing')return okImg(d.src)?{kind:'drawing',name,collection,data:{src:d.src,w:numIn(d.w,200,1,8192),h:numIn(d.h,200,1,8192),...(okImg(d.fx)?{fx:d.fx}:{})}}:null;
  if(p.kind==='background'){const b=d.bg;if(!b||!Array.isArray(b.layers))return null;return{kind:'background',name,collection,data:{bg:{base:cleanColor(b.base),layers:b.layers.map(cleanLayer).filter(Boolean)}}}}
  if(p.kind==='group'){const items=(Array.isArray(d.items)?d.items:[]).slice(0,200).map(it=>{const c=it&&cleanPrim({kind:'element',name,data:it.data});return c?{dx:Math.round(numIn(it.dx,0,-20000,20000)),dy:Math.round(numIn(it.dy,0,-20000,20000)),data:c.data}:null}).filter(Boolean);
    return items.length>1?{kind:'group',name,collection,data:{items}}:null}
  // SAFETY: a model primitive is a model file and a texture image as data: URLs, plus settings checked when used.
  if(p.kind==='model'){if(typeof d.src!=='string'||!/^data:model\/(obj|stl);base64,[A-Za-z0-9+\/=]+$/.test(d.src))return null;
    const opt={};if(d.opt&&typeof d.opt==='object')for(const [k,v] of Object.entries(d.opt))if(/^\w{1,12}$/.test(k)&&['string','number','boolean'].includes(typeof v))opt[k]=typeof v==='string'?v.slice(0,40):v;
    return{kind:'model',name,collection,data:{src:d.src,tex:okImg(d.tex)?d.tex:undefined,opt,thumb:okImg(d.thumb)?d.thumb:undefined}}}
  if(p.kind==='element'){const el=cleanElData(d.el);if(!el)return null;
    const st=d.style&&typeof d.style.css==='string'?{sheet:String(d.style.sheet||'primitive.css').slice(0,80),lib:LIBRARY.some(l=>l.file===d.style.lib)?d.style.lib:null,selector:d.style.selector==null?null:String(d.style.selector),css:d.style.css}:null;
    return{kind:'element',name,collection,data:{el,style:st}}}
  return null;
}
function primSheet(p){
  if(primSheets.has(p.id))return primSheets.get(p.id);const st=p.data.style;let sh=null;
  if(st){const f=state.files.find(x=>x.name===st.sheet&&x.sels.some(([q])=>q===st.selector));
    if(f)sh=f.sheet;else{try{sh=new CSSStyleSheet();sh.replaceSync(st.css.replace(/@font-face\s*\{[^}]*\}/g,''))}catch(e){sh=null}}}
  primSheets.set(p.id,sh);return sh;
}
function thumbFor(p){
  const t=mkEl('div',{className:'pthumb'});
  if(p.kind==='drawing'){t.append(mkEl('img',{src:p.data.src,alt:''}));if(p.data.fx)t.append(mkEl('img',{src:p.data.fx,alt:'',className:'fxover'}))}
  else if(p.kind==='model'){if(p.data.thumb)t.append(mkEl('img',{src:p.data.thumb,alt:''}))}
  else if(p.kind==='group')return thumbFor({id:p.id+':0',kind:'element',data:p.data.items[0].data});
  else if(p.kind==='background'){const b=mkEl('div',{className:'bgthumb'});b.style.cssText=bgDecl(p.data.bg);t.append(b)}
  else{
    const sh=primSheet(p),el={...p.data.el,fileId:null,_sel:p.data.style?p.data.style.selector:null};
    const key=[THUMB_V,'prim',hashBytes(te.encode(JSON.stringify(p.data))).slice(0,12)].join('|');
    queueThumb({key,alive:()=>t.isConnected,make:()=>drawThumb(el,sh?[sh]:[],{fw:150,fh:84,bg:'transparent',fonts:p.data.style&&p.data.style.css}),
      put:url=>{if(url)thumbImg(t,url);else{const h=mkEl('div',{className:'elthumb'}),r=h.attachShadow({mode:'open'});r.adoptedStyleSheets=[...(sh?[sh]:[]),RESET];r.replaceChildren(makeTree(el).node);t.replaceChildren(h)}}});
  }
  return t;
}
async function resolvePrimSheet(st){
  // HACK: a library primitive always fits its own sheet, even when its selector only appears inside compound rules.
  const fits=f=>(st.lib&&f.lib===st.lib)||!st.selector||/^[a-z][a-z0-9-]*$/i.test(st.selector)||f.sels.some(([q])=>q===st.selector);
  let f=state.files.find(x=>x.name===st.sheet&&fits(x));
  if(f){if(!f.enabled){f.enabled=true;afterFilesChanged()}return f}
  if(st.lib&&!state.files.some(x=>x.lib===st.lib)){try{f=await addLib(st.lib);if(f){afterFilesChanged();if(fits(f))return f}}catch(e){}}
  const name=st.sheet.replace(/\.css$/i,'')+'.primitive.css';f=state.files.find(x=>x.name===name);
  if(f){if(!fits(f)){f.text+='\n'+st.css;compileFile(f)}f.enabled=true}else{f=addFile(name,st.css,false)}
  afterFilesChanged();status(`Added ${name} so the primitive keeps its look`);return f;
}
async function usePrim(p,at){
  const c=at||viewCenter();
  if(p.kind==='background'){pushUndo();state.bgd=cloneBg(p.data.bg);state.bgd.layers.forEach(l=>{l.id=nid('l')});renderBackground();renderBgWin();save();status(`Background: ${p.name}. Undo puts the old one back.`);sfx('boing');return}
  if(p.kind==='group'){await useGroupPrim(p,at);return}
  if(p.kind==='model'){if(!(await m3dUsePrim(p,at)))status('That model primitive could not be read.');return}
  let el;
  if(p.kind==='drawing')el={tag:'img',fileId:null,selector:null,w:p.data.w,content:p.data.src,attrs:{alt:p.name}};
  else{const e=JSON.parse(JSON.stringify(p.data.el));let fid=null,sel=null;if(p.data.style){const f=await resolvePrimSheet(p.data.style);if(f){fid=f.id;sel=p.data.style.selector}}el={...e,fileId:fid,selector:sel}}
  pushUndo();Object.assign(el,{id:nid('e'),x:Math.round(at?c.x:c.x-(el.w||200)/2),y:Math.round(at?c.y:c.y-40),z:maxZ()+1});
  state.els.push(el);renderEl(el);if(p.kind==='drawing'&&p.data.fx)pairFx(el,p.data.fx);select(el.id);save();sfx('pop');
}
function primDown(e,p,card,onClick){
  if(e.button>0)return;e.preventDefault();audio();card.setPointerCapture(e.pointerId);card.focus({preventScroll:true});
  const d={sx:e.clientX,sy:e.clientY,started:false};
  const mv=ev=>{
    if(!d.started){if(Math.hypot(ev.clientX-d.sx,ev.clientY-d.sy)<5)return;d.started=true;d.g=mkEl('div',{className:'primdrag'});d.g.append(thumbFor(p));document.body.append(d.g);document.body.classList.add('dragging')}
    d.g.style.left=(ev.clientX+10)+'px';d.g.style.top=(ev.clientY+10)+'px';
    const t=document.elementFromPoint(ev.clientX,ev.clientY);d.over=!!t&&stage.contains(t);d.g.style.opacity=d.over?'.95':'.4';d.at=d.over?pt(ev):null};
  const done=ev=>{card.removeEventListener('pointermove',mv);card.removeEventListener('pointerup',done);card.removeEventListener('pointercancel',done);
    if(!d.started){if(onClick)onClick();else{prims.sel=p.id;renderPrims()}return}
    d.g.remove();document.body.classList.remove('dragging');if(d.over&&ev.type==='pointerup')usePrim(p,d.at);else sfx('whoosh')};
  card.addEventListener('pointermove',mv);card.addEventListener('pointerup',done);card.addEventListener('pointercancel',done);
}
function renderPrims(){
  const sel=$('#primCol');sel.replaceChildren();
  sel.append(mkEl('option',{value:'*',textContent:`All primitives (${prims.list.length})`}));
  for(const c of prims.cols)sel.append(mkEl('option',{value:c,textContent:`${c} (${prims.list.filter(p=>p.collection===c).length})`}));
  sel.append(mkEl('option',{value:'',textContent:`Unsorted (${prims.list.filter(p=>!p.collection).length})`}));
  if(![...sel.options].some(o=>o.value===prims.view))prims.view='*';sel.value=prims.view;
  const grid=$('#primGrid');grid.replaceChildren();
  const list=prims.list.filter(p=>prims.view==='*'||(p.collection||'')===prims.view);
  if(!list.length)grid.append(mkEl('p',{className:'empty',textContent:'Nothing here yet. Save a drawing from the Paint Studio, an element from the Inspector, or the page background.'}));
  for(const p of list)grid.append(primCard(p));
  $('#primDelCol').hidden=!(prims.view&&prims.view!=='*');
  renderPrimBar();renderCatPrims();
}
function primCard(p,{onClick,title}={}){
  const c=mkEl('div',{className:'pcard'+(!onClick&&p.id===prims.sel?' on':''),tabIndex:0,title:title||`${p.name}. Drag onto the page, or press Enter.`});c.setAttribute('role','button');
  c.append(thumbFor(p),mkEl('i',{textContent:p.kind}),mkEl('span',{textContent:p.name}));
  c.addEventListener('pointerdown',e=>primDown(e,p,c,onClick));
  c.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();usePrim(p)}else if(e.key===' '){e.preventDefault();if(onClick)onClick();else{prims.sel=p.id;renderPrims()}}});
  return c;
}

// SECTION: primitives in the catalog
// RULE: the Primitives tab is the library (collections, export, rename); the catalog is where they get used. Each
//   element type's catalog leads with the primitives of that tag (drawings under <img>), filtered by the same search.
// PERF: lives in its own #catPrims box, so a library change redraws this group, never the catalog's style thumbnails.
// RULE: one short sideways-scrolling strip, folded until opened (remembered), so the stylesheet styles stay in view
//   at any panel height; the summary line still says how many primitives fit this tag.
const CAT_PRIM_CAP=24;
const catPrimsOpen={get v(){return lsGet('pixiwyg.catprims','0')==='1'},set v(o){lsSet('pixiwyg.catprims',o?'1':'0')}};
function primsForTag(tag,q){
  q=(q||'').trim().toLowerCase();
  return prims.list.filter(p=>(p.kind==='element'&&p.data.el&&p.data.el.tag===tag)||(p.kind==='drawing'&&tag==='img')||(p.kind==='model'&&tag==='div')||(p.kind==='group'&&p.data.items[0].data.el.tag===tag))
    .filter(p=>!q||(p.name+' '+(p.collection||'')+' primitive').toLowerCase().includes(q));
}
function renderCatPrims(box=$('#catPrims')){
  if(!box)return;box.replaceChildren();
  const tag=state.activeTag,list=primsForTag(tag,$('#search').value);if(!list.length)return;
  const key='prims:'+tag,all=!!state.showAll[key],det=mkEl('details',{className:'gen catprimbox'});det.open=catPrimsOpen.v;
  det.addEventListener('toggle',()=>{catPrimsOpen.v=det.open});
  const sum=mkEl('summary');sum.append(mkEl('b',{textContent:'Your primitives'}),mkEl('span',{textContent:` · ${list.length} for <${tag}>`}));
  const grid=mkEl('div',{className:'catprims'});
  for(const p of all?list:list.slice(0,CAT_PRIM_CAP))grid.append(primCard(p,{onClick:()=>usePrim(p),title:`${p.name}${p.collection?' · '+p.collection:''}. Click or drag to place it.`}));
  if(!all&&list.length>CAT_PRIM_CAP){const b=mkEl('button',{className:'btn more',type:'button',textContent:`Show all ${list.length}`});b.onclick=()=>{state.showAll[key]=true;renderCatPrims()};grid.append(b)}
  det.append(sum,grid);box.append(det);
}
function renderPrimBar(){
  const bar=$('#primBar');bar.replaceChildren();const p=prims.list.find(x=>x.id===prims.sel);if(!p)return;
  const name=mkEl('input',{type:'text',value:p.name});name.setAttribute('aria-label','Primitive name');name.onchange=()=>{p.name=name.value.trim()||p.name;savePrims();renderPrims()};
  const col=mkEl('select');col.setAttribute('aria-label','Collection');col.append(mkEl('option',{value:'',textContent:'Unsorted'}));for(const c of prims.cols)col.append(mkEl('option',{value:c,textContent:c}));
  col.value=p.collection||'';col.onchange=()=>{p.collection=col.value;savePrims();renderPrims()};
  const r1=mkEl('div',{className:'row'}),r2=mkEl('div',{className:'row'});r1.append(name,col);
  const b=(t,fn,title)=>{const x=mkEl('button',{className:'btn',textContent:t,type:'button'});if(title)x.title=title;x.onclick=()=>{audio();fn()};r2.append(x);return x};
  b(p.kind==='background'?'Apply to page':'Place on page',()=>usePrim(p));
  if(p.kind==='model')b('Open in 3D',async()=>{const mesh=m3dFromURL(p.data.src);if(!mesh)return;setWorkspace('model');await m3dSetModel(mesh,p.data.src,p.data.tex||null,{...p.data.opt,name:p.name})},'Bake it with other settings, or paint its texture');
  if(p.kind==='drawing')b('Edit',()=>studioOpenImage(p.data.src,{kind:'prim',id:p.id},p.data.w,p.data.h),'Open in the Paint Studio');
  b('Export',()=>openPrimExport([p],null),'Share just this one');
  b('Duplicate',()=>addPrim({...JSON.parse(JSON.stringify(p)),name:p.name+' copy'}));
  let armed=false;const del=b('Delete',()=>{if(!armed){armed=true;del.textContent='Click again to delete';setTimeout(()=>{armed=false;del.textContent='Delete'},3000);return}
    prims.list=prims.list.filter(x=>x!==p);prims.sel=null;primSheets.delete(p.id);savePrims();renderPrims();sfx('whoosh')});
  bar.append(r1,r2);
}
const primJSON=(list,label)=>JSON.stringify({type:'pixiwyg-primitives',version:1,collection:label||null,exported:new Date().toISOString(),primitives:list.map(({name,kind,collection,data})=>({name,kind,collection,data}))});
function showPrimModal(mode){
  const ex=mode==='export';$('#primText').readOnly=ex;$('#primCopy').hidden=!ex;$('#primFileLbl').hidden=ex;$('#primDoImport').hidden=ex;
  const kb=new Blob([$('#primText').value]).size/1024;$('#primSize').textContent=ex?(kb>1024?`${(kb/1024).toFixed(1)} MB`:`${Math.max(1,Math.round(kb))} KB`):'';
  $('#primModal').hidden=false;(ex?$('#primCopy'):$('#primText')).focus();
}
function openPrimExport(list,label){
  if(!list.length){status('Nothing to export in this view');return}
  $('#primTitle').textContent=list.length===1?`Export “${list[0].name}”`:`Export ${label||'primitives'}`;
  $('#primNote').textContent=`${list.length} primitive${list.length>1?'s':''}. Copy this into a .json file to share it or keep a backup. Drop the file onto PIXIWYG, or paste it under Import, to bring ${list.length>1?'them':'it'} back. Element primitives carry the CSS they need.`;
  $('#primText').value=primJSON(list,label);showPrimModal('export');
}
function openPrimImport(){$('#primTitle').textContent='Import primitives';$('#primNote').textContent='Paste exported primitives, or open the .json file. One-offs land in Unsorted; collections keep their name.';$('#primText').value='';showPrimModal('import')}
function importPrimText(text,{dedupe,quiet}={}){
  let d;try{d=JSON.parse(text)}catch(e){status('That is not valid primitives JSON');return 0}
  const list=d&&d.type==='pixiwyg-primitives'&&Array.isArray(d.primitives)?d.primitives:null;if(!list){status('No primitives found in that file');return 0}
  const label=typeof d.collection==='string'&&d.collection?d.collection.slice(0,60):null;let n=0;
  const seen=dedupe?new Set(prims.list.map(p=>p.kind+'|'+p.name+'|'+JSON.stringify(p.data))):null;
  for(const raw of list){const p=cleanPrim(raw);if(!p)continue;if(seen&&seen.has(p.kind+'|'+p.name+'|'+JSON.stringify(p.data)))continue;addPrim({...p,collection:label??p.collection??''},{quiet:true});n++}
  if(n){prims.view=label||'*';prims.sel=null;savePrims();renderPrims();if(!quiet){showWin('w-prims');sfx('boing')}}
  if(quiet)return n;
  status(n?`Imported ${n} primitive${n>1?'s':''}${label?` into “${label}”`:''}`:'Nothing in that file could be imported');
  return n;
}
$('#primCol').onchange=e=>{prims.view=e.target.value;prims.sel=null;renderPrims()};
$('#primNewCol').onclick=()=>{$('#primNewForm').hidden=false;$('#primNewName').focus()};
const addCol=()=>{const n=$('#primNewName').value.trim().slice(0,60);if(!n)return;if(!prims.cols.includes(n))prims.cols.push(n);prims.view=n;$('#primNewName').value='';$('#primNewForm').hidden=true;savePrims();renderPrims();status(`Collection “${n}”. Primitives you save now land here.`)};
$('#primNewGo').onclick=addCol;
$('#primNewName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addCol()}if(e.key==='Escape'){$('#primNewForm').hidden=true}});
let colArmed=false;
$('#primDelCol').onclick=e=>{const b=e.currentTarget,v=prims.view;if(!v||v==='*')return;
  if(!colArmed){colArmed=true;b.textContent='Click again to delete';setTimeout(()=>{colArmed=false;b.textContent='Delete collection'},3000);return}
  colArmed=false;b.textContent='Delete collection';prims.list.forEach(p=>{if(p.collection===v)p.collection=''});prims.cols=prims.cols.filter(c=>c!==v);prims.view='*';savePrims();renderPrims();status(`Deleted the collection. Its primitives are in Unsorted.`)};
$('#primExport').onclick=()=>{audio();const v=prims.view,list=prims.list.filter(p=>v==='*'||(p.collection||'')===v);openPrimExport(list,v==='*'?null:(v||'Unsorted'))};
$('#primImport').onclick=()=>{audio();openPrimImport()};
$('#primClose').onclick=()=>{$('#primModal').hidden=true};
$('#primModal').addEventListener('click',e=>{if(e.target.id==='primModal')$('#primModal').hidden=true});
$('#primCopy').onclick=()=>{const ta=$('#primText');navigator.clipboard.writeText(ta.value).then(()=>status('Copied. Paste it into a .json file.'),()=>{ta.focus();ta.select();status('Press Ctrl/Cmd+C to copy the selected text')})};
$('#primFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)$('#primText').value=await f.text()};
$('#primDoImport').onclick=()=>{if(importPrimText($('#primText').value))$('#primModal').hidden=true};
async function seedPrims(){
  const C='Starter kit';prims.list=[];prims.cols=[C];prims.view='*';
  let art=state._seedArt;delete state._seedArt;
  if(!art){art=document.createElement('canvas');art.width=1000;art.height=700;withCtx(art.getContext('2d'),()=>drawSeedArt(0,0))}
  const q={quiet:true};
  addPrim({kind:'background',name:'CRT grid',collection:C,data:{bg:{base:{c:'#0d140f',role:null},layers:[{id:nid('l'),type:'pattern',kind:'grid',a:{c:'#1f4d2a',role:null},b:{none:true},size:24,thick:1}]}}},q);
  addPrim({kind:'background',name:'Sunset',collection:C,data:{bg:{base:{c:'#1b1a2e',role:null},layers:[{id:nid('l'),type:'pattern',kind:'scanlines',a:{c:'#00000026',role:null},b:{none:true},size:4,thick:1},{id:nid('l'),type:'linear',a:{c:'#ff6ec7',role:7},b:{c:'#2e5bff',role:6},angle:180}]}}},q);
  addPrim({kind:'background',name:'Riso dots',collection:C,data:{bg:{base:{c:'#fff6e0',role:null},layers:[{id:nid('l'),type:'pattern',kind:'dots',a:{c:'#ff4fa3',role:null},b:{none:true},size:22,thick:3}]}}},q);
  for(const [sel,name] of [['.panel','Terminal panel'],['.window','Guestbook window'],['.nes-btn.is-primary','Press start button']]){const el=state.els.find(e=>e.selector===sel&&fileById(e.fileId));if(el)addPrim({...primFromElement(el),name,collection:C},q)}
  const hc=document.createElement('canvas');hc.width=hc.height=96;withCtx(hc.getContext('2d'),()=>stampAt({x:48,y:50},'🐴',80));
  addPrim({kind:'drawing',name:'Horse sticker',collection:C,data:{src:hc.toDataURL(),w:96,h:96}},q);
  const o=trimmedCanvas(art);if(o)addPrim({kind:'drawing',name:'Zine doodles',collection:C,data:{src:o.toDataURL(),w:o.width,h:o.height}},q);
  prims.sel=null;savePrims();
}


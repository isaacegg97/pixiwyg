// SECTION: projects
// FORMAT: a project file is a zip describing how to rebuild the page, not a snapshot of it.
//     manifest.json  stylesheets by reference, elements back to front, background, palette, defaults
//     styles/*.css   outside stylesheets as source text
//     docs/*.md      manuscripts
//     assets/*       images and fonts named by a hash of their bytes, each kept once
//   Library sheets, samples and schemes are named, never copied. Everything derived (compiled rules, recolored sheets,
//   ids, z numbers, manuscript components, node-styles.css) is rebuilt on open. IndexedDB stores exactly this shape, so
//   Save file only zips what is already stored.
const PROJ_FORMAT='pixiwyg-project',PROJ_VERSION=1;
let projLoading=false,lastSavedKey='',saving=Promise.resolve(true);
const te=new TextEncoder(),tdec=new TextDecoder();
const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(b){let c=~0;for(let i=0;i<b.length;i++)c=CRC_T[(c^b[i])&255]^(c>>>8);return(~c)>>>0}
// FORMAT: stored (no compression) with a fixed 1980-01-01 date, so a project always zips to the same bytes.
function zipFiles(entries){
  const parts=[],central=[];let off=0;
  for(const [name,data] of entries){
    const n=te.encode(name),d=typeof data==='string'?te.encode(data):data,crc=crc32(d);
    const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(12,0x21,true);
    h.setUint32(14,crc,true);h.setUint32(18,d.length,true);h.setUint32(22,d.length,true);h.setUint16(26,n.length,true);
    const c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);c.setUint16(14,0x21,true);
    c.setUint32(16,crc,true);c.setUint32(20,d.length,true);c.setUint32(24,d.length,true);c.setUint16(28,n.length,true);c.setUint32(42,off,true);
    parts.push(h,n,d);central.push(c,n);off+=30+n.length+d.length;
  }
  const size=central.reduce((t,x)=>t+x.byteLength,0),e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,entries.length,true);e.setUint16(10,entries.length,true);e.setUint32(12,size,true);e.setUint32(16,off,true);
  return new Blob([...parts,...central,e],{type:'application/zip'});
}
function hashBytes(b){let h1=0xdeadbeef,h2=0x41c6ce57;for(let i=0;i<b.length;i++){h1=Math.imul(h1^b[i],2654435761);h2=Math.imul(h2^b[i],1597334677)}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return(h2>>>0).toString(16).padStart(8,'0')+(h1>>>0).toString(16).padStart(8,'0')}
function b64bytes(t){const bin=atob(t),b=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)b[i]=bin.charCodeAt(i);return b}
function bytesB64(b){let t='';for(let i=0;i<b.length;i+=0x8000)t+=String.fromCharCode.apply(null,b.subarray(i,i+0x8000));return btoa(t)}
const DATA_RE=/data:([a-z0-9.+\/-]+)(?:;[a-z0-9=.+-]+)*;base64,([A-Za-z0-9+\/=]+)/gi;
const MIME_EXT={'audio/wav':'wav','audio/x-wav':'wav','audio/wave':'wav','audio/mpeg':'mp3','audio/mp3':'mp3','audio/ogg':'ogg','audio/flac':'flac','audio/x-flac':'flac','audio/mp4':'m4a','audio/aac':'aac','audio/webm':'weba','model/obj':'obj','model/stl':'stl','model/gltf-binary':'glb','model/gltf+json':'gltf','application/x-winamp-skin':'wsz','image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','image/avif':'avif','image/bmp':'bmp','image/svg+xml':'svg','image/x-icon':'ico','image/vnd.microsoft.icon':'ico','font/woff':'woff','font/woff2':'woff2','font/ttf':'ttf','font/otf':'otf','application/font-woff':'woff','application/font-woff2':'woff2','application/x-font-ttf':'ttf','application/x-font-woff':'woff','application/vnd.ms-fontobject':'eot'};
const slug=t=>String(t).toLowerCase().replace(/\.(css|pixiwyg)$/,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'untitled';
let assetMemo=new Map(),stripMemo=new Map();
const sortEntries=files=>[...files].sort(([a],[b])=>(a==='manifest.json'?-1:b==='manifest.json'?1:a<b?-1:a>b?1:0));
const filesKey=files=>sortEntries(files).map(([k,v])=>typeof v==='string'?k+'\n'+v:k).join('\0');

function packProject(){
  const files=new Map(),used=new Map(),memo=new Map(),nextStrip=new Map();
  // FORMAT: every base64 data: URL becomes an assets/ file and the text points at it.
  const asset=(url,mime,b64)=>{let a=memo.get(url)||assetMemo.get(url);
    if(!a){const bytes=b64bytes(b64);mime=mime.toLowerCase();a={path:`assets/${hashBytes(bytes).slice(0,12)}.${MIME_EXT[mime]||'bin'}`,type:mime,bytes}}
    memo.set(url,a);used.set(a.path,a);return a.path};
  // PERF: strings are immutable and V8 caches their hash, so a stripped result keyed by the string skips rescanning
  //   megabytes of base64 with DATA_RE on every autosave (90ms per pack at 126MB of images without it).
  const strip=(t,pre='')=>{if(typeof t!=='string'||!t.includes('data:'))return t;let e=stripMemo.get(t)?.[pre];
    if(e)for(const a of e.as)used.set(a.path,a);
    else{const as=[];e={out:t.replace(DATA_RE,(m,mime,b64)=>{const p=asset(m,mime,b64);as.push(used.get(p));return pre+p}),as}}
    const n=nextStrip.get(t)||{};n[pre]=e;nextStrip.set(t,n);return e.out};
  // INVARIANT: node-styles.css is derived; only the graphs are stored.
  const sgKeep=state.styleGraphs.map(x=>[x.id,{graph:cleanGraph(x.g,{style:true})}]).filter(([,y])=>y.graph.nodes.some(n=>n.type==='look'));
  const styleGraphs=sgKeep.map(([,y])=>y),sgIdx=new Map(sgKeep.map(([id],i)=>[id,i]));
  // FORMAT: brushes name their style graph by its place in styleGraphs (ids are made anew when a project opens).
  const brushes=(state.brushes||[]).map(b=>{const {id,...x}=cleanBrush(b,{id:b.id});return{...x,style:sgIdx.has(b.style)?sgIdx.get(b.style):null}});
  const sid=new Map(),stylesheets=state.files.filter(f=>!f.gen).map((f,i)=>{const id='s'+(i+1);sid.set(f.id,id);
    const o={id,name:f.name,enabled:!!f.enabled};
    if(f.lib)o.library=f.lib;
    else if(f.sample&&SAMPLES[f.name]===f.text)o.sample=f.name;
    else{o.file=`styles/${id}-${slug(f.name)}.css`;files.set(o.file,strip(f.text,'../'));if(f.path&&f.path!==f.name)o.origin=f.path}
    return o});
  const ref=fid=>fid!=null&&sid.has(fid)?sid.get(fid):null;
  // INVARIANT: manuscripts store as .md; their components are derived, never stored.
  const docs=state.docs.map((d,i)=>{const file=`docs/${i+1}-${slug(d.name)}.md`;files.set(file,d.text);
    const st={};for(const [tag,v] of Object.entries(d.styles||{})){const sh=v&&ref(v.fileId);if(sh)st[tag]=[sh,v.selector]}
    const pg=state.site&&d.pg?state.site.pages.findIndex(p=>p.id===d.pg):-1;
    return{name:d.name,file,...(ref(d.sheet)?{sheet:ref(d.sheet)}:{}),...(Object.keys(st).length?{styles:st}:{}),width:d.width,gap:d.gap,from:d.from||0,...(pg>0?{page:pg}:{})}});
  const pageIx=id=>state.site?state.site.pages.findIndex(p=>p.id===id):-1;
  const writeEl=el=>{
    const s=ref(el.fileId),o={tag:el.tag,sheet:s,selector:s?el.selector:null,x:el.x,y:el.y};
    if(el.w)o.w=el.w;
    if(isScaled(el)){o.sx=el.sx||1;o.sy=el.sy||1}
    // INVARIANT: generated navigation is derived from the pages; only its kind is stored.
    if(el.content!=null&&!el.nav)o.content=strip(el.content);
    if(el.attrs&&Object.keys(el.attrs).length)o.attrs=Object.fromEntries(Object.entries(el.attrs).map(([k,v])=>[k,strip(v)]));
    if(el.extra)o.extra=el.extra;
    const pm=palMode(el);if(pm!=='auto')o.palette=pm==='on'?'follow':'keep';
    if(el.colors)o.colors=JSON.parse(JSON.stringify(el.colors));
    if(el.box){o.box=el.box;o.bo=el.bo||0}
    if(el.group)o.group=el.group;
    if(el.flow){o.flow=sid.has(el.flow)?el.flow:String(el.flow);o.flowN=el.flowN||0}
    if(el.anim){const g=cleanGraph(el.anim,{anim:true});if(g.nodes.length)o.anim=g}
    if(el.from){const di=state.docs.findIndex(d=>d.id===el.from.doc);if(di>=0)o.from={doc:di,key:el.from.key,src:el.from.src}}
    // FORMAT: site fields name pages by their index in site.pages.
    if(el.shared){o.shared=true;if(el.only)o.only=el.only.map(pageIx).filter(i=>i>=0)}
    if(el.link&&pageIx(el.link)>=0)o.link=pageIx(el.link);
    if(el.nav&&NAV_KINDS[el.nav.kind])o.nav={kind:el.nav.kind};
    return o};
  // FORMAT: symbols = [{name, element}]; an instance carries symbol (index) and own (fields it keeps for itself), plus
  //   its full data, so a reader that ignores symbols still draws every copy.
  const symIx=new Map(state.syms.map((x,i)=>[x.id,i])),symbols=state.syms.map(x=>({name:x.name,element:writeEl(symEl(x))}));
  const hiddenShared=state.site?[...state.site.hidden].sort((a,b)=>(a.z||0)-(b.z||0)):[];
  const elements=[...[...state.els].filter(el=>!el.md).sort((a,b)=>(a.z||0)-(b.z||0)),...hiddenShared].map(el=>{const o=writeEl(el);
    if(el.sym&&symIx.has(el.sym)){o.symbol=symIx.get(el.sym);const own=SYM_OWN.filter(k=>el.own&&el.own[k]);if(own.length)o.own=own}return o});
  const order=[...state.els].filter(e=>!e.md).sort((a,b)=>(a.z||0)-(b.z||0)).map(e=>e.id);
  const songIx=id=>{const i=state.songs.findIndex(s=>s.id===id);return i<0?null:i};
  const pgRef=id=>{const i=pageIx(id);return i<0?null:i};
  const logic=cleanGraph(state.logic,{ref:id=>{const i=order.indexOf(id);return i<0?null:i},songRef:songIx,pageRef:pgRef}),songs=state.songs.map(cleanSong).filter(Boolean).map(s=>s.samples?{...s,samples:s.samples.map(x=>({...x,url:strip(x.url)}))}:s);
  // INVARIANT: written in the normal form opening produces, so save -> open -> save is byte-identical.
  const background={base:cleanColor(state.bgd.base),layers:state.bgd.layers.map(cleanLayer).filter(Boolean).map(({id,hidden,...l})=>{if(hidden)l.hidden=true;if(l.src)l.src=strip(l.src);return JSON.parse(JSON.stringify(l))})};
  // FORMAT: site = {current, pages:[{name, title, slug, nav, parent, elements?, logic?, background?, boxes?}]}; the
  //   current page's content is the manifest's own elements/logic/background (so one-page readers still work); each
  //   other page carries its own. Its logic names elements by index in [its own elements..., the shared ones it shows].
  //   Written only for sites of more than one page, so a one-page project saves exactly as before.
  let site=null;
  if(state.site&&state.site.pages.length>1){
    const S=state.site,sharedAll=[...state.els.filter(e=>e.shared),...S.hidden].sort((a,b)=>(a.z||0)-(b.z||0));
    const bgOut=b=>({base:cleanColor(b.base),layers:b.layers.map(cleanLayer).filter(Boolean).map(({id,hidden,...l})=>{if(hidden)l.hidden=true;if(l.src)l.src=strip(l.src);return JSON.parse(JSON.stringify(l))})});
    site={current:S.pages.findIndex(p=>p.id===S.cur),pages:S.pages.map(p=>{const o={name:p.name,slug:p.slug};if(p.title)o.title=p.title;if(p.nav===false)o.nav=false;if(p.parent&&pageIx(p.parent)>=0)o.parent=pageIx(p.parent);
      if(p.id!==S.cur&&p.store){const own=p.store.els.filter(e=>!e.md).sort((a,b)=>(a.z||0)-(b.z||0)),L=[...own,...sharedAll.filter(e=>onPage(e,p.id))].map(e=>e.id);
        o.elements=own.map(writeEl);const lg=cleanGraph(p.store.logic,{ref:id=>{const i=L.indexOf(id);return i<0?null:i},songRef:songIx,pageRef:pgRef});if(lg.nodes.length)o.logic=lg;
        if(p.store.bgd)o.background=bgOut(p.store.bgd);if(p.store.boxes)o.boxes=p.store.boxes}
      return o})};
  }
  let palette=null;
  if(state.palette){const P=state.palette,e=!P.custom&&SCHEMES.find(x=>x.n===P.name);palette=e&&schemeFromEntry(e).c.join()===P.c.join()?{scheme:P.name}:{name:P.name,colors:[...P.c]}}
  const defaults={};for(const [t,v] of Object.entries(state.nextStyle||{})){const s=ref(v.fileId);if(s||v.fileId==null)defaults[t]={sheet:s,selector:s?v.selector:null}}
  // FIX: the custom player skin is an asset, so it is extracted before the asset list is built.
  const player=state.player?state.player.skin==='custom'?{skin:'custom',name:state.player.name,file:strip(state.player.data)}:{skin:state.player.skin}:null;
  const list=[...used.values()].sort((a,b)=>a.path<b.path?-1:1);
  for(const a of list)files.set(a.path,a.bytes);
  // FORMAT: REFERENCES.md is derived from the manifest for people; opening ignores it.
  if(state.refs.length)files.set('REFERENCES.md',refsReadme());
  files.set('manifest.json',JSON.stringify({format:PROJ_FORMAT,version:PROJ_VERSION,app:'PIXIWYG '+APP_VERSION,name:state.project.name,canvas:cleanCanvas(state.canvas),page:{width:W,height:H},
    stylesheets,palette,paletteOptions:{...palOpt},background,defaults,elements,...(symbols.length?{symbols}:{}),...(logic.nodes.length?{logic}:{}),...(songs.length?{songs}:{}),...(docs.length?{docs}:{}),...(styleGraphs.length?{styleGraphs}:{}),...(brushes.length?{brushes}:{}),...(site?{site}:{}),...(WS[state.ws]?{workspace:state.ws}:{}),...(player?{player}:{}),...(state.refs.length?{references:state.refs.map(r=>({...r}))}:{}),...(Object.keys(state.groupNames||{}).length&&state.els.some(e=>e.group)?{groups:Object.fromEntries(Object.entries(state.groupNames).filter(([g])=>state.els.some(e=>e.group===g)))}:{}),...(state.boxes&&state.boxes.roots.length?{boxes:JSON.parse(JSON.stringify(state.boxes))}:{}),assets:list.map(a=>({path:a.path,type:a.type}))},null,2)+'\n');
  assetMemo=memo;stripMemo=nextStrip;
  return files;
}
function sheetRefs(f){
  const missing=new Set(),remote=new Set();let baked=0;
  for(const m of f.text.matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi)){const u=m[2].trim();if(/^data:/i.test(u))baked++;else if(!u.startsWith('#'))(isRemote(u)?remote:missing).add(u)}
  for(const m of f.text.matchAll(/@import\s+(['"])([^'"]+)\1/gi))(isRemote(m[2])?remote:missing).add(m[2]);
  f.missing=[...missing];f.remote=[...remote];f.baked=baked;
}
function resetProject(){
  if(state.editing)finishEdit();
  if(playing)setPlay(false);
  if(seqP.on)seqStop();
  PLAYER.stop();
  {const pw=document.body.dataset.ws;if(pw&&WS[pw]&&WS[pw].leave)WS[pw].leave();delete document.body.dataset.ws}
  curDoc=null;
  Object.assign(state,{brushes:[],site:null,ws:'',multi:new Set(),drill:null,groupNames:{},boxes:null,refs:[],syms:[],styleGraphs:[],docs:[],songs:[],player:null,music:null,logic:{nodes:[],wires:[]},canvas:{type:'web'},files:[],els:[],sel:null,nextStyle:{},palette:null,bgd:{base:{c:'#ffffff',role:0},layers:[]}});
  Object.assign(palOpt,{recolor:true,page:true,paint:true,flip:'auto'});
  undo.length=0;redo.length=0;hovering=null;palLabs=null;palBaseSheet=null;
  W=0;H=0;Z=1;stage.style.width=stage.style.height='';syncZoom();desk.scrollTo(0,0);
}
const fileText=v=>typeof v==='string'?v:tdec.decode(v);
// SAFETY: rebuilds state from untrusted files through the clean* functions; returns what could not be rebuilt.
async function readProject(files){
  let m;try{m=JSON.parse(fileText(files.get('manifest.json')))}catch(e){throw new Error('This file has no readable manifest.json')}
  if(!m||m.format!==PROJ_FORMAT)throw new Error('This is not a PIXIWYG project');
  if(!(m.version<=PROJ_VERSION))throw new Error('This project was made by a newer PIXIWYG');
  const urls=new Map();
  for(const a of Array.isArray(m.assets)?m.assets:[]){const b=a&&files.get(a.path);if(b&&typeof b!=='string')urls.set(String(a.path),`data:${String(a.type||ASSET_EXT[extOf(a.path)]||'application/octet-stream')};base64,${bytesB64(b)}`)}
  const restore=(t,pre='')=>{if(typeof t!=='string')return t;for(const [p,u] of urls)if(t.includes(pre+p))t=t.split(pre+p).join(u);return t};
  const lost=[];
  resetProject();
  state.canvas=cleanCanvas(m.canvas);
  if(!isFixed())sizeStage(numIn(m.page&&m.page.width,0,0,20000),numIn(m.page&&m.page.height,0,0,20000));
  const ids=new Map();
  for(const sh of Array.isArray(m.stylesheets)?m.stylesheets:[]){
    let f=null;const name=String(sh.name||sh.library||sh.sample||sh.file||'stylesheet.css');
    try{
      if(sh.library)f=await addLib(sh.library,sh.enabled!==false);
      else if(sh.sample&&SAMPLES[sh.sample]!=null)f=addFile(sh.sample,SAMPLES[sh.sample],true);
      else if(sh.file&&files.has(sh.file)){f=addFile(name,restore(fileText(files.get(sh.file)),'../'),false);if(sh.origin)f.path=String(sh.origin);sheetRefs(f)}
    }catch(e){}
    if(!f){lost.push(name);continue}
    f.enabled=sh.enabled!==false;ids.set(sh.id,f.id);
  }
  const sgAll=(Array.isArray(m.styleGraphs)?m.styleGraphs:[]).slice(0,200).map(x=>({id:nid('y'),g:cleanGraph(x&&x.graph,{style:true})}));
  state.styleGraphs=sgAll.filter(x=>x.g.nodes.some(n=>n.type==='look'));
  state.brushes=(Array.isArray(m.brushes)?m.brushes:[]).slice(0,64).filter(x=>x&&typeof x==='object').map(x=>{const g=Number.isInteger(x.style)?sgAll[x.style]:null;
    return cleanBrush({...x,id:null,style:g&&state.styleGraphs.includes(g)?g.id:null})});
  if(!allBrushes().some(b=>b.id===studio.brush))studio.brush='b:round';renderBrushes();
  syncNodeSheet(true);
  // INVARIANT: docs load before elements; a converted component references its manuscript.
  state.docs=(Array.isArray(m.docs)?m.docs:[]).slice(0,64).map(x=>{if(!x||typeof x!=='object')return null;const t=x.file&&files.get(String(x.file));if(t==null)return null;
    const st={};if(x.styles&&typeof x.styles==='object')for(const [tag,v] of Object.entries(x.styles))if(TAGS[tag]&&Array.isArray(v)&&ids.has(v[0]))st[tag]={fileId:ids.get(v[0]),selector:String(v[1]??'')};
    return{id:nid('d'),name:cleanDocName(x.name),text:fileText(t).slice(0,2e6),sheet:ids.get(x.sheet)??'',styles:st,width:Math.round(numIn(x.width,640,160,4000)),gap:Math.round(numIn(x.gap,16,0,200)),from:Math.round(numIn(x.from,0,0,199)),...(Number.isInteger(x.page)&&x.page>0?{pgIx:x.page}:{})}}).filter(Boolean);
  let z=0;
  const readEl=e=>{
    const c=e&&cleanElData({...e,content:restore(e.content),attrs:e.attrs&&Object.fromEntries(Object.entries(e.attrs).map(([k,v])=>[k,restore(v)])),pal:e.palette==='follow'?'on':e.palette==='keep'?'off':undefined});
    if(!c)return null;
    const fid=ids.get(e.sheet)??null,el={id:nid('e'),tag:c.tag,fileId:fid,selector:fid?String(e.selector??''):null,x:Math.round(numIn(e.x,0,-20000,20000)),y:Math.round(numIn(e.y,0,-20000,20000)),w:c.w,z:0};
    // FIX: empty content is kept: a shape is an element with nothing in it, not one waiting for default text.
    for(const k of ['content','attrs','extra','pal','colors','flow','flowN','anim','sx','sy'])if(c[k]!=null&&(c[k]!==''||k==='content')&&!(k==='attrs'&&!Object.keys(c[k]).length))el[k]=c[k];
    if(e.from&&typeof e.from==='object'){const dd=state.docs[+e.from.doc];if(dd)el.from={doc:dd.id,key:String(e.from.key||'').replace(/\W/g,'').slice(0,16),src:String(e.from.src||'').slice(0,20000)}}
    return el;
  };
  state.syms=(Array.isArray(m.symbols)?m.symbols:[]).slice(0,500).map(x=>{const el=x&&typeof x==='object'&&readEl(x.element);return el?{id:nid('s'),name:cleanSymName(x.name),...symFrom(el)}:null}).filter(Boolean);
  const readFull=(e,zz)=>{const el=readEl(e);if(!el)return null;el.z=zz;
    if(typeof e.box==='string'&&/^[\w-]{1,40}$/.test(e.box)){el.box=e.box;el.bo=Math.round(numIn(e.bo,0,0,9999))}
    if(typeof e.group==='string'&&/^[\w-]{1,40}$/.test(e.group))el.group=e.group;
    const sy=Number.isInteger(e.symbol)&&state.syms[e.symbol];
    if(sy){el.sym=sy.id;const own=(Array.isArray(e.own)?e.own:[]).filter(k=>SYM_OWN.includes(k));if(own.length)el.own=Object.fromEntries(own.map(k=>[k,1]))}
    // FORMAT: site fields hold page indexes until the pages exist (below).
    if(e.shared===true){el.shared=true;if(Array.isArray(e.only))el._only=e.only.filter(Number.isInteger)}
    if(Number.isInteger(e.link))el._link=e.link;
    if(e.nav&&NAV_KINDS[e.nav.kind]){el.nav={kind:e.nav.kind};el.content=''}
    return el};
  for(const e of Array.isArray(m.elements)?m.elements:[]){const el=readFull(e,++z);if(el)state.els.push(el)}
  const byIndex=state.els.map(e=>e.id);
  state.ws=WS_IDS.includes(m.workspace)?m.workspace:'';
  // COMPAT: older files have a single song under "music".
  state.songs=(Array.isArray(m.songs)?m.songs:m.music?[{name:'Song',...m.music}]:[]).slice(0,64).map(x=>x&&Array.isArray(x.samples)?{...x,samples:x.samples.map(s=>s&&{...s,url:restore(s.url)})}:x).map(cleanSong).filter(Boolean).map(x=>({id:nid('m'),...x}));
  state.music=state.songs[0]||null;
  state.player=cleanPlayer(m.player,restore);
  state.refs=cleanRefs(m.references);
  state.boxes=cleanBoxes(m.boxes);
  // INVARIANT: a group of one is no group; names are kept only for groups that still have members.
  {const n={};for(const el of state.els)if(el.group)n[el.group]=(n[el.group]||0)+1;for(const el of state.els)if(el.group&&n[el.group]<2)delete el.group;
    state.groupNames={};const src=m.groups&&typeof m.groups==='object'?m.groups:{};for(const g of Object.keys(n))if(n[g]>1)state.groupNames[g]=typeof src[g]==='string'?src[g].slice(0,60):'Group'}
  // INVARIANT: an element keeps its box only if that leaf exists in the stored tree.
  {const leaves=new Set();if(state.boxes)boxWalk(b=>{if(!b.split)leaves.add(b.id)});for(const el of state.els)if(el.box&&!leaves.has(el.box)){delete el.box;delete el.bo}}
  // FORMAT: page fields are page indexes on disk; they're marked here and resolved once the pages exist.
  const pgMark=v=>Number.isInteger(+v)&&v!==''?'@'+(+v):null;
  state.logic=cleanGraph(m.logic,{ref:v=>{const id=byIndex[+v];return Number.isInteger(+v)&&id?id:null},songRef:v=>{const x=state.songs[+v];return Number.isInteger(+v)&&x?x.id:null},pageRef:pgMark});
  const readBg=bg=>({base:bg&&bg.base?cleanColor(bg.base):{c:'#ffffff',role:0},layers:(bg&&Array.isArray(bg.layers)?bg.layers:[]).map(l=>cleanLayer(l&&{...l,src:restore(l.src)})).filter(Boolean)});
  state.bgd=readBg(m.background||{});
  // SECTION: site pages (see packProject): the current page is what was just read; the others go to their stores.
  {const SM=m.site&&Array.isArray(m.site.pages)&&m.site.pages.length>1?m.site:null;const all=[...state.els];
    if(SM){
      const pages=SM.pages.slice(0,100).map(p=>({id:nid('pg'),name:String(p&&p.name||'Page').slice(0,60),title:String(p&&p.title||'').slice(0,120),slug:'',nav:!(p&&p.nav===false),parent:null,store:null}));
      SM.pages.slice(0,100).forEach((p,i)=>{const q=p&&Number.isInteger(p.parent)&&pages[p.parent];if(q&&q!==pages[i])pages[i].parent=q.id});
      state.site={pages,cur:pages[Math.max(0,Math.min(pages.length-1,+SM.current||0))].id,hidden:[]};
      for(const [i,p] of pages.entries())p.slug=uniqueSlug(SM.pages[i]&&SM.pages[i].slug||p.name,p);
      const fix=el=>{if(el._only){const ids=el._only.map(i=>pages[i]&&pages[i].id).filter(Boolean);if(ids.length&&ids.length<pages.length)el.only=ids;delete el._only}if(el._link!=null){if(pages[el._link])el.link=pages[el._link].id;delete el._link}};
      all.forEach(fix);const shared=all.filter(e=>e.shared);
      state.els=all.filter(e=>!e.shared||onPage(e,state.site.cur));state.site.hidden=shared.filter(e=>!onPage(e,state.site.cur));
      SM.pages.slice(0,100).forEach((raw,i)=>{const p=pages[i];if(!raw||p.id===state.site.cur)return;let zz=0;
        const own=(Array.isArray(raw.elements)?raw.elements:[]).map(e=>readFull(e,++zz)).filter(Boolean);own.forEach(fix);
        const L=[...own,...shared.filter(e=>onPage(e,p.id))].map(e=>e.id);
        p.store={els:own,logic:cleanGraph(raw.logic,{ref:v=>{const id=L[+v];return Number.isInteger(+v)&&id?id:null},songRef:v=>{const x=state.songs[+v];return Number.isInteger(+v)&&x?x.id:null},pageRef:pgMark}),bgd:raw.background?readBg(raw.background):JSON.parse(JSON.stringify(state.bgd)),boxes:cleanBoxes(raw.boxes)}});
      for(const d of state.docs)if(d.pgIx!=null){if(pages[d.pgIx])d.pg=pages[d.pgIx].id;delete d.pgIx}
    }else for(const el of all){delete el._only;delete el._link}
    for(const d of state.docs)delete d.pgIx;
    const pagesNow=state.site?state.site.pages:[],res=g=>{for(const n of g.nodes||[])for(const [k,v] of Object.entries(n.f||{}))if(typeof v==='string'&&/^@\d+$/.test(v))n.f[k]=pagesNow[+v.slice(1)]?pagesNow[+v.slice(1)].id:''};
    res(state.logic);for(const p of pagesNow)if(p.store)res(p.store.logic)}
  const P=m.palette;
  if(P&&P.scheme){await schemesReady;const e=SCHEMES.find(x=>x.n===P.scheme);if(e)state.palette={...schemeFromEntry(e),custom:false};else lost.push(`the ${P.scheme} color scheme`)}
  else if(P&&Array.isArray(P.colors)&&P.colors.length===18&&P.colors.every(okHex))state.palette={name:String(P.name||'Custom').slice(0,80),c:P.colors.map(x=>x.toLowerCase()),custom:true};
  const po=m.paletteOptions||{};for(const k of ['recolor','page','paint'])if(typeof po[k]==='boolean')palOpt[k]=po[k];if(['auto','off','on'].includes(po.flip))palOpt.flip=po.flip;
  for(const [t,v] of Object.entries(m.defaults||{})){if(!TAGS[t]||!v)continue;const fid=ids.get(v.sheet)??null;if(fid||v.sheet==null)state.nextStyle[t]={fileId:fid,selector:fid?String(v.selector??''):null}}
  return{name:String(m.name||'Untitled').slice(0,80),lost};
}
function renderProject(){
  Z=1;applyCanvas();renderCanvasWin();syncZoom();if(isFixed())requestAnimationFrame(()=>{zoomFit();scrollToPage(0,true)});applyPageColors();buildSwatches();renderPalWin();renderBgWin();refreshFonts();renderFiles();renderLib();
  renderAll();boxesSync();renderPalette();renderStyles();renderInspector();
  $('#projName').value=state.project.name;document.title=state.project.name+' · PIXIWYG';
  // HACK: manuscripts reflow on open and again once web fonts arrive (they change every measurement).
  if(state.docs.length){flowDocs();const g=editGen,pid=state.project.id;if(document.fonts&&document.fonts.status==='loading')document.fonts.ready.then(()=>{if(editGen===g&&state.project&&state.project.id===pid)flowDocs()})}
  curDoc=state.docs[0]?state.docs[0].id:null;docSync();renderPagesWin();syncPageCmds();syncNav();
  setWorkspace(WS[state.ws]?state.ws:autoWs(),{force:true});
  if(iso.id)exitIso(true);renderTree();
}


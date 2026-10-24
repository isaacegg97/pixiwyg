// SECTION: thumbnails
// PERF: each catalog style is rasterised once (SVG foreignObject of its markup + pruned CSS + fonts) and cached in
//   memory and IndexedDB, so the catalog shows images instead of hundreds of live shadow roots. Undrawable ones stay live.
const THUMB_V=1,THUMB_SCALE=2,THUMB_MEM=800;
const thumbMem=new Map();
let thumbQueue=[],thumbBusy=false,appFaces=null;
const xml=new XMLSerializer();
async function facesFor(css,extra){
  if(!appFaces){try{appFaces=parseFaces(await fetchLib('fonts.css'))}catch(e){appFaces=[]}}
  const low=css.toLowerCase(),seen=new Set(),out=[];
  for(const f of [...parseFaces(extra||''),...appFaces])if(f.fam&&low.includes(f.fam)&&!seen.has(f.css)){seen.add(f.css);out.push(f.css)}
  return out.join('\n');
}
const sheetHash=f=>f?(f._hash||(f._hash=hashBytes(te.encode(f.text)).slice(0,12))):'none';
async function drawThumb(el,sheets,{fw,fh,bg,fg='#000',fonts}){
  const t=makeTree({...el,sx:null,sy:null}),host=mkEl('div');
  host.style.cssText=`position:fixed;left:-20000px;top:0;${el.w?`width:${el.w}px;`:''}font:16px/1.35 "Times New Roman",Times,serif;color:#000`;
  const root=host.attachShadow({mode:'open'});root.adoptedStyleSheets=[...sheets,RESET];root.append(t.node);document.body.append(host);
  try{
    await document.fonts.ready;
    const r=host.getBoundingClientRect(),w=Math.max(1,Math.ceil(r.width)),h=Math.max(1,Math.ceil(r.height));
    const nodes=[t.node,...t.node.querySelectorAll('*')];
    const css=sheets.map(sh=>{try{return cssFrom(pruneRules(sh.cssRules,nodes,false))}catch(e){return''}}).join('\n');
    const faces=await facesFor(css,fonts),pad=6,s=Math.min(1.5,(fw-2*pad)/w,(fh-2*pad)/h);
    const body=xml.serializeToString(t.node);
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${fw*THUMB_SCALE}" height="${fh*THUMB_SCALE}" viewBox="0 0 ${fw} ${fh}"><foreignObject x="0" y="0" width="${fw}" height="${fh}">`
      +`<thumb-frame xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;width:${fw}px;height:${fh}px;overflow:hidden;background:${bg};font:16px/1.35 'Times New Roman',Times,serif;color:${fg}">`
      +`<style><![CDATA[${RESET_CSS}\n${faces}\n${css}\n*,::before,::after{animation:none!important;transition:none!important}]]></style>`
      +`<thumb-box style="display:block;flex:none;width:${w}px;height:${h}px;transform:scale(${s})">${body}</thumb-box></thumb-frame></foreignObject></svg>`;
    const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await img.decode();
    const c=document.createElement('canvas');c.width=fw*THUMB_SCALE;c.height=fh*THUMB_SCALE;c.getContext('2d').drawImage(img,0,0,c.width,c.height);
    return c.toDataURL('image/webp',.86);
  }finally{host.remove()}
}
// INVARIANT: job = {key, make: () => Promise<dataURL>, put: (url|null) => void, alive: () => bool}
function queueThumb(job){
  const hit=thumbMem.get(job.key);if(hit){job.put(hit);return}
  // INVARIANT: deferred one tick; callers queue for an element they are about to insert.
  thumbQueue.push(job);setTimeout(pumpThumbs,0);
}
async function pumpThumbs(){
  if(thumbBusy)return;thumbBusy=true;
  try{
    while(thumbQueue.length){
      const job=thumbQueue.shift();if(!job.alive())continue;
      let url=thumbMem.get(job.key);
      if(!url){try{url=await tx(['kv'],'readonly',s=>s.get('thumb:'+job.key))}catch(e){}}
      if(!url){try{url=await job.make();tx(['kv'],'readwrite',s=>{s.put(url,'thumb:'+job.key)}).catch(()=>{})}catch(e){url=null}}
      // PERF: memory tier capped (FIFO by Map order); IndexedDB holds the rest, so an evicted thumb costs one read.
      if(url){thumbMem.set(job.key,url);if(thumbMem.size>THUMB_MEM)thumbMem.delete(thumbMem.keys().next().value)}
      job.put(url);
      await new Promise(r=>setTimeout(r,0));
    }
  }finally{thumbBusy=false}
}
const thumbImg=(box,url)=>{box.replaceChildren(mkEl('img',{src:url,alt:'',draggable:false}));box.classList.add('shot')};
const io=new IntersectionObserver(ents=>{for(const en of ents)if(en.isIntersecting){io.unobserve(en.target);fillPreview(en.target)}},{root:sgrid,rootMargin:'200px'});
function fillPreview(pv){
  const tag=state.activeTag,fid=pv.dataset.f||null,sel=pv.dataset.s||null,f=fid?fileById(fid):null,def=TAGS[tag]||{};
  // RULE: wide defaults draw narrower so text still reads at thumbnail size.
  const el={tag,fileId:fid,selector:sel,w:def.w?Math.min(def.w,240):null};
  const bg=colorOf(state.bgd.base),fg=pagePal()?palC(1):'#000',sheets=elementSheets(el,f);
  const key=[THUMB_V,'card',sheetHash(f),sel||'',tag,palOn(el)?palKey():'',bg,fg].join('|');
  queueThumb({key,alive:()=>pv.isConnected,make:()=>drawThumb(el,sheets,{fw:200,fh:124,bg,fg,fonts:f&&f.fonts}),
    put:url=>{if(url)thumbImg(pv,url);else{if(!pv.shadowRoot)pv.attachShadow({mode:'open'});buildInto(pv.shadowRoot,el)}}});
}
function makeCard(fid,sel,label){
  const c=document.createElement('div');c.className='scard';c.tabIndex=0;c.setAttribute('role','button');
  c.dataset.key=(fid||'')+'|'+(sel||'');c.setAttribute('aria-label','Use style '+label);
  const pv=document.createElement('div');pv.className='pv';pv.dataset.f=fid||'';pv.dataset.s=sel||'';
  const lab=document.createElement('code');lab.textContent=label;lab.title=label;
  c._f=fid||null;c._s=sel||null;c.append(pv,lab);io.observe(pv);
  c.addEventListener('pointerdown',e=>palDown(e,state.activeTag,c,{fileId:fid||null,selector:sel||null},()=>chooseStyle(fid,sel)));
  c.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();chooseStyle(fid,sel)}};
  c.onpointerenter=()=>hoverOn(fid,sel);c.onpointerleave=hoverOff;
  return c;
}
function renderStyles(){
  hoverOff();
  const tag=state.activeTag,q=$('#search').value.trim().toLowerCase();
  const groups=candidates(tag);
  const total=groups.reduce((a,g)=>a+g.exact.length+g.gen.length,0)+1;
  $('#styleTitle').innerHTML=`Catalog · <code>&lt;${tag}&gt;</code> · ${total} styles`;
  setShelp();
  sgrid.replaceChildren();
  const match=x=>!q||showSel(x).toLowerCase().includes(q);
  const top=document.createElement('div');top.className='ggrid';
  if(!q||'no stylesheet'.includes(q))top.append(makeCard(null,null,'no stylesheet'));
  sgrid.append(top);
  const cp=document.createElement('div');cp.id='catPrims';sgrid.append(cp);renderCatPrims(cp);
  for(const g of groups){
    const f=g.file,byName=!!q&&f.name.toLowerCase().includes(q),ex=byName?g.exact:g.exact.filter(match),gen=byName?g.gen:g.gen.filter(match);
    if(!ex.length&&!gen.length)continue;
    const head=document.createElement('div');head.className='ghead';
    head.innerHTML=`<b></b><span>${ex.length} for &lt;${tag}&gt; · ${gen.length} other classes</span>`;head.firstChild.textContent=f.name;
    sgrid.append(head);
    const grid=document.createElement('div');grid.className='ggrid';
    addCards(grid,f,ex,'x');sgrid.append(grid);
    if(gen.length){
      const det=document.createElement('details');det.className='gen';
      det.open=!!q&&gen.length<=60;
      det.innerHTML=`<summary>Other classes from <span></span> that might fit (${gen.length})</summary>`;det.querySelector('span').textContent=f.name;
      const gg=document.createElement('div');gg.className='ggrid';addCards(gg,f,gen,'g');det.append(gg);sgrid.append(det);
    }
  }
  if(sgrid.children.length===2&&!cp.childElementCount&&state.files.length===0){const e=document.createElement('div');e.className='empty';e.textContent='Add CSS files to see every style that can apply to this element.';sgrid.append(e)}
  markCards();
}
function setShelp(){const tag=state.activeTag,s=selected();
  $('#shelp').textContent=s&&s.tag===tag?'Drag a style onto the page to add another. Hover to try it on the selected element, click to keep it.':`Drag any style onto the page to add a <${tag}> that looks like that.`}
function addCards(grid,f,list,kind){
  const key=f.id+kind,cap=state.showAll[key]?Infinity:120;
  list.slice(0,cap).forEach(sel=>grid.append(makeCard(f.id,sel,showSel(sel))));
  if(list.length>cap){const b=document.createElement('button');b.className='btn more';b.textContent=`Show all ${list.length}`;b.onclick=()=>{state.showAll[key]=true;renderStyles()};grid.append(b)}
}
function markCards(){
  const tag=state.activeTag,s=selected();
  const cur=s&&s.tag===tag?{fileId:fileById(s.fileId)?s.fileId:null,selector:fileById(s.fileId)?s.selector:null}:nextStyleFor(tag);
  const k=(cur.fileId||'')+'|'+(cur.fileId?cur.selector||'':'');
  sgrid.querySelectorAll('.scard').forEach(c=>c.classList.toggle('on',c.dataset.key===k));
}
function chooseStyle(fid,sel){
  audio();sfx('pop');hoverOff();
  const tag=state.activeTag;state.nextStyle[tag]={fileId:fid,selector:sel};
  const el=selected();
  if(el&&el.tag===tag&&el.md){const d=docById(el.md),ci=el.mdB;pushUndo();d.styles[tag]={fileId:fid,selector:sel};flowDocs(d);
    const again=state.els.find(e=>e.md===d.id&&e.mdB===ci);state.sel=again?again.id:null;updateSel();renderInspector();markCards();save();
    status(`Every <${tag}> in “${d.name}” now wears ${sel?showSel(sel):'no style'}.`);return}
  if(el&&el.tag===tag){pushUndo();el.fileId=fid;el.selector=sel;renderEl(el);updateSel();renderInspector()}
  else status(`New <${tag}> elements will start as ${sel?showSel(sel):'unstyled'}`);
  markCards();save();
}
let hovering=null;
function hoverOn(fid,sel){const el=selected();if(!el||el.tag!==state.activeTag||state.editing||drag)return;const host=hostOf(el.id);if(!host)return;hovering=el.id;host._target=buildInto(host.shadowRoot,{...el,fileId:fid,selector:sel});updateSel()}
function hoverOff(){if(!hovering)return;const el=state.els.find(e=>e.id===hovering);hovering=null;if(el){renderEl(el);updateSel()}}
$('#search').addEventListener('input',renderStyles);

const escH=t=>String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
// SAFETY: template content is inert: images don't load and handlers don't fire, unlike a detached <div>.
const frag=h=>{const t=document.createElement('template');t.innerHTML=h||'';return t.content};
const plainHTML=h=>!/<(?!br\b)/i.test(h||'');
const toText=h=>frag((h||'').replace(/<br\s*\/?>/gi,'\n')).textContent;
const ATTRS={
  a:[['href','Link URL','text']],
  input:[['type','Input type','select:text email password number search tel url date time color range checkbox radio file'],['placeholder','Placeholder','text'],['value','Value','text']],
  textarea:[['placeholder','Placeholder','text'],['rows','Rows','number']],
  img:[['alt','Alt text','text']],
  button:[['disabled','State','select:|disabled']],
};

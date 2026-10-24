// SECTION: site pages (a web project as several pages, linked)
// RULE: a web canvas can hold several pages: Home, About, Gigs… Each has its own elements, logic, background and
//   Boxes layout; elements marked "On every page" (or on chosen pages) form a shared layer drawn on each. Pages are
//   ordered, can sit under a parent, and choose whether they show in navigation; generated navigation (a menu,
//   previous/next, breadcrumbs) is rebuilt from that whenever pages change. Logic routes with Go to page.
// INVARIANT: the current page lives in state (els, logic, bgd, boxes) exactly as a one-page project does, so the rest
//   of the app needs no idea that pages exist. Other pages wait in their page's store; switching swaps them in.
//   Shared elements always ride along in state.els; the ones the current page leaves out wait in site.hidden.
// FORMAT: state.site = {pages:[{id,name,title,slug,nav,parent,store}], cur, hidden}; store is null for the current
//   page, else {els, logic, bgd, boxes}. el.shared = true (on every page); el.only = [page ids] narrows it.
//   el.link = page id (a click goes there); el.nav = {kind:'menu'|'prevnext'|'crumbs'} (content is generated).
const siteSlug=v=>String(v||'').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,40)||'page';
function siteEnsure(){
  if(!state.site||!Array.isArray(state.site.pages)||!state.site.pages.length)state.site={pages:[{id:nid('pg'),name:'Home',title:'',slug:'home',nav:true,parent:null,store:null}],cur:null,hidden:[]};
  const s=state.site;if(!s.pages.some(p=>p.id===s.cur))s.cur=s.pages[0].id;if(!Array.isArray(s.hidden))s.hidden=[];return s;
}
const sitePage=id=>siteEnsure().pages.find(p=>p.id===id)||null;
const curPage=()=>sitePage(siteEnsure().cur);
const multiPage=()=>!!(state.site&&state.site.pages.length>1);
const siteOn=()=>!isFixed();
// RULE: a manuscript flows on the page it was started on (older projects: the first page).
const docOnPage=d=>!state.site||(d.pg&&sitePage(d.pg)?d.pg:state.site.pages[0].id)===state.site.cur;
const onPage=(el,pid)=>!el.only||!el.only.length||el.only.includes(pid);
function uniqueSlug(name,except){const s=siteEnsure(),base=siteSlug(name);let x=base,k=2;while(s.pages.some(p=>p!==except&&p.slug===x))x=`${base}-${k++}`;return x}
// FORMAT: pages in site order with their depth (children follow their parent).
function siteTree(){
  const s=siteEnsure(),out=[],seen=new Set();
  const walk=(parent,d)=>{for(const p of s.pages)if((p.parent||null)===parent&&!seen.has(p.id)){seen.add(p.id);out.push({p,d});walk(p.id,d+1)}};
  walk(null,0);for(const p of s.pages)if(!seen.has(p.id)){seen.add(p.id);out.push({p,d:0})}
  return out;
}
// SECTION: switching
const blankStore=()=>({els:[],logic:{nodes:[],wires:[]},bgd:JSON.parse(JSON.stringify(state.bgd)),boxes:null});
function stashPage(){const p=curPage();p.store={els:state.els.filter(e=>!e.shared),logic:state.logic,bgd:state.bgd,boxes:state.boxes};return[...state.els.filter(e=>e.shared),...state.site.hidden]}
function loadPage(id,shared){
  const s=state.site,p=sitePage(id),st=p.store||blankStore();p.store=null;s.cur=id;
  state.els=[...st.els,...shared.filter(e=>onPage(e,id))];s.hidden=shared.filter(e=>!onPage(e,id));
  state.logic=st.logic||{nodes:[],wires:[]};state.bgd=st.bgd||blankStore().bgd;state.boxes=st.boxes||null;
}
// RULE: going to a page re-draws it as if it had been open all along; the move itself is not an undo step.
function goPage(id,{quiet=false}={}){
  const s=siteEnsure();if(id===s.cur||!sitePage(id))return false;
  if(state.editing)finishEdit();if(iso.id)exitIso(true);select(null);
  const shared=stashPage();loadPage(id,shared);
  renderAll();renderBackground();renderBgWin();if(typeof boxesSync==='function')boxesSync();syncNav();
  if(state.docs.some(d=>(d.pg||s.pages[0].id)===id))flowDocs();
  renderInspector();renderTree();if(typeof docSync==='function')docSync();renderPagesWin();
  if(!quiet){status(`Page: ${curPage().name}`);sfx('whoosh')}
  if(!projLoading)save();
  return true;
}
function pageStep(d){const t=siteTree().map(x=>x.p),i=t.findIndex(p=>p.id===state.site.cur);const n=t[i+d];if(n)goPage(n.id)}
// SECTION: managing pages
function addPage(name,{dup=false}={}){
  if(!siteOn()){status('Pages are for web canvases; printed canvases have their own pages under Canvas.');return null}
  const s=siteEnsure();pushUndo();const cur=curPage(),p={id:nid('pg'),name:String(name||`Page ${s.pages.length+1}`).slice(0,60),title:'',nav:true,parent:cur.parent||null,store:null};p.slug=uniqueSlug(p.name);
  if(dup){p.store={els:state.els.filter(e=>!e.shared).map(e=>({...JSON.parse(JSON.stringify(e)),id:nid('e')})),logic:{nodes:[],wires:[]},bgd:JSON.parse(JSON.stringify(state.bgd)),boxes:null}}
  s.pages.splice(s.pages.indexOf(cur)+1,0,p);goPage(p.id,{quiet:true});syncNav();syncPageCmds();save();
  status(`New page “${p.name}”. Its address is #${p.slug}; Pages (in Properties) has its settings.`);return p;
}
async function deletePage(id){
  const s=siteEnsure(),p=sitePage(id);if(!p||s.pages.length<2)return;
  if(await ask(`Remove the page “${p.name}”?`,'Everything on it goes with it (shared elements stay). Undo brings it back.',[{id:'del',label:'Remove it',primary:true},{id:null,label:'Cancel'}])!=='del')return;
  pushUndo();if(s.cur===id){const t=siteTree().map(x=>x.p),o=t[t.indexOf(p)-1]||t[t.indexOf(p)+1];goPage(o.id,{quiet:true})}
  s.pages=s.pages.filter(x=>x!==p);for(const x of s.pages)if(x.parent===id)x.parent=p.parent||null;
  for(const e of [...state.els,...s.hidden])if(e.only)e.only=e.only.filter(x=>x!==id);
  for(const e of state.els)if(e.link===id)delete e.link;
  syncNav();renderTree();renderPagesWin();syncPageCmds();save();status(`Removed ${p.name}.`);
}
function movePage(id,d){const s=siteEnsure(),i=s.pages.findIndex(p=>p.id===id),j=i+d;if(i<0||j<0||j>=s.pages.length)return;pushUndo();[s.pages[i],s.pages[j]]=[s.pages[j],s.pages[i]];syncNav();renderTree();renderPagesWin();save()}
function setPageProp(id,k,v){const p=sitePage(id);if(!p)return;pushUndo();
  if(k==='name'){p.name=String(v).trim().slice(0,60)||p.name}else if(k==='slug'){p.slug=uniqueSlug(v||p.name,p)}else if(k==='title'){p.title=String(v).slice(0,120)}
  else if(k==='nav'){p.nav=!!v}else if(k==='parent'){let q=v&&sitePage(v);while(q){if(q.id===id){status('A page can’t sit under itself.');return}q=q.parent&&sitePage(q.parent)}p.parent=v||null}
  syncNav();renderTree();renderPagesWin();if(typeof syncPageCmds==='function')syncPageCmds();save()}
// SECTION: generated navigation
// FORMAT: mode 'hash' links #slug (editor, single-file export); 'files' links slug.html (site export), home index.html.
const pageHref=(p,mode)=>mode==='files'?(p===siteEnsure().pages[0]?'index.html':`${p.slug}.html`):`#${p.slug}`;
function navHTML(nav,pid,mode='hash'){
  const t=siteTree(),cur=sitePage(pid),a=(p,txt=p.name,rel='')=>`<a href="${pageHref(p,mode)}" data-pxpage="${p.id}"${rel?` rel="${rel}"`:''}${p.id===pid?' aria-current="page"':''}>${escH(txt)}</a>`;
  if(nav.kind==='prevnext'){const vis=t.map(x=>x.p),i=vis.indexOf(cur),pr=vis[i-1],nx=vis[i+1];
    return`${pr?a(pr,'← '+pr.name,'prev'):'<span></span>'} ${nx?a(nx,nx.name+' →','next'):'<span></span>'}`}
  if(nav.kind==='crumbs'){const path=[];let q=cur;while(q){path.unshift(q);q=q.parent&&sitePage(q.parent)}if(path[0]!==t[0].p)path.unshift(t[0].p);
    return path.map((p,i)=>i===path.length-1?`<span aria-current="page">${escH(p.name)}</span>`:a(p)).join(' › ')}
  // FORMAT: the menu is a nested list; pages hidden from navigation are left out, with their children lifted up.
  const shown=p=>p.nav!==false,kids=parent=>siteEnsure().pages.filter(p=>(p.parent||null)===parent);
  const list=parent=>{const items=[];for(const p of kids(parent)){if(shown(p)){const sub=list(p.id);items.push(`<li>${a(p)}${sub?`<ul>${sub}</ul>`:''}</li>`)}else items.push(list(p.id))}return items.join('')};
  return`<ul>${list(null)}</ul>`;
}
function syncNav(mode='hash'){if(!state.els.some(e=>e.nav))return;const pid=siteEnsure().cur;for(const el of state.els)if(el.nav){const c=navHTML(el.nav,pid,mode);if(el.content!==c){el.content=c;if(hostOf(el.id))renderEl(el)}}}
const NAV_KINDS={menu:'Navigation menu',prevnext:'Previous / next',crumbs:'Breadcrumbs'};
function addNav(kind){
  if(!siteOn())return;pushUndo();const c=viewCenter(),st=nextStyleFor('nav'),el={id:nid('e'),tag:'nav',fileId:st.fileId,selector:st.selector,x:Math.round(c.x-160),y:Math.round(c.y-20),w:kind==='menu'?520:360,z:maxZ()+1,nav:{kind},shared:true};
  el.content=navHTML(el.nav,state.site?state.site.cur:siteEnsure().cur);state.els.push(el);renderEl(el);select(el.id);save();
  status(`${NAV_KINDS[kind]} added, on every page. It rebuilds itself when pages change; style it like any nav.`);
}
// SECTION: the Pages section (Properties, with nothing selected)
function renderPagesWin(){
  const sect=$('#w-pages'),wb=$('#pagesWb');if(!sect||!wb)return;sect.hidden=!siteOn()||!state.project;if(sect.hidden)return;
  const s=siteEnsure(),cur=curPage();$('#pagesTitle').textContent=s.pages.length>1?`Pages · ${s.pages.length}`:'Pages';wb.replaceChildren();
  const list=mkEl('div',{className:'pglist',role:'listbox'});list.setAttribute('aria-label','Pages');
  for(const {p,d} of siteTree()){const b=mkEl('button',{type:'button',className:'pgitem'+(p.id===s.cur?' on':''),title:`#${p.slug}`});b.style.paddingLeft=(8+d*14)+'px';
    b.setAttribute('role','option');b.setAttribute('aria-selected',p.id===s.cur);b.append(mkEl('span',{textContent:(p.id===s.cur?'▸ ':'')+p.name}),mkEl('small',{textContent:p.nav===false?'hidden from nav':'#'+p.slug}));
    b.onclick=()=>{audio();goPage(p.id)};list.append(b)}
  const row=(...xs)=>{const r=mkEl('div',{className:'row'});r.append(...xs);return r},btn=(t,fn,title)=>{const b=mkEl('button',{type:'button',className:'btn sqm',textContent:t,title:title||''});b.onclick=()=>{audio();fn()};return b};
  const fld=(label,inp)=>{const l=mkEl('label',{className:'field2'});l.append(label,' ',inp);return l};
  const name=mkEl('input',{type:'text',value:cur.name,maxLength:60});name.onchange=()=>setPageProp(cur.id,'name',name.value);
  const slug=mkEl('input',{type:'text',value:cur.slug,maxLength:40,spellcheck:false});slug.onchange=()=>setPageProp(cur.id,'slug',slug.value);
  const title=mkEl('input',{type:'text',value:cur.title||'',placeholder:cur.name,maxLength:120});title.onchange=()=>setPageProp(cur.id,'title',title.value);
  const parent=mkEl('select');parent.append(mkEl('option',{value:'',textContent:'(top level)'}));for(const p of s.pages)if(p.id!==cur.id)parent.append(mkEl('option',{value:p.id,textContent:p.name}));parent.value=cur.parent||'';parent.onchange=()=>setPageProp(cur.id,'parent',parent.value);
  const nav=mkEl('input',{type:'checkbox',checked:cur.nav!==false});nav.onchange=()=>setPageProp(cur.id,'nav',nav.checked);const navL=mkEl('label',{className:'tog2'});navL.append(nav,' Show in navigation');
  wb.append(list,row(btn('+ New page',()=>addPage(),'Add a page after this one (Alt+PageDown moves to the next)'),btn('Duplicate',()=>addPage(cur.name+' copy',{dup:true})),btn('↑',()=>movePage(cur.id,-1),'Earlier'),btn('↓',()=>movePage(cur.id,1),'Later'),...(s.pages.length>1?[btn('×',()=>deletePage(cur.id),'Remove this page')]:[])),
    fld('Name',name),fld('Address #',slug),fld('Tab title',title),fld('Under',parent),navL,
    mkEl('h4',{className:'pgh',textContent:'Navigation'}),row(...Object.entries(NAV_KINDS).map(([k,t])=>btn('+ '+t,()=>addNav(k)))),
    mkEl('p',{className:'shelp',textContent:'Generated navigation rebuilds itself as pages change. Any element can link to a page (Inspector › Layout), and logic can route with Go to page.'}));
}
// SECTION: an element's place in the site (Inspector, Layout)
function sitePlaceRow(el,form,mk){
  if(!siteOn()||el.md)return;const s=siteEnsure(),box=mk('div',{className:'siterow'});
  const on=mk('input',{type:'checkbox',checked:!!el.shared}),l=mk('label',{className:'tog2'});l.append(on,' On every page');
  on.onchange=()=>{pushUndo();if(on.checked){el.shared=true}else{delete el.shared;delete el.only}save();renderInspector()};box.append(l);
  if(el.shared&&s.pages.length>1){const chips=mk('div',{className:'pgchips'});
    for(const p of s.pages){const c=mk('input',{type:'checkbox',checked:onPage(el,p.id)}),cl=mk('label',{className:'tog2'});cl.append(c,' '+p.name);
      c.onchange=()=>{pushUndo();const all=s.pages.filter(x=>x===p?c.checked:onPage(el,x.id)).map(x=>x.id);el.only=all.length===s.pages.length?undefined:all;if(!el.only)delete el.only;
        if(!onPage(el,s.cur)){state.els=state.els.filter(e=>e!==el);s.hidden.push(el);dropHost(el.id);select(null);status(`It’s no longer on ${curPage().name}; it waits on the pages you chose.`)}save();renderInspector()};chips.append(cl)}
    box.append(chips)}
  if(!el.nav){const sel=mk('select');sel.append(mk('option',{value:'',textContent:'Links to: nothing'}));for(const p of s.pages)sel.append(mk('option',{value:p.id,textContent:'Links to: '+p.name}));sel.value=el.link&&sitePage(el.link)?el.link:'';
    sel.setAttribute('aria-label','Link to a page');sel.onchange=()=>{pushUndo();if(sel.value)el.link=sel.value;else delete el.link;save()};box.append(sel)}
  form.append(box);
}
// SECTION: commands and keys
function syncPageCmds(){
  for(let i=CMD_ITEMS.length-1;i>=0;i--)if(CMD_ITEMS[i].cat==='Pages')CMD_ITEMS.splice(i,1);
  CMD_ITEMS.push({cat:'Pages',name:'New page',hint:'Add a page to this site',keys:'',run:()=>addPage()});
  if(state.site)for(const {p} of siteTree())CMD_ITEMS.push({cat:'Pages',name:'Go to page: '+p.name,hint:'#'+p.slug,keys:'',run:()=>goPage(p.id)});
}
// SECTION: exporting a site
// RULE: one file by default: each page is a <section id="slug">, shown by :target, so links work with scripts off;
//   with the script, a small router runs each page's logic as it's shown. Or a zip of real files (index.html, …).
// INVARIANT: exporting never changes what the editor shows. A page that isn't open is drawn off-screen (elements
//   need their boxes and colour sheets to export), under its own ids, and taken down again; generated navigation is
//   exported from per-page copies, so the live ones on screen are never touched.
function offHost(box,el){const h=document.createElement('div');h.className='el';h.dataset.id=el.id;h.attachShadow({mode:'open'});box.append(h);
  h.style.left=el.x+'px';h.style.top=el.y+'px';h.style.width=el.w?el.w+'px':'';h.style.zIndex=el.z||0;h._target=buildInto(h.shadowRoot,el);return h}
async function withPage(p,mode,fn){
  const S=siteEnsure(),saved={els:state.els,logic:state.logic,bgd:state.bgd,boxes:state.boxes},isCur=p.id===S.cur;
  const sharedAll=[...state.els.filter(e=>e.shared),...S.hidden],own=isCur?state.els.filter(e=>!e.shared):(p.store?p.store.els:[]).filter(e=>!e.md);
  const box=mkEl('div',{className:'stage'});box.style.cssText=`position:fixed;left:-100000px;top:0;width:${W}px;height:${H}px;visibility:hidden;pointer-events:none`;document.body.append(box);
  const made=new Map();
  const list=[...own,...sharedAll.filter(e=>onPage(e,p.id))].map(el=>{const e=el.nav?{...el,content:navHTML(el.nav,p.id,mode)}:el;
    if(el.nav||!saved.els.includes(el)){made.set(el.id,hosts.get(el.id)||null);hosts.set(el.id,offHost(box,e))}return e});
  state.els=list;if(!isCur&&p.store){state.logic=p.store.logic||{nodes:[],wires:[]};state.bgd=p.store.bgd||saved.bgd;state.boxes=p.store.boxes||null}
  try{return await fn()}finally{for(const [id,live] of made){if(live)hosts.set(id,live);else hosts.delete(id)}box.remove();Object.assign(state,saved)}
}
function sitePagesFor(mode){const T=siteTree().map(x=>x.p),proj=state.project?state.project.name:'';
  return T.map(p=>({id:p.id,slug:p.slug,name:p.name,title:p.title||(proj&&p.name!==proj?`${p.name} · ${proj}`:p.name),href:pageHref(p,mode)}))}
// FORMAT: extra runtime env for one page of a multi-file site: variables kept in sessionStorage across pages.
function siteEnvJS(SP,J){
  const P=SP.pages.map(p=>({slug:p.slug,href:p.href}));
  return`,vars:(()=>{let V={};try{V=JSON.parse(sessionStorage.getItem('pxvars'))||{}}catch(e){}addEventListener('pagehide',()=>{try{sessionStorage.setItem('pxvars',JSON.stringify(V))}catch(e){}});return V})(),pageName:()=>${J(SP.name)},go:t=>{if(t==='back'){history.back();return}const P=${J(P)},i=P.findIndex(p=>p.slug===${J(SP.cur)}),p=t==='next'?P[i+1]:t==='previous'?P[i-1]:t==='first'?P[0]:P.find(x=>x.slug===t);if(p)location.href=p.href}`;
}
async function buildSite(opt={}){
  const T=siteTree().map(x=>x.p),pages=sitePagesFor('hash'),J=v=>JSON.stringify(v).replace(/</g,'\\u003c'),parts=[];
  for(const [i,p] of T.entries()){const SP={mode:'hash',pages,cur:p.slug,name:p.name,title:pages[i].title};
    parts.push({p,P:pages[i],x:await withPage(p,'hash',()=>buildExport({...opt,part:true,prefix:p.slug+'-',page:SP}))})}
  const x0=parts[0].x,faces=[...new Set(parts.flatMap(q=>q.x.faces))];
  const css=`body{margin:0;background:#ddd}.page{position:relative;width:${W}px;height:${H}px;margin:24px auto;${x0.font}}.el{position:absolute}a.pxlink{color:inherit;text-decoration:none}.pxpage{display:none}.pxpage:target,html:not(:has(.pxpage:target)) .pxhome{display:block}`;
  const sections=parts.map((q,i)=>`<section class="page pxpage${i?'':' pxhome'}" id="${q.p.slug}" aria-label="${escH(q.p.name)}" style="${q.x.bg}">\n${q.x.html}\n</section>`).join('\n');
  let tail='';
  if(expOpt.nojs)tail=parts.map(q=>q.x.rawTail).filter(Boolean).join('\n');
  else{
    tail=parts.map(q=>q.x.sheetTags).join('\n')+(x0.hydrate||'')+(parts.map(q=>q.x.musicTail).find(Boolean)||'')+(parts.map(q=>q.x.dragTail).find(Boolean)||'');
    // RULE: the router: the page in the address shows (CSS does that alone); the script sets the tab title and runs
    //   that page's logic, stopping the last one's, with variables shared by every page.
    const RP=parts.map(q=>({slug:q.p.slug,name:q.p.name,title:q.P.title,G:q.x.G,anims:q.x.anims}));
    tail+=`
<script>
(()=>{const RT=(${pxRuntime}),P=${J(RP)},V={},seen=new Set();let run=null,cur=null;
const el=pre=>i=>{const h=document.querySelector('.el[data-px="'+pre+i+'"]');return h?{host:h,target:h.shadowRoot&&h.shadowRoot.querySelector('[data-pxt]')}:null};
const now=()=>{const h=decodeURIComponent(location.hash.slice(1));return P.some(p=>p.slug===h)?h:P[0].slug};
function go(t){if(t==='back'){history.back();return}const i=P.findIndex(p=>p.slug===cur),p=t==='next'?P[i+1]:t==='previous'?P[i-1]:t==='first'?P[0]:P.find(x=>x.slug===t);if(p)location.hash=p.slug}
function show(){const s=now();if(s===cur)return;if(run)run.stop();cur=s;const p=P.find(x=>x.slug===s);document.title=p.title;run=(p.G.nodes.length||p.anims.length)?RT(p.G,p.anims,{el:el(s+'-'),animate(){},music:window.__pxMusic,vars:V,noStart:seen.has(s),pageName:()=>p.name,go}):null;seen.add(s)}
addEventListener('hashchange',show);show()})();
<\/script>`;
  }
  return`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="PIXIWYG ${APP_VERSION}">
<title>${escH(pages[0].title)}</title>${x0.link?'\n'+x0.link:''}
<style>${css}
${faces.join('\n')}</style></head><body>
${sections}${tail?'\n'+tail:''}
</body></html>`;
}
// FORMAT: the zip: index.html for the first page, slug.html for the rest, each a whole page of its own.
async function exportSiteFiles(opt={}){
  const T=siteTree().map(x=>x.p),pages=sitePagesFor('files'),out=new Map();
  for(const [i,p] of T.entries()){const SP={mode:'files',pages,cur:p.slug,name:p.name,title:pages[i].title};
    out.set(pages[i].href,await withPage(p,'files',()=>buildExport({...opt,page:SP})))}
  return out;
}


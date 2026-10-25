// SECTION: XMB interface
// RULE: two interfaces over one project. Desktop is the toolbar, docked panels and tree; XMB is this file: a home of
//   categories across and items down, and one tool at a time under a strip of essentials. Settings, the command
//   palette and the XMB's own Settings category switch between them; the project and its saved state never change.
// FORMAT: pixiwyg.ui 'auto' | 'desktop' | 'xmb'. Auto is XMB when the primary pointer is a finger.
// FIX: tablets with stylus support list a fine pointer among their pointers, so any-pointer:fine picked Desktop on a
//   Fire tablet; the primary pointer is the honest signal (a touchscreen laptop's is its trackpad).
// RULE: a category's items are its workspace, that workspace's files (projectFiles groups below) and every CMD_ITEMS
//   entry whose xmb field names it. An action leaves the home for the tool; a toggle (on()) flips in place and stays.
const UI_KEY='pixiwyg.ui',UI_MODES=['auto','desktop','xmb'],FINE=matchMedia('(pointer:fine)');
const ui={mode:UI_MODES.includes(lsGet(UI_KEY,'auto'))?lsGet(UI_KEY,'auto'):'auto',on:false};
const XMB_GROUPS={page:['Page','Styles','Stylesheets','Logic'],write:['Manuscripts'],paint:['Drawings'],music:['Songs','Player'],animate:['Animations'],model:[]};
const XMB_CMD_ICON={Tools:'⚒',Output:'⇪',Modes:'▷','View & Panels':'◎',Help:'?',Themes:'◐',Project:'▤',Style:'◆'};
const XMB_CATS=[{id:'project',icon:'▣',name:'Project'},...WS_IDS.map(id=>({id,ws:id,icon:WS[id].icon,name:WS[id].name})),
  {id:'play',icon:'▷',name:'Play'},{id:'output',icon:'⇪',name:'Output'},{id:'settings',icon:'⚙',name:'Settings'}];
// FORMAT: c = category index, at = remembered item index per category id, q = search text, items = what the list shows.
const XMB={c:-1,at:{},q:'',items:[],projects:[],dragged:false,cats:()=>XMB_CATS};

function setUi(mode){
  ui.mode=UI_MODES.includes(mode)?mode:'auto';lsSet(UI_KEY,ui.mode);
  const s=$('#setUi');if(s)s.value=ui.mode;applyUi();
}
function applyUi(quiet){
  const on=ui.mode==='xmb'||(ui.mode==='auto'&&!FINE.matches);if(on===ui.on)return;ui.on=on;
  document.body.classList.toggle('xmb',on);
  // INVARIANT: at load only the class is set; boot's initPanels folds the panels and its showTitle opens the home.
  if(quiet)return;
  if(on){setSide('sideL',false);setSide('sideR',false);xmbOpen(state.project&&$('#title').hidden?undefined:'project')}
  else{$('#xmb').hidden=true;$('#xmbStrip').hidden=true;document.body.classList.remove('xmbhome');initPanels();if(!state.project)showTitle()}
  fitStage();if(typeof fitTopbar==='function')requestAnimationFrame(fitTopbar);
}

// SECTION: XMB items
const xmbNeedProject=()=>({icon:'▣',name:'Open or start a project first',note:'Project lists yours and starts new ones',stay:true,run:()=>xmbCat(0)});
function xmbItemsFor(cat){
  const out=[],has=!!state.project;
  if(cat.id==='project'){
    if(has)out.push({icon:'▸',name:`Back to ${state.project.name}`,note:'Pick up where you left off',badge:'Open',run:()=>{}});
    // RULE: the home screen's starts that open past the page come first; the plain canvases follow.
    for(const st of STARTS)if(st.ws!=='page')out.push({icon:st.icon,name:'Start '+st.name.replace(/^./,c=>c.toLowerCase()),note:st.note,run:()=>startWork(st)});
    for(const [k,v] of Object.entries(KINDS))out.push({icon:'＋',name:'New: '+v.name,note:v.note,run:()=>newProject('',false,kindCanvas(k))});
    out.push({icon:'⇩',name:'Open a .pixiwyg file…',note:'A project saved on this device',stay:true,run:xmbPickFile});
    for(const p of XMB.projects)if(!has||p.id!==state.project.id)out.push({icon:'▤',name:p.name,
      note:[p.canvas||'Web page',`Edited ${ago(p.modified)}`,`${p.elements} element${p.elements===1?'':'s'}`].join(' · '),run:()=>openStored(p.id)});
  }else if(cat.ws){
    if(!has)return[xmbNeedProject()];
    // RULE: the Page category's own pages open the page workspace, so it has no separate Open item.
    if(cat.ws!=='page')out.push({icon:cat.icon,name:'Open '+cat.name,note:WS[cat.ws].hint,badge:document.body.dataset.ws===cat.ws?'Open':'',run:()=>setWorkspace(cat.ws)});
    for(const f of projectFiles())if(XMB_GROUPS[cat.ws].includes(f.group))out.push({icon:f.icon,name:f.name,note:`${f.group} · ${f.note}`,run:f.open});
  }
  for(const c of CMD_ITEMS)if(c.xmb===cat.id&&(has||c.bare||cat.id==='settings')&&(!c.when||c.when()))
    out.push({icon:XMB_CMD_ICON[c.cat]||'›',name:c.name.replace(/^Toggle /,''),note:c.hint,on:c.on,stay:c.stay,run:c.run});
  if(!out.length&&!has)out.push(xmbNeedProject());
  return out;
}
function xmbSearchItems(q){
  const out=[];
  for(const cat of XMB_CATS)for(const it of xmbItemsFor(cat))if((it.name+' '+it.note+' '+cat.name).toLowerCase().includes(q))out.push({...it,note:`${cat.name} · ${it.note}`});
  return out;
}
function xmbPickFile(){
  const inp=mkEl('input',{type:'file',accept:'.pixiwyg,.zip'});
  inp.onchange=async()=>{const f=inp.files[0];if(!f)return;await openProjectFile(f);if(state.project)xmbClose()};inp.click();
}

// SECTION: XMB home
async function xmbOpen(cat){
  if(!ui.on)return;
  if(playing)setPlay(false);
  if(cat!==undefined)XMB.c=typeof cat==='number'?cat:Math.max(0,XMB_CATS.findIndex(c=>c.id===cat));
  // RULE: the home opens where you are: the category of the tool you came from, or Project with nothing open.
  else XMB.c=state.project?Math.max(0,XMB_CATS.findIndex(c=>c.ws===(document.body.dataset.ws||'page'))):0;
  $('#xmb').hidden=false;$('#xmbStrip').hidden=true;document.body.classList.add('xmbhome');
  xmbRender(0,true);
  XMB.projects=await listProjects();if(!$('#xmb').hidden)xmbRender(0,!XMB.q);
}
function xmbClose(){
  if(!state.project){status('Open or start a project first.');return}
  if(!$('#title').hidden)hideTitle();
  xmbSearch(false,true);$('#xmb').hidden=true;document.body.classList.remove('xmbhome');$('#xmbStrip').hidden=false;
  xmbStripSync();fitStage();$('#xmbHome').focus();
  if(!(history.state&&history.state.xmb))history.pushState({xmb:1},'');
}
function xmbCat(c){
  const n=XMB_CATS.length;c=(c%n+n)%n;if(c===XMB.c&&!XMB.q)return;
  const dir=c>XMB.c?1:-1;XMB.c=c;if(XMB.q)xmbSearch(false,true);xmbRender(dir,true);audio();sfx('click');
}
function xmbItem(i,focus){
  const n=XMB.items.length;if(!n)return;XMB.i=Math.max(0,Math.min(n-1,i));if(!XMB.q)XMB.at[XMB_CATS[XMB.c].id]=XMB.i;
  const btns=$('#xmbItems').querySelectorAll('.xitem');btns.forEach((b,k)=>b.classList.toggle('on',k===XMB.i));
  const b=btns[XMB.i];if(!b)return;b.scrollIntoView({block:'nearest'});if(focus)b.focus({preventScroll:true});
}
function xmbActivate(i){
  const it=XMB.items[i];if(!it)return;audio();sfx('click');
  if(it.on){it.run();xmbRender(0,true);return}
  if(it.stay){it.run();return}
  const r=it.run();
  // RULE: the tool shows once the action has run, so a new or opened project is in place before the home goes.
  Promise.resolve(r).then(ok=>{if(ok!==false&&state.project&&!$('#xmb').hidden&&!document.querySelector('.modal:not([hidden]):not(#seqModal):not(#m3dModal):not(.docked)'))xmbClose()});
}
const xmbCenter=()=>{const row=$('#xmbCats'),on=row.children[XMB.c];if(on)row.style.setProperty('--off',Math.round(row.parentElement.clientWidth/2-on.offsetLeft-on.offsetWidth/2)+'px')};
function xmbRender(dir,focus){
  const cat=XMB_CATS[XMB.c],row=$('#xmbCats');
  if(!row.childElementCount)XMB_CATS.forEach((c,k)=>{const t=mkEl('button',{type:'button',className:'xcat'});t.setAttribute('role','tab');t.setAttribute('aria-controls','xmbItems');
    t.append(mkEl('i',{textContent:c.icon}),mkEl('b',{textContent:c.name}));t.firstChild.setAttribute('aria-hidden','true');
    t.onclick=()=>{if(!XMB.dragged)xmbCat(k)};row.append(t)});
  [...row.children].forEach((t,k)=>{t.setAttribute('aria-selected',k===XMB.c);t.tabIndex=k===XMB.c?0:-1});
  xmbCenter();
  $('#xmbHeadIcon').textContent=XMB.q?'⌕':cat.icon;$('#xmbHeadName').textContent=XMB.q?`Everything matching “${XMB.q}”`:cat.name;
  const p=state.project;$('#xmbProj').textContent=p?p.name:'PIXIWYG';
  $('#xmbMeta').textContent=p?`${WS[document.body.dataset.ws||'page'].name} · edited ${ago(p.modified||Date.now())}`:'No project open';
  $('#xmbResume').hidden=!p;if(p)$('#xmbResumeName').textContent=WS[document.body.dataset.ws||'page'].name;
  XMB.items=XMB.q?xmbSearchItems(XMB.q):xmbItemsFor(cat);
  const list=$('#xmbItems');list.replaceChildren();
  XMB.items.forEach((it,k)=>{
    const b=mkEl('button',{type:'button',className:'xitem'});
    b.append(mkEl('i',{className:'xico',textContent:it.icon}),mkEl('span',{className:'xtxt'}));b.firstChild.setAttribute('aria-hidden','true');
    b.lastChild.append(mkEl('b',{textContent:it.name}),mkEl('small',{textContent:it.note||''}));
    // RULE: state is a word in a shape, never colour alone: On is a filled pill, Off an outlined one.
    if(it.on){const v=!!it.on();b.setAttribute('aria-pressed',v);b.append(mkEl('em',{className:'xbadge'+(v?' lit':''),textContent:v?'On':'Off'}))}
    else if(it.badge)b.append(mkEl('em',{className:'xbadge lit',textContent:it.badge}));
    b.onclick=()=>{if(XMB.dragged)return;xmbItem(k);xmbActivate(k)};
    b.onfocus=()=>{if(XMB.i!==k)xmbItem(k)};
    const li=mkEl('li');li.append(b);list.append(li);
  });
  if(!XMB.items.length)list.append(mkEl('li',{className:'empty',textContent:'Nothing by that name.'}));
  if(dir){list.style.setProperty('--from',dir*28+'px');list.classList.remove('in');void list.offsetWidth;list.classList.add('in')}
  const at=XMB.q?0:XMB.at[cat.id]||0;XMB.i=-1;xmbItem(at,focus&&document.activeElement!==$('#xmbSearch'));
}
function xmbSearch(on,quiet){
  const s=$('#xmbSearch');s.hidden=!on;$('#xmbSearchBtn').setAttribute('aria-expanded',on);
  if(on){s.value=XMB.q;s.focus();return}
  const had=XMB.q;XMB.q='';s.value='';if(had&&!quiet)xmbRender(0,true);
}
$('#xmbSearch').oninput=e=>{XMB.q=e.target.value.trim().toLowerCase();xmbRender(0,false)};
$('#xmbSearchBtn').onclick=()=>{audio();xmbSearch($('#xmbSearch').hidden)};
$('#xmbResume').onclick=()=>{audio();sfx('whoosh');xmbClose()};

// RULE: on the home, keys drive the cross: ←/→ categories, ↑/↓ items, Enter or Space picks (Space flips a toggle in
//   place), / searches, Esc backs out (search, then the home itself), ? lists every key. A dialog over the home keeps
//   its own keys.
document.addEventListener('keydown',e=>{
  if($('#xmb').hidden||document.querySelector('.modal:not([hidden])'))return;
  const k=e.key,inSearch=e.target===$('#xmbSearch'),stop=()=>{e.preventDefault();e.stopPropagation()};
  if(k==='ArrowDown'||k==='ArrowUp'){stop();xmbItem(XMB.i+(k==='ArrowDown'?1:-1),!inSearch);return}
  if(k==='Escape'){stop();if(!$('#xmbSearch').hidden)xmbSearch(false);else if(state.project)xmbClose();return}
  if(k==='Enter'&&inSearch){stop();xmbActivate(XMB.i);return}
  e.stopPropagation();if(inSearch||k==='Tab')return;
  if(k==='ArrowLeft'||k==='ArrowRight'){e.preventDefault();xmbCat(XMB.c+(k==='ArrowRight'?1:-1));return}
  if(k==='Home'||k==='End'){e.preventDefault();xmbItem(k==='Home'?0:XMB.items.length-1,true);return}
  if(k==='/'){e.preventDefault();xmbSearch(true);return}
  if(k==='?'||k==='F1'){e.preventDefault();toggleHelp();return}
  if((k===' '||k==='Enter')&&!e.target.closest('.xcat')){e.preventDefault();xmbActivate(XMB.i)}
},true);

// SECTION: XMB swipe
// RULE: a sideways swipe anywhere on the home drags the category row with the finger and lands on the nearest
//   category; vertical movement stays the browser's own scroll (touch-action: pan-y).
(()=>{
  const home=$('#xmb'),row=$('#xmbCats');let sw=null;
  home.addEventListener('pointerdown',e=>{XMB.dragged=false;if(e.button>0||e.target.closest('input'))return;sw={x:e.clientX,y:e.clientY,id:e.pointerId,drag:false}});
  home.addEventListener('pointermove',e=>{
    if(!sw||e.pointerId!==sw.id)return;const dx=e.clientX-sw.x,dy=e.clientY-sw.y;
    if(!sw.drag&&Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.5){sw.drag=XMB.dragged=true;home.setPointerCapture(e.pointerId);row.classList.add('drag')}
    if(sw.drag)row.style.setProperty('--drag',dx+'px');
  });
  const end=e=>{
    if(!sw||e.pointerId!==sw.id)return;const s=sw;sw=null;if(!s.drag)return;
    const dx=e.type==='pointercancel'?0:e.clientX-s.x,w=row.children[XMB.c].offsetWidth||80;
    row.classList.remove('drag');row.style.setProperty('--drag','0px');
    const step=Math.round(-dx/w)||(Math.abs(dx)>40?-Math.sign(dx):0);if(step)xmbCat(XMB.c+step);
  };
  home.addEventListener('pointerup',end);home.addEventListener('pointercancel',end);
})();

// SECTION: XMB tool strip
// RULE: the strip carries what every tool needs: the menu bottom-left, the panels, undo and redo, and the
//   workspace's primary toggle bottom-right where the thumb rests.
function xmbPrimary(){
  const ws=document.body.dataset.ws||'page';
  if(ws==='music')return{on:seqP.on,icon:seqP.on?'■':'▶',name:seqP.on?'Stop':'Play',run:()=>$('#seqPlay').click()};
  if(ws==='animate')return{on:!!TL.playing,icon:TL.playing?'❚❚':'▶',name:TL.playing?'Pause':'Play',run:()=>$('#tlPlay').click()};
  if(ws==='paint')return studio.frames.length>1?{on:false,icon:'▶',name:'Frames',run:playFrames}:null;
  if(ws==='model')return null;
  return{on:!!playing,icon:playing?'■':'▶',name:playing?'Stop':'Play',run:()=>setPlay(!playing)};
}
function xmbStripSync(){
  if(!ui.on||$('#xmbStrip').hidden)return;
  const ws=document.body.dataset.ws||'page',w=WS[ws]||WS.page,docked=['paint','music','model'].includes(ws);
  $('#xmbWsIcon').textContent=w.icon;$('#xmbWsName').textContent=w.name;$('#xmbWsFile').textContent=$('#wsFile').textContent;
  $('#xmbAdd').hidden=$('#xmbProps').hidden=docked;
  $('#xmbAdd').setAttribute('aria-pressed',sideShown('sideL'));$('#xmbProps').setAttribute('aria-pressed',sideShown('sideR'));
  if(XMB.ws!==ws){XMB.ws=ws;xmbSheet(null);xmbSheetButtons(ws);requestAnimationFrame(xmbFitPage)}
  const p=xmbPrimary(),b=$('#xmbPrimary');b.hidden=!p;
  if(p){b.setAttribute('aria-pressed',p.on);b.setAttribute('aria-label',p.name);$('#xmbPrimaryIcon').textContent=p.icon;$('#xmbPrimaryName').textContent=p.name}
}
$('#xmbHome').onclick=()=>{audio();sfx('whoosh');xmbOpen()};
$('#xmbAdd').onclick=()=>{audio();sfx('click');setSide('sideL',!sideShown('sideL'))};
$('#xmbProps').onclick=()=>{audio();sfx('click');setSide('sideR',!sideShown('sideR'))};
$('#xmbUndo').onclick=()=>$('#undoBtn').click();
$('#xmbRedo').onclick=()=>$('#redoBtn').click();
$('#xmbPrimary').onclick=()=>{const p=xmbPrimary();if(p){audio();p.run();xmbStripSync()}};
// PERF: one observer per source of strip state instead of hooks in setPlay, setSide, wsSync and the players.
{const mo=new MutationObserver(xmbStripSync);
  mo.observe(document.body,{attributes:true,attributeFilter:['class','data-ws']});
  mo.observe($('#wsFile'),{childList:true,characterData:true,subtree:true});
  for(const id of ['#seqPlay','#tlPlay'])mo.observe($(id),{attributes:true,attributeFilter:['aria-pressed']})}
// RULE: in XMB the title screen's job is the Project category: whenever the app shows the title, the home opens there.
// RULE: and a project opened from outside the home (the welcome, a dropped file) goes straight to its tool.
new MutationObserver(()=>{if(!ui.on)return;if(!$('#title').hidden)xmbOpen('project');else if(!$('#xmb').hidden&&state.project)xmbClose()}).observe($('#title'),{attributes:true,attributeFilter:['hidden']});
new ResizeObserver(()=>{if(!$('#xmb').hidden)xmbCenter()}).observe($('#xmb'));
// SECTION: XMB sheets
// RULE: a tool's secondary controls wait in sheets: one at a time, raised from the strip above it, gone again when
//   the finger goes back to the work. Paint's palettes and file bar, the sequencer's song bar, tracks and footer.
// FORMAT: [id, icon, name, selector of the element the sheet shows].
const XMB_SHEETS={
  paint:[['tools','✎','Tools','.spal[data-pal=tools]'],['color','◉','Color','.spal[data-pal=color]'],['brushes','✺','Brushes','.spal[data-pal=brushes]'],
    ['layers','❏','Layers','.spal[data-pal=layers]'],['frames','▤','Frames','.spal[data-pal=frames]'],['more','⋯','More','#w-studio .studio-top']],
  music:[['song','♪','Song','#seqModal .seqbar'],['tracks','▥','Tracks','#seqModal .seqtracks'],['more','⋯','More','#seqModal .seqfoot']],
};
function xmbSheetButtons(ws){
  const box=$('#xmbSheets');box.replaceChildren();document.body.classList.toggle('xmbsheeted',!!XMB_SHEETS[ws]);
  for(const [id,icon,name] of XMB_SHEETS[ws]||[]){
    const b=mkEl('button',{type:'button',className:'xmbbtn'});b.dataset.sheet=id;b.setAttribute('aria-pressed','false');b.setAttribute('aria-label',name);
    b.append(mkEl('i',{textContent:icon}),mkEl('span',{textContent:name}));b.firstChild.setAttribute('aria-hidden','true');
    b.onclick=()=>{audio();sfx('click');xmbSheet(document.body.dataset.sheet===id?null:id)};box.append(b);
  }
}
function xmbSheet(id){
  for(const el of document.querySelectorAll('.xsheet'))el.classList.remove('xsheet');
  const def=id&&(XMB_SHEETS[document.body.dataset.ws]||[]).find(d=>d[0]===id),el=def&&$(def[3]);
  if(el){el.classList.add('xsheet');document.body.dataset.sheet=id}else delete document.body.dataset.sheet;
  for(const t of $('#xmbSheets').children)t.setAttribute('aria-pressed',t.dataset.sheet===document.body.dataset.sheet);
}
// RULE: touching the work (or anything outside the sheet and the strip) puts the sheet away; dialogs it opens don't.
document.addEventListener('pointerdown',e=>{if(document.body.dataset.sheet&&!e.target.closest('.xsheet,#xmbStrip,.modal:not(#seqModal),.ddbody,.fxpanel,.bredwin'))xmbSheet(null)},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&document.body.dataset.sheet&&!document.querySelector('.modal:not([hidden]):not(#seqModal)')){e.preventDefault();e.stopPropagation();xmbSheet(null)}},true);

// RULE: the page opens in XMB showing its whole width: a web page laid out wider than the phone zooms out to fit it,
//   a printed canvas fits its pages. Once per project and workspace, so a zoom you chose stays.
function xmbFitPage(){
  const ws=document.body.dataset.ws;if(!ui.on||!state.project||!['page','animate'].includes(ws))return;
  const key=state.project.id+ws;if(XMB.fitted===key)return;XMB.fitted=key;
  xmbFitContent(false);
}
// RULE: a web page fits its content's width, not its design width: a 1280px layout's elements may span less. Framing
//   (Showtime, a finished site) also zooms in up to 100% and scrolls to the content's top-left; the entry fit only
//   ever zooms out, so a zoom you chose stays.
function xmbFitContent(frame){
  if(isFixed()){zoomFit();return}
  const sr=stage.getBoundingClientRect();let x0=Infinity,x1=-Infinity,y0=Infinity;
  for(const h of stage.querySelectorAll('.el')){const r=h.getBoundingClientRect();if(r.width){x0=Math.min(x0,r.left);x1=Math.max(x1,r.right);y0=Math.min(y0,r.top)}}
  if(!(x1>x0)){x0=sr.left;x1=sr.right;y0=sr.top}
  const w=(x1-x0)/Z,left=(x0-sr.left)/Z,top=(y0-sr.top)/Z,z=Math.min(1,(desk.clientWidth-24)/w);
  if(frame?Math.abs(z-Z)>.01:z<Z-.01)setZoom(z);
  if(frame||z<Z+.01){desk.scrollLeft=Math.max(0,stage.offsetLeft+left*Z-12);if(frame)desk.scrollTop=Math.max(0,stage.offsetTop+top*Z-12)}
}

// SECTION: XMB touch gestures
// RULE: on a work surface one finger is the tool and two move the view: pinch zooms around the fingers, dragging pans.
//   A first touch is held back up to 70 ms or 8 px of travel, so a second finger landing in that window never reaches
//   the tool; the held pointerdown is then replayed to its target unchanged. A second finger after that ends the
//   tool's stroke where it is. Mouse and pen pass straight through: a pen draws while fingers move the view.
// FORMAT: begin() returns the view's zoom at the start; zoom(z, x, y) sets an absolute zoom keeping (x, y) put;
//   pan(dx, dy) scrolls by client pixels. zoom is optional.
function xmbGestures(surface,{begin,zoom,pan}){
  const pts=new Map();let held=null,timer=0,live=null,g=null;
  const flush=()=>{clearTimeout(timer);if(!held)return;const h=held;held=null;live={id:h.ev.pointerId,target:h.target};h.target.dispatchEvent(h.ev)};
  const two=()=>{const [a,b]=[...pts.values()];return{d:Math.hypot(a.x-b.x,a.y-b.y)||1,x:(a.x+b.x)/2,y:(a.y+b.y)/2}};
  const start=()=>{const t=two();g={z0:begin?begin():1,d0:t.d,x:t.x,y:t.y}};
  surface.addEventListener('pointerdown',e=>{
    if(!ui.on||e.pointerType!=='touch'||!e.isTrusted)return;
    pts.set(e.pointerId,{x:e.clientX,y:e.clientY});e.stopImmediatePropagation();
    if(g){if(pts.size===2)start();return}
    if(pts.size===1){held={ev:new PointerEvent('pointerdown',e),target:e.target,x:e.clientX,y:e.clientY};timer=setTimeout(flush,70);return}
    if(held){clearTimeout(timer);held=null}
    else if(live){const p=pts.get(live.id)||{x:0,y:0};live.target.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,composed:true,pointerId:live.id,pointerType:'touch',isPrimary:true,clientX:p.x,clientY:p.y}));live=null}
    if(pts.size===2)start();
  },true);
  addEventListener('pointermove',e=>{
    if(!pts.has(e.pointerId)||!e.isTrusted)return;pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(g){e.stopImmediatePropagation();if(pts.size<2)return;const t=two();if(zoom)zoom(g.z0*t.d/g.d0,t.x,t.y);pan(t.x-g.x,t.y-g.y);g.x=t.x;g.y=t.y;return}
    if(held){if(Math.hypot(e.clientX-held.x,e.clientY-held.y)>8)flush();else e.stopImmediatePropagation()}
  },true);
  const end=e=>{
    if(!pts.has(e.pointerId)||!e.isTrusted)return;pts.delete(e.pointerId);
    if(g){e.stopImmediatePropagation();if(!pts.size)g=null;return}
    if(held){if(e.type==='pointerup')flush();else{clearTimeout(timer);held=null;e.stopImmediatePropagation()}}
    if(live&&live.id===e.pointerId)live=null;
  };
  addEventListener('pointerup',end,true);addEventListener('pointercancel',end,true);
}
xmbGestures(desk,{begin:()=>Z,zoom:(z,x,y)=>setZoom(z,x,y),pan:(dx,dy)=>{desk.scrollLeft-=dx;desk.scrollTop-=dy}});
xmbGestures($('#sview'),{begin:viewScale,zoom:(z,x,y)=>sZoomTo(z,{x,y}),pan:(dx,dy)=>{const v=$('#sview');v.scrollLeft-=dx;v.scrollTop-=dy}});
xmbGestures($('#seqScroll'),{pan:(dx,dy)=>{const v=$('#seqScroll');v.scrollLeft-=dx;v.scrollTop-=dy}});
// RULE: the system Back (Android's gesture, the browser's button) backs out as Esc does: a dialog, then a sheet, then
//   the tool to the home. From the home it leaves, as Back leaves any app. One history entry stands for "in a tool".
addEventListener('popstate',()=>{
  if(!ui.on||!$('#xmb').hidden||!state.project)return;
  const again=()=>history.pushState({xmb:1},'');
  if(document.querySelector('.modal:not([hidden]):not(#seqModal):not(#m3dModal):not(.docked)')){document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));again();return}
  if(document.body.dataset.sheet){xmbSheet(null);again();return}
  xmbOpen();
});
FINE.addEventListener('change',()=>applyUi());
applyUi(true);

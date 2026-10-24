// SECTION: side panels
const PANKEY='pixiwyg.panels.v1';
let panels={L:true,R:true,tab:'w-styles'};try{Object.assign(panels,JSON.parse(localStorage.getItem(PANKEY))||{})}catch(e){}
const savePanels=()=>{try{localStorage.setItem(PANKEY,JSON.stringify(panels))}catch(e){}};
// RULE: the XMB interface treats every screen as narrow: panels overlay the tool one at a time and never save a layout.
const narrow=()=>document.body.classList.contains('xmb')||matchMedia('(max-width:900px)').matches;
// RULE: narrow screens overlay one panel at a time; shrinking into narrow folds both so the page stays in view.
matchMedia('(max-width:900px)').addEventListener('change',e=>{if(e.matches){document.body.classList.add('noL','noR');$('#sideLBtn').setAttribute('aria-pressed',false);$('#sideRBtn').setAttribute('aria-pressed',false)}});
const desk=$('#desk');
function setSide(id,show){
  const L=id==='sideL',btn=$(L?'#sideLBtn':'#sideRBtn');
  // RULE: on narrow screens the panels overlay the page, one at a time.
  if(show&&narrow())document.body.classList.add(L?'noR':'noL'),$(L?'#sideRBtn':'#sideLBtn').setAttribute('aria-pressed',false);
  document.body.classList.toggle(L?'noL':'noR',!show);btn.setAttribute('aria-pressed',show);
  if(!narrow()){panels[L?'L':'R']=show;savePanels()}
}
const sideShown=id=>!document.body.classList.contains(id==='sideL'?'noL':'noR');
function togglePanels(){const any=sideShown('sideL')||sideShown('sideR');setSide('sideL',!any);if(!narrow()||any)setSide('sideR',!any);audio();sfx(any?'whoosh':'pop')}
function setTab(id){
  for(const t of document.querySelectorAll('#sideL .ptab')){const on=t.getAttribute('aria-controls')===id;t.setAttribute('aria-selected',on);t.tabIndex=on?0:-1;$('#'+t.getAttribute('aria-controls')).hidden=!on}
  panels.tab=id;savePanels();
}
document.querySelectorAll('#sideL .ptab').forEach((t,k,all)=>{
  t.onclick=()=>{audio();sfx('click');setTab(t.getAttribute('aria-controls'))};
  t.onkeydown=e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;e.preventDefault();const n=all[(k+d+all.length)%all.length];n.focus();n.click()};
});
$('#sideLBtn').onclick=()=>{audio();sfx('click');setSide('sideL',!sideShown('sideL'))};
$('#sideRBtn').onclick=()=>{audio();sfx('click');setSide('sideR',!sideShown('sideR'))};
const more=$('#moreMenu');
document.addEventListener('pointerdown',e=>{if(more.open&&!more.contains(e.target))more.open=false});
more.querySelector('.ddbody').addEventListener('click',e=>{if(e.target.closest('#keysBtn,#dynaBtn'))more.open=false});
more.addEventListener('keydown',e=>{if(e.key==='Escape'&&more.open){e.stopPropagation();more.open=false;more.querySelector('summary').focus()}});
const fitStage=()=>{if(!isFixed())sizeStage(desk.clientWidth/Z,desk.clientHeight/Z)};
new ResizeObserver(fitStage).observe(desk);
new ResizeObserver(()=>document.documentElement.style.setProperty('--tbh',$('#topbar').offsetHeight+'px')).observe($('#topbar'));
// SECTION: docking
// RULE: tree, Add and Properties panels sit in any order on either side of the page; each drags by its header,
//   swaps sides, folds to a rail and widens at its page-facing edge. The layout persists with the panels.
const DOCKS={tree:{name:'Project',v:'--tw',k:'tw',def:220,min:160,max:420,fold:'noT'},sideL:{name:'Add',v:'--lw',k:'lw',def:340,min:240,fold:'noL'},sideR:{name:'Properties',v:'--rw',k:'rw',def:320,min:240,fold:'noR'}};
const DOCK_DEF={before:['tree','sideL'],after:['sideR']};
function dockLayout(){
  const ok=id=>!!DOCKS[id],b=(panels.before||[]).filter(ok),a=(panels.after||[]).filter(ok),all=new Set([...b,...a]);
  if(all.size!==3||b.length+a.length!==3)return{before:[...DOCK_DEF.before],after:[...DOCK_DEF.after]};
  return{before:b,after:a};
}
function applyDock(){
  const L=dockLayout(),body=document.body;panels.before=L.before;panels.after=L.after;
  const col=id=>`var(${DOCKS[id].v},${DOCKS[id].def}px)`;
  body.style.gridTemplateColumns=[...L.before.map(col),'minmax(0,1fr)',...L.after.map(col)].join(' ');
  L.before.forEach((id,i)=>{const e=$('#'+id);e.style.gridColumn=String(i+1);e.classList.add('at-before');e.classList.remove('at-after');e.style.order=''});
  const dc=L.before.length+1;$('#desk').style.gridColumn=String(dc);$('#timeline').style.gridColumn=String(dc);$('#writer').style.gridColumn=String(dc);
  L.after.forEach((id,i)=>{const e=$('#'+id);e.style.gridColumn=String(dc+1+i);e.classList.add('at-after');e.classList.remove('at-before')});
  // INVARIANT: a docked context covers all but the tree, so its inset starts where the tree ends.
  body.style.setProperty('--dockL',L.before.includes('tree')?L.before.slice(0,L.before.indexOf('tree')+1).map(id=>id==='tree'?'var(--tw,220px)':'0px').join(' + ').replace(/^(.*)$/,'calc($1)'):'0px');
  body.style.setProperty('--dockR',L.after.includes('tree')?'var(--tw,220px)':'0px');
  for(const id of Object.keys(DOCKS)){const sw=$('#'+id+' .dswap');if(sw)sw.title=`Move to the ${L.before.includes(id)?'right':'left'} of the page`}
  savePanels();
}
function moveDock(id,group,index){
  const L=dockLayout();for(const g of ['before','after'])L[g]=L[g].filter(x=>x!==id);
  L[group].splice(Math.max(0,Math.min(index,L[group].length)),0,id);panels.before=L.before;panels.after=L.after;applyDock();
  audio();sfx('pop');status(`${DOCKS[id].name} is now ${group==='before'?'left':'right'} of the page.`);
}
function foldDock(id,fold){
  if(id==='sideL'||id==='sideR'){setSide(id,!fold);return}
  document.body.classList.toggle('noT',fold);panels.T=!fold;savePanels();
}
const syncDock=()=>document.body.classList.toggle('dockctx',['music','paint'].includes(document.body.dataset.ws)||!$('#nodeModal').hidden);
for(const [id,d] of Object.entries(DOCKS)){
  const el=$('#'+id);el.classList.add('dock');
  const head=mkEl('div',{className:'dockhead'});head.draggable=true;
  const sw=mkEl('button',{type:'button',className:'dswap',textContent:'⇄'}),fd=mkEl('button',{type:'button',className:'dfold',textContent:'–',title:`Fold the ${d.name} panel to a rail`});
  head.append(mkEl('span',{className:'dgrip',textContent:'⠿',title:'Drag to move this panel'}),mkEl('b',{textContent:d.name,title:'Drag to move this panel; double-click to put every panel back where it started'}),sw,fd);
  sw.onclick=()=>{const L=dockLayout();moveDock(id,L.before.includes(id)?'after':'before',L.before.includes(id)?0:L.before.length)};
  fd.onclick=()=>{audio();sfx('click');foldDock(id,true)};
  head.ondblclick=e=>{if(e.target.closest('button'))return;panels.before=[...DOCK_DEF.before];panels.after=[...DOCK_DEF.after];applyDock();status('Panels are back where they started.')};
  const rail=mkEl('button',{type:'button',className:'drail',title:`Open the ${d.name} panel`});rail.append(mkEl('span',{textContent:d.name}));rail.onclick=()=>{audio();sfx('pop');foldDock(id,false)};
  el.prepend(head);el.append(rail);
  const h=$({tree:'#rszT',sideL:'#rszL',sideR:'#rszR'}[id]);if(h)el.append(h);
}
// RULE: drop on a panel docks beside it; drop on the page docks on that half's side.
let panelDrag=null;
for(const id of Object.keys(DOCKS)){
  const head=$('#'+id+'>.dockhead');
  head.addEventListener('dragstart',e=>{panelDrag=id;e.dataTransfer.setData('application/x-pixiwyg-panel',id);e.dataTransfer.effectAllowed='move'});
  head.addEventListener('dragend',()=>{panelDrag=null;for(const x of document.querySelectorAll('.droptarget,.drop-l,.drop-r'))x.classList.remove('droptarget','drop-l','drop-r')});
}
const dropSpot=e=>{
  const over=e.target.closest&&e.target.closest('.dock');if(over&&over.id!==panelDrag){const r=over.getBoundingClientRect(),L=dockLayout(),g=L.before.includes(over.id)?'before':'after',i=L[g].indexOf(over.id)+(e.clientX>r.left+r.width/2?1:0);return{el:over,group:g,index:i}}
  const dk=e.target.closest&&e.target.closest('#desk');if(dk){const r=dk.getBoundingClientRect(),left=e.clientX<r.left+r.width/2,L=dockLayout();return{el:dk,side:left,group:left?'before':'after',index:left?L.before.length:0}}
  return null;
};
document.addEventListener('dragover',e=>{if(!panelDrag)return;e.preventDefault();for(const x of document.querySelectorAll('.droptarget,.drop-l,.drop-r'))x.classList.remove('droptarget','drop-l','drop-r');
  const s=dropSpot(e);if(!s)return;if(s.el.id==='desk')s.el.classList.add(s.side?'drop-l':'drop-r');else s.el.classList.add('droptarget')},true);
document.addEventListener('drop',e=>{if(!panelDrag)return;e.preventDefault();e.stopPropagation();const s=dropSpot(e),id=panelDrag;panelDrag=null;
  for(const x of document.querySelectorAll('.droptarget,.drop-l,.drop-r'))x.classList.remove('droptarget','drop-l','drop-r');
  if(s){const L=dockLayout();let i=s.index;if(L[s.group].includes(id)&&L[s.group].indexOf(id)<i)i--;moveDock(id,s.group,i)}},true);
let innerDrag=null;
function orderInner(){
  const tabs=$('#sideL .ptabs');for(const id of panels.tabOrder||[]){const t=$('#'+id);if(t&&t.parentNode===tabs)tabs.append(t)}
  const side=$('#sideR'),rail=side.querySelector('.drail'),handle=$('#rszR');for(const id of panels.sectOrder||[]){const x=$('#'+id);if(x&&x.parentNode===side)side.insertBefore(x,rail)}
}
for(const t of document.querySelectorAll('#sideL .ptab')){t.draggable=true;
  t.addEventListener('dragstart',e=>{innerDrag=t;e.dataTransfer.setData('text/x-pixiwyg-tab',t.id);e.stopPropagation()});
  t.addEventListener('dragover',e=>{if(!innerDrag||innerDrag.parentNode!==t.parentNode)return;e.preventDefault();e.stopPropagation();t.classList.add('dragover')});
  t.addEventListener('dragleave',()=>t.classList.remove('dragover'));
  t.addEventListener('drop',e=>{if(!innerDrag||innerDrag.parentNode!==t.parentNode)return;e.preventDefault();e.stopPropagation();t.classList.remove('dragover');t.before(innerDrag);innerDrag=null;
    panels.tabOrder=[...t.parentNode.children].map(x=>x.id);savePanels()});
  t.addEventListener('dragend',()=>{innerDrag=null})}
for(const sec of document.querySelectorAll('#sideR>.sect')){const sm=sec.querySelector(':scope>summary,:scope>h2');if(!sm)continue;sm.draggable=true;
  sm.addEventListener('dragstart',e=>{innerDrag=sec;e.dataTransfer.setData('text/x-pixiwyg-section',sec.id);e.stopPropagation()});
  sec.addEventListener('dragover',e=>{if(!innerDrag||innerDrag===sec||innerDrag.parentNode!==sec.parentNode)return;e.preventDefault();e.stopPropagation();sec.classList.add('dragover')});
  sec.addEventListener('dragleave',()=>sec.classList.remove('dragover'));
  sec.addEventListener('drop',e=>{if(!innerDrag||innerDrag===sec||innerDrag.parentNode!==sec.parentNode)return;e.preventDefault();e.stopPropagation();sec.classList.remove('dragover');sec.before(innerDrag);innerDrag=null;
    panels.sectOrder=[...sec.parentNode.querySelectorAll(':scope>.sect')].map(x=>x.id);savePanels()});
  sm.addEventListener('dragend',()=>{innerDrag=null})}
const SIDE_DEF={L:340,R:320,T:220};
const SIDE_VAR={L:'--lw',R:'--rw',T:'--tw'},SIDE_KEY={L:'lw',R:'rw',T:'tw'},SIDE_ID={L:'sideL',R:'sideR',T:'tree'};
function setSideWidth(k,w,keep){
  const d=DOCKS[SIDE_ID[k]];
  if(w==null){document.body.style.removeProperty(SIDE_VAR[k]);delete panels[SIDE_KEY[k]]}
  else{w=Math.round(Math.max(d.min,Math.min(d.max||innerWidth*.45,w)));document.body.style.setProperty(SIDE_VAR[k],w+'px');panels[SIDE_KEY[k]]=w}
  if(keep)savePanels();
}
for(const [id,k] of [['rszL','L'],['rszR','R'],['rszT','T']]){
  const h=$('#'+id),cur=()=>panels[SIDE_KEY[k]]??SIDE_DEF[k],panel=()=>$('#'+SIDE_ID[k]),after=()=>panel().classList.contains('at-after');
  h.addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();h.setPointerCapture(e.pointerId);h.classList.add('drag');document.body.classList.add('resizing');
    const r=panel().getBoundingClientRect(),mv=ev=>setSideWidth(k,after()?r.right-ev.clientX:ev.clientX-r.left);
    const up=()=>{h.removeEventListener('pointermove',mv);h.removeEventListener('pointerup',up);h.removeEventListener('pointercancel',up);h.classList.remove('drag');document.body.classList.remove('resizing');savePanels()};
    h.addEventListener('pointermove',mv);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up)});
  h.addEventListener('dblclick',()=>{audio();sfx('click');setSideWidth(k,null,true)});
  h.addEventListener('keydown',e=>{const d=e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0;if(!d)return;e.preventDefault();setSideWidth(k,cur()+(after()?-d:d)*(e.shiftKey?64:16),true)});
}
function initPanels(){
  if(panels.lw)setSideWidth('L',panels.lw);if(panels.rw)setSideWidth('R',panels.rw);if(panels.tw)setSideWidth('T',panels.tw);
  applyDock();orderInner();document.body.classList.toggle('noT',panels.T===false&&!narrow());
  setTab(panels.tab&&$('#'+panels.tab)?.role==='tabpanel'?panels.tab:'w-styles');
  if(narrow()){setSide('sideL',false);setSide('sideR',false)}else{setSide('sideL',panels.L!==false);setSide('sideR',panels.R!==false)}
}


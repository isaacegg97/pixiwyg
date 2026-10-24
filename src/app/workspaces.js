// SECTION: workspaces
// RULE: one project, five workspaces; the canvas picks the first, the project remembers the last.
//     page     the page
//     write    the page set like a book: everything stays inside the margins however it gets there
//     paint    Paint Studio fills the screen
//     music    Sequencer fills the screen
//     animate  the page plus a timeline: every animation as a bar to slide, stretch, scrub and play
let studioOpening=false;
const WS={
  page:{name:'Page',icon:'▦',hint:'Lay out the page.'},
  write:{name:'Write',icon:'✒',hint:'A word processor on the real page; everything stays inside the margins.',
    leave(){wrClose()},
    enter(prev){if(!narrow())setTab('w-text');wrOpen();docSync();const before=snap(),n=confineAll();if(n){before.wsEntry=prev&&prev!=='write'?prev:'page';undo.push(before);redo.length=0;save()}
      status(n?`Write keeps everything inside the margins: moved ${n} element${n===1?'':'s'} in. Undo puts them back, and goes back to ${WS[before.wsEntry||'page'].name}.`:'Write keeps everything inside the margins.');
      // FIX: web fonts loading after entry widen text past the margin; confine again once they settle, as flowDocs does.
      if(document.fonts&&document.fonts.status==='loading'){const pid=state.project&&state.project.id;document.fonts.ready.then(()=>{if(writing()&&state.project&&state.project.id===pid&&confineAll())save()})}}},
  paint:{name:'Paint',icon:'🖌',hint:'Draw. Put it on the page, behind it, or in Primitives.',
    enter(){select(null);if($('#w-studio').hidden)toggleStudio(true);
      // RULE: an empty easel opens on the project's first drawing, if any.
      if(sBlank()&&!studio.editing&&!studioOpening){const img=state.els.find(e=>e.tag==='img'&&/^data:image\//.test(e.content||''));if(img)studioOpenImage(img.content,{kind:'el',id:img.id},img.w)}},
    leave(){if(!$('#w-studio').hidden)toggleStudio(false)}},
  music:{name:'Music',icon:'♪',hint:'Write songs; the page plays them.',
    enter(){select(null);openSeq();$('#seqModal .seqwin').setAttribute('aria-modal','false')},
    leave(){closeSeq();$('#seqModal .seqwin').setAttribute('aria-modal','true')}},
  animate:{name:'Animate',icon:'◷',hint:'Every animation on one clock.',
    // RULE: Animate is about what's already on the page: the Add panel folds while it's open and comes back after.
    enter(){this.hadL=!document.body.classList.contains('noL');if(this.hadL&&!narrow())setSide('sideL',false);$('#timeline').hidden=false;tlRender();fitStage()},
    leave(){tlReset();$('#timeline').hidden=true;if(this.hadL&&!narrow())setSide('sideL',true);this.hadL=false;fitStage()}},
  model:{name:'3D',icon:'⬢',hint:'Bake a low-poly model into one sprite sheet the page can turn.',
    enter(){openM3d()},leave(){closeM3d()}},
};
const WS_IDS=Object.keys(WS);
// RULE: page and zine canvases open in Write; everything else opens in Page.
const autoWs=()=>['page','booklet','minizine'].includes(state.canvas&&state.canvas.type)?'write':'page';
function setWorkspace(id,{force}={}){
  if(!WS[id]||!state.project)return;
  const prev=document.body.dataset.ws;
  if(prev===id&&!force){wsSync();return}
  if(playing)setPlay(false);
  if(prev&&WS[prev]&&WS[prev].leave)WS[prev].leave();
  state.ws=id;document.body.dataset.ws=id;
  if(WS[id].enter)WS[id].enter(prev);
  wsSync();if(typeof fitTopbar==='function')requestAnimationFrame(fitTopbar);if(!projLoading&&prev&&prev!==id)save();if(typeof treeLater==='function')treeLater();
}
function wsSync(){
  const id=document.body.dataset.ws||'page';
  for(const b of document.querySelectorAll('#wsTabs .wstab'))b.setAttribute('aria-checked',b.dataset.ws===id);
  if(WS[id]){$('#wsIcon').textContent=WS[id].icon;$('#wsName').textContent=WS[id].name}
  $('#wsHint').textContent=WS[id]?WS[id].hint:'';
  $('#wsProj').textContent=state.project?state.project.name:'';
  syncDock();
  $('#wsFile').textContent=id==='music'?(state.music?state.music.name:'Song'):id==='paint'?(studio.editing?studioEditingName():'New drawing'):id==='animate'?'Timeline':'Page';
}
const studioEditingName=()=>{const e=studio.editing;if(!e)return'New drawing';
  if(e.kind==='el'){const el=state.els.find(x=>x.id===e.id);return el?(el.attrs&&el.attrs.alt)||'Image on the page':'Drawing'}
  if(e.kind==='bg')return'Background layer';if(e.kind==='prim'){const p=prims.list.find(x=>x.id===e.id);return p?p.name:'Primitive'}return'Drawing'};
// SECTION: workspace menu
// RULE: one button and a menu built from WS, so another workspace is one more WS entry and costs no toolbar width.
//   Alt+1…9 follow WS order.
function buildWsMenu(){
  const m=$('#wsTabs');m.replaceChildren();
  WS_IDS.forEach((id,i)=>{const w=WS[id],b=mkEl('button',{type:'button',className:'wstab'});b.dataset.ws=id;b.setAttribute('role','menuitemradio');b.tabIndex=-1;
    b.append(mkEl('i',{textContent:w.icon}),mkEl('b',{textContent:w.name}),mkEl('kbd',{textContent:i<9?'Alt+'+(i+1):''}),mkEl('small',{textContent:w.hint}));
    b.onclick=()=>{audio();sfx('click');wsMenu(false);setWorkspace(id)};m.append(b)});
}
function wsMenu(on){
  const m=$('#wsTabs'),btn=$('#wsBtn');if(on===undefined)on=m.hidden;if(on===!m.hidden)return;
  m.hidden=!on;btn.setAttribute('aria-expanded',on);
  if(on){const cur=m.querySelector('[aria-checked=true]')||m.firstChild;cur.focus()}else if(m.contains(document.activeElement))btn.focus();
}
buildWsMenu();
$('#wsBtn').onclick=()=>{audio();wsMenu()};
$('#wsBtn').addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();wsMenu(true)}});
$('#wsTabs').addEventListener('keydown',e=>{
  const all=[...$('#wsTabs').querySelectorAll('.wstab')],i=all.indexOf(document.activeElement);
  const go=j=>{e.preventDefault();all[(j+all.length)%all.length].focus()};
  if(e.key==='ArrowDown')go(i+1);else if(e.key==='ArrowUp')go(i-1);else if(e.key==='Home')go(0);else if(e.key==='End')go(all.length-1);
  else if(e.key==='Escape'||e.key==='Tab'){if(e.key==='Escape'){e.preventDefault();e.stopPropagation()}wsMenu(false)}
});
addEventListener('pointerdown',e=>{if(!$('#wsTabs').hidden&&!e.target.closest('#wsDrop'))wsMenu(false)},true);


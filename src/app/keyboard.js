// SECTION: keyboard
document.addEventListener('keydown',e=>{
  // RULE: while playing, keys belong to the page; only Esc and Ctrl/Cmd+Enter stop it.
  if(playing){if(e.key==='Escape'||((e.ctrlKey||e.metaKey)&&e.key==='Enter')){e.preventDefault();setPlay(false)}return}
  // RULE: Ctrl/Cmd+P, Ctrl/Cmd+K and Alt+1-9 answer anywhere in a project, the Sequencer and 3D panels included.
  if(state.project&&$('#title').hidden&&!document.querySelector('.modal:not([hidden]):not(#seqModal):not(#m3dModal)')){
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='p'){e.preventDefault();showFiles();return}
    if((e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='k'){e.preventDefault();openCmdPalette();return}
    if(e.altKey&&!e.ctrlKey&&!e.metaKey&&/^Digit[1-9]$/.test(e.code)&&WS_IDS[+e.code.slice(5)-1]){e.preventDefault();setWorkspace(WS_IDS[+e.code.slice(5)-1]);return}
  }
  if(tour.on&&e.key==='Escape'&&!document.querySelector('.modal:not([hidden])')&&!state.editing){e.preventDefault();endTour();return}
  if(!$('#title').hidden){if(e.key==='Escape'&&state.project){e.preventDefault();hideTitle()}return}
  if(state.editing){if(e.key==='Escape'){e.preventDefault();state.editing.t.blur()}return}
  const openModal=document.querySelector('.modal:not([hidden])');
  if(openModal&&openModal.id==='exportModal'&&(e.ctrlKey||e.metaKey)&&!e.shiftKey&&!e.altKey&&e.key.toLowerCase()==='s'){e.preventDefault();saveExportFile();return}
  if(openModal){if(e.key==='Escape'){if(openModal.id==='cmdModal')closeCmdPalette();else if(openModal.id==='exportModal')closeExport();else if(openModal.id==='sedModal')closeStructWindow();else if(openModal.id==='lockModal')$('#lockCancel').click();else if(openModal.id==='nodeModal')closeNodeEditor();else if(openModal.id==='seqModal'){if(document.body.dataset.ws==='music'){if(seqP.on)seqStop()}else closeSeq()}else if(openModal.id==='m3dModal')$('#m3dClose').click();else if(openModal.id==='obModal')$('#obSkip').click();else openModal.hidden=true}return}
  const tg=e.target;
  // RULE: text fields keep their keys; a focused <select> still passes Ctrl/Cmd shortcuts.
  // FIX: so do editable regions (the manuscript page): Delete, arrows and digits were reaching the page's elements.
  if(tg.closest&&tg.closest('input,textarea,[contenteditable="true"],[contenteditable=""]'))return;
  if(tg.closest&&tg.closest('select')&&!(e.ctrlKey||e.metaKey))return;
  const k=e.key,kl=k.toLowerCase(),code=e.code,el=selected(),pd=()=>e.preventDefault();
  const inStudio=state.ctx==='studio'&&!$('#w-studio').hidden;
  if(inStudio&&(e.ctrlKey||e.metaKey)){
    if((kl==='z'&&e.shiftKey)||kl==='y'){pd();sRedo();return}
    // RULE: layer keys follow Photoshop's where a browser lets them: Ctrl+Shift+N is the browser's, so Ctrl+Alt+N too.
    if(code==='KeyN'&&(e.altKey||e.shiftKey)){pd();addLayer();return}
    if(code==='KeyJ'&&!e.shiftKey&&!e.altKey){pd();dupLayer();return}
    if(code==='KeyE'&&!e.shiftKey&&!e.altKey){pd();mergeDown();return}
    if(code==='BracketRight'||code==='BracketLeft'){pd();movePaintLayer(code==='BracketRight'?1:-1);return}
    if(code==='Equal'||code==='NumpadAdd'){pd();sZoomStep(1);return}
    if(code==='Minus'||code==='NumpadSubtract'){pd();sZoomStep(-1);return}
    if(code==='Digit0'||code==='Numpad0'){pd();sZoomFit();return}
    if(k==='\\'||code==='Backslash'){pd();togglePalettes();return}
    if(kl==='z'){pd();sUndo();return}
    if(k==='Backspace'){pd();fillAll(state.bg);status('Filled with the background color');return}
  }
  if(e.ctrlKey||e.metaKey){
    if(k===','){pd();openSettings();return}
    if(k==='\\'||e.code==='Backslash'){pd();togglePanels();return}
    if(kl==='z'&&e.shiftKey){pd();doRedo();return}
    if(kl==='z'){pd();doUndo();return}
    if(kl==='y'){pd();doRedo();return}
    if(kl==='j'){pd();if(el&&el.md){status('Convert it to a component first; then it can be duplicated.');return}if(el&&!selDuplicate())dupSel();return}
    if(kl==='g'&&!e.altKey){pd();if(e.shiftKey)ungroupSel();else groupSel();return}
    if(k==='Enter'){pd();setPlay(true);return}
    if(kl==='l'&&e.shiftKey){pd();autoformat();return}
    if(code==='Equal'||code==='NumpadAdd'){pd();zoomStep(1);return}
    if(code==='Minus'||code==='NumpadSubtract'){pd();zoomStep(-1);return}
    if(code==='Digit0'||code==='Numpad0'){pd();setZoom(1);return}
    if(code==='Quote'){pd();setShowGrid(!state.showGrid);status(state.showGrid?'Grid shown':'Grid hidden');return}
    if(code==='Semicolon'&&e.shiftKey){pd();setSnap(!state.snap);status(state.snap?'Snapping on':'Snapping off');return}
    if(kl==='d'){pd();select(null);return}
    if(kl==='v'&&e.altKey&&!e.shiftKey){pd();openVersions();return}
    if(code==='KeyO'&&e.shiftKey){pd();openSset();return}
    if(kl==='s'){pd();if(e.shiftKey){finishEdit();openExport()}else if(e.altKey)downloadProject();else saveNow().then(ok=>{if(ok)status('Saved in this browser')});return}
    if(code==='BracketRight'){pd();if(el&&!selRestack(e.shiftKey?'front':1))e.shiftKey?restack(el,'front'):restack(el,1);return}
    if(code==='BracketLeft'){pd();if(el&&!selRestack(e.shiftKey?'back':-1))e.shiftKey?restack(el,'back'):restack(el,-1);return}
    return;
  }
  if(e.altKey){if(inStudio&&(k==='Backspace'||k==='Delete')){pd();fillAll(state.color);status('Filled with the foreground color')}
    if(inStudio&&(code==='BracketLeft'||code==='BracketRight')){pd();setActiveLayer(studio.li+(code==='BracketRight'?1:-1));return}
    // RULE: Alt+PageUp/PageDown step through the site's pages.
    if((k==='PageDown'||k==='PageUp')&&multiPage()){pd();pageStep(k==='PageDown'?1:-1)}return}
  // RULE: Tab always moves focus (keyboard users start there); the panels toggle on Ctrl/Cmd+\\.
  if(k==='Tab')return;
  if(e.shiftKey&&k==='F1'){pd();setTheme('dark');status('Dark interface');return}
  if(e.shiftKey&&k==='F2'){pd();setTheme('light');status('Light interface');return}
  if(k==='F1'||k==='?'){pd();toggleHelp();return}
  if(k==='/'&&!e.ctrlKey&&!e.metaKey&&!e.altKey){pd();openCmdPalette();return}
  if(tg.closest&&tg.closest('.scard,.pcard')&&(k===' '||k==='Enter'))return;
  if(kl==='p'){pd();setWorkspace(document.body.dataset.ws==='paint'?'page':'paint');return}
  // RULE: Space plays and stops whatever this workspace plays: the timeline in Animate, the frames in Paint (Music has its own).
  if(k===' '&&!e.shiftKey){const ws=document.body.dataset.ws;if(ws==='animate'){pd();$('#tlPlay').click();return}if(inStudio&&studio.frames.length>1){pd();playFrames();return}
    // RULE: on the Page workspace Space is Play, the page's primary toggle (Esc stops, as from the button).
    if(ws==='page'&&!inStudio&&(tg===document.body||stage.contains(tg)||desk.contains(tg))){pd();setPlay(true);return}}
  if(inStudio){
    if(k===','||k==='<'){pd();$('#fPrev').click();return}
    if(k==='.'||k==='>'){pd();$('#fNext').click();return}
    // RULE: Esc backs out one layer at a time: an open filter, then the selection, then the workspace.
    if(k==='Escape'&&!$('#brushEd').hidden){pd();closeBrushEditor();return}
    if(k==='Escape'&&!$('#fxPanel').hidden){pd();closeFx(false);return}
    if(k==='Escape'&&studio.sel){pd();selNone();return}
    if((k==='Delete'||k==='Backspace')&&studio.sel){pd();selClear();return}
    if(k==='Escape'){if(document.body.dataset.ws==='paint')setWorkspace('page');else toggleStudio(false);return}
    if(code==='BracketLeft'||code==='BracketRight'){pd();const up=code==='BracketRight',step=e.shiftKey?10:state.size>=20?4:state.size>=8?2:1;setSize(state.size+(up?step:-step));return}
    if(kl==='x'){swapColors();return}
    if(kl==='d'){setColor('#000000');setBg('#ffffff');return}
    if(kl==='b'){if(e.shiftKey&&BRUSHES.includes(state.tool))setTool(BRUSHES[(BRUSHES.indexOf(state.tool)+1)%BRUSHES.length]);else setTool(BRUSHES.includes(state.tool)?state.tool:state.lastBrush);status(TOOLS.find(t=>t.id===state.tool).name);return}
    const t=TOOLS.find(t=>t.key===kl&&!t.group);if(t){setTool(t.id);return}
    return;
  }
  if(el&&(e.key==='Delete'||e.key==='Backspace')){e.preventDefault();if(!selDelete())delSel();return}
  if(el&&el.md&&e.key.startsWith('Arrow')){e.preventDefault();status('It flows with the text; convert it to place it by hand.');return}
  if(el&&e.key.startsWith('Arrow')&&selIds().length>1){e.preventDefault();const s=e.shiftKey?(gridStep()||10):1,now=performance.now();if(!(nudge.id===el.id&&now-nudge.t<800))pushUndo();nudge={id:el.id,t:now};
    selNudge(e.key==='ArrowLeft'?-s:e.key==='ArrowRight'?s:0,e.key==='ArrowUp'?-s:e.key==='ArrowDown'?s:0);return}
  if(el&&e.key.startsWith('Arrow')){e.preventDefault();const s=e.shiftKey?(gridStep()||10):1;const now=performance.now();if(!(nudge.id===el.id&&now-nudge.t<800))pushUndo();nudge={id:el.id,t:now};if(e.key==='ArrowLeft')el.x-=s;if(e.key==='ArrowRight')el.x+=s;if(e.key==='ArrowUp')el.y-=s;if(e.key==='ArrowDown')el.y+=s;renderEl(el);updateSel();save();return}
  if(el&&e.key==='Enter'){e.preventDefault();startEdit(el);return}
  if(k==='Escape'){if(iso.id){exitIso();return}if(!el&&document.body.classList.contains('xmb')){pd();xmbOpen();return}select(null);return}
  if(k===','||k==='<'){pd();cycleStyle(-1);return}
  if(k==='.'||k==='>'){pd();cycleStyle(1);return}
  if(/^[1-9]$/.test(k)){dropAtMouse(Object.keys(TAGS)[+k-1]);return}
});
let nudge={id:null,t:0};
// RULE: the studio's own floating panels (filters, the brush editor) count as the studio for keys.
document.addEventListener('pointerdown',e=>{state.ctx=e.target.closest&&e.target.closest('#w-studio,#fxPanel,#brushEd')?'studio':'page'},true);
function restack(el,how){
  pushUndo();const order=[...state.els].sort((a,b)=>(a.z||0)-(b.z||0));let i=order.indexOf(el);order.splice(i,1);
  if(how==='front')i=order.length;else if(how==='back')i=0;else i=Math.max(0,Math.min(order.length,i+how));
  order.splice(i,0,el);order.forEach((x,n)=>{x.z=n+1;const h=hostOf(x.id);if(h)h.style.zIndex=x.z});updateSel();save();
  status({front:'Brought to front',back:'Sent to back'}[how]||(how>0?'Brought forward':'Sent backward'));
}
function dupSel(){const el=selected();if(!el)return;pushUndo();const c={...JSON.parse(JSON.stringify(el)),id:nid('e'),x:el.x+18,y:el.y+18,z:maxZ()+1};state.els.push(c);renderEl(c);select(c.id);sfx('pop');save()}
function cycleStyle(dir){
  let cards=[...sgrid.querySelectorAll('.scard')];
  const vis=cards.filter(c=>c.offsetParent!==null);if(vis.length)cards=vis;if(!cards.length)return;
  let i=cards.findIndex(c=>c.classList.contains('on'));
  i=i<0?(dir>0?0:cards.length-1):(i+dir+cards.length)%cards.length;
  const c=cards[i];chooseStyle(c._f,c._s);c.scrollIntoView({block:'nearest'});
  status(`${i+1}/${cards.length} ${c.querySelector('code').textContent}`);
}


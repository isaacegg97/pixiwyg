// SECTION: settings page
// RULE: one place for the app's own defaults: how it looks, how the editor behaves, what a new export starts with,
//   and the resets. Every control here is the same setting the toolbar or menus change (setSnap, setTheme, setExp,
//   ...), so the two never disagree; the page re-reads them each time it opens. Ctrl/Cmd+, opens it.
// FORMAT: pixiwyg.sound '1' | '0' (new here; the rest already had keys).
function setSound(on){state.sound=!!on;lsSet('pixiwyg.sound',state.sound?'1':'0');const c=$('#setSound');if(c)c.checked=state.sound}
// FORMAT: the colours a theme card shows: the theme's own tokens, else its base palette's.
const THEME_PREVIEW={light:{desk:'#a6a2d2',chrome:'#eceaf6',ink:'#16121f',hot:'#ff2e88',sel:'#2e5bff',sun:'#ffd23f',paper:'#ffffff'},
  dark:{desk:'#24212f',chrome:'#2e2b3d',ink:'#e9e5f8',hot:'#ff5aa5',sel:'#7b93ff',sun:'#ffd23f',paper:'#1b1925'}};
function themePreview(id){
  if(id==='system')return{...(matchMedia('(prefers-color-scheme:dark)').matches?THEME_PREVIEW.dark:THEME_PREVIEW.light)};
  const t=themeById(id);if(!t)return{...THEME_PREVIEW[id]||THEME_PREVIEW.light};
  const out={...THEME_PREVIEW[themeBase(t.css)]},body=[...t.css.matchAll(/:root\[data-apptheme\]\s*\{([^}]*)\}/g)].map(m=>m[1]).join(';');
  for(const k of Object.keys(out)){const m=new RegExp(`--${k}\\s*:\\s*([^;]+);`).exec(body);if(m)out[k]=m[1].trim()}
  return out;
}
// RULE: theme cards are one builder, used by Settings and by the first-launch welcome; picking applies at once.
function drawSetThemes(){themeCards($('#setThemes'));if(!$('#obModal').hidden)themeCards($('#obThemes'))}
function themeCards(box){
  box.replaceChildren();
  const about={system:'Follows your computer: light by day, dark by night.',light:'The PIXIWYG lilac.',dark:'The PIXIWYG lilac, after hours.'};
  for(const id of themeStops()){
    const t=themeById(id),p=themePreview(id),b=mkEl('button',{type:'button',className:'thcard'});b.dataset.theme=id;
    b.setAttribute('role','radio');b.setAttribute('aria-checked',theme===id);
    // FORMAT: a little interface drawn in the theme's colours: desk, a panel, text, the two accents, a selection.
    const sw=mkEl('span',{className:'thsw'});sw.style.cssText=`--d:${p.desk};--c:${p.chrome};--i:${p.ink};--h:${p.hot};--s:${p.sel};--u:${p.sun};--p:${p.paper}`;
    sw.append(mkEl('i'),mkEl('b',{textContent:'Aa'}),mkEl('em'),mkEl('u'));
    b.append(sw,mkEl('strong',{textContent:id==='custom'?`${t.name} (your file)`:themeLabel(id)}),mkEl('small',{textContent:t?(t.about||(id==='custom'?'Loaded from a .css file.':'')):about[id]}));
    b.tabIndex=theme===id?0:-1;b.onclick=()=>{audio();sfx('click');setTheme(id);drawSetThemes();box.querySelector(`[data-theme="${id}"]`)?.focus()};
    box.append(b);
  }
}
function syncSettings(){
  $('#setSnap').checked=!!state.snap;$('#setShowGrid').checked=!!state.showGrid;$('#setGrid').value=String(state.grid);
  $('#setSound').checked=!!state.sound;$('#setUi').value=ui.mode;$('#setDocView').value=dp.view;$('#setCatPrims').checked=catPrimsOpen.v;
  for(const k of ['nojs','fonts','prune','playerCdn'])$('#setExp-'+k).checked=!!expOpt[k];
  $('#setErrN').textContent=ERRS.length?`${ERRS.length} saved`:'empty';
  drawSetThemes();syncThemeMenu();
}
function openSettings(){syncSettings();$('#setModal').hidden=false;$('#setThemes [aria-checked="true"]')?.focus()}
function closeSettings(){$('#setModal').hidden=true}
// RULE: back to how the panels start: Project and Add on the left, Properties on the right, default widths, all open.
function resetPanels(){
  for(const d of Object.values(DOCKS)){delete panels[d.k];document.body.style.removeProperty(d.v)}
  panels.before=[...DOCK_DEF.before];panels.after=[...DOCK_DEF.after];applyDock();
  foldDock('tree',false);setSide('sideL',true);setSide('sideR',true);setTab('w-styles');savePanels();
}
$('#setSnap').onchange=e=>setSnap(e.target.checked);
$('#setUi').onchange=e=>setUi(e.target.value);
$('#setShowGrid').onchange=e=>setShowGrid(e.target.checked);
$('#setGrid').onchange=e=>setGrid(e.target.value);
$('#setSound').onchange=e=>{setSound(e.target.checked);audio();sfx('blip')};
$('#setDocView').onchange=e=>{if(typeof dpSetView==='function')dpSetView(e.target.value);else lsSet('pixiwyg.doc.view',e.target.value)};
$('#setCatPrims').onchange=e=>{catPrimsOpen.v=e.target.checked;if(typeof renderCatPrims==='function')renderCatPrims()};
for(const k of ['nojs','fonts','prune','playerCdn'])$('#setExp-'+k).onchange=e=>setExp(k,e.target.checked);
$('#setResetPanels').onclick=()=>{audio();resetPanels();status('Panels are back where they start.')};
$('#setWelcome').onclick=()=>{audio();try{localStorage.removeItem('pixiwyg.onboarded')}catch(e){}closeSettings();showWelcome()};
$('#setClearErr').onclick=()=>{audio();ERRS.length=0;try{localStorage.removeItem('pixiwyg.errors')}catch(e){}syncSettings();status('Error log cleared.')};
$('#setClose').onclick=()=>{audio();closeSettings()};
$('#setModal').addEventListener('click',e=>{if(e.target.id==='setModal')closeSettings()});
$('#settingsBtn').onclick=()=>{audio();$('#moreMenu').open=false;openSettings()};
setSound(lsGet('pixiwyg.sound','1')!=='0');
// RULE: theme cards are a radio group: one tab stop, arrow keys move and pick (as any radio group does).
for(const id of ['setThemes','obThemes'])$('#'+id).addEventListener('keydown',e=>{
  const cards=[...e.currentTarget.querySelectorAll('.thcard')],i=cards.indexOf(document.activeElement);if(i<0)return;
  const d={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key];if(!d)return;e.preventDefault();e.stopPropagation();cards[(i+d+cards.length)%cards.length].click()});


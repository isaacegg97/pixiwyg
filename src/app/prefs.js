// SECTION: snap + theme settings
const pref=(k,d)=>{try{return localStorage.getItem(k)??d}catch(e){return d}};
const setPref=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
function setSnap(on){state.snap=on;const b=$('#snapBtn');b.setAttribute('aria-pressed',on);b.textContent=on?'Snap on':'Snap off';setPref('pixiwyg.snap',on?'1':'0')}
function setGrid(n){state.grid=+n||0;$('#gridSize').value=String(state.grid);$('#gridlines').style.setProperty('--g',(state.grid||8)+'px');$('#gridlines').hidden=!(state.showGrid&&state.grid);setPref('pixiwyg.grid',state.grid)}
function setShowGrid(on){state.showGrid=on;const b=$('#showGridBtn');b.setAttribute('aria-pressed',on);b.textContent=on?'Hide grid':'Show grid';$('#gridlines').hidden=!(on&&state.grid);setPref('pixiwyg.showgrid',on?'1':'0')}
$('#gridSize').onchange=e=>{setGrid(e.target.value);status(state.grid?`Snapping to a ${state.grid}px grid`:'Grid off')};
$('#showGridBtn').onclick=()=>{audio();sfx('click');setShowGrid(!state.showGrid)};
$('#snapBtn').onclick=()=>{audio();sfx('click');setSnap(!state.snap)};
const THEMES=['system','light','dark'];let theme='system';
// RULE: the Theme button steps through System, Light, Dark, the built-in themes, then a loaded file (apptheme.js);
//   a theme sits on the built-in palette its color-scheme names.
const themeStops=()=>[...THEMES,...BUILTIN_THEMES.map(t=>'t:'+t.id),...(appTheme?['custom']:[])];
function setTheme(t){theme=themeStops().includes(t)?t:'system';const r=document.documentElement,th=themeById(theme);
  if(theme==='system')r.removeAttribute('data-pix');else r.setAttribute('data-pix',th?themeBase(th.css):theme);
  r.toggleAttribute('data-apptheme',!!th);applyAppTheme(th&&th.css);
  setPref('pixiwyg.theme',theme);syncThemeMenu();if(typeof fitTopbar==='function')requestAnimationFrame(fitTopbar)}
syncThemeMenu();
// RULE: every theme is one search away in the command window: "theme nord", Enter. Rebuilt when a file is loaded.
function syncThemeCmds(){for(let i=CMD_ITEMS.length-1;i>=0;i--)if(CMD_ITEMS[i].cat==='Themes')CMD_ITEMS.splice(i,1);
  for(const id of themeStops())CMD_ITEMS.push({cat:'Themes',name:'Theme: '+themeLabel(id),hint:(themeById(id)||{}).about||'Built in',keys:'',xmb:'settings',on:()=>theme===id,run:()=>{setTheme(id);status('Theme: '+themeLabel(id))}})}
syncThemeCmds();

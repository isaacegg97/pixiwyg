// SECTION: interface themes (the app's own look, not the page being made)
// RULE: a theme is a .css file that sets the tokens below under :root[data-apptheme]. Light and dark stay built in;
//   a loaded theme becomes one more stop on the Theme button. Its color-scheme (light or dark) picks which built-in
//   palette fills any token it leaves out, so a theme can be three lines or all of them.
// FORMAT: a token is [name, what it paints, written-as?]: written-as keeps a token tied to another in the template.
// FORMAT: localStorage pixiwyg.apptheme = {name, css}. src/app/themes/template.css is themeTemplate()'s output
//   with the light defaults (a test keeps them the same).
// SAFETY: a theme is styling only. @import, url() other than data:, and anything that could end the <style> are
//   removed, so loading one never reaches the network; capped at 256 KB.
const APP_TOKENS=[
  ['Desk and panels',[
    ['desk','the patterned background behind the page'],['desk2','the second colour of that pattern'],
    ['chrome','panels, toolbar and menus'],['chrome2','panel headers, borders between rows, inset areas'],
    ['paper','fields, cards and dialogs'],['ink','text, borders and icons'],['muted','secondary text and hints'],
    ['line','faint dividers in lists'],['shadow','the hard drop shadow under buttons and panels'],['scrim','the dimming behind dialogs and the tour']]],
  ['Accents',[
    ['hot','the main accent: warnings, active tabs, highlights'],['hot2','the accent when hovered'],['onhot','text on the accent'],['hot-ink','the accent as text (darker, for contrast)'],
    ['sel','selection, focus rings, links'],['onsel','text on the selection colour'],
    ['sun','the second accent: badges and primary buttons'],['onsun','text on the second accent'],
    ['act','pressed and primary buttons'],['actfg','text on pressed and primary buttons']]],
  ['Status',[['bad','errors and recording'],['onbad','text on the error colour'],['warn','warnings'],['ok','success and playing'],['lib','the "library" tag']]],
  ['Canvas helpers',[
    ['page','the page when it has no background of its own'],['check-a','transparency checkerboard, first square'],['check-b','transparency checkerboard, second square'],
    ['grid-minor','minor grid lines','color-mix(in srgb,var(--sel) 10%,transparent)'],['grid-major','major grid lines','color-mix(in srgb,var(--sel) 22%,transparent)']]],
  ['Node editors',[
    ['n-head','node header, default'],['n-headfg','node header text'],['n-events','events, colour nodes'],['n-actions','actions, shape nodes'],
    ['n-values','values, motion nodes'],['n-math','maths and text, type nodes'],['n-anim','animation, light nodes'],['n-misc','combine nodes'],['n-imported','imported nodes']]],
  ['Manuscript page view',[
    ['doc-paper','the page'],['doc-ink','its text'],['doc-desk','behind the page in Focus mode'],
    ['doc-code','inline code'],['doc-raw','Markdown-only blocks'],['doc-rawline','the edge of those blocks']]],
  ['Logo (letters cycle hot, sun, then these)',[['logo3','third letter'],['logo4','fourth letter'],['logo5','fifth letter'],['logo6','sixth letter']]],
  ['Shape',[['ctl-h','height of buttons and compact controls'],['radius','corner rounding of controls (0px is square)']]],
  ['Type',[['f-ui','interface font (only fonts already installed, or a data: @font-face in this file)'],['f-mono','monospaced font']]],
];
const THEME_MAX=256*1024;
function cleanThemeCSS(t){
  return String(t??'').slice(0,THEME_MAX)
    .replace(/<\/?style/gi,'')
    .replace(/@import[^;]*;?/gi,'')
    .replace(/url\(\s*(['"]?)(?!data:)[^)]*\)/gi,'none')
    .replace(/expression\s*\(/gi,'(');
}
const cleanThemeName=v=>String(v??'').replace(/\.css$/i,'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,40)||'Custom';
// FORMAT: [{id, name, about, css}] from src/app/themes/*.css, put in by tools/scripts/build.mjs.
const BUILTIN_THEMES=/* INJECT:THEMES */[];
var appTheme=(()=>{try{const v=JSON.parse(localStorage.getItem('pixiwyg.apptheme'));return v&&typeof v.css==='string'?{name:cleanThemeName(v.name),css:cleanThemeCSS(v.css)}:null}catch(e){return null}})();   // HACK: var: setTheme (dock.js) reads it at boot.
// FORMAT: a theme choice is 'system' | 'light' | 'dark' | 't:<built-in id>' | 'custom' (the loaded file).
const themeById=id=>id==='custom'?appTheme:typeof id==='string'&&id.startsWith('t:')?BUILTIN_THEMES.find(t=>'t:'+t.id===id)||null:null;
const themeBase=css=>/color-scheme\s*:\s*dark/i.test(css||'')?'dark':'light';
const themeLabel=id=>{const t=themeById(id);return t?t.name:id[0].toUpperCase()+id.slice(1)};
function applyAppTheme(css){
  // INVARIANT: last in <body>, after the app's own stylesheet (which is in <body> too), so a theme wins ties.
  let st=document.getElementById('appTheme');if(!st){st=document.createElement('style');st.id='appTheme'}if(st!==document.body.lastElementChild)document.body.append(st);
  st.textContent=css||'';
}
function loadAppTheme(name,css){
  appTheme={name:cleanThemeName(name),css:cleanThemeCSS(css)};
  try{localStorage.setItem('pixiwyg.apptheme',JSON.stringify(appTheme))}catch(e){}
  setTheme('custom');syncThemeMenu();status(`Interface theme “${appTheme.name}” on. Settings switches back any time.`);
}
function forgetAppTheme(){appTheme=null;try{localStorage.removeItem('pixiwyg.apptheme')}catch(e){}if(theme==='custom')setTheme('system');syncThemeMenu();status('Your theme file is forgotten.')}
function syncThemeMenu(){const b=$('#appThemeForget');if(b)b.hidden=!appTheme;if(typeof syncThemeCmds==='function')syncThemeCmds();if(typeof drawSetThemes==='function'&&!$('#setModal').hidden)drawSetThemes()}
// FORMAT: every token with what it paints, at the values showing now, ready to copy and edit.
function themeTemplate(){
  const cs=getComputedStyle(document.documentElement),w=Math.max(...APP_TOKENS.flatMap(([,t])=>t.map(([n])=>n.length)))+4;
  const out=['/* SECTION: PIXIWYG interface theme',
    '   Change the values, save it as a .css file, and load it from More ▾ → Settings… → Load theme file.',
    '   Delete any line you do not want to change: the built-in palette named by color-scheme fills it in.',
    '   Only data: URLs work in url() and @font-face; anything that would reach the network is removed on load.',
    '   Everything is scoped to :root[data-apptheme], which is only set while this theme is chosen. */',
    ':root[data-apptheme]{'],line=(decl,d)=>out.push(decl+' '.repeat(Math.max(1,w+26-decl.length))+`/* ${d} */`);
  line(`  color-scheme: ${cs.colorScheme.includes('dark')?'dark':'light'};`,'light or dark: native controls, and the palette that fills the gaps');
  for(const [g,toks] of APP_TOKENS){out.push('',`  /* SECTION: ${g} */`);
    for(const [n,d,as] of toks)line(`  --${n}: ${as||cs.getPropertyValue('--'+n).trim()};`,d)}
  out.push('}','','/* SECTION: beyond the tokens (optional)',
    '   Any CSS works here. Keep it under :root[data-apptheme] so it only applies while the theme is chosen, e.g.',
    '   :root[data-apptheme] .btn{border-radius:6px;box-shadow:none}',
    '   :root[data-apptheme] .phead{letter-spacing:.2em} */','');
  return out.join('\n');
}
$('#appThemeFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  if(f.size>THEME_MAX){status('That theme is over 256 KB; a theme is only CSS.');return}loadAppTheme(f.name,await f.text())};
$('#appThemeTpl').onclick=()=>{audio();download(new Blob([themeTemplate()],{type:'text/css'}),'pixiwyg-theme.css');status('Saved pixiwyg-theme.css: every interface colour, as it looks now. Edit it, then Load theme file in Settings.')};
$('#appThemeForget').onclick=()=>{audio();forgetAppTheme()};


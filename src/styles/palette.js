// SECTION: page palette
// FORMAT: a scheme is 18 colors in iTerm2/terminal order; every stylesheet color snaps to its nearest palette color.
const PAL_ROLES=['Background','Foreground','Black','Red','Green','Yellow','Blue','Magenta','Cyan','White','Bright black','Bright red','Bright green','Bright yellow','Bright blue','Bright magenta','Bright cyan','Bright white'];
const PAL_SHORT=['BG','FG','0','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15'];
const FEATURED=['Dracula','Nord','Gruvbox Dark','Gruvbox Light','iTerm2 Solarized Dark','iTerm2 Solarized Light','Catppuccin Mocha','Catppuccin Latte','TokyoNight','Rose Pine','Rose Pine Dawn','Everforest Dark Med','Kanagawa Wave','One Half Dark','One Half Light','Atom One Dark','Monokai Pro','Night Owl','Synthwave','Tomorrow Night','GitHub Dark','GitHub Light Default','Ubuntu','Homebrew','Green Phosphor CRT','Amber CRT Retro','C64','IBM 5153 CGA','Apple Classic','Matrix','Zenburn','Ayu'];
const SCHEME_EXT=new Set(['itermcolors','toml','yml','yaml','conf','xresources','theme','colors','json','ini']);
const palOpt={recolor:true,page:true,paint:true,flip:'auto'};
let SCHEMES=[];
const palC=i=>state.palette.c[i];
const pagePal=()=>!!(state.palette&&palOpt.page);
const palMode=el=>(el&&(el.pal||(el.nopal?'off':'')))||'auto';
const palOn=el=>{if(!state.palette)return false;const m=palMode(el);return m==='auto'?palOpt.recolor:m==='on'};
function hex2rgb(h){h=h.replace('#','');if(h.length<6)h=h.split('').map(x=>x+x).join('');const n=parseInt(h.slice(0,6),16);return[n>>16&255,n>>8&255,n&255]}
const lin=c=>(c/=255)<=.04045?c/12.92:((c+.055)/1.055)**2.4;
function oklab([r,g,b]){r=lin(r);g=lin(g);b=lin(b);const l=Math.cbrt(.4122214708*r+.5363325363*g+.0514459929*b),m=Math.cbrt(.2119034982*r+.6806995451*g+.1073969566*b),s2=Math.cbrt(.0883024619*r+.2817188376*g+.6299787005*b);return[.2104542553*l+.793617785*m-.0040720468*s2,1.9779984951*l-2.428592205*m+.4505937099*s2,.0259040371*l+.7827717662*m-.808675766*s2]}
const NAMED='aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen|buttonface|buttontext|canvas|canvastext|graytext|highlight|highlighttext|linktext|field|fieldtext';
const COLOR_RE=new RegExp(`#[0-9a-f]{3,8}\\b|(?:rgb|hsl)a?\\([^()]*\\)|\\b(?:${NAMED})\\b`,'gi');
const PROP_RE=/color|background|border|shadow|outline|fill|stroke|caret|accent|column-rule|text-decoration|^--/i;
const cctx=document.createElement('canvas').getContext('2d');
function parseColor(tok){
  cctx.fillStyle='#010203';cctx.fillStyle=tok;const a=cctx.fillStyle;cctx.fillStyle='#040506';cctx.fillStyle=tok;if(a!==cctx.fillStyle)return null;
  if(a[0]==='#')return[...hex2rgb(a),1];const m=a.match(/rgba?\(([^)]+)\)/);if(!m)return null;const v=m[1].split(',').map(Number);return[v[0],v[1],v[2],v[3]??1];
}
let palLabs=null,palBaseSheet=null;
function palKey(){return state.palette?state.palette.c.join('')+'|'+palOpt.flip:''}
function nearestPal(rgb,flip){
  if(!palLabs)palLabs=state.palette.c.map(h=>({h,lab:oklab(hex2rgb(h))}));
  // RULE: light/dark flip applies to neutrals only (chroma <= .08); accents keep lightness so they still find their hue.
  let [L,a,b]=oklab(rgb);const C=Math.hypot(a,b);if(flip&&C<=.08)L=1-L;const wL=C>.05?.6:1.6;
  let best=palLabs[0],bd=Infinity;for(const p of palLabs){const [l2,a2,b2]=p.lab,d=wL*(L-l2)**2+(a-a2)**2+(b-b2)**2;if(d<bd){bd=d;best=p}}return best.h;
}
function walkStyles(rules,fn){for(const r of rules){if(r.style)fn(r.style);if(r.cssRules)walkStyles(r.cssRules,fn)}}
const recolorValue=(v,map)=>v.split(/(url\([^)]*\))/i).map((seg,i)=>i%2?seg:seg.replace(COLOR_RE,t=>map(t)??t)).join('');
function sheetLightness(sh){
  const vars={};walkStyles(sh.cssRules,st=>{for(let i=0;i<st.length;i++)if(st[i].startsWith('--'))vars[st[i]]=st.getPropertyValue(st[i])});
  const res=(v,d=0)=>d>5?v:v.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/g,(m,n,fb)=>vars[n]!=null?res(vars[n],d+1):(fb||''));
  let s=0,n=0;
  walkStyles(sh.cssRules,st=>{const v=res(st.getPropertyValue('background-color')||st.getPropertyValue('background')||'');if(!v)return;
    for(const t of v.split(/url\([^)]*\)/i).join(' ').match(COLOR_RE)||[]){const c=parseColor(t);if(c&&c[3]>.5){s+=oklab(c)[0];n++}}});
  return n?s/n:.9;
}
function recolorSheet(f){
  const key=palKey();if(f._pal&&f._pal.key===key)return f._pal.sheet;
  const sh=new CSSStyleSheet();try{sh.replaceSync([...f.sheet.cssRules].map(r=>r.cssText).join('\n'))}catch(e){return f.sheet}
  const darkPal=oklab(hex2rgb(palC(0)))[0]<.5,lightSheet=sheetLightness(sh)>.5;
  const flip=palOpt.flip==='on'||(palOpt.flip==='auto'&&lightSheet===darkPal);
  const cache=new Map(),map=t=>{if(cache.has(t))return cache.get(t);const c=parseColor(t);let out=null;
    if(c&&c[3]>0){const h=nearestPal(c,flip);if(c[3]<1){const [r,g,b]=hex2rgb(h);out=`rgba(${r}, ${g}, ${b}, ${c[3]})`}else out=h}cache.set(t,out);return out};
  walkStyles(sh.cssRules,st=>{for(let i=0;i<st.length;i++){const pr=st[i];if(!PROP_RE.test(pr))continue;const v=st.getPropertyValue(pr);if(!v)continue;const nv=recolorValue(v,map);if(nv!==v)st.setProperty(pr,nv,st.getPropertyPriority(pr))}});
  f._pal={key,sheet:sh};return sh;
}
function palBase(){
  const key=palKey();if(palBaseSheet&&palBaseSheet.key===key)return palBaseSheet.sheet;
  const sh=new CSSStyleSheet(),[bg,fg]=state.palette.c,line=palC(10),link=palC(6);
  // INVARIANT: colors only, so it underlays any framework and fills just what the browser would default.
  sh.replaceSync(`.__body{color:${fg}}a{color:${link}}hr{border-color:${line}}input,textarea,select,button{color:${fg};background-color:${bg};border-color:${line}}th,td{border-color:${line}}code,pre{color:${palC(4)}}blockquote{border-left-color:${palC(7)}}::placeholder{color:${line}}`);
  palBaseSheet={key,sheet:sh};return sh;
}
function elementSheets(el,f){const on=palOn(el),ns=typeof nodeSheet==='function'&&nodeSheet(),tail=ns&&f!==state.files.find(x=>x.gen)?[ns]:[];
  if(f)return on?[palBase(),recolorSheet(f),...tail]:[f.sheet,...tail];return on?[palBase(),...tail]:tail}
// SECTION: element colors carried through the style
// RULE: a style draws with several shades of one color (bevel, hover, ::after shadow); each same-family shade is
//   swapped for the new color, offset in lightness by as much as it was.
function fromOklab([L,a,b]){
  const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.291485548*b)**3;
  const enc=c=>{c=Math.max(0,Math.min(1,c));return Math.round(255*(c<=.0031308?12.92*c:1.055*c**(1/2.4)-.055))};
  return[enc(4.0767416621*l-3.3077115913*m+.2309699292*s),enc(-1.2684380046*l+2.6097574011*m-.3413193965*s),enc(-.0041960863*l-.7034186147*m+1.707614701*s)];
}
function sameFamily(c,x){
  const Cc=Math.hypot(c[1],c[2]),Cx=Math.hypot(x[1],x[2]);
  if(Cx>.04){if(Cc<.03)return false;let d=Math.abs(Math.atan2(c[2],c[1])-Math.atan2(x[2],x[1]));if(d>Math.PI)d=2*Math.PI-d;return d<.45&&Cc/Cx>.35&&Cc/Cx<2.5}
  return Cc<.04&&Math.abs(c[0]-x[0])<.04;
}
function shiftTo(c,x,y){
  const Cx=Math.hypot(x[1],x[2]),k=Cx>.04?Math.min(2,Math.hypot(c[1],c[2])/Cx):1;
  return fromOklab([Math.max(0,Math.min(1,y[0]+c[0]-x[0])),y[1]*k,y[2]*k]);
}
const accentById=new Map();
const accentSig=el=>JSON.stringify([el.fileId,el.selector,palOn(el)?palKey():'',...EL_COLORS.map(([k])=>el.colors&&el.colors[k]?colorOf(el.colors[k]):'')]);
function accentSheet(el,t,sheets){
  const tg=t.target,base=sheets[sheets.length-1];if(!base)return null;
  // HACK: the sheet's own colors are read by lifting the overrides for one synchronous computed-style read.
  const saved=tg.getAttribute('style');for(const [k,prop] of EL_COLORS)if(el.colors[k])tg.style.removeProperty(prop);
  const cs=getComputedStyle(tg),orig={fg:cs.color,bg:cs.backgroundColor,line:cs.borderTopColor};
  if(saved==null)tg.removeAttribute('style');else tg.setAttribute('style',saved);
  const pairs=[];
  for(const k of ['bg','line','fg']){const v=el.colors[k];if(!v||v.none)continue;const o=parseColor(orig[k]),n=parseColor(colorOf(v));
    if(o&&n&&o[3]>0&&n[3]>0)pairs.push({x:oklab(o),y:oklab(n)})}
  const sig=accentSig(el)+JSON.stringify(orig);
  if(!pairs.length){accentById.delete(el.id);return null}
  const memo=base._acc||(base._acc=new Map());let sh=memo.get(sig);
  if(sh===undefined){
    sh=new CSSStyleSheet();
    try{sh.replaceSync(cssFrom(pruneRules(base.cssRules,[t.node,...t.node.querySelectorAll('*')],false)))}catch(e){sh=null}
    if(sh){
      const cache=new Map(),map=tok=>{if(cache.has(tok))return cache.get(tok);const c=parseColor(tok);let out=null;
        if(c&&c[3]>0){const lab=oklab(c);for(const {x,y} of pairs)if(sameFamily(lab,x)){const [r,g,b]=shiftTo(lab,x,y);out=c[3]<1?`rgba(${r}, ${g}, ${b}, ${c[3]})`:'#'+[r,g,b].map(n=>n.toString(16).padStart(2,'0')).join('');break}}
        cache.set(tok,out);return out};
      let changed=0;
      const walk=rules=>{for(let i=rules.length-1;i>=0;i--){const r=rules[i];
        // INVARIANT: @keyframes are left alone; redefining one here would replace the whole rule.
        if(r instanceof CSSKeyframesRule){(r.parentRule||sh).deleteRule(i);continue}
        if(r.cssRules)walk(r.cssRules);
        if(!r.style)continue;
        for(const pr of [...r.style]){const v=r.style.getPropertyValue(pr),nv=PROP_RE.test(pr)&&v?recolorValue(v,map):v;
          if(nv!==v){r.style.setProperty(pr,nv,r.style.getPropertyPriority(pr));changed++}else r.style.removeProperty(pr)}}};
      walk(sh.cssRules);
      if(!changed)sh=null;else sh._accent=true;
    }
    memo.set(sig,sh);
  }
  if(sh)accentById.set(el.id,{sig:accentSig(el),sheet:sh});else accentById.delete(el.id);
  return sh;
}
// INVARIANT: export and live preview draw with this; it must include the element's accent sheet.
function sheetsFor(el,f){const s=elementSheets(el,f),a=el.colors&&accentById.get(el.id);return a&&a.sig===accentSig(el)?[...s,a.sheet]:s}
function applyPageColors(){
  const on=pagePal(),r=document.documentElement.style;
  stage.style.color=on?palC(1):'';
  if(on)r.setProperty('--pvfg',palC(1));else r.removeProperty('--pvfg');
  renderBackground();
}
let palT;
function palChanged(now){
  palLabs=null;clearTimeout(palT);
  const run=()=>{applyPageColors();buildSwatches();renderPalWin();renderBgWin();renderAll();renderStyles();renderInspector();save()};
  if(now)run();else{applyPageColors();buildSwatches();palT=setTimeout(()=>{renderAll();renderStyles();renderInspector();save()},140)}
}
function setPalette(p,{noUndo}={}){if(!noUndo)pushUndo();state.palette=p?{name:p.name,c:p.c.map(x=>x.toLowerCase()),custom:!!p.custom}:null;palChanged(true)}
function schemeFromEntry(e){const c=[];for(let i=0;i<18;i++)c.push('#'+e.c.slice(i*6,i*6+6));return{name:e.n,c}}
// SECTION: terminal theme importers
function parseScheme(text,fallback){
  const hex=v=>{v=String(v||'').trim().replace(/^['"]|['"]$/g,'');if(/^0x/i.test(v))v='#'+v.slice(2);if(/^[0-9a-f]{6}$/i.test(v))v='#'+v;return/^#[0-9a-f]{6}/i.test(v)?v.slice(0,7).toLowerCase():null};
  const N=['black','red','green','yellow','blue','purple','cyan','white'];
  const ok=(name,c)=>c.length===18&&c.every(Boolean)?{name:name||fallback||'Imported scheme',c}:null;
  const t=text.trim();
  if(t[0]==='{'){try{const j=JSON.parse(t),sc=Array.isArray(j.schemes)?j.schemes[0]:j;
    const g=k=>hex(sc[k]??sc[k.replace('purple','magenta')]??sc[k.replace('Purple','Magenta')]);
    const r=ok(sc.name,[g('background'),g('foreground'),...N.map(g),...N.map(k=>g('bright'+k[0].toUpperCase()+k.slice(1)))]);if(r)return r}catch(e){}}
  if(/<plist/i.test(t)){try{const doc=new DOMParser().parseFromString(t,'application/xml'),top=doc.querySelector('plist > dict'),map={};
    const kids=[...top.children];for(let i=0;i<kids.length-1;i++)if(kids[i].tagName==='key'&&kids[i+1].tagName==='dict'){const d=kids[i+1],vals={};const kk=[...d.children];for(let j=0;j<kk.length-1;j++)if(kk[j].tagName==='key')vals[kk[j].textContent]=parseFloat(kk[j+1].textContent);
      const to=x=>Math.round(Math.max(0,Math.min(1,x||0))*255).toString(16).padStart(2,'0');map[kids[i].textContent]='#'+to(vals['Red Component'])+to(vals['Green Component'])+to(vals['Blue Component'])}
    const r=ok(fallback,[map['Background Color'],map['Foreground Color'],...Array.from({length:16},(_,i)=>map[`Ansi ${i} Color`])]);if(r)return r}catch(e){}}
  // FORMAT: key/value themes: kitty, foot, Xresources, Ghostty, Alacritty (toml/yaml), WezTerm, base16.
  const kv={};let section='',name=null;
  for(const raw of t.split('\n')){const line=raw.replace(/\s+#(?![0-9a-f]{6}).*$/i,'');let m;
    if((m=line.match(/^\s*\[(?:colors\.)?([\w.]+)\]\s*$/i))){section=m[1].toLowerCase();continue}
    if((m=line.match(/^\s*(primary|normal|bright)\s*:\s*$/i))){section=m[1].toLowerCase();continue}
    if((m=line.match(/^\s*(?:scheme|name)\s*[:=]\s*["']?([^"'\n]+?)["']?\s*$/i))&&!name)name=m[1];
    if((m=line.match(/^\s*palette\s*=\s*(\d+)\s*=\s*(#?[0-9a-f]{6})/i))){kv['color'+m[1]]=hex(m[2]);continue}
    if((m=line.match(/^\s*(ansi|brights)\s*=\s*\[([^\]]*)\]/i))){const arr=(m[2].match(/#?[0-9a-f]{6}/gi)||[]).map(hex);arr.forEach((h,i)=>kv['color'+(i+(m[1].toLowerCase()==='brights'?8:0))]=h);continue}
    if((m=line.match(/^\s*(?:[*!]?[\w-]*[.*])?([\w-]+)(?:\s*[:=]\s*|\s+)["']?(#?(?:0x)?[0-9a-f]{6})\b/i))){
      const k=m[1].toLowerCase(),v=hex(m[2]);
      if((section==='normal'||section==='bright')&&N.concat(['magenta']).includes(k)){const idx=(k==='magenta'?5:N.indexOf(k))+(section==='bright'?8:0);kv['color'+idx]=v}
      else kv[k]=v}
  }
  for(let i=0;i<8;i++){if(kv['regular'+i])kv['color'+i]=kv['regular'+i];if(kv['bright'+i])kv['color'+(i+8)]=kv['bright'+i]} // FORMAT: foot
  if(kv.base00&&kv.base05){const b=k=>kv['base'+k];return ok(name,[b('00'),b('05'),b('00'),b('08'),b('0b'),b('0a'),b('0d'),b('0e'),b('0c'),b('05'),b('03'),b('08'),b('0b'),b('0a'),b('0d'),b('0e'),b('0c'),b('07')])}
  const bg=kv.background,fg=kv.foreground,ansi=Array.from({length:16},(_,i)=>kv['color'+i]);
  if(bg&&fg&&ansi.every(Boolean))return ok(name,[bg,fg,...ansi]);
  // FORMAT: fallback: 16 or 18 bare hex values in terminal order.
  const all=(t.match(/#[0-9a-f]{6}\b/gi)||[]).map(hex);
  if(all.length===16)return ok(name,[all[0],all[7],...all]);
  if(all.length>=18)return ok(name,all.slice(0,18));
  return null;
}
// SECTION: palette window
function fillPalSelect(){
  const sel=$('#palSel'),q=$('#palFilter').value.trim().toLowerCase();sel.replaceChildren();
  const add=(v,t,p)=>{const o=document.createElement('option');o.value=v;o.textContent=t;p.append(o)};
  add('','No palette',sel);
  if(state.palette&&state.palette.custom)add('custom:'+state.palette.name,state.palette.name+' (custom)',sel);
  const fe=document.createElement('optgroup');fe.label='Favorites';
  for(const n of FEATURED)if(SCHEMES.some(s=>s.n===n)&&(!q||n.toLowerCase().includes(q)))add(n,n,fe);
  if(fe.children.length)sel.append(fe);
  const all=document.createElement('optgroup');const list=SCHEMES.filter(s=>!q||s.n.toLowerCase().includes(q));all.label=`All schemes (${list.length})`;
  for(const s of list)add(s.n,s.n,all);if(list.length)sel.append(all);
  sel.value=state.palette?(state.palette.custom?'custom:'+state.palette.name:state.palette.name):'';
}
let palArmed=true;
function renderPalWin(){
  const grid=$('#palGrid');grid.replaceChildren();
  const c=state.palette?state.palette.c:['#ffffff','#000000',...COLORS];
  const order=[0,2,3,4,5,6,7,8,9,1,10,11,12,13,14,15,16,17];
  for(const i of order){
    const lab=document.createElement('label');lab.className='psw';lab.style.background=c[i];lab.title=`${PAL_ROLES[i]} ${c[i]}`;
    const inp=document.createElement('input');inp.type='color';inp.value=c[i];inp.setAttribute('aria-label',PAL_ROLES[i]);
    inp.addEventListener('focus',()=>{palArmed=true});
    inp.oninput=()=>{if(palArmed){pushUndo();palArmed=false}const base=state.palette||{name:'My palette',c:c.slice()};
      if(!state.palette||!state.palette.custom)state.palette={name:(base.name||'My palette')+' (edited)',c:base.c.slice(),custom:true};
      state.palette.c[i]=inp.value.toLowerCase();lab.style.background=inp.value;lab.title=`${PAL_ROLES[i]} ${inp.value}`;palChanged(false)};
    inp.onchange=()=>{fillPalSelect();$('#palTitle').textContent=`Palette · ${state.palette.name}`};
    const tag=document.createElement('b');tag.textContent=PAL_SHORT[i];lab.append(inp,tag);grid.append(lab);
  }
  grid.classList.toggle('off',!state.palette);
  $('#palRecolor').checked=palOpt.recolor;$('#palPage').checked=palOpt.page;$('#palPaint').checked=palOpt.paint;$('#palFlip').value=palOpt.flip;
  $('#palTitle').textContent=state.palette?`Palette · ${state.palette.name}`:'Palette';
  fillPalSelect();
}
$('#palSel').onchange=()=>{const v=$('#palSel').value;
  if(!v){setPalette(null);status('Palette off. Every style shows its own colors.');return}
  if(v.startsWith('custom:'))return;
  const e=SCHEMES.find(s=>s.n===v);if(e){setPalette(schemeFromEntry(e));status(`Palette: ${e.n}`)}};
const stepScheme=d=>{const sel=$('#palSel'),opts=[...sel.options].filter(o=>o.value&&!o.value.startsWith('custom:'));if(!opts.length)return;
  let i=opts.findIndex(o=>o.value===sel.value);i=i<0?(d>0?0:opts.length-1):(i+d+opts.length)%opts.length;sel.value=opts[i].value;sel.onchange()};
$('#palPrev').onclick=()=>{audio();sfx('click');stepScheme(-1)};$('#palNext').onclick=()=>{audio();sfx('click');stepScheme(1)};
$('#palFilter').addEventListener('input',fillPalSelect);
for(const [id,k] of [['palRecolor','recolor'],['palPage','page'],['palPaint','paint']])$('#'+id).onchange=e=>{pushUndo();palOpt[k]=e.target.checked;palChanged(true)};
$('#palFlip').onchange=e=>{pushUndo();palOpt.flip=e.target.value;palChanged(true)};
$('#palOff').onclick=()=>{audio();sfx('whoosh');setPalette(null);status('Palette off. Every style shows its own colors.')};
$('#palFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const sc=parseScheme(await f.text(),f.name.replace(/\.[^.]+$/,''));
  if(sc){setPalette({...sc,custom:true});status(`Palette: ${sc.name}`)}else status(`Couldn't find 18 colors in ${f.name}. Windows Terminal, iTerm2, kitty, Alacritty, Ghostty, WezTerm, Xresources and base16 files work.`)};
let schemesReady=Promise.resolve();
async function loadSchemes(){try{const j=JSON.parse(await fetchLib('schemes.json'));SCHEMES=j.schemes;$('#palFilter').placeholder=`Filter ${SCHEMES.length} schemes, e.g. gruvbox`;fillPalSelect()}catch(e){$('#palCredit').textContent='The scheme library could not load. Importing a scheme file still works.'}}


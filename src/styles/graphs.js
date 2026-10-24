// SECTION: style graphs
// FORMAT: a style graph wires effect nodes into one look node and compiles to a px-<slug> class in node-styles.css.
// INVARIANT: node-styles.css is regenerated from the graphs every time; projects store graphs, never the CSS.
const CSS_PORT=[['out','look','css']];
const FONTS=['inherit','Rubik Mono One','Fraunces','Neucha','Patrick Hand SC','Pixelify Sans','Press Start 2P','VT323','Georgia','Arial Black','system-ui','monospace'];
const MOTIONS={spin:'from{transform:rotate(0)}to{transform:rotate(360deg)}',pulse:'50%{transform:scale(1.12)}',float:'50%{transform:translateY(-12%)}',
  wobble:'25%{transform:rotate(-6deg)}75%{transform:rotate(6deg)}',blink:'50%{opacity:0}',shake:'25%{transform:translateX(-6%)}75%{transform:translateX(6%)}',
  bounce:'0%,100%{transform:translateY(0);animation-timing-function:cubic-bezier(.5,0,1,.5)}50%{transform:translateY(-25%);animation-timing-function:cubic-bezier(0,.5,.5,1)}',
  swing:'50%{transform:rotate(12deg)}',rainbow:'to{filter:hue-rotate(360deg)}',glowpulse:'50%{filter:brightness(1.4) drop-shadow(0 0 8px currentColor)}'};
const SHAPES={'as it is':'',rounded:'border-radius:18%',pill:'border-radius:999px',circle:'border-radius:50%',triangle:'clip-path:polygon(50% 0,100% 100%,0 100%)',
  diamond:'clip-path:polygon(50% 0,100% 50%,50% 100%,0 50%)',hexagon:'clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)',
  star:'clip-path:polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',blob:'border-radius:62% 38% 46% 54%/60% 44% 56% 40%',
  ticket:'clip-path:polygon(0 0,100% 0,100% 35%,94% 50%,100% 65%,100% 100%,0 100%,0 65%,6% 50%,0 35%)',arrow:'clip-path:polygon(0 30%,62% 30%,62% 0,100% 50%,62% 100%,62% 70%,0 70%)',
  slant:'clip-path:polygon(6% 0,100% 0,94% 100%,0 100%)',wavy:'border-radius:30% 70% 70% 30%/30% 30% 70% 70%'};
Object.assign(NT,{
  look:{t:'Style',cat:'Style',style:true,f:[['name','Name','text','my style']],ins:[['fill','fill','css'],['line','outline','css'],['shape','shape','css'],['shadow','shadow','css'],['fx','filter','css'],['text','type','css'],['move','transform','css'],['motion','motion','css']]},
  sFill:{t:'Fill',cat:'Color',style:true,f:[['c','Color','color','#ff2e88'],['on','Colors','select','both','both background text']],outs:CSS_PORT},
  sGrad:{t:'Gradient',cat:'Color',style:true,f:[['kind','','select','linear','linear radial conic'],['angle','Angle (°)','number',135],['a','From','color','#ffd23f'],['b','To','color','#ff2e88'],['c','Then','color',''],['clip','Fill the letters','check',false]],outs:CSS_PORT},
  sLine:{t:'Outline',cat:'Edges',style:true,f:[['w','Width (px)','number',3],['c','Color','color','#16121f'],['style','','select','solid','solid dashed dotted double'],['box','Border round the box too','check',true]],outs:CSS_PORT},
  sShape:{t:'Shape',cat:'Edges',style:true,f:[['shape','','select','rounded',Object.keys(SHAPES).join(' ').replace('as it is','as-is')],['r','Corner radius (px, rounded)','number',0],['ratio','Width ÷ height (0: as is)','number',0]],outs:CSS_PORT},
  sShadow:{t:'Shadow',cat:'Light',style:true,f:[['x','Right (px)','number',6],['y','Down (px)','number',6],['blur','Blur (px)','number',0],['spread','Spread (px)','number',0],['c','Color','color','#16121f'],['inset','Inside','check',false]],outs:CSS_PORT},
  sTShadow:{t:'Text shadow',cat:'Light',style:true,f:[['x','Right (px)','number',3],['y','Down (px)','number',3],['blur','Blur (px)','number',0],['c','Color','color','#2b2bd9']],outs:CSS_PORT},
  sGlow:{t:'Glow',cat:'Light',style:true,f:[['c','Color','color','#00ffcc'],['size','Size (px)','number',12]],outs:CSS_PORT},
  sFilter:{t:'Filter',cat:'Light',style:true,f:[['blur','Blur (px)','number',0],['bright','Brightness (%)','number',100],['contrast','Contrast (%)','number',100],['sat','Saturation (%)','number',100],['hue','Hue turn (°)','number',0],['gray','Grayscale (%)','number',0],['invert','Invert (%)','number',0],['sepia','Sepia (%)','number',0]],outs:CSS_PORT},
  sBlend:{t:'Blend',cat:'Light',style:true,f:[['mode','','select','normal','normal multiply screen overlay darken lighten color-dodge color-burn difference exclusion hue saturation color luminosity'],['op','Opacity (%)','number',100]],outs:CSS_PORT},
  sMove:{t:'Transform',cat:'Shape',style:true,f:[['rot','Turn (°)','number',0],['skx','Skew across (°)','number',0],['sky','Skew down (°)','number',0],['scale','Scale (%)','number',100]],outs:CSS_PORT},
  sType:{t:'Type',cat:'Type',style:true,f:[['font','Font','select','inherit',FONTS.map(f=>f.replace(/ /g,'_')).join(' ')],['size','Size (px; 0 keeps it)','number',0],['weight','Weight','select','keep','keep 300 400 600 700 900'],['italic','Italic','check',false],['track','Letter spacing (px)','number',0],['case','Case','select','keep','keep upper lower capitalize'],['lh','Line height (0 keeps it)','number',0]],outs:CSS_PORT},
  sMotion:{t:'Motion',cat:'Motion',style:true,f:[['m','','select','float',Object.keys(MOTIONS).join(' ')],['dur','Duration (ms)','number',1600],['times','Repeat','select','forever','forever once twice'],['ease','Easing','select','ease-in-out','ease ease-in ease-out ease-in-out linear']],outs:CSS_PORT},
  sMix:{t:'Combine',cat:'Combine',style:true,ins:[['a','','css'],['b','','css'],['c','','css']],outs:CSS_PORT},
  sCss:{t:'CSS',cat:'Combine',style:true,f:[['css','Declarations','code','outline:2px dashed currentColor;']],outs:CSS_PORT},
  sFx:{t:'From a stylesheet',cat:'Imported',style:true,hidden:true,f:[['from','From','text',''],['css','Declarations','code',''],['kf','Keyframes','code','']],outs:CSS_PORT},
});
// SAFETY: values reaching a stylesheet can't close their declaration or block, and url() can't fetch remote resources.
const cssVal=v=>String(v??'').replace(/[{}<>;@\\]/g,'').replace(/url\(\s*(['"]?)(?!data:|#)[^)]*\)/gi,'none').replace(/expression\s*\(/gi,'').trim().slice(0,2000);
const cssProp=p=>/^-{0,2}[a-z][a-z0-9-]{0,60}$/i.test(p=String(p).trim().toLowerCase())?p:null;
function parseDecls(text){
  const out=[];let depth=0,cur='';
  for(const ch of String(text||'')){if(ch==='(')depth++;else if(ch===')')depth=Math.max(0,depth-1);if(ch===';'&&!depth){out.push(cur);cur=''}else cur+=ch}
  out.push(cur);
  return out.map(d=>{const i=d.indexOf(':');if(i<0)return null;const p=cssProp(d.slice(0,i)),v=cssVal(d.slice(i+1).replace(/!important\s*$/i,''));return p&&v?[p,v]:null}).filter(Boolean);
}
// SAFETY: imported keyframes are rebuilt from parsed declarations under a generated name.
function cleanKeyframes(name,text){
  const body=String(text||'').replace(/^[^{]*\{/,'').replace(/\}\s*$/,'');const frames=[];const re=/([^{}]+)\{([^{}]*)\}/g;let m;
  while((m=re.exec(body))&&frames.length<40){const sel=m[1].trim();if(!/^((from|to|\d{1,3}(\.\d+)?%)\s*,?\s*)+$/i.test(sel))continue;frames.push(`${sel}{${parseDecls(m[2]).map(([p,v])=>`${p}:${v}`).join(';')}}`)}
  return frames.length?`@keyframes ${name}{${frames.join('')}}`:'';
}
const hexA=(c,a)=>{if(!okHex(c))return c;const [r,g,b]=hex2rgb(c);return`rgba(${r}, ${g}, ${b}, ${a})`};
function styleOf(n,g,seen=new Set()){
  if(!n||seen.has(n.id))return{d:[],k:[]};seen.add(n.id);
  const f=n.f,D=[],K=[],px=v=>`${Math.round(+v||0)}px`,add=(p,v)=>{if(v!==''&&v!=null)D.push([p,String(v)])};
  const from=port=>{const w=g.wires.find(w=>w.b===n.id&&w.bp===port);return w?styleOf(g.nodes.find(x=>x.id===w.a),g,seen):{d:[],k:[]}};
  switch(n.type){
    // RULE: fill applies to base primitives (face, paths, letters) and an ordinary element's background, or just one.
    case'sFill':if(okHex(f.c)){if(f.on==='background')add('background-color',f.c);else if(f.on==='text'){add('color',f.c);add('--fill',f.c)}else{add('--fill',f.c);add('background-color',f.c)}}break;
    case'sGrad':{const cs=[f.a,f.b,f.c].filter(okHex);if(cs.length<2)break;const a=Math.round(+f.angle||0);
      const img=f.kind==='radial'?`radial-gradient(circle, ${cs.join(', ')})`:f.kind==='conic'?`conic-gradient(from ${a}deg, ${cs.join(', ')}, ${cs[0]})`:`linear-gradient(${a}deg, ${cs.join(', ')})`;
      add('background-image',img);add('--fill-image',img);if(f.clip){add('-webkit-background-clip','text');add('background-clip','text');add('color','transparent');add('--fill','transparent')}break}
    case'sLine':if(okHex(f.c)){add('--stroke',f.c);add('--stroke-w',px(f.w));if(f.box)add('border',`${px(f.w)} ${f.style} ${f.c}`)}break;
    // RULE: shape clips an ordinary element's box; on a base shape it sets --clip/--round so shadows follow the outline.
    case'sShape':{const sh=SHAPES[f.shape==='as-is'?'as it is':f.shape]||'',ds=parseDecls(sh);if(f.shape==='rounded'&&+f.r>0)ds.splice(0,ds.length,['border-radius',px(f.r)]);
      for(const [p,v] of ds){add(p,v);add(p==='clip-path'?'--clip':'--round',v)}if(+f.ratio>0)add('aspect-ratio',String(Math.round(+f.ratio*1000)/1000));break}
    case'sShadow':if(okHex(f.c)){add('box-shadow',`${f.inset?'inset ':''}${px(f.x)} ${px(f.y)} ${px(f.blur)} ${px(f.spread)} ${f.c}`);if(!f.inset)add('--shadow',`${px(f.x)} ${px(f.y)} ${px(f.blur)} ${f.c}`)}break;
    case'sTShadow':if(okHex(f.c))add('text-shadow',`${px(f.x)} ${px(f.y)} ${px(f.blur)} ${f.c}`);break;
    case'sGlow':if(okHex(f.c)){add('box-shadow',`0 0 ${px(f.size)} ${hexA(f.c,.85)}`);add('text-shadow',`0 0 ${px(Math.max(2,f.size/2))} ${f.c}`);add('--glow',`0 0 ${px(f.size)} ${f.c}`)}break;
    case'sFilter':{const p=[];if(+f.blur)p.push(`blur(${px(f.blur)})`);for(const [k,fn,d,u] of [['bright','brightness',100,'%'],['contrast','contrast',100,'%'],['sat','saturate',100,'%'],['hue','hue-rotate',0,'deg'],['gray','grayscale',0,'%'],['invert','invert',0,'%'],['sepia','sepia',0,'%']])if(+f[k]!==d)p.push(`${fn}(${Math.round(+f[k]||0)}${u})`);if(p.length){add('filter',p.join(' '));add('--filter',p.join(' '))}break}
    case'sBlend':if(f.mode!=='normal')add('mix-blend-mode',f.mode);if(+f.op!==100)add('opacity',String(Math.max(0,Math.min(100,+f.op||0))/100));break;
    case'sMove':{const p=[];if(+f.rot)p.push(`rotate(${+f.rot}deg)`);if(+f.skx||+f.sky)p.push(`skew(${+f.skx||0}deg, ${+f.sky||0}deg)`);if(+f.scale!==100)p.push(`scale(${(+f.scale||100)/100})`);if(p.length)add('transform',p.join(' '));break}
    case'sType':{if(f.font!=='inherit'){const fam=f.font.replace(/_/g,' ');add('font-family',/^(system-ui|monospace|Georgia|Arial Black)$/.test(fam)?(fam.includes(' ')?`"${fam}"`:fam):`"${fam}", system-ui, sans-serif`)}
      if(+f.size>0)add('font-size',px(f.size));if(f.weight!=='keep')add('font-weight',f.weight);if(f.italic)add('font-style','italic');if(+f.track)add('letter-spacing',px(f.track));
      if(f.case!=='keep')add('text-transform',f.case==='upper'?'uppercase':f.case==='lower'?'lowercase':'capitalize');if(+f.lh>0)add('line-height',String(+f.lh));break}
    case'sMotion':{if(!MOTIONS[f.m])break;const name='px-'+f.m;add('animation',`${name} ${Math.max(50,+f.dur||1000)}ms ${f.ease} ${f.times==='forever'?'infinite':f.times==='twice'?2:1}${f.m==='blink'?' steps(1)':''}`);K.push(`@keyframes ${name}{${MOTIONS[f.m]}}`);break}
    case'sMix':for(const p of ['a','b','c']){const r=from(p);D.push(...r.d);K.push(...r.k)}break;
    case'sCss':D.push(...parseDecls(f.css));break;
    case'sFx':{D.push(...parseDecls(f.css));const an=D.find(([p])=>p==='animation'||p==='animation-name');if(an&&f.kf){const nm=(f.kf.match(/@keyframes\s+([\w-]+)/)||[])[1];const k=nm&&cleanKeyframes(nm,f.kf);if(k)K.push(k)}break}
  }
  return{d:D,k:K};
}
// INVARIANT: list-valued properties (shadows, backgrounds, filters, transforms) stack across nodes; others: last wins.
const LIST_PROPS=new Set(['box-shadow','text-shadow','background-image','animation']),SPACE_PROPS=new Set(['filter','backdrop-filter','transform','--filter']);
function compileStyle(g,cls){
  const look=g.nodes.find(n=>n.type==='look');if(!look)return'';
  const all=[],kfs=[],seen=new Set();
  for(const [port] of NT.look.ins){const w=g.wires.find(w=>w.b===look.id&&w.bp===port);if(!w)continue;const r=styleOf(g.nodes.find(x=>x.id===w.a),g,seen);all.push(...r.d);kfs.push(...r.k)}
  const m=new Map();for(const [p,v] of all){if(m.has(p)&&LIST_PROPS.has(p))m.set(p,m.get(p)+', '+v);else if(m.has(p)&&SPACE_PROPS.has(p))m.set(p,m.get(p)+' '+v);else m.set(p,v)}
  if(!m.size&&!kfs.length)return`/* ${cls}: nothing wired in yet */`;
  return`.${cls}.${cls}.${cls}{${[...m].map(([p,v])=>`${p}:${v}`).join(';')}}${[...new Set(kfs)].map(k=>'\n'+k).join('')}`;
}
const styleName=g=>{const l=g.nodes.find(n=>n.type==='look');return l?String(l.f.name||'style'):'style'};
function styleClasses(){const used=new Set(),out=new Map();for(const s of state.styleGraphs){let c='px-'+(slug(styleName(s.g))||'style'),k=2;while(used.has(c))c=`px-${slug(styleName(s.g))||'style'}-${k++}`;used.add(c);out.set(s.id,c)}return out}
let nodeSheetT=0;
function syncNodeSheet(now){
  if(!now){clearTimeout(nodeSheetT);nodeSheetT=setTimeout(()=>syncNodeSheet(true),120);return}
  const cls=styleClasses();
  // INVARIANT: a renamed style carries its elements to the new class.
  for(const s of state.styleGraphs){const c=cls.get(s.id);if(s.cls&&s.cls!==c)for(const el of state.els)if(el.extra&&el.extra.split(/\s+/).includes(s.cls))el.extra=el.extra.split(/\s+/).map(x=>x===s.cls?c:x).join(' ');s.cls=c}
  const text=`/* node-styles.css: made by PIXIWYG from this project's style graphs. Edit the graphs, not this. */\n`+state.styleGraphs.map(s=>compileStyle(s.g,cls.get(s.id))).join('\n');
  let f=state.files.find(x=>x.gen);
  if(!state.styleGraphs.length){if(f){state.files=state.files.filter(x=>x!==f);renderAll();renderFiles()}return}
  if(!f){f={id:nid('f'),name:'node-styles.css',text:'',gen:true,enabled:true};state.files.push(f)}
  if(f.text!==text){f.text=text;compileFile(f);renderAll();brushStylesChanged();if(!$('#nodeModal').hidden&&ned.mode==='style')stylePreview()}
}
const nodeSheet=()=>{const f=state.files.find(x=>x.gen&&x.enabled);return f&&f.sheet};
function newStyleGraph(name){
  const id=nid('y'),g={nodes:[{id:'n1',type:'look',x:420,y:60,f:{...nodeDefaults('look'),name:name||`style ${state.styleGraphs.length+1}`}},{id:'n2',type:'sFill',x:40,y:20,f:nodeDefaults('sFill')},{id:'n3',type:'sShadow',x:40,y:200,f:nodeDefaults('sShadow')}],
    wires:[{a:'n2',ap:'out',b:'n1',bp:'fill'},{a:'n3',ap:'out',b:'n1',bp:'shadow'}]};
  const s={id,g};state.styleGraphs.push(s);return s;
}
// SECTION: imported effects (effects found in the project's stylesheets, offered as nodes)
const FX_KINDS=[['box-shadow','Shadows'],['text-shadow','Text shadows'],['background-image','Gradients'],['background','Gradients'],['filter','Filters'],['backdrop-filter','Filters'],
  ['clip-path','Shapes'],['border-radius','Shapes'],['-webkit-text-stroke','Outlines'],['transform','Transforms'],['mix-blend-mode','Blends'],['animation','Motion']];
let fxCache={key:'',list:[]};
function fxLibrary(){
  const files=state.files.filter(f=>f.enabled&&!f.gen&&f.sheet),key=files.map(f=>f.id+':'+f.text.length).join('|');if(fxCache.key===key)return fxCache.list;
  const list=[],seen=new Set();
  for(const f of files){
    const vars={},kfs={};
    const walk=(rules,fn)=>{for(const r of rules){if(r.style)fn(r);if(r instanceof CSSKeyframesRule)kfs[r.name]=r.cssText;else if(r.cssRules)walk(r.cssRules,fn)}};
    try{walk(f.sheet.cssRules,r=>{for(let i=0;i<r.style.length;i++)if(r.style[i].startsWith('--'))vars[r.style[i]]=r.style.getPropertyValue(r.style[i]).trim()})}catch(e){continue}
    const res=(v,d=0)=>d>5?v:v.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/g,(m,n,fb)=>vars[n]!=null?res(vars[n],d+1):(fb||'').trim());
    walk(f.sheet.cssRules,r=>{
      for(const [p,kind] of FX_KINDS){let v=r.style.getPropertyValue(p);if(!v)continue;v=res(v.trim());
        if(!v||/^(none|0|0px|initial|inherit|unset|normal|auto)$/i.test(v))continue;
        if((p==='background'||p==='background-image')&&!/gradient\(/i.test(v))continue;
        if(p==='background')v=(v.match(/(?:repeating-)?(?:linear|radial|conic)-gradient\((?:[^()]|\([^()]*\))*\)/gi)||[]).join(', ');
        if(p==='border-radius'&&!/%|\//.test(v))continue;
        if(p==='transform'&&/^translate/i.test(v))continue;
        let kf='';if(p==='animation'){const nm=Object.keys(kfs).find(k=>new RegExp(`(^|\\s)${k.replace(/[-\\]/g,'\\$&')}(\\s|,|$)`).test(v));if(!nm)continue;kf=kfs[nm]}
        const prop=p==='background'?'background-image':p,k=prop+':'+v.replace(/\s+/g,' ');if(seen.has(k)||list.length>500)continue;seen.add(k);
        list.push({kind,prop,value:cssVal(v),from:`${showSel(r.selectorText).slice(0,60)} · ${f.name}`,kf});
      }
    });
  }
  fxCache={key,list};return list;
}
function fxSwatch(fx){
  const b=mkEl('i',{className:'fxsw'});const t=/text|Outlines/.test(fx.kind);if(t)b.textContent='Aa';
  try{b.style.setProperty(fx.prop,fx.value.replace(/var\([^)]*\)/g,'#888'))}catch(e){}
  if(fx.prop==='animation')b.style.animationDuration='1.6s';return b;
}
// SECTION: style preview
let baseSheet=null;
async function stylePreview(){
  const box=$('#nodePrevBox'),s=state.styleGraphs.find(x=>x.id===ned.styleId);if(!s||ned.mode!=='style')return;
  if(!baseSheet){baseSheet=new CSSStyleSheet();try{baseSheet.replaceSync(await fetchLib('base.css'))}catch(e){}}
  const cls=styleClasses().get(s.id),host=box.querySelector('.stylehost')||box.appendChild(mkEl('div',{className:'stylehost'}));
  const root=host.shadowRoot||host.attachShadow({mode:'open'}),ns=nodeSheet();
  root.adoptedStyleSheets=[baseSheet,...(ns?[ns]:[]),RESET];
  root.innerHTML=`<div style="display:grid;gap:18px;justify-items:center;padding:12px;font:16px/1.35 Georgia,serif;color:#16121f">
    <span class="text display ${cls}" style="font-size:44px">Aa</span>
    <div style="width:110px"><div class="shape rounded ${cls}"></div></div>
    <div style="width:110px"><div class="vector ${cls}"><svg viewBox="0 0 100 100"><path d="M50 4l13 30 33 3-25 22 8 33-29-18-29 18 8-33L4 37l33-3z"/></svg></div></div>
    <button class="${cls}" style="font:inherit;padding:6px 16px">A button</button></div>`;
  $('#nodePrevNote').textContent=`.${cls} · on text, a shape, a vector and a plain button. Add it to anything from the Inspector’s Effects.`;nodeLayerPreview();
}
// FORMAT: layer: true when opened from Paint's Layers, so the preview shows the active layer wearing the style.
function openStyleEditor(id,{layer}={}){
  ned.layerPreview=!!layer;
  let s=state.styleGraphs.find(x=>x.id===id)||state.styleGraphs[0];
  if(!s){pushUndo();s=newStyleGraph();syncNodeSheet(true);save()}
  ned.styleId=s.id;
  openNodeEditor({title:'Style',graph:s.g,mode:'style',onChange:g=>{s.g=g;syncNodeSheet();save();styleSync()}});
  styleSync();stylePreview();
}
function styleSync(){
  const sel=$('#nodeStyleSel');sel.replaceChildren();for(const s of state.styleGraphs)sel.append(mkEl('option',{value:s.id,textContent:styleName(s.g)}));sel.value=ned.styleId||'';
  const s=state.styleGraphs.find(x=>x.id===ned.styleId);$('#nodeTitle').textContent=s?`Style · ${styleName(s.g)} (.${styleClasses().get(s.id)})`:'Style';
}
$('#nodeStyleSel').onchange=e=>{audio();const layer=ned.layerPreview;closeNodeEditor();openStyleEditor(e.target.value,{layer})};
$('#nodeStyleNew').onclick=()=>{audio();pushUndo();const s=newStyleGraph();syncNodeSheet(true);save();closeNodeEditor();openStyleEditor(s.id)};
$('#nodeStyleApply').onclick=()=>{const el=selected(),cls=styleClasses().get(ned.styleId);if(!el||!cls){status('Select something on the page first.');return}toggleStyleOn(el,cls,true);status(`.${cls} is on the selected <${el.tag}>.`)};
$('#nodeStyleDel').onclick=async()=>{const s=state.styleGraphs.find(x=>x.id===ned.styleId);if(!s)return;
  if(await ask(`Remove “${styleName(s.g)}”?`,'Elements wearing it go back to how they looked without it.',[{id:'del',label:'Remove it',primary:true},{id:null,label:'Cancel'}])!=='del')return;
  pushUndo();const c=styleClasses().get(s.id);for(const el of state.els)if(el.extra)el.extra=el.extra.split(/\s+/).filter(x=>x!==c).join(' ');state.styleGraphs=state.styleGraphs.filter(x=>x!==s);syncNodeSheet(true);save();closeNodeEditor();if(state.styleGraphs.length)openStyleEditor()};
function toggleStyleOn(el,cls,on){
  pushUndo();const list=(el.extra||'').split(/\s+/).filter(Boolean).filter(x=>x!==cls);if(on)list.push(cls);el.extra=list.join(' ');renderEl(el);updateSel();renderInspector();save();
}
$('#stylesBtn').onclick=()=>{audio();sfx('blip');openStyleEditor()};


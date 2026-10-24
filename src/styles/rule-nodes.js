// SECTION: open an imported rule as nodes
// RULE: any element's stylesheet rule can be edited as a node graph without touching the sheet: its declarations are
//   read into nodes where one fits (fill, gradient, outline, shape, shadows, filter, transform, type, blend, motion)
//   and into a CSS node where none does, wired into a new style that the element wears on top of the rule. The
//   compiled class outranks the rule (.px.px.px), so it starts out looking identical; editing a node changes that one
//   thing; deleting a node lets the stylesheet's own value show again; removing the style goes back entirely.
// INVARIANT: the imported sheet is never written: library copies stay pinned and the user's own sheets round-trip.
// RULE: only the base rule is read; :hover/:focus variants and media-query versions stay in the stylesheet.
let rnProbe=null;
const RN_BG=['background-color','background-image','background-position','background-size','background-repeat','background-attachment','background-origin','background-clip','background-blend-mode'];
// FORMAT: a colour as #rrggbb, or #rrggbbaa when translucent (colour fields keep 8-digit hex); else null.
function rnHex(v){
  v=String(v||'').trim();if(!v||/var\(|gradient|url\(|currentcolor|inherit|initial|transparent/i.test(v))return null;
  if(!rnProbe){rnProbe=mkEl('i',{className:'wrprobe'});document.body.append(rnProbe)}
  rnProbe.style.color='';rnProbe.style.color=v;if(!rnProbe.style.color)return null;
  const m=getComputedStyle(rnProbe).color.match(/[\d.]+/g);if(!m)return null;const a=m[3]!=null?+m[3]:1;if(a<=0)return null;
  return'#'+m.slice(0,3).map(x=>(+x|0).toString(16).padStart(2,'0')).join('')+(a<1?Math.round(a*255).toString(16).padStart(2,'0'):'');
}
// FORMAT: a shorthand's longhands. The browser won't expand a shorthand that held var(), so the resolved value is
//   expanded here on a scratch element.
function rnExpand(prop,v,keys){rnHex('#000');rnProbe.style.cssText='';rnProbe.style.setProperty(prop,v);const m=new Map();for(const k of keys){const x=rnProbe.style.getPropertyValue(k);if(x)m.set(k,x)}rnProbe.style.cssText='';return m}
const rnPx=v=>{v=String(v).trim();if(v==='0')return 0;const m=/^(-?[\d.]+)px$/.exec(v);return m?+m[1]:null};
// FORMAT: splits on a separator outside parentheses (shadow lists, gradient stops, shorthand tokens).
function rnSplit(v,sep){const out=[];let d=0,cur='';for(const ch of String(v)){if(ch==='(')d++;else if(ch===')')d--;if(ch===sep&&!d){out.push(cur.trim());cur=''}else cur+=ch}if(cur.trim())out.push(cur.trim());return out}
function rnShadow(v,text){
  const t=rnSplit(v,' '),inset=t.includes('inset'),rest=t.filter(x=>x!=='inset'),lens=[],cols=[];
  for(const x of rest){const p=rnPx(x);if(p!=null)lens.push(p);else cols.push(x)}
  const c=cols.length===1?rnHex(cols[0]):'#000000';if(!c||lens.length<2||lens.length>(text?3:4)||(text&&inset))return null;
  return{x:lens[0],y:lens[1],blur:lens[2]||0,spread:lens[3]||0,c,inset};
}
function rnGradient(v){
  const m=/^(linear|radial)-gradient\((.*)\)$/i.exec(String(v).trim());if(!m)return null;
  let parts=rnSplit(m[2],','),angle=180,kind=m[1].toLowerCase();
  if(kind==='linear'){const a=/^(-?[\d.]+)deg$/.exec(parts[0]);if(a){angle=+a[1];parts=parts.slice(1)}else if(/^to\s/.test(parts[0]))return null}
  else{if(parts[0]==='circle')parts=parts.slice(1);else if(!rnHex(parts[0]))return null}
  const cs=parts.map(rnHex);if(cs.length<2||cs.length>3||cs.some(c=>!c))return null;
  return{kind,angle,a:cs[0],b:cs[1],c:cs[2]||''};
}
function rnFilter(v){
  const f={blur:0,bright:100,contrast:100,sat:100,hue:0,gray:0,invert:0,sepia:0},K={brightness:'bright',contrast:'contrast',saturate:'sat',grayscale:'gray',invert:'invert',sepia:'sepia'};
  // RULE: the Filter node writes its functions in one order; a filter written in another stays as CSS.
  const ORDER=['blur','brightness','contrast','saturate','hue-rotate','grayscale','invert','sepia'];let last=-1;
  for(const fn of rnSplit(v,' ')){const m=/^([a-z-]+)\(([^)]*)\)$/.exec(fn);if(!m)return null;const [,n,a]=m;const oi=ORDER.indexOf(n);if(oi<=last)return null;last=oi;
    if(n==='blur'){const p=rnPx(a);if(p==null)return null;f.blur=p}else if(n==='hue-rotate'){const d=/^(-?[\d.]+)deg$/.exec(a);if(!d)return null;f.hue=+d[1]}
    else if(K[n]){const pc=/%$/.test(a)?parseFloat(a):parseFloat(a)*100;if(!isFinite(pc))return null;f[K[n]]=Math.round(pc)}else return null}
  return f;
}
// RULE: Transform composes rotate, then skew, then scale; a rule in another order (or with translate) stays as CSS.
function rnTransform(v){
  const f={rot:0,skx:0,sky:0,scale:100},order=['rotate','skew','scale'];let last=-1;
  for(const fn of rnSplit(v,' ')){const m=/^(rotate|skew|scale)\(([^)]*)\)$/.exec(fn);if(!m)return null;const i=order.indexOf(m[1]);if(i<=last)return null;last=i;
    if(m[1]==='rotate'){const d=/^(-?[\d.]+)deg$/.exec(m[2]);if(!d)return null;f.rot=+d[1]}
    else if(m[1]==='skew'){const [a,b='0deg']=m[2].split(',').map(s=>s.trim());const x=/^(-?[\d.]+)deg$/.exec(a),y=/^(-?[\d.]+)(deg)?$/.exec(b);if(!x||!y)return null;f.skx=+x[1];f.sky=+y[1]}
    else{if(m[2].includes(','))return null;f.scale=Math.round(parseFloat(m[2])*100);if(!isFinite(f.scale))return null}}
  return f;
}
// FORMAT: the matching base rules of a sheet, merged in order (later wins), with var() resolved from the sheet.
function rnDecls(f,sel){
  const vars={},rules=[];let states=0;const norm=s=>s.replace(/\s+/g,' ').trim();
  const walk=rs=>{for(const r of rs){if(r instanceof CSSStyleRule){for(let i=0;i<r.style.length;i++)if(r.style[i].startsWith('--'))vars[r.style[i]]=r.style.getPropertyValue(r.style[i]).trim();
      const parts=r.selectorText.split(',').map(norm);if(parts.includes(norm(sel)))rules.push(r);else if(parts.some(p=>p.startsWith(norm(sel)+':')))states++}
    else if(r instanceof CSSSupportsRule||(typeof CSSLayerBlockRule!=='undefined'&&r instanceof CSSLayerBlockRule))walk(r.cssRules)}};
  try{walk(f.sheet.cssRules)}catch(e){return null}
  const res=(v,d=0)=>d>6?v:v.replace(/var\(\s*(--[\w-]+)\s*(?:,([^()]*))?\)/g,(m,n,fb)=>vars[n]!=null?res(vars[n],d+1):(fb||'').trim());
  const out=new Map(),long=new Map();
  for(const r of rules){for(const [p,v] of parseDecls(r.style.cssText))if(!p.startsWith('--')){out.delete(p);out.set(p,res(v))}
    for(const p of ['font-family','font-size','font-weight','font-style','line-height',...RN_BG])if(r.style.getPropertyValue(p))long.set(p,res(r.style.getPropertyValue(p)))}
  return{decls:out,long,states,count:rules.length};
}
// SECTION: build the graph
function rnGraph(sel,decls,long){
  let id=0;const nodes=[],wires=[],ports={fill:[],line:[],shape:[],shadow:[],fx:[],text:[],move:[],motion:[]},left=[];
  const node=(type,f)=>{const n={id:'n'+(++id),type,x:40,y:0,f:{...nodeDefaults(type),...f}};nodes.push(n);return n};
  const typeF={};let typed=false;
  const fonts=FONTS.map(x=>x.toLowerCase()),wOpts=(NT.sType.f.find(x=>x[0]==='weight')||[])[4]?.split(' ')||[],caseOpts=(NT.sType.f.find(x=>x[0]==='case')||[])[4]?.split(' ')||[];
  const font=(p,v)=>{
    if(p==='font-family'){const fam=rnSplit(v,',')[0].replace(/^["']|["']$/g,'');const i=fonts.indexOf(fam.toLowerCase());if(i<0)return false;typeF.font=FONTS[i].replace(/ /g,'_');return true}
    if(p==='font-size'){const x=rnPx(v);if(x==null)return false;typeF.size=x;return true}
    if(p==='font-weight'){const w=v==='bold'?'700':v==='normal'?'400':v;if(!wOpts.includes(w))return false;typeF.weight=w;return true}
    if(p==='font-style'){if(v==='italic'){typeF.italic=true;return true}return v==='normal'}
    if(p==='letter-spacing'){const x=rnPx(v);if(x==null)return false;typeF.track=x;return true}
    if(p==='text-transform'){const c={uppercase:'upper',lowercase:'lower',capitalize:'capitalize'}[v];if(!c||!caseOpts.includes(c))return false;typeF.case=c;return true}
    if(p==='line-height'){if(!/^[\d.]+$/.test(v))return false;typeF.lh=+v;return true}
    return false};
  for(const [p,v] of decls){let ok=false;
    if(p==='background-color'||(p==='background'&&rnHex(v))){const c=rnHex(v);if(c){ports.fill.push(node('sFill',{c,on:'background'}));ok=true}}
    else if(p==='color'){const c=rnHex(v);if(c){ports.fill.push(node('sFill',{c,on:'text'}));ok=true}}
    else if(p==='background-image'||p==='background'){const g=rnGradient(v);if(g){ports.fill.push(node('sGrad',g));ok=true}
      // RULE: a background with an image: its colour becomes a Fill node, and only the image parts stay as CSS, so
      //   the shorthand can't quietly reset the colour the node sets.
      else if(p==='background'&&(long.has('background-image')||(long=new Map([...long,...rnExpand('background',v,RN_BG)])).has('background-image'))){const c=rnHex(long.get('background-color'));if(c)ports.fill.push(node('sFill',{c,on:'background'}));
        for(const k of RN_BG.slice(1)){const lv=long.get(k);if(lv&&!/^(initial|normal|auto|0% 0%|repeat|scroll|padding-box|border-box|none)$/.test(lv))left.push([k,lv])}ok=true}}
    else if(p==='border'){const t=rnSplit(v,' '),w=t.map(rnPx).find(x=>x!=null),st=t.find(x=>/^(solid|dashed|dotted|double)$/.test(x)),c=t.map(rnHex).find(Boolean);if(w!=null&&st&&c&&t.length===3){ports.line.push(node('sLine',{w,c,style:st,box:true}));ok=true}}
    else if(p==='border-radius'){const r=rnPx(v);if(r!=null){ports.shape.push(node('sShape',{shape:'rounded',r}));ok=true}}
    else if(p==='clip-path'){const k=Object.entries(SHAPES).find(([,s])=>s.replace('clip-path:','')===v.replace(/\s*,\s*/g,','));if(k){ports.shape.push(node('sShape',{shape:k[0]==='as it is'?'as-is':k[0]}));ok=true}}
    else if(p==='box-shadow'||p==='text-shadow'){const list=rnSplit(v,',').map(s=>rnShadow(s,p==='text-shadow'));if(list.length&&list.every(Boolean)){for(const s of list)ports.shadow.push(node(p==='box-shadow'?'sShadow':'sTShadow',s));ok=true}}
    else if(p==='filter'){const f=rnFilter(v);if(f){ports.fx.push(node('sFilter',f));ok=true}}
    else if(p==='transform'){const f=rnTransform(v);if(f){ports.move.push(node('sMove',f));ok=true}}
    else if(p==='mix-blend-mode'||p==='opacity'){const b=ports.fx.find(n=>n.type==='sBlend')||(ports.fx.push(node('sBlend',{})),ports.fx[ports.fx.length-1]);if(p==='opacity'&&/^[\d.]+$/.test(v)){b.f.op=Math.round(+v*100);ok=true}else if(p==='mix-blend-mode'&&(NT.sBlend.f[0][4]||'').split(' ').includes(v)){b.f.mode=v;ok=true}}
    else if(p==='font'){const FK=['font-family','font-size','font-weight','font-style','line-height'];if(!FK.some(k=>long.has(k)))long=new Map([...long,...rnExpand('font',v,FK)]);const ks=FK.filter(k=>long.has(k));if(ks.length&&ks.every(k=>font(k,long.get(k)))){typed=true;ok=true}}
    else if(['font-family','font-size','font-weight','font-style','letter-spacing','text-transform','line-height'].includes(p)){if(font(p,v)){typed=true;ok=true}}
    else if(p==='animation'){ports.motion.push(node('sFx',{from:sel,css:`animation:${v}`,kf:''}));ok=true}
    if(!ok)left.push([p,v]);
  }
  if(typed)ports.text.push(node('sType',typeF));
  // RULE: whatever has no node keeps working: it goes, unchanged, into CSS nodes (one per 3,500 characters).
  let chunk='';const flush=()=>{if(chunk){ports.fx.push(node('sCss',{css:chunk}));chunk=''}};
  for(const [p,v] of left){const d=`${p}:${v};`;if(chunk.length+d.length>3500)flush();chunk+=d}flush();
  const look={id:'n'+(++id),type:'look',x:520,y:40,f:{...nodeDefaults('look'),name:`${sel} · nodes`}};nodes.push(look);
  // FORMAT: one wire per look port; more than one node on a port goes through Combine nodes (three inputs each).
  let y=20,mixY=20;
  // FORMAT: a node's height, estimated from its fields (code fields are tall), so they stack without overlap.
  const tall=n=>60+(NT[n.type].f||[]).reduce((h,[,,k])=>h+(k==='code'?230:k==='check'?24:38),0);
  for(const [port,list] of Object.entries(ports)){if(!list.length)continue;
    for(const n of list){n.y=y;y+=tall(n)+24}
    let level=list;while(level.length>1){const next=[];for(let i=0;i<level.length;i+=3){const grp=level.slice(i,i+3);if(grp.length===1){next.push(grp[0]);continue}
        const m=node('sMix',{});m.x=290;m.y=mixY;mixY+=120;grp.forEach((g,k)=>wires.push({a:g.id,ap:'out',b:m.id,bp:'abc'[k]}));next.push(m)}level=next}
    wires.push({a:level[0].id,ap:'out',b:look.id,bp:port})}
  look.y=Math.max(40,Math.round(y/2)-100);
  return{nodes,wires};
}
function openRuleAsNodes(el){
  el=el||selected();if(!el){status('Select something on the page first.');return null}
  const f=fileById(el.fileId);if(!f||f.gen||!el.selector){status('This element has no stylesheet rule to open. Pick a style for it first, or make a new node style.');return null}
  // RULE: a rule already opened as nodes on this element reopens; it isn't converted twice.
  const name=`${el.selector} · nodes`,cls=styleClasses(),have=(el.extra||'').split(/\s+/);
  const prev=state.styleGraphs.find(s=>styleName(s.g)===name&&have.includes(cls.get(s.id)));if(prev){openStyleEditor(prev.id);return prev}
  const r=rnDecls(f,el.selector);if(!r||!r.count){status(`No rule for ${showSel(el.selector)} found in ${f.name}.`);return null}
  pushUndo();const s={id:nid('y'),g:rnGraph(el.selector,r.decls,r.long)};state.styleGraphs.push(s);syncNodeSheet(true);
  const c=styleClasses().get(s.id);el.extra=[...have.filter(Boolean),c].join(' ');renderEl(el);updateSel();renderInspector();save();
  openStyleEditor(s.id);
  const css=s.g.nodes.filter(n=>n.type==='sCss').length,real=s.g.nodes.filter(n=>!['look','sMix','sCss'].includes(n.type)).length;
  status(`${showSel(el.selector)} from ${f.name} as nodes: ${real} node${real===1?'':'s'}${css?`, the rest in ${css===1?'a CSS node':css+' CSS nodes'}`:''}. It layers over the stylesheet, which stays as it was${r.states?`; its ${r.states} state variant${r.states===1?'':'s'} (like :hover) stay there too`:''}.`);
  return s;
}


// SECTION: page background
// FORMAT: color = {c:'#hex', role:N|null, none:bool}; a role follows the page palette.
const PAT_KINDS=[['dots','Dots'],['grid','Grid'],['stripes','Stripes'],['diagonal','Diagonal stripes'],['checker','Checkerboard'],['crosshatch','Crosshatch'],['scanlines','Scanlines'],['zigzag','Zigzag']];
const POSITIONS=[['left top','Top left'],['center top','Top'],['right top','Top right'],['left center','Left'],['center','Center'],['right center','Right'],['left bottom','Bottom left'],['center bottom','Bottom'],['right bottom','Bottom right']];
const FITS=[['cover','Cover the page'],['contain','Fit inside'],['tile','Tile'],['once','Once, actual size'],['stretch','Stretch to the page']];
const LAYER_NAMES={image:'Image',linear:'Linear gradient',radial:'Radial gradient',pattern:'Pattern'};
const colorOf=v=>{if(!v||v.none)return'transparent';if(v.role!=null&&state.palette)return state.palette.c[v.role];return v.c||'transparent'};
const safeUrl=u=>String(u).replace(/["<>\\\s]/g,c=>encodeURIComponent(c));
function layerCSS(L){
  const A=colorOf(L.a),B=colorOf(L.b),s=Math.max(2,+L.size||20),t=Math.max(1,Math.min(s,+L.thick||2)),one=(i,sz='auto')=>[{i,s:sz,p:'0 0',r:'repeat'}];
  switch(L.type){
    case 'image':{if(!L.src)return[];const k=(+L.scale||100)/100,w=Math.round((L.w||200)*k),h=Math.round((L.h||200)*k);
      const m={cover:['cover','no-repeat'],contain:['contain','no-repeat'],tile:[`${w}px ${h}px`,'repeat'],once:[`${w}px ${h}px`,'no-repeat'],stretch:['100% 100%','no-repeat']}[L.fit]||['cover','no-repeat'];
      return[{i:`url("${safeUrl(L.src)}")`,s:m[0],p:L.fit==='stretch'?'0 0':(L.pos||'center'),r:m[1]}]}
    case 'linear':case 'radial':{const st=L.mid?`${A}, ${colorOf(L.c)}, ${B}`:`${A}, ${B}`;
      return[{i:L.type==='linear'?`linear-gradient(${+L.angle||0}deg, ${st})`:`radial-gradient(${L.shape==='ellipse'?'ellipse':'circle'} at ${L.pos||'center'}, ${st})`,s:'100% 100%',p:'0 0',r:'no-repeat'}]}
    case 'pattern':{const k=L.kind||'dots';
      if(k==='dots')return one(`radial-gradient(circle, ${A} ${t}px, ${B} ${t+.6}px)`,`${s}px ${s}px`);
      if(k==='grid')return[...one(`linear-gradient(${A} ${t}px, transparent ${t}px)`,`${s}px ${s}px`),...one(`linear-gradient(90deg, ${A} ${t}px, ${B} ${t}px)`,`${s}px ${s}px`)];
      if(k==='stripes')return one(`repeating-linear-gradient(${+L.angle||0}deg, ${A} 0 ${t}px, ${B} ${t}px ${s}px)`);
      if(k==='diagonal')return one(`repeating-linear-gradient(45deg, ${A} 0 ${t}px, ${B} ${t}px ${s}px)`);
      if(k==='scanlines')return one(`repeating-linear-gradient(0deg, ${A} 0 ${t}px, ${B} ${t}px ${s}px)`);
      if(k==='checker')return one(`conic-gradient(${A} 25%, ${B} 0 50%, ${A} 0 75%, ${B} 0)`,`${s*2}px ${s*2}px`);
      if(k==='crosshatch')return[...one(`repeating-linear-gradient(45deg, ${A} 0 ${t}px, transparent ${t}px ${s}px)`),...one(`repeating-linear-gradient(-45deg, ${A} 0 ${t}px, ${B} ${t}px ${s}px)`)];
      if(k==='zigzag'){const h=s/2,z=`${s}px ${s}px`;return[{i:`linear-gradient(135deg, ${A} 25%, transparent 25%)`,s:z,p:`-${h}px 0`,r:'repeat'},{i:`linear-gradient(225deg, ${A} 25%, transparent 25%)`,s:z,p:`-${h}px 0`,r:'repeat'},{i:`linear-gradient(315deg, ${A} 25%, transparent 25%)`,s:z,p:'0 0',r:'repeat'},{i:`linear-gradient(45deg, ${A} 25%, ${B} 25%)`,s:z,p:'0 0',r:'repeat'}]}
      return[]}
  }
  return[];
}
function bgParts(b=state.bgd){const L=b.layers.filter(l=>!l.hidden).flatMap(layerCSS);return{color:colorOf(b.base),image:L.map(x=>x.i).join(', ')||'none',size:L.map(x=>x.s).join(', ')||'auto',pos:L.map(x=>x.p).join(', ')||'0 0',rep:L.map(x=>x.r).join(', ')||'repeat'}}
const bgDecl=b=>{const p=bgParts(b);return`background-color:${p.color};background-image:${p.image};background-size:${p.size};background-position:${p.pos};background-repeat:${p.rep}`};
function renderBackground(){
  const p=bgParts(),bg={backgroundColor:p.color,backgroundImage:p.image,backgroundSize:p.size,backgroundPosition:p.pos,backgroundRepeat:p.rep};
  // RULE: fixed canvases paint the background per page; the desk around them stays plain.
  if(isFixed()){for(const k in bg)stage.style[k]='';$('#desk').style.background='';for(const s of document.querySelectorAll('#sheets .sheet'))Object.assign(s.style,bg)}
  else{Object.assign(stage.style,bg);$('#desk').style.background=p.color}
  document.documentElement.style.setProperty('--pvbg',p.color);
}
let bgArmed=true;
function bgTouch(){if(bgArmed){pushUndo();bgArmed=false}}
const bgEdit=commit=>{bgTouch();renderBackground();if(commit)save()};
function colorCtl(obj,key,onChange,allowNone,inheritLabel){
  if(!obj[key])obj[key]={c:'#000000',role:null};const v=obj[key];
  const w=mkEl('span',{className:'cc'}),chip=mkEl('label',{className:'chip'}),inp=mkEl('input',{type:'color'}),sel=mkEl('select');
  inp.setAttribute('aria-label','Pick a color');sel.setAttribute('aria-label','Color source');
  if(inheritLabel)sel.append(mkEl('option',{value:'inherit',textContent:inheritLabel}));
  sel.append(mkEl('option',{value:'custom',textContent:'Custom'}));if(allowNone)sel.append(mkEl('option',{value:'none',textContent:'None'}));
  PAL_ROLES.forEach((r,i)=>sel.append(mkEl('option',{value:'r'+i,textContent:r})));
  const sync=()=>{const c=colorOf(v);chip.style.background=v.none?'repeating-conic-gradient(#ccc 0 25%,#fff 0 50%) 0 0/8px 8px':v.inherit?`linear-gradient(135deg,${v.c} 0 50%,transparent 0) ,repeating-linear-gradient(45deg,#fff 0 3px,#ccc 0 6px)`:c;
    if(!/^#[0-9a-f]{6}$/i.test(v.c||''))v.c='#000000';inp.value=v.inherit?v.c:/^#[0-9a-f]{6}$/i.test(c)?c:'#000000';sel.value=v.inherit?'inherit':v.none?'none':v.role!=null?'r'+v.role:'custom';
    sel.title=v.role!=null&&!state.palette?'Turn on a palette for this role to take effect':''};
  inp.oninput=()=>{v.c=inp.value;v.role=null;v.none=false;v.inherit=false;sync();onChange(false)};
  inp.onchange=()=>onChange(true);
  sel.onchange=()=>{const x=sel.value;v.inherit=x==='inherit';v.none=x==='none';v.role=x[0]==='r'?+x.slice(1):null;if(v.role!=null&&state.palette)v.c=state.palette.c[v.role];sync();onChange(true)};
  chip.append(inp);w.append(chip,sel);sync();return w;
}
function newLayer(type){
  const id=nid('l');
  if(type==='image')return{id,type,src:null,w:0,h:0,fit:'cover',pos:'center',scale:100};
  if(type==='linear')return{id,type,a:{c:'#2e5bff',role:6},b:{c:'#ff2e88',role:7},angle:180};
  if(type==='radial')return{id,type,a:{c:'#ffd23f',role:5},b:{c:'#ffffff',role:0},shape:'circle',pos:'center'};
  return{id,type:'pattern',kind:'dots',a:{c:'#9aa0a6',role:10},b:{none:true},size:20,thick:2,angle:0};
}
function moveLayer(i,d){const L=state.bgd.layers,j=i+d;if(j<0||j>=L.length)return;bgTouch();[L[i],L[j]]=[L[j],L[i]];renderBackground();renderBgWin();save()}
function layerCard(L,i){
  const c=mkEl('div',{className:'bglayer'+(L.hidden?' off':'')}),head=mkEl('div',{className:'blhead'});
  const vis=mkEl('input',{type:'checkbox',checked:!L.hidden,title:'Show this layer'});vis.setAttribute('aria-label','Show layer');
  vis.onchange=()=>{bgTouch();L.hidden=!vis.checked;c.classList.toggle('off',L.hidden);renderBackground();save()};
  const btn=(t,title,fn)=>{const x=mkEl('button',{className:'btn',textContent:t,title,type:'button'});x.setAttribute('aria-label',title);x.onclick=()=>{audio();fn()};return x};
  head.append(vis,mkEl('b',{textContent:LAYER_NAMES[L.type]}),btn('↑','Move up',()=>moveLayer(i,-1)),btn('↓','Move down',()=>moveLayer(i,1)),btn('×','Remove layer',()=>{bgTouch();state.bgd.layers.splice(i,1);renderBackground();renderBgWin();save()}));
  c.append(head);
  const row=()=>{const r=mkEl('div',{className:'blrow'});c.append(r);return r};
  const sel=(label,opts,key,def,rerender)=>{const l=mkEl('label');l.append(label+' ');const s=mkEl('select');for(const [v,t] of opts)s.append(mkEl('option',{value:v,textContent:t}));s.value=L[key]??def;
    s.onchange=()=>{bgTouch();L[key]=s.value;renderBackground();save();if(rerender)renderBgWin()};l.append(s);return l};
  const num=(label,key,def,min,max,step=1)=>{const l=mkEl('label');l.append(label+' ');const n=mkEl('input',{type:'number',value:L[key]??def,min,max,step});
    n.oninput=()=>{bgTouch();L[key]=+n.value;renderBackground()};n.onchange=()=>save();l.append(n);return l};
  const col=(label,key,none)=>{const l=mkEl('span',{className:'blcol'});l.append(label+' ',colorCtl(L,key,bgEdit,none));return l};
  if(L.type==='image'){
    const r=row(),th=mkEl('div',{className:'blthumb'});th.style.backgroundImage=L.src?`url("${safeUrl(L.src)}")`:'none';
    const fid='bgimg-'+L.id,pick=mkEl('label',{className:'btn',textContent:L.src?'Replace…':'Choose image…'}),fi=mkEl('input',{type:'file',accept:'image/*',className:'sr',id:fid});pick.htmlFor=fid;
    fi.onchange=async()=>{const f=fi.files[0];if(!f)return;const src=await readURL(f),d=await imgSize(src);bgTouch();Object.assign(L,{src,w:d.w,h:d.h});renderBackground();renderBgWin();save()};
    r.append(th,pick,fi);
    if(L.src)r.append(btn('Edit in Paint','Open this image in the Paint Studio',()=>studioOpenImage(L.src,{kind:'bg',id:L.id},L.w,L.h)));
    row().append(sel('Fit',FITS,'fit','cover',true));
    const r2=row();if(L.fit==='tile'||L.fit==='once')r2.append(num('Scale %','scale',100,5,800,5));if(L.fit!=='stretch')r2.append(sel('Anchor',POSITIONS,'pos','center'));
  }else if(L.type==='pattern'){
    row().append(sel('Pattern',PAT_KINDS,'kind','dots',true));
    row().append(col('Ink','a'),col('Gap','b',true));
    const r=row();r.append(num('Size','size',20,4,400),num('Line','thick',2,1,200));if(L.kind==='stripes')r.append(num('Angle','angle',0,-360,360,15));
  }else{
    row().append(col('From','a'),col('To','b'));
    const r=row(),mid=mkEl('label',{className:'tog2'}),cb=mkEl('input',{type:'checkbox',checked:!!L.mid});
    cb.onchange=()=>{bgTouch();L.mid=cb.checked;renderBackground();renderBgWin();save()};mid.append(cb,' Middle color');r.append(mid);if(L.mid)r.append(colorCtl(L,'c',bgEdit));
    if(L.type==='linear')row().append(num('Angle','angle',180,-360,360,15));
    else row().append(sel('Shape',[['circle','Circle'],['ellipse','Ellipse']],'shape','circle'),sel('Center',POSITIONS,'pos','center'));
  }
  return c;
}
function renderBgWin(){
  const b=state.bgd;$('#bgBaseCtl').replaceChildren(colorCtl(b,'base',bgEdit));
  const box=$('#bgLayers');box.replaceChildren();
  if(!b.layers.length)box.append(mkEl('p',{className:'empty',textContent:'No layers yet. Add a gradient, a pattern or an image. A painting from the Paint Studio can be the image.'}));
  b.layers.forEach((L,i)=>box.append(layerCard(L,i)));
}
$('#w-bg').addEventListener('pointerdown',()=>{bgArmed=true},true);
$('#w-bg').addEventListener('focusin',()=>{bgArmed=true});
// FIX: a layer add is a discrete step; keyboard focus stays on the select and never re-arms bgTouch's grouping.
$('#bgAdd').onchange=e=>{const t=e.target.value;e.target.value='';if(!t)return;audio();bgArmed=true;bgTouch();state.bgd.layers.unshift(newLayer(t));renderBackground();renderBgWin();save();sfx('pop')};
$('#bgClear').onclick=()=>{audio();bgArmed=true;bgTouch();state.bgd={base:{c:'#ffffff',role:0},layers:[]};renderBackground();renderBgWin();save();status('Background cleared. Undo brings it back.')};
$('#bgSavePrim').onclick=()=>{audio();addPrim({kind:'background',name:`Background ${prims.list.filter(x=>x.kind==='background').length+1}`,data:{bg:cloneBg(state.bgd)}});showWin('w-prims')};


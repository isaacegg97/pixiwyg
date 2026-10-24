// SECTION: text effects drilldown (words and letters inside an element)
// RULE: one more way into an element, beside Component, Logic, Animation, Text and Content: select part of its text
//   and give just that part an effect. Effects are spans in the element's own content: static ones carry inline
//   style, moving ones a pxfx-* class whose keyframes live in RESET_CSS (in every element and every export), and
//   the project's own node styles apply by class. No script, so script-free exports keep them.
// FORMAT: <span data-pxfx="id" data-pxfx-p="{params}" class? style?>…</span>; per-letter effects hold one
//   <span style="--i:n"> per letter. data-pxfx-p is what the effect was made with, so it can be reopened and changed.
const TFX=[
  {id:'highlight',group:'Mark',name:'Highlighter',p:[['c','Colour','color','#fff176']],make:p=>({style:`background:linear-gradient(transparent 55%,${p.c} 55%)`})},
  {id:'underline',group:'Mark',name:'Underline',p:[['k','Style',['wavy','double','dotted','solid'],'wavy'],['c','Colour','color','#ff2e88']],make:p=>({style:`text-decoration:underline ${p.k} ${p.c};text-decoration-thickness:.08em;text-underline-offset:.15em`})},
  {id:'strike',group:'Mark',name:'Strike through',p:[['c','Colour','color','#16121f']],make:p=>({style:`text-decoration:line-through ${p.c} .1em`})},
  {id:'colour',group:'Colour',name:'Colour',p:[['c','Colour','color','#ff2e88']],make:p=>({style:`color:${p.c}`})},
  {id:'gradient',group:'Colour',name:'Gradient fill',p:[['a','From','color','#ff2e88'],['b','To','color','#3a86ff']],make:p=>({style:`background:linear-gradient(90deg,${p.a},${p.b});-webkit-background-clip:text;background-clip:text;color:transparent`})},
  {id:'outline',group:'Colour',name:'Outline',p:[['w','Width',['thin','medium','thick'],'medium'],['c','Colour','color','#16121f'],['f','Fill','color','#ffffff']],
    make:p=>({style:`-webkit-text-stroke:${{thin:'.02em',medium:'.05em',thick:'.09em'}[p.w]} ${p.c};paint-order:stroke fill;color:${p.f}`})},
  {id:'shadow',group:'Colour',name:'Drop shadow',p:[['c','Colour','color','#ff2e88']],make:p=>({style:`text-shadow:.06em .06em 0 ${p.c}`})},
  {id:'glow',group:'Colour',name:'Glow',p:[['c','Colour','color','#39ff14']],make:p=>({style:`text-shadow:0 0 .2em ${p.c},0 0 .5em ${p.c}`})},
  {id:'size',group:'Shape',name:'Bigger / smaller',p:[['k','Size',['0.6','0.8','1.25','1.6','2'],'1.6']],make:p=>({style:`font-size:${p.k}em`})},
  {id:'tilt',group:'Shape',name:'Tilt',p:[['d','Angle',['-12','-6','6','12'],'-6']],make:p=>({cls:'pxfx-tilt',style:`transform:rotate(${p.d}deg)`})},
  {id:'ransom',group:'Shape',name:'Ransom letters',p:[],make:()=>({cls:'pxfx-ransom',perChar:i=>{const r=Math.sin(i*12.9898)*43758.5453,f=r-Math.floor(r),c=['#16121f','#ff2e88','#ffe600','#3a86ff','#ffffff'][(f*5)|0];
    return`background:${c};color:${c==='#16121f'||c==='#3a86ff'?'#fff':'#16121f'};transform:rotate(${((f*14)|0)-7}deg);padding:0 .08em;font-family:${['Georgia,serif','Impact,sans-serif','"Courier New",monospace','"Arial Black",sans-serif'][(f*4)|0]}`}})},
  {id:'wiggle',group:'Motion',name:'Wiggle',p:[],make:()=>({cls:'pxfx-wiggle'})},
  {id:'wave',group:'Motion',name:'Wave',p:[],make:()=>({cls:'pxfx-wave',perChar:()=>''})},
  {id:'bounce',group:'Motion',name:'Bounce',p:[],make:()=>({cls:'pxfx-bounce'})},
  {id:'blink',group:'Motion',name:'Blink',p:[],make:()=>({cls:'pxfx-blink'})},
  {id:'rainbow',group:'Motion',name:'Rainbow',p:[],make:()=>({cls:'pxfx-rainbow'})},
];
const tfx={el:null,cur:null,vals:{},armed:true,target:null};
function tfxEffects(){
  // RULE: the project's own styles (Styles… node editor) are offered by name; they apply as their class.
  const own=[...styleClasses()].map(([id,cls])=>{const s=state.styleGraphs.find(x=>x.id===id);return{id:'style:'+cls,group:'Your styles',name:s?styleName(s.g):cls,p:[],make:()=>({cls})}});
  return[...TFX,...own];
}
function openTextFx(el){
  if(!el||(TAGS[el.tag]||{}).void)return;
  tfx.el=el;tfx.armed=true;tfx.target=null;$('#tfxTitle').textContent=`Text effects · <${el.tag}> ${elLabel(el)}`;
  const box=$('#tfxText');box.innerHTML=el.content!=null?el.content:(TAGS[el.tag].content||'');
  drawTfxList();drawTfxUsed();if(!tfx.cur)tfxPick('highlight');$('#tfxModal').hidden=false;
  status('Select some words in the box, pick an effect, then Apply.');
}
function closeTextFx(){$('#tfxModal').hidden=true;tfx.el=null;tfx.target=null;renderInspector()}
function drawTfxList(){
  const box=$('#tfxList');box.replaceChildren();let g='';
  for(const f of tfxEffects()){if(f.group!==g){g=f.group;box.append(mkEl('h4',{textContent:g}))}
    const b=mkEl('button',{type:'button',className:'fxitem'+(tfx.cur&&tfx.cur.id===f.id?' on':''),textContent:f.name});b.dataset.fx=f.id;
    b.onmousedown=e=>e.preventDefault();b.onclick=()=>{audio();tfxPick(f.id)};box.append(b)}
}
function tfxPick(id,vals){
  const f=tfxEffects().find(x=>x.id===id);if(!f)return;tfx.cur=f;tfx.vals={};const box=$('#tfxParams');box.replaceChildren();
  for(const [k,label,kind,d0] of f.p){const def=vals&&vals[k]!=null&&(kind==='color'?okHex(vals[k]):kind.includes(vals[k]))?vals[k]:d0;
    const row=mkEl('label',{className:'fxrow'});row.append(mkEl('span',{textContent:label}));let inp;
    if(kind==='color')inp=mkEl('input',{type:'color',value:def});else{inp=mkEl('select');for(const o of kind)inp.append(mkEl('option',{value:o,textContent:o}));inp.value=def}
    tfx.vals[k]=def;inp.oninput=()=>{tfx.vals[k]=inp.value};inp.onmousedown=e=>e.stopPropagation();row.append(inp);box.append(row);
  }
  drawTfxList();tfxMode();
}
// RULE: with an effect reopened, Apply becomes Update and replaces that effect (or swaps it for the one picked).
function tfxMode(){const t=tfx.target&&tfx.target.isConnected;if(!t)tfx.target=null;$('#tfxApply').textContent=t?'Update this effect':'Apply to selection';
  for(const r of $('#tfxUsed').querySelectorAll('.refrow'))r.classList.toggle('on',!!t&&r._span===tfx.target)}
function tfxUnwrap(s){const plain=s.querySelector(':scope>span[style^="--i"]'),nodes=plain?[document.createTextNode(s.textContent)]:[...s.childNodes];s.replaceWith(...nodes);return nodes}
function tfxEdit(s){
  tfx.target=s;let v=null;try{v=JSON.parse(s.dataset.pxfxP||'null')}catch(e){}
  tfxPick(s.dataset.pxfx,v&&typeof v==='object'?v:null);
  const r=document.createRange();r.selectNodeContents(s);const sel=getSelection();sel.removeAllRanges();sel.addRange(r);
  status('Change the settings (or pick another effect), then Update.');
}
// INVARIANT: the selection must sit inside the text box; anything else is not this element's text.
function tfxRange(){
  const s=getSelection(),box=$('#tfxText');if(!s.rangeCount)return null;const r=s.getRangeAt(0);
  return !r.collapsed&&box.contains(r.commonAncestorContainer)?r:null;
}
function tfxApply(){
  let r;
  if(tfx.target&&tfx.target.isConnected){const nodes=tfxUnwrap(tfx.target);tfx.target=null;r=document.createRange();r.setStartBefore(nodes[0]);r.setEndAfter(nodes[nodes.length-1])}
  else r=tfxRange();
  if(!r){status('Select some of the text in the box first.');return false}
  const f=tfx.cur,m=f.make({...tfx.vals}),span=mkEl('span');span.dataset.pxfx=f.id;if(f.p.length)span.dataset.pxfxP=JSON.stringify(tfx.vals);if(m.cls)span.className=m.cls;if(m.style)span.setAttribute('style',m.style);
  const frag=r.extractContents();
  if(m.perChar){let i=0;for(const ch of frag.textContent){if(/\s/.test(ch)){span.append(ch);continue}const c=mkEl('span',{textContent:ch});const st=m.perChar(i);c.setAttribute('style',`--i:${i}`+(st?';'+st:''));i++;span.append(c)}}
  else span.append(frag);
  r.insertNode(span);getSelection().removeAllRanges();tfxCommit();tfxMode();sfx('pop');return true;
}
function tfxCommit(){const el=tfx.el;if(!el)return;if(tfx.armed){pushUndo();tfx.armed=false;setTimeout(()=>{tfx.armed=true},0)}el.content=$('#tfxText').innerHTML;renderEl(el);updateSel();save();drawTfxUsed()}
function drawTfxUsed(){
  const box=$('#tfxUsed');box.replaceChildren();const spans=[...$('#tfxText').querySelectorAll('span[data-pxfx]')];
  if(!spans.length){box.append(mkEl('p',{className:'shelp',textContent:'No effects yet.'}));return}
  for(const s of spans){const f=tfxEffects().find(x=>x.id===s.dataset.pxfx),row=mkEl('div',{className:'refrow'}),x=mkEl('button',{type:'button',className:'btn ico',textContent:'×',title:'Remove this effect'});
    const name=mkEl('button',{type:'button',className:'tfxname',textContent:f?f.name:s.dataset.pxfx,title:'Change this effect'});row._span=s;
    x.setAttribute('aria-label','Remove effect');name.onmousedown=e=>e.preventDefault();
    name.onclick=()=>{audio();tfxEdit(s)};
    x.onclick=()=>{audio();if(tfx.target===s)tfx.target=null;tfxUnwrap(s);tfxCommit();tfxMode()};
    row.append(name,mkEl('small',{textContent:'“'+s.textContent.slice(0,40)+'”'}),x);box.append(row)}
  tfxMode();
}
// RULE: selecting other text in the box means a new effect, not changing the reopened one.
document.addEventListener('selectionchange',()=>{if(!tfx.target||$('#tfxModal').hidden)return;const s=getSelection();if(!s.rangeCount)return;
  const r=s.getRangeAt(0);if(!r.collapsed&&!(tfx.target.contains(r.commonAncestorContainer)||r.intersectsNode(tfx.target))){tfx.target=null;tfxMode()}});
$('#tfxApply').onmousedown=e=>e.preventDefault();
$('#tfxApply').onclick=()=>{audio();tfxApply()};
$('#tfxClose').onclick=$('#tfxDone').onclick=()=>{audio();closeTextFx()};
// RULE: the box is for selecting, not typing; text itself is edited on the page or in the Inspector.
$('#tfxText').addEventListener('beforeinput',e=>e.preventDefault());
$('#tfxText').addEventListener('keydown',e=>{if(e.key.length===1&&!e.ctrlKey&&!e.metaKey)e.preventDefault()});


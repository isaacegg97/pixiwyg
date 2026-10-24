// SECTION: building element DOM
// SAFETY: event handlers, srcdoc, and URL attributes pointing at javascript:/vbscript:/data:html are refused everywhere.
const URL_ATTRS=/^(href|src|xlink:href|action|formaction|srcdoc|data|poster|background|lowsrc|dynsrc|ping)$/i;
const unsafeAttr=(n,v)=>/^on/i.test(n)||n.toLowerCase()==='srcdoc'||(URL_ATTRS.test(n)&&/^(javascript|vbscript|data:text\/html|data:application\/xhtml)/i.test(String(v).replace(/[\s\u0000-\u001f]+/g,'')));
function applyC(node,c,skip){
  for(const k of c.classes)if(!skip||!skip.includes(k))node.classList.add(k);
  if(c.id)node.id=c.id;
  // SAFETY: attributes come from stylesheet selectors, which come from untrusted CSS.
  for(const [n,v] of c.attrs){if(unsafeAttr(n,v))continue;try{if(n==='class')v.split(/\s+/).filter(Boolean).forEach(k=>node.classList.add(k));else node.setAttribute(n,v)}catch(e){}}
}
const EL_COLORS=[['fg','color','Text'],['bg','background','Background'],['line','border-color','Border']];
function makeTree(el){
  const tag=el.tag,f=fileById(el.fileId),sel=el._sel!==undefined?el._sel:(f?el.selector:null);
  const html=document.createElement('div');html.className='__html';
  if(isScaled(el)){html.style.setProperty('transform',`scale(${el.sx||1},${el.sy||1})`,'important');html.style.setProperty('transform-origin','0 0');html.style.pointerEvents='auto'}
  const body=document.createElement('div');body.className='__body';html.append(body);
  const chain=(sel&&parseChain(sel))||[{tag,id:'',classes:[],attrs:[]}];
  let parent=body,target=null;
  chain.forEach((c,i)=>{
    if(c.classes.includes('__html')){applyC(html,c,['__html']);return}
    if(c.classes.includes('__body')){applyC(body,c,['__body']);return}
    if(i===chain.length-1){target=document.createElement(tag);applyC(target,c);parent.append(target)}
    else{let tn=(c.tag&&c.tag!=='*')?c.tag:'div';if(VOID.has(tn))tn='div';let a;try{a=document.createElement(tn)}catch(e){a=document.createElement('div')}applyC(a,c);parent.append(a);parent=a}
  });
  if(!target){target=document.createElement(tag);body.append(target)}
  const def=TAGS[tag]||{};
  for(const [k,v] of Object.entries(def.attrs||{}))if(!target.hasAttribute(k))target.setAttribute(k,v);
  for(const [k,v] of Object.entries(el.attrs||{})){if(unsafeAttr(k,v))continue;try{if(v===''||v==null)target.removeAttribute(k);else target.setAttribute(k,v)}catch(e){}}
  if(el.extra)el.extra.split(/\s+/).filter(Boolean).forEach(c=>{try{target.classList.add(c)}catch(e){}});
  // RULE: Inspector colors are set !important so they beat the stylesheet.
  if(el.colors)for(const [k,prop] of EL_COLORS)if(el.colors[k])target.style.setProperty(prop,colorOf(el.colors[k]),'important');
  if(tag==='img'){target.src=el.content||IMG_PH;if(el.w)target.style.width='100%'}
  else if(!def.void)target.innerHTML=el.content!=null?el.content:(def.content||'');
  return{node:html,target,file:f};
}
const isScaled=el=>(el.sx&&el.sx!==1)||(el.sy&&el.sy!==1);
// RULE: a text element whose boxes paint nothing (no background, border, shadow, outline) is as wide as its ink. A
//   block h1 at w:640 holding one short line otherwise selects, snaps and scales as 640px of empty space.
// INVARIANT: only trailing blank is trimmed; the left edge stays the host's, so scale-from-origin math still holds.
//   Centered/right-aligned text keeps the layout width for the same reason.
const INK_TAGS=new Set(['h1','h2','h3','h4','h5','h6','p','span','a','label','strong','em','small','b','i','q','cite']);
const zeroPx=v=>!parseFloat(v);
const paints=cs=>!/^(transparent|rgba\(.*,\s*0\))$/.test(cs.backgroundColor)||cs.backgroundImage!=='none'||cs.boxShadow!=='none'||
  (cs.outlineStyle!=='none'&&!zeroPx(cs.outlineWidth))||['Top','Right','Bottom','Left'].some(k=>cs['border'+k+'Style']!=='none'&&!zeroPx(cs['border'+k+'Width']));
// HACK: text-shadow and stroke draw past the glyph advance; their right reach is added so the box covers the ink.
function inkReach(cs){
  let r=parseFloat(cs.paddingRight)||0,sh=0;
  if(cs.textShadow!=='none')for(const s of cs.textShadow.split(/,(?![^(]*\))/)){const n=[...s.matchAll(/(-?[\d.]+)px/g)].map(m=>+m[1]);sh=Math.max(sh,(n[0]||0)+(n[2]||0))}
  return r+sh+(parseFloat(cs.webkitTextStrokeWidth)||0)/2;
}
// PERF: memoized on the host; renderEl, a host resize and font loads clear it.
function inkW(h,sx){
  if(h._inkW!==undefined)return h._inkW;
  const t=h._target,W=h.offsetWidth;let w=W;
  if(t&&W&&INK_TAGS.has(t.localName)){
    const cs=getComputedStyle(t);let ok=/^(start|left|justify|-webkit-left)$/.test(cs.textAlign)&&cs.direction!=='rtl';
    for(let n=t;ok&&n&&n.nodeType===1;n=n.parentNode)if(paints(n===t?cs:getComputedStyle(n)))ok=false;
    if(ok){
      const r=document.createRange();r.selectNodeContents(t);const hb=h.getBoundingClientRect(),k=hb.width/W*sx||1;let right=-Infinity;
      for(const q of r.getClientRects())if(q.width)right=Math.max(right,q.right);
      if(right>-Infinity)w=Math.max(1,Math.min(W,Math.ceil((right-hb.left)/k+inkReach(cs))));
    }
  }
  return h._inkW=w;
}
const elBox=(el,h=hostOf(el.id))=>h?{w:inkW(h,el.sx||1)*(el.sx||1),h:h.offsetHeight*(el.sy||1)}:{w:(el.w||100)*(el.sx||1),h:40*(el.sy||1)};
// INVARIANT: flow, confinement, paging and export use the layout box: ink width depends on font-load timing, and
//   layout must be deterministic across a save/open round trip. The ink box is for selecting, snapping and scaling.
const layoutBox=(el,h=hostOf(el.id))=>h?{w:h.offsetWidth*(el.sx||1),h:h.offsetHeight*(el.sy||1)}:{w:(el.w||100)*(el.sx||1),h:40*(el.sy||1)};
function buildInto(root,el){
  const t=makeTree(el),sheets=elementSheets(el,t.file);root.adoptedStyleSheets=[...sheets,RESET];root.replaceChildren(t.node);
  const acc=el.colors&&t.file&&root.host&&root.host.isConnected?accentSheet(el,t,sheets):null;
  if(acc)root.adoptedStyleSheets=[...sheets,acc,RESET];
  return t.target;
}

// SECTION: stage elements
// PERF: id->host map; querySelector over the layer made every flow and drag O(n) per lookup, O(n^2) per manuscript reflow.
// INVARIANT: hosts are only created by renderEl; a host detached by any other path fails the parentNode check.
const hosts=new Map();
const hostOf=id=>{const h=hosts.get(id);return h&&h.parentNode===layer?h:null};
const dropHost=id=>{const h=hosts.get(id);if(!h)return;hosts.delete(id);ro.unobserve(h);h.remove()};
const selected=()=>state.els.find(e=>e.id===state.sel)||null;
function renderEl(el){
  let host=hostOf(el.id);
  if(!host){host=document.createElement('div');host.className='el';host.dataset.id=el.id;host.attachShadow({mode:'open'});layer.append(host);hosts.set(el.id,host);ro.observe(host)}
  host.style.left=el.x+'px';host.style.top=el.y+'px';host.style.width=el.w?el.w+'px':'';host.style.zIndex=el.z||0;
  // FIX: a scaled host's layout box still catches clicks where nothing shows; only the visible target takes the pointer.
  host.style.pointerEvents=isScaled(el)?'none':'';host.classList.toggle('isoff',!!(iso&&iso.id&&iso.id!==el.id));
  host._target=buildInto(host.shadowRoot,el);host._inkW=undefined;
}
// PERF: flow layouts measure in one isolated host beside #layer and write positions after. A forced layout with #layer
//   dirty re-places every absolutely positioned sibling: 0.12ms per read at 100 hosts, 1.08ms at 1500, so measuring in
//   place made a manuscript reflow O(n^2).
// INVARIANT: no renderEl into #layer between measure() calls of one flow, or each read pays for the whole layer again.
let measHost=null;
function measure(el){
  if(!measHost){const box=mkEl('div',{id:'measBox'});measHost=mkEl('div',{className:'el'});measHost.attachShadow({mode:'open'});box.append(measHost);layer.before(box)}
  measHost.style.left=el.x+'px';measHost.style.width=el.w?el.w+'px':'';buildInto(measHost.shadowRoot,el);
  return{w:measHost.offsetWidth,h:measHost.offsetHeight};
}
function renderAll(){for(const h of hosts.values())ro.unobserve(h);hosts.clear();layer.replaceChildren();for(const el of state.els)renderEl(el);updateSel()}
const ro=new ResizeObserver(es=>{for(const e of es)e.target._inkW=undefined;updateSel()});
document.fonts.addEventListener('loadingdone',()=>{for(const h of hosts.values())h._inkW=undefined;updateSel()});
// RULE: hovering an element outlines the box selecting it would show (its ink box), for the select and place tools.
const hoverbox=$('#hoverbox');let hoverId=null;
function showHover(id){
  const el=id&&id!==state.sel&&!['select','place'].every(t=>stage.dataset.tool!==t)&&state.els.find(e=>e.id===id),host=el&&hostOf(id);
  hoverId=host?id:null;if(!host){hoverbox.hidden=true;return}
  const bx=elBox(el,host);Object.assign(hoverbox.style,{left:host.offsetLeft+'px',top:host.offsetTop+'px',width:bx.w+'px',height:bx.h+'px'});hoverbox.hidden=false;
}
layer.addEventListener('pointerover',e=>{const h=e.target.closest&&e.target.closest('.el');showHover(h&&!e.buttons?h.dataset.id:null)});
layer.addEventListener('pointerout',e=>{if(!e.relatedTarget||!e.relatedTarget.closest||!e.relatedTarget.closest('.el'))showHover(null)});
layer.addEventListener('pointerdown',()=>showHover(null));
function updateSel(){
  const el=selected();const host=el&&hostOf(el.id);
  if(el)for(const inp of document.querySelectorAll('#ins [data-pos]'))if(document.activeElement!==inp)inp.value=posShow(el,inp.dataset.pos);
  if(!host){selbox.hidden=true;return}
  selbox.hidden=false;if(state.editing&&state.editing.id===el.id)host._inkW=undefined;
  selbox.style.left=host.offsetLeft+'px';selbox.style.top=host.offsetTop+'px';
  const bx=elBox(el,host);selbox.style.width=bx.w+'px';selbox.style.height=bx.h+'px';selbox.classList.toggle('flowing',!!el.md);selbox.classList.toggle('small',bx.w<40||bx.h<40);
  const U=selUnion();selbox.classList.toggle('multi',!!U);markSel();
  if(U){Object.assign(selbox.style,{left:U.x+'px',top:U.y+'px',width:U.w+'px',height:U.h+'px'});const g=el.group&&state.drill!==el.group;$('#selLabel').textContent=g?`${(state.groupNames||{})[el.group]||'Group'} · ${U.n} elements`:`${U.n} selected · Ctrl/⌘+G groups them`;return}
  for(const inp of document.querySelectorAll('#ins [data-scale]'))if(document.activeElement!==inp)inp.value=Math.round((el[inp.dataset.scale]||1)*1000)/10;
  const f=fileById(el.fileId);
  $('#selLabel').textContent=`<${el.tag}> ${f?showSel(el.selector)+' · '+f.name:'no stylesheet'}${isFixed()?' · '+pageLabel(pageOf(el).i):''}`;
}
function select(id){
  if(state.editing)finishEdit();
  selectSet(id);state.sel=id;const el=selected();if(document.body.dataset.ws==='animate')tlMark();if(typeof treeLater==='function')treeLater();
  if(el&&el.tag!==state.activeTag){state.activeTag=el.tag;renderPalette();renderStyles()}
  else{
    // PERF: same tag keeps the catalog cards; only the help line and the marked card change.
    setShelp();markCards();
  }
  updateSel();renderInspector();mirrorBase();
}
const maxZ=()=>state.els.reduce((m,e)=>Math.max(m,e.z||0),0);
function placeElement(tag,x,y,w,content){
  pushUndo();
  const st=nextStyleFor(tag);
  const el={id:nid('e'),tag,fileId:st.fileId,selector:st.selector,x:Math.round(x),y:Math.round(y),w:w?Math.round(w):(TAGS[tag].w||null),z:maxZ()+1};
  if(content!=null)el.content=content;
  state.els.push(el);renderEl(el);if(boxesOn())boxDrop(el,x+1,y+1,false);select(el.id);sfx('pop');save();
  return el;
}


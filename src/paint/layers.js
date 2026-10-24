// SECTION: layers
// RULE: a drawing is a stack of layers, each with a name, opacity, blend mode and visibility. Brushes, the bucket,
//   filters, Clear and the selection work on the active layer; the eyedropper, Trim, transforms, thumbnails and
//   everything that leaves the studio (Place, Update, Save .png/.gif, primitives) see the layers flattened.
//   Every frame has the same layers; each frame keeps its own pixels for each of them (its cels).
// INVARIANT: `paint` and `ctx` are always the active layer's canvas and 2D context, so code written for one canvas
//   works on whichever layer is active. The active canvas carries id="paint".
// FORMAT: studio.layers = [{id, name, opacity 0..1, blend, hidden, c: <canvas>}], bottom first. blend is a canvas
//   composite operation that is also a CSS mix-blend-mode, so the live stack and the flattened output agree
//   ('source-over' shows as 'normal'). A frame is {cels: {layerId: PNG data URL}, url: flattened or null, stale}.
const LAYER_BLENDS=BLENDS.filter(([v])=>v!=='source-atop');
const LMAX=32;
const slayers=$('#slayers');
const lid=()=>'ly'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function layerCanvas(){const c=document.createElement('canvas');c.className='slayer';c.width=paint.width;c.height=paint.height;c.getContext('2d',{willReadFrequently:true}).setTransform(sdpr,0,0,sdpr,0,0);return c}
const newPaintLayer=(name,c=layerCanvas())=>({id:lid(),name,opacity:1,blend:'source-over',hidden:false,c});
studio.layers=[newPaintLayer('Layer 1',paint)];studio.li=0;
const activeLayer=()=>studio.layers[studio.li];
function mountLayers(){
  slayers.replaceChildren(...studio.layers.map(L=>L.c));
  studio.layers.forEach((L,i)=>{
    if(i===studio.li){L.c.id='paint';L.c.setAttribute('aria-label',`Painting canvas, layer ${L.name}`)}else{L.c.removeAttribute('id');L.c.removeAttribute('aria-label')}
    L.c.style.opacity=L.opacity;L.c.style.mixBlendMode=L.blend==='source-over'?'normal':L.blend;L.c.style.visibility=L.hidden?'hidden':'';
  });
  paint=activeLayer().c;ctx=paint.getContext('2d',{willReadFrequently:true});
  // INVARIANT: a layer wearing effects shows its effect copy (L.v) just above its own canvas, which stays the one painted on.
  for(const L of studio.layers)if(L.v||layerFxOn(L))fxDirty.add(L);if(fxDirty.size){cancelAnimationFrame(fxRaf);fxDraw()}
}
function drawInto(c,url){
  const g=c.getContext('2d');g.save();g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,c.width,c.height);g.restore();
  if(!url)return Promise.resolve(true);
  return new Promise(res=>{const i=new Image();i.onload=()=>{g.save();g.setTransform(1,0,0,1,0,0);g.drawImage(i,0,0,c.width,c.height);g.restore();res(true)};i.onerror=()=>res(false);i.src=url});
}
const loadImg=url=>new Promise(res=>{if(!url){res(null);return}const i=new Image();i.onload=()=>res(i);i.onerror=()=>res(null);i.src=url});
function layerBlank(c){const d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i])return false;return true}
const layerURL=L=>layerBlank(L.c)?null:L.c.toDataURL('image/png');
// FORMAT: src(L) gives what to draw for a layer: its canvas by default, a decoded cel for another frame.
function flatCanvas(src=L=>L.c,{fx=true}={}){
  const c=imgCanvas(paint.width,paint.height),g=c.getContext('2d');
  for(const L of studio.layers){if(L.hidden||!L.opacity)continue;const s=src(L);if(!s)continue;g.globalAlpha=L.opacity;g.globalCompositeOperation=L.blend;g.drawImage(fx&&layerFxOn(L)?fxApply(s,L.fx,c.width,c.height,sdpr):s,0,0,c.width,c.height)}
  return c;
}
const flatURL=()=>flatCanvas().toDataURL('image/png');
function flatPixel(x,y){
  const c=imgCanvas(1,1),g=c.getContext('2d',{willReadFrequently:true});
  for(const L of studio.layers){if(L.hidden||!L.opacity)continue;g.globalAlpha=L.opacity;g.globalCompositeOperation=L.blend;g.drawImage(L.v||L.c,x,y,1,1,0,0,1,1)}
  return g.getImageData(0,0,1,1).data;
}
const visibleIds=()=>new Set(studio.layers.filter(L=>!L.hidden&&L.opacity>0).map(L=>L.id));

// SECTION: layers across frames
function markStale(){studio.frames.forEach((f,i)=>{if(i!==studio.fi)f.stale=true})}
// PERF: other frames' flattened images are rebuilt only when something reads them, once per change.
let freshing=null;
function freshFlats(){
  if(freshing)return freshing;
  const todo=studio.frames.filter((f,i)=>i!==studio.fi&&f.stale);if(!todo.length)return Promise.resolve();
  freshing=(async()=>{
    for(const f of todo){f.stale=false;const cels=f.cels||{},imgs={};
      await Promise.all(studio.layers.map(async L=>{imgs[L.id]=await loadImg(cels[L.id])}));
      const ids=visibleIds();f.url=studio.layers.some(L=>ids.has(L.id)&&imgs[L.id])?flatCanvas(L=>imgs[L.id]).toDataURL('image/png'):null}
  })().finally(()=>{freshing=null});
  return freshing;
}
async function eachOtherFrame(fn){for(const [i,f] of studio.frames.entries())if(i!==studio.fi){f.cels=f.cels||{};await fn(f)}markStale()}

// SECTION: layer undo
// FORMAT: an undo entry is {id, url} for pixels on one layer, or {stack} for the whole stack: every layer's settings
//   and pixels in this frame, and the cels of the other frames, so merging or deleting undoes in every frame.
function stackSnap(){return{li:studio.li,layers:studio.layers.map(L=>({id:L.id,name:L.name,opacity:L.opacity,blend:L.blend,hidden:L.hidden,...(L.fx?{fx:{...L.fx}}:{}),url:layerURL(L)})),
  frames:studio.frames.map((f,i)=>i===studio.fi?null:[f,{...(f.cels||{})}]).filter(Boolean)}}
async function stackRestore(s){
  const old=new Map(studio.layers.map(L=>[L.id,L.c]));
  const oldV=new Map(studio.layers.map(L=>[L.id,L.v]));
  studio.layers=s.layers.map(x=>({id:x.id,name:x.name,opacity:x.opacity,blend:x.blend,hidden:x.hidden,...(x.fx?{fx:{...x.fx}}:{}),c:old.get(x.id)||layerCanvas(),v:oldV.get(x.id)||null}));
  studio.li=Math.max(0,Math.min(s.li,studio.layers.length-1));
  await Promise.all(studio.layers.map((L,i)=>drawInto(L.c,s.layers[i].url)));
  for(const [f,cels] of s.frames||[])if(studio.frames.includes(f))f.cels={...cels};
  mountLayers();markStale();layersChanged();
}
function sPushStack(){studio.undo.push({stack:stackSnap()});if(studio.undo.length>30)studio.undo.shift();studio.redo.length=0}
async function undoApply(x){
  if(x.stack){const inv={stack:stackSnap()};await stackRestore(x.stack);return inv}
  const L=studio.layers.find(l=>l.id===x.id)||(typeof x==='string'&&activeLayer());if(!L)return null;
  const inv={id:L.id,url:L.c.toDataURL()};await drawInto(L.c,x.url??x);fxRefresh(L);
  const i=studio.layers.indexOf(L);if(i!==studio.li){studio.li=i;mountLayers()}layersChanged();return inv;
}

// SECTION: layer operations
function setActiveLayer(i){
  i=Math.max(0,Math.min(studio.layers.length-1,i));if(i===studio.li)return;
  if(fxs.base)closeFx(false);
  studio.li=i;mountLayers();renderLayers();status(`Painting on ${activeLayer().name}`);
}
const layerName=()=>{let n=studio.layers.length+1;const names=new Set(studio.layers.map(L=>L.name));while(names.has('Layer '+n))n++;return'Layer '+n};
function addLayer(){
  if(studio.layers.length>=LMAX){status(`${LMAX} layers is the most a drawing can have.`);return}
  sPushStack();studio.layers.splice(studio.li+1,0,newPaintLayer(layerName()));studio.li++;mountLayers();layersChanged();sSave();sfx('pop');
}
function dupLayer(){
  if(studio.layers.length>=LMAX){status(`${LMAX} layers is the most a drawing can have.`);return}
  sPushStack();const L=activeLayer(),D={...newPaintLayer(L.name+' copy'),opacity:L.opacity,blend:L.blend,hidden:L.hidden,...(L.fx?{fx:{...L.fx}}:{})};
  D.c.getContext('2d').drawImage(L.c,0,0,D.c.width/sdpr,D.c.height/sdpr);
  for(const f of studio.frames)if(f.cels&&f.cels[L.id])f.cels[D.id]=f.cels[L.id];
  studio.layers.splice(studio.li+1,0,D);studio.li++;mountLayers();layersChanged();sSave();sfx('pop');
}
function delLayer(){
  if(studio.layers.length<2){status('A drawing keeps at least one layer. Clear layer empties it.');return}
  sPushStack();const L=studio.layers.splice(studio.li,1)[0];studio.li=Math.min(studio.li,studio.layers.length-1);
  mountLayers();markStale();layersChanged();sSave();sfx('whoosh');status(`Deleted ${L.name}. Undo brings it back.`);
}
function movePaintLayer(d){
  const i=studio.li,j=i+d;if(j<0||j>=studio.layers.length)return;
  sPushStack();const [L]=studio.layers.splice(i,1);studio.layers.splice(j,0,L);studio.li=j;mountLayers();markStale();layersChanged();sSave();sfx('click');
}
// RULE: Merge down draws this layer, at its opacity and blend and with its effects, into the one below; the one below
//   keeps its own settings and effects.
function mergeOnto(lower,upper,U){const g=lower.getContext('2d'),src=layerFxOn(U)?fxApply(upper,U.fx,lower.width,lower.height,sdpr):upper;g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=U.hidden?0:U.opacity;g.globalCompositeOperation=U.blend;g.drawImage(src,0,0,lower.width,lower.height);g.restore()}
// INVARIANT: one merge at a time; the other frames' cels decode before the stack changes.
let merging=false;
async function mergeDown(){
  if(merging)return;if(studio.li<1){status('Nothing below this layer to merge into.');return}
  merging=true;try{await mergeDownNow()}finally{merging=false}
}
async function mergeDownNow(){
  sPushStack();const U=activeLayer(),B=studio.layers[studio.li-1];mergeOnto(B.c,U.c,U);
  await eachOtherFrame(async f=>{const u=f.cels[U.id];if(!u)return;const c=imgCanvas(paint.width,paint.height);const [bi,ui]=await Promise.all([loadImg(f.cels[B.id]),loadImg(u)]);
    if(bi)c.getContext('2d').drawImage(bi,0,0,c.width,c.height);mergeOnto(c,ui,U);f.cels[B.id]=c.toDataURL('image/png')});
  studio.layers.splice(studio.li,1);studio.li--;mountLayers();layersChanged();sSave();sfx('boing');status(`Merged into ${B.name}`);
}
let propPushed=false;
function setLayerProp(k,v,{L=activeLayer(),quiet}={}){
  if(L[k]===v)return;if(!propPushed){sPushStack();propPushed=true}
  L[k]=v;mountLayers();if(k!=='name')markStale();if(!quiet)layersChanged();else renderLayerRow(L);sSave();
}
function toggleLayer(L){propPushed=false;setLayerProp('hidden',!L.hidden,{L});propPushed=false;status(`${L.name} ${L.hidden?'hidden':'shown'}`)}
// INVARIANT: open, New and size changes start a stack of one layer on the canvas that was active.
function resetLayers(){const keep=paint;keep.className='slayer';studio.layers=[newPaintLayer('Layer 1',keep)];studio.li=0;mountLayers();renderLayers()}

// SECTION: whole-drawing transforms (every layer alike)
// INVARIANT: size changes reset undo, as Trim always has: the undo stack holds same-size snapshots.
function remapLayers(w,h,draw){
  const olds=studio.layers.map(L=>{const c=imgCanvas(L.c.width,L.c.height);c.getContext('2d').drawImage(L.c,0,0);return c});
  sizeCanvas(w,h);
  studio.layers.forEach((L,i)=>{const g=L.c.getContext('2d');g.save();g.setTransform(1,0,0,1,0,0);g.imageSmoothingQuality='high';draw(g,olds[i],L.c);g.restore()});
  studio.undo=[];studio.redo=[];drawOnion();drawGuide();drawSel();sSave();thumbNow();renderLayers();
}
function trimBox(c){
  const w=c.width,h=c.height,d=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;let x0=w,y0=h,x1=-1,y1=-1;
  for(let y=0;y<h;y++){const row=y*w*4;for(let i=0;i<w;i++)if(d[row+i*4+3]>0){if(i<x0)x0=i;if(i>x1)x1=i;if(y<y0)y0=y;y1=y}}
  if(x1<0)return null;const pad=2;x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);x1=Math.min(w-1,x1+pad);y1=Math.min(h-1,y1+pad);
  return{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1};
}
// RULE: Trim keeps what any layer has painted, hidden ones too, so nothing is cut off a layer you can't see.
function trimAll(){
  const all=imgCanvas(paint.width,paint.height),g=all.getContext('2d');for(const L of studio.layers)g.drawImage(L.c,0,0);
  const b=trimBox(all);if(!b)return false;remapLayers(b.w/sdpr,b.h/sdpr,(g,o,c)=>g.drawImage(o,b.x,b.y,b.w,b.h,0,0,c.width,c.height));return true;
}

// SECTION: Layers palette
const lyList=$('#lyList');
{const sel=$('#lyBlend');for(const [v,t] of LAYER_BLENDS)sel.append(mkEl('option',{value:v,textContent:t}))}
const blendName=v=>(LAYER_BLENDS.find(b=>b[0]===v)||[,v])[1];
function layerMeta(L){const p=[];if(L.opacity<1)p.push(Math.round(L.opacity*100)+'%');if(L.blend!=='source-over')p.push(blendName(L.blend));return p.join(' · ')}
function drawLayerThumb(cv,L){const k=Math.min(44/paint.width,44/paint.height);cv.width=Math.max(1,Math.round(paint.width*k));cv.height=Math.max(1,Math.round(paint.height*k));const g=cv.getContext('2d');g.clearRect(0,0,cv.width,cv.height);g.drawImage(L.c,0,0,cv.width,cv.height)}
function renderLayerRow(L){
  const li=lyList.querySelector(`[data-id="${L.id}"]`);if(!li)return;
  const eye=li.querySelector('.lyeye');eye.setAttribute('aria-pressed',String(!L.hidden));eye.textContent=L.hidden?'⊘':'👁';
  eye.setAttribute('aria-label',`${L.hidden?'Show':'Hide'} ${L.name}`);eye.title=L.hidden?'Hidden: click to show':'Shown: click to hide';
  li.querySelector('.lyname').textContent=L.name;li.querySelector('.lymeta').textContent=[L.hidden?'Hidden':'',layerMeta(L),layerFxOn(L)?'fx: '+styleName(state.styleGraphs.find(s=>s.id===L.fx.style).g):''].filter(Boolean).join(' · ');
  li.classList.toggle('off',L.hidden);
}
function renderLayers(){
  lyList.replaceChildren();
  for(let i=studio.layers.length-1;i>=0;i--){const L=studio.layers[i],on=i===studio.li;
    const li=mkEl('li',{className:'lyrow'+(on?' on':''),id:'ly-'+L.id});li.dataset.id=L.id;li.setAttribute('role','option');li.setAttribute('aria-selected',String(on));li.draggable=true;
    const eye=mkEl('button',{type:'button',className:'lyeye'});eye.onclick=e=>{e.stopPropagation();audio();sfx('click');toggleLayer(L)};
    const th=mkEl('canvas',{className:'lythumb'});th.setAttribute('aria-hidden','true');drawLayerThumb(th,L);
    const txt=mkEl('span',{className:'lytxt'});txt.append(mkEl('span',{className:'lyname'}),mkEl('small',{className:'lymeta'}));
    li.append(eye,th,txt);
    li.onclick=()=>{audio();setActiveLayer(studio.layers.indexOf(L))};
    li.ondblclick=e=>{if(!e.target.closest('.lyeye'))renameLayer(L)};
    li.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/x-pixiwyg-layer',L.id);e.dataTransfer.effectAllowed='move';li.classList.add('dragging')});
    li.addEventListener('dragend',()=>li.classList.remove('dragging'));
    li.addEventListener('dragover',e=>{if(!e.dataTransfer.types.includes('text/x-pixiwyg-layer'))return;e.preventDefault();li.classList.add('dragover')});
    li.addEventListener('dragleave',()=>li.classList.remove('dragover'));
    li.addEventListener('drop',e=>{e.preventDefault();li.classList.remove('dragover');const id=e.dataTransfer.getData('text/x-pixiwyg-layer'),from=studio.layers.findIndex(x=>x.id===id),to=studio.layers.indexOf(L);
      if(from<0||from===to)return;studio.li=from;movePaintLayer(to-from)});
    lyList.append(li);renderLayerRow(L);
  }
  const L=activeLayer();$('#lyOpacity').value=Math.round(L.opacity*100);$('#lyOpacityVal').textContent=Math.round(L.opacity*100)+'%';$('#lyBlend').value=L.blend;
  $('#lyDel').disabled=studio.layers.length<2;$('#lyMerge').disabled=studio.li<1;$('#lyUp').disabled=studio.li>=studio.layers.length-1;$('#lyDown').disabled=studio.li<1;
  $('#lyAdd').disabled=$('#lyDup').disabled=studio.layers.length>=LMAX;
  const fs=$('#lyFx');fs.replaceChildren(mkEl('option',{value:'',textContent:'None'}));for(const s of state.styleGraphs)fs.append(mkEl('option',{value:s.id,textContent:styleName(s.g)}));
  fs.value=layerFxOn(L)?L.fx.style:'';$('#lyFxEdit').disabled=!fs.value;$('#lyFxFill').checked=!!(L.fx&&L.fx.fill);$('#lyFxFill').disabled=!fs.value;
  lyList.setAttribute('aria-activedescendant','ly-'+L.id);
}
// PERF: thumbnails redraw once a frame at most, and only the active layer's after a stroke.
let thumbRaf=0;
function layerThumbs(all){if(thumbRaf)return;thumbRaf=requestAnimationFrame(()=>{thumbRaf=0;for(const L of all?studio.layers:[activeLayer()]){const cv=lyList.querySelector(`[data-id="${L.id}"] .lythumb`);if(cv)drawLayerThumb(cv,L)}})}
function layersChanged(){renderLayers();drawStrip();drawOnion()}
function renameLayer(L){
  const li=lyList.querySelector(`[data-id="${L.id}"]`);if(!li)return;const span=li.querySelector('.lyname');
  const inp=mkEl('input',{type:'text',className:'lyedit',value:L.name,maxLength:40});inp.setAttribute('aria-label','Layer name');span.replaceWith(inp);inp.focus();inp.select();
  let done=false;const end=ok=>{if(done)return;done=true;const v=inp.value.trim();if(ok&&v&&v!==L.name){propPushed=false;setLayerProp('name',v,{L});propPushed=false}renderLayers();lyList.focus()};
  inp.onkeydown=e=>{e.stopPropagation();if(e.key==='Enter')end(true);if(e.key==='Escape')end(false)};inp.onblur=()=>end(true);
}
lyList.addEventListener('keydown',e=>{
  if(e.target!==lyList)return;const d={ArrowUp:1,ArrowDown:-1}[e.key];
  if(d){e.preventDefault();e.stopPropagation();setActiveLayer(studio.li+d);return}
  if(e.key==='Home'){e.preventDefault();setActiveLayer(studio.layers.length-1)}else if(e.key==='End'){e.preventDefault();setActiveLayer(0)}
  else if(e.key==='F2'){e.preventDefault();renameLayer(activeLayer())}
});
$('#lyOpacity').addEventListener('pointerdown',()=>{propPushed=false});$('#lyOpacity').addEventListener('keydown',()=>{propPushed=false});
$('#lyOpacity').oninput=e=>{setLayerProp('opacity',+e.target.value/100,{quiet:true});$('#lyOpacityVal').textContent=e.target.value+'%'};
$('#lyOpacity').onchange=()=>{propPushed=false;drawStrip();drawOnion()};
$('#lyBlend').onchange=e=>{propPushed=false;setLayerProp('blend',e.target.value);propPushed=false};
$('#lyAdd').onclick=()=>{audio();addLayer()};$('#lyDup').onclick=()=>{audio();dupLayer()};$('#lyDel').onclick=()=>{audio();delLayer()};
$('#lyMerge').onclick=()=>{audio();mergeDown()};$('#lyUp').onclick=()=>{audio();movePaintLayer(1)};$('#lyDown').onclick=()=>{audio();movePaintLayer(-1)};
$('#lyFx').onchange=e=>{const L=activeLayer();propPushed=false;setLayerProp('fx',e.target.value?{style:e.target.value,fill:!!(L.fx&&L.fx.fill)}:null);propPushed=false;fxRefresh(L);
  status(e.target.value?`${L.name} wears ${styleName(state.styleGraphs.find(s=>s.id===e.target.value).g)}`:`${L.name} has no effects`)};
$('#lyFxFill').onchange=e=>{const L=activeLayer();if(!layerFxOn(L))return;propPushed=false;setLayerProp('fx',{...L.fx,fill:e.target.checked});propPushed=false;fxRefresh(L)};
$('#lyFxNew').onclick=()=>{audio();const L=activeLayer(),s=newStyleGraph(`${L.name} effects`);syncNodeSheet(true);propPushed=false;setLayerProp('fx',{style:s.id,fill:false});propPushed=false;fxRefresh(L);openLayerStyle(s.id)};
$('#lyFxEdit').onclick=()=>{audio();const L=activeLayer();if(layerFxOn(L))openLayerStyle(L.fx.style)};
renderLayers();

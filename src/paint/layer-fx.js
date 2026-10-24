// SECTION: layer effects
// RULE: a layer can wear a style graph, the same styles elements and brush tips wear, and it applies the way base
//   shapes take it: the shadow, glow and outline follow what's painted (its transparency), not the canvas's box.
//   Effects are live and never change the pixels: painting, undo and frames keep working on the layer itself, and
//   only what's shown and what leaves the studio (exports, thumbnails of frames) carries them.
// FORMAT: L.fx = {style: style graph id, fill: bool (recolour the layer with the style's fill)}, or no fx.
//   From the style: --shadow 'x y blur color', --glow '0 0 size color', --stroke color, --stroke-w length,
//   --fill color, --fill-image linear-gradient(...), --filter CSS filters, and its opacity.
// HACK: everything is drawn with canvas shadows and composites, which every engine has; CSS filters use ctx.filter
//   where the engine supports it and are skipped where it doesn't.
const CAN_FILTER='filter' in CanvasRenderingContext2D.prototype;
const layerFxCache=new Map();let fxProbe=null;
const layerFxOn=L=>!!(L&&L.fx&&L.fx.style&&state.styleGraphs.some(s=>s.id===L.fx.style));
function styleFx(id){
  const key=id+'|'+brushStyleRev,hit=layerFxCache.get(key);if(hit)return hit;
  const cls=styleClasses().get(id),ns=nodeSheet();if(!cls||!ns)return null;
  if(!fxProbe){fxProbe=mkEl('div');fxProbe.style.cssText='position:fixed;left:-9999px;top:0;width:10px;height:10px';fxProbe.attachShadow({mode:'open'});document.body.append(fxProbe)}
  fxProbe.shadowRoot.adoptedStyleSheets=[ns];fxProbe.shadowRoot.innerHTML=`<div class="${cls}"></div>`;
  const cs=getComputedStyle(fxProbe.shadowRoot.firstChild),v=k=>cs.getPropertyValue(k).trim();
  const p={shadow:fxShadow(v('--shadow')),glow:fxShadow(v('--glow')),stroke:v('--stroke'),strokeW:parseFloat(v('--stroke-w'))||0,fill:v('--fill'),fillImage:v('--fill-image'),filter:v('--filter'),opacity:+cs.opacity};
  if(!Number.isFinite(p.opacity))p.opacity=1;
  layerFxCache.set(key,p);while(layerFxCache.size>40)layerFxCache.delete(layerFxCache.keys().next().value);return p;
}
// FORMAT: '3px 3px 0px #00ff00' (lengths, then a colour) -> {x, y, blur, color}; the first shadow of a list.
function fxShadow(s){
  if(!s||s==='none')return null;s=s.split(/,(?![^(]*\))/)[0].trim();
  const color=(s.match(/(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)\s*$/i)||s.match(/^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\))/i)||[])[1];
  const n=(s.replace(color||'','').match(/-?[\d.]+(?=px|\b)/g)||[]).map(Number);if(!color||!n.length)return null;
  return{x:n[0]||0,y:n[1]||0,blur:n[2]||0,color};
}
// FORMAT: linear-gradient([angle|to side,] color [pct], ...) -> a canvas gradient across w x h; null if it can't read it.
function fxGradient(g,s,w,h){
  const m=/^linear-gradient\((.*)\)$/i.exec(s||'');if(!m)return null;
  const parts=m[1].split(/,(?![^(]*\))/).map(x=>x.trim());let a=180;
  if(/deg$/.test(parts[0]))a=parseFloat(parts.shift());else if(/^to /.test(parts[0])){const t=parts.shift();a={'to top':0,'to right':90,'to bottom':180,'to left':270}[t]??180}
  if(parts.length<2)return null;const r=(a-90)*Math.PI/180,L=Math.abs(w*Math.cos(r))+Math.abs(h*Math.sin(r)),cx=w/2,cy=h/2,dx=Math.cos(r)*L/2,dy=Math.sin(r)*L/2;
  const gr=g.createLinearGradient(cx-dx,cy-dy,cx+dx,cy+dy);
  try{parts.forEach((p,i)=>{const mm=/^(.*?)\s+(-?[\d.]+)%$/.exec(p);gr.addColorStop(mm?Math.max(0,Math.min(1,+mm[2]/100)):i/(parts.length-1),mm?mm[1]:p)})}catch(e){return null}
  return gr;
}
const fxScaleLen=(s,k)=>s.replace(/(-?[\d.]+)px/g,(_,n)=>(+n*k)+'px');
// INVARIANT: src is a canvas or image of the layer at w x h device px; k is device px per drawing px.
function fxApply(src,fx,w,h,k){
  const p=fx&&styleFx(fx.style);if(!p)return src;
  const tint=paint=>{const t=imgCanvas(w,h),g=t.getContext('2d');g.drawImage(src,0,0,w,h);g.globalCompositeOperation='source-in';g.fillStyle=typeof paint==='function'?paint(g):paint;g.fillRect(0,0,w,h);return t};
  let body=src;
  if(fx.fill&&(p.fillImage&&p.fillImage!=='none'||p.fill&&p.fill!=='transparent'))body=tint(g=>fxGradient(g,p.fillImage,w,h)||p.fill);
  if(p.filter&&CAN_FILTER){const t=imgCanvas(w,h),g=t.getContext('2d');g.filter=fxScaleLen(p.filter,k);g.drawImage(body,0,0,w,h);body=t}
  const comp=imgCanvas(w,h),cg=comp.getContext('2d');
  if(p.strokeW>0&&p.stroke&&p.stroke!=='transparent'){const r=p.strokeW*k,mask=tint(p.stroke),n=Math.max(12,Math.min(48,Math.round(r*3)));
    for(let i=0;i<n;i++){const a=i/n*Math.PI*2;cg.drawImage(mask,Math.cos(a)*r,Math.sin(a)*r)}}
  cg.drawImage(body,0,0,w,h);
  const out=imgCanvas(w,h),g=out.getContext('2d');g.globalAlpha=p.opacity;
  const cast=(s,times)=>{if(!s)return;g.save();g.shadowColor=s.color;g.shadowBlur=s.blur*k;g.shadowOffsetX=s.x*k;g.shadowOffsetY=s.y*k;for(let i=0;i<times;i++)g.drawImage(comp,0,0);g.restore()};
  cast(p.shadow,1);cast(p.glow,2);g.drawImage(comp,0,0);
  return out;
}
// SECTION: showing effects in the studio
// PERF: the shown copy redraws at most once a frame, and only for the layers whose pixels or style changed.
const fxDirty=new Set();let fxRaf=0;
function fxRefresh(L){if(L)fxDirty.add(L);else for(const x of studio.layers)fxDirty.add(x);if(!fxRaf)fxRaf=requestAnimationFrame(fxDraw)}
function fxDraw(){
  fxRaf=0;for(const L of fxDirty){if(!studio.layers.includes(L))continue;
    if(!layerFxOn(L)){if(L.v){L.v.remove();L.v=null;L.c.style.visibility=L.hidden?'hidden':''}continue}
    if(!L.v){L.v=document.createElement('canvas');L.v.className='slayer slayerfx';L.v.setAttribute('aria-hidden','true')}
    if(L.v.width!==L.c.width||L.v.height!==L.c.height){L.v.width=L.c.width;L.v.height=L.c.height}
    const g=L.v.getContext('2d');g.clearRect(0,0,L.v.width,L.v.height);g.drawImage(fxApply(L.c,L.fx,L.c.width,L.c.height,sdpr),0,0);
    if(L.v.previousSibling!==L.c)L.c.after(L.v);
    L.v.style.opacity=L.opacity;L.v.style.mixBlendMode=L.c.style.mixBlendMode;L.v.style.visibility=L.hidden?'hidden':'';L.c.style.visibility='hidden';
  }
  fxDirty.clear();
}
// INVARIANT: called by brushStylesChanged whenever the compiled style graphs change.
function layerFxStylesChanged(){layerFxCache.clear();fxRefresh();if(typeof nodeLayerPreview==='function')nodeLayerPreview()}
// SECTION: the layer in the node editor's preview
// RULE: opened from Layers, the style editor's preview shows the layer itself wearing the style, beside the usual
//   text, shape and vector, so the effect can be judged on the painting while the nodes change.
function openLayerStyle(id){openStyleEditor(id,{layer:true})}
function nodeLayerPreview(){
  const box=$('#nodePrevBox');if(!box)return;let fig=box.querySelector('.nlayerprev');
  if(!ned.layerPreview||ned.mode!=='style'||$('#nodeModal').hidden){if(fig)fig.remove();return}
  if(!fig){fig=mkEl('figure',{className:'nlayerprev'});fig.append(mkEl('canvas'),mkEl('figcaption'));box.prepend(fig)}
  const L=activeLayer(),out=fxApply(L.c,{style:ned.styleId,fill:!!(L.fx&&L.fx.fill)},L.c.width,L.c.height,sdpr),cv=fig.firstChild,k=Math.min(1,240/out.width,180/out.height);
  cv.width=Math.max(1,Math.round(out.width*k));cv.height=Math.max(1,Math.round(out.height*k));cv.getContext('2d').drawImage(out,0,0,cv.width,cv.height);
  fig.lastChild.textContent=`${L.name} wearing this style`;
}
// SECTION: effects leaving the studio
// RULE: the page, backgrounds and primitives get the drawing as painted and, when a layer wears effects, a second
//   image laid over it holding only the pixels the effects change (shadow, glow, outline, recolour). The original
//   stays whole and editable, the effects stay separable, and both are plain images: cheap (the overlay is mostly
//   transparent) and portable. Save .png still downloads the finished, flattened picture.
// FORMAT: studioOutputs() -> {base, fx}: PNG data URLs (APNG with frames); fx is null when no effect changes a pixel.
const FX_TOL=3;
function fxOverlay(base,fin){
  const w=fin.width,h=fin.height,a=base.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data,o=fin.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h),d=o.data;let any=false;
  for(let i=0;i<d.length;i+=4){if(!d[i+3]&&!a[i+3])continue;
    if(Math.abs(d[i+3]-a[i+3])<=FX_TOL&&Math.abs(d[i]-a[i])<=FX_TOL&&Math.abs(d[i+1]-a[i+1])<=FX_TOL&&Math.abs(d[i+2]-a[i+2])<=FX_TOL)d[i+3]=0;else if(d[i+3])any=true}
  if(!any)return null;const c=imgCanvas(w,h);c.getContext('2d').putImageData(o,0,0);return c;
}
async function studioOutputs(){
  if(!studio.layers.some(layerFxOn))return{base:await studioOutput(),fx:null};
  const pair=src=>{const b=flatCanvas(src,{fx:false}),o=fxOverlay(b,flatCanvas(src));return{b:b.toDataURL('image/png'),o:o&&o.toDataURL('image/png')}};
  if(studio.frames.length<2){const r=pair(L=>L.c);return{base:r.b,fx:r.o}}
  saveFrame();const bases=[],ovs=[];let any=false;
  for(const [i,f] of studio.frames.entries()){let src=L=>L.c;
    if(i!==studio.fi){const imgs={};await Promise.all(studio.layers.map(async L=>{imgs[L.id]=await loadImg((f.cels||{})[L.id])}));src=L=>imgs[L.id]}
    const r=pair(src);bases.push(r.b);ovs.push(r.o||blankFrame());if(r.o)any=true}
  return{base:encodeAPNG(bases,studio.fps),fx:any?encodeAPNG(ovs,studio.fps):null};
}
// FORMAT: on the page the overlay is an <img data-layer-fx> grouped with its drawing, above it, at its place and size.
const fxPartner=el=>el&&el.group&&state.els.find(e=>e!==el&&e.group===el.group&&e.attrs&&'data-layer-fx' in e.attrs)||null;
function pairFx(el,fx){
  const o=fxPartner(el);
  if(!fx){if(o){state.els=state.els.filter(e=>e!==o);dropHost(o.id);if(groupMembers(el.group).length<2){if(state.groupNames)delete state.groupNames[el.group];delete el.group}}return null}
  const alt=(el.attrs&&el.attrs.alt)||'Drawing';let x=o;
  if(!x){if(!el.group){el.group=nid('g');(state.groupNames||(state.groupNames={}))[el.group]=alt}
    x={id:nid('e'),tag:'img',fileId:null,selector:null,group:el.group,attrs:{alt:alt+' effects','data-layer-fx':''},z:(el.z||0)+1};state.els.push(x)}
  Object.assign(x,{content:fx,x:el.x,y:el.y,w:el.w});for(const k of ['sx','sy'])if(el[k]!=null)x[k]=el[k];else delete x[k];renderEl(x);return x;
}
// FORMAT: a background gets the overlay as the layer straight above the drawing's; studio.editing.fx remembers it.
function pairBgFx(L,fx){
  const ls=state.bgd.layers,cur=studio.editing&&studio.editing.fx&&ls.find(l=>l.id===studio.editing.fx);
  if(!fx){if(cur)state.bgd.layers=ls.filter(l=>l!==cur);return null}
  if(cur){Object.assign(cur,{src:fx,w:L.w,h:L.h,fit:L.fit,pos:L.pos,scale:L.scale});return cur}
  const F={...L,id:nid('l'),src:fx};ls.splice(ls.indexOf(L),0,F);return F;
}

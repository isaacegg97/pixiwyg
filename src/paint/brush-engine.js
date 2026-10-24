// SECTION: brush engine
// RULE: a brush lays dabs of its tip along the stroke, spaced by a fraction of its size; each dab is jittered in size,
//   angle, position, opacity and hue as the brush says, and turns with the stroke when the brush follows it. A pen's
//   pressure scales size, opacity or both. One engine draws strokes, the brush editor's live preview and the
//   Brushes palette's swatches, so what you see there is what you paint.
// RULE: a shape tip is an element like any on the page: a base shape (or a letter) wearing the style graph the brush
//   names, in the foreground colour, rendered to a bitmap. Change the style in the node editor and the tip follows.
// FORMAT: brush = {id, name, tip: 'round'|'shape'|'picture', hardness, shape, letter, style, picture, tint, size,
//   spacing, opacity, angle, follow, pressure: 'size'|'opacity'|'both'|'off', jitter: {size, angle, scatter, opacity,
//   hue}}. size is in drawing px; hardness, spacing (of the size), opacity and jitter are 0..1 (scatter counts sizes,
//   hue half turns); angle is degrees; style is a style graph id; picture a PNG data URL, 256 px a side at most.
const BRUSH_SHAPES=[['circle','Circle'],['square','Square'],['rounded','Rounded square'],['star','Star'],['burst','Burst'],['blob','Blob'],['diamond','Diamond'],['triangle','Triangle'],['hexagon','Hexagon'],['letter','A letter']];
const BRUSH_PRESSURE=[['size','Size'],['opacity','Opacity'],['both','Size and opacity'],['off','Nothing']];
const BRUSH_DEF={tip:'round',hardness:.8,shape:'circle',letter:'A',style:null,picture:null,tint:true,size:16,spacing:.12,opacity:1,angle:0,follow:false,pressure:'size',jitter:{size:0,angle:0,scatter:0,opacity:0,hue:0}};
const BRUSH_PICTURE_MAX=256;
// SAFETY: brushes come from project files; every field is rebuilt from known kinds and ranges. The letter is one
//   character and is escaped where it meets markup; a picture must be a PNG data URL of bounded length.
function cleanBrush(x,{id}={}){
  x=x&&typeof x==='object'?x:{};const n=(v,a,b,d)=>{v=+v;return Number.isFinite(v)?Math.max(a,Math.min(b,v)):d},j=x.jitter&&typeof x.jitter==='object'?x.jitter:{};
  const pic=typeof x.picture==='string'&&x.picture.length<600000&&/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(x.picture)?x.picture:null;
  return{id:id||(typeof x.id==='string'&&/^[\w:-]{1,40}$/.test(x.id)?x.id:nid('br')),name:String(x.name||'Brush').slice(0,40),
    tip:['round','shape','picture'].includes(x.tip)?(x.tip==='picture'&&!pic?'round':x.tip):'round',hardness:n(x.hardness,0,1,BRUSH_DEF.hardness),
    shape:BRUSH_SHAPES.some(s=>s[0]===x.shape)?x.shape:'circle',letter:Array.from(String(x.letter||'A'))[0]||'A',
    style:typeof x.style==='string'&&/^[\w-]{1,40}$/.test(x.style)?x.style:null,picture:pic,tint:x.tint!==false,
    size:n(x.size,1,200,BRUSH_DEF.size),spacing:n(x.spacing,.02,3,BRUSH_DEF.spacing),opacity:n(x.opacity,.02,1,1),angle:n(x.angle,-360,360,0),follow:!!x.follow,
    pressure:BRUSH_PRESSURE.some(p=>p[0]===x.pressure)?x.pressure:'size',
    jitter:{size:n(j.size,0,1,0),angle:n(j.angle,0,1,0),scatter:n(j.scatter,0,3,0),opacity:n(j.opacity,0,1,0),hue:n(j.hue,0,1,0)}};
}
const BUILTIN_BRUSHES=[
  {id:'b:round',name:'Round',hardness:.9,size:12,spacing:.08},
  {id:'b:soft',name:'Soft airbrush',hardness:0,size:48,spacing:.06,opacity:.12,pressure:'opacity'},
  {id:'b:ink',name:'Ink',hardness:1,size:6,spacing:.04,pressure:'size'},
  {id:'b:chisel',name:'Chisel marker',tip:'shape',shape:'square',size:18,spacing:.04,opacity:.7,angle:45},
  {id:'b:chalk',name:'Chalk',hardness:.35,size:14,spacing:.18,opacity:.5,jitter:{size:.4,scatter:.25,opacity:.6}},
  {id:'b:stars',name:'Scatter stars',tip:'shape',shape:'star',size:22,spacing:1.4,jitter:{size:.6,angle:1,scatter:1.6,opacity:.3,hue:.25}},
  {id:'b:confetti',name:'Confetti',tip:'shape',shape:'circle',size:12,spacing:1.6,jitter:{size:.5,scatter:2.2,hue:1}},
].map(b=>({...cleanBrush({...BRUSH_DEF,...b,jitter:{...BRUSH_DEF.jitter,...(b.jitter||{})}},{id:b.id}),builtin:true}));

// SECTION: brush tips
// PERF: a tip is rendered once per brush look, colour and resolution and cached; strokes stamp the cached bitmap.
//   Style tips render through an SVG foreignObject (as catalog thumbnails do), which is asynchronous: until one is
//   ready a stroke paints with a round tip of the same colour, and the waiting previews redraw when it lands.
const TIP_FRAME=1.5;   // FORMAT: a shape fills 1/TIP_FRAME of its tip, leaving room for the shadows and glows a style adds.
let brushStyleRev=0,tipBase=null;
const tipCache=new Map(),tipWait=new Map();
const tipPx=(b,size,scale)=>Math.max(4,Math.min(768,Math.ceil(size*(b.tip==='shape'?TIP_FRAME:1)*scale)));
function tipKey(b,color,px){return [b.tip,b.tip==='round'?b.hardness:'',b.tip==='shape'?[b.shape,b.letter,b.style,brushStyleRev].join(','):'',b.tip==='picture'?[b.tint,b.picture.length,b.picture.slice(-32)].join(','):'',color,px,b.jitter.hue>0].join('|')}
function roundTip(px,hardness,color){
  const c=imgCanvas(px,px),g=c.getContext('2d'),r=px/2,gr=g.createRadialGradient(r,r,Math.min(r-.5,r*hardness),r,r,r);
  const [cr,cg,cb]=hexRgb(color);gr.addColorStop(0,color);gr.addColorStop(1,`rgba(${cr},${cg},${cb},0)`);g.fillStyle=gr;g.beginPath();g.arc(r,r,r,0,Math.PI*2);g.fill();return c;
}
async function shapeTip(b,color,px){
  if(!tipBase)tipBase=fetchLib('base.css').catch(()=>'');
  const base=await tipBase,gen=(state.files.find(f=>f.gen)||{}).text||'',cls=b.style?styleClasses().get(b.style)||'':'',inner=Math.round(px/TIP_FRAME);
  const el=b.shape==='letter'?`<span class="text display ${cls}" style="--fill:${color};font-size:${Math.round(inner*.92)}px;line-height:1">${escH(b.letter)}</span>`
    :`<div class="shape ${b.shape} ${cls}" style="--fill:${color};width:${inner}px"></div>`;
  const css=`${RESET_CSS}\n${base}\n${gen}`,faces=await facesFor(css);
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}"><foreignObject x="0" y="0" width="${px}" height="${px}">`
    +`<tip-frame xmlns="http://www.w3.org/1999/xhtml" style="display:flex;align-items:center;justify-content:center;width:${px}px;height:${px}px;overflow:hidden;color:${color}">`
    +`<style><![CDATA[${faces}\n${css}\n*,::before,::after{animation:none!important;transition:none!important}]]></style>${el}</tip-frame></foreignObject></svg>`;
  const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);await img.decode();
  const c=imgCanvas(px,px);c.getContext('2d').drawImage(img,0,0,px,px);c.getContext('2d').getImageData(0,0,1,1);return c;
}
async function pictureTip(b,color,px){
  const img=await loadImg(b.picture);if(!img)throw new Error('The brush picture could not be read');
  const c=imgCanvas(px,px),g=c.getContext('2d'),k=px/Math.max(img.width,img.height),w=img.width*k,h=img.height*k;g.drawImage(img,(px-w)/2,(px-h)/2,w,h);
  if(b.tint){g.globalCompositeOperation='source-in';g.fillStyle=color;g.fillRect(0,0,px,px)}return c;
}
// HACK: hue jitter picks between pre-turned copies of the tip; per-dab canvas filters aren't in every engine.
function hueVariants(c){
  const out=[];for(const k of [-3,-2,-1,1,2,3]){const v=imgCanvas(c.width,c.height),g=v.getContext('2d');g.drawImage(c,0,0);const im=g.getImageData(0,0,v.width,v.height),d=im.data,a=k*Math.PI/3,
    cs=Math.cos(a),sn=Math.sin(a),m=[.213+cs*.787-sn*.213,.715-cs*.715-sn*.715,.072-cs*.072+sn*.928,.213-cs*.213+sn*.143,.715+cs*.285+sn*.14,.072-cs*.072-sn*.283,.213-cs*.213-sn*.787,.715-cs*.715+sn*.715,.072+cs*.928+sn*.072];
    for(let i=0;i<d.length;i+=4){const r=d[i],gg=d[i+1],bb=d[i+2];d[i]=m[0]*r+m[1]*gg+m[2]*bb;d[i+1]=m[3]*r+m[4]*gg+m[5]*bb;d[i+2]=m[6]*r+m[7]*gg+m[8]*bb}
    g.putImageData(im,0,0);out.push(v)}
  return out;
}
// FORMAT: returns {c, hues, ready}; not ready means a stand-in round tip, and onReady runs once the real one is cached.
function brushTip(b,color,px,onReady){
  const key=tipKey(b,color,px),hit=tipCache.get(key);if(hit)return hit;
  if(b.tip==='round'){const c=roundTip(px,b.hardness,color),t={c,hues:b.jitter.hue>0?hueVariants(c):null,ready:true};tipCache.set(key,t);trimTips();return t}
  const w=tipWait.get(key);if(w){if(onReady)w.add(onReady)}else{const set=new Set(onReady?[onReady]:[]);tipWait.set(key,set);
    (b.tip==='shape'?shapeTip(b,color,px):pictureTip(b,color,px)).then(c=>{tipCache.set(key,{c,hues:b.jitter.hue>0?hueVariants(c):null,ready:true});trimTips()},
      e=>{tipCache.set(key,{c:roundTip(px,.8,color),hues:null,ready:true,err:e.message||String(e)});logErr('brush',e.message||String(e))})
      .finally(()=>{tipWait.delete(key);for(const f of set)f()})}
  return{c:roundTip(px,.8,color),hues:null,ready:false};
}
function trimTips(){while(tipCache.size>160)tipCache.delete(tipCache.keys().next().value)}
// INVARIANT: called by syncNodeSheet whenever the compiled style graphs change, so style tips re-render.
function brushStylesChanged(){brushStyleRev++;for(const k of [...tipCache.keys()])if(k.startsWith('shape|'))tipCache.delete(k);if(typeof brushLooksChanged==='function')brushLooksChanged();layerFxStylesChanged()}

// SECTION: strokes
// FORMAT: g is a 2D context in drawing px; scale is device px per drawing px (the tip's resolution); size is the
//   stroke's base size; pressure is 0..1 (1 for a mouse).
function brushStart(g,b,{color,size,scale,onReady},p,pressure=1){
  color=color||'#000000';const s={g,b,color,size,carry:0,last:p,tip:brushTip(b,color,tipPx(b,size,scale),onReady)};brushDab(s,p.x,p.y,null,pressure);return s;
}
function brushTo(s,p,pressure=1){
  const L=s.last,dx=p.x-L.x,dy=p.y-L.y,d=Math.hypot(dx,dy);if(d<.01)return;
  const step=Math.max(.5,s.size*s.b.spacing),dir=Math.atan2(dy,dx);let t=s.carry||step;
  while(t<=d){brushDab(s,L.x+dx*t/d,L.y+dy*t/d,dir,pressure);t+=step}
  s.carry=t-d;s.last=p;
}
function brushDab(s,x,y,dir,pressure){
  const b=s.b,j=b.jitter,R=Math.random,ps=b.pressure==='size'||b.pressure==='both',po=b.pressure==='opacity'||b.pressure==='both';
  const sz=s.size*(ps?.15+.85*pressure:1)*(1-j.size*R())*(b.tip==='shape'?TIP_FRAME:1);if(sz<.3)return;
  const al=b.opacity*(po?pressure:1)*(1-j.opacity*R());if(al<=.003)return;
  let a=b.angle*Math.PI/180+(b.follow&&dir!=null?dir:0);if(j.angle)a+=(R()*2-1)*Math.PI*j.angle;
  let ox=0,oy=0;if(j.scatter){const r=R()*j.scatter*s.size,t=R()*Math.PI*2;ox=Math.cos(t)*r;oy=Math.sin(t)*r}
  const tip=s.tip.hues&&R()<j.hue?s.tip.hues[Math.floor(R()*s.tip.hues.length)]:s.tip.c,g=s.g;
  g.save();g.translate(x+ox,y+oy);if(a)g.rotate(a);g.globalAlpha*=al;g.drawImage(tip,-sz/2,-sz/2,sz,sz);g.restore();
}
// FORMAT: the preview path: an S across a w x h box, as {x, y, p} points with a pen's pressure swelling and fading.
function brushPreviewPath(w,h){const out=[],n=48;for(let i=0;i<=n;i++){const t=i/n;out.push({x:w*.08+t*w*.84,y:h/2+Math.sin(t*Math.PI*2)*h*.26,p:Math.sin(t*Math.PI)*.8+.2})}return out}
function brushPreview(cv,b,{color,size,path,onReady}={}){
  const k=Math.min(2,window.devicePixelRatio||1),w=cv.clientWidth||+cv.dataset.w||120,h=cv.clientHeight||+cv.dataset.h||40;
  cv.width=Math.round(w*k);cv.height=Math.round(h*k);const g=cv.getContext('2d');g.setTransform(k,0,0,k,0,0);g.clearRect(0,0,w,h);
  const sz=size||Math.min(b.size,h*.45),pts=path||brushPreviewPath(w,h);
  const strokes=Array.isArray(pts[0])?pts:[pts];
  for(const st of strokes){if(!st.length)continue;const s=brushStart(g,b,{color,size:sz,scale:k,onReady},st[0],st[0].p??1);for(const q of st.slice(1))brushTo(s,q,q.p??1)}
}

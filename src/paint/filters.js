// SECTION: Paint Studio, expanded: filters, selection, brush opacity and blend, transforms, GIF export
// RULE: no wasm, no eval, no workers (see the research report): filters are WebGL2 shaders written here, global pixel
//   work is plain JS on ImageData, GIF encoding is the vendored lib/gifenc.js (MIT).
// INVARIANT: everything works on the canvas's device pixels (paint.width x paint.height); pointer points arrive in
//   logical units and are multiplied by sdpr on the way in.

// SECTION: WebGL2 filter engine
// INVARIANT: textures are uploaded straight (not premultiplied) and flipped, so uv (0,0) is the bottom-left in every
//   pass; anything that averages neighbours (blur) premultiplies inside its own shader to avoid dark fringes.
const PXFX=(()=>{
  let gl=null,cv=null,vbo=null;const progs=new Map();
  const VS='#version 300 es\nin vec2 p;out vec2 uv;void main(){uv=p*.5+.5;gl_Position=vec4(p,0.,1.);}';
  const HEAD='#version 300 es\nprecision highp float;in vec2 uv;out vec4 o;uniform sampler2D T,O;uniform vec2 px,sz;float lum(vec3 c){return dot(c,vec3(.2126,.7152,.0722));}\n';
  function init(){
    if(gl)return true;cv=document.createElement('canvas');
    gl=cv.getContext('webgl2',{premultipliedAlpha:false,preserveDrawingBuffer:true,antialias:false,alpha:true});if(!gl)return false;
    vbo=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false);
    return true;
  }
  function prog(name,fs){
    if(progs.has(name))return progs.get(name);
    const sh=(t,src)=>{const s=gl.createShader(t);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(name+': '+gl.getShaderInfoLog(s));return s};
    const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,HEAD+fs));gl.bindAttribLocation(p,0,'p');gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(name+': '+gl.getProgramInfoLog(p));
    const P={p,u:new Map()};progs.set(name,P);return P;
  }
  const texOf=(w,h,src)=>{const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
    for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);
    if(src)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,src);else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,null);return t};
  // FORMAT: passes = [{fs, name, u:{uniform:value}}]; each reads the previous pass as T and the original as O.
  function run(src,passes){
    if(!init())throw new Error('This browser has no WebGL2, which the filters need.');
    const w=src.width,h=src.height;cv.width=w;cv.height=h;gl.viewport(0,0,w,h);
    const orig=texOf(w,h,src),made=[orig],fbs=[];let cur=orig;
    passes.forEach((ps,i)=>{
      const P=prog(ps.name,ps.fs),last=i===passes.length-1;let out=null,fb=null;
      if(!last){out=texOf(w,h,null);fb=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fb);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,out,0);made.push(out);fbs.push(fb)}
      else gl.bindFramebuffer(gl.FRAMEBUFFER,null);
      gl.useProgram(P.p);
      const loc=n=>{if(!P.u.has(n))P.u.set(n,gl.getUniformLocation(P.p,n));return P.u.get(n)};
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,cur);gl.uniform1i(loc('T'),0);
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,orig);gl.uniform1i(loc('O'),1);
      gl.uniform2f(loc('px'),1/w,1/h);gl.uniform2f(loc('sz'),w,h);
      for(const [k,v] of Object.entries(ps.u||{})){const l=loc(k);if(l===null)continue;if(Array.isArray(v))(v.length===2?gl.uniform2f:v.length===3?gl.uniform3f:gl.uniform4f).call(gl,l,...v);else gl.uniform1f(l,v)}
      gl.bindBuffer(gl.ARRAY_BUFFER,vbo);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);
      if(out)cur=out;
    });
    // PERF: the result is copied out at once and every texture freed; nothing is kept between runs but the programs.
    const res=document.createElement('canvas');res.width=w;res.height=h;res.getContext('2d').drawImage(cv,0,0);
    for(const t of made)gl.deleteTexture(t);for(const f of fbs)gl.deleteFramebuffer(f);
    return res;
  }
  return{run,ok:()=>init()};
})();
const FS={
  adjust:`uniform float br,co,sa,hu,ga,ex;void main(){vec4 t=texture(T,uv);vec3 c=t.rgb*exp2(ex)+br;c=(c-.5)*co+.5;c=mix(vec3(lum(c)),c,sa);
    float k=cos(hu),s=sin(hu);c=vec3(dot(c,vec3(.213+.787*k-.213*s,.715-.715*k-.715*s,.072-.072*k+.928*s)),dot(c,vec3(.213-.213*k+.143*s,.715+.285*k+.140*s,.072-.072*k-.283*s)),dot(c,vec3(.213-.213*k-.787*s,.715-.715*k+.715*s,.072+.928*k+.072*s)));
    o=vec4(pow(clamp(c,0.,1.),vec3(1./ga)),t.a);}`,
  levels:`uniform float ib,iw,ga,ob,ow;void main(){vec4 t=texture(T,uv);vec3 c=clamp((t.rgb-ib)/max(.001,iw-ib),0.,1.);c=pow(c,vec3(1./ga));o=vec4(mix(vec3(ob),vec3(ow),c),t.a);}`,
  posterize:`uniform float n;void main(){vec4 t=texture(T,uv);o=vec4(floor(t.rgb*(n-1.)+.5)/(n-1.),t.a);}`,
  threshold:`uniform float th;uniform vec3 ink,paper;void main(){vec4 t=texture(T,uv);o=vec4(lum(t.rgb)<th?ink:paper,t.a);}`,
  invert:`void main(){vec4 t=texture(T,uv);o=vec4(1.-t.rgb,t.a);}`,
  duotone:`uniform vec3 da,li;uniform float mx;void main(){vec4 t=texture(T,uv);o=vec4(mix(t.rgb,mix(da,li,lum(t.rgb)),mx),t.a);}`,
  blur:`uniform vec2 dir;uniform float sig;void main(){vec4 a=vec4(0);float ws=0.;int R=int(ceil(sig*3.));
    for(int i=-96;i<=96;i++){if(abs(i)>R)continue;float x=float(i),w=exp(-x*x/(2.*sig*sig));vec4 s=texture(T,uv+dir*px*x);a+=vec4(s.rgb*s.a,s.a)*w;ws+=w;}
    a/=ws;o=a.a>.0001?vec4(a.rgb/a.a,a.a):vec4(0);}`,
  unsharp:`uniform float amt,thr;void main(){vec4 a=texture(O,uv),b=texture(T,uv);vec3 d=a.rgb-b.rgb;o=vec4(clamp(a.rgb+amt*d*step(thr,abs(lum(d))),0.,1.),a.a);}`,
  pixelate:`uniform float cell;void main(){vec2 c=(floor(uv*sz/cell)+.5)*cell/sz;o=texture(T,c);}`,
  edges:`uniform float k;uniform vec3 ink,paper;void main(){float g[9];for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec4 s=texture(T,uv+vec2(i,j)*px);g[(j+1)*3+i+1]=lum(s.rgb)*s.a;}
    float gx=g[2]+2.*g[5]+g[8]-g[0]-2.*g[3]-g[6],gy=g[6]+2.*g[7]+g[8]-g[0]-2.*g[1]-g[2];float e=clamp(length(vec2(gx,gy))*k,0.,1.);
    o=vec4(mix(paper,ink,e),max(texture(T,uv).a,e));}`,
  emboss:`uniform float k;void main(){vec4 a=texture(T,uv-px),b=texture(T,uv+px),t=texture(T,uv);o=vec4(vec3(clamp(.5+(lum(b.rgb)-lum(a.rgb))*k,0.,1.)),t.a);}`,
  noise:`uniform float amt,mono,seed;float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+seed)*43758.5453);}
    void main(){vec4 t=texture(T,uv);vec2 p=floor(uv*sz);vec3 n=mono>.5?vec3(h(p)):vec3(h(p),h(p+17.3),h(p+41.7));o=vec4(clamp(t.rgb+(n-.5)*amt,0.,1.),t.a);}`,
  vignette:`uniform float amt,size;void main(){vec4 t=texture(T,uv);float d=length((uv-.5)*vec2(sz.x/sz.y,1.)*1.4);o=vec4(t.rgb*(1.-amt*smoothstep(size,size+.6,d)),t.a);}`,
  halftone:`uniform float cell,ang;uniform vec3 ink,paper;uniform float keep;void main(){float c=cos(ang),s=sin(ang);mat2 R=mat2(c,s,-s,c);
    vec2 p=R*(uv*sz),q=(floor(p/cell)+.5)*cell;vec4 t=texture(T,clamp(transpose(R)*q/sz,0.,1.));float d=1.-lum(t.rgb);float r=cell*.5*sqrt(d)*1.42;
    float a=smoothstep(r+.8,r-.8,length(p-q))*t.a;vec4 src=texture(T,uv);o=keep>.5?vec4(mix(paper,ink,a),src.a):vec4(ink,a);}`,
  rgbsplit:`uniform float off;void main(){vec2 d=vec2(off,0.)*px;vec4 r=texture(T,uv+d),g=texture(T,uv),b=texture(T,uv-d);o=vec4(r.r,g.g,b.b,max(max(r.a,g.a),b.a));}`,
  silhouette:`uniform vec3 col;void main(){o=vec4(col,texture(T,uv).a);}`,
};
const rgb01=h=>hexRgb(h).map(v=>v/255);
const gl1=(name,u)=>[{name,fs:FS[name],u}];
const blurPasses=sig=>[{name:'blur',fs:FS.blur,u:{dir:[1,0],sig}},{name:'blur',fs:FS.blur,u:{dir:[0,1],sig}}];

// SECTION: CPU pixel work
const imgCanvas=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c};
const dataOf=c=>c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,c.width,c.height);
const canvasOf=img=>{const c=imgCanvas(img.width,img.height);c.getContext('2d').putImageData(img,0,0);return c};
function medianCPU(src,r){
  const s=dataOf(src),d=new ImageData(s.width,s.height),w=s.width,h=s.height,a=s.data,o=d.data,buf=[[],[],[],[]];
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    for(const b of buf)b.length=0;
    for(let j=-r;j<=r;j++){const yy=Math.min(h-1,Math.max(0,y+j));for(let i=-r;i<=r;i++){const k=(yy*w+Math.min(w-1,Math.max(0,x+i)))*4;buf[0].push(a[k]);buf[1].push(a[k+1]);buf[2].push(a[k+2]);buf[3].push(a[k+3])}}
    const k=(y*w+x)*4;for(let c=0;c<4;c++){const b=buf[c].sort((p,q)=>p-q);o[k+c]=b[b.length>>1]}
  }
  return canvasOf(d);
}
// PERF: two-pass chamfer distance (as the raycaster's sdfOf), outside the shape only; O(n) for any outline width.
function outlineCPU(src,width,hex){
  const s=dataOf(src),w=s.width,h=s.height,a=s.data,INF=1e9,dist=new Float32Array(w*h);
  for(let i=0;i<w*h;i++)dist[i]=a[i*4+3]>=128?0:INF;
  const D2=Math.SQRT2;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;let v=dist[i];if(x)v=Math.min(v,dist[i-1]+1);if(y){v=Math.min(v,dist[i-w]+1);if(x)v=Math.min(v,dist[i-w-1]+D2);if(x<w-1)v=Math.min(v,dist[i-w+1]+D2)}dist[i]=v}
  for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){const i=y*w+x;let v=dist[i];if(x<w-1)v=Math.min(v,dist[i+1]+1);if(y<h-1){v=Math.min(v,dist[i+w]+1);if(x<w-1)v=Math.min(v,dist[i+w+1]+D2);if(x)v=Math.min(v,dist[i+w-1]+D2)}dist[i]=v}
  const [r,g,b]=hexRgb(hex),ring=new ImageData(w,h),o=ring.data;
  for(let i=0;i<w*h;i++){const d=dist[i];if(d>0&&d<=width+.5){o[i*4]=r;o[i*4+1]=g;o[i*4+2]=b;o[i*4+3]=255*Math.min(1,width+.5-d+.5)}}
  const out=canvasOf(ring);out.getContext('2d').drawImage(src,0,0);return out;
}
function shadowCPU(src,dx,dy,sig,op,hex){
  const sil=PXFX.run(src,[{name:'silhouette',fs:FS.silhouette,u:{col:rgb01(hex)}},...(sig>0?blurPasses(sig):[])]);
  const out=imgCanvas(src.width,src.height),g=out.getContext('2d');g.globalAlpha=op;g.drawImage(sil,dx,dy);g.globalAlpha=1;g.drawImage(src,0,0);return out;
}
// RULE: background removal floods from every edge pixel that matches the corner colour within tolerance.
function removeBgCPU(src,tol){
  const s=dataOf(src),w=s.width,h=s.height,a=s.data,t=[a[0],a[1],a[2],a[3]],seen=new Uint8Array(w*h),st=[];
  const ok=k=>{const i=k*4;return Math.abs(a[i]-t[0])+Math.abs(a[i+1]-t[1])+Math.abs(a[i+2]-t[2])+Math.abs(a[i+3]-t[3])<=tol*3};
  for(let x=0;x<w;x++){st.push(x,(h-1)*w+x)}for(let y=0;y<h;y++){st.push(y*w,y*w+w-1)}
  while(st.length){const k=st.pop();if(seen[k]||!ok(k))continue;seen[k]=1;a[k*4+3]=0;const x=k%w,y=k/w|0;if(x)st.push(k-1);if(x<w-1)st.push(k+1);if(y)st.push(k-w);if(y<h-1)st.push(k+w)}
  return canvasOf(s);
}
// FORMAT: palettes for dithering; "project" is the page's colour scheme, "auto" is a gifenc quantize of the image.
const PALETTES={
  '1bit':['#000000','#ffffff'],gameboy:['#0f380f','#306230','#8bac0f','#9bbc0f'],cga:['#000000','#55ffff','#ff55ff','#ffffff'],
  riso:['#16121f','#ff48b0','#0078bf','#ffe800','#f7f1e3'],
  pico8:['#000000','#1d2b53','#7e2553','#008751','#ab5236','#5f574f','#c2c3c7','#fff1e8','#ff004d','#ffa300','#ffec27','#00e436','#29adff','#83769c','#ff77a8','#ffccaa'],
};
async function ditherCPU(src,pal,method,colors){
  const s=dataOf(src),w=s.width,h=s.height,a=s.data;let P;
  if(pal==='auto'){await needGifenc();P=gifenc.quantize(a,Math.max(2,Math.min(256,colors|0)),{format:'rgb444'})}
  else if(pal==='project')P=(state.palette&&state.palette.c||PALETTES['1bit']).map(hexRgb);
  else P=(PALETTES[pal]||PALETTES['1bit']).map(hexRgb);
  const near=(r,g,b)=>{let bi=0,bd=1e9;for(let i=0;i<P.length;i++){const q=P[i],d=(q[0]-r)**2*.3+(q[1]-g)**2*.59+(q[2]-b)**2*.11;if(d<bd){bd=d;bi=i}}return P[bi]};
  const f=new Float32Array(w*h*3);for(let i=0;i<w*h;i++){f[i*3]=a[i*4];f[i*3+1]=a[i*4+1];f[i*3+2]=a[i*4+2]}
  const B4=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  const spread=method==='floyd'?[[1,0,7/16],[-1,1,3/16],[0,1,5/16],[1,1,1/16]]:method==='atkinson'?[[1,0,1/8],[2,0,1/8],[-1,1,1/8],[0,1,1/8],[1,1,1/8],[0,2,1/8]]:null;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=y*w+x;if(a[i*4+3]<8)continue;
    let r=f[i*3],g=f[i*3+1],b=f[i*3+2];
    if(method==='bayer'){const t=(B4[(y&3)*4+(x&3)]/16-.5)*64;r+=t;g+=t;b+=t}
    const q=near(r,g,b);a[i*4]=q[0];a[i*4+1]=q[1];a[i*4+2]=q[2];
    if(spread){const er=r-q[0],eg=g-q[1],eb=b-q[2];for(const [dx,dy,k] of spread){const xx=x+dx,yy=y+dy;if(xx<0||xx>=w||yy>=h)continue;const j=(yy*w+xx)*3;f[j]+=er*k;f[j+1]+=eg*k;f[j+2]+=eb*k}}
  }
  return canvasOf(s);
}
let gifencP=null;
function needGifenc(){return window.gifenc?Promise.resolve():(gifencP||(gifencP=new Promise((res,rej)=>{const s=document.createElement('script');s.src='lib/gifenc.js';s.onload=()=>res();s.onerror=()=>{gifencP=null;rej(new Error('lib/gifenc.js could not be loaded'))};document.head.append(s)})))}

// SECTION: filter catalogue
// FORMAT: params [key, label, min, max, step, default] for ranges; [key, label, 'color', default]; [key, label, [options], default].
const FX=[
  {id:'adjust',group:'Adjust',name:'Brightness, contrast, colour',params:[['br','Brightness',-1,1,.01,0],['co','Contrast',0,3,.01,1],['sa','Saturation',0,3,.01,1],['hu','Hue shift (°)',-180,180,1,0],['ga','Gamma',.2,3,.01,1],['ex','Exposure',-3,3,.05,0]],
    run:(c,p)=>PXFX.run(c,gl1('adjust',{...p,hu:p.hu*Math.PI/180}))},
  {id:'levels',group:'Adjust',name:'Levels',params:[['ib','Input black',0,1,.01,0],['iw','Input white',0,1,.01,1],['ga','Midtones',.2,3,.01,1],['ob','Output black',0,1,.01,0],['ow','Output white',0,1,.01,1]],run:(c,p)=>PXFX.run(c,gl1('levels',p))},
  {id:'posterize',group:'Adjust',name:'Posterize',params:[['n','Levels',2,16,1,4]],run:(c,p)=>PXFX.run(c,gl1('posterize',p))},
  {id:'threshold',group:'Adjust',name:'Threshold (1-bit)',params:[['th','Threshold',0,1,.01,.5],['ink','Ink','color','#16121f'],['paper','Paper','color','#ffffff']],run:(c,p)=>PXFX.run(c,gl1('threshold',{th:p.th,ink:rgb01(p.ink),paper:rgb01(p.paper)}))},
  {id:'invert',group:'Adjust',name:'Invert',params:[],run:c=>PXFX.run(c,gl1('invert',{}))},
  {id:'duotone',group:'Adjust',name:'Duotone / sepia / greyscale',params:[['da','Shadows','color','#2b1a10'],['li','Highlights','color','#f3e2c0'],['mx','Strength',0,1,.01,1]],run:(c,p)=>PXFX.run(c,gl1('duotone',{da:rgb01(p.da),li:rgb01(p.li),mx:p.mx}))},
  {id:'blur',group:'Blur & sharpen',name:'Gaussian blur',params:[['sig','Radius',.5,32,.5,3]],run:(c,p)=>PXFX.run(c,blurPasses(p.sig))},
  {id:'unsharp',group:'Blur & sharpen',name:'Sharpen (unsharp mask)',params:[['sig','Radius',.5,8,.5,1.5],['amt','Amount',0,4,.05,1],['thr','Threshold',0,.2,.005,0]],
    run:(c,p)=>PXFX.run(c,[...blurPasses(p.sig).map((x,i)=>i?x:{...x}),{name:'unsharp',fs:FS.unsharp,u:{amt:p.amt,thr:p.thr}}])},
  {id:'median',group:'Blur & sharpen',name:'Median (despeckle)',params:[['r','Radius',1,3,1,1]],run:(c,p)=>medianCPU(c,p.r)},
  {id:'pixelate',group:'Stylize',name:'Pixelate',params:[['cell','Cell size',2,64,1,8]],run:(c,p)=>PXFX.run(c,gl1('pixelate',p))},
  {id:'halftone',group:'Stylize',name:'Halftone',params:[['cell','Dot spacing',3,40,1,8],['ang','Screen angle (°)',0,90,1,45],['ink','Ink','color','#16121f'],['paper','Paper','color','#ffffff'],['keep','Background',['transparent','solid'],'solid']],
    run:(c,p)=>PXFX.run(c,gl1('halftone',{cell:p.cell,ang:p.ang*Math.PI/180,ink:rgb01(p.ink),paper:rgb01(p.paper),keep:p.keep==='solid'?1:0}))},
  {id:'edges',group:'Stylize',name:'Find edges',params:[['k','Strength',.5,8,.1,2],['ink','Lines','color','#16121f'],['paper','Paper','color','#ffffff']],run:(c,p)=>PXFX.run(c,gl1('edges',{k:p.k,ink:rgb01(p.ink),paper:rgb01(p.paper)}))},
  {id:'emboss',group:'Stylize',name:'Emboss',params:[['k','Strength',.5,8,.1,3]],run:(c,p)=>PXFX.run(c,gl1('emboss',p))},
  {id:'noise',group:'Stylize',name:'Grain',params:[['amt','Amount',0,1,.01,.2],['mono','Colour',['mono','colour'],'mono']],run:(c,p)=>PXFX.run(c,gl1('noise',{amt:p.amt,mono:p.mono==='mono'?1:0,seed:7}))},
  {id:'vignette',group:'Stylize',name:'Vignette',params:[['amt','Amount',0,1,.01,.5],['size','Size',0,1.2,.01,.5]],run:(c,p)=>PXFX.run(c,gl1('vignette',p))},
  {id:'rgbsplit',group:'Stylize',name:'RGB split (misprint)',params:[['off','Offset (px)',-30,30,1,4]],run:(c,p)=>PXFX.run(c,gl1('rgbsplit',p))},
  {id:'dither',group:'Colour & dither',name:'Palette + dither',params:[['pal','Palette',['1bit','gameboy','cga','riso','pico8','project','auto'],'riso'],['method','Dither',['none','floyd','atkinson','bayer'],'atkinson'],['colors','Colours (auto)',2,64,1,8]],run:(c,p)=>ditherCPU(c,p.pal,p.method,p.colors)},
  {id:'outline',group:'Stickers',name:'Sticker outline',params:[['width','Width (px)',1,40,1,6],['col','Colour','color','#ffffff']],run:(c,p)=>outlineCPU(c,p.width,p.col)},
  {id:'shadow',group:'Stickers',name:'Drop shadow',params:[['dx','Offset x',-40,40,1,6],['dy','Offset y',-40,40,1,6],['sig','Softness',0,20,.5,4],['op','Opacity',0,1,.01,.5],['col','Colour','color','#000000']],run:(c,p)=>shadowCPU(c,p.dx,p.dy,p.sig,p.op,p.col)},
  {id:'removebg',group:'Stickers',name:'Remove background',params:[['tol','Tolerance',0,120,1,24]],run:(c,p)=>removeBgCPU(c,p.tol)},
];


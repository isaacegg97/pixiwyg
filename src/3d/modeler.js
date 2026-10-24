// SECTION: building with shapes
// RULE: a model can be built from parts: box, sphere, half sphere, cylinder, tube, cone, pyramid, torus, wedge, star,
//   3D text, a model opened earlier, or a group of parts. Each part is moved, turned and sized, coloured, and either
//   adds to what's above it in the list, cuts itself away from it, or keeps only where they overlap. The parts
//   combine into the one mesh the workspace already bakes, paints and places, so nothing downstream changes.
// RULE: cuts and overlaps use csg.js (lib/csg.js, MIT) and 3D text uses earcut (lib/earcut.js, ISC) to fill its
//   letters; each loads the first time it's needed. Adds alone just join.
// FORMAT: m3d.scene = {parts: [part], sel: index of the picked part, picked: [ids] (the selection, sel's first),
//   mm: millimetres per unit}. part = {id, kind, name, op: 'add'|'cut'|'keep', color '#hex', pos [x,y,z],
//   rot [x,y,z] degrees, size [x,y,z], seg (smoothness, or a star's points), hole (a tube's wall, 0..1), text, font,
//   hidden, geo (kind 'model': {pos, tri, col} as base64 typed arrays), parts (kind 'group': its parts, in the
//   group's own space)}. World is z up; the floor is z = 0; a fresh part is one unit (20 mm) each way.
const M3D_KINDS=[['box','Box'],['sphere','Sphere'],['dome','Half sphere'],['cylinder','Cylinder'],['tube','Tube'],['cone','Cone'],['pyramid','Pyramid'],['torus','Torus'],['wedge','Wedge'],['star','Star'],['text','Text']];
const M3D_ROUND=new Set(['sphere','dome','cylinder','tube','cone','torus','star']);
const M3D_OPS=[['add','Add'],['cut','Cut away'],['keep','Keep overlap']];
const M3D_FONTS=[['Rubik Mono One','Rubik Mono'],['Fraunces','Fraunces'],['Pixelify Sans','Pixelify'],['Press Start 2P','Press Start'],['Neucha','Neucha'],['Arial Black','Arial Black'],['Georgia','Georgia'],['sans-serif','Plain sans']];
const M3D_SNAPS=[[0,'Off'],[.5,'0.5 mm'],[1,'1 mm'],[2,'2 mm'],[5,'5 mm'],[10,'10 mm']];
const libScript=(name,glob)=>{const P={};return()=>window[glob]?Promise.resolve():(P.p||(P.p=new Promise((res,rej)=>{const s=document.createElement('script');s.src='lib/'+name;s.onload=()=>res();s.onerror=()=>{P.p=null;rej(new Error(`lib/${name} could not be loaded`))};document.head.append(s)})))};
const needCsg=libScript('csg.js','CSG'),needEarcut=libScript('earcut.js','earcut');

// SECTION: shapes (unit size, centred on the origin, outward-facing counter-clockwise triangles)
function shapeTris(kind,seg,hole){
  const T=[],q=(a,b,c,d)=>{T.push([a,b,c],[a,c,d])},S=Math.max(3,Math.min(64,seg|0||24)),ring=(r,z,n=S,o=0)=>Array.from({length:n},(_,j)=>{const a=(j+o)/n*Math.PI*2;return[r*Math.cos(a),r*Math.sin(a),z]});
  const prism=pts=>{const b=pts.map(([x,y])=>[x,y,-.5]),t=pts.map(([x,y])=>[x,y,.5]),n=pts.length;for(let j=0;j<n;j++){const k=(j+1)%n;q(b[j],b[k],t[k],t[j]);T.push([[0,0,.5],t[j],t[k]],[[0,0,-.5],b[k],b[j]])}};
  if(kind==='box'){const C=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]].map(([x,y,z])=>[x-.5,y-.5,z-.5]);
    q(C[0],C[3],C[2],C[1]);q(C[4],C[5],C[6],C[7]);q(C[0],C[1],C[5],C[4]);q(C[1],C[2],C[6],C[5]);q(C[2],C[3],C[7],C[6]);q(C[3],C[0],C[4],C[7])}
  else if(kind==='sphere'){const R=Math.max(3,S>>1),P=(i,j)=>{const t=i/R*Math.PI,f=j/S*Math.PI*2;return[.5*Math.sin(t)*Math.cos(f),.5*Math.sin(t)*Math.sin(f),.5*Math.cos(t)]};
    for(let i=0;i<R;i++)for(let j=0;j<S;j++)q(P(i,j),P(i+1,j),P(i+1,j+1),P(i,j+1))}
  else if(kind==='dome'){const R=Math.max(2,S>>2),P=(i,j)=>{const t=i/R*Math.PI/2,f=j/S*Math.PI*2;return[.5*Math.sin(t)*Math.cos(f),.5*Math.sin(t)*Math.sin(f),Math.cos(t)-.5]};
    for(let i=0;i<R;i++)for(let j=0;j<S;j++)q(P(i,j),P(i+1,j),P(i+1,j+1),P(i,j+1));for(let j=0;j<S;j++)T.push([[0,0,-.5],P(R,j+1),P(R,j)])}
  else if(kind==='cylinder')prism(ring(.5,0).map(([x,y])=>[x,y]));
  else if(kind==='tube'){const r=.5*(1-Math.max(.05,Math.min(.95,hole??.3))),ob=ring(.5,-.5),ot=ring(.5,.5),ib=ring(r,-.5),it=ring(r,.5);
    for(let j=0;j<S;j++){const k=(j+1)%S;q(ob[j],ob[k],ot[k],ot[j]);q(ib[k],ib[j],it[j],it[k]);q(ot[j],ot[k],it[k],it[j]);q(ib[j],ib[k],ob[k],ob[j])}}
  else if(kind==='cone'||kind==='pyramid'){const n=kind==='pyramid'?4:S,b=ring(kind==='pyramid'?Math.SQRT1_2:.5,-.5,n,kind==='pyramid'?.5:0);
    for(let j=0;j<n;j++){const k=(j+1)%n;T.push([b[j],b[k],[0,0,.5]],[[0,0,-.5],b[k],b[j]])}}
  else if(kind==='torus'){const M=Math.max(3,S>>1),P=(i,j)=>{const u=i/S*Math.PI*2,v=j/M*Math.PI*2,r=.35+.15*Math.cos(v);return[r*Math.cos(u),r*Math.sin(u),.15*Math.sin(v)]};
    for(let i=0;i<S;i++)for(let j=0;j<M;j++)q(P(i,j),P(i+1,j),P(i+1,j+1),P(i,j+1))}
  else if(kind==='wedge'){const A=[-.5,-.5,-.5],B=[.5,-.5,-.5],C=[.5,.5,-.5],D=[-.5,.5,-.5],E=[-.5,-.5,.5],F=[-.5,.5,.5];
    q(A,D,C,B);q(D,A,E,F);q(B,C,F,E);T.push([A,B,E],[D,F,C])}
  else if(kind==='star'){const n=Math.max(3,Math.min(12,seg|0||5)),pts=[];for(let j=0;j<n*2;j++){const a=Math.PI/2+j/(n*2)*Math.PI*2,r=j%2?.2:.5;pts.push([r*Math.cos(a),r*Math.sin(a)])}prism(pts)}
  return T;
}

// SECTION: 3D text
// RULE: letters are drawn in the chosen font, traced along their outlines, simplified, filled with earcut (holes
//   kept: the counters of o, a, e) and given walls, so text is a closed solid that adds, cuts and keeps like any part.
// FORMAT: text lies flat on the floor (letters in x/y, thickness in z), normalised to the unit box; aspect is its
//   width over height, so a fresh text part is as wide as its words.
const textCache=new Map();
function traceLoops(grid,w,h){
  const out=new Map(),key=(x,y)=>y*(w+1)+x,on=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&grid[y*w+x];
  const add=(x0,y0,x1,y1)=>{const k=key(x0,y0);if(!out.has(k))out.set(k,[]);out.get(k).push([x1,y1])};
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){if(!on(x,y))continue;
    if(!on(x,y-1))add(x,y,x+1,y);if(!on(x+1,y))add(x+1,y,x+1,y+1);if(!on(x,y+1))add(x+1,y+1,x,y+1);if(!on(x-1,y))add(x,y+1,x,y)}
  const loops=[];
  for(const [k,list] of out)while(list.length){let [x,y]=[k%(w+1),(k/(w+1))|0];const loop=[[x,y]];let nx=list.pop();
    for(let guard=0;guard<1e6;guard++){[x,y]=nx;if(key(x,y)===k)break;loop.push([x,y]);const l=out.get(key(x,y));if(!l||!l.length)break;nx=l.pop()}
    if(loop.length>2)loops.push(loop)}
  return loops;
}
function simplify(pts,eps){
  if(pts.length<5)return pts;const keep=new Uint8Array(pts.length);keep[0]=1;keep[pts.length-1]=1;
  const st=[[0,pts.length-1]];while(st.length){const [a,b]=st.pop();let md=0,mi=-1;const [ax,ay]=pts[a],[bx,by]=pts[b],L=Math.hypot(bx-ax,by-ay)||1;
    for(let i=a+1;i<b;i++){const d=Math.abs((bx-ax)*(ay-pts[i][1])-(ax-pts[i][0])*(by-ay))/L;if(d>md){md=d;mi=i}}
    if(md>eps){keep[mi]=1;st.push([a,mi],[mi,b])}}
  return pts.filter((_,i)=>keep[i]);
}
// RULE: a closed loop is simplified as two open halves, split at the point farthest from its start.
function simplifyLoop(l,eps){let far=0,fd=-1;for(let i=1;i<l.length;i++){const d=Math.hypot(l[i][0]-l[0][0],l[i][1]-l[0][1]);if(d>fd){fd=d;far=i}}
  return[...simplify(l.slice(0,far+1),eps).slice(0,-1),...simplify([...l.slice(far),l[0]],eps).slice(0,-1)]}
const loopArea=l=>{let s=0;for(let i=0;i<l.length;i++){const a=l[i],b=l[(i+1)%l.length];s+=a[0]*b[1]-b[0]*a[1]}return s/2};
const inLoop=(p,l)=>{let c=false;for(let i=0,j=l.length-1;i<l.length;j=i++){const a=l[i],b=l[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c}return c};
async function textSolid(text,font){
  const k=font+'\u0000'+text;if(textCache.has(k))return textCache.get(k);
  await needEarcut();const px=120,f=`700 ${px}px "${font}", sans-serif`;try{await document.fonts.load(f,text)}catch(e){}
  const c=imgCanvas(8,8),g=c.getContext('2d',{willReadFrequently:true});g.font=f;const w=Math.max(8,Math.ceil(g.measureText(text).width)+16),h=Math.round(px*1.4);
  c.width=w;c.height=h;g.font=f;g.textBaseline='alphabetic';g.fillText(text,8,Math.round(px*1.05));
  const d=g.getImageData(0,0,w,h).data,grid=new Uint8Array(w*h);for(let y=0;y<h;y++)for(let x=0;x<w;x++)grid[(h-1-y)*w+x]=d[(y*w+x)*4+3]>127?1:0;
  let loops=traceLoops(grid,w,h).map(l=>simplifyLoop(l,.8)).filter(l=>l.length>2&&Math.abs(loopArea(l))>2);
  if(!loops.length){const r={tris:[],aspect:1};textCache.set(k,r);return r}
  let lo=[1e9,1e9],hi=[-1e9,-1e9];for(const l of loops)for(const [x,y] of l){lo=[Math.min(lo[0],x),Math.min(lo[1],y)];hi=[Math.max(hi[0],x),Math.max(hi[1],y)]}
  const sx=hi[0]-lo[0],sy=hi[1]-lo[1],N=([x,y])=>[(x-lo[0])/sx-.5,(y-lo[1])/sy-.5];
  const outer=loops.filter(l=>loopArea(l)>0),holes=loops.filter(l=>loopArea(l)<0),T=[];
  const owner=holes.map(hl=>outer.filter(o=>inLoop(hl[0],o)).sort((a,b)=>loopArea(a)-loopArea(b))[0]);
  for(const o of outer){const hs=holes.filter((_,i)=>owner[i]===o),pts=[o,...hs].map(l=>l.map(N)),flat=[],hidx=[];
    for(const l of pts){if(flat.length)hidx.push(flat.length/2);for(const [x,y] of l)flat.push(x,y)}
    const idx=earcut(flat,hidx),P=i=>[flat[i*2],flat[i*2+1]];
    for(let i=0;i<idx.length;i+=3){const a=P(idx[i]),b=P(idx[i+1]),cc=P(idx[i+2]),ccw=(b[0]-a[0])*(cc[1]-a[1])-(b[1]-a[1])*(cc[0]-a[0])>0;
      const [A,B,C]=ccw?[a,b,cc]:[a,cc,b];T.push([[...A,.5],[...B,.5],[...C,.5]],[[...A,-.5],[...C,-.5],[...B,-.5]])}}
  for(const l of loops){const n=l.map(N);for(let i=0;i<n.length;i++){const a=n[i],b=n[(i+1)%n.length];T.push([[...a,-.5],[...b,-.5],[...b,.5]],[[...a,-.5],[...b,.5],[...a,.5]])}}
  const r={tris:T,aspect:sx/sy};textCache.set(k,r);while(textCache.size>40)textCache.delete(textCache.keys().next().value);return r;
}

// SECTION: placing parts in the world
const hexRgb01=h=>/^#[0-9a-f]{6}$/i.test(h)?[1,3,5].map(k=>parseInt(h.slice(k,k+2),16)/255):[.78,.72,.6];
// INVARIANT: rotation turns about x, then y, then z (R = Rz Ry Rx); eulerOf inverts rotMat.
function rotMat(rot){const [rx,ry,rz]=rot.map(d=>d*Math.PI/180),[cx,sx]=[Math.cos(rx),Math.sin(rx)],[cy,sy]=[Math.cos(ry),Math.sin(ry)],[cz,sz]=[Math.cos(rz),Math.sin(rz)];
  return[[cy*cz,sx*sy*cz-cx*sz,cx*sy*cz+sx*sz],[cy*sz,sx*sy*sz+cx*cz,cx*sy*sz-sx*cz],[-sy,sx*cy,cx*cy]]}
function eulerOf(R){const sy=-R[2][0],cy=Math.hypot(R[0][0],R[1][0]),d=180/Math.PI;
  return cy>1e-6?[Math.atan2(R[2][1],R[2][2])*d,Math.atan2(sy,cy)*d,Math.atan2(R[1][0],R[0][0])*d]:[Math.atan2(-R[1][2],R[1][1])*d,Math.atan2(sy,cy)*d,0]}
const mulM=(A,B)=>A.map(r=>[0,1,2].map(j=>r[0]*B[0][j]+r[1]*B[1][j]+r[2]*B[2][j])),mulV=(A,v)=>A.map(r=>r[0]*v[0]+r[1]*v[1]+r[2]*v[2]);
// INVARIANT: size scales, then rotation turns, then position moves; sizes stay positive so triangles keep facing out.
function partMatrix(p){const R=rotMat(p.rot);return v=>{const w=mulV(R,[v[0]*p.size[0],v[1]*p.size[1],v[2]*p.size[2]]);return[w[0]+p.pos[0],w[1]+p.pos[1],w[2]+p.pos[2]]}}
const b64f32=s=>{const b=b64bytes(s);return new Float32Array(b.buffer.slice(b.byteOffset,b.byteOffset+(b.length>>2<<2)))},b64u32=s=>{const b=b64bytes(s);return new Uint32Array(b.buffer.slice(b.byteOffset,b.byteOffset+(b.length>>2<<2)))};
const typedB64=a=>bytesB64(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));
const triArea2=([a,b,c])=>{const ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2];return Math.hypot(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)};
// FORMAT: m3dBounds: part id -> [lo, hi], the part's box in its own space before its size; shapes and text are the unit box.
const m3dBounds=new Map(),UNIT=[[-.5,-.5,-.5],[.5,.5,.5]];
const localBox=p=>(p.kind==='model'||p.kind==='group')&&m3dBounds.get(p.id)||UNIT;
function boundsOf(tris){let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];for(const [t] of tris)for(const v of t)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],v[k]);hi[k]=Math.max(hi[k],v[k])}return lo[0]>hi[0]?UNIT:[lo,hi]}
// FORMAT: a part's own triangles, [[a,b,c], rgb], in its own space before its size.
async function partLocal(p){
  const c=hexRgb01(p.color);let out;
  if(p.kind==='model'&&p.geo){const P=b64f32(p.geo.pos),I=b64u32(p.geo.tri),C=p.geo.col?b64f32(p.geo.col):null;out=[];
    for(let t=0;t<I.length/3;t++){const v=k=>{const i=I[t*3+k]*3;return[P[i],P[i+1],P[i+2]]};out.push([[v(0),v(1),v(2)],C?[C[t*9],C[t*9+1],C[t*9+2]]:c])}}
  else if(p.kind==='group')out=(await solidOf(p.parts||[],false)).map(([t,col])=>[t,col]);
  else if(p.kind==='text')out=(await textSolid(p.text||'Text',p.font||M3D_FONTS[0][0])).tris.map(t=>[t,c]);
  else out=shapeTris(p.kind,p.seg,p.hole).map(t=>[t,c]);
  if(p.kind==='model'||p.kind==='group')m3dBounds.set(p.id,boundsOf(out));
  return out;
}
async function partWorld(p){const M=partMatrix(p);return(await partLocal(p)).map(([t,c])=>[t.map(M),c])}
// FORMAT: parts combined in list order into [[a,b,c], rgb, top-level index]; a group combines its own first.
async function solidOf(parts,withIdx){
  const list=parts.map((p,i)=>[p,i]).filter(([p])=>!p.hidden),out=[];
  if(!list.some(([p])=>p.op!=='add')){for(const [p,i] of list)for(const [t,c] of await partWorld(p))if(triArea2(t)>1e-12)out.push([t,c,i]);return out}
  await needCsg();const V=a=>new CSG.Vector(a[0],a[1],a[2]);let acc=null;
  for(const [p,i] of list){
    const polys=[];for(const [t,c] of await partWorld(p)){if(triArea2(t)<=1e-12)continue;const n=V(t[1]).minus(V(t[0])).cross(V(t[2]).minus(V(t[0]))).unit();polys.push(new CSG.Polygon(t.map(v=>new CSG.Vertex(V(v),n)),{c,i}))}
    const s=CSG.fromPolygons(polys);
    // RULE: a cut or overlap at the top of the list has nothing to work on yet, so it is skipped.
    acc=!acc?(p.op==='add'?s:null):p.op==='add'?acc.union(s):p.op==='cut'?acc.subtract(s):acc.intersect(s);
  }
  for(const poly of acc?acc.polygons:[]){const vs=poly.vertices.map(v=>[v.pos.x,v.pos.y,v.pos.z]);for(let k=1;k<vs.length-1;k++){const t=[vs[0],vs[k],vs[k+1]];if(triArea2(t)>1e-12)out.push([t,poly.shared.c,poly.shared.i])}}
  return out;
}
// FORMAT: returns the mesh the bake takes ({pos, tri, col}) plus part: Uint16Array, which top-level part each triangle came from.
async function m3dSceneMesh(sc){
  const tris=await solidOf(sc.parts,true),nt=tris.length;m3dLimit(nt);
  const pos=new Float32Array(nt*9),col=new Float32Array(nt*9),part=new Uint16Array(nt);
  tris.forEach(([t,c,i],k)=>{for(let j=0;j<3;j++){pos.set(t[j],k*9+j*3);col.set(c,k*9+j*3)}part[k]=i});
  return{pos,col,tri:Uint32Array.from({length:nt*3},(_,k)=>k),part};
}

// SECTION: storing a built model
// FORMAT: a built model is stored as OBJ text, z up, with vertex colours ("v x y z r g b", which other tools read),
//   and its parts as "#px3d-scene <base64 JSON>" comment lines, so it opens again as parts here and as a plain mesh
//   anywhere else.
function m3dSceneOBJ(mesh,sc){
  const key=new Map(),lines=['# Built in PIXIWYG from shapes (z up). The #px3d-scene line keeps the parts.'],idx=[];
  for(let i=0;i<mesh.pos.length/3;i++){const k=[0,1,2].map(j=>mesh.pos[i*3+j].toFixed(4)).join(' ')+' '+[0,1,2].map(j=>mesh.col[i*3+j].toFixed(3)).join(' ');
    let n=key.get(k);if(n===undefined){key.set(k,n=key.size+1);lines.push('v '+k)}idx.push(n)}
  for(let t=0;t<idx.length;t+=3)lines.push(`f ${idx[t]} ${idx[t+1]} ${idx[t+2]}`);
  const {picked:_p,...keep}=sc;lines.push('#px3d-scene '+bytesB64(te.encode(JSON.stringify({v:2,...keep}))));
  return lines.join('\n')+'\n';
}
// FORMAT: binary STL in millimetres (sc.mm per unit), z up, for slicers and 3D printing.
function m3dSceneSTL(mesh,mm){
  const n=mesh.tri.length/3,b=new ArrayBuffer(84+n*50),dv=new DataView(b);new Uint8Array(b).set(te.encode('PIXIWYG shapes, millimetres, z up').subarray(0,80));dv.setUint32(80,n,true);
  const p=mesh.pos;for(let t=0;t<n;t++){const o=84+t*50,a=t*9,ux=p[a+3]-p[a],uy=p[a+4]-p[a+1],uz=p[a+5]-p[a+2],vx=p[a+6]-p[a],vy=p[a+7]-p[a+1],vz=p[a+8]-p[a+2];
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;const l=Math.hypot(nx,ny,nz)||1;nx/=l;ny/=l;nz/=l;
    [nx,ny,nz].forEach((v,j)=>dv.setFloat32(o+j*4,v,true));for(let j=0;j<9;j++)dv.setFloat32(o+12+j*4,p[a+j]*mm,true)}
  return new Uint8Array(b);
}
// SAFETY: parts from a file are rebuilt from known kinds and ranges, four groups deep and 128 parts at most; model
//   geometry must be whole typed arrays whose indices stay inside the vertex list, under the triangle limit.
function cleanScene(x){
  if(!x||!Array.isArray(x.parts))return null;let budget=128;const n=(v,a,b,d)=>{v=+v;return Number.isFinite(v)?Math.max(a,Math.min(b,v)):d},v3=(v,a,b,d)=>[0,1,2].map(i=>n(Array.isArray(v)?v[i]:NaN,a,b,d));
  const parts=(list,depth)=>{const out=[];for(const p of list.slice(0,64)){if(!p||typeof p!=='object'||budget--<=0)continue;
    const kind=p.kind==='model'||p.kind==='group'||M3D_KINDS.some(k=>k[0]===p.kind)?p.kind:null;if(!kind)continue;
    const q={id:nid('p'),kind,name:String(p.name||kind).slice(0,40),op:M3D_OPS.some(o=>o[0]===p.op)?p.op:'add',color:/^#[0-9a-f]{6}$/i.test(p.color)?p.color:'#c8b89a',
      pos:v3(p.pos,-50,50,0),rot:v3(p.rot,-360,360,0),size:v3(p.size,.01,50,1),seg:Math.round(n(p.seg,3,64,kind==='star'?5:24)),hidden:!!p.hidden};
    if(kind==='tube')q.hole=n(p.hole,.05,.95,.3);
    if(kind==='text'){q.text=String(p.text??'Text').replace(/[\u0000-\u001f]/g,'').slice(0,60)||'Text';q.font=M3D_FONTS.some(f=>f[0]===p.font)?p.font:M3D_FONTS[0][0]}
    if(kind==='group'){if(depth>=4||!Array.isArray(p.parts))continue;q.parts=parts(p.parts,depth+1);if(!q.parts.length)continue}
    if(kind==='model'){const g=p.geo;try{const P=b64f32(g.pos),I=b64u32(g.tri),C=g.col?b64f32(g.col):null;
      if(!P.length||P.length%3||I.length%3||I.length/3>M3D_MAX_TRIS||I.some(i=>i>=P.length/3)||(C&&C.length!==I.length*3))continue;
      q.geo={pos:g.pos,tri:g.tri,...(C?{col:g.col}:{})}}catch(e){continue}}
    out.push(q)}return out};
  const list=parts(x.parts,0);if(!list.length)return null;const sel=Math.max(0,Math.min(list.length-1,x.sel|0));
  return{parts:list,sel,picked:[list[sel].id],mm:n(x.mm,1,1000,20)};
}
function m3dSceneFromSrc(src){
  const m=/^data:model\/obj;base64,(.*)$/.exec(src||'');if(!m)return null;
  const s=/^#px3d-scene ([A-Za-z0-9+/=]+)\s*$/m.exec(new TextDecoder().decode(b64bytes(m[1])));if(!s)return null;
  try{return cleanScene(JSON.parse(new TextDecoder().decode(b64bytes(s[1]))))}catch(e){return null}
}
const m3dPart=(kind,o={})=>({id:nid('p'),kind,name:(M3D_KINDS.find(k=>k[0]===kind)||[,kind])[1],op:'add',color:'#c8b89a',pos:[0,0,.5],rot:[0,0,0],size:[1,1,1],seg:kind==='star'?5:24,hidden:false,
  ...(kind==='tube'?{hole:.3}:{}),...(kind==='text'?{text:'Text',font:M3D_FONTS[0][0]}:{}),...o});
// FORMAT: an opened model becomes a part as it was baked: normalised, z up, one unit tall, standing on the floor.
function m3dModelPart(mesh,opt){
  const m=m3dNormalize(mesh,opt.up),nt=m.tri.length/3;let col=null;
  if(m.col){col=new Float32Array(nt*9);col.set(m.col.subarray(0,nt*9))}
  return m3dPart('model',{name:m3d.name||'Model',pos:[0,0,0],color:opt.color,geo:{pos:typedB64(Float32Array.from(m.pos)),tri:typedB64(Uint32Array.from(m.tri)),...(col?{col:typedB64(col)}:{})}});
}
// FORMAT: a world-space triangle list as a model part that sits exactly where it is (identity transform).
function trisPart(tris,name){const nt=tris.length,P=new Float32Array(nt*9),C=new Float32Array(nt*9);tris.forEach(([t,c],k)=>{for(let j=0;j<3;j++){P.set(t[j],k*9+j*3);C.set(c,k*9+j*3)}});
  return m3dPart('model',{name,pos:[0,0,0],geo:{pos:typedB64(P),tri:typedB64(Uint32Array.from({length:nt*3},(_,k)=>k)),col:typedB64(C)}})}

// SECTION: the build viewport
// RULE: the same light as the bake (fixed to the camera, key upper left), orthographic like the bake, so what is
//   built looks like what gets placed. The picked part shows handles: a square on each bottom edge and on top resizes it from the
//   opposite side (Shift: all sides in proportion), a ring round each axis turns it about its centre (15° steps,
//   Shift: free), the cone on top lifts it. Dragging the part slides it along the floor; the snap setting rounds
//   moves and sizes; the ruler reads its size in millimetres. Drag elsewhere turns the view; the wheel zooms.
const vp={az:-35,el:24,zoom:1,pid:null,W:0,H:0,s:1,k:1,basis:null,cache:null,handles:[],snap:1};
function vpBasis(){const az=vp.az*Math.PI/180,el=vp.el*Math.PI/180,ce=Math.cos(el),se=Math.sin(el);
  return{c:[ce*Math.cos(az),ce*Math.sin(az),se],r:[Math.sin(az),-Math.cos(az),0],u:[-se*Math.cos(az),-se*Math.sin(az),ce],t:[0,0,.5]}}
function vpProject(B,v){const x=v[0]-B.t[0],y=v[1]-B.t[1],z=v[2]-B.t[2];return[(x*B.r[0]+y*B.r[1])*vp.s+vp.W/2,vp.H/2-(x*B.u[0]+y*B.u[1]+z*B.u[2])*vp.s,-(x*B.c[0]+y*B.c[1]+z*B.c[2])]}
// FORMAT: a screen point (device px) as the world point on the horizontal plane z = z0; null when the view is too flat.
function vpFloor(B,X,Y,z0){const a=(X-vp.W/2)/vp.s,b=(vp.H/2-Y)/vp.s,P=[0,1,2].map(k=>B.t[k]+B.r[k]*a+B.u[k]*b);if(Math.abs(B.c[2])<.12)return null;const l=(z0-P[2])/B.c[2];return[P[0]+B.c[0]*l,P[1]+B.c[1]*l,z0]}
function vpMesh(){
  if(m3d.scene)return m3d.smesh;if(!m3d.mesh)return null;
  if(!vp.cache||vp.cache.src!==m3d.mesh||vp.cache.up!==m3d.opt.up){const m=m3dNormalize(m3d.mesh,m3d.opt.up);vp.cache={src:m3d.mesh,up:m3d.opt.up,m:{...m,col:m.col}}}
  return vp.cache.m;
}
const scMM=()=>(m3d.scene&&m3d.scene.mm)||20,snapU=()=>vp.snap/scMM();
const roundTo=(v,st)=>st>0?Math.round(v/st)*st:v;
function picked(){const sc=m3d.scene;if(!sc)return[];const ids=new Set(sc.picked||[]);const out=sc.parts.filter(p=>ids.has(p.id));return out.length?out:[sc.parts[sc.sel]].filter(Boolean)}
function m3dRenderVP(){
  const cv=$('#m3dEdit');if(!cv||!cv.isConnected||$('#m3dModal').hidden)return;
  const k=Math.min(1.5,devicePixelRatio||1),W=Math.max(80,Math.round(cv.clientWidth*k)),H=Math.max(80,Math.round(cv.clientHeight*k));
  if(cv.width!==W||cv.height!==H){cv.width=W;cv.height=H}vp.W=W;vp.H=H;vp.s=Math.min(W,H)/(3.2/vp.zoom);vp.k=k;
  const g=cv.getContext('2d'),B=vpBasis(),cs=getComputedStyle(cv),ink=cs.getPropertyValue('--ink').trim()||'#16121f',sel=cs.getPropertyValue('--sel').trim()||'#2e5bff';vp.basis=B;vp.handles=[];
  g.clearRect(0,0,W,H);g.lineWidth=1;
  // SECTION: floor grid (every quarter unit, the centre lines stronger)
  for(let i=-8;i<=8;i++){const a=i/4;g.strokeStyle=i===0?ink:'rgba(128,128,128,.28)';g.globalAlpha=i===0?.45:1;
    for(const [p,q] of [[[a,-2,0],[a,2,0]],[[-2,a,0],[2,a,0]]]){const P=vpProject(B,p),Q=vpProject(B,q);g.beginPath();g.moveTo(P[0],P[1]);g.lineTo(Q[0],Q[1]);g.stroke()}}
  g.globalAlpha=1;
  const m=vpMesh(),sc=m3d.scene,pickIdx=new Set(sc?picked().map(p=>sc.parts.indexOf(p)):[]);vp.pid=new Int16Array(W*H).fill(-1);
  if(m&&m.tri.length){
    const img=g.createImageData(W,H),zb=new Float32Array(W*H).fill(1e9),d=img.data,p=m.pos,T=m.tri,nt=T.length/3,base=hexRgb01(m3d.opt.color),SC=/^#[0-9a-f]{6}$/i.test(sel)?hexRgb01(sel).map(v=>v*255):[46,91,255];
    let Lx=-.45,Ly=.6,Lz=.65;{const l=Math.hypot(Lx,Ly,Lz);Lx/=l;Ly/=l;Lz/=l}
    const P=new Float32Array(p.length);for(let i=0;i<p.length/3;i++){const q=vpProject(B,[p[i*3],p[i*3+1],p[i*3+2]]);P[i*3]=q[0];P[i*3+1]=q[1];P[i*3+2]=q[2]}
    for(let t=0;t<nt;t++){
      const a=T[t*3],b=T[t*3+1],c=T[t*3+2],ax=P[a*3],ay=P[a*3+1],bx=P[b*3],by=P[b*3+1],qx=P[c*3],qy=P[c*3+1];
      const area=(bx-ax)*(qy-ay)-(by-ay)*(qx-ax);if(Math.abs(area)<1e-9)continue;
      const ux=p[b*3]-p[a*3],uy=p[b*3+1]-p[a*3+1],uz=p[b*3+2]-p[a*3+2],wx=p[c*3]-p[a*3],wy=p[c*3+1]-p[a*3+1],wz=p[c*3+2]-p[a*3+2];
      let nx=uy*wz-uz*wy,ny=uz*wx-ux*wz,nz=ux*wy-uy*wx;let vx=nx*B.r[0]+ny*B.r[1],vy=nx*B.u[0]+ny*B.u[1]+nz*B.u[2],vz=nx*B.c[0]+ny*B.c[1]+nz*B.c[2];
      const l=Math.hypot(vx,vy,vz)||1;vx/=l;vy/=l;vz/=l;if(vz<0){vx=-vx;vy=-vy;vz=-vz}
      const lit=.3+.78*Math.max(0,vx*Lx+vy*Ly+vz*Lz),pi=m.part?m.part[t]:0,mc=m.col,hi=m.part&&pickIdx.has(pi);
      const col=mc?[(mc[t*9]+mc[t*9+3]+mc[t*9+6])/3,(mc[t*9+1]+mc[t*9+4]+mc[t*9+7])/3,(mc[t*9+2]+mc[t*9+5]+mc[t*9+8])/3]:base;
      let r=Math.min(255,col[0]*lit*255),gg=Math.min(255,col[1]*lit*255),bb=Math.min(255,col[2]*lit*255);
      // RULE: picked parts are tinted toward the selection colour as well as boxed, so they read at a glance.
      if(hi){r=(r*3+SC[0])/4;gg=(gg*3+SC[1])/4;bb=(bb*3+SC[2])/4}
      const x0=Math.max(0,Math.floor(Math.min(ax,bx,qx))),x1=Math.min(W-1,Math.ceil(Math.max(ax,bx,qx))),y0=Math.max(0,Math.floor(Math.min(ay,by,qy))),y1=Math.min(H-1,Math.ceil(Math.max(ay,by,qy)));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const px=x+.5,py=y+.5,w0=((bx-px)*(qy-py)-(by-py)*(qx-px))/area,w1=((qx-px)*(ay-py)-(qy-py)*(ax-px))/area,w2=1-w0-w1;
        if(w0<0||w1<0||w2<0)continue;const dz=w0*P[a*3+2]+w1*P[b*3+2]+w2*P[c*3+2],i=y*W+x;if(dz>=zb[i])continue;zb[i]=dz;vp.pid[i]=pi;
        const o=i*4;d[o]=r;d[o+1]=gg;d[o+2]=bb;d[o+3]=255}
    }
    const off=imgCanvas(W,H);off.getContext('2d').putImageData(img,0,0);g.drawImage(off,0,0);
  }
  if(sc)vpOverlay(g,B,k,ink,sel);
  const o=[34*k,H-34*k];g.font=`bold ${Math.round(11*k)}px sans-serif`;g.lineWidth=2;
  for(const [v,c,name] of [[[1,0,0],'#d33','x'],[[0,1,0],'#2a2','y'],[[0,0,1],'#36f','z']]){const P=vpProject(B,[B.t[0]+v[0]*24*k/vp.s,B.t[1]+v[1]*24*k/vp.s,B.t[2]+v[2]*24*k/vp.s]),dx=P[0]-W/2,dy=P[1]-H/2;
    g.strokeStyle=c;g.beginPath();g.moveTo(o[0],o[1]);g.lineTo(o[0]+dx,o[1]+dy);g.stroke();g.fillStyle=c;g.fillText(name,o[0]+dx*1.25-3,o[1]+dy*1.25+4)}
}
// SECTION: boxes, handles and the ruler over the view
function partFrame(p){const M=partMatrix(p),[lo,hi]=localBox(p),mid=[0,1,2].map(i=>(lo[i]+hi[i])/2),R=rotMat(p.rot);return{M,lo,hi,mid,R,axis:a=>{const v=[0,0,0];v[a]=1;return mulV(R,v)}}}
function vpOverlay(g,B,k,ink,sel){
  const ps=picked().filter(p=>!p.hidden),mm=scMM();g.lineWidth=1.5*k;g.strokeStyle=sel;g.setLineDash([5*k,4*k]);
  for(const p of ps){const F=partFrame(p),C=[0,1,2,3,4,5,6,7].map(i=>vpProject(B,F.M([i&1?F.hi[0]:F.lo[0],i&2?F.hi[1]:F.lo[1],i&4?F.hi[2]:F.lo[2]])));
    g.beginPath();for(const [i,j] of [[0,1],[1,3],[3,2],[2,0],[4,5],[5,7],[7,6],[6,4],[0,4],[1,5],[2,6],[3,7]]){g.moveTo(C[i][0],C[i][1]);g.lineTo(C[j][0],C[j][1])}g.stroke()}
  g.setLineDash([]);if(ps.length!==1)return;
  const p=ps[0],F=partFrame(p),ctr=F.M(F.mid),half=[0,1,2].map(i=>(F.hi[i]-F.lo[i])/2*p.size[i]),rw=Math.hypot(...half)*1.12;
  // SECTION: turning rings, one per world axis, labelled
  const axC=['#d33','#2a2','#36f'];
  // RULE: a ring seen edge-on is a line through the part, too thin to drag, so it isn't drawn.
  for(let a=0;a<3;a++){const e=[0,0,0];e[a]=1;if(Math.abs(B.c[a])<.22)continue;const U=a===2?[1,0,0]:[0,0,1],V=[e[1]*U[2]-e[2]*U[1],e[2]*U[0]-e[0]*U[2],e[0]*U[1]-e[1]*U[0]],U2=[V[1]*e[2]-V[2]*e[1],V[2]*e[0]-V[0]*e[2],V[0]*e[1]-V[1]*e[0]];
    const pts=[];for(let i=0;i<=48;i++){const t=i/48*Math.PI*2;pts.push(vpProject(B,[0,1,2].map(j=>ctr[j]+rw*(Math.cos(t)*U2[j]+Math.sin(t)*V[j]))))}
    g.strokeStyle=axC[a];g.globalAlpha=.7;g.lineWidth=2*k;g.beginPath();pts.forEach((q,i)=>i?g.lineTo(q[0],q[1]):g.moveTo(q[0],q[1]));g.stroke();g.globalAlpha=1;
    const lab=pts[6];g.fillStyle=axC[a];g.font=`bold ${Math.round(11*k)}px sans-serif`;g.fillText('↻'+'xyz'[a],lab[0]+4*k,lab[1]-4*k);
    vp.handles.push({kind:'ring',a,pts,c:vpProject(B,ctr)})}
  // SECTION: size handles: one at the middle of each bottom edge for width and depth, one on top for height
  // RULE: they sit on the outline, not mid-face, so a drag on the part's face slides it; a handle whose drag
  //   direction points into the view is hidden.
  for(let a=0;a<3;a++)for(const side of a===2?[1]:[-1,1]){const lp=[...F.mid];lp[a]=side>0?F.hi[a]:F.lo[a];if(a<2)lp[2]=F.lo[2];const w=F.M(lp),D=F.axis(a).map(v=>v*side),q=vpProject(B,w),q2=vpProject(B,[w[0]+D[0],w[1]+D[1],w[2]+D[2]]),gx=q2[0]-q[0],gy=q2[1]-q[1];
    if(Math.hypot(gx,gy)<.25*vp.s)continue;const r=5*k;g.fillStyle='#fff';g.strokeStyle=ink;g.lineWidth=1.5*k;g.fillRect(q[0]-r,q[1]-r,r*2,r*2);g.strokeRect(q[0]-r,q[1]-r,r*2,r*2);
    vp.handles.push({kind:'size',a,side,x:q[0],y:q[1],gx,gy})}
  // SECTION: the lift cone above the top
  {const top=[...F.mid];top[2]=F.hi[2];const t=vpProject(B,F.M(top)),x=t[0],y=t[1]-22*k;g.fillStyle=ink;g.beginPath();g.moveTo(x,y-8*k);g.lineTo(x-6*k,y+5*k);g.lineTo(x+6*k,y+5*k);g.closePath();g.fill();
    g.strokeStyle=ink;g.lineWidth=1*k;g.beginPath();g.moveTo(x,y+5*k);g.lineTo(t[0],t[1]);g.stroke();vp.handles.push({kind:'lift',x,y})}
  // SECTION: the ruler: width, depth and height in millimetres beside the box, position underneath
  const lab=(txt,x,y)=>{g.font=`${Math.round(11*k)}px sans-serif`;const w=g.measureText(txt).width+8*k;g.fillStyle='rgba(255,255,255,.88)';g.fillRect(x-w/2,y-8*k,w,16*k);g.fillStyle='#16121f';g.textAlign='center';g.fillText(txt,x,y+4*k);g.textAlign='left'};
  const E=(a,b)=>{const P=vpProject(B,F.M(a)),Q=vpProject(B,F.M(b));return[(P[0]+Q[0])/2,(P[1]+Q[1])/2]},lo=F.lo,hi=F.hi;
  const fmt=v=>`${+(v*mm).toFixed(1)} mm`;
  let q=E([lo[0],lo[1],lo[2]],[hi[0],lo[1],lo[2]]);lab('W '+fmt(half[0]*2),q[0],q[1]+12*k);
  q=E([hi[0],lo[1],lo[2]],[hi[0],hi[1],lo[2]]);lab('D '+fmt(half[1]*2),q[0]+10*k,q[1]+12*k);
  q=E([lo[0],lo[1],lo[2]],[lo[0],lo[1],hi[2]]);lab('H '+fmt(half[2]*2),q[0]-34*k,q[1]);
  g.font=`${Math.round(11*k)}px sans-serif`;g.fillStyle=ink;g.fillText(`${p.name} · x ${+(p.pos[0]*mm).toFixed(1)} · y ${+(p.pos[1]*mm).toFixed(1)} · z ${+(p.pos[2]*mm).toFixed(1)} mm`,70*k,vp.H-12*k);
}
function vpHit(X,Y){
  const r=10*vp.k;
  for(const h of vp.handles)if(h.kind==='lift'&&Math.hypot(X-h.x,Y-h.y)<r*1.3)return h;
  for(const h of vp.handles)if(h.kind==='size'&&Math.abs(X-h.x)<r&&Math.abs(Y-h.y)<r)return h;
  // RULE: rings take a drag only off the picked part, so dragging the part itself always slides it.
  const on=vp.pid&&vp.pid[(Y|0)*vp.W+(X|0)],sc=m3d.scene;if(on!=null&&on>=0&&sc&&picked().some(p=>sc.parts.indexOf(p)===on))return null;
  for(const h of vp.handles)if(h.kind==='ring')for(let i=1;i<h.pts.length;i++){const a=h.pts[i-1],b=h.pts[i],dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((X-a[0])*dx+(Y-a[1])*dy)/L));if(Math.hypot(X-a[0]-t*dx,Y-a[1]-t*dy)<r*.7)return h}
  return null;
}
let vpRaf=0;const vpLater=()=>{if(!vpRaf)vpRaf=requestAnimationFrame(()=>{vpRaf=0;m3dRenderVP()})};

// SECTION: changes, undo and the bake
// RULE: every change redraws the view at once; the bake (and the stored OBJ) follows half a second after the last one.
const m3dHist={undo:[],redo:[]};let m3dGen=0,m3dBakeT=0;
const sceneStr=()=>JSON.stringify(m3d.scene);
function m3dPush(){const s=sceneStr();if(m3dHist.undo[m3dHist.undo.length-1]!==s){m3dHist.undo.push(s);if(m3dHist.undo.length>60)m3dHist.undo.shift();m3dHist.redo.length=0}}
async function m3dSceneChanged({bake=true}={}){
  if(!m3d.scene)return;const gen=++m3dGen;let mesh;
  try{mesh=await m3dSceneMesh(m3d.scene)}catch(e){status(e.message);return}
  if(gen!==m3dGen)return;m3d.smesh=mesh;m3d.mesh=mesh;m3d.opt.up='z';m3dControls();renderParts();m3dRenderVP();
  clearTimeout(m3dBakeT);m3dPending=null;if(!bake)return;
  m3dPending=async()=>{m3dPending=null;if(gen!==m3dGen)return;if(!mesh.tri.length){$('#m3dInfo').textContent='Nothing left: the cuts took it all. Undo, or change a part.';return}
    m3d.src=m3dDataURL(slug(m3d.name||'model')+'.obj',te.encode(m3dSceneOBJ(mesh,m3d.scene)));await m3dRebake()};
  m3dBakeT=setTimeout(()=>m3dPending&&m3dPending(),500);
}
// INVARIANT: Place, Update and saving to Primitives first finish a bake still waiting on the last edit.
let m3dPending=null;
async function m3dFlush(){clearTimeout(m3dBakeT);if(m3dPending)await m3dPending()}
function m3dEdit(fn,{push=true}={}){if(!m3d.scene)return;if(push)m3dPush();fn(m3d.scene);m3dSceneChanged()}
function m3dStep(back){const from=back?m3dHist.undo:m3dHist.redo,to=back?m3dHist.redo:m3dHist.undo,s=from.pop();if(!s){status(back?'Nothing to undo in the model':'Nothing to redo in the model');return}
  to.push(sceneStr());m3d.scene=JSON.parse(s);m3dSceneChanged();status(back?'Undo':'Redo')}
function m3dStartScene(fromModel){
  const parts=fromModel&&m3d.mesh?[m3dModelPart(m3d.mesh,m3d.opt)]:[m3dPart('box',{color:m3d.opt.color})];
  m3dHist.undo.length=m3dHist.redo.length=0;m3d.scene={parts,sel:0,picked:[parts[0].id],mm:20};m3d.tex=fromModel?null:m3d.tex;m3d.texData=fromModel?null:m3d.texData;
  if(!fromModel){m3d.name='Shapes';m3d.editing=null}m3d.opt.up='z';m3dSceneChanged();
  status(fromModel?'The model is now a part: add shapes to it, or cut them away from it. Its texture is set aside; paint a new one when it’s done.':'A box to start from. Add shapes, cut them away, or keep only where they overlap.');
}
const pickOne=(sc,i)=>{sc.sel=i;sc.picked=[sc.parts[i].id]};
function pickToggle(sc,i){const id=sc.parts[i].id,set=new Set(sc.picked&&sc.picked.length?sc.picked:[sc.parts[sc.sel].id]);if(set.has(id)&&set.size>1){set.delete(id);if(sc.parts[sc.sel].id===id)sc.sel=sc.parts.findIndex(p=>set.has(p.id))}else{set.add(id);sc.sel=i}sc.picked=[...set]}
const cloneP=p=>{const q=JSON.parse(JSON.stringify(p));const re=x=>{x.id=nid('p');(x.parts||[]).forEach(re)};re(q);return q};

// SECTION: groups
// RULE: Group makes the picked parts one part: its parts combine first (their own adds, cuts and overlaps), then the
//   group adds, cuts or keeps as a whole, and moves, turns and sizes as one. Ungroup puts the parts back where they
//   are; a part the group stretched unevenly comes back as a fixed model part, since a stretch after a turn can't
//   be written as a size and a turn.
function m3dGroup(){
  const ps=picked();if(ps.length<2){status('Shift-click two or more parts to group them.');return}
  m3dEdit(s=>{const at=Math.min(...ps.map(p=>s.parts.indexOf(p))),ids=new Set(ps.map(p=>p.id)),kids=s.parts.filter(p=>ids.has(p.id));
    const G=m3dPart('group',{name:`Group of ${kids.length}`,pos:[0,0,0],color:kids[0].color,parts:kids});s.parts=s.parts.filter(p=>!ids.has(p.id));s.parts.splice(at,0,G);pickOne(s,at)});
  status('Grouped. It moves, turns and sizes as one; its parts still add and cut among themselves.');sfx('boing');
}
async function m3dUngroup(){
  const sc=m3d.scene,G=sc&&sc.parts[sc.sel];if(!G||G.kind!=='group')return;m3dPush();
  const uni=Math.max(...G.size)/Math.min(...G.size)<1.0001,s=G.size[0],RG=rotMat(G.rot),out=[];
  for(const c of G.parts){
    if(uni){const q=cloneP(c),t=mulV(RG,c.pos.map(v=>v*s));q.pos=[0,1,2].map(i=>t[i]+G.pos[i]);q.rot=eulerOf(mulM(RG,rotMat(c.rot)));q.size=c.size.map(v=>v*s);out.push(q)}
    else{const M=partMatrix(G);out.push({...trisPart((await partWorld(c)).map(([t,col])=>[t.map(M),col]),c.name),op:c.op})}}
  const at=sc.parts.indexOf(G);sc.parts.splice(at,1,...out);sc.sel=at;sc.picked=out.map(p=>p.id);m3dSceneChanged();
  status(uni?'Ungrouped: the parts are back, where the group had them.':'Ungrouped. Parts the group stretched unevenly came back as fixed model parts.');
}

// SECTION: the parts panel
function renderParts(){
  const sc=m3d.scene,box=$('#m3dBuild');box.classList.toggle('on',!!sc);$('#m3dBuildOn').hidden=!m3d.mesh||!!sc;
  const list=$('#m3dPartList');list.replaceChildren();if(!sc){$('#m3dPartProps').hidden=true;return}
  const pk=new Set(picked().map(p=>p.id));
  sc.parts.forEach((p,i)=>{const on=pk.has(p.id),li=mkEl('li',{className:'m3drow'+(on?' on':'')+(i===sc.sel?' primary':'')+(p.hidden?' off':''),id:'m3dp-'+p.id});li.setAttribute('role','option');li.setAttribute('aria-selected',String(on));
    const eye=mkEl('button',{type:'button',className:'lyeye',textContent:p.hidden?'⊘':'👁'});eye.setAttribute('aria-pressed',String(!p.hidden));eye.setAttribute('aria-label',`${p.hidden?'Show':'Hide'} ${p.name}`);
    eye.onclick=e=>{e.stopPropagation();m3dEdit(s=>{s.parts[i].hidden=!s.parts[i].hidden})};
    const sw=mkEl('i',{className:'m3dsw'+(p.kind==='group'?' grp':'')});if(p.kind!=='group')sw.style.background=p.color;else sw.textContent=String(p.parts.length);
    li.append(eye,sw,mkEl('span',{className:'m3dpn',textContent:p.name}),mkEl('small',{className:'m3dop',textContent:p.op==='add'?'':p.op==='cut'?'− cut':'∩ keep'}));
    li.onclick=e=>{if(e.shiftKey)pickToggle(sc,i);else pickOne(sc,i);renderParts();m3dRenderVP()};list.append(li)});
  list.setAttribute('aria-activedescendant','m3dp-'+sc.parts[sc.sel].id);
  const p=sc.parts[sc.sel],props=$('#m3dPartProps'),mm=sc.mm||20;props.hidden=false;
  if(document.activeElement!==$('#m3dPName'))$('#m3dPName').value=p.name;
  for(const r of document.querySelectorAll('#m3dPartProps input[name=m3dOp]'))r.checked=r.value===p.op;
  $('#m3dPColor').value=p.color;$('#m3dPColorRow').hidden=p.kind==='group';
  $('#m3dPSeg').max=p.kind==='star'?12:64;$('#m3dPSeg').value=p.seg;$('#m3dPSegRow').hidden=!M3D_ROUND.has(p.kind);$('#m3dPSegLab').textContent=p.kind==='star'?'Points':'Smoothness';
  $('#m3dPHoleRow').hidden=p.kind!=='tube';$('#m3dPHole').value=Math.round((p.hole??.3)*100);
  $('#m3dPTextRow').hidden=p.kind!=='text';if(p.kind==='text'){if(document.activeElement!==$('#m3dPText'))$('#m3dPText').value=p.text;$('#m3dPFont').value=p.font}
  for(const inp of document.querySelectorAll('#m3dPartProps [data-v]')){const [k,i]=inp.dataset.v.split('.');if(document.activeElement!==inp)inp.value=+(p[k][i]*(k==='rot'?1:mm)).toFixed(k==='rot'?1:2)}
  $('#m3dDelPart').disabled=sc.parts.length<=pk.size;$('#m3dGroup').disabled=pk.size<2;$('#m3dUngroup').hidden=p.kind!=='group';
  if(document.activeElement!==$('#m3dMM'))$('#m3dMM').value=mm;$('#m3dPickNote').textContent=pk.size>1?`${pk.size} picked: drag, arrows, duplicate and remove act on all of them.`:'';
}
{const sel=$('#m3dAdd');for(const [v,t] of M3D_KINDS)sel.append(mkEl('option',{value:v,textContent:t}));
 const f=$('#m3dPFont');for(const [v,t] of M3D_FONTS)f.append(mkEl('option',{value:v,textContent:t}));
 const sn=$('#m3dSnap');for(const [v,t] of M3D_SNAPS)sn.append(mkEl('option',{value:v,textContent:t}));sn.value=String(vp.snap)}
$('#m3dAdd').onchange=async e=>{const k=e.target.value;e.target.value='';if(!k||!m3d.scene)return;audio();
  const prev=m3d.scene.parts[m3d.scene.sel],o={color:prev&&prev.kind!=='group'?prev.color:m3d.opt.color,pos:prev?[prev.pos[0]+.6,prev.pos[1],.5]:[0,0,.5]};
  if(k==='text'){const t=await textSolid('Text',M3D_FONTS[0][0]);Object.assign(o,{size:[t.aspect,1,.25],pos:[o.pos[0],o.pos[1],.125]})}
  if(k==='dome')Object.assign(o,{size:[1,1,.5],pos:[o.pos[0],o.pos[1],.25]});
  m3dEdit(s=>{s.parts.push(m3dPart(k,o));pickOne(s,s.parts.length-1)});sfx('pop')};
$('#m3dDupPart').onclick=()=>{audio();m3dEdit(s=>{const ps=picked(),ids=[];let at=Math.max(...ps.map(p=>s.parts.indexOf(p)));for(const p of ps){const q=cloneP(p);q.name=q.name.slice(0,34)+' copy';q.pos[0]+=.3;s.parts.splice(++at,0,q);ids.push(q.id)}s.picked=ids;s.sel=s.parts.findIndex(p=>p.id===ids[0])})};
$('#m3dDelPart').onclick=()=>{audio();m3dEdit(s=>{const ids=new Set(picked().map(p=>p.id));if(s.parts.length<=ids.size)return;s.parts=s.parts.filter(p=>!ids.has(p.id));pickOne(s,Math.min(s.sel,s.parts.length-1))})};
$('#m3dUpPart').onclick=()=>{m3dEdit(s=>{const i=s.sel;if(i<1)return;[s.parts[i-1],s.parts[i]]=[s.parts[i],s.parts[i-1]];s.sel--})};
$('#m3dDownPart').onclick=()=>{m3dEdit(s=>{const i=s.sel;if(i>=s.parts.length-1)return;[s.parts[i+1],s.parts[i]]=[s.parts[i],s.parts[i+1]];s.sel++})};
$('#m3dGroup').onclick=()=>{audio();m3dGroup()};$('#m3dUngroup').onclick=()=>{audio();m3dUngroup()};
$('#m3dFloor').onclick=()=>{m3dEdit(()=>{for(const p of picked()){const F=partFrame(p);let lo=1e9;for(let i=0;i<8;i++)lo=Math.min(lo,F.M([i&1?F.hi[0]:F.lo[0],i&2?F.hi[1]:F.lo[1],i&4?F.hi[2]:F.lo[2]])[2]);if(lo<1e9)p.pos[2]-=lo}})};
$('#m3dUndo').onclick=()=>m3dStep(true);$('#m3dRedo').onclick=()=>m3dStep(false);
$('#m3dNewScene').onclick=()=>{audio();m3dStartScene(false)};$('#m3dBuildOn').onclick=()=>{audio();m3dStartScene(true)};
$('#m3dObj').onclick=()=>{if(!m3d.scene||!m3d.smesh)return;download(new Blob([m3dSceneOBJ(m3d.smesh,m3d.scene)],{type:'model/obj'}),slug(m3d.name||'model')+'.obj')};
$('#m3dStl').onclick=()=>{if(!m3d.scene||!m3d.smesh||!m3d.smesh.tri.length)return;download(new Blob([m3dSceneSTL(m3d.smesh,scMM())],{type:'model/stl'}),slug(m3d.name||'model')+'.stl');status(`Saved ${slug(m3d.name||'model')}.stl in millimetres, 1 unit = ${scMM()} mm.`)};
$('#m3dSnap').onchange=e=>{vp.snap=+e.target.value||0};
$('#m3dMM').onchange=e=>{const v=Math.max(1,Math.min(1000,+e.target.value||20));m3dEdit(s=>{s.mm=v})};
// RULE: a field edit is one undo step: the state before the first keystroke or drag is what undo brings back.
let m3dFieldPushed=false;
for(const inp of document.querySelectorAll('#m3dPartProps input,#m3dPartProps select')){
  inp.addEventListener('focus',()=>{m3dFieldPushed=false});
  inp.addEventListener(inp.type==='radio'||inp.type==='color'||inp.tagName==='SELECT'?'change':'input',async()=>{if(!m3d.scene)return;if(!m3dFieldPushed){m3dPush();m3dFieldPushed=true}
    const p=m3d.scene.parts[m3d.scene.sel],mm=scMM();
    if(inp.dataset.v){const [k,i]=inp.dataset.v.split('.');let v=parseFloat(inp.value);if(!Number.isFinite(v))return;if(k!=='rot')v/=mm;p[k][+i]=k==='size'?Math.max(.01,Math.min(50,v)):k==='rot'?Math.max(-360,Math.min(360,v)):Math.max(-50,Math.min(50,v))}
    else if(inp.name==='m3dOp')p.op=inp.value;else if(inp.id==='m3dPColor')p.color=inp.value;else if(inp.id==='m3dPSeg')p.seg=Math.max(3,Math.min(64,+inp.value|0));
    else if(inp.id==='m3dPHole')p.hole=Math.max(.05,Math.min(.95,+inp.value/100));else if(inp.id==='m3dPName')p.name=inp.value.slice(0,40)||p.kind;
    // RULE: new words or a new font keep the text's height and take the width the words need.
    else if(inp.id==='m3dPText'||inp.id==='m3dPFont'){const was=p.kind==='text'?(await textSolid(p.text,p.font)).aspect:1;if(inp.id==='m3dPText')p.text=inp.value.slice(0,60)||'Text';else p.font=inp.value;
      const now=(await textSolid(p.text,p.font)).aspect;p.size[0]=Math.max(.01,Math.min(50,p.size[0]/was*now))}
    m3dSceneChanged()});
  inp.addEventListener('change',()=>{m3dFieldPushed=false});
}
// SECTION: viewport input
{const cv=$('#m3dEdit');let drag=null;
  const at=e=>{const r=cv.getBoundingClientRect(),k=cv.width/r.width;return[(e.clientX-r.left)*k,(e.clientY-r.top)*k]};
  cv.addEventListener('pointerdown',e=>{if(e.button>0)return;cv.setPointerCapture(e.pointerId);cv.focus({preventScroll:true});const [X,Y]=at(e),sc=m3d.scene,h=sc&&vpHit(X,Y),i=vp.pid&&vp.pid[(Y|0)*vp.W+(X|0)];
    const ps=picked(),snap=ps.map(p=>JSON.parse(JSON.stringify(p)));
    drag={x0:e.clientX,y0:e.clientY,X0:X,Y0:Y,az:vp.az,el:vp.el,moved:false,hit:i,h,snap,
      move:!h&&sc&&i!=null&&i>=0&&ps.some(p=>sc.parts.indexOf(p)===i),z0:ps[0]&&ps[0].pos[2]}});
  cv.addEventListener('pointermove',e=>{if(!drag)return;const dx=e.clientX-drag.x0,dy=e.clientY-drag.y0;if(!drag.moved&&Math.hypot(dx,dy)<4)return;
    const sc=m3d.scene,[X,Y]=at(e),B=vp.basis;if(!drag.moved&&(drag.move||drag.h))m3dPush();drag.moved=true;
    if(drag.h&&sc){const p=sc.parts[sc.sel],p0=drag.snap[0],h=drag.h;Object.assign(p,JSON.parse(JSON.stringify(p0)));
      if(h.kind==='lift'){p.pos[2]=roundTo(p0.pos[2]+(drag.Y0-Y)/(vp.s*Math.max(.15,B.u[2])),snapU())}
      else if(h.kind==='size'){const F=partFrame(p0),a=h.a,ext=F.hi[a]-F.lo[a],t=((X-drag.X0)*h.gx+(Y-drag.Y0)*h.gy)/(h.gx*h.gx+h.gy*h.gy);
        const L0=ext*p0.size[a],L=Math.max(Math.max(snapU(),.01),roundTo(L0+t,snapU())),f=L/L0;
        if(e.shiftKey)p.size=p0.size.map(v=>Math.max(.01,Math.min(50,v*f)));else p.size[a]=Math.max(.01,Math.min(50,L/ext));
        const Q=[...F.mid];Q[a]=h.side>0?F.lo[a]:F.hi[a];const A0=F.M(Q),A1=partMatrix(p)(Q);for(let j=0;j<3;j++)p.pos[j]=p0.pos[j]+A0[j]-A1[j]}
      else if(h.kind==='ring'){const a0=Math.atan2(drag.Y0-h.c[1],drag.X0-h.c[0]),a1=Math.atan2(Y-h.c[1],X-h.c[0]),e3=[0,0,0];e3[h.a]=1;const facing=e3[0]*B.c[0]+e3[1]*B.c[1]+e3[2]*B.c[2]>=0?1:-1;
        let deg=-(a1-a0)*180/Math.PI*facing;deg=((deg+540)%360)-180;if(!e.shiftKey)deg=Math.round(deg/15)*15;const F=partFrame(p0),C=F.M(F.mid),r=deg*Math.PI/180,cs=Math.cos(r),sn=Math.sin(r);
        const Rw=h.a===0?[[1,0,0],[0,cs,-sn],[0,sn,cs]]:h.a===1?[[cs,0,sn],[0,1,0],[-sn,0,cs]]:[[cs,-sn,0],[sn,cs,0],[0,0,1]];
        p.rot=eulerOf(mulM(Rw,rotMat(p0.rot))).map(v=>+v.toFixed(3));const d=mulV(Rw,[0,1,2].map(j=>p0.pos[j]-C[j]));p.pos=[0,1,2].map(j=>C[j]+d[j])}
      m3dSceneChanged()}
    else if(drag.move&&sc){const ps=picked(),a=vpFloor(B,drag.X0,drag.Y0,drag.z0),b=vpFloor(B,X,Y,drag.z0);let D;
      // RULE: dragging slides along the floor; seen edge-on it slides across the view instead.
      if(a&&b)D=[b[0]-a[0],b[1]-a[1],0];else{const sx=(X-drag.X0)/vp.s,sy=(drag.Y0-Y)/vp.s;D=[0,1,2].map(j=>B.r[j]*sx+B.u[j]*sy)}
      const lead=drag.snap[0],T=lead.pos.map((v,j)=>roundTo(v+D[j],snapU())-v);ps.forEach((p,n)=>{p.pos=drag.snap[n].pos.map((v,j)=>v+T[j])});m3dSceneChanged()}
    else{vp.az=drag.az-dx*.5;vp.el=Math.max(-89,Math.min(89,drag.el+dy*.5));vpLater()}});
  cv.addEventListener('pointerup',e=>{const sc=m3d.scene;if(drag&&!drag.moved&&sc&&!drag.h){if(drag.hit!=null&&drag.hit>=0){if(e.shiftKey)pickToggle(sc,drag.hit);else pickOne(sc,drag.hit)}else if(!e.shiftKey)sc.picked=[sc.parts[sc.sel].id];renderParts();m3dRenderVP()}drag=null});
  cv.addEventListener('wheel',e=>{e.preventDefault();vp.zoom=Math.max(.2,Math.min(8,vp.zoom*Math.exp(-e.deltaY*.0015)));vpLater()},{passive:false});
  // RULE: with the view focused, arrows move the picked parts across the floor by the snap (1 mm when snap is off),
  //   Page Up/Down lift and lower them, Shift moves ten times as far; Delete removes them, Ctrl/⌘+D copies them,
  //   Ctrl/⌘+G groups them, Ctrl/⌘+Shift+G ungroups.
  cv.addEventListener('keydown',e=>{const sc=m3d.scene;if(!sc)return;const st=(vp.snap||1)/scMM()*(e.shiftKey?10:1),mv={ArrowLeft:[0,-st],ArrowRight:[0,st],ArrowUp:[1,st],ArrowDown:[1,-st],PageUp:[2,st],PageDown:[2,-st]}[e.key];
    if(mv){e.preventDefault();m3dEdit(()=>{for(const p of picked())p.pos[mv[0]]=Math.round((p.pos[mv[0]]+mv[1])*1e4)/1e4})}
    else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();$('#m3dDelPart').click()}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();$('#m3dDupPart').click()}
    else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='g'){e.preventDefault();e.shiftKey?m3dUngroup():m3dGroup()}});
  $('#m3dViewReset').onclick=()=>{Object.assign(vp,{az:-35,el:24,zoom:1});m3dRenderVP()};
  new ResizeObserver(vpLater).observe(cv);
}
// RULE: in the 3D window Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (or Y) step through the model's own history, not the page's.
$('#m3dModal').addEventListener('keydown',e=>{if(!m3d.scene||!(e.ctrlKey||e.metaKey)||e.target.closest('input[type=text],textarea'))return;const k=e.key.toLowerCase();
  if(k==='z'||k==='y'){e.preventDefault();e.stopPropagation();m3dStep(k==='z'&&!e.shiftKey)}});

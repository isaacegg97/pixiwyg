// SECTION: 3D models as sprite atlases (the impostor trick from the author's raycaster, for any low-poly model)
// RULE: a model is baked from AZ azimuths x rows of elevations into ONE atlas image; the page shows one cell of it
//   with background-size/position, and spins by stepping background-position-x. No 3D code ships with the page.
// FORMAT: atlas = cols are azimuths (camera orbiting counter-clockwise from +x), rows are elevations (low to high),
//   each cell S x S, transparent where the model isn't. The normal atlas has the same layout: view-space normal
//   (x right, y up, z toward the camera) as rgb = n*0.5+0.5, for relighting elsewhere.
// FORMAT: element = div.px3d from model3d.css. attrs.style carries the atlas and the cell; data-px3d is the bake
//   settings as JSON; data-px3d-src is the model file as a data: URL (an asset in the project, dropped on export).
const M3D_MAX_TRIS=20000,M3D_SS=2;
const M3D_ROWS={1:[.3],2:[.12,.55],3:[.05,.4,.85]};
const M3D_CSS=`.px3d{display:block;width:100%;aspect-ratio:1;background-repeat:no-repeat}
.px3d.drag{cursor:grab;touch-action:none}
.px3d.spin{animation:px3d-spin var(--px3d-dur,3s) steps(var(--px3d-n,16),jump-none) infinite}
@keyframes px3d-spin{from{background-position-x:0%}to{background-position-x:100%}}
`;
const M3D_DEF={az:16,rows:2,cell:128,color:'#c8b89a',up:'y',flat:true,frame:2,row:0,spin:false,drag:false,dur:4,w:200};
const m3d={mesh:null,src:null,tex:null,texData:null,name:'',opt:{...M3D_DEF},bake:null,editing:null,busy:0,drag:null};

// SECTION: parsers
// INVARIANT: parsers return {pos:Float32Array (xyz per vertex), tri:Uint32Array, col:Float32Array|null (rgb 0..1
//   per triangle CORNER), uv:Float32Array|null (u,v per CORNER, v up), texMask:Uint8Array|null (1 = this triangle
//   wears the texture; null = all do)}, or throw with a message meant for the user.
function m3dLimit(n){if(n>M3D_MAX_TRIS)throw new Error(`This model has ${n.toLocaleString()} triangles; the limit is ${M3D_MAX_TRIS.toLocaleString()}. Reduce it in your 3D app first.`)}
// FORMAT: MTL is read for newmtl / Kd / map_Kd. A model stored in the project carries its MTL inline as
//   "#px3d-mtl <base64>" comment lines, so it still parses (and other tools still read it) without the sibling file.
function parseMTL(text){
  const mats=new Map();let cur=null;
  for(const raw of String(text).split('\n')){const l=raw.trim(),[k,...r]=l.split(/\s+/);
    if(k==='newmtl'){cur={kd:null,map:null};mats.set(r.join(' '),cur)}
    else if(cur&&k==='Kd'){const n=r.map(Number);if(n.length>=3&&n.slice(0,3).every(Number.isFinite))cur.kd=n.slice(0,3)}
    else if(cur&&k==='map_Kd')cur.map=r[r.length-1]}
  return mats;
}
function parseOBJ(text,mtl=null){
  text=String(text);
  if(!mtl){const inl=[...text.matchAll(/^#px3d-mtl ([A-Za-z0-9+/=]+)\s*$/gm)].map(m=>new TextDecoder().decode(b64bytes(m[1]))).join('\n');if(inl)mtl=inl}
  const mats=mtl?parseMTL(mtl):new Map();
  const pos=[],vc=[],tri=[],vt=[],uv=[],col=[],mask=[];let hasVC=false,allUV=true,mat=null,anyMat=false;
  for(const raw of text.split('\n')){
    const l=raw.trim();
    if(l.startsWith('v ')){const n=l.slice(2).trim().split(/\s+/).map(Number);pos.push(n[0]||0,n[1]||0,n[2]||0);
      if(n.length>=6&&n.slice(3,6).every(Number.isFinite)){hasVC=true;vc.push(n[3],n[4],n[5])}else vc.push(1,1,1)}
    else if(l.startsWith('vt ')){const n=l.slice(3).trim().split(/\s+/).map(Number);vt.push(n[0]||0,n[1]||0)}
    else if(l.startsWith('usemtl ')){mat=mats.get(l.slice(7).trim())||null;if(mat)anyMat=true}
    else if(l.startsWith('f ')){
      const nv=pos.length/3,nt=vt.length/2,tok=l.slice(2).trim().split(/\s+/);
      const ids=tok.map(t=>{const i=parseInt(t,10);return i<0?nv+i:i-1}),tids=tok.map(t=>{const i=parseInt(t.split('/')[1],10);return Number.isNaN(i)?-1:i<0?nt+i:i-1});
      if(ids.some(i=>!(i>=0&&i<nv)))continue;
      const okUV=tids.every(i=>i>=0&&i<nt);if(!okUV&&!(mat&&!mat.map))allUV=false;
      for(let k=1;k+1<ids.length;k++){
        const c3=[0,k,k+1];tri.push(ids[0],ids[k],ids[k+1]);
        for(const j of c3){if(okUV)uv.push(vt[tids[j]*2],vt[tids[j]*2+1]);else uv.push(0,0);
          const kd=mat&&mat.kd;if(kd)col.push(kd[0],kd[1],kd[2]);else col.push(vc[ids[j]*3],vc[ids[j]*3+1],vc[ids[j]*3+2])}
        mask.push(mat?(mat.map?1:0):1);
      }
      m3dLimit(tri.length/3);
    }
  }
  if(!tri.length)throw new Error('No faces in that file. It needs "v" vertices and "f" faces.');
  if(hasVC&&col.some(c=>c>1))for(let i=0;i<col.length;i++)col[i]/=255;
  const hasUV=vt.length>0&&allUV,useMask=anyMat&&mask.some(x=>!x);
  return{pos:Float32Array.from(pos),tri:Uint32Array.from(tri),col:hasVC||anyMat?Float32Array.from(col):null,uv:hasUV?Float32Array.from(uv):null,texMask:useMask&&hasUV?Uint8Array.from(mask):null,
    textured:[...mats.values()].find(m=>m.map)?.map||null};
}
// FORMAT: glTF 2.0, .glb or .gltf with embedded (data:) buffers: every triangle primitive of the default scene,
//   node transforms applied; COLOR_0 x baseColorFactor as colour, TEXCOORD_0 + the first baseColorTexture as texture.
// SAFETY: compressed extensions (Draco, meshopt) are refused rather than half-read.
function parseGLTF(bytes){
  const u8=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes),dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);let J,bin=null;
  if(u8.length>=12&&dv.getUint32(0,true)===0x46546C67){
    let o=12;while(o+8<=u8.length){const len=dv.getUint32(o,true),type=dv.getUint32(o+4,true),body=u8.subarray(o+8,o+8+len);
      if(type===0x4E4F534A)J=JSON.parse(new TextDecoder().decode(body));else if(type===0x004E4942)bin=body;o+=8+len}
  }else J=JSON.parse(new TextDecoder().decode(u8));
  if(!J||!J.meshes)throw new Error('That glTF file has no meshes.');
  const req=(J.extensionsRequired||[]).filter(x=>/draco|meshopt|quantiz/i.test(x));
  if(req.length)throw new Error(`That glTF is compressed (${req.join(', ')}). Export it again without compression.`);
  const bufs=(J.buffers||[]).map((b,i)=>{if(b.uri===undefined&&i===0&&bin)return bin;const m=/^data:[^;]*;base64,(.*)$/.exec(b.uri||'');
    if(!m)throw new Error(`That .gltf needs ${b.uri||'its .bin file'}: pick or drop it together with the .gltf (or export as .glb).`);return b64bytes(m[1])});
  const view=i=>{const v=J.bufferViews[i],b=bufs[v.buffer];return{u8:b.subarray(v.byteOffset||0,(v.byteOffset||0)+v.byteLength),stride:v.byteStride||0}};
  const NC={SCALAR:1,VEC2:2,VEC3:3,VEC4:4},CS={5120:1,5121:1,5122:2,5123:2,5125:4,5126:4};
  const acc=i=>{const a=J.accessors[i],n=NC[a.type],cs=CS[a.componentType],out=new Float32Array(a.count*n);if(a.bufferView===undefined)return{n,v:out};
    const {u8:v,stride}=view(a.bufferView),d=new DataView(v.buffer,v.byteOffset+(a.byteOffset||0)),st=stride||n*cs;
    for(let k=0;k<a.count;k++)for(let c=0;c<n;c++){const o=k*st+c*cs;let x;
      switch(a.componentType){case 5126:x=d.getFloat32(o,true);break;case 5125:x=d.getUint32(o,true);break;case 5123:x=d.getUint16(o,true);if(a.normalized)x/=65535;break;
        case 5121:x=d.getUint8(o);if(a.normalized)x/=255;break;case 5122:x=d.getInt16(o,true);if(a.normalized)x=Math.max(-1,x/32767);break;default:x=d.getInt8(o);if(a.normalized)x=Math.max(-1,x/127)}
      out[k*n+c]=x}
    return{n,v:out}};
  const mul=(a,b)=>{const o=new Array(16).fill(0);for(let i=0;i<4;i++)for(let j=0;j<4;j++)for(let k=0;k<4;k++)o[j*4+i]+=a[k*4+i]*b[j*4+k];return o};
  const local=n=>{if(n.matrix)return n.matrix;const [x,y,z,w]=n.rotation||[0,0,0,1],[sx,sy,sz]=n.scale||[1,1,1],[tx,ty,tz]=n.translation||[0,0,0];
    return[(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,tx,ty,tz,1]};
  const pos=[],tri=[],col=[],uv=[],mask=[];let texIdx=null,anyUV=true;
  const emit=(mesh,M)=>{for(const pr of mesh.primitives||[]){
    if((pr.mode??4)!==4||pr.attributes.POSITION===undefined)continue;
    const P=acc(pr.attributes.POSITION).v,base=pos.length/3,nv=P.length/3;
    for(let i=0;i<nv;i++){const x=P[i*3],y=P[i*3+1],z=P[i*3+2];pos.push(M[0]*x+M[4]*y+M[8]*z+M[12],M[1]*x+M[5]*y+M[9]*z+M[13],M[2]*x+M[6]*y+M[10]*z+M[14])}
    const I=pr.indices!==undefined?acc(pr.indices).v:Float32Array.from({length:nv},(_,i)=>i);
    const mat=pr.material!==undefined&&J.materials?J.materials[pr.material]:null,pbr=(mat&&mat.pbrMetallicRoughness)||{},f=pbr.baseColorFactor||[1,1,1,1];
    const C=pr.attributes.COLOR_0!==undefined?acc(pr.attributes.COLOR_0):null,T=pr.attributes.TEXCOORD_0!==undefined?acc(pr.attributes.TEXCOORD_0).v:null;
    const ti=pbr.baseColorTexture?pbr.baseColorTexture.index:null;if(ti!=null&&texIdx===null)texIdx=ti;
    const wears=ti!=null&&ti===texIdx&&!!T;if(ti!=null&&!T)anyUV=false;
    for(let k=0;k+2<I.length;k+=3){
      for(let j=0;j<3;j++){const v=I[k+j];tri.push(base+v);
        col.push((C?C.v[v*C.n]:1)*f[0],(C?C.v[v*C.n+1]:1)*f[1],(C?C.v[v*C.n+2]:1)*f[2]);
        // FORMAT: glTF UV origin is top-left; flipped to the OBJ convention (v up) used everywhere here.
        if(T)uv.push(T[v*2],1-T[v*2+1]);else uv.push(0,0)}
      mask.push(wears?1:0);
    }
    m3dLimit(tri.length/3);
  }};
  const walk=(i,M)=>{const n=J.nodes[i],W=mul(M,local(n));if(n.mesh!==undefined)emit(J.meshes[n.mesh],W);for(const c of n.children||[])walk(c,W)};
  const I4=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],sc=J.scenes&&J.scenes[J.scene||0];
  if(sc)for(const r of sc.nodes||[])walk(r,I4);else J.meshes.forEach(m=>emit(m,I4));
  if(!tri.length)throw new Error('That glTF file has no triangles.');
  let tex=null;
  if(texIdx!==null){const t=J.textures[texIdx],img=t&&J.images&&J.images[t.source];
    if(img&&img.bufferView!==undefined){const v=view(img.bufferView).u8;tex=`data:${img.mimeType||'image/png'};base64,${bytesB64(v)}`}
    else if(img&&/^data:image\//.test(img.uri||''))tex=img.uri}
  const hasTex=!!tex&&uv.length===tri.length*2;
  return{pos:Float32Array.from(pos),tri:Uint32Array.from(tri),col:Float32Array.from(col),uv:hasTex||anyUV&&uv.length?Float32Array.from(uv):null,
    texMask:hasTex&&mask.some(x=>!x)?Uint8Array.from(mask):null,texture:tex};
}
function parseSTL(buf){
  const u8=buf instanceof Uint8Array?buf:new Uint8Array(buf),dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
  // HACK: binary STL may start with "solid" too; the size formula is the reliable test.
  if(u8.length>=84){const n=dv.getUint32(80,true);if(84+n*50===u8.length){
    m3dLimit(n);const pos=new Float32Array(n*9),tri=new Uint32Array(n*3);
    for(let i=0;i<n;i++){const o=84+i*50+12;for(let k=0;k<9;k++)pos[i*9+k]=dv.getFloat32(o+k*4,true);tri[i*3]=i*3;tri[i*3+1]=i*3+1;tri[i*3+2]=i*3+2}
    return{pos,col:null,tri}}}
  const text=new TextDecoder().decode(u8),v=[...text.matchAll(/vertex\s+(\S+)\s+(\S+)\s+(\S+)/g)].map(m=>[+m[1],+m[2],+m[3]]);
  const n=Math.floor(v.length/3);if(!n)throw new Error('That STL file has no triangles.');m3dLimit(n);
  return{pos:Float32Array.from(v.slice(0,n*3).flat()),col:null,tri:Uint32Array.from({length:n*3},(_,i)=>i)};
}
// FORMAT: built-in sample so the workspace is never empty: a low-poly torus knot, z up.
function m3dSample(){
  const P=2,Q=3,N=96,M=8,pos=[],tri=[],c=t=>{const r=2+Math.cos(Q*t);return[r*Math.cos(P*t),r*Math.sin(P*t),Math.sin(Q*t)]};
  for(let i=0;i<N;i++){const t=i/N*Math.PI*2,a=c(t),b=c(t+.01),T=b.map((x,k)=>x-a[k]),tl=Math.hypot(...T);T.forEach((x,k)=>T[k]=x/tl);
    let Nn=[-T[1],T[0],0],nl=Math.hypot(...Nn)||1;Nn=Nn.map(x=>x/nl);const B=[T[1]*Nn[2]-T[2]*Nn[1],T[2]*Nn[0]-T[0]*Nn[2],T[0]*Nn[1]-T[1]*Nn[0]];
    for(let j=0;j<M;j++){const s=j/M*Math.PI*2,r=.55;pos.push(...a.map((x,k)=>x+r*(Math.cos(s)*Nn[k]+Math.sin(s)*B[k])))}}
  for(let i=0;i<N;i++)for(let j=0;j<M;j++){const a=i*M+j,b=((i+1)%N)*M+j,c2=((i+1)%N)*M+(j+1)%M,d=i*M+(j+1)%M;tri.push(a,b,c2,a,c2,d)}
  return{pos:Float32Array.from(pos),col:null,tri:Uint32Array.from(tri)};
}
// INVARIANT: normalised to z up, centred on x/y, standing on z=0, 1 unit tall; the bake frames it from its bounds.
function m3dNormalize(mesh,up){
  const p=mesh.pos.slice(),n=p.length/3;
  if(up==='y')for(let i=0;i<n;i++){const y=p[i*3+1],z=p[i*3+2];p[i*3+1]=-z;p[i*3+2]=y}
  let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
  for(let i=0;i<n;i++)for(let k=0;k<3;k++){const v=p[i*3+k];if(v<lo[k])lo[k]=v;if(v>hi[k])hi[k]=v}
  const s=1/Math.max(1e-6,hi[2]-lo[2],(hi[0]-lo[0])*.5,(hi[1]-lo[1])*.5),cx=(lo[0]+hi[0])/2,cy=(lo[1]+hi[1])/2;
  for(let i=0;i<n;i++){p[i*3]=(p[i*3]-cx)*s;p[i*3+1]=(p[i*3+1]-cy)*s;p[i*3+2]=(p[i*3+2]-lo[2])*s}
  return{pos:p,col:mesh.col,tri:mesh.tri,uv:mesh.uv||null,texMask:mesh.texMask||null};
}
// FORMAT: models without UVs get a box layout: each triangle goes to the tile of its dominant face direction,
//   3 x 2 tiles  +X -X +Y / -Y +Z -Z, projected flat from that side, so a painter sees six labelled views.
const M3D_TILES=['+X','-X','+Y','-Y','+Z','-Z'];
function m3dBoxUV(m){
  const p=m.pos,T=m.tri,nt=T.length/3,uv=new Float32Array(nt*6);let lo=[1e9,1e9,1e9],hi=[-1e9,-1e9,-1e9];
  for(let i=0;i<p.length;i+=3)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[i+k]);hi[k]=Math.max(hi[k],p[i+k])}
  const nz=k=>(v)=>(v-lo[k])/Math.max(1e-6,hi[k]-lo[k]),N=[nz(0),nz(1),nz(2)],pad=.04;
  for(let t=0;t<nt;t++){
    const a=T[t*3]*3,b=T[t*3+1]*3,c=T[t*3+2]*3,ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
    const n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx],ax=Math.abs(n[0])>=Math.abs(n[1])&&Math.abs(n[0])>=Math.abs(n[2])?0:Math.abs(n[1])>=Math.abs(n[2])?1:2;
    const neg=n[ax]<0,tile=ax*2+(neg?1:0),tx=tile%3,ty=tile/3|0,[iu,iv]=ax===0?[1,2]:ax===1?[0,2]:[0,1];
    for(let k=0;k<3;k++){const q=T[t*3+k]*3;let u=N[iu](p[q+iu]),v=N[iv](p[q+iv]);if(neg!==(ax===1))u=1-u;
      uv[t*6+k*2]=(tx+pad+u*(1-2*pad))/3;uv[t*6+k*2+1]=1-(ty+pad+(1-v)*(1-2*pad))/2}
  }
  return uv;
}
// INVARIANT: the UV layout painted on is the one baked with: same normalisation, same up axis.
function m3dUV(mesh,opt){const m=m3dNormalize(mesh,opt.up);return{m,uv:m.uv||m3dBoxUV(m),box:!m.uv}}
function m3dGuide(mesh,opt,w=512,h=512){
  const {uv,box,m}=m3dUV(mesh,opt),c=mkEl('canvas');c.width=w;c.height=h;const g=c.getContext('2d');
  if(box){g.font='bold 20px sans-serif';g.fillStyle='rgba(40,80,200,.55)';M3D_TILES.forEach((t,i)=>{g.strokeStyle='rgba(40,80,200,.35)';g.strokeRect((i%3)*w/3,(i/3|0)*h/2,w/3,h/2);g.fillText(t,(i%3)*w/3+8,(i/3|0)*h/2+24)})}
  g.strokeStyle='rgba(255,46,136,.75)';g.lineWidth=1;g.beginPath();
  for(let t=0;t<m.tri.length/3;t++){if(m.texMask&&!m.texMask[t])continue;for(let k=0;k<=3;k++){const j=t*6+(k%3)*2,x=(uv[j]%1+1)%1*w,y=(1-((uv[j+1]%1+1)%1))*h;k?g.lineTo(x,y):g.moveTo(x,y)}}
  g.stroke();return c.toDataURL('image/png');
}
async function m3dTexData(url){
  if(!url)return null;const img=new Image();img.src=url;try{await img.decode()}catch(e){return null}
  const c=mkEl('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(img,0,0);
  return{w:c.width,h:c.height,d:g.getImageData(0,0,c.width,c.height).data};
}
// PERF: smooth normals weld by quantised position first, so unshared STL vertices still share a normal.
function m3dNormals(m,flat){
  const T=m.tri,p=m.pos,nt=T.length/3,fn=new Float32Array(nt*3);
  for(let t=0;t<nt;t++){const a=T[t*3]*3,b=T[t*3+1]*3,c=T[t*3+2]*3;
    const ux=p[b]-p[a],uy=p[b+1]-p[a+1],uz=p[b+2]-p[a+2],vx=p[c]-p[a],vy=p[c+1]-p[a+1],vz=p[c+2]-p[a+2];
    fn[t*3]=uy*vz-uz*vy;fn[t*3+1]=uz*vx-ux*vz;fn[t*3+2]=ux*vy-uy*vx}
  if(flat)return{face:fn,vert:null};
  const key=new Map(),wid=new Uint32Array(p.length/3);
  for(let i=0;i<wid.length;i++){const k=`${Math.round(p[i*3]*1e4)},${Math.round(p[i*3+1]*1e4)},${Math.round(p[i*3+2]*1e4)}`;let w=key.get(k);if(w===undefined)key.set(k,w=key.size);wid[i]=w}
  const acc=new Float32Array(key.size*3);
  for(let t=0;t<nt;t++)for(let k=0;k<3;k++){const w=wid[T[t*3+k]]*3;acc[w]+=fn[t*3];acc[w+1]+=fn[t*3+1];acc[w+2]+=fn[t*3+2]}
  const vert=new Float32Array(p.length);
  for(let i=0;i<wid.length;i++){const w=wid[i]*3,l=Math.hypot(acc[w],acc[w+1],acc[w+2])||1;vert[i*3]=acc[w]/l;vert[i*3+1]=acc[w+1]/l;vert[i*3+2]=acc[w+2]/l}
  return{face:fn,vert};
}


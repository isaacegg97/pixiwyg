// SECTION: bake
// RULE: orthographic views like the raycaster's traceProto, but rasterised with a z-buffer instead of ray-traced, so
//   a 20k-triangle mesh bakes 32 views in well under a second. Light is fixed to the camera (key upper left), so the
//   turntable reads as the model turning under studio light.
async function m3dBake(mesh,opt,onView,tex=null){
  const {m,uv}=m3dUV(mesh,opt),N=m3dNormals(m,opt.flat),p=m.pos,T=m.tri,nt=T.length/3,tm=m.texMask;
  const els=M3D_ROWS[opt.rows]||M3D_ROWS[2],AZ=opt.az,S=opt.cell,R=S*M3D_SS;
  let top=0;for(let i=2;i<p.length;i+=3)top=Math.max(top,p[i]);
  const cz=top/2;let Rb=0;for(let i=0;i<p.length;i+=3)Rb=Math.max(Rb,Math.hypot(p[i],p[i+1],p[i+2]-cz));Rb*=1.03;
  const base=[1,3,5].map(k=>parseInt(opt.color.slice(k,k+2),16)/255);
  const W=AZ*S,H=els.length*S,col=new ImageData(W,H),nrm=new ImageData(W,H);
  const cr=new Float32Array(R*R*3),cn=new Float32Array(R*R*3),zb=new Float32Array(R*R),sx=new Float32Array(p.length/3),sy=new Float32Array(sx.length),sd=new Float32Array(sx.length);
  let Lx=-.45,Ly=.6,Lz=.65;{const l=Math.hypot(Lx,Ly,Lz);Lx/=l;Ly/=l;Lz/=l}
  let Hx=Lx,Hy=Ly,Hz=Lz+1;{const l=Math.hypot(Hx,Hy,Hz);Hx/=l;Hy/=l;Hz/=l}
  for(let ei=0;ei<els.length;ei++)for(let ai=0;ai<AZ;ai++){
    const az=ai/AZ*Math.PI*2,el=els[ei],ce=Math.cos(el),se=Math.sin(el);
    const cx=ce*Math.cos(az),cy=ce*Math.sin(az),czv=se,rx=Math.sin(az),ry=-Math.cos(az),ux=-se*Math.cos(az),uy=-se*Math.sin(az),uz=ce;
    for(let i=0;i<sx.length;i++){const x=p[i*3],y=p[i*3+1],z=p[i*3+2]-cz;
      sx[i]=(( x*rx+y*ry)/(2*Rb)+.5)*R;sy[i]=(.5-(x*ux+y*uy+z*uz)/(2*Rb))*R;sd[i]=-(x*cx+y*cy+z*czv)}
    zb.fill(1e9);
    for(let t=0;t<nt;t++){
      const a=T[t*3],b=T[t*3+1],c=T[t*3+2],ax=sx[a],ay=sy[a],bx=sx[b],by=sy[b],qx=sx[c],qy=sy[c];
      const area=(bx-ax)*(qy-ay)-(by-ay)*(qx-ax);if(Math.abs(area)<1e-9)continue;
      const x0=Math.max(0,Math.floor(Math.min(ax,bx,qx))),x1=Math.min(R-1,Math.ceil(Math.max(ax,bx,qx))),y0=Math.max(0,Math.floor(Math.min(ay,by,qy))),y1=Math.min(R-1,Math.ceil(Math.max(ay,by,qy)));
      for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
        const px=x+.5,py=y+.5,w0=((bx-px)*(qy-py)-(by-py)*(qx-px))/area,w1=((qx-px)*(ay-py)-(qy-py)*(ax-px))/area,w2=1-w0-w1;
        if(w0<0||w1<0||w2<0)continue;
        const d=w0*sd[a]+w1*sd[b]+w2*sd[c],i=y*R+x;if(d>=zb[i])continue;zb[i]=d;
        let nx,ny,nz;
        if(N.vert){const v=N.vert;nx=w0*v[a*3]+w1*v[b*3]+w2*v[c*3];ny=w0*v[a*3+1]+w1*v[b*3+1]+w2*v[c*3+1];nz=w0*v[a*3+2]+w1*v[b*3+2]+w2*v[c*3+2]}
        else{nx=N.face[t*3];ny=N.face[t*3+1];nz=N.face[t*3+2]}
        let vx=nx*rx+ny*ry,vy=nx*ux+ny*uy+nz*uz,vz=nx*cx+ny*cy+nz*czv;const l=Math.hypot(vx,vy,vz)||1;vx/=l;vy/=l;vz/=l;
        // RULE: open meshes and flipped winding show their inside; face the normal at the camera rather than cull.
        if(vz<0){vx=-vx;vy=-vy;vz=-vz}
        const diff=Math.max(0,vx*Lx+vy*Ly+vz*Lz),spec=Math.pow(Math.max(0,vx*Hx+vy*Hy+vz*Hz),24)*.22,lit=.3+.78*diff;
        const k=i*3,mc=m.col;
        const q9=t*9;let r=mc?w0*mc[q9]+w1*mc[q9+3]+w2*mc[q9+6]:base[0],g=mc?w0*mc[q9+1]+w1*mc[q9+4]+w2*mc[q9+7]:base[1],bl=mc?w0*mc[q9+2]+w1*mc[q9+5]+w2*mc[q9+8]:base[2];
        // RULE: orthographic, so affine UV interpolation is exact; transparent paint lets the base colour through.
        if(tex&&(!tm||tm[t])){const j=t*6,u=w0*uv[j]+w1*uv[j+2]+w2*uv[j+4],v=w0*uv[j+1]+w1*uv[j+3]+w2*uv[j+5];
          const tx=Math.min(tex.w-1,((u%1+1)%1*tex.w)|0),ty=Math.min(tex.h-1,((1-((v%1+1)%1))*tex.h)|0),q=(ty*tex.w+tx)*4,ta=tex.d[q+3]/255;
          r+=(tex.d[q]/255-r)*ta;g+=(tex.d[q+1]/255-g)*ta;bl+=(tex.d[q+2]/255-bl)*ta}
        cr[k]=Math.min(1,r*lit+spec);cr[k+1]=Math.min(1,g*lit+spec);cr[k+2]=Math.min(1,bl*lit+spec);cn[k]=vx*.5+.5;cn[k+1]=vy*.5+.5;cn[k+2]=vz*.5+.5;
      }
    }
    // PERF: box-filter the supersampled cell straight into the atlas; colour averages over covered samples only.
    const ox=ai*S,oy=ei*S,ss=M3D_SS*M3D_SS;
    for(let y=0;y<S;y++)for(let x=0;x<S;x++){
      let n=0,r=0,g=0,b=0,qr=0,qg=0,qb=0;
      for(let j=0;j<M3D_SS;j++)for(let i=0;i<M3D_SS;i++){const s=(y*M3D_SS+j)*R+x*M3D_SS+i;if(zb[s]>=1e9)continue;n++;const k=s*3;r+=cr[k];g+=cr[k+1];b+=cr[k+2];qr+=cn[k];qg+=cn[k+1];qb+=cn[k+2]}
      const o=((oy+y)*W+ox+x)*4;if(!n)continue;
      col.data[o]=r/n*255;col.data[o+1]=g/n*255;col.data[o+2]=b/n*255;col.data[o+3]=n/ss*255;
      nrm.data[o]=qr/n*255;nrm.data[o+1]=qg/n*255;nrm.data[o+2]=qb/n*255;nrm.data[o+3]=n/ss*255;
    }
    if(onView)onView(ei*AZ+ai,AZ*els.length);
    await new Promise(r=>setTimeout(r,0));
  }
  const url=d=>{const c=mkEl('canvas');c.width=W;c.height=H;c.getContext('2d').putImageData(d,0,0);return c.toDataURL('image/png')};
  return{atlas:url(col),normals:url(nrm),cols:AZ,rows:els.length,cell:S,els,tris:nt};
}


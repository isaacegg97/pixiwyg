// SECTION: painting
const PAINT=new Set(['brush','pencil','rainbow','spray','bubbles','stamp','bucket','eraser']);
const BRUSHES=['brush','pencil','rainbow','spray','bubbles'];
function pickColor(p){
  const x=Math.floor(p.x*sdpr),y=Math.floor(p.y*sdpr);if(x<0||y<0||x>=paint.width||y>=paint.height)return;
  const d=flatPixel(x,y);
  const hex=d[3]<10?'#ffffff':'#'+[d[0],d[1],d[2]].map(v=>Math.round(v*d[3]/255+255*(1-d[3]/255)).toString(16).padStart(2,'0')).join('');
  setColor(hex);
}
let stroke=null,hue=0,sprayTimer=null;
const stampSize=()=>16+state.size*3;
function seg(a,b){ctx.save();ctx.lineCap=ctx.lineJoin='round';
  // INVARIANT: inside a stroke buffer the eraser paints its mark; the composite step does the erasing.
  if(state.tool==='eraser'){ctx.globalCompositeOperation=sbuf?'source-over':'destination-out';ctx.lineWidth=state.size*3;ctx.strokeStyle='#000'}
  else{ctx.lineWidth=state.size;ctx.strokeStyle=state.tool==='rainbow'?`hsl(${hue=(hue+7)%360} 95% 55%)`:state.color}
  ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x+.01,b.y);ctx.stroke();ctx.restore()}
function sprayAt(p){ctx.fillStyle=state.color;const r=state.size*2.5;for(let i=0;i<state.size*2;i++){const a=Math.random()*Math.PI*2,d=Math.random()*r;ctx.fillRect(p.x+Math.cos(a)*d,p.y+Math.sin(a)*d,1.5,1.5)}}
function bubbleAt(p){ctx.save();const r=state.size*(.6+Math.random()*.9)+3;ctx.beginPath();ctx.arc(p.x+(Math.random()-.5)*state.size,p.y+(Math.random()-.5)*state.size,r,0,Math.PI*2);ctx.fillStyle='rgba(255,255,255,.65)';ctx.fill();ctx.lineWidth=2;ctx.strokeStyle=state.color;ctx.stroke();ctx.beginPath();ctx.arc(p.x-r*.3,p.y-r*.3,r*.22,0,Math.PI*2);ctx.fillStyle='#fff';ctx.fill();ctx.restore()}
function stampAt(p,ch=state.stamp,s=stampSize()){ctx.save();ctx.font=`${s}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(ch,p.x,p.y);ctx.restore()}
function hexRgb(h){const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255]}
function flood(x,y,hex){
  const cw=paint.width,ch=paint.height;const sx=Math.floor(x*sdpr),sy=Math.floor(y*sdpr);if(sx<0||sy<0||sx>=cw||sy>=ch)return;
  const img=ctx.getImageData(0,0,cw,ch),d=img.data,i0=(sy*cw+sx)*4,t=[d[i0],d[i0+1],d[i0+2],d[i0+3]];
  const [r,g,b]=hexRgb(hex);if(t[0]===r&&t[1]===g&&t[2]===b&&t[3]===255)return;
  const seen=new Uint8Array(cw*ch);
  const ok=(px,py)=>{const k=py*cw+px;if(seen[k])return false;const i=k*4;return Math.abs(d[i]-t[0])+Math.abs(d[i+1]-t[1])+Math.abs(d[i+2]-t[2])+Math.abs(d[i+3]-t[3])<=60};
  const st=[sx,sy];
  while(st.length){const py=st.pop(),px=st.pop();if(!ok(px,py))continue;let l=px,rr=px;while(l>0&&ok(l-1,py))l--;while(rr<cw-1&&ok(rr+1,py))rr++;
    for(let q=l;q<=rr;q++){const k=py*cw+q;seen[k]=1;const i=k*4;d[i]=r;d[i+1]=g;d[i+2]=b;d[i+3]=255;if(py>0&&ok(q,py-1))st.push(q,py-1);if(py<ch-1&&ok(q,py+1))st.push(q,py+1)}}
  ctx.putImageData(img,0,0);
}
function paintDown(p){
  sPush();const t=state.tool;stroke={last:p};bufStart();
  sfx({brush:'click',pencil:'click',rainbow:'blip',spray:'hiss',bubbles:'pop',stamp:'boing',bucket:'glug',eraser:'whoosh'}[t]);
  if(t==='brush'){stroke.br=brushStart(ctx,curBrush(),{color:state.color,size:state.size,scale:sdpr},p,studio.pressure);bufTick();return}
  if(t==='bucket'){flood(p.x,p.y,state.color);stroke=null;sSave();return}
  if(t==='stamp')stampAt(p);
  else if(t==='bubbles')bubbleAt(p);
  else if(t==='spray'){sprayAt(p);clearInterval(sprayTimer);sprayTimer=setInterval(()=>{if(stroke){sprayAt(stroke.last);bufTick()}},30)}
  else seg(p,p);
  bufTick();
}
function paintMove(p){const t=state.tool,L=stroke.last,d=Math.hypot(p.x-L.x,p.y-L.y);
  if(t==='brush'){brushTo(stroke.br,p,studio.pressure);bufTick();return}
  if(t==='pencil'||t==='rainbow'||t==='eraser'){seg(L,p);stroke.last=p}
  else if(t==='spray'){stroke.last=p;sprayAt(p)}
  else if(t==='stamp'){if(d>stampSize()*.9){stampAt(p);stroke.last=p;sfx('click')}}
  else if(t==='bubbles'){if(d>state.size*1.6+4){bubbleAt(p);stroke.last=p}}
  bufTick()}
function paintUp(){clearInterval(sprayTimer);bufEnd();stroke=null;sSave();if(studio.frames&&studio.frames.length>1)thumbNow()}


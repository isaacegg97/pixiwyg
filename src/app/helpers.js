// SECTION: shared helpers
const mkEl=(t,p)=>Object.assign(document.createElement(t),p||{});
const viewCenter=()=>{const r=stage.getBoundingClientRect(),d=desk.getBoundingClientRect();return{x:Math.round((d.left+d.width/2-r.left)/Z),y:Math.round((d.top+d.height/2-r.top)/Z)}};
function imgSize(src){return new Promise(res=>{const i=new Image();i.onload=()=>res({w:i.naturalWidth,h:i.naturalHeight});i.onerror=()=>res({w:0,h:0});i.src=src})}
function isBlankImage(src){return new Promise(res=>{const i=new Image();i.onload=()=>{const c=document.createElement('canvas');c.width=Math.max(1,Math.min(400,i.width));c.height=Math.max(1,Math.round(c.width*i.height/i.width));const x=c.getContext('2d');x.drawImage(i,0,0,c.width,c.height);const d=x.getImageData(0,0,c.width,c.height).data;for(let k=3;k<d.length;k+=4)if(d[k]>8){res(false);return}res(true)};i.onerror=()=>res(true);i.src=src})}
function trimmedCanvas(c){
  // INVARIANT: an empty canvas has nothing to trim; reading it would throw.
  if(!c.width||!c.height)return null;
  const x=c.getContext('2d'),w=c.width,h=c.height,d=x.getImageData(0,0,w,h).data;let x0=w,y0=h,x1=-1,y1=-1;
  for(let y=0;y<h;y++){const row=y*w*4;for(let i=0;i<w;i++)if(d[row+i*4+3]>0){if(i<x0)x0=i;if(i>x1)x1=i;if(y<y0)y0=y;y1=y}}
  if(x1<0)return null;const pad=2;x0=Math.max(0,x0-pad);y0=Math.max(0,y0-pad);x1=Math.min(w-1,x1+pad);y1=Math.min(h-1,y1+pad);
  const o=document.createElement('canvas');o.width=x1-x0+1;o.height=y1-y0+1;o.getContext('2d').drawImage(c,x0,y0,o.width,o.height,0,0,o.width,o.height);return o;
}
function showWin(id){const w=$('#'+id);setSide(w.closest('.side').id,true);if(w.role==='tabpanel')setTab(id);else if(w.tagName==='DETAILS')w.open=true;w.scrollIntoView({block:'nearest'})}
function withCtx(c,fn){const old=ctx;ctx=c;try{fn()}finally{ctx=old}}
function drawSeedArt(ox,oy){
  ctx.save();ctx.translate(ox,oy);
  ctx.save();ctx.lineCap=ctx.lineJoin='round';ctx.lineWidth=16;
  let last=null;for(let x=30;x<=930;x+=6){const y=592+Math.sin(x/70)*22;if(last){ctx.strokeStyle=`hsl(${(x*.6)%360} 95% 58%)`;ctx.beginPath();ctx.moveTo(last.x,last.y);ctx.lineTo(x,y);ctx.stroke()}last={x,y}}
  ctx.restore();
  stampAt({x:890,y:540},'🐴',58);stampAt({x:410,y:104},'⭐',30);stampAt({x:560,y:32},'⭐',22);stampAt({x:520,y:150},'⭐',18);stampAt({x:460,y:470},'🌵',46);
  const sc=state.color,ss=state.size;state.color='#ff2e88';state.size=14;for(let i=0;i<40;i++)sprayAt({x:380+Math.random()*90,y:520+Math.random()*40});
  state.color='#2e5bff';state.size=7;for(let i=0;i<7;i++)bubbleAt({x:780+i*22,y:420+Math.sin(i)*14});state.color=sc;state.size=ss;
  ctx.restore();
}


// SECTION: selection
// INVARIANT: studio.sel is {x,y,w,h} in device pixels, always inside the canvas; null is "everything".
const ssel=$('#ssel'),selCtx=ssel.getContext('2d');
studio.sel=null;
function drawSel(){
  ssel.width=paint.width;ssel.height=paint.height;selCtx.clearRect(0,0,ssel.width,ssel.height);const s=studio.sel;
  $('#selBar').hidden=!s;if(!s)return;
  const lw=Math.max(1,paint.width/600);selCtx.lineWidth=lw;
  for(const [c,o] of [['#000',0],['#fff',4*lw]]){selCtx.strokeStyle=c;selCtx.setLineDash([4*lw,4*lw]);selCtx.lineDashOffset=o;selCtx.strokeRect(s.x+lw/2,s.y+lw/2,s.w-lw,s.h-lw)}
  $('#selInfo').textContent=`${Math.round(s.w/sdpr)} × ${Math.round(s.h/sdpr)}`;
}
const clampSel=r=>{const x0=Math.max(0,Math.min(r.x,r.x+r.w)),y0=Math.max(0,Math.min(r.y,r.y+r.h)),x1=Math.min(paint.width,Math.max(r.x,r.x+r.w)),y1=Math.min(paint.height,Math.max(r.y,r.y+r.h));
  return x1-x0>=1&&y1-y0>=1?{x:Math.round(x0),y:Math.round(y0),w:Math.round(x1-x0),h:Math.round(y1-y0)}:null};
const inSel=(s,x,y)=>s&&x>=s.x&&y>=s.y&&x<s.x+s.w&&y<s.y+s.h;
let sdragSel=null;
function selDown(p){
  const x=p.x*sdpr,y=p.y*sdpr,s=studio.sel;
  if(inSel(s,x,y)){
    // RULE: dragging inside the selection lifts those pixels and moves them; the hole stays transparent.
    sPush();const fl=imgCanvas(s.w,s.h);fl.getContext('2d').drawImage(paint,s.x,s.y,s.w,s.h,0,0,s.w,s.h);
    ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(s.x,s.y,s.w,s.h);ctx.restore();
    const base=imgCanvas(paint.width,paint.height);base.getContext('2d').drawImage(paint,0,0);
    sdragSel={mode:'move',x0:x,y0:y,s0:{...s},fl,base};return;
  }
  sdragSel={mode:'new',x0:x,y0:y};studio.sel=null;drawSel();
}
function selMove(p){
  const d=sdragSel;if(!d)return;const x=p.x*sdpr,y=p.y*sdpr;
  if(d.mode==='new'){studio.sel=clampSel({x:d.x0,y:d.y0,w:x-d.x0,h:y-d.y0});drawSel();return}
  const nx=Math.round(d.s0.x+x-d.x0),ny=Math.round(d.s0.y+y-d.y0);
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,paint.width,paint.height);ctx.drawImage(d.base,0,0);ctx.drawImage(d.fl,nx,ny);ctx.restore();
  studio.sel={x:nx,y:ny,w:d.s0.w,h:d.s0.h};drawSel();
}
function selUp(){const d=sdragSel;sdragSel=null;if(!d)return;if(d.mode==='move'){studio.sel=clampSel(studio.sel);drawSel();sSave();thumbNow()}else if(studio.sel&&(studio.sel.w<3||studio.sel.h<3)){studio.sel=null;drawSel()}}
function selClear(){const s=studio.sel;if(!s)return;sPush();ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(s.x,s.y,s.w,s.h);ctx.restore();sSave();thumbNow();sfx('whoosh')}
function selCrop(){
  const s=studio.sel;if(!s)return;studio.sel=null;
  remapLayers(s.w/sdpr,s.h/sdpr,(g,o,c)=>g.drawImage(o,s.x,s.y,s.w,s.h,0,0,c.width,c.height));status(`Cropped to ${SW} × ${SH}, every layer. Undo starts again from here, as with Trim.`);
}
function selAll(){studio.sel={x:0,y:0,w:paint.width,h:paint.height};drawSel()}
function selNone(){studio.sel=null;drawSel()}

// SECTION: transforms
// RULE: transforms turn the whole drawing, every layer alike; size changes go through remapLayers (layers.js).
function flipCanvas(h){sPushStack();for(const L of studio.layers){const c=imgCanvas(L.c.width,L.c.height),g=c.getContext('2d');g.translate(h?c.width:0,h?0:c.height);g.scale(h?-1:1,h?1:-1);g.drawImage(L.c,0,0);
  const x=L.c.getContext('2d');x.save();x.setTransform(1,0,0,1,0,0);x.clearRect(0,0,c.width,c.height);x.drawImage(c,0,0);x.restore()}sSave();thumbNow();layerThumbs(true);sfx('blip')}
function rotate90(cw){studio.sel=null;remapLayers(SH,SW,(g,o,c)=>{g.translate(c.width/2,c.height/2);g.rotate(cw?Math.PI/2:-Math.PI/2);g.drawImage(o,-c.height/2,-c.width/2,c.height,c.width)});sfx('blip')}
function scaleBy(k){studio.sel=null;remapLayers(SW*k,SH*k,(g,o,c)=>g.drawImage(o,0,0,c.width,c.height));status(`Resized to ${SW} × ${SH}`)}


// SECTION: brush opacity and blend (stroke buffer)
// RULE: with opacity under 100% or a blend other than normal, a stroke paints at full strength into its own layer
//   and that layer is composited over a snapshot each frame, so overlapping segments never build up.
const BLENDS=[['source-over','Normal'],['source-atop','Paint inside (lock transparency)'],['multiply','Multiply'],['screen','Screen'],['overlay','Overlay'],['darken','Darken'],['lighten','Lighten'],['color-dodge','Colour dodge'],['color-burn','Colour burn'],['hard-light','Hard light'],['soft-light','Soft light'],['difference','Difference'],['exclusion','Exclusion'],['hue','Hue'],['saturation','Saturation'],['color','Colour'],['luminosity','Luminosity']];
state.opacity=1;state.blend='source-over';
let sbuf=null;
function bufStart(){
  if(state.tool==='bucket'||(state.opacity>=1&&state.blend==='source-over'))return;
  const base=imgCanvas(paint.width,paint.height);base.getContext('2d').drawImage(paint,0,0);
  const layer=imgCanvas(paint.width,paint.height),lctx=layer.getContext('2d');lctx.setTransform(sdpr,0,0,sdpr,0,0);
  sbuf={base,layer,real:ctx,raf:0};ctx=lctx;
}
function bufCompose(){
  if(!sbuf)return;const b=sbuf,g=b.real;g.save();g.setTransform(1,0,0,1,0,0);g.clearRect(0,0,paint.width,paint.height);g.drawImage(b.base,0,0);
  g.globalAlpha=state.opacity;g.globalCompositeOperation=state.tool==='eraser'?'destination-out':state.blend;g.drawImage(b.layer,0,0);g.restore();
}
function bufTick(){if(sbuf&&!sbuf.raf)sbuf.raf=requestAnimationFrame(()=>{if(sbuf){sbuf.raf=0;bufCompose()}})}
function bufEnd(){if(!sbuf)return;cancelAnimationFrame(sbuf.raf);ctx=sbuf.real;bufCompose();sbuf=null}


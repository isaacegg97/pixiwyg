// SECTION: 3D models as primitives
// FORMAT: baked = an ordinary element primitive (the sprite and model3d.css only: small, can't re-bake);
//   unbaked = kind 'model' {src, tex?, opt, thumb}: the model itself, baked fresh wherever it's placed.
function m3dThumb(){const b=m3d.bake,c=mkEl('canvas');c.width=c.height=96;const img=$('#m3dAtlas');c.getContext('2d').drawImage(img,m3d.opt.frame*b.cell,m3d.opt.row*b.cell,b.cell,b.cell,0,0,96,96);return c.toDataURL('image/png')}
function m3dSavePrim(baked){
  if(!m3d.bake)return null;const name=m3d.name||'3D model';
  if(baked){
    const el={tag:'div',content:'',w:m3d.opt.w,extra:'',attrs:{}};m3dApply(el);delete el.attrs['data-px3d-src'];delete el.attrs['data-px3d-tex'];
    return addPrim({kind:'element',name:name+' (sprite)',data:{el,style:{sheet:'model3d.css',lib:null,selector:'div.px3d',css:M3D_CSS}}});
  }
  return addPrim({kind:'model',name,data:{src:m3d.src,tex:m3d.tex||undefined,opt:JSON.parse(m3dSettings(m3d.opt)),thumb:m3dThumb()}});
}
async function m3dUsePrim(p,at){
  const mesh=m3dFromURL(p.data.src);if(!mesh)return null;
  await m3dSetModel(mesh,p.data.src,p.data.tex||null,{...p.data.opt,name:p.name});
  return m3dPlace(at);
}
for(const [id,k,num] of [['m3dAz','az',1],['m3dRows','rows',1],['m3dCell','cell',1],['m3dColor','color'],['m3dUp','up']])
  $('#'+id).onchange=()=>{const v=$('#'+id).value;m3d.opt[k]=num?+v:v;m3dRebake()};
$('#m3dFlat').onchange=()=>{m3d.opt.flat=$('#m3dFlat').checked;m3dRebake()};
$('#m3dSpin').onchange=()=>{m3d.opt.spin=$('#m3dSpin').checked};
$('#m3dDrag').onchange=()=>{m3d.opt.drag=$('#m3dDrag').checked;if(m3d.opt.drag&&expOpt.nojs)status('Drag needs the page script: exports are set to script-free, which keep the spin but not the drag. Change it under Export HTML.')};
$('#m3dDur').onchange=()=>{m3d.opt.dur=Math.max(.5,Math.min(60,+$('#m3dDur').value||4))};
$('#m3dFile').onchange=async e=>{const fs=[...e.target.files];e.target.value='';if(fs.length)await m3dLoadFiles(await Promise.all(fs.map(async f=>({name:f.name,bytes:new Uint8Array(await f.arrayBuffer())}))))};
$('#m3dSampleBtn').onclick=()=>{audio();m3dLoadSample()};
$('#m3dPlace').onclick=async()=>{audio();await m3dFlush();m3dPlace()};
$('#m3dUpdate').onclick=async()=>{audio();await m3dFlush();m3dUpdate()};
$('#m3dDlAtlas').onclick=()=>{if(m3d.bake)download(dataURLBlob(m3d.bake.atlas),slug(m3d.name||'model')+'-atlas.png')};
$('#m3dDlNormals').onclick=()=>{if(m3d.bake)download(dataURLBlob(m3d.bake.normals),slug(m3d.name||'model')+'-normals.png')};
$('#m3dPaint').onclick=()=>{audio();m3dPaint()};
$('#m3dPrimBaked').onclick=async()=>{audio();await m3dFlush();if(m3dSavePrim(true))showWin('w-prims')};
$('#m3dPrimModel').onclick=async()=>{audio();await m3dFlush();if(m3dSavePrim(false))showWin('w-prims')};
$('#m3dClose').onclick=()=>{if(document.body.dataset.ws==='model')setWorkspace('page');else closeM3d()};
// RULE: drag the preview to turn it: sideways steps the angle, up and down the camera height.
$('#m3dView').addEventListener('pointerdown',e=>{if(!m3d.bake)return;$('#m3dView').setPointerCapture(e.pointerId);m3d.drag={x:e.clientX,y:e.clientY,f:m3d.opt.frame,r:m3d.opt.row}});
$('#m3dView').addEventListener('pointermove',e=>{const d=m3d.drag,b=m3d.bake;if(!d||!b)return;
  m3d.opt.frame=((d.f+Math.round((e.clientX-d.x)/12))%b.cols+b.cols)%b.cols;m3d.opt.row=Math.max(0,Math.min(b.rows-1,d.r-Math.round((e.clientY-d.y)/30)));m3dDraw()});
$('#m3dView').addEventListener('pointerup',()=>{m3d.drag=null});
const dataURLBlob=u=>{const m=/^data:([^;]+);base64,(.*)$/.exec(u);return new Blob([b64bytes(m[2])],{type:m[1]})};


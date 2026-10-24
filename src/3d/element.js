// SECTION: the page element
function m3dSheet(){
  let f=state.files.find(x=>x.name==='model3d.css'&&!x.lib);
  if(!f){f=addFile('model3d.css',M3D_CSS,false);afterFilesChanged()}
  // COMPAT: sheets written before drag existed are brought up to date; a sheet someone edited is left alone.
  else if(f.text.startsWith('.px3d{')&&!f.text.includes('.px3d.drag')&&f.text.length<400){f.text=M3D_CSS;compileFile(f);afterFilesChanged()}
  else if(!f.enabled){f.enabled=true;afterFilesChanged()}
  return f;
}
function m3dStyle(b,o){
  const x=b.cols>1?Math.min(o.frame,b.cols-1)/(b.cols-1)*100:0,y=b.rows>1?Math.min(o.row,b.rows-1)/(b.rows-1)*100:0;
  return`background-image:url("${b.atlas}");background-size:${b.cols*100}% ${b.rows*100}%;background-position:${+x.toFixed(4)}% ${+y.toFixed(4)}%;--px3d-n:${b.cols};--px3d-dur:${o.dur}s`;
}
const m3dSettings=o=>JSON.stringify({name:m3d.name,az:o.az,rows:o.rows,cell:o.cell,color:o.color,up:o.up,flat:o.flat,frame:o.frame,row:o.row,spin:o.spin,drag:o.drag,dur:o.dur});
function m3dApply(el){
  const b=m3d.bake,o=m3d.opt;
  el.attrs={...(el.attrs||{}),style:m3dStyle(b,o),'data-px3d':m3dSettings(o),'data-px3d-src':m3d.src,role:'img','aria-label':m3d.name||'3D model'};
  if(m3d.tex)el.attrs['data-px3d-tex']=m3d.tex;else delete el.attrs['data-px3d-tex'];
  el.extra=[o.spin&&'spin',o.drag&&'drag'].filter(Boolean).join(' ');
}
function m3dPlace(at){
  if(!m3d.bake||!state.project)return null;
  const f=m3dSheet(),c=at||viewCenter(),w=m3d.opt.w;pushUndo();
  const el={id:nid('e'),tag:'div',fileId:f.id,selector:'div.px3d',content:'',x:Math.round(at?c.x:c.x-w/2),y:Math.round(at?c.y:c.y-w/2),w,z:maxZ()+1};
  m3dApply(el);state.els.push(el);renderEl(el);m3d.editing=el.id;select(el.id);save();sfx('pop');
  status(`Placed ${m3d.name||'the model'}: ${m3d.bake.cols*m3d.bake.rows} angles in one image.`);m3dSync();
  return el;
}
function m3dUpdate(){
  const el=state.els.find(e=>e.id===m3d.editing);if(!el||!m3d.bake)return null;
  pushUndo();m3dApply(el);renderEl(el);updateSel();save();status('Updated the model on the page.');return el;
}
const isM3d=el=>!!(el&&el.attrs&&el.attrs['data-px3d']);


// SECTION: filter panel
const fxs={cur:null,base:null,baseURL:null,vals:{},t:0,busy:false};
function openFx(){$('#fxPanel').hidden=false;drawFxList();if(!fxs.cur)pickFx('adjust');}
function closeFx(apply){
  if(fxs.base){if(apply){studio.undo.push({id:fxs.layer,url:fxs.baseURL});if(studio.undo.length>30)studio.undo.shift();studio.redo.length=0;sSave();thumbNow();sfx('boing')}else restoreBase()}
  fxs.base=null;fxs.baseURL=null;fxs.cur=null;$('#fxPanel').hidden=true;
}
function restoreBase(){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,paint.width,paint.height);ctx.drawImage(fxs.base,0,0);ctx.restore()}
function drawFxList(){
  const box=$('#fxList');box.replaceChildren();let g='';
  for(const f of FX){if(f.group!==g){g=f.group;box.append(mkEl('h4',{textContent:g}))}
    const b=mkEl('button',{type:'button',className:'fxitem'+(fxs.cur&&fxs.cur.id===f.id?' on':''),textContent:f.name});b.onclick=()=>{audio();pickFx(f.id)};box.append(b)}
}
function pickFx(id){
  const f=FX.find(x=>x.id===id);if(!f)return;
  if(!fxs.base){fxs.base=imgCanvas(paint.width,paint.height);fxs.base.getContext('2d').drawImage(paint,0,0);fxs.baseURL=paint.toDataURL();fxs.layer=activeLayer().id}else restoreBase();
  fxs.cur=f;fxs.vals={};$('#fxName').textContent=f.name;const box=$('#fxParams');box.replaceChildren();
  for(const [k,label,a,b,step,def] of f.params){
    const row=mkEl('label',{className:'fxrow'}),val=mkEl('span',{className:'fxval'});row.append(mkEl('span',{textContent:label}));let inp;
    if(a==='color'){inp=mkEl('input',{type:'color',value:b});fxs.vals[k]=b}
    else if(Array.isArray(a)){inp=mkEl('select');for(const o of a)inp.append(mkEl('option',{value:o,textContent:o}));inp.value=b;fxs.vals[k]=b}
    else{inp=mkEl('input',{type:'range',min:a,max:b,step,value:def});fxs.vals[k]=def;val.textContent=def}
    inp.dataset.k=k;inp.oninput=()=>{const v=inp.type==='range'?+inp.value:inp.value;fxs.vals[k]=v;if(inp.type==='range')val.textContent=v;fxPreview()};
    row.append(inp,val);box.append(row);
  }
  $('#fxNote').textContent=`Applies to ${activeLayer().name}`+(studio.sel?', inside the selection':'')+(studio.frames.length>1?', in this frame':'')+'.';
  drawFxList();fxPreview();
}
// PERF: previews coalesce to one per frame; a slow CPU filter never queues behind itself.
function fxPreview(){if(fxs.t)return;fxs.t=requestAnimationFrame(async()=>{fxs.t=0;if(fxs.busy){fxPreview();return}fxs.busy=true;try{await fxRender()}finally{fxs.busy=false}})}
async function fxRender(){
  const f=fxs.cur;if(!f||!fxs.base)return;let out;
  try{out=await f.run(fxs.base,{...fxs.vals})}catch(e){status(e.message);return}
  if(!fxs.base||fxs.cur!==f)return;
  ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,paint.width,paint.height);
  const s=studio.sel;
  if(s){ctx.drawImage(fxs.base,0,0);ctx.clearRect(s.x,s.y,s.w,s.h);ctx.drawImage(out,s.x,s.y,s.w,s.h,s.x,s.y,s.w,s.h)}else ctx.drawImage(out,0,0);
  ctx.restore();fxRefresh(activeLayer());
}
async function applyFx(id,vals={}){pickFx(id);Object.assign(fxs.vals,vals);await fxRender();closeFx(true)}


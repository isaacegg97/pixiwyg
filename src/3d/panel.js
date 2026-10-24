// SECTION: workspace panel
const M3D_MIME={obj:'model/obj',stl:'model/stl',glb:'model/gltf-binary',gltf:'model/gltf+json'};
const M3D_EXT=/\.(obj|stl|glb|gltf)$/i;
function m3dDataURL(name,bytes){const mime=M3D_MIME[(M3D_EXT.exec(name)||[,'obj'])[1].toLowerCase()];let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return`data:${mime};base64,${btoa(s)}`}
function m3dFromURL(url){const m=/^data:model\/(obj|stl|gltf-binary|gltf\+json);base64,(.*)$/.exec(url||'');if(!m)return null;const b=b64bytes(m[2]);
  return m[1]==='stl'?parseSTL(b):m[1].startsWith('gltf')?parseGLTF(b):parseOBJ(new TextDecoder().decode(b))}
// RULE: a .gltf can name separate .bin and image files; those picked or dropped with it are folded in as data:
//   URIs, so the stored model is one self-contained file like everything else in a project.
// SAFETY: only plain file names are matched against the files given; nothing is ever fetched.
function gltfEmbed(bytes,list){
  const u8=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);if(u8.length>=4&&new DataView(u8.buffer,u8.byteOffset).getUint32(0,true)===0x46546C67)return{bytes:u8,missing:[]};
  const J=JSON.parse(new TextDecoder().decode(u8)),base=n=>{try{n=decodeURIComponent(n)}catch(e){}return n.split(/[\\/]/).pop().toLowerCase()},missing=[];let changed=false;
  const find=uri=>list.find(f=>base(f.name)===base(uri));
  const mimeOf=n=>/\.jpe?g$/i.test(n)?'image/jpeg':/\.webp$/i.test(n)?'image/webp':/\.png$/i.test(n)?'image/png':'application/octet-stream';
  for(const k of ['buffers','images'])for(const it of J[k]||[]){if(!it||typeof it.uri!=='string'||/^data:/.test(it.uri))continue;
    const f=find(it.uri);if(!f){missing.push(base(it.uri));continue}it.uri=`data:${k==='images'?it.mimeType||mimeOf(f.name):'application/octet-stream'};base64,${bytesB64(f.bytes)}`;changed=true}
  return{bytes:changed?te.encode(JSON.stringify(J)):u8,missing};
}
// RULE: a model can arrive with its friends: an OBJ with its .mtl and texture images, picked or dropped together.
//   Images are matched to map_Kd by file name; the MTL is folded into the stored OBJ (see parseOBJ).
async function m3dLoadFiles(list){
  const main=list.find(f=>M3D_EXT.test(f.name));if(!main){status('Pick a .obj, .stl, .glb or .gltf model.');return false}
  const ext=M3D_EXT.exec(main.name)[1].toLowerCase(),base=n=>n.split(/[\\/]/).pop().toLowerCase();
  try{
    let mesh,bytes=main.bytes,tex=null,note='';
    if(ext==='stl')mesh=parseSTL(bytes);
    else if(ext==='glb'||ext==='gltf'){const g=gltfEmbed(bytes,list);bytes=g.bytes;mesh=parseGLTF(bytes);tex=mesh.texture||null;
      const img=g.missing.filter(n=>!/\.bin$/i.test(n));if(img.length)note=` Its texture ${img[0]} wasn't included: pick or drop it together with the model.`}
    else{
      const mf=list.find(f=>/\.mtl$/i.test(f.name)),mtl=mf?new TextDecoder().decode(mf.bytes):null;
      let text=new TextDecoder().decode(bytes);mesh=parseOBJ(text,mtl);
      if(mtl&&!/^#px3d-mtl /m.test(text)){text+=`\n#px3d-mtl ${bytesB64(te.encode(mtl))}\n`;bytes=te.encode(text)}
      if(mesh.textured){const img=list.find(f=>base(f.name)===base(mesh.textured));
        if(img){const mime=/\.jpe?g$/i.test(img.name)?'image/jpeg':/\.webp$/i.test(img.name)?'image/webp':'image/png';tex=`data:${mime};base64,${bytesB64(img.bytes)}`}
        else note=` Its texture ${base(mesh.textured)} wasn't included: pick or drop it together with the model.`}
    }
    m3d.mesh=mesh;m3d.src=m3dDataURL(main.name,bytes);m3d.tex=tex;m3d.texData=await m3dTexData(tex);m3d.name=main.name.replace(/\.[^.]+$/,'');
    m3d.opt.up=ext==='stl'?'z':'y';m3d.editing=null;m3d.scene=m3dSceneFromSrc(m3d.src);m3dHist.undo.length=m3dHist.redo.length=0;
    if(m3d.scene){m3d.opt.up='z';m3dControls();await m3dSceneChanged({bake:false});await m3dRebake();status(m3d.name+' opened as parts.');return true}
    m3dControls();await m3dRebake();if(note)status(m3d.name+' opened.'+note);return true;
  }catch(e){status(e.message);return false}
}
const m3dLoadFile=(name,bytes)=>m3dLoadFiles([{name,bytes}]);
async function m3dLoadSample(){
  const m=m3dSample();m3d.mesh={...m,pos:m.pos};
  // FORMAT: the sample is stored like any upload, as OBJ text, so it re-bakes the same way.
  let t='';for(let i=0;i<m.pos.length;i+=3)t+=`v ${m.pos[i].toFixed(4)} ${m.pos[i+1].toFixed(4)} ${m.pos[i+2].toFixed(4)}\n`;
  for(let i=0;i<m.tri.length;i+=3)t+=`f ${m.tri[i]+1} ${m.tri[i+1]+1} ${m.tri[i+2]+1}\n`;
  m3d.src=m3dDataURL('knot.obj',te.encode(t));m3d.tex=null;m3d.texData=null;m3d.name='Torus knot';m3d.opt={...M3D_DEF,up:'z',color:'#d9a441'};m3d.editing=null;m3d.scene=null;
  m3dControls();await m3dRebake();
}
async function m3dRebake(){
  if(!m3d.mesh)return null;const my=++m3d.busy;$('#m3dInfo').textContent='Baking…';
  const b=await m3dBake(m3d.mesh,m3d.opt,(i,n)=>{if(my===m3d.busy)$('#m3dInfo').textContent=`Baking ${i+1} / ${n}…`},m3d.texData);
  // INVARIANT: a newer bake started while this one ran wins; this result is dropped.
  if(my!==m3d.busy)return null;
  m3d.bake=b;m3d.opt.frame=Math.min(m3d.opt.frame,b.cols-1);m3d.opt.row=Math.min(m3d.opt.row,b.rows-1);m3dSync();return b;
}
function m3dSync(){
  const b=m3d.bake,has=!!b;
  $('#m3dPlace').disabled=!has;$('#m3dUpdate').hidden=!m3d.editing;$('#m3dUpdate').disabled=!has;
  for(const id of ['m3dDlAtlas','m3dDlNormals','m3dPrimBaked','m3dPrimModel','m3dPaint'])$('#'+id).disabled=!has;
  $('#m3dTexNote').textContent=m3d.mesh?(m3d.tex?'Textured. Paint it again to change it; transparent paint shows the colour.':m3dUV(m3d.mesh,m3d.opt).box?'No UV map in the file: painting uses a six-sided box layout.':'Has a UV map: paint straight onto it.'):'';
  $('#m3dName').textContent=m3d.name||'No model yet';
  renderParts();vpLater();
  if(!has){$('#m3dInfo').textContent='Open a model, try the sample, or start from shapes.';m3dDraw();return}
  const kb=Math.round(b.atlas.length*.75/1024);
  $('#m3dInfo').textContent=`${b.tris.toLocaleString()} triangles · ${b.cols} angles × ${b.rows} heights · atlas ${b.cols*b.cell}×${b.rows*b.cell}px, ${kb} KB`;
  $('#m3dAtlas').src=b.atlas;m3dDraw();
}
function m3dDraw(){
  const cv=$('#m3dView'),g=cv.getContext('2d'),b=m3d.bake;g.clearRect(0,0,cv.width,cv.height);if(!b)return;
  const img=$('#m3dAtlas');if(!img.complete){img.onload=m3dDraw;return}
  g.imageSmoothingQuality='high';g.drawImage(img,m3d.opt.frame*b.cell,m3d.opt.row*b.cell,b.cell,b.cell,0,0,cv.width,cv.height);
  $('#m3dFrame').textContent=`angle ${m3d.opt.frame+1}/${b.cols} · height ${m3d.opt.row+1}/${b.rows}`;
}
function m3dControls(){const o=m3d.opt;$('#m3dDrag').checked=o.drag;$('#m3dAz').value=o.az;$('#m3dRows').value=o.rows;$('#m3dCell').value=o.cell;$('#m3dColor').value=o.color;$('#m3dUp').value=o.up;$('#m3dUp').disabled=!!m3d.scene;$('#m3dUp').title=m3d.scene?'Models built from shapes are always z up':'';$('#m3dFlat').checked=o.flat;$('#m3dSpin').checked=o.spin;$('#m3dDur').value=o.dur}
// INVARIANT: opening on a selected 3D element edits it in place; anything else starts from what was last open.
function openM3d(){
  $('#m3dModal').hidden=false;const el=selected();
  if(isM3d(el)){
    let s={};try{s=JSON.parse(el.attrs['data-px3d'])}catch(e){}
    const mesh=(()=>{try{return m3dFromURL(el.attrs['data-px3d-src'])}catch(e){return null}})();
    if(mesh){m3dSetModel(mesh,el.attrs['data-px3d-src'],el.attrs['data-px3d-tex']||null,s,el.id);return}
  }
  m3d.editing=null;m3dControls();m3dSync();
}
function closeM3d(){$('#m3dModal').hidden=true}
// INVARIANT: the one way a stored model (element or primitive) comes back into the panel; settings are type-checked.
async function m3dSetModel(mesh,src,tex,s={},editing=null){
  m3d.mesh=mesh;m3d.src=src;m3d.tex=tex&&okImg(tex)?tex:null;m3d.editing=editing;m3d.texData=await m3dTexData(m3d.tex);m3d.name=s.name||'Model';
  m3d.opt={...M3D_DEF};for(const k of Object.keys(M3D_DEF))if(s[k]!==undefined&&typeof s[k]===typeof M3D_DEF[k])m3d.opt[k]=s[k];
  // RULE: a model built from parts opens as its parts again.
  m3d.scene=m3dSceneFromSrc(src);m3dHist.undo.length=m3dHist.redo.length=0;if(m3d.scene)await m3dSceneChanged({bake:false});
  m3dControls();return m3dRebake();
}

// SECTION: textures from the Paint Studio
// RULE: Paint opens on the texture (or a blank 512 square) with the UV layout drawn over it as a guide; its Update
//   button writes the texture back, re-bakes, and updates the model on the page if one is being edited.
async function m3dPaint(){
  if(!m3d.mesh)return;
  let src=m3d.tex;if(!src){const c=mkEl('canvas');c.width=c.height=512;src=c.toDataURL('image/png')}
  const d=await imgSize(src);studio.guide=m3dGuide(m3d.mesh,m3d.opt,d.w||512,d.h||512);
  await studioOpenImage(src,{kind:'m3d'},d.w||512,d.h||512);
  status('Paint the texture over the UV guide, then press Update. Alt+6 goes back to 3D.');
}
async function m3dSetTexture(src){
  m3d.tex=src;m3d.texData=await m3dTexData(src);await m3dRebake();
  if(m3d.editing&&state.els.some(e=>e.id===m3d.editing))m3dUpdate();
}


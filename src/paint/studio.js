// SECTION: paint studio
let SW=512,SH=512,sdrag=null;
const studio={editing:null,undo:[],redo:[]};
function sizeCanvas(w,h){SW=Math.max(8,Math.min(4096,Math.round(w)));SH=Math.max(8,Math.min(4096,Math.round(h)));sdpr=Math.min(dpr,4096/Math.max(SW,SH));
  const pw=Math.round(SW*sdpr),ph=Math.round(SH*sdpr);for(const L of studio.layers){L.c.width=pw;L.c.height=ph;L.c.getContext('2d',{willReadFrequently:true}).setTransform(sdpr,0,0,sdpr,0,0)}
  ctx=paint.getContext('2d',{willReadFrequently:true});$('#sDims').textContent=`${SW} × ${SH}`;studio.sel=null;drawSel();fitView();fxRefresh()}
const spt=e=>{const r=paint.getBoundingClientRect();return{x:(e.clientX-r.left)*SW/r.width,y:(e.clientY-r.top)*SH/r.height}};
const drawURL=url=>drawInto(paint,url);
function sPush(){studio.undo.push({id:activeLayer().id,url:paint.toDataURL()});if(studio.undo.length>30)studio.undo.shift();studio.redo.length=0}
async function sUndo(){const x=studio.undo.pop();if(!x){status('Nothing to undo in the studio');return}const inv=await undoApply(x);if(inv)studio.redo.push(inv);sSave();sfx('blip')}
async function sRedo(){const x=studio.redo.pop();if(!x){status('Nothing to redo in the studio');return}const inv=await undoApply(x);if(inv)studio.undo.push(inv);sSave();sfx('blip')}
// FORMAT: localStorage pixiwyg.studio = {w, h, img: the flattened drawing, li, layers: [{id, name, opacity, blend, hidden, url}]}.
let sSaveT;function sSave(){layerThumbs();fxRefresh(activeLayer());clearTimeout(sSaveT);sSaveT=setTimeout(()=>{try{const s=stackSnap();localStorage.setItem('pixiwyg.studio',JSON.stringify({w:SW,h:SH,img:flatURL(),li:s.li,layers:s.layers}))}catch(e){}},800)}
const sBlank=()=>studio.layers.every(L=>layerBlank(L.c));
// SAFETY: a stored stack is rebuilt from known fields only; a layer's pixels must be a PNG data URL.
function studioInit(){sizeCanvas(512,512);try{const d=JSON.parse(localStorage.getItem('pixiwyg.studio'));if(d&&(d.img||d.layers)){sizeCanvas(d.w,d.h);
  const png=u=>typeof u==='string'&&/^data:image\/png;base64,/.test(u)?u:null;
  if(Array.isArray(d.layers)&&d.layers.length){studio.layers=d.layers.slice(0,LMAX).map((x,i)=>({id:typeof x.id==='string'?x.id.slice(0,40):lid(),name:String(x.name||'Layer '+(i+1)).slice(0,40),
    opacity:x.opacity==null?1:Math.max(0,Math.min(1,+x.opacity||0)),blend:LAYER_BLENDS.some(b=>b[0]===x.blend)?x.blend:'source-over',hidden:!!x.hidden,
    ...(x.fx&&typeof x.fx.style==='string'&&/^[\w-]{1,40}$/.test(x.fx.style)?{fx:{style:x.fx.style,fill:!!x.fx.fill}}:{}),c:i?layerCanvas():paint}));
    studio.li=Math.max(0,Math.min(studio.layers.length-1,d.li|0));mountLayers();d.layers.forEach((x,i)=>{if(studio.layers[i])drawInto(studio.layers[i].c,png(x.url)).then(()=>layerThumbs(true))})}
  else drawURL(png(d.img))}}catch(e){}renderLayers();syncStudioOut()}
let studioGen=0;
async function studioOpenImage(src,editing=null,w,h){
  // INVARIANT: generation counter; only the latest open wins when two decode concurrently.
  const gen=++studioGen;studioOpening=true;
  try{if(document.body.dataset.ws!=='paint'&&state.project)setWorkspace('paint');else if($('#w-studio').hidden)toggleStudio(true)}finally{studioOpening=false}
  const d=await imgSize(src);if(gen!==studioGen)return;if(!d.w){status('That image could not be opened');return}
  if(!w){w=d.w;h=d.h}else if(!h)h=Math.round(d.h*w/d.w);
  const anim=await decodeAPNG(src);if(gen!==studioGen)return;
  const k=Math.min(1,2048/Math.max(w,h));resetLayers();sizeCanvas(w*k,h*k);studio.undo=[];studio.redo=[];stopFrames();const L1=activeLayer().id;
  if(anim){studio.frames=anim.frames.map(url=>({cels:{[L1]:url},url}));studio.fi=0;studio.fps=anim.fps;$('#fFps').value=[4,6,8,12,15,24].reduce((a,b)=>Math.abs(b-anim.fps)<Math.abs(a-anim.fps)?b:a);await drawURL(anim.frames[0])}
  else{studio.frames=[{cels:{},url:null}];studio.fi=0;await drawURL(src)}
  if(gen!==studioGen)return;renderLayers();drawOnion();drawStrip();studio.editing=editing;syncStudioOut();drawGuide();sSave();
  if(typeof wsSync==='function')wsSync();
}
function syncStudioOut(){
  const e=studio.editing,u=$('#sUpdate');let label='';
  if(e&&e.kind==='el'&&state.els.some(x=>x.id===e.id))label='Update the image on the page';
  else if(e&&e.kind==='prim'&&prims.list.some(x=>x.id===e.id))label='Update the primitive';
  else if(e&&e.kind==='bg'&&state.bgd.layers.some(l=>l.id===e.id))label='Update the background layer';
  else if(e&&e.kind==='m3d'&&m3d.mesh)label='Update the 3D texture';
  else studio.editing=null;
  u.hidden=!label;u.textContent=label;if(!studio.editing||studio.editing.kind!=='m3d'){studio.guide=null;drawGuide()}
  $('#sEditing').textContent=label?'Editing something already in use. Update writes your changes back to it.':'Empty space stays transparent, so drawings work as stickers.';
}
function toggleStudio(show){
  const w=$('#w-studio');if(show===undefined)show=w.hidden;
  w.hidden=!show;state.ctx=show?'studio':'page';if(show)renderBrushes();
  audio();sfx(show?'pop':'whoosh');
}
const sstack=$('#sstack');
// RULE: a hidden layer can't be painted on; the eyedropper still reads the drawing as it shows.
sstack.addEventListener('pointerdown',e=>{
  if(e.button>0)return;audio();state.ctx='studio';
  if(activeLayer().hidden&&state.tool!=='eyedrop'){status(`${activeLayer().name} is hidden. Show it (the eye in Layers) to paint on it.`);sfx('blip');return}
  // FORMAT: studio.pressure is a pen's pressure, 0..1; a mouse or finger is always 1.
  studio.pressure=e.pointerType==='pen'?e.pressure||.5:1;sstack.setPointerCapture(e.pointerId);const p=spt(e);
  if(state.tool==='eyedrop'||(e.altKey&&PAINT.has(state.tool)&&state.tool!=='eraser')){pickColor(p);sfx('blip');sdrag='pick';return}
  if(state.tool==='select'){selDown(p);sdrag='sel';return}
  paintDown(p);sdrag='paint';
});
sstack.addEventListener('pointermove',e=>{if(!sdrag)return;if(activeLayer().v)fxRefresh(activeLayer());studio.pressure=e.pointerType==='pen'?e.pressure||.5:1;const p=spt(e);if(sdrag==='pick')pickColor(p);else if(sdrag==='sel')selMove(p);else if(stroke)paintMove(p)});
const sEnd=()=>{if(sdrag==='paint')paintUp();else if(sdrag==='sel')selUp();sdrag=null};
sstack.addEventListener('pointerup',sEnd);sstack.addEventListener('pointercancel',sEnd);
const sview=$('#sview');
sview.addEventListener('dragover',e=>{e.preventDefault()});
sview.addEventListener('drop',async e=>{e.preventDefault();e.stopPropagation();const f=[...(e.dataTransfer?.files||[])].find(f=>f.type.startsWith('image/'));if(f)studioOpenImage(await readURL(f))});
$('#studioClose').onclick=()=>{if(document.body.dataset.ws==='paint')setWorkspace('page');else toggleStudio(false)};
let newArmed=false;
$('#sNew').onclick=e=>{audio();const b=e.currentTarget;
  if(!sBlank()&&!newArmed){newArmed=true;b.textContent='Discard this canvas?';setTimeout(()=>{newArmed=false;b.textContent='New'},3000);return}
  newArmed=false;b.textContent='New';const v=$('#sSize').value,[w,h]=v==='page'?(isFixed()?[pageDims().w,pageDims().h]:[W,H]):v.split('x').map(Number);
  resetLayers();sizeCanvas(w,h);studio.undo=[];studio.redo=[];studio.editing=null;resetFrames();renderLayers();syncStudioOut();sSave();sfx('pop')};
$('#sOpen').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)studioOpenImage(await readURL(f))};
$('#sUndo').onclick=()=>{audio();sUndo()};$('#sRedo').onclick=()=>{audio();sRedo()};
$('#sClear').onclick=()=>{audio();sPush();clearCanvas();sSave();sfx('whoosh')};
$('#sTrim').onclick=()=>{audio();if(!trimAll()){status('Nothing to trim. The canvas is empty.');return}status(`Trimmed to ${SW} × ${SH}`)};
const needPaint=()=>{if(!anyPaint()){status(sBlank()?'The canvas is empty. Paint something first.':'Only hidden layers have paint on them. Show one first.');return false}return true};
$('#sPlace').onclick=async()=>{audio();if(!needPaint())return;const {base:src,fx}=await studioOutputs(),c=viewCenter();pushUndo();
  const el={id:nid('e'),tag:'img',fileId:null,selector:null,x:Math.round(c.x-SW/2),y:Math.round(c.y-SH/2),w:SW,content:src,attrs:{alt:studio.frames.length>1?'Animation':'Drawing'},z:maxZ()+1};
  state.els.push(el);renderEl(el);pairFx(el,fx);select(el.id);save();sfx('pop');studio.editing={kind:'el',id:el.id};syncStudioOut();
  status(fx?'Placed on the page, with its effects as a second image over it (grouped). Keep painting and press Update to change it.':'Placed on the page. Keep painting and press Update to change it.')};
$('#sAsBg').onclick=async()=>{audio();if(!needPaint())return;const {base:src,fx}=await studioOutputs();pushUndo();const big=SW>=W*.6||SH>=H*.6;
  const L={id:nid('l'),type:'image',src,w:SW,h:SH,fit:big?'cover':'tile',pos:big?'center':'left top',scale:100};
  state.bgd.layers.unshift(L);studio.editing={kind:'bg',id:L.id};const F=pairBgFx(L,fx);if(F)studio.editing.fx=F.id;renderBackground();renderBgWin();showWin('w-bg');save();syncStudioOut();
  status(big?'Set as the page background.':'Tiled across the page background. Change how it fits in the Background window.')};
// RULE: every workspace saves its own work as a file other programs open: .mid, .md, and here .png (APNG with frames).
$('#sSaveFile').onclick=async()=>{audio();if(!needPaint())return;const u=await studioOutput(),b=b64bytes(u.slice(u.indexOf(',')+1));
  const ed=studio.editing&&studio.editing.kind==='el'&&state.els.find(e=>e.id===studio.editing.id),nm=slug((ed&&ed.attrs&&ed.attrs.alt)||(state.project&&state.project.name+' drawing')||'drawing');
  download(new Blob([b],{type:'image/png'}),nm+'.png');status(`Saved ${nm}.png${studio.frames.length>1?`, ${studio.frames.length} frames`:''}`);sfx('boing')};
$('#sSavePrim').onclick=async()=>{audio();if(!needPaint())return;const {base:src,fx}=await studioOutputs(),p=addPrim({kind:'drawing',name:`Drawing ${prims.list.filter(x=>x.kind==='drawing').length+1}`,data:{src,...(fx?{fx}:{}),w:SW,h:SH}});showWin('w-prims');studio.editing={kind:'prim',id:p.id};syncStudioOut()};
$('#sUpdate').onclick=async()=>{audio();const e=studio.editing;if(!e)return;const {base:src,fx}=e.kind==='m3d'?{base:await studioOutput(),fx:null}:await studioOutputs();
  if(e.kind==='el'){const el=state.els.find(x=>x.id===e.id);if(!el)return;pushUndo();el.content=src;renderEl(el);pairFx(el,fx);updateSel();renderInspector();save()}
  else if(e.kind==='prim'){const p=prims.list.find(x=>x.id===e.id);if(!p)return;const {fx:_old,...d}=p.data;p.data={...d,src,w:SW,h:SH,...(fx?{fx}:{})};savePrims();renderPrims()}
  else if(e.kind==='bg'){const L=state.bgd.layers.find(l=>l.id===e.id);if(!L)return;pushUndo();Object.assign(L,{src,w:SW,h:SH});const F=pairBgFx(L,fx);e.fx=F&&F.id;renderBackground();renderBgWin();save()}
  else if(e.kind==='m3d')m3dSetTexture(src);
  sfx('boing');status('Updated')};


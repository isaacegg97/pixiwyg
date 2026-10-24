// SECTION: undo / save
const undo=[],redo=[];
const cloneBg=b=>({base:{...b.base},layers:b.layers.map(l=>({...l,a:l.a&&{...l.a},b:l.b&&{...l.b},c:l.c&&{...l.c}}))});
// PERF: strings (content, data URLs) are shared between snapshots; only the small objects around them are copied.
const cloneEl=e=>({...e,attrs:e.attrs&&{...e.attrs},colors:e.colors&&Object.fromEntries(Object.entries(e.colors).map(([k,v])=>[k,{...v}])),anim:e.anim&&JSON.parse(JSON.stringify(e.anim))});
// PERF: an unchanged serialized field reuses the neighbour snapshot's string, so 40 undo steps over a 300KB
//   manuscript or a large MIDI import hold one copy, not 40.
const keepStr=(k,v)=>{for(const s of [undo[undo.length-1],redo[redo.length-1]])if(s&&s[k]===v)return s[k];return v};
const snap=()=>({site:keepStr('site',JSON.stringify(state.site||null)),brushes:keepStr('brushes',JSON.stringify(state.brushes||[])),groupNames:JSON.stringify(state.groupNames||{}),boxes:keepStr('boxes',JSON.stringify(state.boxes||null)),refs:keepStr('refs',JSON.stringify(state.refs)),syms:keepStr('syms',JSON.stringify(state.syms)),styles:keepStr('styles',JSON.stringify(state.styleGraphs)),docs:keepStr('docs',JSON.stringify(state.docs)),player:state.player,songs:keepStr('songs',JSON.stringify(state.songs)),songId:state.music&&state.music.id,logic:keepStr('logic',JSON.stringify(state.logic||{nodes:[],wires:[]})),els:state.els.map(cloneEl),bgd:cloneBg(state.bgd),canvas:keepStr('canvas',JSON.stringify(state.canvas)),palette:state.palette&&{...state.palette,c:[...state.palette.c]},palOpt:{...palOpt}});
function pushUndo(){undo.push(snap());if(undo.length>40)undo.shift();redo.length=0}
function restoreSnap(s){if('brushes' in s){state.brushes=JSON.parse(s.brushes);renderBrushes()}if('site' in s){state.site=JSON.parse(s.site);if(typeof renderPagesWin==='function')requestAnimationFrame(()=>{renderPagesWin();syncPageCmds()})}if(s.wsEntry&&document.body.dataset.ws==='write')setWorkspace(s.wsEntry);if(s.refs)state.refs=JSON.parse(s.refs);if(s.groupNames)state.groupNames=JSON.parse(s.groupNames);state.multi=new Set();if('boxes' in s){state.boxes=JSON.parse(s.boxes);requestAnimationFrame(boxesSync)}if(s.syms)state.syms=JSON.parse(s.syms);if(s.styles){state.styleGraphs=JSON.parse(s.styles);syncNodeSheet(true)}if(s.docs){state.docs=JSON.parse(s.docs);if(typeof docSync==='function')requestAnimationFrame(docSync)}if(s.logic)state.logic=JSON.parse(s.logic);if('songs' in s){state.songs=JSON.parse(s.songs);state.music=songById(s.songId)||state.songs[0]||null;if(!$('#seqModal').hidden)songSync()}if('player' in s){state.player=s.player;PLAYER.skinChanged();if(!$('#seqModal').hidden)skinSync()}state.els=s.els.map(cloneEl);state.bgd=cloneBg(s.bgd);state.sel=null;if(s.canvas&&s.canvas!==JSON.stringify(state.canvas)){state.canvas=JSON.parse(s.canvas);applyCanvas();renderCanvasWin()}
  if('palette' in s&&(JSON.stringify(s.palette)!==JSON.stringify(state.palette)||JSON.stringify(s.palOpt)!==JSON.stringify(palOpt))){state.palette=s.palette&&{...s.palette,c:[...s.palette.c]};Object.assign(palOpt,s.palOpt);palLabs=null;applyPageColors();buildSwatches();renderPalWin()}
  renderAll();renderBackground();renderBgWin();renderInspector();markCards();save();sfx('blip')}
function doUndo(){if(state.editing)finishEdit();const s=undo.pop();if(!s){status('Nothing to undo');return}redo.push(snap());restoreSnap(s);status('Undo')}
function doRedo(){if(state.editing)finishEdit();const s=redo.pop();if(!s){status('Nothing to redo');return}undo.push(snap());restoreSnap(s);status('Redo')}
function fillAll(c){sPush();ctx.save();ctx.fillStyle=c;ctx.fillRect(0,0,SW,SH);ctx.restore();sfx('glug');sSave()}
function clearCanvas(){ctx.save();ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,paint.width,paint.height);ctx.restore()}
let saveT;
let editGen=0;
function save(){if(typeof mirrorSel==='function')mirrorSel();editGen++;if(typeof boxLayoutLater==='function')boxLayoutLater();if(typeof checksLater==='function')checksLater();if(state.syms.length&&!projLoading)syncSyms();livePing();if(typeof treeLater==='function')treeLater();
  if(state.project&&!projLoading){const ws=document.body.dataset.ws;
    if(ws==='write'&&!drag)for(const el of state.els)if(!el.md&&!(state.editing&&state.editing.id===el.id))confine(el);
    if(ws==='animate'&&!TL.drag&&!TL.playing)requestAnimationFrame(tlRender);}if(!state.project||projLoading||readOnly)return;clearTimeout(saveT);saveT=setTimeout(saveNow,700)}
// COMPAT: the pre-projects single page in localStorage; read once to become the first project.
async function load(){try{const d=JSON.parse(localStorage.getItem(KEY));if(!d||d.v!==1)return false;
  for(const f of d.files){
    if(f.lib){try{const n={...f,text:await fetchLib(f.lib),sample:false};compileFile(n);state.files.push(n)}catch(e){status(`Could not load ${f.lib} from the library`)}}
    else{const n={...f};compileFile(n);state.files.push(n)}
  }
  if(d.color)state.color=d.color;if(d.bg)state.bg=d.bg;
  if(d.palette&&Array.isArray(d.palette.c)&&d.palette.c.length===18)state.palette=d.palette;if(d.palOpt)Object.assign(palOpt,d.palOpt);
  sizeStage(d.W||0,d.H||0);
  state.els=d.els||[];state.nextStyle=d.nextStyle||{};
  if(d.bgd&&d.bgd.base&&Array.isArray(d.bgd.layers))state.bgd=d.bgd;
  // COMPAT: pre-Paint-Studio pages kept a painting under everything; it migrates to a background layer and a primitive.
  if(d.img){state.bgd.layers.unshift({id:nid('l'),type:'image',src:d.img,w:d.W||W,h:d.H||H,fit:'once',pos:'left top',scale:100});state._oldPainting={src:d.img,w:d.W||W,h:d.H||H}}
  state.bgd.layers.forEach(l=>{l.id=l.id||nid('l')});
  return true}catch(e){return false}}


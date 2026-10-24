// SECTION: brush editor
// RULE: every change applies to the brush at once and redraws the live preview (the S stroke and anything you
//   scribbled on it), the brush's swatch and, if it's the brush in hand, the next stroke. The first change of an
//   editing session is one project undo step. Its style is a style graph, edited in the node editor like any other;
//   the editor floats above the node editor so the preview stays in sight while the style changes.
// FORMAT: brEd.view is the tip section on show; it can be Picture before the brush has one (it paints round till then).
const brEd={id:null,pushed:false,doodles:[],live:null,raf:0,view:null};
const brPrev=$('#brPrev');
// FORMAT: a slider's value is the brush's number times its scale (sizes and angles 1:1, fractions as percent).
const BR_SCALE={hardness:100,spacing:100,opacity:100,size:1,angle:1},BR_JSCALE={size:100,angle:100,scatter:100,opacity:100,hue:100};
for(const [v,t] of BRUSH_SHAPES)$('#brShape').append(mkEl('option',{value:v,textContent:t}));
for(const [v,t] of BRUSH_PRESSURE)$('#brPressure').append(mkEl('option',{value:v,textContent:t}));
const edBrush=()=>state.brushes.find(b=>b.id===brEd.id)||null;
function openBrushEditor(id){
  brEd.id=id;brEd.pushed=false;brEd.doodles=[];brEd.view=null;$('#brushEd').hidden=false;fillBrushEditor();brPreviewNow();
}
function closeBrushEditor(){$('#brushEd').hidden=true;brEd.id=null;brEd.live=null}
function brValText(inp){const k=inp.dataset.k||inp.dataset.j,v=+inp.value;
  return inp.dataset.j==='scatter'?(v/100).toFixed(1)+'×':k==='size'&&inp.dataset.k?v+'px':k==='angle'&&inp.dataset.k?v+'°':v+'%'}
function fillBrushEditor(){
  const b=edBrush(),box=$('#brushEd');if(!b){closeBrushEditor();return}
  $('#brEdTitle').textContent=`Brush · ${b.name}`;if(document.activeElement!==$('#brName'))$('#brName').value=b.name;
  const view=brEd.view==='picture'&&!b.picture?'picture':b.tip;
  for(const r of box.querySelectorAll('input[name=brTip]'))r.checked=r.value===view;
  for(const s of box.querySelectorAll('.brsec'))s.hidden=s.dataset.tip!==view;
  for(const inp of box.querySelectorAll('[data-k],[data-j]')){const k=inp.dataset.k,v=k?b[k]:b.jitter[inp.dataset.j];
    if(inp.type==='checkbox')inp.checked=!!v;else if(inp.type==='range')inp.value=Math.round(v*(k?BR_SCALE[k]:BR_JSCALE[inp.dataset.j]));else if(document.activeElement!==inp)inp.value=v;
    const out=inp.parentNode.querySelector('.brval');if(out)out.textContent=brValText(inp)}
  $('#brLetterRow').hidden=b.shape!=='letter';
  const sel=$('#brStyle');sel.replaceChildren(mkEl('option',{value:'',textContent:'No style: the plain shape'}));
  for(const s of state.styleGraphs)sel.append(mkEl('option',{value:s.id,textContent:styleName(s.g)}));
  sel.value=b.style&&state.styleGraphs.some(s=>s.id===b.style)?b.style:'';$('#brStyleEdit').disabled=!sel.value;
  const t=b.tip!=='round'&&tipCache.get(tipKey(b,state.color||'#000000',tipPx(b,Math.min(b.size,60),Math.min(2,devicePixelRatio||1))));
  $('#brEdNote').textContent=t&&t.err?`This tip can't be drawn here (${t.err}); it paints round instead.`:b.tip==='shape'?'Changes to the style show here as you make them.':'';
}
// INVARIANT: every edit goes through brSet, which cleans the brush, saves the project and redraws what shows it.
function brSet(fn){
  const b=edBrush();if(!b)return;if(!brEd.pushed){pushUndo();brEd.pushed=true}
  fn(b);Object.assign(b,cleanBrush(b,{id:b.id}));save();
  if(studio.brush===b.id&&state.tool==='brush'){setSize(b.size);prepareBrush()}
  fillBrushEditor();brPreview();brushLooksChanged();
}
function brPreview(){if(brEd.raf)return;brEd.raf=requestAnimationFrame(()=>{brEd.raf=0;brPreviewNow()})}
function brPreviewNow(){
  const b=edBrush();if(!b||$('#brushEd').hidden)return;const w=brPrev.clientWidth||400,h=brPrev.clientHeight||150;
  brushPreview(brPrev,b,{color:state.color||'#000000',size:Math.min(b.size,h*.4),path:[brushPreviewPath(w,h),...brEd.doodles],onReady:brPreview});
}
// RULE: scribbles on the preview paint with the brush as it is and stay, so the next change shows on them too.
brPrev.addEventListener('pointerdown',e=>{
  const b=edBrush();if(!b||e.button>0)return;brPrev.setPointerCapture(e.pointerId);
  const r=brPrev.getBoundingClientRect(),pt=ev=>({x:ev.clientX-r.left,y:ev.clientY-r.top,p:ev.pointerType==='pen'?ev.pressure||.5:1}),p=pt(e),line=[p];brEd.doodles.push(line);
  const k=brPrev.width/r.width,g=brPrev.getContext('2d');g.setTransform(k,0,0,k,0,0);
  const s=brushStart(g,b,{color:state.color||'#000000',size:Math.min(b.size,r.height*.4),scale:k},p,p.p);
  const mv=ev=>{const q=pt(ev);line.push(q);brushTo(s,q,q.p)};
  const up=()=>{brPrev.removeEventListener('pointermove',mv);brPrev.removeEventListener('pointerup',up);brPrev.removeEventListener('pointercancel',up)};
  brPrev.addEventListener('pointermove',mv);brPrev.addEventListener('pointerup',up);brPrev.addEventListener('pointercancel',up);
});
$('#brPrevClear').onclick=()=>{audio();brEd.doodles=[];brPreviewNow()};
$('#brName').oninput=e=>brSet(b=>{b.name=e.target.value.trim()||'Brush'});
for(const r of document.querySelectorAll('#brushEd input[name=brTip]'))r.onchange=()=>{brEd.view=r.value;
  if(r.value==='picture'&&!edBrush()?.picture){fillBrushEditor();$('#brEdNote').textContent='Pick the picture: Use the selection, or Open picture. Until then it paints round.';return}brSet(b=>{b.tip=r.value})};
for(const inp of document.querySelectorAll('#brushEd [data-k],#brushEd [data-j]')){
  const k=inp.dataset.k,j=inp.dataset.j,val=()=>inp.type==='checkbox'?inp.checked:inp.type==='range'?+inp.value/(k?BR_SCALE[k]:BR_JSCALE[j]):inp.value;
  inp.addEventListener(inp.type==='range'||inp.type==='text'?'input':'change',()=>brSet(b=>{if(k)b[k]=val();else b.jitter[j]=val()}));
}
$('#brStyle').onchange=e=>brSet(b=>{b.style=e.target.value||null;if(b.style)b.tip='shape'});
$('#brStyleNew').onclick=()=>{audio();const b=edBrush();if(!b)return;const s=newStyleGraph(b.name);syncNodeSheet(true);brSet(x=>{x.style=s.id;x.tip='shape'});openStyleEditor(s.id)};
$('#brStyleEdit').onclick=()=>{audio();const b=edBrush();if(b&&b.style)openStyleEditor(b.style)};
// FORMAT: a picture tip is trimmed to what's painted and kept at most BRUSH_PICTURE_MAX px a side, as a PNG.
function pictureFrom(src,box){
  const k=Math.min(1,BRUSH_PICTURE_MAX/Math.max(box.w,box.h)),c=imgCanvas(Math.max(1,Math.round(box.w*k)),Math.max(1,Math.round(box.h*k)));
  c.getContext('2d').drawImage(src,box.x,box.y,box.w,box.h,0,0,c.width,c.height);return c.toDataURL('image/png');
}
$('#brPicSel').onclick=()=>{audio();const s=studio.sel,box=s?trimBox((()=>{const c=imgCanvas(s.w,s.h);c.getContext('2d').drawImage(paint,s.x,s.y,s.w,s.h,0,0,s.w,s.h);return c})()):trimBox(paint);
  if(!box){status(s?'The selection is empty on this layer.':'This layer is empty. Paint the tip first, or select part of it.');return}
  if(s){box.x+=s.x;box.y+=s.y}brSet(b=>{b.picture=pictureFrom(paint,box);b.tip='picture'});status('The tip is now that picture.')};
$('#brPicFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;const img=await loadImg(await readURL(f));if(!img){status('That picture could not be opened.');return}
  brSet(b=>{b.picture=pictureFrom(img,{x:0,y:0,w:img.width,h:img.height});b.tip='picture'})};
$('#brEdClose').onclick=$('#brEdDone').onclick=()=>{audio();closeBrushEditor()};
// RULE: the editor drags by its title bar, so it can sit beside whatever it would cover (the node editor, the canvas).
{const win=$('#brushEd'),bar=win.querySelector('.tb');bar.style.cursor='grab';
  bar.addEventListener('pointerdown',e=>{if(e.button>0||e.target.closest('button'))return;e.preventDefault();const r=win.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top;
    const mv=ev=>{win.style.left=Math.max(0,Math.min(innerWidth-80,ev.clientX-dx))+'px';win.style.top=Math.max(0,Math.min(innerHeight-40,ev.clientY-dy))+'px';win.style.right='auto'};
    const up=()=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up)};document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up)})}

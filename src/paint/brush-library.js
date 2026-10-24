// SECTION: Brushes palette
// RULE: the built-in brushes are always there and never change. The brushes you make belong to the project and save
//   in its file, so a brush and the style graph it wears travel together. Picking a brush picks the Brush tool.
state.brushes=state.brushes||[];studio.brush='b:round';
function allBrushes(){return[...BUILTIN_BRUSHES,...(state.brushes||[])]}
function curBrush(){return allBrushes().find(b=>b.id===studio.brush)||BUILTIN_BRUSHES[0]}
function drawSwatch(cv,b){brushPreview(cv,b,{color:state.color||'#000000',size:Math.min(b.size,13),onReady:()=>{if(cv.isConnected)drawSwatch(cv,b)}})}
function renderBrushes(){
  const box=$('#brGrid'),cur=curBrush();box.replaceChildren();
  for(const b of allBrushes()){const on=b===cur,card=mkEl('button',{type:'button',className:'brcard'+(on?' on':'')});
    card.setAttribute('role','option');card.setAttribute('aria-selected',String(on));card.dataset.id=b.id;card.title=b.builtin?`${b.name} (built in)`:`${b.name} (made in this project; double-click to edit)`;
    const cv=mkEl('canvas',{className:'brsw'});cv.dataset.w=116;cv.dataset.h=30;cv.setAttribute('aria-hidden','true');
    card.append(cv,mkEl('span',{className:'brname',textContent:b.name}),mkEl('small',{className:'brkind',textContent:b.builtin?'Built in':'This project'}));
    card.onclick=()=>{audio();sfx('click');selectBrush(b.id)};card.ondblclick=()=>editBrush();
    box.append(card);drawSwatch(cv,b);
  }
  $('#brDel').disabled=!!cur.builtin;
}
function selectBrush(id,{quiet}={}){
  studio.brush=id;const b=curBrush();setTool('brush');setSize(b.size);renderBrushes();prepareBrush();
  if(!quiet)status(`Brush: ${b.name}`);if(!$('#brushEd').hidden&&brEd.id!==b.id)openBrushEditor(b.id);
}
function prepareBrush(){const b=curBrush();brushTip(b,state.color,tipPx(b,state.size,sdpr),()=>{})}
// PERF: colour changes and style edits come in bursts (an eyedropper drag, a slider); swatches redraw once they settle.
let brushLookT=0;
function brushLooksChanged(){clearTimeout(brushLookT);brushLookT=setTimeout(()=>{renderBrushes();prepareBrush();if(!$('#brushEd').hidden)brPreviewNow()},90)}
function addBrush(from,name){
  if(state.brushes.length>=64){status('64 brushes is the most a project keeps.');return null}
  pushUndo();const b=cleanBrush({...from,id:null,name});state.brushes.push(b);save();selectBrush(b.id,{quiet:true});return b;
}
const newBrush=()=>{const b=addBrush(curBrush(),`Brush ${state.brushes.length+1}`);if(b){openBrushEditor(b.id);sfx('pop')}};
const dupBrush=()=>{const c=curBrush(),b=addBrush(c,c.name.slice(0,34)+' copy');if(b){status(`Copied ${c.name}`);sfx('pop')}};
function editBrush(){let b=curBrush();if(b.builtin){b=addBrush(b,b.name.slice(0,30)+' (mine)');if(!b)return;status('Built-in brushes stay as they are; this is your copy to change.')}openBrushEditor(b.id)}
function delBrush(){
  const b=curBrush();if(b.builtin)return;pushUndo();state.brushes=state.brushes.filter(x=>x!==b);save();
  if(brEd.id===b.id)closeBrushEditor();selectBrush('b:round',{quiet:true});status(`Deleted ${b.name}. Undo brings it back.`);sfx('whoosh');
}
$('#brNew').onclick=()=>{audio();newBrush()};$('#brEdit').onclick=()=>{audio();editBrush()};$('#brDup').onclick=()=>{audio();dupBrush()};$('#brDel').onclick=()=>{audio();delBrush()};
$('#brGrid').addEventListener('keydown',e=>{const d={ArrowDown:1,ArrowRight:1,ArrowUp:-1,ArrowLeft:-1}[e.key];if(!d)return;e.preventDefault();e.stopPropagation();
  const list=allBrushes(),i=list.indexOf(curBrush());selectBrush(list[(i+d+list.length)%list.length].id);$('#brGrid .brcard.on')?.focus()});

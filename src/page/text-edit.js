// SECTION: text editing
function startEdit(el){
  const def=TAGS[el.tag];if(!el||def.void||def.noedit)return;
  const host=hostOf(el.id);const t=host&&host._target;if(!t)return;
  pushUndo();
  state.editing={id:el.id,t};t.contentEditable='true';t.focus();
  try{const r=document.createRange();r.selectNodeContents(t);const s=getSelection();s.removeAllRanges();s.addRange(r)}catch(e){}
  t.addEventListener('blur',finishEdit,{once:true});
  status('Editing text. Click outside or press Esc when done.');
}
function finishEdit(){
  const ed=state.editing;if(!ed)return;state.editing=null;
  const el=state.els.find(e=>e.id===ed.id);
  if(el){ed.t.contentEditable='false';el.content=cleanHTML(ed.t.innerHTML)}
  updateSel();save();renderInspector();status('');
}


// SECTION: text editing
// RULE: in markup with parts (a window's title and body, a card's heading and text), editing starts in the one
//   part under the pointer, never the whole markup: a select-all there lets one keystroke or paste delete the
//   elements the stylesheet styles.
function editPart(t,at){
  const parts=[...t.querySelectorAll('*')].filter(n=>[...n.childNodes].some(c=>c.nodeType===3&&c.nodeValue.trim()));
  if(!parts.length||[...t.childNodes].some(c=>c.nodeType===3&&c.nodeValue.trim()))return t;
  const hit=at&&t.getRootNode().elementFromPoint?.(at.x,at.y);
  return parts.find(p=>hit&&p.contains(hit))||parts.find(p=>hit&&hit.contains(p))||parts[0];
}
function startEdit(el,at){
  const def=TAGS[el.tag];if(!el||def.void||def.noedit)return;
  const host=hostOf(el.id);const t=host&&host._target;if(!t)return;
  pushUndo();
  state.editing={id:el.id,t};t.contentEditable='true';t.focus();
  try{const r=document.createRange();r.selectNodeContents(editPart(t,at));const s=getSelection();s.removeAllRanges();s.addRange(r)}catch(e){}
  t.addEventListener('blur',finishEdit,{once:true});
  t.addEventListener('paste',pastePlain);
  status('Editing text. Click outside or press Esc when done.');
}
// COMPAT: Chromium's document selection stops at a shadow root and shadowRoot.getSelection sees inside it; WebKit and
//   Firefox give getComposedRanges; Firefox's plain selection also reaches in. Null when none lands inside t.
const editSel=t=>{const r=t.getRootNode();return r.getSelection?r.getSelection():getSelection()};
function editRange(t){
  const s=editSel(t),root=t.getRootNode();let r=null;
  if(s.getComposedRanges&&!root.getSelection){const c=s.getComposedRanges({shadowRoots:[root]})[0];if(c){r=document.createRange();r.setStart(c.startContainer,c.startOffset);r.setEnd(c.endContainer,c.endOffset)}}
  else if(s.rangeCount)r=s.getRangeAt(0);
  return r&&t.contains(r.commonAncestorContainer)?r:null;
}
const BLOCKISH=/^(block|list-item|flex|grid|table|flow-root)/;
// RULE: a paste is plain text taking the style of where it lands. A blank line starts a new paragraph made as a copy
//   of the block it was pasted into (same tag, same classes), so a long text stays styled in the primitive.
//   The browser's paste would carry the source page's inline styles and split blocks into bare divs.
function pastePlain(e){
  const ed=state.editing,txt=e.clipboardData&&e.clipboardData.getData('text/plain');if(!ed||txt==null)return;
  // RULE: with no selection found inside the element, the browser's own paste goes ahead: never lose the text.
  const t=ed.t,r=editRange(t);if(!r)return;
  e.preventDefault();
  r.deleteContents();
  const lines=v=>{const f=document.createDocumentFragment();v.split('\n').forEach((l,i)=>{if(i)f.append(mkEl('br'));if(l)f.append(l)});return f};
  const paras=txt.replace(/\r\n?/g,'\n').trim().split(/\n[ \t]*\n+/);
  let block=null;
  for(let n=r.startContainer.nodeType===1?r.startContainer:r.startContainer.parentElement;n&&n!==t;n=n.parentElement)if(BLOCKISH.test(getComputedStyle(n).display)){block=n;break}
  const end=document.createRange();
  if(paras.length<2||!block){
    const f=document.createDocumentFragment();paras.forEach((p,i)=>{if(i)f.append(mkEl('br'),mkEl('br'));f.append(lines(p))});
    const last=f.lastChild;r.insertNode(f);if(last)end.setStartAfter(last);else end.setStart(r.startContainer,r.startOffset);
  }else{
    const tail=document.createRange();tail.setStart(r.startContainer,r.startOffset);tail.setEnd(block,block.childNodes.length);
    const rest=tail.extractContents();r.insertNode(lines(paras[0]));
    let prev=block;for(const p of paras.slice(1)){const b=block.cloneNode(false);b.removeAttribute('id');b.append(lines(p));prev.after(b);prev=b}
    end.setStart(prev,prev.childNodes.length);prev.append(rest);
  }
  end.collapse(true);const s=editSel(t);s.removeAllRanges();s.addRange(end);
}
function finishEdit(){
  const ed=state.editing;if(!ed)return;state.editing=null;
  ed.t.removeEventListener('paste',pastePlain);
  const el=state.els.find(e=>e.id===ed.id);
  if(el){ed.t.contentEditable='false';el.content=cleanHTML(ed.t.innerHTML)}
  updateSel();save();renderInspector();status('');
}

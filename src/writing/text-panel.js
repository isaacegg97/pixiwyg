// SECTION: Text panel
function docSync(){
  const box=$('#w-text');if(!box)return;
  if(!docById(curDoc))curDoc=state.docs[0]?state.docs[0].id:null;
  const d=docById(curDoc),sel=$('#docSel');sel.replaceChildren();
  for(const x of state.docs)sel.append(mkEl('option',{value:x.id,textContent:x.name}));
  $('#docEmpty').hidden=!!d;$('#docBody').hidden=!d;if(!d){if(wr.on)wrRefresh();return}
  sel.value=d.id;
  if(document.activeElement!==$('#docName'))$('#docName').value=d.name;
  if($('#docText').value!==d.text&&document.activeElement!==$('#docText'))$('#docText').value=d.text;
  // RULE: the page view follows the stored text unless it is the thing being typed in.
  if(typeof dp==='object'&&dp){$('#docPage').hidden=dp.view!=='page';$('#docText').hidden=dp.view==='page';$('#docViewPage').setAttribute('aria-pressed',dp.view==='page');$('#docViewMd').setAttribute('aria-pressed',dp.view!=='page');
    if(dp.view==='page'&&document.activeElement!==$('#docPage')&&!dp.t)dpRender()}
  sheetOptions($('#docSheet'),'each type’s current pick',d.sheet);
  const fromSel=$('#docFrom');fromSel.replaceChildren();if(isFixed())for(const r of pageRects())fromSel.append(mkEl('option',{value:r.i,textContent:pageLabel(r.i)}));fromSel.value=String(d.from||0);
  $('#docFromRow').hidden=!isFixed();$('#docWidthRow').hidden=isFixed();$('#docWidth').value=d.width;
  docStats();if(wr.on)wrRefresh();
}
function docStats(){
  const d=docById(curDoc);if(!d)return;
  const words=(d.text.replace(/\x3C!--[\s\S]*?-->/g,'').replace(/[#>*_`~\[\]()!|-]/g,' ').match(/\S+/g)||[]).length,els=state.els.filter(e=>e.md===d.id);
  const pages=isFixed()&&els.length?new Set(els.map(e=>pageOf(e).i)).size:0,marks=(d.text.match(/\x3C!--\s*pixiwyg:/g)||[]).length;
  $('#docStats').textContent=`${words.toLocaleString()} words · ${Math.max(1,Math.round(words/230))} min read · ${els.length} block${els.length===1?'':'s'}${pages?` on ${pages} page${pages===1?'':'s'}`:''}${marks?` · ${marks} converted`:''}`;
}
function openDoc(id){const d=docById(id);if(d&&!docOnPage(d)&&d.pg)goPage(d.pg,{quiet:true});curDoc=id;docSync()}
function showText(focusChunk){
  // RULE: in the Write workspace the writer is the Text panel; the manuscript opens there.
  if(wr.on){docSync();wrSetView(focusChunk!=null?'md':'edit');if(focusChunk==null)return}
  else{setSide('sideL',true);setTab('w-text');docSync()}
  if(focusChunk!=null){const d=docById(curDoc),c=d&&mdChunks(d.text)[focusChunk];const ta=$('#docText');ta.focus();if(c){ta.setSelectionRange(c.start,c.end);const lh=parseFloat(getComputedStyle(ta).lineHeight)||20;ta.scrollTop=Math.max(0,d.text.slice(0,c.start).split('\n').length*lh-ta.clientHeight/3)}}
}
// RULE: one undo step per typing burst; pages reflow 350ms after the last key.
let docT=0,docArmed=true;
$('#docText').addEventListener('input',()=>{
  const d=docById(curDoc);if(!d)return;if(docArmed){pushUndo();docArmed=false}
  clearTimeout(docT);docT=setTimeout(()=>{d.text=$('#docText').value;flowDocs(d,{inc:true});save();docStats();docArmed=true},350);
});
const caretChunk=()=>{const d=docById(curDoc);if(!d)return -1;const p=$('#docText').selectionStart;return mdChunks($('#docText').value).findIndex(c=>p>=c.start&&p<=c.end+1)};
function followCaret(){
  const d=docById(curDoc),ci=caretChunk();if(!d||ci<0)return;
  const el=state.els.filter(e=>e.md===d.id&&e.mdB===ci).sort((a,b)=>(a.flowN||0)-(b.flowN||0))[0];if(!el||el.id===state.sel)return;
  state.sel=el.id;updateSel();renderInspector();
  const h=hostOf(el.id);if(h){const r=h.getBoundingClientRect(),dr=desk.getBoundingClientRect();if(r.bottom<dr.top||r.top>dr.bottom)h.scrollIntoView({block:'center'})}
}
$('#docText').addEventListener('click',followCaret);$('#docText').addEventListener('keyup',e=>{if(e.key.startsWith('Arrow')||e.key==='PageDown'||e.key==='PageUp'||e.key==='Home'||e.key==='End')followCaret()});
function mdFormat(kind){
  const ta=$('#docText'),v=ta.value,a=ta.selectionStart,b=ta.selectionEnd,sel=v.slice(a,b);
  const wrap=(l,r,ph)=>{const t=sel||ph;ta.setRangeText(l+t+r,a,b,'select');if(!sel)ta.setSelectionRange(a+l.length,a+l.length+t.length)};
  const lines=pre=>{const s=v.lastIndexOf('\n',a-1)+1,e=v.indexOf('\n',b);const end=e<0?v.length:e;const block=v.slice(s,end).split('\n').map((l,i)=>typeof pre==='function'?pre(l,i):pre+l.replace(/^(#{1,6}\s|>\s?|[-*+]\s|\d+[.)]\s)/,'')).join('\n');ta.setRangeText(block,s,end,'select')};
  if(kind==='b')wrap('**','**','bold');else if(kind==='i')wrap('*','*','italic');else if(kind==='code')wrap('`','`','code');
  else if(kind==='link')wrap('[','](https://)','link text');
  else if(/^h[1-3]$/.test(kind))lines('#'.repeat(+kind[1])+' ');else if(kind==='quote')lines('> ');else if(kind==='ul')lines('- ');
  else if(kind==='ol')lines((l,i)=>`${i+1}. `+l.replace(/^(#{1,6}\s|>\s?|[-*+]\s|\d+[.)]\s)/,''));
  else if(kind==='hr'){ta.setRangeText('\n\n---\n\n',b,b,'end')}
  ta.focus();ta.dispatchEvent(new Event('input'));
}
for(const b of document.querySelectorAll('#mdTools [data-md]'))b.onclick=()=>{audio();mdFormat(b.dataset.md)};
$('#docText').addEventListener('keydown',e=>{if(!(e.ctrlKey||e.metaKey)||e.altKey)return;const k=e.key.toLowerCase();
  if(k==='b'||k==='i'||k==='k'){e.preventDefault();e.stopPropagation();mdFormat(k==='k'?'link':k)}});
$('#docSel').onchange=e=>openDoc(e.target.value);
$('#docName').oninput=e=>{const d=docById(curDoc);if(!d)return;d.name=cleanDocName(e.target.value);const o=$('#docSel').selectedOptions[0];if(o)o.textContent=d.name;save()};
$('#docSheet').onchange=e=>{const d=docById(curDoc);if(!d)return;pushUndo();d.sheet=e.target.value;d.styles={};flowDocs(d);save();docStats()};
$('#docFrom').onchange=e=>{const d=docById(curDoc);if(!d)return;pushUndo();d.from=+e.target.value||0;flowDocs(d);save();docStats()};
$('#docWidth').onchange=e=>{const d=docById(curDoc);if(!d)return;pushUndo();d.width=Math.round(numIn(e.target.value,640,160,4000));flowDocs(d);save()};
$('#docNew').onclick=$('#docStart').onclick=()=>{audio();pushUndo();const d=newDoc();curDoc=d.id;flowDocs(d);save();docSync();$('#docText').focus()};
$('#docImport').onclick=$('#docStartImport').onclick=()=>{audio();$('#docFile').click()};
$('#docFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)await addManuscript(f.name,await f.text())};
$('#docSave').onclick=()=>{audio();const d=docById(curDoc);if(d){download(new Blob([d.text],{type:'text/markdown;charset=utf-8'}),slug(d.name)+'.md');status('Saved '+slug(d.name)+'.md')}};
$('#docDel').onclick=async()=>{const d=docById(curDoc);if(!d)return;
  const a=await ask(`Remove “${d.name}”?`,'Its blocks leave the page with it. Components already converted from it stay where they are.',[{id:'del',label:'Remove it',primary:true},{id:null,label:'Cancel'}]);
  if(a!=='del')return;pushUndo();for(const el of state.els)if(el.md===d.id)dropHost(el.id);state.els=state.els.filter(e=>e.md!==d.id);state.docs=state.docs.filter(x=>x!==d);curDoc=null;flowDocs();save();docSync();updateSel();status(`Removed ${d.name}. Undo brings it back.`)};
$('#docConvertAll').onclick=async()=>{const d=docById(curDoc);if(!d)return;
  if(await ask(`Convert all of “${d.name}”?`,'Every block becomes a component of its own: free to move, restyle and animate, and no longer flowing with the text. The manuscript keeps a marker for each, so any of them can be put back.',[{id:'all',label:'Convert all',primary:true},{id:null,label:'Cancel'}])==='all')convertAll(d)};
async function addManuscript(name,text){
  pushUndo();const d=newDoc(name.replace(/\.(md|markdown|mdown|mkd|txt)$/i,''),text);
  if(isFixed()&&state.docs.length>1){const used=Math.max(-1,...state.els.map(e=>pageOf(e).i));d.from=Math.min(pageRects().length-1,used+1)}
  curDoc=d.id;const over=flowDocs(d);save();showText();
  status(`“${d.name}” flows onto the page${isFixed()?'s':''}${over?`, running ${over} block${over===1?'':'s'} past the last page`:''}. ${wr.on?'Write on the page; View → Pages shows it typeset.':'Edit it in the Text panel; convert any block to make it a component of its own.'}`);
  return d;
}


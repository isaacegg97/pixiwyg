// SECTION: piano roll tools: draw and select modes, the clipboard, nudging, the velocity lane, zoom, the bar's More
function seqSetMode(mode){
  seq.mode=mode;$('#seqModeDraw').setAttribute('aria-pressed',String(mode==='draw'));$('#seqModeSel').setAttribute('aria-pressed',String(mode==='select'));
  status(mode==='select'?'Select: click notes, or drag a box around them':'Draw: click for a note, click a note to remove it');
}
// PERF: runs after every selection change; touches the DOM only where a state flips.
function seqToolsSync(){
  const has=seq.selN.size>0;
  for(const [id,on] of [['#seqCopy',has],['#seqCut',has],['#seqDup',has],['#seqDel',has],['#seqPaste',!!seq.clip]]){const b=$(id);if(b.disabled===on)b.disabled=!on}
}
function seqSelClear(){if(!seq.selN.size)return;seq.selN.clear();seqToolsSync()}
const seqWhere=(m,at)=>{const bar=barTicks(m),bt=beatTicks(m);return`bar ${Math.floor(at/bar)+1}, beat ${Math.floor(at%bar/bt)+1}`};
// RULE: a copy spans whole beats from its first note, or whole bars once it is over half a bar, so copies laid end
//   to end (paste after paste, or Duplicate) keep the groove.
function seqClipOf(notes){
  const m=state.music,sel=[...notes].sort((a,b)=>a.t-b.t||a.p-b.p),t0=sel[0].t,len=Math.max(...sel.map(n=>n.t+n.d))-t0;
  const unit=len>barTicks(m)/2?barTicks(m):beatTicks(m);
  return{notes:sel.map(n=>({t:n.t-t0,d:n.d,p:n.p,v:n.v})),span:Math.max(unit,Math.ceil(len/unit)*unit),t0};
}
function seqCopy(cut){
  const t=seqTrackSel();if(!seq.selN.size)return;
  const c=seqClipOf(seq.selN);seq.clip={notes:c.notes,span:c.span};const k=c.notes.length;
  if(cut){seqEdit(()=>{t.notes=t.notes.filter(n=>!seq.selN.has(n))});seq.selN.clear()}
  status(`${cut?'Cut':'Copied'} ${k} note${k===1?'':'s'}. Paste puts them at the cursor (click the ruler to move it).`);
  seqToolsSync();seqDraw();
}
// RULE: a paste lands at the cursor in the picked track, becomes the selection, and moves the cursor to its end, so
//   pasting again continues the line. Notes past the song's end, or drums the kit lacks, are left out and counted.
function seqPaste(clip=seq.clip,at=seqP.cursor){
  const m=state.music,t=seqTrackSel();if(!clip||!m)return;
  const end=songEnd(m),rows=new Set(seqRows(t));
  const add=clip.notes.filter(n=>at+n.t<end&&rows.has(n.p)).map(n=>({t:at+n.t,d:Math.max(1,Math.min(n.d,end-at-n.t)),p:n.p,v:n.v}));
  const lost=clip.notes.length-add.length;
  if(!add.length){status(t.drums?'Nothing to paste: those notes aren’t drums in this kit.':'Nothing fits there: the cursor is at the end of the song.');return}
  seqEdit(()=>{t.notes.push(...add);seqTidy(t)});
  seq.selN=new Set(add);seqSelPrune();
  seqP.cursor=Math.min(end-gridTicks(m),at+clip.span);
  const sc=$('#seqScroll'),X=at/PPQ*SQ.BW;if(X<sc.scrollLeft||X>sc.scrollLeft+sc.clientWidth-SQ.KW-40)sc.scrollLeft=Math.max(0,X-40);
  status(`Pasted ${add.length} note${add.length===1?'':'s'} at ${seqWhere(m,at)}${lost?`; ${lost} didn’t fit`:''}.`);
  seqToolsSync();seqDraw();
}
// RULE: Duplicate copies the selection right after itself and leaves the clipboard alone.
function seqDuplicate(){if(!seq.selN.size)return;const c=seqClipOf(seq.selN);seqPaste(c,c.t0+c.span)}
function seqDelete(){
  const t=seqTrackSel(),k=seq.selN.size;if(!k)return;
  seqEdit(()=>{t.notes=t.notes.filter(n=>!seq.selN.has(n))});seq.selN.clear();
  status(`Deleted ${k} note${k===1?'':'s'}. Undo brings them back.`);seqToolsSync();seqDraw();
}
// INVARIANT: a nudge moves the selection as one and stops at the song's edges and the outer rows.
function seqNudge(dt,dr){
  const m=state.music,t=seqTrackSel(),rows=seqRows(t),G=[...seq.selN];if(!G.length)return;
  const ri=p=>rows.indexOf(p),end=songEnd(m),step=gridTicks(m);
  dt=Math.max(-Math.min(...G.map(n=>n.t)),Math.min(end-step-Math.max(...G.map(n=>n.t)),dt));
  dr=Math.max(-Math.min(...G.map(n=>ri(n.p))),Math.min(rows.length-1-Math.max(...G.map(n=>ri(n.p))),dr));
  if(!dt&&!dr)return;
  seqEdit(()=>{for(const n of G){n.t+=dt;n.p=rows[ri(n.p)+dr]}seqTidy(t)});seqSelPrune();
  if(dr&&G.length===1)seqHear(t,G[0].p);seqDraw();
}
$('#seqModeDraw').onclick=()=>{audio();seqSetMode('draw')};
$('#seqModeSel').onclick=()=>{audio();seqSetMode('select')};
$('#seqCopy').onclick=()=>{audio();seqCopy(false)};
$('#seqCut').onclick=()=>{audio();seqCopy(true)};
$('#seqPaste').onclick=()=>{audio();seqPaste()};
$('#seqDup').onclick=()=>{audio();seqDuplicate()};
$('#seqDel').onclick=()=>{audio();seqDelete()};
$('#seqZoomOut').onclick=()=>seqZoomTo(SQ.BW*.8);
$('#seqZoomIn').onclick=()=>seqZoomTo(SQ.BW*1.25);
$('#seqLaneBtn').setAttribute('aria-pressed',String(seq.lane));
$('#seqLaneBtn').onclick=()=>{audio();seq.lane=!seq.lane;$('#seqLaneBtn').setAttribute('aria-pressed',String(seq.lane));seqLayout();seqDraw()};
// RULE: the roll's editing keys: Ctrl/Cmd+A C X V D, Delete, arrows (Shift: a bar, or an octave), Esc drops the
//   selection before it stops playback.
$('#seqModal').addEventListener('keydown',e=>{
  if(e.target.matches('input,select,textarea')||e.altKey||!state.music)return;
  const mod=e.ctrlKey||e.metaKey,k=e.key,kl=k.toLowerCase(),t=seqTrackSel(),done=()=>{e.preventDefault();e.stopPropagation()};
  if(mod&&!e.shiftKey){
    if(kl==='a'){done();seq.selN=new Set(t.notes);seqToolsSync();seqDraw();status(`${t.notes.length} notes selected`);return}
    if(kl==='c'){if(seq.selN.size){done();seqCopy(false)}return}
    if(kl==='x'){if(seq.selN.size){done();seqCopy(true)}return}
    if(kl==='v'){if(seq.clip){done();seqPaste()}return}
    if(kl==='d'){done();seqDuplicate();return}
    return;
  }
  if(mod)return;
  if((k==='Delete'||k==='Backspace')&&seq.selN.size){done();seqDelete();return}
  if(k==='Escape'&&seq.selN.size){done();seqSelClear();seqDraw();return}
  if(!seq.selN.size)return;
  const m=state.music,oct=t.drums?1:12;
  if(k==='ArrowLeft'||k==='ArrowRight'){done();seqNudge((k==='ArrowLeft'?-1:1)*(e.shiftKey?barTicks(m):gridTicks(m)),0)}
  else if(k==='ArrowUp'||k==='ArrowDown'){done();seqNudge(0,(k==='ArrowUp'?-1:1)*(e.shiftKey?oct:1))}
});

// SECTION: the song bar's More
// RULE: the song bar keeps to two rows: the least used tools move into More ▾ (keeping their handlers) and come back
//   in their own places when there is room. The XMB shows the bar as a sheet of its own, so it keeps everything.
const SQ_STEPS=['#seqSongImport','#seqMidiIn','.sqsf','label[for=seqSampleIn]','#seqMasterFx','#seqToPage','#seqSave','#seqMp3'];
const sqHome=new Map();
// FORMAT: items share a row when their tops are within 12 px (a row's items are centered, not top-aligned); spacers
//   and visually hidden inputs don't count.
function seqBarRows(bar){
  const tops=[...bar.children].filter(c=>c.offsetParent!==null&&c.offsetHeight>2).map(c=>c.offsetTop).sort((a,b)=>a-b);let n=0,last=-1e9;
  for(const y of tops)if(y>last+12){n++;last=y}return n;
}
function fitSeqBar(){
  const bar=$('#seqModal .seqbar'),ov=$('#seqOverflow'),more=$('#seqMore');
  for(const [el,mark] of sqHome)mark.replaceWith(el);sqHome.clear();more.hidden=true;
  const B=document.body.style;
  if(document.body.classList.contains('xmb')||$('#seqModal').hidden){B.removeProperty('--seqTop');return}
  for(const sel of SQ_STEPS){
    if(seqBarRows(bar)<=2)break;const el=bar.querySelector(sel);if(!el)continue;
    const mark=document.createComment('sq');el.replaceWith(mark);sqHome.set(el,mark);ov.append(el);more.hidden=false;
  }
  // RULE: the floating Ideas and FX panels open below the song bar and the note tools, never over them.
  B.setProperty('--seqTop',Math.round($('#seqModal .sqtools').getBoundingClientRect().bottom+8)+'px');
}
new ResizeObserver(()=>requestAnimationFrame(fitSeqBar)).observe($('#seqModal .seqbar'));
document.addEventListener('pointerdown',e=>{const m=$('#seqMore');if(m.open&&!m.contains(e.target))m.open=false});
$('#seqOverflow').addEventListener('click',e=>{if(e.target.closest('button,label'))$('#seqMore').open=false});

// SECTION: manuscript page view (word-processor ergonomics over the same Markdown)
// RULE: the manuscript is still Markdown; this is a page you write on, as in a word processor: bold is bold, headings
//   are headings, Word's shortcuts work, and "Focus" gives a full-screen sheet with typewriter scrolling. The Markdown
//   view is a click away and shows exactly what is stored.
// SAFETY: never a literal comment-open sequence in this file (written \x3C!-- instead): inside the page's one script element it
//   switches the HTML parser into a mode that mangles the script, its CSP hash stops matching, and nothing runs.
// INVARIANT: nothing is lost going through the page. Each block remembers the Markdown it came from and the HTML it
//   was shown as; a block left untouched writes back its original Markdown byte for byte. Only edited blocks are
//   re-written. Blocks the page can't edit as rich text (code, tables, images, raw HTML) stay as Markdown source,
//   and converted blocks (pixiwyg markers) are protected.
const DP_RICH=new Set(['h1','h2','h3','p','blockquote','ul','ol']);
// HACK: var, not const: docSync reads dp at boot, before this file's lines run.
var dp={view:lsGetEarly('pixiwyg.doc.view','page'),t:0,armed:true,rendering:false};
const dpHash=s=>{let h=0;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return String(h>>>0)};
function dpRender(){
  const d=docById(curDoc),page=$('#docPage');if(!d||!page)return;dp.rendering=true;page.replaceChildren();
  for(const c of mdChunks(d.text)){
    const blocks=/\x3C!--\s*pixiwyg:/.test(c.src)?[]:mdBlocksOf(c);let n;
    if(blocks.length===1&&DP_RICH.has(blocks[0].tag)){const b=blocks[0];n=document.createElement(b.tag);n.innerHTML=b.html;n.dataset.h=dpHash(b.tag+n.innerHTML)}
    // RULE: a picture shows as the picture, kept whole: its Markdown (and data) rides in data-src untouched.
    else if(blocks.length===1&&blocks[0].tag==='img'&&(okImg(blocks[0].src)||/^https?:/i.test(blocks[0].src))){n=mkEl('figure',{className:'dpraw dpimg'});n.contentEditable='false';n.append(mkEl('img',{src:blocks[0].src,alt:blocks[0].alt||''}));n.dataset.h=dpHash('raw'+c.src)}
    else{n=mkEl('div',{className:'dpraw',textContent:c.src});n.dataset.h=dpHash('raw'+c.src);
      // RULE: a converted block lives on the page as a component; here it is a labelled, locked line.
      if(/\x3C!--\s*pixiwyg:/.test(c.src)){n.contentEditable='false';n.classList.add('dplock');n.title='Converted to a component: edit it on the page, or put it back from there'}}
    n.dataset.src=c.src;page.append(n);
  }
  if(!page.childElementCount)page.append(mkEl('p'));
  dp.rendering=false;
}
// FORMAT: blocks join with one blank line, as mdChunks splits them.
// FIX: the browser's list and block commands can nest a <ul> or heading inside a <p>; such blocks are lifted out
//   to the top level, which is where one Markdown block lives. Moved nodes keep the caret.
function dpNormalize(){
  // FIX: typing into an empty manuscript left the first line as bare text beside the blocks, and only blocks are
  //   saved, so it vanished from the text. Loose text and inline runs at the top level go into a paragraph, caret kept.
  {const P=$('#docPage'),sel=getSelection(),an=sel.anchorNode,ao=sel.anchorOffset;let run=null,moved=false;
    for(const n of [...P.childNodes]){
      const inline=n.nodeType===3?/\S/.test(n.textContent)||n===an:n.nodeType===1&&/^(SPAN|B|I|EM|STRONG|U|S|A|CODE|BR|MARK|SUB|SUP|SMALL)$/.test(n.tagName);
      if(!inline){run=null;continue}
      if(!run){run=document.createElement('p');n.before(run)}run.append(n);moved=true;
    }
    if(moved&&an&&P.contains(an))sel.collapse(an,ao)}
  for(const n of [...$('#docPage').children]){
    if(!/^(P|DIV)$/.test(n.tagName)||n.classList.contains('dpraw'))continue;
    if([...n.children].some(c=>/^(UL|OL|H[1-6]|BLOCKQUOTE|PRE|P|DIV)$/.test(c.tagName)))n.replaceWith(...n.childNodes);
  }
}
function dpSerialize(){
  // INVARIANT: Enter copies a block's data-src to the new block; only the first holder may write it back verbatim.
  const out=[],seen=new Set();
  for(const n of $('#docPage').children){
    const tag=n.tagName.toLowerCase(),raw=n.classList.contains('dpraw');
    const first=n.dataset.src!=null&&!seen.has(n.dataset.src);if(first)seen.add(n.dataset.src);
    if(raw){const txt=n.classList.contains('dplock')||n.classList.contains('dpimg')?n.dataset.src:n.innerText.replace(/\n$/,'');if(first&&dpHash('raw'+txt)===n.dataset.h)out.push(n.dataset.src);else if(txt.trim())out.push(txt);continue}
    if(first&&dpHash(tag+n.innerHTML)===n.dataset.h){out.push(n.dataset.src);continue}
    const t=DP_RICH.has(tag)?tag:/^h[4-6]$/.test(tag)?'h3':'p';
    if(!n.textContent.trim()&&!n.querySelector('img'))continue;
    out.push(htmlToMd({tag:t,content:t==='ul'||t==='ol'?n.innerHTML:n.innerHTML.replace(/<br\s*\/?>$/i,'')}));
  }
  return out.join('\n\n');
}
// RULE: one undo step per typing burst; the pages reflow 350ms after the last key, exactly as from the Markdown view.
function dpInput(){
  if(dp.rendering)return;const d=docById(curDoc);if(!d)return;if(dp.armed){pushUndo();dp.armed=false}
  clearTimeout(dp.t);dp.t=setTimeout(()=>{d.text=dpSerialize();if($('#docText'))$('#docText').value=d.text;flowDocs(d,{inc:true});save();docStats();dp.armed=true},350);
  dpTypewriter();
}
function dpFlush(){if(!dp.t)return;clearTimeout(dp.t);dp.t=0;const d=docById(curDoc);if(!d)return;d.text=dpSerialize();$('#docText').value=d.text;flowDocs(d,{inc:true});save();docStats();dp.armed=true}
function dpSetView(v){
  dpFlush();dp.view=v;lsSet('pixiwyg.doc.view',v);
  $('#docPage').hidden=v!=='page';$('#docText').hidden=v==='page';$('#docViewPage').setAttribute('aria-pressed',v==='page');$('#docViewMd').setAttribute('aria-pressed',v!=='page');
  if(v==='page')dpRender();
}
// RULE: Word's habits: Ctrl/Cmd+B, I, K; Ctrl/Cmd+1, 2, 3 headings and 0 body text; Ctrl/Cmd+Shift+L bullets,
//   Ctrl/Cmd+Shift+7 numbers. Typing "# ", "## ", "- ", "1. " or "> " at the start of a paragraph formats it.
function dpFormat(kind){
  const P=$('#docPage');if(document.activeElement!==P)P.focus();
  const ex=(c,v)=>document.execCommand(c,false,v);
  switch(kind){
    case'b':ex('bold');break;case'i':ex('italic');break;case'code':{const s=getSelection();if(s.rangeCount&&!s.isCollapsed){const c=mkEl('code',{textContent:s.toString()});const r=s.getRangeAt(0);r.deleteContents();r.insertNode(c)}break}
    case'h1':case'h2':case'h3':ex('formatBlock',kind);break;case'p':ex('formatBlock','p');break;case'quote':ex('formatBlock','blockquote');break;
    case'ul':ex('insertUnorderedList');dpNormalize();break;case'ol':ex('insertOrderedList');dpNormalize();break;
    case'link':dpLinkAsk();return;
    case'hr':ex('insertHTML','<div class="dpraw">---</div><p><br></p>');break;
  }
  dpInput();
}
// RULE: no prompt() (desktop web views don't all have one): a small address field opens under the selection; Enter links it.
function dpLinkAsk(){
  const s=getSelection();if(!s.rangeCount||s.isCollapsed){status('Select the words to link first.');return}
  const range=s.getRangeAt(0).cloneRange(),r=range.getBoundingClientRect(),inp=$('#docLink');
  inp.value=(s.toString().match(/^https?:\/\/\S+$/)||[])[0]||'https://';inp.hidden=false;Object.assign(inp.style,{left:Math.round(r.left)+'px',top:Math.round(r.bottom+6)+'px'});inp.focus();inp.select();
  inp.onkeydown=e=>{if(e.key==='Enter'||e.key==='Escape'){e.preventDefault();e.stopPropagation();inp.hidden=true;$('#docPage').focus();const sel=getSelection();sel.removeAllRanges();sel.addRange(range);
    if(e.key==='Enter'&&inp.value.trim()&&inp.value.trim()!=='https://'){document.execCommand('createLink',false,inp.value.trim());dpInput()}}};
  inp.onblur=()=>{inp.hidden=true};
}
const DP_AUTO=[[/^#\s$/,'h1'],[/^##\s$/,'h2'],[/^###\s$/,'h3'],[/^[-*]\s$/,'ul'],[/^1[.)]\s$/,'ol'],[/^>\s$/,'quote']];
function dpAutoFormat(){
  const s=getSelection();if(!s.rangeCount||!s.isCollapsed)return;const blk=s.anchorNode&&(s.anchorNode.nodeType===1?s.anchorNode:s.anchorNode.parentElement).closest('#docPage>*');
  if(!blk||blk.tagName!=='P')return;const txt=blk.textContent.replace(/ /g,' ');
  // FIX: an emptied paragraph needs its <br>, or the browser moves the caret into the block before it.
  for(const [re,kind] of DP_AUTO)if(re.test(txt)&&blk.textContent.length<=4){blk.innerHTML='<br>';const r=document.createRange();r.setStart(blk,0);r.collapse(true);s.removeAllRanges();s.addRange(r);dpFormat(kind);return}
}
// RULE: typewriter scrolling in Focus: the line being written stays at 40% of the window's height.
function dpTypewriter(){
  if(!document.body.classList.contains('docfocus')&&!document.body.classList.contains('wrfocus'))return;const s=getSelection();if(!s.rangeCount)return;
  const r=s.getRangeAt(0).getClientRects()[0]||(s.anchorNode&&s.anchorNode.nodeType===1?s.anchorNode.getBoundingClientRect():null);if(!r)return;
  const box=wr.on?$('#wrScroll'):$('#w-text'),b=box.getBoundingClientRect(),want=b.top+b.height*.4;box.scrollTop+=r.top-want;
}
// RULE: in the writer, Focus hides the ribbon, Navigation and status bar and keeps typewriter scrolling.
function dpFocus(on){if(wr.on){if(on===undefined)on=!document.body.classList.contains('wrfocus');document.body.classList.toggle('wrfocus',on);$('#wrFocus').setAttribute('aria-pressed',on);if(on){if(wr.view!=='edit')wrSetView('edit',true);$('#docPage').focus()}wrLater();status(on?'Focus: just the page. Esc comes back.':'');return}
  if(on===undefined)on=!document.body.classList.contains('docfocus');document.body.classList.toggle('docfocus',on);$('#docFocus').setAttribute('aria-pressed',on);if(on){if(dp.view!=='page')dpSetView('page');$('#docPage').focus()}status(on?'Focus: just the page. Esc comes back.':'')}
// RULE: the caret's paragraph is the one selected on the page, as from the Markdown view.
function dpFollow(){
  const d=docById(curDoc),s=getSelection();if(!d||!s.rangeCount)return;const n=s.anchorNode&&(s.anchorNode.nodeType===1?s.anchorNode:s.anchorNode.parentElement),blk=n&&n.closest('#docPage>*');if(!blk)return;
  const ci=[...$('#docPage').children].indexOf(blk),el=state.els.filter(e=>e.md===d.id&&e.mdB===ci).sort((a,b)=>(a.flowN||0)-(b.flowN||0))[0];if(!el||el.id===state.sel)return;state.sel=el.id;updateSel();renderInspector();
}
{const P=$('#docPage');
  P.addEventListener('input',()=>{dpAutoFormat();dpNormalize();dpInput()});
  P.addEventListener('keyup',e=>{if(e.key.startsWith('Arrow')||e.key==='Enter'||e.key==='PageDown'||e.key==='PageUp')dpFollow()});P.addEventListener('click',dpFollow);
  P.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&(document.body.classList.contains('docfocus')||document.body.classList.contains('wrfocus'))){e.preventDefault();e.stopPropagation();dpFocus(false);return}
    if(!(e.ctrlKey||e.metaKey)||e.altKey)return;const k=e.key.toLowerCase(),c=e.code;let kind=null;
    if(!e.shiftKey)kind={b:'b',i:'i',k:'link','1':'h1','2':'h2','3':'h3','0':'p'}[k]||null;else kind=c==='KeyL'?'ul':c==='Digit7'?'ol':c==='Period'?'quote':null;
    if(kind){e.preventDefault();e.stopPropagation();dpFormat(kind)}
  });
  // RULE: paste comes in as plain text, paragraph by paragraph; styling from other apps stays behind.
  P.addEventListener('paste',e=>{const t=e.clipboardData&&e.clipboardData.getData('text/plain');if(t==null)return;e.preventDefault();
    const parts=t.replace(/\r\n?/g,'\n').split(/\n{2,}/);if(parts.length<2)document.execCommand('insertText',false,t);else document.execCommand('insertHTML',false,parts.map(x=>`<p>${escH(x).replace(/\n/g,'<br>')}</p>`).join(''));dpInput()});
  P.addEventListener('blur',dpFlush);
  try{document.execCommand('defaultParagraphSeparator',false,'p')}catch(e){}
}
for(const b of document.querySelectorAll('#mdTools [data-md]'))b.addEventListener('click',e=>{if(dp.view==='page'){e.stopImmediatePropagation();dpFormat(b.dataset.md)}},true);
$('#docViewPage').onclick=()=>{audio();dpSetView('page')};
$('#docViewMd').onclick=()=>{audio();dpSetView('md')};
$('#docFocus').onclick=()=>{audio();dpFocus()};


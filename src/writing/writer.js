// SECTION: writer (the Write workspace as a word processor)
// RULE: Write is where words get written, so the page being typed on fills the middle: the canvas's real page size
//   and margins, each kind of block in the type its stylesheet gives it, a paragraph that won't fit moving to the next
//   sheet. A ribbon carries the tools, a ruler shows the margins, Navigation lists the headings, the status bar
//   counts pages and words. View → Pages shows the typeset pages themselves, where blocks become components.
// INVARIANT: there is one editor, #docPage (docpage.js). The writer borrows it, and #docText for the Markdown view,
//   and hands both back to the Text panel when it closes, so saving, undo and serializing stay in one place.
// FORMAT: localStorage pixiwyg.wr.view 'edit' | 'md' | 'pages'; pixiwyg.wr.zoom; pixiwyg.wr.nav and .ruler '1' | '0'.
const WR_GAP=28,WR_TAGS=['p','h1','h2','h3','blockquote','ul','ol','pre'];
const WR_STYLES=[['p','Normal'],['h1','Heading 1'],['h2','Heading 2'],['h3','Heading 3'],['blockquote','Quote']];
// HACK: var: docSync (manuscript.js) and dpFocus (docpage.js) ask whether the writer is open, before this file runs.
var wr={on:false,view:lsGetEarly('pixiwyg.wr.view','edit'),zoom:+lsGetEarly('pixiwyg.wr.zoom','1')||1,nav:lsGetEarly('pixiwyg.wr.nav','1')!=='0',
  ruler:lsGetEarly('pixiwyg.wr.ruler','1')!=='0',geo:null,pages:1,raf:0,hadL:false,hadR:false,probe:null,find:{hits:[],i:-1}};
const wrOpenNow=()=>wr.on&&wr.view!=='pages';

// SECTION: geometry and type
// FORMAT: {paged, w, h, m}: the sheet in page px, and its margin. A screen canvas is one long sheet, as wide as the
//   manuscript's column plus a margin each side (Word's Web layout).
function wrGeometry(){
  if(isFixed()){const {w,h}=pageDims(state.canvas);return{paged:true,w:Math.round(w),h:Math.round(h),m:Math.round((state.canvas.margin||0)*unitPx(state.canvas))}}
  const d=docById(curDoc),cw=Math.max(160,Math.min(d&&d.width||640,W-32));return{paged:false,w:cw+96,h:0,m:48};
}
// RULE: what's typed looks like what's set: each block kind is measured once in its own stylesheet, offstage, and the
//   page wears those fonts, sizes, weights and colours. The space between blocks is the manuscript's gap, as in flow.
function wrTypeCSS(){
  const d=docById(curDoc);if(!d)return'';
  if(!wr.probe){wr.probe=mkEl('div',{className:'wrprobe'});wr.probe.setAttribute('aria-hidden','true');wr.probe.attachShadow({mode:'open'});document.body.append(wr.probe)}
  const out=[],gap=d.gap??16;
  for(const tag of WR_TAGS){
    const st=docStyle(d,tag),t=buildInto(wr.probe.shadowRoot,{id:'wrprobe',tag,fileId:st.fileId,selector:st.selector,x:0,y:0,w:400,z:0,content:tag==='ul'||tag==='ol'?'<li>x</li>':'x'});
    if(!t)continue;const c=getComputedStyle(tag==='ul'||tag==='ol'?(t.querySelector('li')||t):t);
    out.push(`#writer .docpage>${tag}{font-family:${c.fontFamily};font-size:${c.fontSize};font-weight:${c.fontWeight};font-style:${c.fontStyle};line-height:${c.lineHeight};color:${c.color};letter-spacing:${c.letterSpacing};text-transform:${c.textTransform};text-align:${c.textAlign};margin:0 0 ${gap}px}`);
    wr['font_'+tag]={family:c.fontFamily,weight:c.fontWeight,style:c.fontStyle,color:c.color,size:parseFloat(c.fontSize)||16};
  }
  wr.probe.shadowRoot.replaceChildren();
  return out.join('\n');
}
const wrPaper=()=>{try{const b=state.bgd&&state.bgd.base;return b&&!b.none?colorOf(b):'#ffffff'}catch(e){return'#ffffff'}};

// SECTION: open, close, refresh
function wrOpen(){
  if(wr.on)return;wr.on=true;
  // RULE: the side panels fold while writing, as Animate folds Add; they come back as they were.
  wr.hadL=!document.body.classList.contains('noL');wr.hadR=!document.body.classList.contains('noR');
  if(wr.hadL)setSide('sideL',false);if(wr.hadR)setSide('sideR',false);
  $('#wrZoom').append($('#docPage'));$('#wrMd').append($('#docText'));
  wrSetView(wr.view==='pages'?'edit':wr.view,true);
}
function wrClose(){
  if(!wr.on)return;dpFlush();if(document.body.classList.contains('wrfocus'))dpFocus(false);wrFindClose();
  wr.on=false;document.body.classList.remove('wrwriting','wrpages');$('#writer').hidden=true;$('#wrBack').hidden=true;
  const link=$('#docLink');link.before($('#docPage'));link.after($('#docText'));
  for(const k of $('#docPage').children)k.style.marginTop='';
  if(!narrow()){if(wr.hadL)setSide('sideL',true);if(wr.hadR)setSide('sideR',true)}
  if(typeof fitStage==='function')fitStage();
}
function wrSetView(v,quiet){
  if(!['edit','md','pages'].includes(v))v='edit';wr.view=v;lsSet('pixiwyg.wr.view',v);if(!wr.on)return;
  const pages=v==='pages';document.body.classList.toggle('wrwriting',!pages);document.body.classList.toggle('wrpages',pages);
  $('#writer').hidden=pages;$('#wrBack').hidden=!pages;
  for(const b of document.querySelectorAll('[data-wrview]'))b.setAttribute('aria-pressed',b.dataset.wrview===v);$('#writer').classList.toggle('wrmdv',v==='md');
  if(pages){dpFlush();requestAnimationFrame(()=>{if(typeof fitStage==='function')fitStage();if(isFixed())zoomFit()});if(!quiet)status('The typeset pages. Back to writing is at the bottom.');return}
  dpSetView(v==='md'?'md':'page');wrRefresh();
  if(!quiet)(v==='md'?$('#docText'):$('#docPage')).focus();
}
function wrRefresh(){
  if(!wr.on)return;const d=docById(curDoc);
  $('#wrEmpty').hidden=!!d;$('#wrMain').hidden=!d;$('#wrTop').classList.toggle('off',!d);
  const sel=$('#wrDoc');sel.replaceChildren();for(const x of state.docs)sel.append(mkEl('option',{value:x.id,textContent:x.name}));if(d)sel.value=d.id;
  if(!d){wrStatus();return}
  wr.geo=wrGeometry();const g=wr.geo,P=$('#docPage');
  $('#wrType').textContent=wrTypeCSS();
  const W_=$('#writer');W_.style.setProperty('--wr-w',g.w+'px');W_.style.setProperty('--wr-m',g.m+'px');W_.style.setProperty('--wr-paper',wrPaper());wrFitZ();W_.style.setProperty('--wr-h',g.paged?g.h+'px':'100%');
  W_.classList.toggle('wrweb',!g.paged);W_.classList.toggle('wrnonav',!wr.nav);W_.classList.toggle('wrnoruler',!wr.ruler);
  P.style.padding=g.m+'px';
  wrMirrorLayout();wrDrawStyles();wrRuler();wrZoomUI();wrPaginate();
}
const wrLater=()=>{if(!wr.on||wr.raf)return;wr.raf=requestAnimationFrame(wrPaginate)};

// SECTION: pages
// RULE: a block that would cross the bottom margin moves whole to the top of the next sheet, so the sheets read as
//   pages. A block taller than a page is left to run across (the typeset pages split it; this view doesn't).
// INVARIANT: #docPage is a flex column here, so margins never collapse and a push is exactly the space it adds.
// PERF: every natural position is read in one layout pass with the pushes cleared; the pushes are then worked out in
//   JS with a running shift and written in one go. No read after a write.
function wrPaginate(){
  wr.raf=0;const g=wr.geo,P=$('#docPage');if(!wrOpenNow()||!g||wr.view!=='edit')return wrStatus();
  const kids=[...P.children];for(const k of kids)k.style.marginTop='';
  let pages=1;
  if(g.paged){
    const pitch=g.h+WR_GAP,usable=g.h-2*g.m,tops=kids.map(k=>k.offsetTop),hs=kids.map(k=>k.offsetHeight);let shift=0;
    kids.forEach((k,i)=>{let y=tops[i]+shift;const p=Math.floor(y/pitch),local=y-p*pitch;let push=0;
      if(local<g.m)push=g.m-local;else if(local+hs[i]>g.m+usable&&hs[i]<=usable)push=pitch-local+g.m;
      if(push){k.style.marginTop=push+'px';shift+=push;y+=push}
      pages=Math.max(pages,Math.floor((y+Math.max(1,hs[i])-1)/pitch)+1)});
    P.style.minHeight=(pages*pitch-WR_GAP)+'px';
  }else P.style.minHeight='';
  wr.pages=pages;
  const sh=$('#wrSheets');
  if(sh.childElementCount!==pages||sh.dataset.k!==g.w+'x'+g.h){sh.dataset.k=g.w+'x'+g.h;sh.replaceChildren(...Array.from({length:pages},(_,i)=>{const s=mkEl('div');s.style.top=(g.paged?i*(g.h+WR_GAP):0)+'px';return s}))}
  if(!g.paged)sh.firstChild.style.height=Math.max(P.offsetHeight,600)+'px';
  const total=g.paged?pages*(g.h+WR_GAP)-WR_GAP:Math.max(P.offsetHeight,600);
  $('#wrCanvas').style.height=Math.ceil(total*(wr.z||wr.zoom))+'px';
  wrNav();wrStatus();
}
// FORMAT: which sheet the caret is on, from its place in the page's own (unzoomed) coordinates.
function wrCaretPage(){
  const g=wr.geo,s=getSelection();if(!g||!g.paged||!s.rangeCount||!$('#docPage').contains(s.anchorNode))return 1;
  const r=s.getRangeAt(0).getClientRects()[0]||(s.anchorNode.nodeType===1?s.anchorNode:s.anchorNode.parentElement).getBoundingClientRect(),top=$('#docPage').getBoundingClientRect().top;
  return Math.min(wr.pages,Math.max(1,Math.floor((r.top-top)/(wr.z||wr.zoom)/(g.h+WR_GAP))+1));
}
function wrStatus(){
  const d=docById(curDoc);if(!d){$('#wrPageN').textContent='';$('#wrWords').textContent='';return}
  const words=(d.text.replace(/\x3C!--[\s\S]*?-->/g,'').replace(/[#>*_`~\[\]()!|-]/g,' ').match(/\S+/g)||[]).length;
  $('#wrPageN').textContent=wr.geo&&wr.geo.paged&&wr.view==='edit'?`Page ${wrCaretPage()} of ${wr.pages}`:wr.geo&&!wr.geo.paged?'Web layout':'';
  $('#wrWords').textContent=`${words.toLocaleString()} word${words===1?'':'s'} · ${Math.max(1,Math.round(words/230))} min read`;
}

// SECTION: ruler, zoom, navigation
// RULE: the ruler is the sheet's width at the current zoom: grey over the margins, white between, a tick every
//   centimetre (every half inch on screens' px canvases, which have none).
function wrRuler(){
  const g=wr.geo,R=$('#wrRuler');if(!g)return;const z=wr.z||wr.zoom,w=g.w*z,m=g.m*z,step=(isFixed()?MM*10:48)*z;
  R.style.width=w+'px';
  R.style.background=`linear-gradient(to right,var(--chrome2) ${m}px,var(--paper) ${m}px ${w-m}px,var(--chrome2) ${w-m}px)`;
  const ticks=[];for(let x=0,i=0;m+x<=w-m+.5;x+=step,i++){if(i)ticks.push(`<i style="left:${m+x}px"><b>${i}</b></i>`);if(m+x+step/2<w-m)ticks.push(`<i class="h" style="left:${m+x+step/2}px"></i>`)}
  R.innerHTML=`<s style="left:${m}px" title="Left margin"></s><s style="left:${w-m}px" title="Right margin"></s>`+ticks.join('');
}
const WR_ZOOMS=[.5,.75,.9,1,1.1,1.25,1.5,2];
function wrSetZoom(z){
  if(z==='fit'){const g=wr.geo;if(!g)return;z=Math.max(.3,Math.min(3,($('#wrScroll').clientWidth-48)/g.w))}
  wr.zoom=Math.round(Math.max(.3,Math.min(3,+z||1))*100)/100;lsSet('pixiwyg.wr.zoom',wr.zoom);wrFitZ();wrRuler();wrZoomUI();wrPaginate();
}
// RULE: the zoom asked for, unless the window is too narrow for it: then the sheet fits the window (the saved zoom
//   comes back when there is room).
function wrFitZ(){const g=wr.geo,sc=$('#wrScroll');let z=wr.zoom;if(g&&sc&&sc.clientWidth>0)z=Math.min(z,Math.max(.3,(sc.clientWidth-32)/g.w));wr.z=Math.round(z*100)/100;$('#writer').style.setProperty('--wr-z',wr.z)}
function wrZoomUI(){const z=wr.z||wr.zoom;$('#wrZoomR').value=Math.round(z*100);$('#wrZoomN').textContent=Math.round(z*100)+'%'}
function wrNav(){
  const box=$('#wrNavList');if(!wr.nav||!box)return;const hs=[...$('#docPage').children].filter(n=>/^H[1-3]$/.test(n.tagName));
  const sig=hs.map(h=>h.tagName+h.textContent).join('\n');if(box.dataset.sig===sig)return;box.dataset.sig=sig;box.replaceChildren();
  if(!hs.length){box.append(mkEl('p',{className:'shelp',textContent:'Headings you write show here. Click one to go to it.'}));return}
  hs.forEach((h,i)=>{const b=mkEl('button',{type:'button',className:'wrnavi l'+h.tagName[1],textContent:h.textContent.trim()||'(empty heading)'});
    b.onclick=()=>{audio();const n=[...$('#docPage').children].filter(n=>/^H[1-3]$/.test(n.tagName))[i];if(!n)return;n.scrollIntoView({block:'start',behavior:'smooth'});
      const r=document.createRange();r.selectNodeContents(n);r.collapse(true);const s=getSelection();s.removeAllRanges();s.addRange(r);$('#docPage').focus({preventScroll:true})};
    box.append(b)});
}

// SECTION: ribbon state
function wrDrawStyles(){
  const box=$('#wrStyles');box.replaceChildren();
  for(const [tag,name] of WR_STYLES){const f=wr['font_'+tag]||{},b=mkEl('button',{type:'button',className:'wrsty'});b.dataset.block=tag;
    const s=mkEl('span',{textContent:'AaBbCc'});s.style.cssText=`font-family:${f.family||'inherit'};font-weight:${f.weight||400};font-style:${tag==='blockquote'?'italic':f.style||'normal'};color:${f.color||'inherit'};font-size:${Math.max(11,Math.min(19,(f.size||16)*.7))}px`;
    b.append(s,mkEl('small',{textContent:name}));b.title=name+({p:' (Ctrl/⌘+0)',h1:' (Ctrl/⌘+1)',h2:' (Ctrl/⌘+2)',h3:' (Ctrl/⌘+3)',blockquote:' (Ctrl/⌘+Shift+.)'}[tag]||'');
    b.onmousedown=e=>e.preventDefault();b.onclick=()=>{audio();dpFormat(tag==='blockquote'?'quote':tag);for(const x of box.children)x.setAttribute('aria-pressed',x===b);wrSync()};box.append(b)}
}
// RULE: the ribbon shows where the caret is: its paragraph style lit, bold and italic pressed when they apply.
function wrSync(){
  if(!wrOpenNow()||wr.view!=='edit')return;const s=getSelection();if(!s.rangeCount||!$('#docPage').contains(s.anchorNode))return;
  const n=s.anchorNode.nodeType===1?s.anchorNode:s.anchorNode.parentElement,blk=n.closest('#docPage>*'),tag=blk?blk.tagName.toLowerCase():'p';
  for(const b of document.querySelectorAll('#wrStyles .wrsty'))b.setAttribute('aria-pressed',b.dataset.block===tag);
  const q=c=>{try{return document.queryCommandState(c)}catch(e){return false}};
  for(const [id,c] of [['wrB','bold'],['wrI','italic'],['wrS','strikeThrough'],['wrUl','insertUnorderedList'],['wrOl','insertOrderedList']])$('#'+id).setAttribute('aria-pressed',q(c));
  $('#wrStatusStyle').textContent=(WR_STYLES.find(x=>x[0]===tag)||[0,tag==='ul'?'Bulleted list':tag==='ol'?'Numbered list':'Markdown'])[1];
  wrStatus();
}
// RULE: Layout's choices are the Text panel's own controls, mirrored, so there is one place they're handled.
function wrMirrorLayout(){
  for(const [mine,theirs] of [['#wrSheet','#docSheet'],['#wrFrom','#docFrom']]){const a=$(mine),b=$(theirs);a.replaceChildren(...[...b.options].map(o=>mkEl('option',{value:o.value,textContent:o.textContent})));a.value=b.value}
  $('#wrFromRow').hidden=!isFixed();
  const c=state.canvas;$('#wrPageInfo').textContent=canvasSummary(c)+(isFixed()?` · margins ${c.margin} mm`:` · margins ${c.margin||0} px`);
}

// SECTION: find and replace
// RULE: matches light up with the CSS Highlight API, so finding never touches the text; replacing goes through the
//   editor (insertText), so Undo takes a replacement back like any typing.
function wrFindRun(keep){
  const q=$('#wrFindQ').value,P=$('#docPage'),hits=[];
  if(q){const cs=$('#wrFindCase').checked,needle=cs?q:q.toLowerCase();
    for(const blk of P.children){if(blk.isContentEditable===false||blk.classList.contains('dplock'))continue;
      const nodes=[],tw=document.createTreeWalker(blk,NodeFilter.SHOW_TEXT);let txt='';for(let t=tw.nextNode();t;t=tw.nextNode()){nodes.push([t,txt.length]);txt+=t.nodeValue}
      const hay=cs?txt:txt.toLowerCase();
      for(let i=hay.indexOf(needle);i>=0;i=hay.indexOf(needle,i+needle.length)){
        const at=o=>{let k=nodes.length-1;while(k>0&&nodes[k][1]>o)k--;return[nodes[k][0],o-nodes[k][1]]};
        const r=document.createRange(),[sn,so]=at(i),[en,eo]=at(i+needle.length);
        if(eo===0&&en!==sn){const j=nodes.findIndex(x=>x[0]===en);if(j>0){r.setStart(sn,so);r.setEnd(nodes[j-1][0],nodes[j-1][0].nodeValue.length);hits.push(r);continue}}
        r.setStart(sn,so);r.setEnd(en,eo);hits.push(r)}}}
  wr.find.hits=hits;wr.find.i=hits.length?Math.min(keep?Math.max(0,wr.find.i):0,hits.length-1):-1;wrFindPaint();
}
function wrFindPaint(){
  const {hits,i}=wr.find;
  try{if(window.CSS&&CSS.highlights){CSS.highlights.set('wr-find',new Highlight(...hits));CSS.highlights.set('wr-cur',new Highlight(...(i>=0?[hits[i]]:[])))}}catch(e){}
  $('#wrFindN').textContent=$('#wrFindQ').value?(hits.length?`${i+1} of ${hits.length}`:'No matches'):'';
  if(i>=0){const r=hits[i].getBoundingClientRect(),b=$('#wrScroll').getBoundingClientRect();if(r.top<b.top+40||r.bottom>b.bottom-40)$('#wrScroll').scrollTop+=r.top-b.top-b.height/3}
}
function wrFindStep(d){const n=wr.find.hits.length;if(!n)return;wr.find.i=(wr.find.i+d+n)%n;wrFindPaint()}
function wrReplace(all){
  const rep=$('#wrFindR').value;if(!wr.find.hits.length)return;const P=$('#docPage');P.focus({preventScroll:true});
  const list=all?[...wr.find.hits].reverse():[wr.find.hits[wr.find.i]],s=getSelection();
  for(const r of list){s.removeAllRanges();s.addRange(r);document.execCommand('insertText',false,rep)}
  const n=list.length;wrFindRun(!all);if(!all)wrFindPaint();status(all?`Replaced ${n}.`:'Replaced one.');
}
function wrFindOpen(replace){if(wr.view!=='edit')wrSetView('edit',true);$('#wrFind').hidden=false;$('#wrFind').classList.toggle('rep',!!replace);
  const s=getSelection();if(s.rangeCount&&!s.isCollapsed&&$('#docPage').contains(s.anchorNode)&&s.toString().length<80)$('#wrFindQ').value=s.toString();
  $('#wrFindQ').focus();$('#wrFindQ').select();wrFindRun()}
function wrFindClose(){if($('#wrFind').hidden)return;$('#wrFind').hidden=true;wr.find={hits:[],i:-1};try{CSS.highlights.delete('wr-find');CSS.highlights.delete('wr-cur')}catch(e){}if(wr.on&&wr.view==='edit')$('#docPage').focus()}

// SECTION: insert
function wrInsertRaw(src){$('#docPage').focus();document.execCommand('insertHTML',false,`<div class="dpraw">${escH(src)}</div><p><br></p>`);dpInput()}
// RULE: a picture goes in as a Markdown image carrying its data, shown as the picture (not its code) and kept whole.
async function wrInsertPicture(f){
  if(!f||!/^image\//.test(f.type)){status('Pick a picture: PNG, JPEG, GIF, WebP or SVG.');return}
  const url=await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(f)});if(!okImg(url))return;
  const alt=f.name.replace(/\.[^.]+$/,'').replace(/[\[\]]/g,''),src=`![${alt}](${url})`;$('#docPage').focus();
  document.execCommand('insertHTML',false,`<figure class="dpraw dpimg" contenteditable="false" data-src="${escH(src)}"><img src="${escH(url)}" alt="${escH(alt)}"></figure><p><br></p>`);dpInput();
}

// SECTION: wiring
{const tabs=[...document.querySelectorAll('#wrTabs [role=tab]')];
  for(const t of tabs)t.onclick=()=>{audio();for(const x of tabs){const on=x===t;x.setAttribute('aria-selected',on);$('#'+x.getAttribute('aria-controls')).hidden=!on}};}
for(const b of document.querySelectorAll('#writer [data-cmd]')){b.onmousedown=e=>e.preventDefault();b.onclick=()=>{audio();const k=b.dataset.cmd;
  if(k==='strike'){$('#docPage').focus();document.execCommand('strikeThrough');dpInput()}
  else if(k==='clear'){$('#docPage').focus();document.execCommand('removeFormat');document.execCommand('unlink');dpFormat('p')}
  else if(k==='table')wrInsertRaw('| Column | Column |\n| --- | --- |\n|  |  |');
  else if(k==='codeblock')wrInsertRaw('```\ncode\n```');
  else if(k==='picture')$('#wrPicFile').click();
  else if(k==='find')wrFindOpen(false);else if(k==='replace')wrFindOpen(true);
  else dpFormat(k);wrSync()}}
for(const b of document.querySelectorAll('[data-wrview]'))b.onclick=()=>{audio();wrSetView(b.dataset.wrview)};
$('#wrPicFile').onchange=e=>{const f=e.target.files[0];e.target.value='';wrInsertPicture(f)};
$('#wrDoc').onchange=e=>{openDoc(e.target.value)};
$('#wrSheet').onchange=e=>{const b=$('#docSheet');b.value=e.target.value;b.dispatchEvent(new Event('change'));wrRefresh()};
$('#wrFrom').onchange=e=>{const b=$('#docFrom');b.value=e.target.value;b.dispatchEvent(new Event('change'))};
$('#wrSetup').onclick=()=>{audio();setSide('sideR',true);wr.hadR=true;const s=$('#w-canvas');s.open=true;s.scrollIntoView({block:'start'});status('Page size, margins and pages are under Canvas.')};
$('#wrFocus').onclick=()=>{audio();dpFocus()};
$('#wrConvertAll').onclick=()=>{audio();$('#docConvertAll').click()};
$('#wrNavOn').onchange=e=>{wr.nav=e.target.checked;lsSet('pixiwyg.wr.nav',wr.nav?'1':'0');$('#writer').classList.toggle('wrnonav',!wr.nav);$('#wrNavList').dataset.sig='';wrNav()};
$('#wrRulerOn').onchange=e=>{wr.ruler=e.target.checked;lsSet('pixiwyg.wr.ruler',wr.ruler?'1':'0');$('#writer').classList.toggle('wrnoruler',!wr.ruler)};
$('#wrNavOn').checked=wr.nav;$('#wrRulerOn').checked=wr.ruler;
$('#wrZoomR').oninput=e=>wrSetZoom(+e.target.value/100);
$('#wrZoomOut').onclick=()=>{audio();wrSetZoom([...WR_ZOOMS].reverse().find(z=>z<wr.zoom-.001)||WR_ZOOMS[0])};
$('#wrZoomIn').onclick=()=>{audio();wrSetZoom(WR_ZOOMS.find(z=>z>wr.zoom+.001)||WR_ZOOMS[WR_ZOOMS.length-1])};
$('#wrZoomFit').onclick=()=>{audio();wrSetZoom('fit')};
$('#wrStart').onclick=()=>$('#docStart').click();$('#wrStartImport').onclick=()=>$('#docStartImport').click();
$('#wrFindQ').addEventListener('input',()=>wrFindRun());$('#wrFindCase').onchange=()=>wrFindRun();
$('#wrFindQ').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();wrFindStep(e.shiftKey?-1:1)}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();wrFindClose()}});
$('#wrFindR').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();wrReplace(false)}else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();wrFindClose()}});
$('#wrFindPrev').onclick=()=>wrFindStep(-1);$('#wrFindNext').onclick=()=>wrFindStep(1);
$('#wrRep1').onclick=()=>wrReplace(false);$('#wrRepAll').onclick=()=>wrReplace(true);$('#wrFindX').onclick=()=>wrFindClose();
$('#wrBackBtn').onclick=()=>{audio();wrSetView('edit')};
{const P=$('#docPage');
  P.addEventListener('input',()=>{wrLater();if(!$('#wrFind').hidden)wrFindRun(true)});
  // RULE: Word's find keys while writing: Ctrl/Cmd+F finds, Ctrl/Cmd+H replaces.
  P.addEventListener('keydown',e=>{if(!wrOpenNow()||!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey)return;const k=e.key.toLowerCase();
    if(k==='f'||k==='h'){e.preventDefault();e.stopPropagation();wrFindOpen(k==='h')}});
}
document.addEventListener('selectionchange',()=>{if(wrOpenNow())wrSync()});
new ResizeObserver(()=>{if(!wrOpenNow())return;const z=wr.z;wrFitZ();if(wr.z!==z){wrRuler();wrZoomUI()}wrLater()}).observe($('#wrScroll'));
document.fonts.addEventListener('loadingdone',()=>{if(wrOpenNow())wrRefresh()});


// SECTION: export
const lsGet=(k,d)=>{try{return localStorage.getItem(k)??d}catch(e){return d}},lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
// SAFETY: unpkg URL pinned to the vendored release with SRI; a test keeps the two in step.
const WEBAMP_CDN='https://unpkg.com/webamp@2.3.1/built/webamp.bundle.min.js',WEBAMP_SRI='sha384-9waE2xOw4VkyDDXbmumm9jR3ovD2w9gGl0+ehyi66rJSOPx9lyNxs8+jSS2HruM6';
const expOpt={site:lsGet('pixiwyg.exp.site','0')==='1',playerCdn:lsGet('pixiwyg.exp.playerCdn','1')==='1',marks:lsGet('pixiwyg.exp.marks','1')==='1',nojs:lsGet('pixiwyg.exp.nojs','1')==='1',fonts:lsGet('pixiwyg.exp.fonts','1')==='1',prune:lsGet('pixiwyg.exp.prune','1')==='1',imposed:lsGet('pixiwyg.exp.imposed','0')==='1',bleed:lsGet('pixiwyg.exp.bleed','0')==='1'};
const GF_LINK='<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;600;700&family=Rubik+Mono+One&family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,800;1,9..144,400&family=VT323&family=Press+Start+2P&family=Neucha&family=Patrick+Hand+SC&display=swap">';
// INVARIANT: pseudo-elements and state pseudo-classes can't match a static tree; stripped before matching.
const PSEUDO=/::[\w-]+(?:\([^)]*\))?|:(?:before|after|first-line|first-letter|hover|focus|focus-visible|focus-within|active|visited|link|any-link|target|checked|disabled|enabled|indeterminate|placeholder-shown|default|valid|invalid|required|optional|read-only|read-write|in-range|out-of-range|user-invalid|autofill|-webkit-[\w-]+|-moz-[\w-]+|-ms-[\w-]+)(?![\w-])(?:\([^)]*\))?/g;
function selectorUsed(sel,nodes){
  for(const s of splitSel(sel)){
    let t=s.replace(PSEUDO,'').trim();if(!t||/[>+~]$/.test(t))t=(t+' *').trim();if(/^[>+~]/.test(t))t='* '+t;
    try{for(const n of nodes)if(n.matches(t))return true}catch(e){return true}
  }
  return false;
}
function pruneRules(rules,nodes,all){
  const out=[];
  for(const r of rules){
    if(r instanceof CSSFontFaceRule)continue;
    if(r instanceof CSSStyleRule){if(all||selectorUsed(r.selectorText,nodes))out.push(r.cssText);continue}
    if(r instanceof CSSKeyframesRule){out.push({kf:r.name,text:r.cssText});continue}
    const head=r instanceof CSSMediaRule?'@media '+r.media.mediaText
      :(typeof CSSSupportsRule!=='undefined'&&r instanceof CSSSupportsRule)?'@supports '+r.conditionText
      :(typeof CSSContainerRule!=='undefined'&&r instanceof CSSContainerRule)?'@container '+r.conditionText
      :(typeof CSSLayerBlockRule!=='undefined'&&r instanceof CSSLayerBlockRule)?'@layer '+r.name:null;
    if(head){const inner=pruneRules(r.cssRules,nodes,all);if(inner.length)out.push({head,inner})}
    else out.push(r.cssText);
  }
  return out;
}
function cssFrom(items){
  const flat=x=>x.map(i=>typeof i==='string'?i:i.head?`${i.head}{${flat(i.inner)}}`:'').filter(Boolean).join('\n');
  const body=flat(items),kfs=[];
  const walk=x=>x.forEach(i=>{if(i.kf)kfs.push(i);else if(i.inner)walk(i.inner)});walk(items);
  const used=kfs.filter(k=>new RegExp('(^|[\\s,:])'+k.kf.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?=[\\s,;!}]|$)').test(body));
  return body+(used.length?'\n'+used.map(k=>k.text).join('\n'):'');
}
const parseFaces=t=>(t.match(/@font-face\s*\{[^}]*\}/g)||[]).map(css=>({css,fam:((css.match(/font-family\s*:\s*(['"]?)([^;'"}]+)\1/i)||[])[2]||'').trim().toLowerCase()}));
async function buildExport(opt={}){
  // RULE: a site of several pages exports as one file of sections (or a zip of files); see buildSite in site.js.
  if(!opt.part&&!opt.page&&multiPage()&&siteOn())return buildSite(opt);
  // FORMAT: opt.prefix namespaces this page's element and sheet numbers when several pages share one document;
  //   opt.page = {mode, pages:[{id,slug,name,title,href}], cur} is set when a site is being exported.
  const pre=opt.prefix||'',SP=opt.page||null,hrefOf=id=>{const p=SP&&SP.pages.find(x=>x.id===id);return p?p.href:null};
  const trees=[...state.els].sort((a,b)=>(a.z||0)-(b.z||0)).map((el,i)=>({el,i,t:makeTree(el)}));
  // FORMAT: exported logic names elements by back-to-front index; data-px finds the box, data-pxt the element in it.
  const G=cleanGraph(state.logic,{ref:id=>{const x=trees.find(x=>x.el.id===id);return x?x.i:null},songRef:id=>{const i=state.songs.findIndex(s=>s.id===id);return i<0?null:i},pageRef:id=>{const p=SP&&SP.pages.find(x=>x.id===id);return p?p.slug:null}});
  const anims=trees.filter(x=>x.el.anim).map(x=>({ref:x.i,spec:animSpec(x.el.anim)})).filter(a=>a.spec);
  const live=G.nodes.length>0||anims.length>0;buildExport.live={G,anims};
  if(live)for(const x of trees)x.t.target.setAttribute('data-pxt','');
  // RULE: a 3D element's model file is for re-baking in the editor; the page only needs its atlas.
  for(const x of trees){x.t.target.removeAttribute('data-px3d-src');x.t.target.removeAttribute('data-px3d-tex')}
  const nodesOf=t=>[t.node,...t.node.querySelectorAll('*')];
  const reset=RESET_CSS.replace(/\[contenteditable=true\][^}]*\}/,'');
  const escTag=s=>s.replace(/<\/(style|script)/gi,'<\\/$1');
  const pos=(el,dx=0,dy=0)=>{const b=isScaled(el)&&layoutBox(el);return`left:${el.x-dx}px;top:${el.y-dy}px;${el.w?`width:${el.w}px;`:''}z-index:${el.z||0}${b?`;pointer-events:none;transform-origin:${Math.round(b.w/2)}px ${Math.round(b.h/2)}px`:''}`};
  // RULE: an element that links to a page is wrapped in a real link, so it works with scripts off too.
  const linked=(x,html)=>{const h=x.el.link&&hrefOf(x.el.link);return h?`<a class="pxlink" href="${escH(h)}">${html}</a>`:html};
  const all=!expOpt.prune;let kept='',body,tail='',sheetTags='',musicTail='',dragTail='',hydrate='';
  let one;
  if(expOpt.nojs){
    for(const x of trees){x.css=sheetsFor(x.el,x.t.file).map(sh=>cssFrom(pruneRules(sh.cssRules,nodesOf(x.t),all))).join('\n');kept+=x.css+'\n'}
    // RULE: no-script exports: load/in-view animations play once on load and hover ones follow the pointer;
    //   click animations and page logic need the script.
    const st=sp=>{const b=sp.b;return{t:`translate(${b.x}px,${b.y}px) rotate(${b.rot}deg) scale(${b.scale/100})`,o:b.op/100}};
    const easeOf=(e,c)=>e==='bounce'?'cubic-bezier(.34,1.56,.64,1)':e==='custom'&&c?`cubic-bezier(${c})`:e||'ease';
    const kst=k=>`transform:translate(${k.x}px,${k.y}px) rotate(${k.rot}deg) scale(${k.scale/100});opacity:${k.op/100}`;
    const cssAnim=new Map();
    // INVARIANT: the live preview runs every animation from the editor, so CSS-only versions are left out.
    for(const {ref,spec} of opt.live?[]:anims){
      const b=st(spec),A='transform:none;opacity:1',B=`transform:${b.t};opacity:${b.o}`,[from,to]=spec.from==='B'?[B,A]:[A,B];
      const cf=spec.b.fg?`color:${spec.b.fg}!important;`:'',cb=spec.b.bg?`background-color:${spec.b.bg}!important;`:'';
      const dir=spec.alt?' alternate':'',it=spec.repeat==='forever'?'infinite':spec.repeat==='twice'?2:1;
      if(spec.trigger==='hover'){
        tail+=`.el[data-px="${pre}${ref}"]{${from};transition:transform ${spec.dur}ms ${easeOf(spec.ease,spec.curve)} ${spec.delay}ms,opacity ${spec.dur}ms ${easeOf(spec.ease,spec.curve)} ${spec.delay}ms}.el[data-px="${pre}${ref}"]:hover{${to}}`;
        if(cf||cb)cssAnim.set(ref,`[data-pxt]{transition:color ${spec.dur}ms,background-color ${spec.dur}ms}:host(:hover) [data-pxt]{${cf}${cb}}`);
      }else if(spec.trigger==='load'||spec.trigger==='inview'){
        // RULE: keyframes play in CSS for load and in-view; a hover transition can only go A to B, so it skips them.
        const mid=(spec.keys||[]).map(k=>`${Math.round((spec.from==='B'?100-k.at:k.at)*10)/10}%{${kst(k)}}`).join('');
        tail+=`@keyframes px${pre}${ref}{from{${from}}${mid}to{${to}}}.el[data-px="${pre}${ref}"]{animation:px${pre}${ref} ${spec.dur}ms ${easeOf(spec.ease,spec.curve)} ${spec.delay}ms ${it}${dir} both}`;
        if(cf||cb)cssAnim.set(ref,`@keyframes pxc{to{${(cf+cb).replace(/!important/g,'')}}}[data-pxt]{animation:pxc ${spec.dur}ms ${easeOf(spec.ease,spec.curve)} ${spec.delay}ms ${it}${dir} both}`);
      }
    }
    if(tail)tail=`<style>@media (prefers-reduced-motion:no-preference){${tail}}</style>`;
    one=({el,i,t,css},dx,dy)=>`<div class="el" data-px="${pre}${i}" style="${pos(el,dx,dy)}"><template shadowrootmode="open"><style>${escTag(reset+'\n'+css+(cssAnim.has(i)?'\n'+cssAnim.get(i):''))}</style>${t.node.outerHTML}</template></div>`;
  }else{
    trees.forEach(x=>{x.sheets=sheetsFor(x.el,x.t.file)});
    const used=[...new Set(trees.flatMap(x=>x.sheets))],idx=new Map(used.map((sh,i)=>[sh,i]));
    const nameOf=sh=>{const x=trees.find(x=>x.sheets.includes(sh));return x&&x.t.file?x.t.file.name+(sh._accent?' (element colors)':sh!==x.t.file.sheet?' (palette)':''):'page palette'};
    one=({el,i,t,sheets},dx,dy)=>`<div class="el" data-px="${pre}${i}" data-sheet="${sheets.map(sh=>pre+idx.get(sh)).join(',')}" style="${pos(el,dx,dy)}"><template>${t.node.outerHTML}</template></div>`;
    tail=used.map((sh,i)=>{
      const css=cssFrom(pruneRules(sh.cssRules,trees.filter(x=>x.sheets.includes(sh)).flatMap(x=>nodesOf(x.t)),all));kept+=css+'\n';
      return `<script type="text/plain" id="sheet-${pre}${i}">/* ${nameOf(sh).replace(/\*\//g,'')} */\n${escTag(css)}<\/script>`;
    }).join('\n');sheetTags=tail;const h0=tail.length;tail+=`
<script>
(()=>{const reset=new CSSStyleSheet();reset.replaceSync(${JSON.stringify(reset)});const cache={};
document.querySelectorAll('.el').forEach(h=>{const tpl=h.querySelector('template');const r=h.attachShadow({mode:'open'});const list=[];
for(const i of (h.dataset.sheet||'').split(',').filter(Boolean)){if(!cache[i]){const s=new CSSStyleSheet();s.replaceSync(document.getElementById('sheet-'+i).textContent);cache[i]=s}list.push(cache[i])}
list.push(reset);r.adoptedStyleSheets=list;r.append(tpl.content.cloneNode(true));tpl.remove()});})();
<\/script>`;hydrate=tail.slice(h0);
    // INVARIANT: the same pxRuntime Play uses, fed the page's logic and animations as JSON.
    const J=v=>JSON.stringify(v).replace(/</g,'\\u003c');
    const music=G.nodes.some(n=>n.type==='song')&&state.songs.some(s=>s.tracks.some(t=>t.notes.length));
    if(music){
      // RULE: the exported player renders the song in the visitor's browser with the built-in synth; the skin rides as data.
      let skin=state.player&&state.player.skin==='custom'?state.player.data:null;
      const sk=state.player&&SKINS.find(x=>x.id===state.player.skin&&x.file);
      if(sk){try{const r=await fetch('lib/'+sk.file);skin=`data:${SKIN_MIME};base64,${bytesB64(new Uint8Array(await r.arrayBuffer()))}`}catch(e){}}
      const tl0=tail.length;
      tail+=expOpt.playerCdn?`\n<script src="${WEBAMP_CDN}" integrity="${WEBAMP_SRI}" crossorigin="anonymous"><\/script>`:`\n<script>${escTag(await fetchLib('webamp.bundle.min.js'))}<\/script>`;
      tail+=`
<script>
const pxSynth=(${pxSynth}),pxRender=(${pxRender}),pxFx=(${pxFx}),pxSample=(${pxSample}),pxWav=(${pxWav}),pxPlayer=(${pxPlayer});
window.__pxMusic=(()=>{const S=${J(state.songs.map(cleanSong))},MAP=${J(GMV)},done={};
const p=pxPlayer({win:window,Webamp:()=>Promise.resolve(window.Webamp),skin:()=>${J(skin)},skins:[],song:async i=>{const k=S[+i]?+i:0,m=S[k];if(!m)return null;if(!done[k]){const b=await pxRender(m,MAP);done[k]={key:'song'+k,blob:pxWav(b),duration:b.duration,title:m.name,artist:${J(state.project?state.project.name:'')}}}return done[k]}});
return(what,e,song)=>p.control(what,e&&e.host,song)})();
<\/script>`;musicTail=tail.slice(tl0);
    }
    // RULE: drag-to-turn models bring their own small runtime, logic or not.
    if(state.els.some(e=>/(^|\s)drag(\s|$)/.test(e.extra||'')&&e.attrs&&e.attrs['data-px3d']))dragTail=`
<script>
(${px3dDrag})([...document.querySelectorAll('.el')]);
<\/script>`;tail+=dragTail;
    if(live){
      tail+=`
<script>
(${pxRuntime})(${J(G)},${J(anims)},{el:i=>{const h=document.querySelector('.el[data-px="'+i+'"]');return h?{host:h,target:h.shadowRoot&&h.shadowRoot.querySelector('[data-pxt]')}:null},animate(){},music:window.__pxMusic${SP?siteEnvJS(SP,J):''}});
<\/script>`}
  }
  // PERF: only font faces whose family the kept CSS names are embedded.
  const low=kept.toLowerCase(),faces=[],seen=new Set();
  const consider=list=>{for(const f of list)if(f.fam&&low.includes(f.fam)&&!seen.has(f.css)){seen.add(f.css);faces.push(f.css)}};
  consider(parseFaces([...new Set(trees.map(x=>x.t.file).filter(Boolean))].map(f=>f.fonts).join('\n')));
  let link='';
  if(expOpt.fonts){try{consider(parseFaces(await fetchLib('fonts.css')))}catch(e){link=GF_LINK}}else link=GF_LINK;
  const title=escH(SP&&SP.title?SP.title:state.project?state.project.name:'PIXIWYG page'),font=`font:16px/1.35 "Times New Roman",Times,serif;color:${pagePal()?palC(1):'#000'}`;
  if(opt.part)return{html:trees.map(x=>linked(x,one(x,0,0))).join('\n'),bg:bgDecl(state.bgd),font,kept,faces,link,sheetTags,hydrate,musicTail,dragTail,rawTail:tail,G,anims,live,title};
  let css,html;
  if(!isFixed()){
    css=`body{margin:0;background:#ddd}.page{position:relative;width:${W}px;height:${H}px;margin:24px auto;${bgDecl(state.bgd)};${font}}.el{position:absolute}`;
    body=trees.map(x=>linked(x,one(x,0,0))).join('\n');html=`<div class="page">\n${body}\n</div>`;
  }else{
    // RULE: an element across the gutter lands on both pages, clipped at the fold.
    const c=state.canvas,rs=pageRects(),d=pageDims(),imposed=expOpt.imposed&&(c.type==='booklet'||c.type==='minizine'),b=!imposed&&expOpt.bleed&&c.type!=='screen'?Math.round(c.bleed*MM):0;
    const pg=r=>{const fo=folio(r.i,b);return`<div class="pg">\n${trees.filter(x=>elPages(x.el,[r],b).length).map(x=>one(x,r.x-b,r.y-b)).join('\n')}${fo?`\n<span class="folio" style="${fo.style}">${fo.text}</span>`:''}\n</div>`};
    // RULE: marks print outside the page: crop marks around a bled page, fold and cut guides at sheet edges.
    const mk=(x,y,w,h,cls='')=>`<i class="mk${cls}" style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"></i>`;
    const base=`body{margin:0;background:#ccc}.pg{position:relative;overflow:hidden;width:${d.w+2*b}px;height:${d.h+2*b}px;${bgDecl(state.bgd)};${font}}.el{position:absolute}.folio{position:absolute;z-index:99999;font-size:11px;line-height:1;transform:translateY(50%)}.mk{position:absolute;z-index:99999;background:#000}.mk.cut{background:none;border-top:1px dashed #777}`;
    const print=`@media print{body{background:none}.page,.sheet{margin:0!important;box-shadow:none!important;break-after:page}}`;
    if(imposed){
      const cols=c.type==='booklet'?2:4,rows=c.type==='booklet'?1:2;
      css=`${base}@page{size:${paperCSS(c.sheet,true)};margin:0}.sheet{position:relative;display:grid;grid-template-columns:repeat(${cols},${d.w}px);width:${d.w*cols}px;height:${d.h*rows}px;margin:24px auto;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.3);overflow:hidden}.slot{overflow:hidden}.slot.rot{transform:rotate(180deg)}${print}`;
      const t=Math.round(6*MM),SW=d.w*cols,SH=d.h*rows;let marks='';
      if(expOpt.marks){
        for(let k=1;k<cols;k++)marks+=mk(k*d.w,0,1,t)+mk(k*d.w,SH-t,1,t);
        if(rows>1)marks+=mk(0,d.h,t,1)+mk(SW-t,d.h,t,1)+mk(d.w,d.h,2*d.w,1,' cut');
      }
      html=imposition(c).map(side=>`<section class="sheet">\n${side.map(x=>`<div class="slot${x.rot?' rot':''}">${pg(rs.find(r=>r.i===x.p))}</div>`).join('\n')}${marks}\n</section>`).join('\n');
    }else{
      // INVARIANT: crop marks need a paper strip outside the bleed (10mm).
      const sl=b&&expOpt.marks?Math.round(10*MM):0,PW=d.w+2*b+2*sl,PH=d.h+2*b+2*sl;let marks='';
      if(sl){const g=Math.round(2*MM),L=sl-g,x1=sl+b,x2=sl+b+d.w,y1=sl+b,y2=sl+b+d.h;
        marks=mk(x1,0,1,L)+mk(x2,0,1,L)+mk(x1,PH-L,1,L)+mk(x2,PH-L,1,L)+mk(0,y1,L,1)+mk(0,y2,L,1)+mk(PW-L,y1,L,1)+mk(PW-L,y2,L,1)}
      css=`${base}@page{size:${b?`${PW}px ${PH}px`:d.css};margin:0}.page{position:relative;width:${PW}px;height:${PH}px;margin:24px auto;background:#fff;box-shadow:0 2px 14px rgba(0,0,0,.3)}.page>.pg{position:absolute;left:${sl}px;top:${sl}px}${print}`;
      html=rs.map(r=>`<section class="page" aria-label="${pageLabel(r.i)}">\n${pg(r)}${marks}\n</section>`).join('\n');
    }
  }
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="generator" content="PIXIWYG ${APP_VERSION}">
<title>${title}</title>${link?'\n'+link:''}
<style>${css}
${faces.join('\n')}</style></head><body>
${html}${tail?'\n'+tail:''}
</body></html>`;
}
function syncExpUI(){
  $('#optSite').checked=expOpt.site;$('#optSiteRow').hidden=!(multiPage()&&siteOn());$('#optNoJs').checked=expOpt.nojs;$('#optFonts').checked=expOpt.fonts;$('#optPrune').checked=expOpt.prune;$('#optImposed').checked=expOpt.imposed;$('#optBleed').checked=expOpt.bleed;
  const c=state.canvas||{type:'web'},fold=c.type==='booklet'||c.type==='minizine';
  $('#optImposedRow').hidden=!fold;$('#optBleedRow').hidden=!(c.type==='page'||c.type==='booklet'||c.type==='minizine')||(fold&&expOpt.imposed);$('#printBtn').hidden=!isFixed();
  $('#optMarks').checked=expOpt.marks;$('#optPlayerCdn').checked=expOpt.playerCdn;$('#optPlayerRow').hidden=expOpt.nojs||!(state.logic&&state.logic.nodes.some(n=>n.type==='song'));const imp=fold&&expOpt.imposed;$('#optMarksRow').hidden=!(imp||(expOpt.bleed&&!$('#optBleedRow').hidden));
  $('#optMarksName').textContent=imp?'Fold and cut marks':'Crop marks';
  $('#optMarksNote').textContent=imp?(c.type==='minizine'?'Short ticks at the folds, and a dashed line where the middle slit is cut.':'Short ticks at the edge of each sheet where it folds.'):'Lines outside the bleed that show where to trim. Adds a strip of paper around each page.';
  $('#optImposedNote').textContent=c.type==='minizine'?'All eight pages on one sheet: fold it, cut the middle slit, fold again.':'Two pages to a sheet in staple order. Print double-sided, flipping on the short edge.';
  $('#expNote').textContent=expOpt.nojs
    ?'Each element carries its own small stylesheet in a declarative shadow root, so styles from different files never collide and no script runs. Opens in Chrome and Edge 111+, Safari 16.4+ and Firefox 123+.'
    :'Each stylesheet is stored once and a short script attaches it to the elements that use it. Smallest when many elements share one sheet, but the page needs JavaScript to show its elements.';
}
let expRun=0;
async function refreshExport(){
  const run=++expRun;$('#expSize').textContent='Building…';$('#copyBtn').disabled=true;
  const html=await buildExport();if(run!==expRun)return;
  // RULE: warn only about outside references that survived into this export.
  const outside=[...new Set([...html.matchAll(/url\(\s*(['"]?)(?!data:|#)([^'")]+)\1\s*\)|@import\s+(?:url\()?\s*['"]?([^'")\s;]+)/gi)].map(m=>(m[2]||m[3]||'').trim()).filter(u=>u&&!u.startsWith('https://fonts.googleapis.com')))];
  $('#expWarn').textContent=outside.length?`Not fully self-contained. These still point outside the file: ${outside.slice(0,6).join(', ')}${outside.length>6?` and ${outside.length-6} more`:''}. Drop the missing files into the editor to bake them in.`:'';
  const needsJs=expOpt.nojs&&((state.logic&&state.logic.nodes.length)||state.els.some(e=>{const a=e.anim&&animSpec(e.anim);return a&&(a.trigger==='click'||a.trigger==='logic')}));
  if(needsJs)$('#expWarn').textContent=($('#expWarn').textContent+' Page logic and click animations only run in the export with the script; turn off “No JavaScript” to keep them.').trim();
  if(state.logic&&state.logic.nodes.some(n=>n.type==='song')){
    const w=expOpt.nojs?' The music player needs the script: turn off “No JavaScript” to keep it.':soundfont?' The exported player plays the song with the built-in synth; SoundFonts stay in PIXIWYG.':'';
    if(w)$('#expWarn').textContent=($('#expWarn').textContent+w).trim()}
  $('#expText').value=html;$('#copyBtn').disabled=false;
  const kb=new Blob([html]).size/1024;$('#expSize').textContent=kb>1024?`${(kb/1024).toFixed(1)} MB`:`${kb.toFixed(0)} KB`;
}
function setExp(k,v){expOpt[k]=v;lsSet('pixiwyg.exp.'+k,v?'1':'0');syncExpUI();if(!$('#exportModal').hidden)refreshExport()}
for(const [id,k] of [['optSite','site'],['optNoJs','nojs'],['optFonts','fonts'],['optPrune','prune'],['optImposed','imposed'],['optBleed','bleed'],['optMarks','marks'],['optPlayerCdn','playerCdn']])$('#'+id).onchange=e=>setExp(k,e.target.checked);
// HACK: the desktop app has no page-facing API. A blob window opened with #pdf=<name> is denied by main.js, which
//   loads the blob in a hidden window, runs printToPDF at the page's own @page size, and asks where to save it.
const DESKTOP=location.protocol==='app:';
if(DESKTOP){$('#printBtn').textContent='Save PDF…';$('#printBtn').title='Save the print export as a PDF, at the page size, with bleed and marks as set above'}
$('#printBtn').onclick=async()=>{const o=expOpt.nojs;expOpt.nojs=true;let t;try{t=await buildExport()}finally{expOpt.nojs=o}if(!t)return;const u=URL.createObjectURL(new Blob([t],{type:'text/html'}));
  window.open(DESKTOP?u+'#pdf='+encodeURIComponent(slug(state.project?state.project.name:'pixiwyg')):u,'_blank');setTimeout(()=>URL.revokeObjectURL(u),60000);
  status(DESKTOP?'Making the PDF…':'Opened in a new tab. Print from there; set margins to none and scale to 100%.')};
syncExpUI();
function openExport(){$('#exportModal').hidden=false;$('#expText').value='';refreshExport();$('#copyBtn').focus()}
function closeExport(){$('#exportModal').hidden=true;$('#exportBtn').focus()}
$('#exportBtn').onclick=()=>{audio();sfx('blip');if(state.editing)finishEdit();openExport()};
$('#closeExp').onclick=closeExport;
$('#exportModal').addEventListener('click',e=>{if(e.target.id==='exportModal')closeExport()});

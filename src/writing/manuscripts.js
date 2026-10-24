// SECTION: manuscripts
// FORMAT: a manuscript is a Markdown project file; its page components are derived on open, never stored.
// RULE: blocks flow down the column, across pages (splitting paragraphs at a page foot) and around components.
//   Converted blocks leave an HTML-comment marker in the text so the .md stays readable anywhere and can be put back.
const docById=id=>id?state.docs.find(d=>d.id===id)||null:null;
let curDoc=null;
function newDoc(name,text){const d={id:nid('d'),name:cleanDocName(name||`Manuscript ${state.docs.length+1}`),text:text||'',sheet:'',styles:{},width:640,gap:16,from:0};if(state.site)d.pg=state.site.cur;state.docs.push(d);return d}
const cleanDocName=v=>String(v??'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,80)||'Manuscript';
// FORMAT: chunks = blank-line separated blocks; headings alone; fenced code whole; a list stays whole across blank
//   lines between items. Each chunk keeps its source offsets so it can be found, replaced or removed.
function mdChunks(text){
  const out=[],lines=text.split('\n');let pos=0,cur=null,fence=null;
  const push=()=>{if(cur){out.push(cur);cur=null}};
  const listKind=s=>{const m=s.match(/^\s*([-*+]|\d+[.)])\s+/);return m?(/\d/.test(m[1])?'ol':'ul'):null};
  for(const l of lines){
    const start=pos;pos+=l.length+1;
    if(fence){cur.end=start+l.length;cur.src+='\n'+l;if(l.trim().startsWith(fence)){fence=null;push()}continue}
    if(!l.trim()){if(cur)cur.gap=true;continue}
    const fm=l.match(/^\s{0,3}(`{3,}|~{3,})/);
    if(fm){push();cur={start,end:start+l.length,src:l};fence=fm[1];continue}
    if(/^\s{0,3}#{1,6}\s/.test(l)){push();out.push({start,end:start+l.length,src:l});continue}
    if(cur&&cur.gap&&!(listKind(l)&&listKind(cur.src)===listKind(l)))push();
    if(!cur)cur={start,end:start+l.length,src:l};else{cur.src=text.slice(cur.start,start+l.length);cur.end=start+l.length;cur.gap=false}
  }
  push();return out;
}
const mdBlocksOf=c=>{const src=c.src.replace(/\x3C!--[\s\S]*?-->/g,'').trim();return src?parseMarkdown(src):[]};
function docStyle(d,tag){
  const s=d.styles[tag];if(s&&(s.fileId==null||fileById(s.fileId)))return s;
  const f=d.sheet&&fileById(d.sheet);return f?bestStyleIn(f,tag):nextStyleFor(tag);
}
function docFrames(d){
  if(isFixed())return()=>pageRects().filter(r=>r.i>=(d.from||0)).map(contentRect);
  const w=Math.max(160,Math.min(d.width||640,W-32));return()=>[{x:Math.max(16,Math.round((W-w)/2)),y:40,w,h:1e9}];
}
// PERF: per-doc flow cache (WeakMap, so it never rides in undo snapshots): each chunk's source and the flow state at
//   its start. An edit reflows from the first changed chunk and stops where a chunk of the unchanged tail starts in
//   the same state as before; the old tail is kept as laid out. Typing in a long manuscript costs one page, not all.
// INVARIANT: the cache is valid only for the same obstacles, frames, gap, width and styles; anything else is a full flow.
const flowCache=new WeakMap();
// PERF: parsed blocks by chunk source; Markdown parse + cleanHTML was 70% of an incremental reflow. Rebuilt from the
//   live chunks each flow, so it never grows past the text.
let blockMemo=new Map(),blockNext=new Map();
const blocksOf=c=>{let b=blockMemo.get(c.src)||blockNext.get(c.src);if(!b)b=mdBlocksOf(c).map(x=>x.tag==='pre'||x.tag==='img'||x.tag==='hr'?x:{...x,html:cleanHTML(x.html)});blockNext.set(c.src,b);return b};
function flowDoc(d,inc){
  const chunks=mdChunks(d.text),srcs=chunks.map(c=>c.src),frames=docFrames(d),gap=d.gap??16;
  const obs=state.els.filter(e=>e.md!==d.id).map(e=>{const h=hostOf(e.id);if(!h)return null;const b=layoutBox(e,h);return{x:e.x,y:e.y,w:b.w,h:b.h}}).filter(Boolean);
  const key=JSON.stringify([obs,frames(),gap,d.width,d.sheet,d.styles,d.from,W]);
  let old=inc?flowCache.get(d):null;if(old&&old.key!==key)old=null;
  let k=0,tail=0;
  if(old){const n=Math.min(srcs.length,old.srcs.length);while(k<n&&srcs[k]===old.srcs[k])k++;
    while(tail<n-k&&srcs[srcs.length-1-tail]===old.srcs[old.srcs.length-1-tail])tail++;
    const st=k<old.srcs.length?old.starts[k]:old.end;if(!st||st.f>=frames().length)old=null}
  if(!old)k=0;
  const delta=old?old.srcs.length-srcs.length:0,conv=srcs.length-tail;
  const mine=state.els.filter(e=>e.md===d.id&&e.mdB>=k);
  const list=[];
  for(let ci=k;ci<chunks.length;ci++)for(const b of blocksOf(chunks[ci])){
    const st=docStyle(d,b.tag),el={id:nid('e'),tag:b.tag,fileId:st.fileId,selector:st.selector,x:0,y:0,w:d.width,z:0,md:d.id,mdB:ci};
    if(b.tag==='img'){el.content=okImg(b.src)||/^https?:/i.test(b.src)?b.src:IMG_PH;el.attrs={alt:b.alt};el.w=null}
    else if(b.tag==='pre')el.content=escH(b.text);else if(b.tag!=='hr')el.content=b.html;
    list.push(el);
  }
  if(!k||blockMemo.size>chunks.length*2+256)blockMemo=blockNext;else for(const [x,v] of blockNext)blockMemo.set(x,v);blockNext=new Map();
  const starts=old?old.starts.slice(0,k):[],overBy=old?old.overBy.slice(0,k):[];let lastCi=k-1;
  const fill=(ci,st)=>{for(let j=lastCi+1;j<=ci;j++){starts[j]=st;overBy[j]=overBy[j]||0}lastCi=ci};
  let stopCi=-1;
  const res=list.length?flowText(list,frames,gap,obs,{start:old?(k<old.srcs.length?old.starts[k]:old.end):null,overBy,
    onChunk:(ci,st)=>{if(old&&ci>=conv){const os=old.starts[ci+delta];if(os&&os.f===st.f&&os.y===st.y&&os.fresh===st.fresh){stopCi=ci;return true}}fill(ci,st);return false}}):{over:0,end:old?old.end:null};
  const gone=stopCi<0?mine:mine.filter(e=>e.mdB<stopCi+delta);
  for(const e of gone)dropHost(e.id);
  const drop=new Set(gone);state.els=state.els.filter(e=>!drop.has(e));
  const placed=stopCi<0?list:list.filter(e=>e.mdB<stopCi);
  const rests=new Set(state.els.filter(e=>e.md===d.id&&e.mdB>=k&&!mine.includes(e)));
  for(const e of placed)if(!rests.has(e))state.els.push(e);
  let end=res.end;
  if(stopCi>=0){for(const e of mine)if(e.mdB>=stopCi+delta)e.mdB-=delta;
    for(let j=stopCi;j<srcs.length;j++){starts[j]=old.starts[j+delta];overBy[j]=old.overBy[j+delta]||0}end=old.end}
  else fill(srcs.length-1,end);
  starts.length=srcs.length;overBy.length=srcs.length;
  flowCache.set(d,{key:JSON.stringify([obs,frames(),gap,d.width,d.sheet,d.styles,d.from,W]),srcs,starts,overBy,end});
  for(const el of placed)renderEl(el);
  for(const e of state.els)if(e.md===d.id&&e.mdB>=k&&!hostOf(e.id))renderEl(e);
  updateSel();return overBy.reduce((a,b)=>a+(b||0),0);
}
// INVARIANT: flows from `from` on; each manuscript flows around the ones before it.
function flowDocs(from,{inc}={}){
  // RULE: only the current page's manuscripts flow; the rest flow when their page opens.
  const i=from?state.docs.indexOf(from):0;let over=0;for(const d of state.docs.slice(Math.max(0,i)))if(docOnPage(d))over+=flowDoc(d,inc);
  // HACK: web fonts load on first show and change every measurement; reflow once document.fonts settles.
  if(document.fonts&&document.fonts.status==='loading'&&!flowDocs.waiting){flowDocs.waiting=true;const pid=state.project&&state.project.id;
    document.fonts.ready.then(()=>{flowDocs.waiting=false;if(state.project&&state.project.id===pid&&state.docs.length){flowDocs();if(typeof docStats==='function')docStats()}})}
  return over;
}
// RULE: beside an obstacle text takes the widest free stretch; a paragraph running past it splits and continues
//   full width below, so lines wrap around. Unsplittable blocks sit beside if they fit, else below.
function flowText(list,getFrames,gap,obs,{start,onChunk,overBy}={}){
  // RULE: no grid snapping in flowed text; it keeps to the margins exactly.
  let frames=getFrames(),f=0;if(!frames.length)return{over:list.length,end:null};
  let y=frames[0].y,fresh=true,over=0;if(start)({f,y,fresh}=start);
  const bump=i=>{over++;if(overBy){const c=list[i].mdB;overBy[c]=(overBy[c]||0)+1}};
  const next=()=>{if(f+1>=frames.length){if(!growCanvas())return false;frames=getFrames()}f++;y=frames[f].y;fresh=true;return true};
  const inFrame=(o,fr)=>o.x<fr.x+fr.w&&o.x+o.w>fr.x&&o.y<fr.y+fr.h&&o.y+o.h>fr.y;
  // INVARIANT: returns the widest free stretch at height t, the band end where that changes, and the hard floor below.
  function space(fr,t){
    const act=obs.filter(o=>inFrame(o,fr)&&o.y-gap<=t&&t<o.y+o.h+gap);
    let free=[[fr.x,fr.x+fr.w]];
    for(const o of act){const a=o.x-gap,b=o.x+o.w+gap;free=free.flatMap(([l,r])=>b<=l||a>=r?[[l,r]]:[[l,Math.min(r,a)],[Math.max(l,b),r]].filter(([p,q])=>q-p>0))}
    const [l,r]=free.sort((p,q)=>(q[1]-q[0])-(p[1]-p[0]))[0]||[fr.x,fr.x];
    const band=act.length?Math.min(...act.map(o=>o.y+o.h+gap)):Infinity;
    const hard=Math.min(fr.y+fr.h,...obs.filter(o=>inFrame(o,fr)&&o.y-gap>t&&o.x-gap<r&&o.x+o.w+gap>l).map(o=>o.y-gap));
    return{x:l,w:r-l,band,hard,act:act.length>0};
  }
  const minW=fr=>Math.min(fr.w,Math.max(140,fr.w*.3));
  for(let i=0;i<list.length;i++){
    const el=list[i],head=/^h[1-6]$/.test(el.tag);
    if(onChunk&&(i===0||el.mdB!==list[i-1].mdB)&&onChunk(el.mdB,{f,y,fresh})){list.length=i;break}
    for(let guard=0;guard<400;guard++){
      const fr=frames[f];if(y>=fr.y+fr.h){if(!next()){bump(i);break}continue}
      const top=head&&!fresh?y+Math.round(gap*.75):y,sp=space(fr,top);
      // RULE: too narrow to read beside an obstacle: go below it.
      if(sp.w<minW(fr)){y=Math.min(sp.band,fr.y+fr.h);continue}
      sizeFor(el,sp.w);el.x=Math.round(sp.x);el.y=Math.round(top);
      const h=measure(el).h,after=head?Math.round(gap/2):gap,need=head?h+gap+64:h;
      const lim=Math.min(sp.hard,sp.band);
      if(el.y+need<=lim){y=el.y+h+after;fresh=false;break}
      const rest=splitToFit(el,lim-el.y);
      if(rest){list.splice(i+1,0,rest);y=Math.max(el.y+measure(el).h+after,Math.min(lim,fr.y+fr.h));fresh=false;
        if(y>=fr.y+fr.h&&!next())bump(i);break}
      // RULE: an unsplittable block may pass the band end as long as it meets nothing below.
      if(el.y+need<=sp.hard){y=el.y+h+after;fresh=false;break}
      if(sp.act&&sp.band<sp.hard){y=sp.band;continue}
      if(sp.hard<fr.y+fr.h){y=sp.hard+gap;continue}
      if(fresh&&!sp.act){y=el.y+h+after;fresh=false;break}   // RULE: a block taller than a page stays and runs over rather than looping.
      if(!next()){y=el.y+h+after;bump(i);break}
    }
  }
  return{over,end:{f,y,fresh}};
}
// SECTION: convert / put back
const markerRe=key=>new RegExp(`\x3C!--\\s*pixiwyg:${key}\\b[^>]*-->`);
function convertBlock(d,ci,{quiet}={}){
  const ch=mdChunks(d.text)[ci];if(!ch)return[];
  const parts=state.els.filter(e=>e.md===d.id&&e.mdB===ci);if(!parts.length)return[];
  // INVARIANT: a paragraph split across pages rejoins into one component.
  const groups=new Map();for(const p of parts){const k=p.flow||p.id;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(p)}
  const made=[],key=nid('k').slice(-9).replace(/\W/g,''),label=toText(parts[0].content||parts[0].tag).replace(/\s+/g,' ').replace(/[<>\-]/g,'').trim().slice(0,48);
  for(const g of groups.values()){
    g.sort((a,b)=>(a.flowN||0)-(b.flowN||0));const first=g[0];
    if(g.length>1){first.content=g.map(e=>e.content).join(' ');for(const e of g.slice(1))dropHost(e.id);state.els=state.els.filter(e=>!g.slice(1).includes(e))}
    delete first.md;delete first.mdB;delete first.flow;delete first.flowN;first.from={doc:d.id,key,src:ch.src};first.z=maxZ()+1;renderEl(first);made.push(first);
  }
  d.text=d.text.slice(0,ch.start)+`\x3C!-- pixiwyg:${key} ${label} -->`+d.text.slice(ch.end);
  return made;
}
function convertOne(el){
  const d=docById(el.md);if(!d)return;pushUndo();const ci=el.mdB,made=convertBlock(d,ci);flowDocs(d);
  if(made[0])select(made[0].id);save();docSync();
  status(`Converted to a component: move it, scale it, animate it. “${d.name}” keeps a marker where it was; Put back returns it.`);sfx('pop');
}
function convertAll(d){
  pushUndo();let n=0;const chunks=mdChunks(d.text);
  for(let ci=chunks.length-1;ci>=0;ci--)n+=convertBlock(d,ci).length;
  flowDocs(d);select(null);save();docSync();
  status(`Converted ${n} block${n===1?'':'s'} of “${d.name}” to components. The manuscript keeps markers; each can be put back.`);sfx('boing');
}
// RULE: put back restores the original Markdown, or Markdown generated from the component if it was edited.
function putBack(el){
  const fr=el.from,d=fr&&docById(fr.doc);if(!d){status('The manuscript this came from isn’t in the project anymore.');return}
  pushUndo();
  const orig=parseMarkdown(fr.src.replace(/\x3C!--[\s\S]*?-->/g,'')).find(b=>b.tag===el.tag),same=orig&&(el.tag==='pre'?escH(orig.text):el.tag==='hr'?undefined:cleanHTML(orig.html))===el.content;
  const src=same?fr.src:htmlToMd(el),re=markerRe(fr.key);
  d.text=re.test(d.text)?d.text.replace(re,()=>src):d.text.replace(/\s*$/,'')+'\n\n'+src+'\n';
  dropHost(el.id);state.els=state.els.filter(e=>e!==el);state.sel=null;
  flowDocs(d);save();renderInspector();docSync();status(`Back in “${d.name}”.`);sfx('whoosh');
}
function htmlToMd(el){
  const tpl=document.createElement('template');tpl.innerHTML=el.content||'';
  const inl=n=>[...n.childNodes].map(c=>{if(c.nodeType===3)return c.textContent.replace(/([*_`\\])/g,'\\$1');if(c.nodeType!==1)return'';const t=c.tagName.toLowerCase(),s=inl(c);
    return t==='strong'||t==='b'?`**${s}**`:t==='em'||t==='i'?`*${s}*`:t==='code'?'`'+c.textContent+'`':t==='del'||t==='s'||t==='strike'?`~~${s}~~`:t==='a'?`[${s}](${c.getAttribute('href')||''})`:t==='br'?'  \n':t==='img'?`![${c.getAttribute('alt')||''}](${c.getAttribute('src')||''})`:s}).join('').replace(/\s*\n\s*/g,m=>m.includes('  \n')?m:' ').trim();
  const t=el.tag,body=inl(tpl.content);
  if(/^h[1-6]$/.test(t))return'#'.repeat(+t[1])+' '+body;
  if(t==='blockquote')return body.split('\n').map(l=>'> '+l).join('\n');
  if(t==='ul'||t==='ol')return[...tpl.content.querySelectorAll('li')].map((li,i)=>(t==='ol'?`${i+1}. `:'- ')+inl(li)).join('\n');
  if(t==='pre')return'```\n'+tpl.content.textContent+'\n```';
  if(t==='hr')return'---';
  if(t==='img')return`![${(el.attrs&&el.attrs.alt)||''}](${el.content})`;
  if(t==='table'||t==='div')return el.content;
  return body;
}

// SECTION: project tree and contexts
// RULE: the tree is always in view: page, elements, their parts, then other files; every row opens the context that
//   edits it. Double-click on an already-selected element offers its contexts.
const treeOpen=new Set(['page']);
let treeRAF=0;
// PERF: a drag saves every frame; the tree rebuilds once on endDrag's save, not 60 times a second.
const treeLater=()=>{if(drag&&drag.moved)return;cancelAnimationFrame(treeRAF);treeRAF=requestAnimationFrame(renderTree)};
// RULE: a label is what a person would call it: its words, its alt text, else its style, else what kind of thing it is.
const elLabel=el=>{let t=el.tag==='img'?(el.attrs&&el.attrs.alt)||'':toText(el.content??(TAGS[el.tag]||{}).content??'').replace(/\s+/g,' ').trim();
  if(!t){const x=String(el.extra||'').trim().split(/\s+/)[0],bg=el.colors&&el.colors.bg&&!el.colors.bg.none?colorOf(el.colors.bg):'';
    t=el.selector&&fileById(el.fileId)?showSel(el.selector):x?'.'+x:el.tag==='img'?'picture':el.tag==='hr'?'rule':bg?'box '+bg:'empty box'}
  if(el.sym){const y=symById(el.sym);if(y&&!t.includes(y.name))t=y.name+' · '+t}
  return t.length>34?t.slice(0,34)+'…':t};
const leaveContexts=()=>{if(!$('#nodeModal').hidden)closeNodeEditor();hideCtxMenu()};
function elParts(el,cls=styleClasses()){
  const out=[],f=fileById(el.fileId),add=(icon,name,note,open)=>out.push({icon,name,note,open});
  add('◆',f?showSel(el.selector):'no stylesheet',f?f.name:'style',()=>enterIso(el.id,'style'));
  const have=(el.extra||'').split(/\s+/);
  for(const sg of state.styleGraphs){const c=cls.get(sg.id);if(have.includes(c))add('◇',styleName(sg.g),'effect',()=>openStyleEditor(sg.id))}
  if(el.colors)add('◐','colors',Object.keys(el.colors).join(', '),()=>enterIso(el.id));
  if(el.anim){const sp=animSpec(el.anim);add('◷','animation',sp?TRIGGER_NAMES[sp.trigger]||sp.trigger:'',()=>openAnimEditor(el))}
  const L=state.logic,n=L?L.nodes.filter(x=>x.f&&x.f.el===el.id).length:0;if(n)add('⚙','logic',`${n} node${n===1?'':'s'}`,()=>openLogicEditor(el.id));
  const sg=songOfEl(el.id),s=sg===undefined?null:sg?songById(sg):state.songs[0];if(s)add('♪',s.name,'plays',()=>{setWorkspace('music');openSong(s.id)});
  if(el.from&&docById(el.from.doc))add('✒',docById(el.from.doc).name,'converted from',()=>{openDoc(el.from.doc);showText()});
  return out;
}
// PERF: rows are described first, then matched to the rows already shown by identity; only rows whose look
//   changed are rebuilt, and handlers are re-bound in place. A select used to rebuild all of them (about 3ms per
//   100 elements, on every save), and reflow the panel with it.
const treeRows=new Map();let treeAutoOpened=null;
function treeRowNode(o){
  const r=mkEl('div',{className:'trow2'});r.style.paddingLeft=(6+o.depth*14)+'px';r.setAttribute('role','treeitem');
  if(o.key){r.setAttribute('aria-expanded',treeOpen.has(o.key));r.append(mkEl('button',{type:'button',className:'tcaret',textContent:treeOpen.has(o.key)?'▾':'▸',title:treeOpen.has(o.key)?'Fold':'Unfold'}))}
  else r.append(mkEl('span',{className:'tcaret'}));
  const b=mkEl('button',{type:'button',className:'tlabel',title:o.title||o.name});b.append(mkEl('i',{textContent:o.icon||''}),mkEl('b',{textContent:o.name}));
  // RULE: counts are metadata worth seeing: a badge, ink on a pill, not faint small print.
  if(o.note)b.append(mkEl('small',{textContent:o.note,className:/^\d+(\s\w+)?$/.test(o.note)?'badge':''}));
  if(o.id)r.dataset.id=o.id;r.append(b);return r;
}
function treeApply(box,list){
  const keep=new Map();let cur=box.firstChild;
  for(const o of list){
    const id=o.depth+'|'+(o.id||o.key||'')+'|'+o.icon+'|'+o.name+'|'+(o.path||''),look=JSON.stringify([o.note,o.title,o.key&&treeOpen.has(o.key)]);
    let r=treeRows.get(id);if(r&&(r._look!==look||keep.has(id)))r=null;
    if(!r){r=treeRowNode(o);r._look=look}
    keep.set(id,r);r.className='trow2'+(o.on?' on':'')+(o.dim?' dim':'');r.setAttribute('aria-selected',!!o.on);r.setAttribute('aria-level',o.depth+1);if(o.key)r.setAttribute('aria-expanded',treeOpen.has(o.key));
    const c=r.firstChild,b=r.lastChild;
    if(o.key)c.onclick=e=>{e.stopPropagation();treeOpen.has(o.key)?treeOpen.delete(o.key):treeOpen.add(o.key);renderTree()};
    b.onclick=()=>{audio();o.open&&o.open()};b.ondblclick=o.dbl?e=>{e.preventDefault();o.dbl(b)}:null;
    if(r===cur)cur=cur.nextSibling;else box.insertBefore(r,cur);
  }
  while(cur){const n=cur.nextSibling;cur.remove();cur=n}
  treeRows.clear();for(const [k,r] of keep)treeRows.set(k,r);
  // RULE: the tree is one tab stop (the selected row, else the first); arrows move inside it.
  const labels=[...box.querySelectorAll('.trow2>.tlabel')],stop=labels.find(l=>l.parentElement.classList.contains('on'))||labels[0];
  for(const l of labels)l.tabIndex=l===stop?0:-1;for(const c of box.querySelectorAll('.tcaret'))c.tabIndex=-1;
}
// RULE: tree keys as in any file tree: Up/Down move, Right opens or steps in, Left closes or steps out, Home/End.
$('#treeBody').addEventListener('keydown',e=>{
  const box=$('#treeBody'),labels=()=>[...box.querySelectorAll('.trow2>.tlabel')],L=labels(),i=L.indexOf(document.activeElement);if(i<0)return;
  const row=L[i].parentElement,lvl=+row.getAttribute('aria-level')||1,exp=row.getAttribute('aria-expanded'),go=j=>{const x=labels()[Math.max(0,Math.min(labels().length-1,j))];if(x){for(const l of labels())l.tabIndex=-1;x.tabIndex=0;x.focus()}};
  let used=true;
  if(e.key==='ArrowDown')go(i+1);else if(e.key==='ArrowUp')go(i-1);else if(e.key==='Home')go(0);else if(e.key==='End')go(L.length-1);
  else if(e.key==='ArrowRight'){if(exp==='false'){row.querySelector('.tcaret').click();go(i)}else if(exp==='true')go(i+1);else used=false}
  else if(e.key==='ArrowLeft'){if(exp==='true'){row.querySelector('.tcaret').click();go(i)}else{let j=i-1;while(j>=0&&(+L[j].parentElement.getAttribute('aria-level')||1)>=lvl)j--;if(j>=0)go(j);else used=false}}
  else used=false;
  if(used){e.preventDefault();e.stopPropagation()}
});
function renderTree(){
  const box=$('#treeBody');if(!box)return;if(!state.project){box.replaceChildren();treeRows.clear();return}
  const ws=document.body.dataset.ws,list=[];let path='';
  const row=(depth,o)=>{if(depth===0)path=o.key||o.name;else if(depth===1)path=path.split('/')[0]+'/'+(o.id||o.key||o.name);o.depth=depth;o.path=depth===2?path:path.split('/')[0];list.push(o)};
  // RULE: a site lists its pages in order; the current one opens onto its elements, the others open the page.
  const curRows=(depth,name)=>{
  row(depth,{key:'page',icon:'▦',name,note:ws==='write'?'Write':'page',on:ws==='page'||ws==='write',open:()=>{leaveContexts();if(iso.id)exitIso();setWorkspace(isFixed()&&ws==='write'?'write':'page')}});
  if(treeOpen.has('page')){
    const free=state.els.filter(e=>!e.md),cls=styleClasses();
    for(const el of readingOrder(free)){
      // FIX: the selected row opens once, when it becomes selected; after that it can be folded like any other.
      const k='e:'+el.id,parts=elParts(el,cls),on=state.sel===el.id;if(on&&treeAutoOpened!==el.id){treeOpen.add(k);treeAutoOpened=el.id}
      row(depth+1,{key:parts.length?k:null,id:el.id,icon:el.sym?'◈':el.shared?'◫':el.tag==='img'?'▨':'▢',name:`<${el.tag}>`,note:elLabel(el)||(fileById(el.fileId)?showSel(el.selector):'empty'),on,dim:!!iso.id&&iso.id!==el.id,
        open:()=>{leaveContexts();if(iso.id&&iso.id!==el.id)exitIso();if(!['page','write','animate'].includes(document.body.dataset.ws))setWorkspace('page');select(el.id);hostOf(el.id)?.scrollIntoView({block:'nearest',inline:'nearest'})},
        dbl:b=>chooseContext(el,b.getBoundingClientRect())});
      if(treeOpen.has(k))for(const p of parts)row(depth+2,{icon:p.icon,name:p.name,note:p.note,open:()=>{leaveContexts();p.open()}});
    }
    for(const d of state.docs.filter(docOnPage)){const n=state.els.filter(e=>e.md===d.id).length;row(depth+1,{icon:'✒',name:d.name,note:`${n} blocks`,open:()=>{leaveContexts();setWorkspace(isFixed()?'write':'page');openDoc(d.id);showText()}})}
  }
  };
  if(multiPage())for(const {p,d} of siteTree()){if(p.id===state.site.cur)curRows(d,p.name);else row(d,{icon:'▢',name:p.name,note:p.nav===false?'page · hidden from nav':'page',dim:true,title:`Go to ${p.name} (#${p.slug})`,open:()=>{leaveContexts();goPage(p.id)}})}
  else curRows(0,state.project.name);
  if(state.syms.length){const k='g:Symbols';row(0,{key:k,icon:'◈',name:'Symbols',note:String(state.syms.length),open:()=>{treeOpen.has(k)?treeOpen.delete(k):treeOpen.add(k);renderTree()}});
    if(treeOpen.has(k))for(const x of state.syms){const n=symCopies(x.id).length;row(1,{icon:'◈',name:x.name,note:`${n} cop${n===1?'y':'ies'} · click to place one`,title:`Place a copy of “${x.name}” in the middle of the view`,
      open:()=>{leaveContexts();if(iso.id)exitIso();if(!['page','write','animate'].includes(document.body.dataset.ws))setWorkspace('page');placeSymbol(x.id)}})}}
  const groups=new Map();for(const f of projectFiles()){if(f.group==='Page'||f.group==='Animations'||f.group==='Manuscripts')continue;if(!groups.has(f.group))groups.set(f.group,[]);groups.get(f.group).push(f)}
  for(const [g,items] of groups){const k='g:'+g;row(0,{key:k,icon:items[0].icon,name:g,note:String(items.length),open:()=>{treeOpen.has(k)?treeOpen.delete(k):treeOpen.add(k);renderTree()}});
    if(treeOpen.has(k))for(const it of items)row(1,{icon:it.icon,name:it.name,note:it.note,on:g==='Songs'&&ws==='music'&&state.music&&state.music.name===it.name,open:()=>{leaveContexts();if(iso.id)exitIso();it.open()}})}
  treeApply(box,list);
}

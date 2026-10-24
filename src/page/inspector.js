// SECTION: Inspector (the selected element's properties, and deleting the selection)
function renderInspector(){
  const box=$('#ins'),el=selected();box.replaceChildren();
  $('#insTitle').textContent=el?`Inspector · <${el.tag}>`:'Inspector';
  if(!el){box.innerHTML='<p class="empty">Select an element on the page to edit it here. To add one, drag any style from the Catalog onto the page. Dropping an image file on the page adds an <code>&lt;img&gt;</code>.</p>';return}
  if(el.md){renderMdInspector(box,el);return}
  const def=TAGS[el.tag]||{},f=fileById(el.fileId);
  const form=document.createElement('form');form.className='insform';form.onsubmit=e=>e.preventDefault();
  // RULE: with more than one thing selected, the Inspector edits this one and every change goes to all of them.
  {const all=selEls();if(all.length>1){const g=el.group&&state.drill!==el.group?el.group:null,bar=document.createElement('div');bar.className='grpbar';
    bar.append(mkEl('b',{textContent:g?(state.groupNames[g]||'Group'):`${all.length} selected`}),mkEl('small',{textContent:`${all.length} elements: changes here apply to all (styles to every <${el.tag}>)`}));
    const b=(t,fn,title)=>{const x=mkEl('button',{type:'button',className:'btn',textContent:t,title});x.onclick=()=>{audio();fn()};bar.append(x)};
    if(g){const nm=mkEl('input',{type:'text',value:state.groupNames[g]||'Group'});nm.setAttribute('aria-label','Group name');nm.onchange=()=>{pushUndo();state.groupNames[g]=nm.value.trim().slice(0,60)||'Group';updateSel();save()};bar.append(nm);b('Ungroup',ungroupSel,'Ctrl/⌘+Shift+G')}
    else b('Group',groupSel,'Ctrl/⌘+G');
    b('Save as primitive',()=>{if(groupPrim())showWin('w-prims')},'The whole selection as one primitive, placed back as a group');
    box.append(bar)}}
  // RULE: ideas for this element (read off its neighbours) sit at the top, one click each.
  {const ideas=el.md?[]:ideasFor(el);if(ideas.length){const bar=document.createElement('div');bar.className='ideabar';bar.append(mkEl('b',{textContent:'Ideas'}));
    for(const it of ideas){const x=mkEl('button',{type:'button',className:'btn',textContent:it.title,title:it.why});x.onclick=()=>{audio();applyIdea(it)};bar.append(x)}box.append(bar)}}
  let armed=true;form.addEventListener('focusin',()=>{armed=true});
  const commit=fn=>{if(armed){pushUndo();armed=false}fn();renderEl(el);updateSel();save()};
  const h4=t=>{const x=document.createElement('h4');x.textContent=t;form.append(x)};
  let uid=0;
  const fld=(label,input,note,parent=form)=>{input.id='if-'+(uid++);const w=document.createElement('div');w.className='ff';const l=document.createElement('label');l.htmlFor=input.id;l.textContent=label;w.append(l,input);if(note){const s=document.createElement('small');s.textContent=note;w.append(s)}parent.append(w);return input};
  const mk=(tag,props)=>Object.assign(document.createElement(tag),props||{});
  const opt=(v,t,parent)=>parent.append(mk('option',{value:v,textContent:t}));
  if(iso.id===el.id){const top=mk('div',{className:'row isorow'});top.append(mk('b',{textContent:'Just this component'}));
    const ib=(t,fn,tt)=>{const x=mk('button',{type:'button',className:'btn sqm',textContent:t,title:tt||t});x.onclick=()=>{audio();fn()};top.append(x)};
    if(!def.void&&!def.noedit)ib('Text',()=>startEdit(el),'Edit its text in place');if(STRUCT[el.tag])ib('Content…',()=>openStructWindow(el),'Rows, items, choices');
    ib('Logic',()=>openLogicEditor(el.id));ib('Animation',()=>openAnimEditor(el));ib('Done',()=>exitIso(),'Back to the whole page (Esc)');form.append(top)}
  if(el.sym&&symById(el.sym))form.append(symRow(el,mk));

  h4('Look');
  // PERF: the full list is every selector in every sheet (13k options with Bulma + RPGUI loaded), and building it on
  //   each select cost ~50ms of DOM + style recalc. It holds only the current style until first focus or press.
  const sel=mk('select'),curV=(f?el.fileId:'')+'|'+(f?el.selector:'');
  const fillStyles=()=>{if(sel._full)return;sel._full=true;sel.replaceChildren();opt('|','no stylesheet',sel);
    for(const g of candidates(el.tag)){const og=mk('optgroup',{label:g.file.name});for(const x of [...g.exact,...g.gen])opt(g.file.id+'|'+x,showSel(x),og);sel.append(og)}
    if(![...sel.options].some(o=>o.value===curV))opt(curV,showSel(el.selector||''),sel);sel.value=curV};
  opt('|','no stylesheet',sel);if(curV!=='|')opt(curV,showSel(el.selector||''),sel);sel.value=curV;
  sel.addEventListener('focus',fillStyles);sel.addEventListener('pointerdown',fillStyles);
  const sw=mk('div',{className:'ff'});const sl=mk('label',{textContent:`Style · ${f?f.name:'none'}`});sel.id='if-style';sl.htmlFor='if-style';
  const srow=mk('div',{className:'stylerow'});
  const prev=mk('button',{type:'button',className:'btn',textContent:'‹',title:'Previous style (,)'});prev.onclick=()=>cycleStyle(-1);
  const next=mk('button',{type:'button',className:'btn',textContent:'›',title:'Next style (.)'});next.onclick=()=>cycleStyle(1);
  srow.append(prev,sel,next);sw.append(sl,srow);form.append(sw);
  // RULE: an imported rule opens as nodes from where it's chosen; it layers over the sheet, which stays as written.
  if(f&&!f.gen&&el.selector){const on=mk('button',{type:'button',className:'btn sqm',textContent:'◇ Open as nodes',title:'Edit this rule as a node graph, layered over the stylesheet (the sheet itself is not changed)'});on.onclick=()=>{audio();openRuleAsNodes(el)};const r=mk('div',{className:'row'});r.append(on);form.append(r)}
  sel.onchange=()=>{const v=sel.value,i=v.indexOf('|');state.activeTag=el.tag;chooseStyle(v.slice(0,i)||null,v.slice(i+1)||null)};
  const ex=fld('Extra classes',mk('input',{type:'text',value:el.extra||'',placeholder:'e.g. is-primary is-rounded'}),'Added on top of the style, for framework modifiers.');
  ex.oninput=()=>commit(()=>{el.extra=ex.value.trim()});

  h4('Colors');
  const pm=mk('select');
  opt('auto',`Page default (${palOpt.recolor?'follows':'ignores'} the scheme)`,pm);opt('on','Follow the color scheme',pm);opt('off',"Keep the stylesheet's colors",pm);
  pm.value=palMode(el);
  fld('Color scheme',pm,state.palette?`Recolors this element's stylesheet with ${state.palette.name}.`:'No scheme is on, so this has no effect yet.');
  pm.onchange=()=>commit(()=>{delete el.nopal;if(pm.value==='auto')delete el.pal;else el.pal=pm.value});
  if(!state.palette){const r=mk('div',{className:'row'}),b=mk('button',{type:'button',className:'btn',textContent:'Choose a scheme…'});b.onclick=()=>{audio();showWin('w-palette')};r.append(b);form.append(r)}
  // RULE: an override starts from the currently shown color, so switching to Custom is not a jump to black.
  const cur=getComputedStyle(hostOf(el.id)?._target||document.body),hex=v=>{const c=parseColor(v);return c&&c[3]>0?'#'+c.slice(0,3).map(n=>Math.round(n).toString(16).padStart(2,'0')).join(''):'#ffffff'};
  const seed={fg:cur.color,bg:cur.backgroundColor,line:cur.borderTopColor},cs={};
  const grid=mk('div',{className:'colgrid'});
  for(const [k,,label] of EL_COLORS){
    cs[k]=el.colors&&el.colors[k]?{...el.colors[k]}:{inherit:true,c:hex(seed[k]),role:null};
    const l=mk('span',{textContent:label});
    grid.append(l,colorCtl(cs,k,()=>commit(()=>{const o={};for(const [kk] of EL_COLORS)if(!cs[kk].inherit)o[kk]={...cs[kk]};if(Object.keys(o).length)el.colors=o;else delete el.colors}),k!=='fg','From style'));
  }
  form.append(grid);
  const cn=mk('small',{className:'credit',textContent:'From style keeps what the stylesheet says. A palette role, like Red or Foreground, follows the color scheme.'});form.append(cn);
  if(el.colors){const r=mk('div',{className:'row'}),b=mk('button',{type:'button',className:'btn',textContent:'Reset colors'});b.onclick=()=>{audio();commit(()=>{delete el.colors});renderInspector()};r.append(b);form.append(r)}

  const C=STRUCT[el.tag],attrs=ATTRS[el.tag]||[],cssSlots=cssAttrSlots(el);
  const ownSlots=cssSlots.filter(c=>!c.path.length&&!attrs.some(([k])=>k===c.attr));
  if(C||!def.void||attrs.length||ownSlots.length||el.tag==='img')h4('Content');
  for(const c of ownSlots){
    const inp=mk('input',{type:'text',value:(el.attrs&&el.attrs[c.attr])??(def.attrs&&def.attrs[c.attr])??''});inp.dataset.cat=1;
    fld(c.attr,inp,`Shown by ${c.via}`);
    inp.oninput=()=>commit(()=>{el.attrs={...(el.attrs||{}),[c.attr]:inp.value}});
  }
  if(C){
    const head=mk('div',{className:'sedhead'});head.append(mk('label',{textContent:C.label}),(()=>{const b=mk('button',{type:'button',className:'btn',textContent:'Open larger',title:'Edit in a bigger window'});b.onclick=()=>{audio();openStructWindow(el)};return b})());
    form.append(head,structEditor(el,html=>commit(()=>{el.content=html;ht.value=html})));
    const det=mk('details');det.append(mk('summary',{textContent:'Edit the HTML'}));
    const ht=fld('HTML',mk('textarea',{rows:6,value:el.content??def.content??''}),null,det);ht.dataset.cat=1;form.append(det);
    ht.oninput=()=>commit(()=>{el.content=ht.value});ht.onchange=()=>renderInspector();
  }
  else if(!def.void&&el.tag!=='textarea'){
    const cur=el.content??def.content??'';
    let txt=null;
    if(plainHTML(cur)){const code=el.tag==='pre'||el.tag==='code';txt=fld(code?'Code':'Text',mk('textarea',{rows:Math.min(code?16:8,Math.max(2,toText(cur).split('\n').length+1)),value:toText(cur),className:code?'mono':'',spellcheck:!code}));txt.dataset.cat=1}
    let ts=null;
    if(!plainHTML(cur)){
      ts=textSlots(cur);
      for(const c of cssSlots.filter(c=>c.path.length)){let x=ts.root;for(const k of c.path)x=x&&x.childNodes[k];if(!x||x.nodeType!==1)continue;
        const had=ts.slots.find(sl=>sl.node===x&&sl.attr===c.attr);if(had){had.via=c.via;continue}
        ts.slots.push({node:x,attr:c.attr,label:`${partName(x,ts.root)} · ${c.attr}`,value:x.getAttribute(c.attr)||'',set:v=>v?x.setAttribute(c.attr,v):x.removeAttribute(c.attr),via:c.via})}
      numberSame(ts.slots);
      const shown=ts.slots.slice(0,40);
      for(const sl of shown){
        const long=sl.value.length>48||sl.value.includes('\n'),inp=long?mk('textarea',{rows:Math.min(5,Math.ceil(sl.value.length/40)+1),value:sl.value}):mk('input',{type:'text',value:sl.value});
        inp.dataset.cat=1;fld(sl.label,inp,sl.via?`Shown by ${sl.via}`:null);
        inp.oninput=()=>commit(()=>{sl.set(inp.value);el.content=ts.tpl.innerHTML;ht.value=el.content});
      }
      if(ts.slots.length>shown.length)form.append(mk('small',{className:'credit',textContent:`${ts.slots.length-shown.length} more in the HTML below.`}));
    }
    const det=mk('details');det.open=!plainHTML(cur)&&!(ts&&ts.slots.length);det.append(mk('summary',{textContent:plainHTML(cur)?'Edit as HTML':ts&&ts.slots.length?'Edit the HTML':'HTML (this element holds markup)'}));
    const ht=fld('HTML',mk('textarea',{rows:6,value:cur}),'Framework markup works here, like a 98.css title bar.',det);ht.dataset.cat=1;form.append(det);
    if(txt)txt.oninput=()=>commit(()=>{el.content=el.tag==='pre'?escH(txt.value):escH(txt.value).replace(/\n/g,'<br>');ht.value=el.content});
    ht.oninput=()=>commit(()=>{el.content=ht.value;if(txt&&plainHTML(ht.value))txt.value=toText(ht.value)});
    if(ts)ht.onchange=()=>renderInspector();
  }
  for(const [k,label,kind] of attrs){
    let inp;if(kind.startsWith('select:')){inp=mk('select');for(const o of kind.slice(7).split(/[ |]/))opt(o,o||'normal',inp)}else inp=mk('input',{type:kind});
    const v=el.attrs&&el.attrs[k]!=null?el.attrs[k]:(def.attrs&&def.attrs[k])||'';
    inp.value=v||(k==='type'&&el.tag==='input'?'text':'');inp.dataset.cat=1;fld(label,inp);
    inp.addEventListener('input',()=>commit(()=>{el.attrs={...(el.attrs||{}),[k]:inp.value}}));
  }
  if(el.tag==='img'){const r=mk('div',{className:'row'});const lab=mk('label',{className:'btn',textContent:'Choose image…'});lab.htmlFor='imgIn';r.append(lab);form.append(r)}

  h4('Effects');
  {const box2=mk('div',{className:'fxlist'}),cls=styleClasses(),have=new Set((el.extra||'').split(/\s+/));
    for(const sg of state.styleGraphs){const c=cls.get(sg.id),lab=mk('label'),cb=mk('input',{type:'checkbox',checked:have.has(c)}),ed=mk('button',{type:'button',className:'btn sqm',textContent:'Edit'});
      cb.onchange=()=>toggleStyleOn(el,c,cb.checked);ed.onclick=e=>{e.preventDefault();audio();openStyleEditor(sg.id)};lab.append(cb,mk('b',{textContent:styleName(sg.g)}),ed);box2.append(lab)}
    const r2=mk('div',{className:'row'}),nb=mk('button',{type:'button',className:'btn',textContent:state.styleGraphs.length?'New style…':'Make a style for this…',title:'A style made of nodes, on this element'});
    nb.onclick=()=>{audio();pushUndo();const sg=newStyleGraph(`${el.tag} style`);syncNodeSheet(true);toggleStyleOn(el,styleClasses().get(sg.id),true);openStyleEditor(sg.id)};
    r2.append(nb);
    // RULE: text effects live where styling does, not only in the double-click menu.
    if(!(TAGS[el.tag]||{}).void&&!el.md){const tb=mk('button',{type:'button',className:'btn',textContent:'✧ Text effects…',title:'Style words and letters inside it'});tb.onclick=()=>{audio();openTextFx(el)};r2.append(tb)}
    form.append(box2,r2)}
  h4('Layout');
  if(!el.sym){const mb=mk('button',{type:'button',className:'btn sqm',textContent:'◈ Make a symbol',title:'Turn this into a symbol: copies of it change together'});mb.onclick=()=>{audio();makeSymbol(el)};const r=mk('div',{className:'row'});r.append(mb);form.append(r)}
  if(typeof sitePlaceRow==='function')sitePlaceRow(el,form,mk);
  // RULE: on fixed pages, position is relative to the page's top-left, in mm (px on screens).
  if(isFixed()){const ps=mk('select');for(const r of pageRects())opt(String(r.i),pageLabel(r.i),ps);ps.value=posShow(el,'page');ps.dataset.pos='page';
    fld('Page',ps);ps.onchange=()=>commit(()=>posSet(el,'page',ps.value))}
  const pos=mk('div',{className:'frow3'}),un=isFixed()&&state.canvas.type!=='screen'?' (mm)':'';
  for(const [k,lab] of [['x','X'],['y','Y']]){
    const inp=fld(lab+un,mk('input',{type:'number',value:posShow(el,k),step:un?.5:1}),null,pos);inp.dataset.pos=k;
    inp.oninput=()=>commit(()=>posSet(el,k,inp.value.trim()));
  }
  {const w=mk('div',{className:'ff'}),l=mk('label',{className:'tog sizelock',title:'Change width and height together'}),cb=mk('input',{type:'checkbox',id:'insLock',checked:lsGet('pixiwyg.sizelock','1')==='1'});
    cb.onchange=()=>lsSet('pixiwyg.sizelock',cb.checked?'1':'0');l.append(cb,document.createTextNode(' Keep shape'));w.append(mk('label',{textContent:'\u00a0'}),l);pos.append(w)}
  form.append(pos);
  const size=mk('div',{className:'frow3'});
  for(const [k,lab] of [['w','W'],['h','H']]){
    const inp=fld(lab+un,mk('input',{type:'number',value:posShow(el,k),min:1,step:un?.5:1,title:'The size it shows at. A new one scales it, like the handles.'}),null,size);inp.dataset.pos=k;
    inp.addEventListener('change',()=>{commit(()=>posSet(el,k,inp.value.trim(),$('#insLock')?.checked));renderInspector()});
  }
  {const inp=fld('Wrap at'+un,mk('input',{type:'number',value:posShow(el,'wrap'),placeholder:'auto',step:un?.5:1,title:'The width its text wraps at, before any scaling. Empty: as wide as it needs.'}),null,size);inp.dataset.pos='wrap';
    inp.oninput=()=>commit(()=>posSet(el,'wrap',inp.value.trim()))}
  form.append(size);
  const sc=mk('div',{className:'frow3'});
  for(const [k,lab] of [['sx','Scale W %'],['sy','Scale H %']]){
    const inp=fld(lab,mk('input',{type:'number',value:Math.round((el[k]||1)*1000)/10,min:1,step:1}),null,sc);inp.dataset.scale=k;
    inp.oninput=()=>{const v=+inp.value;if(!(v>0))return;commit(()=>{el[k]=Math.round(Math.min(2000,Math.max(1,v))*100)/1e4;if(!isScaled(el)){delete el.sx;delete el.sy}})};
  }
  {const w=mk('div',{className:'ff'}),b=mk('button',{type:'button',className:'btn',textContent:'100%',title:'Back to natural size (or double-click a handle)'});w.append(mk('label',{textContent:'\u00a0'}),b);
    b.onclick=()=>{audio();commit(()=>{delete el.sx;delete el.sy});renderInspector()};sc.append(w)}
  form.append(sc);
  const row=mk('div',{className:'row'});
  const act=(t,fn,title,id)=>{const b=mk('button',{type:'button',className:'btn',textContent:t});if(title)b.title=title;if(id)b.id=id;b.onclick=()=>{audio();fn()};row.append(b)};
  if(!def.void&&!def.noedit&&!C)act('Edit on page',()=>startEdit(el),'Enter');
  if(el.tag==='img')act('Edit in Paint',()=>{const w=el.w;studioOpenImage(el.content||IMG_PH,{kind:'el',id:el.id},w)});
  act(el.anim?'Edit animation…':'Animate…',()=>openAnimEditor(el),'Animate this element between two states','insAnim');
  if(el.anim)act('Remove animation',()=>{commit(()=>{delete el.anim});renderInspector()});
  act('Add logic…',()=>openLogicEditor(el.id),'Make this element do something when clicked','insLogic');
  if(el.from&&docById(el.from.doc))act(`Put back into “${docById(el.from.doc).name}”`,()=>putBack(el),'Return it to the manuscript it came from, where its marker is');
  act('Duplicate',dupSel,M+'+J');act('To front',()=>restack(el,'front'));act('To back',()=>restack(el,'back'));
  act('Save as primitive',()=>{addPrim(primFromElement(el));showWin('w-prims')},'Keep this element, its content and its look in the Primitives library','insPrim');
  act('Delete',delSel,'Delete');
  form.append(row);
  box.append(form);
}
function renderMdInspector(box,el){
  const d=docById(el.md),f=fileById(el.fileId),p=mkEl('div',{className:'mdins'});
  p.append(mkEl('h4',{textContent:'Manuscript block'}),
    mkEl('p',{textContent:`Part of “${d?d.name:'?'}”, block ${el.mdB+1}. It flows with the text: write it in the Text panel. Its look is the manuscript’s: choose a style in the Catalog and every <${el.tag}> in it follows.`}),
    mkEl('p',{className:'credit',textContent:`Wearing ${f?showSel(el.selector)+' from '+f.name:'no stylesheet'}.`}));
  const row=mkEl('div',{className:'row'}),b=(t,fn,title,primary)=>{const x=mkEl('button',{type:'button',className:'btn'+(primary?' primary':''),textContent:t,title});x.onclick=()=>{audio();fn()};row.append(x)};
  b('Edit in the text',()=>{openDoc(el.md);showText(el.mdB)},'Jump to this block in the manuscript');
  b('Convert to a component',()=>convertOne(el),'Make it a component of its own: move it, scale it, animate it. The text keeps a marker.',true);
  b('Convert all',()=>$('#docConvertAll').click(),'Every block of this manuscript becomes a component');
  p.append(row);box.append(p);
}
function delSel(){const el=selected();if(!el)return;if(iso.id===el.id)exitIso(true);
  // INVARIANT: deleting a manuscript block on the page deletes it from the manuscript text.
  if(el.md){const d=docById(el.md),c=d&&mdChunks(d.text)[el.mdB];if(!c)return;pushUndo();d.text=(d.text.slice(0,c.start)+d.text.slice(c.end)).replace(/\n{3,}/g,'\n\n');state.sel=null;flowDocs(d);updateSel();renderInspector();save();docSync();status(`Deleted from “${d.name}”. Undo brings it back.`);sfx('whoosh');return}
  pushUndo();state.els=state.els.filter(e=>e!==el);dropHost(el.id);state.sel=null;updateSel();renderInspector();markCards();sfx('whoosh');save()}


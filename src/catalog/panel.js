// SECTION: side panels
function renderFiles(){
  const box=$('#files');box.replaceChildren();
  if(!state.files.length){box.innerHTML='<div class="empty">No stylesheets yet. Add a few CSS files and every rule that can style an element shows up as a preview.</div>';return}
  for(const f of state.files){
    if(f.gen){const row=mkEl('div',{className:'frow'}),l=mkEl('label');l.append(mkEl('div',{className:'fname',textContent:f.name}),mkEl('span',{className:'fmeta',textContent:`Made from ${state.styleGraphs.length} style graph${state.styleGraphs.length===1?'':'s'}. Edit the graphs, not this.`}));
      const b=mkEl('button',{type:'button',className:'btn sqm',textContent:'Styles…'});b.onclick=()=>{audio();openStyleEditor()};row.append(mkEl('span'),l,b);box.append(row);continue}
    const row=document.createElement('div');row.className='frow';
    const cb=document.createElement('input');cb.type='checkbox';cb.checked=f.enabled;cb.id='cb-'+f.id;cb.setAttribute('aria-label','Use '+f.name);
    cb.onchange=()=>{f.enabled=cb.checked;afterFilesChanged()};
    const lab=document.createElement('label');lab.htmlFor=cb.id;lab.style.minWidth='0';
    const nm=document.createElement('div');nm.className='fname';nm.textContent=f.name;nm.title=f.name;
    if(f.sample){const s=document.createElement('span');s.className='tag-sample';s.textContent='sample';nm.append(s)}
    if(f.lib){const s=document.createElement('span');s.className='tag-lib';s.textContent='library';nm.append(s)}
    const meta=document.createElement('span');meta.className='fmeta';
    meta.textContent=f.error?'Could not parse: '+f.error:[`${f.sels.length} selectors`,f.baked?`${f.baked} file${f.baked>1?'s':''} baked in`:'',f.missing&&f.missing.length?`${f.missing.length} missing`:'',f.remote&&f.remote.length?`${f.remote.length} online-only`:'',f.imports?`${f.imports} @import skipped`:''].filter(Boolean).join(' · ');
    const tips=[];if(f.missing&&f.missing.length)tips.push(`Still missing: ${f.missing.join(', ')}. Drop those files anywhere and they'll be baked in.`);if(f.remote&&f.remote.length)tips.push(`Points to the web, which this page can't download: ${f.remote.join(', ')}. Exports will load these online.`);
    if(tips.length){lab.title=tips.join('\n');meta.classList.add('warn')}
    lab.append(nm,meta);
    const x=document.createElement('button');x.className='x';x.textContent='×';x.title='Remove '+f.name;x.setAttribute('aria-label','Remove '+f.name);
    let armed=false;
    x.onclick=()=>{if(!armed){armed=true;x.textContent='Remove?';x.classList.add('armed');setTimeout(()=>{armed=false;x.textContent='×';x.classList.remove('armed')},2500);return}
      state.files=state.files.filter(g=>g!==f);state.els.forEach(e=>{if(e.fileId===f.id){e.fileId=null;e.selector=null}});afterFilesChanged();status(`Removed ${f.name}. Elements that used it are now unstyled.`)};
    row.append(cb,lab,x);box.append(row);
  }
}
function renderLib(){
  const box=$('#lib');box.replaceChildren();$('#libCount').textContent=`${LIBRARY.length} stylesheets, one click each`;
  LIB_GROUPS.forEach((g,gi)=>{box.append(mkEl('h4',{className:'libgroup',textContent:g}));
  for(const l of LIBRARY.filter(x=>x.group===gi)){
    const row=document.createElement('div');row.className='lrow';row.title=l.lic;
    const t=document.createElement('div');t.innerHTML='<b></b><span></span>';t.querySelector('b').textContent=l.name;t.querySelector('span').textContent=`${l.era} · ${l.kb>999?(l.kb/1024).toFixed(1)+' MB':l.kb+' KB'}`;
    const have=state.files.some(f=>f.lib===l.file);
    const b=document.createElement('button');b.className='btn';b.textContent=have?'Added':'Add';b.disabled=have;
    b.onclick=async()=>{audio();b.disabled=true;b.textContent='Loading…';try{await addLib(l.file);afterFilesChanged();status(`Added ${l.name}`);sfx('boing')}catch(e){b.disabled=false;b.textContent='Add';status(`Could not load ${l.name}. Try again.`)}};
    row.append(t,b);box.append(row);
  }});
}
function afterFilesChanged(){refreshFonts();renderFiles();renderLib();renderPalette();renderStyles();renderAll();renderInspector();save()}

let pdrag=null;
function palDown(e,tag,btn,style,onClick){
  if(e.button>0)return;e.preventDefault();audio();btn.setPointerCapture(e.pointerId);
  pdrag={tag,style,sx:e.clientX,sy:e.clientY,started:false};
  const mv=ev=>{if(!pdrag)return;if(!pdrag.started){if(Math.hypot(ev.clientX-pdrag.sx,ev.clientY-pdrag.sy)<5)return;startGhost(pdrag)}moveGhost(ev)};
  const done=(ev,cancel)=>{btn.removeEventListener('pointermove',mv);btn.removeEventListener('pointerup',up);btn.removeEventListener('pointercancel',cc);
    const d=pdrag;pdrag=null;if(!d)return;
    if(!d.started){if(!cancel&&onClick)onClick();return}
    d.ghost.remove();document.body.classList.remove('dragging');drawGuides([]);
    if(!cancel&&d.over){if(d.style)state.nextStyle[tag]=d.style;placeElement(tag,d.x,d.y,null)}else{sfx('whoosh')}};
  const up=ev=>done(ev,false),cc=ev=>done(ev,true);
  btn.addEventListener('pointermove',mv);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',cc);
}
function startGhost(d){
  d.started=true;hoverOff();
  // RULE: the Fluxbox ghost is a plain dashed outline box with a tag label, built once per drag.
  // FIX: it was sized from TAGS defaults, so right/bottom/centre snapping lined up a box the dropped element didn't
  //   match. The element that will land (this style, or the tag's next style) is measured in the isolated host first.
  const g=document.createElement('div');g.className='dragghost outline';
  const st=d.style||nextStyleFor(d.tag),f=st.fileId?fileById(st.fileId):null;
  const m=measure({id:'ghost',tag:d.tag,fileId:f?st.fileId:null,selector:f?st.selector:null,x:0,y:0,w:TAGS[d.tag].w||null});
  const natW=Math.max(8,m.w),natH=Math.max(8,m.h);
  g.style.width=natW+'px';g.style.height=natH+'px';
  const lbl=document.createElement('span');lbl.textContent='<'+d.tag+'>'+(f&&st.selector&&st.selector!==d.tag?' '+showSel(st.selector):'');g.append(lbl);
  document.body.append(g);document.body.classList.add('dragging');
  if(Z!==1){g.style.transformOrigin='0 0';g.style.transform=`scale(${Z})`}
  d.ghost=g;d.snap=snapData(null,{w:natW,h:natH});sfx('pop');
}
function moveGhost(ev){
  const d=pdrag,r=stage.getBoundingClientRect(),t=document.elementFromPoint(ev.clientX,ev.clientY);
  d.over=!!t&&stage.contains(t);
  let x=(ev.clientX-r.left)/Z-12,y=(ev.clientY-r.top)/Z-12;
  if(d.over){const sn=snapMove(d.snap,x,y,snapping(ev));x=sn.x;y=sn.y}else drawGuides([]);
  d.x=x;d.y=y;d.ghost.style.left=(x*Z+r.left)+'px';d.ghost.style.top=(y*Z+r.top)+'px';d.ghost.classList.toggle('nodrop',!d.over);
}
function dropAtMouse(tag){
  let x,y;if(mouse){x=mouse.x;y=mouse.y}else({x,y}=viewCenter())
  const gs=gridStep();if(gs&&state.snap){x=Math.round(x/gs)*gs;y=Math.round(y/gs)*gs}
  placeElement(tag,x,y,null);
}
function showTag(tag){const s=selected();if(s&&s.tag!==tag){state.sel=null;updateSel();renderInspector()}state.activeTag=tag;$('#search').value='';renderPalette();renderStyles();sfx('blip');sgrid.scrollTop=0}
function renderPalette(){
  const box=$('#palette');box.replaceChildren();
  for(const [i,tag] of Object.keys(TAGS).entries()){
    const n=candidates(tag).reduce((a,g)=>a+g.exact.length,0);
    const b=document.createElement('button');b.className='pal';
    b.setAttribute('aria-pressed',state.activeTag===tag);
    b.title=`Show every <${tag}> style. Drag the tab onto the page to add one${i<9?`, or press ${i+1}`:''}.`;b.innerHTML=`${i<9?`<s>${i+1}</s>`:''}<b>${tag}</b><i>${n}</i>`;
    b.addEventListener('pointerdown',e=>palDown(e,tag,b,null,()=>showTag(tag)));
    b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();dropAtMouse(tag)}});
    box.append(b);
  }
}

const sgrid=$('#sgrid');

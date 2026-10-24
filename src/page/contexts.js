// SECTION: context menu
function chooseContext(el,at){
  hideCtxMenu();const m=$('#ctxMenu');m.replaceChildren();
  const def=TAGS[el.tag]||{},opts=[];
  if(el.md){opts.push(['✒','Edit in the manuscript',()=>{openDoc(el.md);showText(el.mdB)}],['◆','Convert to a component',()=>convertOne(el)])}
  else{
    opts.push(['▢','Component','Just this, on its own: content, style, effects, colors',()=>enterIso(el.id)]);
    opts.push(['⚙','Logic','What it does when clicked or changed',()=>openLogicEditor(el.id)]);
    opts.push(['◷','Animation','Two states and a transition',()=>openAnimEditor(el)]);
    if(!def.void&&!def.noedit)opts.push(['✎','Text','Edit it right here on the page',()=>startEdit(el)]);
    if(!def.void)opts.push(['✧','Text effects','Style words and letters inside it',()=>openTextFx(el)]);
    if(STRUCT[el.tag])opts.push(['▤','Content','Rows, items, choices',()=>openStructWindow(el)]);
    if(el.tag==='img')opts.push(['✎','Paint','Open it in Paint; Update puts it back',()=>studioOpenImage(el.content||IMG_PH,{kind:'el',id:el.id},el.w)]);
    const sg=songOfEl(el.id),s=sg===undefined?null:sg?songById(sg):state.songs[0];if(s)opts.push(['♪',`Open “${s.name}”`,'In the Sequencer',()=>{setWorkspace('music');openSong(s.id)}]);
  }
  m.append(mkEl('h4',{textContent:`<${el.tag}> ${elLabel(el)}`}));
  opts.forEach(([icon,name,note,fn],i)=>{const b=mkEl('button',{type:'button',className:'cmitem'+(i?'':' primary')});b.append(mkEl('i',{textContent:icon}),mkEl('b',{textContent:name}));if(note)b.append(mkEl('small',{textContent:note}));
    b.onclick=()=>{audio();sfx('pop');hideCtxMenu();fn()};m.append(b)});
  m.hidden=false;const w=m.offsetWidth,h=m.offsetHeight;
  m.style.left=Math.round(Math.max(8,Math.min(innerWidth-w-8,at.left)))+'px';m.style.top=Math.round(Math.max(8,Math.min(innerHeight-h-8,at.bottom+6)))+'px';
  m.querySelector('.cmitem')?.focus();
}
$('#selMore').onpointerdown=e=>e.stopPropagation();
$('#selMore').onclick=e=>{e.stopPropagation();audio();const el=selected();if(el)chooseContext(el,e.currentTarget.getBoundingClientRect())};
function hideCtxMenu(){const m=$('#ctxMenu');if(m)m.hidden=true}
$('#ctxMenu').addEventListener('keydown',e=>{const items=[...$('#ctxMenu').querySelectorAll('.cmitem')],i=items.indexOf(document.activeElement);
  if(e.key==='Escape'){e.preventDefault();e.stopPropagation();hideCtxMenu()}
  else if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();items[(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length]?.focus()}});
document.addEventListener('pointerdown',e=>{if(!$('#ctxMenu').hidden&&!e.target.closest('#ctxMenu'))hideCtxMenu()},true);
// SECTION: isolation
var iso={id:null,z:1,scroll:null};   // HACK: var, not let: renderEl reads iso before this line runs at boot.
function enterIso(id,focus){
  const el=state.els.find(e=>e.id===id);if(!el)return;leaveContexts();
  if(!['page','write'].includes(document.body.dataset.ws))setWorkspace('page');
  if(iso.id)exitIso(true);
  iso.id=id;iso.z=Z;iso.scroll={l:desk.scrollLeft,t:desk.scrollTop};
  select(id);document.body.classList.add('iso');for(const h of layer.querySelectorAll('.el'))h.classList.toggle('isoff',h.dataset.id!==id);
  const b=elBox(el),k=Math.max(.25,Math.min(3,desk.clientWidth*.55/Math.max(20,b.w),desk.clientHeight*.55/Math.max(20,b.h)));
  setZoom(k);const hr=hostOf(id).getBoundingClientRect(),dr=desk.getBoundingClientRect();
  desk.scrollLeft+=hr.left+hr.width/2-(dr.left+dr.width/2);desk.scrollTop+=hr.top+Math.min(hr.height,b.h*Z)/2-(dr.top+dr.height/2);
  $('#ctxCrumb').textContent=`<${el.tag}> ${elLabel(el)}`;$('#ctxBar').hidden=false;
  setSide('sideR',true);if(focus==='style'){setSide('sideL',true);setTab('w-styles')}
  renderInspector();updateSel();renderTree();
  status('Just this component. Esc, or Done, goes back to the whole page.');
}
function exitIso(quiet){
  if(!iso.id)return;const id=iso.id;iso.id=null;document.body.classList.remove('iso');
  for(const h of layer.querySelectorAll('.el'))h.classList.remove('isoff');$('#ctxBar').hidden=true;
  if(!quiet){setZoom(iso.z);desk.scrollLeft=iso.scroll.l;desk.scrollTop=iso.scroll.t;select(id);renderTree()}
}
$('#ctxDone').onclick=()=>{audio();exitIso()};
$('#ctxPage').onclick=()=>{audio();exitIso()};


// SECTION: project files list
function projectFiles(){
  const out=[],add=(group,icon,name,note,open)=>out.push({group,icon,name,note,open});
  if(!state.project)return out;
  // RULE: a site lists every page; picking one opens it.
  if(multiPage()&&siteOn())for(const {p} of siteTree())add('Page','▦',p.name,(p.id===state.site.cur?'This page · ':'')+'#'+p.slug,()=>{setWorkspace('page');goPage(p.id)});
  else add('Page','▦',state.project.name,'The page',()=>setWorkspace('page'));
  if(isFixed())add('Page','✒',state.project.name,'Set in pages, in Write',()=>setWorkspace('write'));
  for(const sg of state.styleGraphs){const c=styleClasses().get(sg.id),n=state.els.filter(e=>(e.extra||'').split(/\s+/).includes(c)).length;add('Styles','◆',styleName(sg.g),`.${c} · on ${n} element${n===1?'':'s'}`,()=>openStyleEditor(sg.id))}
  for(const d of state.docs){const w=(d.text.match(/\S+/g)||[]).length;add('Manuscripts','✒',d.name,`${w.toLocaleString()} words · Markdown`,()=>{setWorkspace(isFixed()?'write':'page');openDoc(d.id);showText()})}
  for(const s of state.songs){const n=s.tracks.reduce((a,t)=>a+t.notes.length,0);add('Songs','♪',s.name,`${s.tracks.length} track${s.tracks.length===1?'':'s'} · ${n} notes · ${s.bpm} BPM`,()=>{setWorkspace('music');openSong(s.id)})}
  for(const el of state.els)if(el.tag==='img'&&/^data:image\//.test(el.content||''))add('Drawings','▨',(el.attrs&&el.attrs.alt)||'Image on the page','On the page',async()=>{setWorkspace('paint');await studioOpenImage(el.content,{kind:'el',id:el.id},el.w);wsSync()});
  for(const l of state.bgd.layers)if(l.type==='image'&&l.src)add('Drawings','▨','Background layer','Behind the page',async()=>{setWorkspace('paint');await studioOpenImage(l.src,{kind:'bg',id:l.id});wsSync()});
  for(const {el,spec} of tlItems())add('Animations','◷',elName(el.id),`${TRIGGER_NAMES[spec.trigger]||spec.trigger} · ${spec.dur} ms`,()=>{setWorkspace('animate');select(el.id)});
  if(state.logic&&state.logic.nodes.length)add('Logic','⚙','Page logic',`${state.logic.nodes.length} nodes`,()=>{setWorkspace('page');openLogicEditor()});
  for(const f of state.files)add('Stylesheets','{}',f.name,f.lib?'From the library':f.sample?'Sample':'Your own',()=>{setWorkspace('page');setSide('sideL',true);setTab('w-files')});
  for(const r of state.refs)add('References',r.kind==='dir'?'▭':'▤',r.path,r.note||(r.kind==='dir'?'Folder, referenced, not included':'File, referenced, not included'),openRefs);
  if(state.player)add('Player','▷',state.player.skin==='custom'?state.player.name:(SKINS.find(s=>s.id===state.player.skin)||{}).name||'Skin','Winamp skin',()=>setWorkspace('music'));
  return out;
}
let filesAt=0;
function showFiles(on){
  const pop=$('#filesPop');if(on===undefined)on=pop.hidden;pop.hidden=!on;$('#filesBtn').setAttribute('aria-expanded',on);
  if(on){$('#filesFilter').value='';filesAt=0;drawFiles();$('#filesFilter').focus()}
}
function drawFiles(){
  const q=$('#filesFilter').value.trim().toLowerCase(),list=$('#filesList'),all=projectFiles().filter(f=>!q||(f.name+' '+f.group+' '+f.note).toLowerCase().includes(q));
  list.replaceChildren();filesAt=Math.max(0,Math.min(filesAt,all.length-1));let g='';
  all.forEach((f,i)=>{
    if(f.group!==g){g=f.group;list.append(mkEl('h4',{textContent:g}))}
    const b=mkEl('button',{type:'button',className:'fitem'+(i===filesAt?' on':'')});b.setAttribute('role','option');b.setAttribute('aria-selected',i===filesAt);
    b.append(mkEl('i',{textContent:f.icon}),mkEl('b',{textContent:f.name}),mkEl('small',{textContent:f.note}));
    b.onclick=()=>{audio();showFiles(false);f.open()};list.append(b);
  });
  if(!all.length)list.append(mkEl('p',{className:'empty',textContent:'No file by that name.'}));
  list._items=all;
}
$('#filesBtn').onclick=()=>{audio();showFiles()};
$('#filesFilter').oninput=()=>{filesAt=0;drawFiles()};
$('#filesFilter').onkeydown=e=>{
  const all=$('#filesList')._items||[];
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();filesAt=(filesAt+(e.key==='ArrowDown'?1:-1)+all.length)%Math.max(1,all.length);drawFiles();$('#filesList .fitem.on')?.scrollIntoView({block:'nearest'})}
  else if(e.key==='Enter'){e.preventDefault();const f=all[filesAt];if(f){showFiles(false);f.open()}}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();showFiles(false);$('#filesBtn').focus()}
};
document.addEventListener('pointerdown',e=>{if(!$('#filesPop').hidden&&!e.target.closest('#filesPop,#filesBtn'))showFiles(false)});

// INVARIANT: resolves to the chosen answer's id, or null on Esc.
function ask(title,body,answers){
  return new Promise(res=>{
    const m=$('#askModal');$('#askTitle').textContent=title;$('#askBody').textContent=body;const row=$('#askBtns');row.replaceChildren();
    const done=v=>{m.hidden=true;m.onkeydown=null;res(v)};
    for(const a of answers){const b=mkEl('button',{type:'button',className:'btn'+(a.primary?' primary':''),textContent:a.label});b.onclick=()=>{audio();done(a.id)};row.append(b)}
    m.hidden=false;m.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(null)}};row.querySelector('.primary')?.focus();
  });
}
// INVARIANT: undefined = plays nothing; '' = plays the project's first song; else a song id. Follows exec wires from
//   click/change up to depth 8.
function songOfEl(id){
  const L=state.logic;if(!L)return undefined;
  const byId=new Map(L.nodes.map(n=>[n.id,n])),found=n=>n.type==='song'&&n.f.what!=='stop';
  const direct=L.nodes.find(n=>found(n)&&n.f.el===id);if(direct)return direct.f.song||'';
  const seen=new Set(),q=L.nodes.filter(n=>(n.type==='click'||n.type==='change')&&n.f.el===id).map(n=>[n,0]);
  while(q.length){const [n,d]=q.shift();if(seen.has(n.id)||d>8)continue;seen.add(n.id);if(found(n))return n.f.song||'';
    for(const w of L.wires)if(w.a===n.id){const t=byId.get(w.b);if(t&&NT[t.type]&&(NT[t.type].ins||[]).some(p=>p[0]===w.bp&&p[2]==='exec'))q.push([t,d+1])}}
  return undefined;
}
async function askOpenSong(el,songId){
  const s=songId?songById(songId):state.songs[0];
  if(!s){status(songId?'That button plays a song that isn’t in this project anymore.':'That button plays the project’s song, but there isn’t one yet.');
    if(await ask('No song to open',`It’s wired to play a song, but ${songId?'that song was removed':'the project has no songs yet'}. Start one in the Sequencer?`,[{id:'new',label:'Start a song',primary:true},{id:'text',label:'Edit the text'},{id:null,label:'Cancel'}])==='new'){setWorkspace('music')}
    return}
  const a=await ask(`Open “${s.name}”?`,`This plays “${s.name}” (${s.tracks.length} track${s.tracks.length===1?'':'s'}, ${s.bars} bars). Open it in the Sequencer?`,[{id:'open',label:'Open in the Sequencer',primary:true},{id:'text',label:'Edit the text'},{id:null,label:'Cancel'}]);
  if(a==='open'){setWorkspace('music');openSong(s.id)}else if(a==='text')startEdit(el);
}


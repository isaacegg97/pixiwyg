// SECTION: title screen
const ago=t=>{const s=(Date.now()-t)/1000;if(s<60)return'just now';if(s<3600)return`${Math.floor(s/60)} min ago`;if(s<86400)return`${Math.floor(s/3600)} h ago`;if(s<86400*7)return`${Math.floor(s/86400)} d ago`;return new Date(t).toLocaleDateString()};
async function showTitle(){
  await flushSave();if(more.open)more.open=false;
  const cur=state.project,list=await listProjects(),box=$('#tList');box.replaceChildren();
  $('#tContinue').hidden=!cur;if(cur)$('#tContinue').textContent=`Back to ${cur.name}`;
  if(!list.length)box.append(mkEl('p',{className:'empty',textContent:'No projects in this browser yet. Start one above, or open a .pixiwyg file.'}));
  for(const p of list){
    const row=mkEl('div',{className:'trow'+(cur&&cur.id===p.id?' on':'')}),info=mkEl('div');
    const sh=(p.sheets||[]).slice(0,3).join(', ')+((p.sheets||[]).length>3?` +${p.sheets.length-3}`:'');
    info.append(mkEl('b',{textContent:p.name}),mkEl('span',{textContent:[p.canvas||'Web page',`Edited ${ago(p.modified)}`,`${p.elements} element${p.elements===1?'':'s'}`,sh].filter(Boolean).join(' · ')}));
    const open=mkEl('button',{className:'btn',textContent:cur&&cur.id===p.id?'Back to it':'Open'});
    open.onclick=()=>{audio();cur&&cur.id===p.id?hideTitle():openStored(p.id)};
    const dl=mkEl('button',{className:'btn',textContent:'Save file',title:'Download this project as a .pixiwyg file'});
    dl.onclick=async()=>{audio();const f=await storedFiles(p.id);if(f)download(zipFiles(sortEntries(f)),slug(p.name)+'.pixiwyg')};
    const del=mkEl('button',{className:'btn',textContent:'Delete',title:'Remove it from this browser. Save a file first to keep it.'});
    let armed=false;del.onclick=async()=>{audio();if(!armed){armed=true;del.textContent='Sure?';del.classList.add('dyna');setTimeout(()=>{armed=false;del.textContent='Delete';del.classList.remove('dyna')},2500);return}
      await dropProject(p.id).catch(()=>{});if(cur&&cur.id===p.id){state.project=null;resetProject();renderAll();renderBackground()}sfx('whoosh');showTitle()};
    open.addEventListener('dblclick',e=>e.stopPropagation());row.ondblclick=()=>open.click();
    row.append(info,mkEl('div',{className:'tacts'}));row.lastChild.append(open,dl,del);box.append(row);
  }
  renderKindPicker();storageLine().then(t=>{$('#tStorage').textContent=t});
  $('#title').hidden=false;document.body.classList.add('titled');
  (!$('#tContinue').hidden?$('#tContinue'):list.length?$('#tName'):$('#tTour')).focus();
}
function hideTitle(){if(!state.project)return;$('#title').hidden=true;document.body.classList.remove('titled')}
$('#tContinue').onclick=()=>{audio();hideTitle()};
$('#tBlank').onclick=()=>{audio();newProject($('#tName').value,false,newKind,$('#tStart').value)};
$('#tName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#tBlank').click()}});
$('#tFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)openProjectFile(f)};
$('#projBtn').onclick=()=>{audio();sfx('whoosh');showTitle()};
$('#saveFileBtn').onclick=()=>{audio();downloadProject()};
$('#projName').addEventListener('input',e=>{if(!state.project)return;state.project.name=e.target.value.trim().slice(0,80)||'Untitled';document.title=state.project.name+' · PIXIWYG';save()});
$('#projName').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='Escape')e.target.blur()});


// SECTION: title screen
const ago=t=>{const s=(Date.now()-t)/1000;if(s<60)return'just now';if(s<3600)return`${Math.floor(s/60)} min ago`;if(s<86400)return`${Math.floor(s/3600)} h ago`;if(s<86400*7)return`${Math.floor(s/86400)} d ago`;return new Date(t).toLocaleDateString()};
async function showTitle(){
  await flushSave();if(more.open)more.open=false;
  const cur=state.project,list=await listProjects(),box=$('#tList');box.replaceChildren();
  $('#tContinue').hidden=!cur;if(cur)$('#tContinue').textContent=`Back to ${cur.name}`;
  if(!list.length)box.append(mkEl('p',{className:'empty',textContent:'No projects in this browser yet. Start one, or open a .pixiwyg file.'}));
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
  renderStarts();renderTours();renderKindPicker();storageLine().then(t=>{$('#tStorage').textContent=t});
  $('#title').hidden=false;document.body.classList.add('titled');
  (!$('#tContinue').hidden?$('#tContinue'):list.length?$('#tName'):$('#tStarts .tstart')).focus();
}
function hideTitle(){if(!state.project)return;$('#title').hidden=true;document.body.classList.remove('titled')}
$('#tContinue').onclick=()=>{audio();hideTitle()};
// SECTION: home: start something (a workflow: a canvas, the workspace it opens in, and a first push)
// RULE: each start is one tap to a blank project already where that kind of work happens; the canvas picker under it
//   is for choosing sizes first.
const STARTS=[
  {icon:'🌐',name:'A web page',note:'Grows with the window',kind:'web',ws:'page'},
  {icon:'✒',name:'A story',note:'Write on printed pages',kind:'page',ws:'write'},
  {icon:'📖',name:'A zine',note:'Folded, stapled, printed',kind:'booklet',ws:'page'},
  {icon:'🎨',name:'A picture',note:'Paint on a square',kind:'screen',ws:'paint'},
  {icon:'♫',name:'A song',note:'Starts with ideas to play with',kind:'web',ws:'music',then:()=>openIdeas()},
  {icon:'◷',name:'An animation',note:'Things that move on a screen',kind:'screen',ws:'animate'},
  {icon:'◆',name:'Something in 3D',note:'Shapes for the page',kind:'web',ws:'model'},
];
function renderStarts(){
  $('#tStarts').replaceChildren(...STARTS.map(s=>{const b=mkEl('button',{type:'button',className:'tstart'});
    b.append(mkEl('span',{className:'ticon',textContent:s.icon,ariaHidden:'true'}),mkEl('b',{textContent:s.name}),mkEl('small',{textContent:s.note}));
    b.onclick=()=>{audio();startWork(s,$('#tName').value)};return b}));
}
async function startWork(s,name){await newProject(name||'',false,kindCanvas(s.kind),s.ws);if(s.then)s.then()}
// SECTION: home: learn (every tour, one tap each)
// FIX: built when drawn: the profiles and tours are defined after this file.
const tours=()=>[
  ...Object.entries(PROFILES).map(([p,v])=>({name:`${v.name} tour`,note:v.gets,run:()=>chooseProfile(p)})),
  {name:'Components',note:'Animation, logic and parts to reuse',run:async()=>{await newProject('Component workshop',true);runTour('Components',COMPONENTS)}},
  {name:'The full tour',note:'Everything, in order',run:()=>startTour()},
  {name:'⭐ Creative Quest',note:'For kids: seven missions with stars',run:()=>startQuest(),kid:true},
];
function renderTours(){
  $('#tTours').replaceChildren(...tours().map(t=>{const b=mkEl('button',{type:'button',className:'btn ttour'+(t.kid?' kid':''),title:t.note});
    b.append(mkEl('b',{textContent:t.name}),mkEl('small',{textContent:t.note}));b.onclick=()=>{audio();t.run()};return b}));
}
$('#tBlank').onclick=()=>{audio();newProject($('#tName').value,false,newKind,$('#tStart').value)};
$('#tName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#tBlank').click()}});
$('#tFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)openProjectFile(f)};
$('#projBtn').onclick=()=>{audio();sfx('whoosh');showTitle()};
$('#saveFileBtn').onclick=()=>{audio();downloadProject()};
$('#projName').addEventListener('input',e=>{if(!state.project)return;state.project.name=e.target.value.trim().slice(0,80)||'Untitled';document.title=state.project.name+' · PIXIWYG';save()});
$('#projName').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key==='Escape')e.target.blur()});


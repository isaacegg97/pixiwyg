// SECTION: versions (named checkpoints of the open project)
// RULE: restoring first checkpoints what is there now, so a restore is itself undoable from the same list.
async function saveVersion(name){
  if(!state.project||readOnly)return null;await saveNow();
  const files=packProject(),text={},paths=[];for(const [k,v] of files)if(isBlobPath(k,v))paths.push(k);else text[k]=v;
  const rec={id:nid('v'),project:state.project.id,name:String(name||'').trim().slice(0,80)||new Date().toLocaleString(),created:Date.now(),files:text,blobs:paths,
    bytes:[...files.values()].reduce((a,v)=>a+(typeof v==='string'?v.length:v.length),0)};
  await tx(['versions'],'readwrite',v=>{v.put(rec)});return rec;
}
const listVersions=id=>tx(['versions'],'readonly',v=>v.index('project').getAll(IDBKeyRange.only(id))).then(l=>(l||[]).sort((a,b)=>b.created-a.created)).catch(()=>[]);
async function restoreVersion(vid){
  const rec=await tx(['versions'],'readonly',v=>v.get(vid));if(!rec||!state.project||rec.project!==state.project.id)return false;
  await saveVersion(`Before restoring “${rec.name}”`);
  const files=new Map(Object.entries(rec.files)),got={};
  await tx(['blobs'],'readonly',b=>{for(const k of rec.blobs){const q=b.get(k);q.onsuccess=()=>{got[k]=q.result}}});
  for(const k of rec.blobs){if(!got[k]){status('That version is missing a picture; it can’t be restored.');return false}files.set(k,got[k])}
  const P=state.project,ok=await openFiles(files,{id:P.id,name:P.name,created:P.created,modified:Date.now()});
  if(ok){lastSavedKey='';await saveNow();status(`Restored “${rec.name}”. What was there before is kept as a version.`)}
  return ok;
}
const dropVersion=vid=>tx(['versions'],'readwrite',v=>{v.delete(vid)}).then(()=>gcBlobs().catch(()=>0));
async function renderVersions(){
  const box=$('#verList');box.replaceChildren();if(!state.project)return;
  const list=await listVersions(state.project.id);
  if(!list.length){box.append(mkEl('li',{className:'empty',textContent:'No versions yet.'}));return}
  for(const v of list){const li=mkEl('li');li.append(mkEl('b',{textContent:v.name,title:v.name}),mkEl('small',{textContent:`${new Date(v.created).toLocaleString()} · ${v.bytes>1e6?(v.bytes/1e6).toFixed(1)+' MB':Math.max(1,Math.round(v.bytes/1e3))+' KB'}`}));
    const go=mkEl('button',{type:'button',className:'btn',textContent:'Go back to this'}),del=mkEl('button',{type:'button',className:'btn',textContent:'Delete',title:'Delete this version'});
    go.disabled=del.disabled=readOnly;
    go.onclick=async()=>{audio();go.disabled=true;if(await restoreVersion(v.id)){sfx('boing');$('#verModal').hidden=true}else go.disabled=false};
    del.onclick=async()=>{audio();await dropVersion(v.id);sfx('whoosh');renderVersions()};
    li.append(go,del);box.append(li)}
}
function openVersions(){if(!state.project)return;$('#verModal').hidden=false;$('#verSave').disabled=readOnly;$('#verName').value='';renderVersions();$('#verName').focus()}
$('#versionsBtn').onclick=()=>{audio();$('#moreMenu').open=false;openVersions()};
$('#verClose').onclick=()=>{$('#verModal').hidden=true};
$('#verSave').onclick=async()=>{audio();const v=await saveVersion($('#verName').value);if(v){$('#verName').value='';status(`Saved version “${v.name}”`);sfx('pop');renderVersions()}};
$('#verName').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('#verSave').click()}});
function saveNow(){
  clearTimeout(saveT);saveT=null;if(!state.project||readOnly)return Promise.resolve(false);
  const files=packProject(),key=filesKey(files);if(key===lastSavedKey)return saving;
  const P=state.project;P.modified=Date.now();
  const meta={id:P.id,name:P.name,created:P.created,modified:P.modified,elements:state.els.length,sheets:state.files.filter(f=>f.enabled).map(f=>f.name),canvas:canvasSummary()};
  return saving=putProject(meta,files).then(()=>{lastSavedKey=key;askPersist();return true},e=>{logErr('save',e&&e.message||e);status('This browser would not keep the project. Save file keeps a copy.');return false});
}
const flushSave=()=>saveT?saveNow():saving;
addEventListener('pagehide',()=>{if(saveT)saveNow();if(primT){clearTimeout(primT);writePrims()}});

function download(blob,name){const a=mkEl('a',{href:URL.createObjectURL(blob),download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),5000)}
function downloadProject(){if(!state.project)return;download(zipFiles(sortEntries(packProject())),slug(state.project.name)+'.pixiwyg');status('Saved a copy as '+slug(state.project.name)+'.pixiwyg');sfx('boing')}
async function readProjectUpload(file,path){
  let files;
  if(/\.json$/i.test(path||file.name||''))files=new Map([['manifest.json',await file.text()]]);
  else files=new Map(await unzip(file));
  // COMPAT: a zip of the project's folder opens too.
  if(!files.has('manifest.json')){const k=[...files.keys()].find(x=>/^[^/]+\/manifest\.json$/.test(x));if(k){const pre=k.slice(0,-13);files=new Map([...files].filter(([x])=>x.startsWith(pre)).map(([x,v])=>[x.slice(pre.length),v]))}}
  return files;
}
async function isProjectFile(file,path){
  path=path||file.name||'';if(/\.pixiwyg$/i.test(path))return true;
  if(!/\.(zip|json)$/i.test(path))return false;
  try{const f=await readProjectUpload(file,path),m=f.get('manifest.json');return isBackup(f)||!!m&&fileText(m).includes(`"${PROJ_FORMAT}"`)}catch(e){return false}
}
async function openFiles(files,meta){
  await flushSave();projLoading=true;let r;
  try{r=await readProject(files)}
  catch(e){projLoading=false;status(e.message);if(state.project)await openStored(state.project.id,true);else showTitle();return false}
  state.project={id:meta.id||nid('p'),name:meta.name||r.name,created:meta.created||Date.now(),modified:meta.modified||Date.now()};
  if(!meta.id){await claimLock(state.project.id);setReadOnly(false)}
  renderProject();projLoading=false;lastSavedKey=meta.id?filesKey(packProject()):'';
  hideTitle();
  status(r.lost.length?`Opened ${state.project.name}, but could not rebuild ${r.lost.join(', ')}`:`Opened ${state.project.name}`);
  return true;
}
async function openStored(id,quiet,locked){
  const files=await storedFiles(id).catch(()=>null),meta=(await listProjects()).find(x=>x.id===id);
  if(!files||!meta){if(!quiet)status('That project is no longer in this browser');return false}
  let ro=false;
  if(!locked&&!(await claimLock(id))){const v=await askLocked(meta.name);if(!v)return false;if(v==='take')await claimLock(id,true);else{releaseLock();ro=true}}
  const ok=await openFiles(files,meta);if(ok)setReadOnly(ro);return ok;
}
async function openProjectFile(file,path){
  let files;try{files=await readProjectUpload(file,path)}catch(e){status(`Could not open ${path||file.name}. Is it a PIXIWYG project?`);return false}
  if(isBackup(files)){await restoreBackup(files);return true}
  // RULE: a file opened from disk becomes a new browser project; the original stays untouched.
  if(await openFiles(files,{})){await saveNow();sfx('boing');return true}
  return false;
}
async function newProject(name,demo,canvas,start){
  await flushSave();projLoading=true;
  resetProject();fitStage();
  state.project={id:nid('p'),name:(name||'').trim().slice(0,80)||'Untitled',created:Date.now(),modified:Date.now()};
  await claimLock(state.project.id);setReadOnly(false);
  state.canvas=cleanCanvas(canvas);applyCanvas();
  state.ws=WS_IDS.includes(start)?start:'';
  if(demo)await seed();delete state._seedArt;
  renderProject();projLoading=false;lastSavedKey='';await saveNow();
  hideTitle();sfx('pop');
  // RULE: in the writer the stylesheet pick is on the ribbon (Layout); the Add panel stays folded.
  if(!demo&&wr.on)status(`${isFixed()?canvasSummary():'A blank page'}. Write on the page; Layout on the ribbon picks its stylesheet.`);
  else if(!demo){setTab('w-files');setSide('sideL',true);$('#libBox').open=true;status(`${isFixed()?canvasSummary():'A blank page'}. Add a stylesheet from the library, or drop in your own CSS.`)}
  else status(`Started ${state.project.name} from the demo`);
}


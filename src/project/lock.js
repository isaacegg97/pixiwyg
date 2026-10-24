// SECTION: project lock
// INVARIANT: a Web Lock is held while a project is open; a second window opens read-only or takes over, which makes
//   the first read-only. COMPAT: without Web Locks every window can write.
let lockRelease=null,readOnly=false;
const hasLocks=()=>!!(navigator.locks&&navigator.locks.request);
function releaseLock(){if(lockRelease){lockRelease();lockRelease=null}}
function claimLock(id,steal){
  if(!hasLocks())return Promise.resolve(true);
  releaseLock();
  return new Promise(res=>{
    navigator.locks.request('pixiwyg-project:'+id,steal?{steal:true}:{ifAvailable:true},lock=>{
      if(!lock){res(false);return}
      res(true);return new Promise(r=>{lockRelease=r});
    }).catch(e=>{if(e&&e.name==='AbortError'&&state.project&&state.project.id===id)setReadOnly(true,'Another window took this project over.')});
  });
}
function setReadOnly(on,why){
  readOnly=on;if(on){clearTimeout(saveT);saveT=null}
  const b=$('#roBar');b.hidden=!on;if(on)$('#roWhy').textContent=why||'This project is open in another window.';
  document.body.classList.toggle('readonly',on);
}
// INVARIANT: resolves 'ro' (read-only), 'take' (take over) or null (cancel).
function askLocked(name){return new Promise(res=>{const m=$('#lockModal');$('#lockName').textContent=name;m.hidden=false;
  const done=v=>{m.hidden=true;for(const id of ['lockRo','lockTake','lockCancel'])$('#'+id).onclick=null;res(v)};
  $('#lockRo').onclick=()=>done('ro');$('#lockTake').onclick=()=>done('take');$('#lockCancel').onclick=()=>done(null);$('#lockTake').focus()})}
$('#roTake').onclick=async()=>{audio();if(!state.project)return;const id=state.project.id;await claimLock(id,true);setReadOnly(false);await openStored(id,true,true);status('This window has the project now. Its latest saved version is open.')};

// FORMAT: backup = one zip holding every project as its own .pixiwyg plus the primitives library.
async function backupAll(){
  await flushSave();const list=await listProjects(),entries=[],projects=[];
  for(const p of list){const files=await storedFiles(p.id).catch(()=>null);if(!files)continue;
    const file=`projects/${slug(p.name)}-${p.id}.pixiwyg`;entries.push([file,new Uint8Array(await zipFiles(sortEntries(files)).arrayBuffer())]);
    projects.push({id:p.id,name:p.name,created:p.created,modified:p.modified,file})}
  entries.push(['primitives.json',primJSON(prims.list,null)]);
  entries.unshift(['backup.json',JSON.stringify({format:'pixiwyg-backup',version:1,app:'PIXIWYG '+APP_VERSION,created:new Date().toISOString(),projects,primitives:'primitives.json'},null,2)+'\n']);
  download(zipFiles(entries),`pixiwyg-backup-${new Date().toISOString().slice(0,10)}.zip`);
  status(`Backed up ${projects.length} project${projects.length===1?'':'s'} and ${prims.list.length} primitives. Open project file restores it.`);sfx('boing');
}
const isBackup=files=>{const b=files.get('backup.json');try{return!!b&&JSON.parse(fileText(b)).format==='pixiwyg-backup'}catch(e){return false}};
// RULE: restore never overwrites: an identical project is skipped, a different one comes back as a copy.
async function restoreBackup(files){
  const b=JSON.parse(fileText(files.get('backup.json'))),have=new Map((await listProjects()).map(p=>[p.id,p]));let added=0,same=0,copies=0;
  for(const p of Array.isArray(b.projects)?b.projects:[]){
    const bytes=files.get(p.file);if(!bytes||typeof bytes==='string')continue;
    let pf;try{pf=new Map(await unzip(new Blob([bytes])))}catch(e){continue}
    const mt=pf.get('manifest.json');if(!mt)continue;let m;try{m=JSON.parse(fileText(mt))}catch(e){continue}if(m.format!==PROJ_FORMAT)continue;
    let id=String(p.id||'').replace(/[^\w-]/g,'').slice(0,40)||nid('p'),name=String(p.name||m.name||'Restored').slice(0,80);
    const prev=have.get(id);
    if(prev){const cur=await storedFiles(id).catch(()=>null);if(cur&&filesKey(cur)===filesKey(pf)){same++;continue}id=nid('p');name=(name+' (restored)').slice(0,80);copies++}
    const c=cleanCanvas(m.canvas);
    await putProject({id,name,created:+p.created||Date.now(),modified:+p.modified||Date.now(),elements:Array.isArray(m.elements)?m.elements.length:0,sheets:(m.stylesheets||[]).filter(s=>s&&s.enabled!==false).map(s=>String(s.name||'')),canvas:canvasSummary(c)},pf);
    added++;
  }
  let np=0;const pj=files.get(b.primitives||'primitives.json');if(pj)np=importPrimText(fileText(pj),{dedupe:true,quiet:true});
  status(`Restored ${added} project${added===1?'':'s'}${copies?` (${copies} as copies, next to the ones already here)`:''}${same?`, skipped ${same} already here`:''}, and ${np} primitives.`);
  showTitle();sfx('boing');
}
$('#backupBtn').onclick=()=>{audio();backupAll()};
$('#tBackup').onclick=()=>{audio();backupAll()};


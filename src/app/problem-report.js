// SECTION: problem report
// SAFETY: everything stays local; the tester decides what to send and where.
function reportText(){
  const p=state.project,lines=[
    `PIXIWYG ${APP_VERSION}`,`Engine: ${engineName()}`,`Platform: ${navigator.platform||''} · ${navigator.language||''} · screen ${screen.width}×${screen.height} @${devicePixelRatio}x`,
    `Time: ${new Date().toISOString()}`,
    p?`Project: ${p.name} · ${canvasSummary()} · ${state.els.length} elements · stylesheets: ${state.files.map(f=>f.name).join(', ')||'none'}`:'Project: none open',
    `Primitives: ${prims.list.length}`,'',
    `What happened (please describe):`,'','',
    `Recent errors (${ERRS.length}):`,...(ERRS.length?ERRS.map(e=>`[${e.t}] ${e.kind}: ${e.msg}${e.stack?'\n    '+e.stack.split('\n').slice(0,4).join('\n    '):''}`):['none recorded'])];
  return lines.join('\n');
}
function openReport(){$('#reportText').value=reportText();$('#reportProj').disabled=!state.project;$('#reportProj').checked=false;$('#reportModal').hidden=false;$('#reportText').focus()}
$('#reportBtn').onclick=()=>{audio();openReport()};
$('#reportClose').onclick=()=>{$('#reportModal').hidden=true};
$('#reportModal').addEventListener('pointerdown',e=>{if(e.target.id==='reportModal')$('#reportModal').hidden=true});
$('#reportCopy').onclick=()=>{const ta=$('#reportText');navigator.clipboard.writeText(ta.value).then(()=>status('Copied the report'),()=>{ta.focus();ta.select();status('Press Ctrl/Cmd+C to copy the selected report')})};
$('#reportSave').onclick=()=>{
  const stamp=new Date().toISOString().slice(0,16).replace(/[:T]/g,'-'),text=$('#reportText').value;
  if($('#reportProj').checked&&state.project){const files=sortEntries(packProject());
    zipFiles(files).arrayBuffer().then(b=>download(zipFiles([['report.txt',text],[slug(state.project.name)+'.pixiwyg',new Uint8Array(b)]]),`pixiwyg-report-${stamp}.zip`))}
  else download(new Blob([text],{type:'text/plain'}),`pixiwyg-report-${stamp}.txt`);
  status('Saved the report. Attach it to your beta feedback.');
};
$('#reportClear').onclick=()=>{ERRS.length=0;try{localStorage.removeItem('pixiwyg.errors')}catch(e){}$('#reportText').value=reportText();status('Cleared the recorded errors')};

// RULE: persistent storage is requested once, after the first project save.
let persistAsked=false;
async function askPersist(){if(persistAsked||!navigator.storage||!navigator.storage.persist)return;persistAsked=true;try{if(!(await navigator.storage.persisted()))await navigator.storage.persist()}catch(e){}}


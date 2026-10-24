// SECTION: references (files and folders the project points at but never carries)
// FORMAT: manifest "references": [{path, kind:'file'|'dir', note?}]. path is relative to the published page, forward
//   slashes, no scheme, no leading slash, no '..' segment. The bytes never enter the project; REFERENCES.md in the
//   saved file tells whoever opens it where to put them.
const REF_MAX=256;
function cleanRefPath(p){
  p=String(p||'').trim().replace(/\\/g,'/').replace(/\/{2,}/g,'/').replace(/^(\.\/)+/,'');
  // SAFETY: a scheme, an absolute path or '..' would let a shared project point outside the site it is published as.
  if(!p||p.length>512||/^[a-z][\w+.-]*:/i.test(p)||p.startsWith('/')||p.split('/').some(s=>s==='..'||s==='.'||/[\u0000-\u001f]/.test(s)))return null;
  return p;
}
function cleanRef(r){
  if(!r||typeof r!=='object')return null;
  const kind=r.kind==='dir'?'dir':'file',p=cleanRefPath(r.path);if(!p)return null;
  const path=kind==='dir'?p.replace(/\/?$/,'/'):p.replace(/\/+$/,'');if(!path||path==='/')return null;
  const o={path,kind},note=typeof r.note==='string'?r.note.trim().slice(0,500):'';if(note)o.note=note;
  return o;
}
function cleanRefs(a){
  const seen=new Set(),out=[];
  for(const r of Array.isArray(a)?a.slice(0,REF_MAX):[]){const c=cleanRef(r);if(c&&!seen.has(c.path)){seen.add(c.path);out.push(c)}}
  return out;
}
function addRef(path,kind,note){
  const r=cleanRef({path,kind,note});if(!r)return null;
  if(state.refs.some(x=>x.path===r.path))return r;
  if(state.refs.length>=REF_MAX){status(`A project keeps at most ${REF_MAX} references.`);return null}
  pushUndo();state.refs.push(r);save();return r;
}
function dropRef(path){const n=state.refs.length;state.refs=state.refs.filter(r=>r.path!==path);if(state.refs.length!==n){pushUndo();save()}}
function refsReadme(){
  const L=['# References','','This project points at files and folders it does not include. Before publishing it, or after',
    'opening it on another machine, put each one at the same path relative to the published page (index.html):',''];
  for(const r of state.refs)L.push(`- \`${r.path}\` (${r.kind==='dir'?'folder':'file'})${r.note?' — '+r.note.replace(/\s+/g,' '):''}`);
  L.push('','PIXIWYG keeps only these paths, never the contents, so the project stays small. The autopublish payload',
    'lists them under "references" for the publisher to collect.','');
  return L.join('\n');
}

// SECTION: references dialog
function openRefs(){drawRefs();$('#refsModal').hidden=false;$('#refPath').focus()}
function drawRefs(){
  const list=$('#refsList');list.replaceChildren();
  if(!state.refs.length)list.append(mkEl('p',{className:'empty',textContent:'Nothing referenced yet.'}));
  for(const r of state.refs){
    const row=mkEl('div',{className:'refrow'}),x=mkEl('button',{type:'button',className:'btn ico',textContent:'×',title:'Remove this reference'});
    x.setAttribute('aria-label','Remove '+r.path);x.onclick=()=>{audio();dropRef(r.path);drawRefs()};
    row.append(mkEl('i',{textContent:r.kind==='dir'?'▭':'▤'}),mkEl('code',{textContent:r.path}),mkEl('small',{textContent:r.note||''}),x);list.append(row);
  }
}
function refAddFromForm(){
  const r=addRef($('#refPath').value,$('#refKind').value,$('#refNote').value);
  if(!r){status('That path has to be relative to the page: no leading /, no ../, no scheme.');$('#refPath').focus();return}
  $('#refPath').value='';$('#refNote').value='';drawRefs();sfx('click');status(`Referenced ${r.path}. Its contents stay where they are.`);
}
// INVARIANT: a picked file or folder contributes only its name; the browser never reveals where it sits on disk.
function refPicked(e,kind){
  const f=e.target.files&&e.target.files[0];e.target.value='';if(!f)return;
  const name=kind==='dir'?(f.webkitRelativePath||f.name).split('/')[0]:f.name;
  $('#refKind').value=kind;$('#refPath').value=name+(kind==='dir'?'/':'');$('#refPath').focus();
}
$('#refAdd').onclick=()=>{audio();refAddFromForm()};
$('#refPath').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();refAddFromForm()}});
$('#refPickFile').onchange=e=>refPicked(e,'file');
$('#refPickDir').onchange=e=>refPicked(e,'dir');
$('#refsClose').onclick=()=>{$('#refsModal').hidden=true};
$('#refsModal').addEventListener('click',e=>{if(e.target.id==='refsModal')$('#refsModal').hidden=true});


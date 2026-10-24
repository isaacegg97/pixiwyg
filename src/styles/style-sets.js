// SECTION: load style set (stylesheets as brush sets: pick, preview, then append or replace)
// RULE: nothing is added until Load; the preview compiles a throwaway copy. Replace turns the current sheets off
//   rather than deleting them, so placed elements keep their references and turning a sheet back on restores them.
// INVARIANT: files go through unpack + ingest, so baking fonts and images stays in one place.
const sset={items:[]};
const SSET_KEEP=x=>x==='css'||!!ASSET_EXT[x];
function ssetTagCounts(f){
  const n=new Map();
  for(const [,chain] of f.sels){const L=chain[chain.length-1];if(L.classes.includes('__html')||L.classes.includes('__body'))continue;
    const t=L.tag&&L.tag!=='*'?L.tag:hintTag(L);if(t&&TAGS[t])n.set(t,(n.get(t)||0)+1)}
  return[...n].sort((a,b)=>b[1]-a[1]);
}
function ssetPreview(name,text){
  const f={name,text};compileFile(f);
  return{name,styles:f.sels.length,fonts:f.fonts?f.fonts.split('@font-face').length-1:0,error:f.error,tags:ssetTagCounts(f)};
}
async function ssetAddFiles(raw){
  const list=(await unpack(raw)).filter(it=>SSET_KEEP(extOf(it.path)));
  const css=list.filter(it=>extOf(it.path)==='css');
  if(!css.length){status('No stylesheets in that. A style set is CSS files, a folder or a .zip of them.');return}
  const previews=[];for(const it of css)previews.push(ssetPreview(it.path.split('/').pop(),await it.file.text()));
  sset.items.push({kind:'files',list,previews,assets:list.length-css.length});drawSset();
}
async function ssetAddLib(file){
  const e=LIBRARY.find(l=>l.file===file);if(!e||sset.items.some(i=>i.kind==='lib'&&i.file===file))return;
  let text;try{text=await fetchLib(file)}catch(err){status(`Could not load ${e.name} from the library.`);return}
  sset.items.push({kind:'lib',file,previews:[{...ssetPreview(e.name,text),name:e.name,era:e.era}],assets:0});drawSset();
}
function openSset(){
  sset.items=[];$('#ssetMode').value='append';
  const sel=$('#ssetLib');sel.replaceChildren(mkEl('option',{value:'',textContent:'From the library…'}));
  LIB_GROUPS.forEach((g,gi)=>{const og=mkEl('optgroup');og.label=g;for(const l of LIBRARY)if(l.group===gi)og.append(mkEl('option',{value:l.file,textContent:`${l.name} · ${l.era}`}));sel.append(og)});
  drawSset();$('#ssetModal').hidden=false;$('#ssetPick').focus();
}
function closeSset(){$('#ssetModal').hidden=true;sset.items=[]}
function drawSset(){
  const box=$('#ssetList');box.replaceChildren();let n=0;
  sset.items.forEach((it,i)=>{
    for(const p of it.previews){n++;
      const row=mkEl('div',{className:'ssrow'}),head=mkEl('div',{className:'sshead'}),x=mkEl('button',{type:'button',className:'btn ico',textContent:'×',title:'Leave this out'});
      x.setAttribute('aria-label','Leave out '+p.name);x.onclick=()=>{audio();sset.items.splice(i,1);drawSset()};
      head.append(mkEl('b',{textContent:p.name}),mkEl('small',{textContent:`${p.styles} style${p.styles===1?'':'s'}${p.fonts?` · ${p.fonts} font${p.fonts===1?'':'s'}`:''}${it.kind==='lib'?' · library':''}${p.error?' · has errors':''}`}),x);
      const chips=mkEl('div',{className:'sschips'});
      for(const [t,c] of p.tags.slice(0,14))chips.append(mkEl('span',{className:'sschip',textContent:`${t} ${c}`}));
      if(!p.tags.length)chips.append(mkEl('span',{className:'shelp',textContent:'No styles the catalog can use.'}));
      row.append(head,chips);box.append(row);
    }
    if(it.assets)box.append(mkEl('p',{className:'shelp',textContent:`+ ${it.assets} font and image file${it.assets===1?'':'s'} to bake in`}));
  });
  if(!n)box.append(mkEl('p',{className:'empty',textContent:'Pick stylesheets, a folder, a .zip or a library set to see what it brings.'}));
  $('#ssetGo').disabled=!n;$('#ssetGo').textContent=n?`Load ${n} stylesheet${n===1?'':'s'}`:'Load';
}
async function loadSset(){
  if(!sset.items.length)return 0;const replace=$('#ssetMode').value==='replace',items=sset.items;closeSset();
  let off=0;if(replace)for(const f of state.files)if(!f.gen&&f.enabled){f.enabled=false;off++}
  let n=0;
  for(const it of items)if(it.kind==='lib'){const had=state.files.find(f=>f.lib===it.file);if(had){if(!had.enabled){had.enabled=true;n++}}else if(await addLib(it.file))n++}
  const files=items.filter(i=>i.kind==='files').flatMap(i=>i.list);
  const before=state.files.length;if(files.length)await ingest(files,null);n+=state.files.length-before;
  afterFilesChanged();sfx('boing');
  status(`Loaded ${n} stylesheet${n===1?'':'s'}${replace&&off?`; turned ${off} off (Stylesheets turns them back on)`:''}.`);
  return n;
}
$('#ssetFiles').onchange=async e=>{const l=[...e.target.files].map(f=>({path:f.webkitRelativePath||f.name,file:f}));e.target.value='';await ssetAddFiles(l)};
$('#ssetDir').onchange=$('#ssetFiles').onchange;
$('#ssetLib').onchange=async e=>{const v=e.target.value;e.target.value='';if(v)await ssetAddLib(v)};
$('#ssetGo').onclick=()=>{audio();loadSset()};
$('#ssetClose').onclick=()=>{audio();closeSset()};
$('#ssetModal').addEventListener('click',e=>{if(e.target.id==='ssetModal')closeSset()});
$('#ssetOpen').onclick=()=>{audio();openSset()};


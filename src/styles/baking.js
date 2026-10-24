// SECTION: files in
const readURL=file=>new Promise(r=>{const fr=new FileReader();fr.onload=()=>r(fr.result);fr.readAsDataURL(file)});
// SECTION: baking (a sheet's fonts, images and relative @imports are inlined when it is added)
const ASSET_EXT={woff:'font/woff',woff2:'font/woff2',ttf:'font/ttf',otf:'font/otf',eot:'application/vnd.ms-fontobject',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',svg:'image/svg+xml',webp:'image/webp',avif:'image/avif',bmp:'image/bmp',ico:'image/x-icon',cur:'image/x-icon'};
const extOf=p=>((p.split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)||[])[1]||'').toLowerCase();
const normPath=p=>{const out=[];for(const x of p.replace(/\\/g,'/').split('/')){if(!x||x==='.')continue;if(x==='..')out.pop();else out.push(x)}return out.join('/').toLowerCase()};
const dirOf=p=>(p||'').replace(/\\/g,'/').replace(/[^/]*$/,'');
const isRemote=u=>/^([a-z]+:)?\/\//i.test(u)&&!/^data:/i.test(u);
const assets={byPath:new Map(),byName:new Map()};
function addAsset(path,url){const n=normPath(path);assets.byPath.set(n,url);const b=n.split('/').pop();assets.byName.set(b,assets.byName.has(b)&&assets.byName.get(b)!==url?null:url)}
function findAsset(from,ref){
  let clean=ref.split(/[?#]/)[0];try{clean=decodeURIComponent(clean)}catch(e){}
  return assets.byPath.get(normPath(dirOf(from)+clean))||assets.byName.get(normPath(clean).split('/').pop())||null;
}
function bake(text,path,cssByPath=new Map(),depth=0){
  const missing=new Set(),remote=new Set();let baked=0;
  text=text.replace(/@import\s+(?:url\(\s*)?(['"]?)([^'")\s;]+)\1\s*\)?([^;]*);/gi,(m,q,u,media)=>{
    if(isRemote(u)){remote.add(u);return m}
    const sub=cssByPath.get(normPath(dirOf(path)+u));
    if(!sub||depth>8){missing.add(u);return m}
    const r=bake(sub.text,sub.path,cssByPath,depth+1);r.missing.forEach(x=>missing.add(x));r.remote.forEach(x=>remote.add(x));baked+=r.baked+1;sub.imported=true;
    const body=r.text.replace(/@charset[^;]*;/gi,'');media=media.trim();return media?`@media ${media}{${body}}`:body;
  });
  text=text.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,(m,q,u)=>{
    u=u.trim();if(/^data:/i.test(u)||u.startsWith('#'))return m;
    if(isRemote(u)){remote.add(u);return m}
    const d=findAsset(path,u);if(d){baked++;return `url("${d}")`}
    missing.add(u);return m;
  });
  return{text,missing:[...missing],remote:[...remote],baked};
}
// SAFETY: zip reader on DecompressionStream, no CDN. Every offset is bounds-checked and nothing inflates past its
//   header's size (256MB total), so a hostile or damaged zip fails fast instead of eating the tab.
const ZIP_MAX=256*1024*1024;
async function unzip(blob){
  const buf=new Uint8Array(await blob.arrayBuffer()),dv=new DataView(buf.buffer),td=new TextDecoder(),len=buf.length;
  const fits=(at,n)=>at>=0&&at+n<=len;
  let e=len-22;while(e>=0&&dv.getUint32(e,true)!==0x06054b50)e--;
  if(e<0)throw new Error('not a zip');
  const count=dv.getUint16(e+10,true),out=[];let p=dv.getUint32(e+16,true),total=0;
  for(let i=0;i<count&&fits(p,46)&&dv.getUint32(p,true)===0x02014b50;i++){
    const method=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true),usize=dv.getUint32(p+24,true),nlen=dv.getUint16(p+28,true),xlen=dv.getUint16(p+30,true),clen=dv.getUint16(p+32,true),loff=dv.getUint32(p+42,true);
    if(!fits(p+46,nlen))break;
    const name=td.decode(buf.subarray(p+46,p+46+nlen));p+=46+nlen+xlen+clen;
    if(name.endsWith('/')||!fits(loff,30))continue;
    const start=loff+30+dv.getUint16(loff+26,true)+dv.getUint16(loff+28,true);if(!fits(start,csize))continue;
    const data=buf.subarray(start,start+csize);
    if((total+=usize)>ZIP_MAX)throw new Error('zip too large');
    if(method===0)out.push([name,data]);
    else if(method===8){
      const rd=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader(),parts=[];let got=0;
      for(;;){const {done,value}=await rd.read();if(done)break;got+=value.length;if(got>usize){rd.cancel();throw new Error('zip entry larger than it says')}parts.push(value)}
      const o=new Uint8Array(got);let k=0;for(const v of parts){o.set(v,k);k+=v.length}out.push([name,o]);
    }
  }
  return out;
}
async function unpack(list){
  const out=[];
  for(const it of list){
    if(extOf(it.path)!=='zip'){out.push(it);continue}
    try{
      for(const [p,bytes] of await unzip(it.file)){
        if(/(^|\/)(__MACOSX|\.)/.test(p))continue;
        const x=extOf(p);if(['obj','stl','glb','gltf','mtl'].includes(x)){out.push({path:p,file:new Blob([bytes])});continue}if(x==='css'||MD_EXT.has(x)||ASSET_EXT[x])out.push({path:p,file:new Blob([bytes],{type:x==='css'?'text/css':MD_EXT.has(x)?'text/markdown':ASSET_EXT[x]})});
      }
    }catch(e){status(`Could not open ${it.path}. Is it a zip file?`)}
  }
  return out;
}
async function ingest(list,dropAt){
  list=await unpack(list);
  // RULE: a dropped model takes its whole drop with it (its .mtl and texture images belong to it, not the page).
  if(state.project&&list.some(it=>M3D_EXT.test(it.path))){setWorkspace('model');await m3dLoadFiles(await Promise.all(list.map(async it=>({name:it.path,bytes:new Uint8Array(await it.file.arrayBuffer())}))));return}
  const css=[],imgs=[],mds=[],primTexts=[];let nAssets=0,scheme=null;
  for(const {path,file} of list){
    const x=extOf(path);
    if(x==='sf2'){await loadSoundFont(file);continue}
    if(x==='wsz'){if(state.project)await loadSkinFile(file);continue}
    // RULE: audio files become samples in the song open in Music (a new one if there is none).
    if(['wav','mp3','ogg','oga','flac','m4a'].includes(x)){if(state.project){setWorkspace('music');if(!state.music){state.music=newSong('Song 1')}await addSampleFile(file instanceof File?file:new File([file],path.split('/').pop()))}continue}
    if(x==='mid'||x==='midi'){if(state.project)await importMidi(file,dropAt&&$('#title').hidden?dropAt:null);continue}
    if(x==='css'||file.type==='text/css')css.push({path,text:await file.text()});
    else if(MD_EXT.has(x)){if(state.project&&$('#title').hidden){await addManuscript(path.split('/').pop(),await file.text());continue}mds.push({path,text:await file.text()})}
    else if(SCHEME_EXT.has(x)||/xresources$/i.test(path)){const txt=await file.text();
      if(x==='json'&&/"pixiwyg-primitives"/.test(txt)){primTexts.push(txt);continue}
      const sc=parseScheme(txt,path.split('/').pop().replace(/\.[^.]+$/,''));if(sc)scheme=sc}
    else if(ASSET_EXT[x]){const url=await readURL(file.type?file:new Blob([file],{type:ASSET_EXT[x]}));addAsset(path,url);nAssets++;if(ASSET_EXT[x].startsWith('image/'))imgs.push(url)}
  }
  let filled=0;
  if(nAssets)for(const f of state.files)if(f.missing&&f.missing.length){
    const before=f.missing.length,r=bake(f.text,f.path||f.name,new Map());
    if(r.baked){f.text=r.text;f.missing=r.missing;f.remote=[...new Set([...(f.remote||[]),...r.remote])];f.baked=(f.baked||0)+r.baked;compileFile(f);filled+=before-f.missing.length}
  }
  const byPath=new Map(css.map(c=>[normPath(c.path),c]));
  const results=css.map(c=>({c,r:bake(c.text,c.path,byPath)}));
  let added=0,baked=0,missing=0;const fresh=[];
  for(const {c,r} of results){
    if(c.imported)continue;
    const f={id:nid('f'),name:c.path.split('/').pop(),text:r.text,path:c.path,missing:r.missing,remote:r.remote,baked:r.baked,enabled:true,sample:false};
    compileFile(f);state.files.push(f);fresh.push(f);added++;baked+=r.baked;missing+=r.missing.length;
  }
  const parts=[];
  if(added||filled){
    afterFilesChanged();audio();sfx('boing');
    if(added)parts.push(`Added ${added} stylesheet${added>1?'s':''}`);
    if(baked)parts.push(`baked in ${baked} file${baked>1?'s':''}`);
    if(filled)parts.push(`filled ${filled} missing file${filled>1?'s':''}`);
    if(missing)parts.push(`${missing} file${missing>1?'s':''} still missing. Drop them in to finish`);
  }
  for(const [k,m] of mds.entries()){
    const n=importMarkdown(m.text,{at:dropAt?{x:dropAt.x+k*24,y:dropAt.y+k*24}:null,path:m.path,sheet:fresh[0]?fresh[0].id:mdOpt.sheet,width:mdOpt.width});
    parts.push(`imported ${n} block${n===1?'':'s'} from ${m.path.split('/').pop()}`);
  }
  if(scheme){setPalette({...scheme,custom:true});parts.push(`palette set to ${scheme.name}`)}
  for(const t of primTexts){const n=importPrimText(t);if(n)parts.push(`imported ${n} primitive${n>1?'s':''}`)}
  if(parts.length){const t=parts.join(' · ');status(t[0].toUpperCase()+t.slice(1));return}
  if(imgs.length&&dropAt){
    for(const [i,u] of imgs.entries())placeElement('img',dropAt.x+i*20,dropAt.y+i*20,null,u);
    state.activeTag='img';renderPalette();renderStyles();return;
  }
  if(nAssets)status(`Kept ${nAssets} font and image file${nAssets>1?'s':''}. Stylesheets and Markdown added next will use them.`);
  else if(list.length)status('Nothing to add. Drop CSS, Markdown, folders or a .zip.');
}
for(const id of ['cssIn','dirIn'])$('#'+id).onchange=async e=>{const files=[...e.target.files].map(f=>({path:f.webkitRelativePath||f.name,file:f}));e.target.value='';await ingest(files,null)};
const imgIn=document.createElement('input');imgIn.type='file';imgIn.accept='image/*';imgIn.id='imgIn';imgIn.className='sr';document.body.append(imgIn);
imgIn.onchange=async()=>{const el=selected();const file=imgIn.files[0];imgIn.value='';if(!el||el.tag!=='img'||!file)return;pushUndo();el.content=await readURL(file);renderEl(el);updateSel();save()};
async function dropEntries(dt){
  // HACK: DataTransfer entries must be read before the first await or the browser drops them.
  const roots=[...(dt.items||[])].map(i=>i.webkitGetAsEntry&&i.webkitGetAsEntry()).filter(Boolean);
  const plain=[...(dt.files||[])].map(f=>({path:f.name,file:f}));
  if(!roots.length)return plain;
  const out=[];
  const walk=async(en,prefix)=>{
    if(en.isFile){try{out.push({path:prefix+en.name,file:await new Promise((res,rej)=>en.file(res,rej))})}catch(e){}}
    else if(en.isDirectory){const rd=en.createReader();let batch;do{batch=await new Promise((res,rej)=>rd.readEntries(res,rej));for(const c of batch)await walk(c,prefix+en.name+'/')}while(batch.length)}
  };
  for(const en of roots)await walk(en,'');
  return out;
}
window.addEventListener('dragover',e=>{e.preventDefault()});
window.addEventListener('drop',async e=>{e.preventDefault();if(!e.dataTransfer||panelDrag||innerDrag)return;
  const onStage=stage.contains(e.target),at=onStage?pt(e):null;
  const list=await dropEntries(e.dataTransfer);if(!list.length)return;
  const pf=list.length===1&&await isProjectFile(list[0].file,list[0].path);
  if(pf){await openProjectFile(list[0].file,list[0].path);return}
  if(!$('#title').hidden){status('Drop a .pixiwyg project file here to open it');return}
  await ingest(list,at);
});


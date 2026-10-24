// SECTION: browser storage (IndexedDB)
let dbP=null;
// FORMAT: v1 = projects (index + files); v2 adds kv (primitives library, thumbnails, soundfont); v3 adds blobs: asset
//   bytes keyed by their content-hashed path (assets/<hash>.<ext>), shared by every project that uses them. A files
//   record holds the text files and lists its blob paths. v2 records with bytes inline still read. v4 adds versions:
//   named checkpoints {id, project, name, created, files, blobs}, sharing the same blobs.
function idb(){return dbP||(dbP=new Promise((res,rej)=>{let r;try{r=indexedDB.open('pixiwyg',4)}catch(e){rej(e);return}
  r.onupgradeneeded=()=>{const d=r.result;for(const n of ['index','files'])if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:'id'});for(const n of ['kv','blobs'])if(!d.objectStoreNames.contains(n))d.createObjectStore(n);if(!d.objectStoreNames.contains('versions'))d.createObjectStore('versions',{keyPath:'id'}).createIndex('project','project')};
  r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}))}
async function tx(names,mode,fn){const d=await idb();return new Promise((res,rej)=>{const t=d.transaction(names,mode);let out;const q=fn(...names.map(n=>t.objectStore(n)));if(q)q.onsuccess=()=>{out=q.result};t.oncomplete=()=>res(out);t.onerror=t.onabort=()=>rej(t.error)})}
const listProjects=()=>tx(['index'],'readonly',s=>s.getAll()).then(l=>l.sort((a,b)=>b.modified-a.modified)).catch(()=>[]);
const isBlobPath=(k,v)=>typeof v!=='string'&&/^assets\//.test(k);
async function storedFiles(id){
  const r=await tx(['files'],'readonly',s=>s.get(id));if(!r)return null;
  const out=new Map(Object.entries(r.files));if(!Array.isArray(r.blobs)||!r.blobs.length)return out;
  const got={};await tx(['blobs'],'readonly',b=>{for(const k of r.blobs){const q=b.get(k);q.onsuccess=()=>{got[k]=q.result}}});
  for(const k of r.blobs)if(got[k])out.set(k,got[k]);
  return out;
}
// PERF: autosave writes only blobs this browser doesn't hold yet; before v3 every save structured-cloned every asset
//   (143ms per save at 126MB of images).
let blobKnown=null;
async function putProject(meta,files){
  if(!blobKnown)blobKnown=new Set(await tx(['blobs'],'readonly',b=>b.getAllKeys()).catch(()=>[]));
  const text={},paths=[],fresh=[];
  for(const [k,v] of files){if(isBlobPath(k,v)){paths.push(k);if(!blobKnown.has(k))fresh.push([k,v])}else text[k]=v}
  // INVARIANT: blobKnown is only a hint; a known path is re-checked inside the write so a concurrent gcBlobs can't
  //   leave this record pointing at a deleted blob.
  await tx(['index','files','blobs'],'readwrite',(i,f,b)=>{for(const [k,v] of fresh)b.put(v,k);
    for(const [k,v] of files)if(isBlobPath(k,v)&&blobKnown.has(k)){const q=b.getKey(k);q.onsuccess=()=>{if(q.result===undefined)b.put(v,k)}}
    i.put(meta);f.put({id:meta.id,files:text,blobs:paths})});
  for(const [k] of fresh)blobKnown.add(k);
}
// INVARIANT: a blob lives while any files record lists it; swept after a delete and once per boot.
async function gcBlobs(){
  const dead=[];
  await tx(['files','versions','blobs'],'readwrite',(f,v,b)=>{const used=new Set(),walk=(st,then)=>{const c=st.openCursor();
      c.onsuccess=()=>{const x=c.result;if(x){for(const k of x.value.blobs||[])used.add(k);x.continue();return}then()}};
    walk(f,()=>walk(v,()=>{const kq=b.getAllKeys();kq.onsuccess=()=>{for(const k of kq.result)if(!used.has(k)){b.delete(k);dead.push(k)}}}))});
  if(blobKnown)for(const k of dead)blobKnown.delete(k);
  return dead.length;
}
const dropProject=id=>tx(['index','files','versions'],'readwrite',(i,f,v)=>{i.delete(id);f.delete(id);const c=v.index('project').openKeyCursor(IDBKeyRange.only(id));c.onsuccess=()=>{const x=c.result;if(x){v.delete(x.primaryKey);x.continue()}}}).then(()=>gcBlobs().catch(()=>0));

// SECTION: frames
// COMPAT: a flipbook leaves the studio as APNG, which every browser plays in a plain <img> with no script: on the
//   page, in exports, in thumbnails. Reopened, an APNG decodes back into frames.
const PNG_SIG=[137,80,78,71,13,10,26,10];
function pngChunks(b){
  const out=[],dv=new DataView(b.buffer,b.byteOffset,b.byteLength);let i=8;
  for(let k=0;k<4096&&i+12<=b.length;k++){const len=dv.getUint32(i),type=String.fromCharCode(b[i+4],b[i+5],b[i+6],b[i+7]);if(i+12+len>b.length)break;out.push({type,data:b.subarray(i+8,i+8+len)});i+=12+len;if(type==='IEND')break}
  return out;
}
function pngChunk(type,data){
  const out=new Uint8Array(12+data.length),dv=new DataView(out.buffer);dv.setUint32(0,data.length);
  for(let k=0;k<4;k++)out[4+k]=type.charCodeAt(k);out.set(data,8);dv.setUint32(8+data.length,crc32(out.subarray(4,8+data.length)));return out;
}
const u32be=(...v)=>{const b=new Uint8Array(v.length*4),dv=new DataView(b.buffer);v.forEach((x,i)=>dv.setUint32(i*4,x));return b};
const isPngSig=b=>b.length>8&&PNG_SIG.every((x,i)=>b[i]===x);
// INVARIANT: urls are same-size PNG data URLs.
function encodeAPNG(urls,fps){
  const pngs=urls.map(u=>b64bytes(u.slice(u.indexOf(',')+1))),first=pngChunks(pngs[0]),ihdr=first.find(c=>c.type==='IHDR').data;
  const w=new DataView(ihdr.buffer,ihdr.byteOffset).getUint32(0),h=new DataView(ihdr.buffer,ihdr.byteOffset).getUint32(4);
  const parts=[new Uint8Array(PNG_SIG),pngChunk('IHDR',ihdr),pngChunk('acTL',u32be(pngs.length,0))];let seq=0;
  const fcTL=()=>{const d=new Uint8Array(26),dv=new DataView(d.buffer);dv.setUint32(0,seq++);dv.setUint32(4,w);dv.setUint32(8,h);dv.setUint32(12,0);dv.setUint32(16,0);dv.setUint16(20,1);dv.setUint16(22,Math.max(1,Math.round(fps)));d[24]=0;d[25]=0;return pngChunk('fcTL',d)};
  pngs.forEach((p,k)=>{
    parts.push(fcTL());
    for(const c of pngChunks(p))if(c.type==='IDAT'){if(!k)parts.push(pngChunk('IDAT',c.data));else{const d=new Uint8Array(4+c.data.length);new DataView(d.buffer).setUint32(0,seq++);d.set(c.data,4);parts.push(pngChunk('fdAT',d))}}
  });
  parts.push(pngChunk('IEND',new Uint8Array(0)));
  const n=parts.reduce((a,p)=>a+p.length,0),all=new Uint8Array(n);let o=0;for(const p of parts){all.set(p,o);o+=p.length}
  return'data:image/png;base64,'+bytesB64(all);
}
// COMPAT: composited with dispose/blend as a player would, so any third-party APNG decodes. null for a still.
async function decodeAPNG(url){
  if(!/^data:image\/(a?png);base64,/i.test(url))return null;
  const b=b64bytes(url.slice(url.indexOf(',')+1));if(!isPngSig(b))return null;
  const cs=pngChunks(b);if(!cs.some(c=>c.type==='acTL'))return null;
  const ihdr=cs.find(c=>c.type==='IHDR').data,iv=new DataView(ihdr.buffer,ihdr.byteOffset),W0=iv.getUint32(0),H0=iv.getUint32(4);
  const pre=cs.filter(c=>['PLTE','tRNS','gAMA','cHRM','sRGB','iCCP'].includes(c.type));
  const frames=[];let cur=null;
  for(const c of cs){
    if(c.type==='fcTL'){const v=new DataView(c.data.buffer,c.data.byteOffset);cur={w:v.getUint32(4),h:v.getUint32(8),x:v.getUint32(12),y:v.getUint32(16),dn:v.getUint16(20),dd:v.getUint16(22)||100,dispose:c.data[24],blend:c.data[25],data:[]};frames.push(cur)}
    else if(c.type==='IDAT'&&cur)cur.data.push(c.data);else if(c.type==='fdAT'&&cur)cur.data.push(c.data.subarray(4));
    if(frames.length>240)break;
  }
  const canvas=document.createElement('canvas');canvas.width=W0;canvas.height=H0;const x=canvas.getContext('2d'),out=[];
  for(const f of frames){
    if(!f.data.length)continue;
    const hd=new Uint8Array(ihdr);const hv=new DataView(hd.buffer);hv.setUint32(0,f.w);hv.setUint32(4,f.h);
    const png=[new Uint8Array(PNG_SIG),pngChunk('IHDR',hd),...pre.map(c=>pngChunk(c.type,c.data)),...f.data.map(d=>pngChunk('IDAT',d)),pngChunk('IEND',new Uint8Array(0))];
    const img=new Image();img.src=URL.createObjectURL(new Blob(png,{type:'image/png'}));try{await img.decode()}catch(e){URL.revokeObjectURL(img.src);continue}
    const before=f.dispose===2?x.getImageData(f.x,f.y,f.w,f.h):null;
    if(f.blend===0)x.clearRect(f.x,f.y,f.w,f.h);x.drawImage(img,f.x,f.y);URL.revokeObjectURL(img.src);
    out.push(canvas.toDataURL('image/png'));
    if(f.dispose===1)x.clearRect(f.x,f.y,f.w,f.h);else if(before)x.putImageData(before,f.x,f.y);
  }
  const fd=frames[0];return out.length>1?{frames:out,fps:Math.max(1,Math.min(60,Math.round(fd.dd/Math.max(1,fd.dn)))),w:W0,h:H0}:null;
}
// PERF: only the current frame lives on the canvas; the others are kept as PNG data URLs.
Object.assign(studio,{frames:[{cels:{},url:null}],fi:0,fps:8,onion:true,playT:0});
const onion=$('#onion'),octx=onion.getContext('2d');
function saveFrame(){const f=studio.frames[studio.fi];f.cels={};for(const L of studio.layers){const u=layerURL(L);if(u)f.cels[L.id]=u}f.url=sBlank()?null:flatURL();f.stale=false;f.undo=studio.undo;f.redo=studio.redo}
async function goFrame(i,{keep}={}){
  if(!keep)saveFrame();
  studio.fi=Math.max(0,Math.min(studio.frames.length-1,i));const f=studio.frames[studio.fi];
  await Promise.all(studio.layers.map((L,k)=>drawInto(L.c,f.cels?f.cels[L.id]:k?null:f.url)));studio.undo=f.undo||[];studio.redo=f.redo||[];
  drawOnion();drawStrip();layerThumbs(true);fxRefresh();
}
// RULE: the UV guide sits over the paint, never in it: it shows only while a 3D texture is open and never exports.
const sguide=$('#sguide'),gctx=sguide.getContext('2d');
function drawGuide(){
  sguide.width=paint.width;sguide.height=paint.height;gctx.clearRect(0,0,sguide.width,sguide.height);if(!studio.guide)return;
  const img=new Image();img.onload=()=>{if(studio.guide){gctx.clearRect(0,0,sguide.width,sguide.height);gctx.drawImage(img,0,0,sguide.width,sguide.height)}};img.src=studio.guide;
}
function drawOnion(){
  onion.width=paint.width;onion.height=paint.height;octx.clearRect(0,0,onion.width,onion.height);
  const p=studio.frames[studio.fi-1];if(!studio.onion||!p)return;if(p.stale){freshFlats().then(drawOnion);return}if(!p.url)return;
  const img=new Image();img.onload=()=>{octx.clearRect(0,0,onion.width,onion.height);octx.drawImage(img,0,0,onion.width,onion.height)};img.src=p.url;
}
function drawStrip(){
  const box=$('#fStrip');box.replaceChildren();const n=studio.frames.length;
  studio.frames.forEach((f,i)=>{const b=mkEl('button',{type:'button',className:'fthumb'+(i===studio.fi?' on':''),title:`Frame ${i+1}`});b.setAttribute('aria-label',`Frame ${i+1}`);
    const url=i===studio.fi?(sBlank()?null:flatURL()):f.url;if(url)b.append(mkEl('img',{src:url,alt:''}));b.append(mkEl('span',{textContent:i+1}));
    b.onclick=()=>{audio();if(i!==studio.fi)goFrame(i)};box.append(b)});
  $('#fPos').textContent=`${studio.fi+1} / ${n}`;$('#fDel').disabled=n<2;$('#fPlay').disabled=n<2;
  // RULE: with frames, nothing changes the drawing's size: every frame must stay the same size.
  for(const id of ['sTrim','sRotL','sRotR','sHalf','sDouble','selCrop'])$('#'+id).disabled=n>1;
  if(studio.frames.some((f,i)=>i!==studio.fi&&f.stale))freshFlats().then(drawStrip);
  $('#frames').classList.toggle('many',n>1);
}
const thumbNow=()=>{const b=$('#fStrip').children[studio.fi];if(!b)return;b.querySelector('img')?.remove();if(!sBlank())b.prepend(mkEl('img',{src:flatURL(),alt:''}))};
async function addFrame(blank){stopFrames();saveFrame();const f=studio.frames[studio.fi];studio.frames.splice(studio.fi+1,0,blank?{cels:{},url:null}:{cels:{...f.cels},url:f.url});await goFrame(studio.fi+1,{keep:true});status(`Frame ${studio.fi+1} of ${studio.frames.length}${blank?'':', a copy of the last'}`)}
async function delFrame(){if(studio.frames.length<2)return;stopFrames();studio.frames.splice(studio.fi,1);await goFrame(Math.min(studio.fi,studio.frames.length-1),{keep:true})}
function resetFrames(){stopFrames();studio.frames=[{cels:{},url:null}];studio.fi=0;drawOnion();drawStrip()}
function stopFrames(){if(!studio.playT)return;clearInterval(studio.playT);studio.playT=0;slayers.style.visibility='';onion.style.opacity='';drawOnion();$('#fPlay').textContent='▶ Play'}
async function playFrames(){
  if(studio.playT){stopFrames();return}if(studio.frames.length<2)return;saveFrame();await freshFlats();if(studio.playT)return;
  const imgs=studio.frames.map(f=>{const i=new Image();if(f.url)i.src=f.url;return i});let k=0;
  slayers.style.visibility='hidden';onion.style.opacity='1';$('#fPlay').textContent='■ Stop';
  const show=()=>{octx.clearRect(0,0,onion.width,onion.height);const i=imgs[k%imgs.length];if(i.src)octx.drawImage(i,0,0,onion.width,onion.height);k++};
  show();studio.playT=setInterval(show,1000/studio.fps);
}
async function studioOutput(){if(studio.frames.length<2)return flatURL();saveFrame();await freshFlats();const urls=studio.frames.map(f=>f.url||blankFrame());return encodeAPNG(urls,studio.fps)}
const blankFrame=()=>{const c=document.createElement('canvas');c.width=paint.width;c.height=paint.height;return c.toDataURL('image/png')};
const anyPaint=()=>{const ids=visibleIds(),cur=!layerBlank(flatCanvas());return studio.frames.length>1?studio.frames.some((f,i)=>i===studio.fi?cur:Object.entries(f.cels||{}).some(([id,u])=>u&&ids.has(id))):cur};
$('#fAdd').onclick=e=>{audio();addFrame(e.shiftKey)};
$('#fBlank').onclick=()=>{audio();addFrame(true)};
$('#fDel').onclick=()=>{audio();delFrame()};
$('#fPrev').onclick=()=>{audio();stopFrames();goFrame((studio.fi-1+studio.frames.length)%studio.frames.length)};
$('#fNext').onclick=()=>{audio();stopFrames();goFrame((studio.fi+1)%studio.frames.length)};
$('#fPlay').onclick=()=>{audio();playFrames()};
$('#fFps').onchange=e=>{studio.fps=+e.target.value||8;if(studio.playT){stopFrames();playFrames()}};
$('#fOnion').onchange=e=>{studio.onion=e.target.checked;drawOnion()};


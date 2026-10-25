// SECTION: songs as audio files (MP3)
// RULE: a song exports as it plays: rendered offline by the same synth (or the loaded SoundFont) through every track's
//   effects, with two seconds more for reverbs and releases to ring out, then encoded at 192 kbps stereo by the
//   vendored lamejs (LGPL, lib/lame.min.js), which loads only when a song is first exported. Encoding goes a slice at
//   a time, yielding between slices, so the page keeps responding and the status line counts up.
let lameP=null;
function needLame(){return window.lamejs?Promise.resolve():(lameP||(lameP=new Promise((res,rej)=>{const s=document.createElement('script');s.src='lib/lame.min.js';s.onload=()=>res();s.onerror=()=>{lameP=null;rej(new Error('The MP3 encoder couldn’t be loaded.'))};document.head.append(s)})))}
const sfRender=()=>soundfont?(ctx,out,syn)=>(t,p,at,d,v,dest)=>{if(!sfPlay(t,p,at,d,v,dest||out,ctx))syn.note(t,p,at,d,v,dest)}:null;
async function songMp3(m,{kbps=192,tail=2,onProgress}={}){
  await needLame();
  const buf=await pxRender(m,GMV,sfRender(),tail),sr=buf.sampleRate,L=buf.getChannelData(0),R=buf.numberOfChannels>1?buf.getChannelData(1):L;
  const enc=new lamejs.Mp3Encoder(2,sr,kbps),parts=[],block=1152*16,l16=new Int16Array(block),r16=new Int16Array(block);
  // PERF: one pair of Int16 buffers reused for every slice; samples clamp to ±1 before scaling.
  const fill=(src,dst,i,n)=>{for(let k=0;k<n;k++){const v=src[i+k];dst[k]=v<-1?-32768:v>1?32767:v<0?v*32768:v*32767}};
  for(let i=0,n=0;i<L.length;i+=block,n++){const c=Math.min(block,L.length-i);fill(L,l16,i,c);fill(R,r16,i,c);
    const d=enc.encodeBuffer(l16.subarray(0,c),r16.subarray(0,c));if(d.length)parts.push(d);
    if(n%8===7){if(onProgress)onProgress(i/L.length);await new Promise(r=>setTimeout(r))}}
  const f=enc.flush();if(f.length)parts.push(f);
  return new Blob(parts,{type:'audio/mpeg'});
}
async function saveMp3(){
  const m=state.music;if(!m)return;
  if(!m.tracks.some(t=>t.notes.length)){status(`“${m.name}” has no notes yet.`);return}
  const btn=$('#seqMp3');btn.disabled=true;status('Rendering the song…');
  try{
    if((m.samples||[]).length)await samplesReady(m);
    const blob=await songMp3(m,{onProgress:p=>status(`Encoding MP3… ${Math.round(p*100)}%`)}),name=slug(m.name||'song')+'.mp3';
    download(blob,name);status(`Saved ${name} (${(blob.size/1048576).toFixed(1)} MB)`);
  }catch(e){logErr('mp3',e.message,e.stack);status(e.message||'The song couldn’t be exported.')}
  finally{btn.disabled=false}
}
$('#seqMp3').onclick=()=>{audio();saveMp3()};

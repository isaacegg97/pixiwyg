// SECTION: SoundFonts
// RULE: one SoundFont at a time, kept with the app, never in projects (hundreds of MB; a .mid carries none either).
// SAFETY: read only as numbers and samples; every offset is bounds-checked.
const SF_MAX=768*1024*1024;
let soundfont=null,sfTried=false;
const sfStats={voices:0};
function parseSF2(buf){
  const N=buf.byteLength,dv=new DataView(buf),u8=new Uint8Array(buf),bad=m=>{throw new Error(m)};
  const id=o=>String.fromCharCode(u8[o],u8[o+1],u8[o+2],u8[o+3]);
  if(N<12||id(0)!=='RIFF'||id(8)!=='sfbk')bad('This isn’t a SoundFont (.sf2) file.');
  const ck={};
  const walk=(o,end,depth)=>{
    while(o+8<=end){const c=id(o),len=dv.getUint32(o+4,true),body=o+8;if(body+len>end)bad('The SoundFont is cut short.');
      if(c==='LIST'&&depth<2)walk(body+4,body+len,depth+1);else if(!ck[c])ck[c]={o:body,len};o=body+len+(len&1)}};
  walk(12,Math.min(N,8+dv.getUint32(4,true)),0);
  const str=(o,n)=>{let s='';for(let i=0;i<n&&o+i<N&&u8[o+i];i++)s+=String.fromCharCode(u8[o+i]);return s.replace(/[^\x20-\x7e]/g,'').trim()};
  const rec=(c,size)=>{const k=ck[c]||bad('The SoundFont is missing its '+c+' table.');return{o:k.o,n:Math.floor(k.len/size)}};
  const P=rec('phdr',38),PB=rec('pbag',4),PG=rec('pgen',4),I=rec('inst',22),IB=rec('ibag',4),IG=rec('igen',4),S=rec('shdr',46);
  const SM=ck.smpl||bad('The SoundFont has no samples.');
  if(P.n>65536||I.n>65536||S.n>65536||PG.n>1e6||IG.n>1e6)bad('The SoundFont’s tables are too large.');
  // FORMAT: generator amounts: ranges are two bytes, instrument/sample ids unsigned, the rest signed.
  const gens=(G,from,to)=>{const g={};for(let i=from;i<to&&i<G.n;i++){const o=G.o+i*4,op=dv.getUint16(o,true);
    g[op]=op===43||op===44?[u8[o+2],u8[o+3]]:op===41||op===53?dv.getUint16(o+2,true):dv.getInt16(o+2,true)}return g};
  const bagAt=(B,b)=>b<B.n?dv.getUint16(B.o+b*4,true):0;
  // FORMAT: a zone list's first zone is global when it lacks the terminal generator (instrument or sampleID).
  const zones=(B,G,from,to,term)=>{const zs=[];for(let b=from;b<to&&b+1<B.n;b++)zs.push(gens(G,bagAt(B,b),bagAt(B,b+1)));
    const glob=zs.length&&zs[0][term]==null?zs.shift():{};return{glob,zones:zs.filter(z=>z[term]!=null)}};
  const inst=[];for(let i=0;i+1<I.n;i++){const o=I.o+i*22;inst.push({name:str(o,20),...zones(IB,IG,dv.getUint16(o+20,true),dv.getUint16(o+42,true),53)})}
  const presets=[];for(let i=0;i+1<P.n;i++){const o=P.o+i*38;presets.push({name:str(o,20)||'Preset',prog:dv.getUint16(o+20,true)&127,bank:dv.getUint16(o+22,true),...zones(PB,PG,dv.getUint16(o+24,true),dv.getUint16(o+62,true),41)})}
  const total=SM.len>>1;
  const samples=[];for(let i=0;i+1<S.n;i++){const o=S.o+i*46;
    samples.push({start:Math.min(total,dv.getUint32(o+20,true)),end:Math.min(total,dv.getUint32(o+24,true)),ls:dv.getUint32(o+28,true),le:dv.getUint32(o+32,true),
      rate:Math.max(3000,Math.min(192000,dv.getUint32(o+36,true)||44100)),pitch:u8[o+40],corr:dv.getInt8(o+41)})}
  // HACK: Int16Array needs 2-byte alignment; an odd-offset smpl chunk is copied first.
  const pcm=SM.o%2?new Int16Array(buf.slice(SM.o,SM.o+total*2)):new Int16Array(buf,SM.o,total);
  const byKey=new Map();for(const p of presets){const k=p.bank*128+p.prog;if(!byKey.has(k))byKey.set(k,p)}
  return{name:str((ck.INAM||{o:0}).o,Math.min(256,(ck.INAM||{len:0}).len))||'SoundFont',presets,inst,samples,pcm,byKey,bufs:new Map()};
}
// RULE: a track's preset is its program in bank 0 (else any bank); drum kits come from bank 128.
function sfPreset(sf,t){
  if(t.drums)return sf.byKey.get(128*128+t.prog)||sf.byKey.get(128*128)||sf.presets.find(p=>p.bank===128)||null;
  return sf.byKey.get(t.prog)||sf.presets.find(p=>p.bank!==128&&p.prog===t.prog)||null;
}
// FORMAT: generators a preset adds to its instrument's value instead of replacing it.
const SF_ADD=new Set([8,9,17,34,35,36,37,38,48,51,52]);
function sfPlay(t,p,at,dur,vel,out,ctx=ac){
  const sf=soundfont,preset=sfPreset(sf,t);if(!preset)return false;
  const inR=(g,k,x)=>!g[k]||(x>=g[k][0]&&x<=g[k][1]);let any=false;
  for(const pz of preset.zones){const pg={...preset.glob,...pz};if(!inR(pg,43,p)||!inR(pg,44,vel))continue;const ins=sf.inst[pz[41]];if(!ins)continue;
    for(const iz of ins.zones){const ig={...ins.glob,...iz};if(!inR(ig,43,p)||!inR(ig,44,vel))continue;const smp=sf.samples[iz[53]];if(!smp)continue;
      if(sfVoice(sf,t,p,at,dur,vel,out,ig,pg,smp,ctx))any=true}}
  return any;
}
function sfVoice(sf,t,p,at,dur,vel,out,ig,pg,smp,ctx){
  const G=(op,def)=>(ig[op]??def)+(SF_ADD.has(op)?(pg[op]??0):0),tc=x=>Math.pow(2,x/1200),total=sf.pcm.length;
  const s0=Math.max(0,Math.min(total,smp.start+G(0,0)+G(4,0)*32768)),s1=Math.max(0,Math.min(total,smp.end+G(1,0)+G(12,0)*32768));
  if(s1-s0<4)return false;
  const key=s0+':'+s1+':'+smp.rate;let b=sf.bufs.get(key);
  if(!b){b=ctx.createBuffer(1,s1-s0,smp.rate);const d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=sf.pcm[s0+i]/32768;sf.bufs.set(key,b)}
  const src=ctx.createBufferSource();src.buffer=b;
  const root=ig[58]!=null&&ig[58]>=0&&ig[58]<128?ig[58]:smp.pitch<128?smp.pitch:60;
  src.playbackRate.value=tc((p-root)*G(56,100)+G(51,0)*100+G(52,0)+smp.corr);
  const mode=G(54,0)&3;
  if(mode===1||mode===3){const ls=(smp.ls+G(2,0)+G(45,0)*32768-s0)/smp.rate,le=(smp.le+G(3,0)+G(50,0)*32768-s0)/smp.rate;
    if(ls>=0&&le>ls+.001&&le<=b.duration){src.loop=true;src.loopStart=ls;src.loopEnd=le}}
  // COMPAT: attenuation is centibels scaled by 0.4, as FluidSynth and most players do, not as the spec reads.
  const amp=Math.pow(10,-Math.max(0,G(48,0))*.4/200)*(vel/127)*(t.vol/127),end=at+dur;
  const A=Math.max(.001,tc(G(34,-12000))),H=tc(G(35,-12000)),D=Math.max(.001,tc(G(36,-12000))),S=Math.pow(10,-Math.max(0,Math.min(1440,G(37,0)))/200),R=Math.max(.01,Math.min(8,tc(G(38,-12000))));
  const g=ctx.createGain();g.gain.setValueAtTime(0,at);
  const peak=Math.min(end,at+A);g.gain.linearRampToValueAtTime(amp*(peak-at)/A,peak);
  if(at+A+H<end){g.gain.setValueAtTime(amp,at+A+H);g.gain.setTargetAtTime(amp*S,at+A+H,D/5)}
  g.gain.setTargetAtTime(0,end,R/5);
  let node=src;
  const fc=G(8,13500);if(fc<13500){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.value=Math.min(20000,8.176*tc(fc));f.Q.value=Math.max(.0001,G(9,0)/10);node.connect(f);node=f}
  node.connect(g);
  const pan=Math.max(-1,Math.min(1,G(17,0)/500));
  if(pan&&ctx.createStereoPanner){const pn=ctx.createStereoPanner();pn.pan.value=pan;g.connect(pn);pn.connect(out)}else g.connect(out);
  src.start(at);src.stop(end+R+.05);sfStats.voices++;
  return true;
}
async function loadSoundFont(file){
  if(file.size>SF_MAX){status(`That SoundFont is ${(file.size/1048576).toFixed(0)} MB; the most PIXIWYG keeps is ${SF_MAX/1048576} MB.`);return false}
  status('Reading '+file.name+'…');
  let sf;try{sf=parseSF2(await file.arrayBuffer())}catch(e){status(e.message||'That SoundFont couldn’t be read.');return false}
  sf.file=file.name;soundfont=sf;sfTried=true;
  try{await tx(['kv'],'readwrite',s=>{s.put({name:file.name,blob:file},'soundfont')})}catch(e){status('Loaded '+file.name+' for now, but there wasn’t room to keep it for next time.')}
  sfSync();if(!$('#seqModal').hidden)seqTracks();
  status(`Using ${sf.name}: ${sf.presets.length} instruments`);return true;
}
async function sfRestore(){
  if(sfTried)return;sfTried=true;
  try{const r=await tx(['kv'],'readonly',s=>s.get('soundfont'));if(r&&r.blob){soundfont=parseSF2(await r.blob.arrayBuffer());soundfont.file=r.name}}catch(e){soundfont=null}
  sfSync();if(!$('#seqModal').hidden)seqTracks();
}
async function sfForget(){soundfont=null;try{await tx(['kv'],'readwrite',s=>{s.delete('soundfont')})}catch(e){}sfSync();seqTracks();status('Back to the built-in synth')}
function sfSync(){
  const n=$('#seqSfName');if(!n)return;
  n.textContent=soundfont?soundfont.file:'Built-in synth';n.title=soundfont?`${soundfont.name} · ${soundfont.presets.length} instruments`:'A simple synth. Load a SoundFont (.sf2) for sampled instruments.';
  $('#seqSfOff').hidden=!soundfont;
}
$('#seqSfLoad').onclick=()=>{audio();$('#seqSfFile').click()};
$('#seqSfFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)await loadSoundFont(f)};
$('#seqSfOff').onclick=()=>{audio();sfForget()};


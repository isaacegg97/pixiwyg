// SECTION: sequencer effects and samples
// RULE: native Web Audio only (see the research report): every effect is built from the browser's own nodes, and
//   samples are decoded by the browser (WAV, MP3, OGG, FLAC in Chromium). The same builder runs live, in WAV export
//   and in the exported page's player, so a song sounds the same everywhere.
// FORMAT: track.fx / song.fx = [{k, on, ...params}] run top to bottom; song.samples = [{id, name, url (data:audio)}];
//   a sample track has smp (a sample id), root (MIDI note the file was recorded at), pitched (follow the notes),
//   gate (cut at note-off; otherwise the sample rings out).
const FX_DEFS={
  eq:{name:'EQ',p:[['low','Low (dB)',-18,18,.5,0],['mid','Mid (dB)',-18,18,.5,0],['high','High (dB)',-18,18,.5,0]]},
  filter:{name:'Filter',p:[['type','Type',['lowpass','highpass','bandpass'],'lowpass'],['freq','Frequency (Hz)',40,18000,10,1200],['q','Resonance',.1,20,.1,1]]},
  comp:{name:'Compressor',p:[['thr','Threshold (dB)',-60,0,1,-24],['ratio','Ratio',1,20,.5,4],['att','Attack (ms)',0,200,1,5],['rel','Release (ms)',10,1000,5,200],['gain','Make-up (dB)',0,24,.5,4]]},
  drive:{name:'Drive',p:[['amt','Amount',0,1,.01,.3],['mix','Mix',0,1,.01,1]]},
  chorus:{name:'Chorus',p:[['rate','Rate (Hz)',.05,8,.05,1.2],['depth','Depth',0,1,.01,.5],['mix','Mix',0,1,.01,.5]]},
  delay:{name:'Delay',p:[['ms','Time (ms)',20,2000,5,375],['fb','Feedback',0,.95,.01,.35],['mix','Mix',0,1,.01,.3]]},
  reverb:{name:'Reverb',p:[['sec','Length (s)',.2,8,.1,2.2],['decay','Decay',.5,8,.1,3],['mix','Mix',0,1,.01,.3]]},
  pan:{name:'Pan',p:[['pan','Left ↔ right',-1,1,.01,0]]},
  // RULE: the pump isn't in the chain: each voice ducks on the song's beats as it starts (pxSynth's duck), synth notes,
  //   SoundFont voices and samples alike.
  pump:{name:'Sidechain pump',p:[['depth','Depth',0,1,.01,.7],['rate','Pumps a beat',.5,4,.5,1]]},
  crush:{name:'Bitcrush',p:[['bits','Bits',2,16,1,6],['mix','Mix',0,1,.01,.6]]},
};
const FX_MAX=8,SMP_MAX=24,SMP_BYTES=24*1024*1024;
// INVARIANT: self-contained (exports carry its source). Connects input through the chain to dest; returns the
//   oscillators it started (chorus LFOs), so a live chain can be stopped when it is rebuilt.
function pxFx(ctx,input,chain,dest){
  let cur=input;const oscs=[];
  const wetDry=(into,from,mix,out)=>{const d=ctx.createGain(),w=ctx.createGain();d.gain.value=1-mix;w.gain.value=mix;cur.connect(d);d.connect(out);cur.connect(into);from.connect(w);w.connect(out)};
  const bq=(type,f,q,g)=>{const b=ctx.createBiquadFilter();b.type=type;b.frequency.value=f;b.Q.value=q;b.gain.value=g;return b};
  for(const f of chain||[]){
    if(!f||f.on===false)continue;const out=ctx.createGain();
    switch(f.k){
      case'eq':{const lo=bq('lowshelf',200,1,+f.low||0),mid=bq('peaking',1000,1,+f.mid||0),hi=bq('highshelf',4000,1,+f.high||0);cur.connect(lo);lo.connect(mid);mid.connect(hi);hi.connect(out);break}
      case'filter':{const b=bq(f.type||'lowpass',+f.freq||1200,+f.q||1,0);cur.connect(b);b.connect(out);break}
      case'comp':{const c=ctx.createDynamicsCompressor(),mk=ctx.createGain();c.threshold.value=+f.thr;c.ratio.value=+f.ratio;c.attack.value=(+f.att||0)/1000;c.release.value=(+f.rel||200)/1000;
        mk.gain.value=Math.pow(10,(+f.gain||0)/20);cur.connect(c);c.connect(mk);mk.connect(out);break}
      case'drive':{const w=ctx.createWaveShaper(),n=1024,cv=new Float32Array(n),k=1+(+f.amt||0)*20;for(let i=0;i<n;i++){const x=i/(n-1)*2-1;cv[i]=Math.tanh(x*k)/Math.tanh(k)}
        w.curve=cv;w.oversample='2x';wetDry(w,w,+f.mix,out);break}
      case'chorus':{const d=ctx.createDelay(.1),lfo=ctx.createOscillator(),lg=ctx.createGain();d.delayTime.value=.018;lfo.frequency.value=+f.rate||1;lg.gain.value=(+f.depth||0)*.006;
        lfo.connect(lg);lg.connect(d.delayTime);lfo.start();oscs.push(lfo);wetDry(d,d,+f.mix,out);break}
      case'delay':{const d=ctx.createDelay(2.1),fb=ctx.createGain();d.delayTime.value=Math.min(2,(+f.ms||375)/1000);fb.gain.value=Math.min(.95,+f.fb||0);d.connect(fb);fb.connect(d);wetDry(d,d,+f.mix,out);break}
      case'reverb':{
        // RULE: the impulse is generated (decaying noise), from a fixed seed so a song renders the same every time.
        const sr=ctx.sampleRate,len=Math.max(1,Math.round(sr*Math.min(8,+f.sec||2))),ir=ctx.createBuffer(2,len,sr);let s=1234567;
        for(let c=0;c<2;c++){const dd=ir.getChannelData(c);for(let i=0;i<len;i++){s=(s*1103515245+12345)&0x7fffffff;dd[i]=(s/0x3fffffff-1)*Math.pow(1-i/len,+f.decay||3)}}
        const cv=ctx.createConvolver();cv.buffer=ir;wetDry(cv,cv,+f.mix,out);break}
      case'crush':{const w=ctx.createWaveShaper(),n=4096,cv=new Float32Array(n),lv=Math.pow(2,Math.round(+f.bits||6)-1);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;cv[i]=Math.round(x*lv)/lv}
        w.curve=cv;wetDry(w,w,+f.mix,out);break}
      case'pump':cur.connect(out);break;
      case'pan':{const p=ctx.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,+f.pan||0));cur.connect(p);p.connect(out);break}
      default:cur.connect(out);
    }
    cur=out;
  }
  cur.connect(dest);return oscs;
}
// INVARIANT: self-contained. One sample hit: re-pitched from its root note unless pitched is off; rings out unless gated.
//   syn, when given, is the synth whose clock pumps it.
function pxSample(ctx,buf,t,p,at,dur,vel,dest,syn){
  const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buf;
  const rate=t.pitched!==false?Math.pow(2,(p-(t.root??60))/12):1;s.playbackRate.value=rate;
  g.gain.setValueAtTime((t.vol/127)*(vel/127),at);s.connect(g);s.start(at);
  const stop=t.gate?at+dur+.12:at+buf.duration/rate;
  (syn&&syn.duck?syn.duck(t,at,stop,g):g).connect(dest);
  if(t.gate){g.gain.setTargetAtTime(0,at+dur,.015);s.stop(stop)}
}
// SAFETY: effects from files are rebuilt from known kinds and in-range numbers.
function cleanFx(list){
  const out=[];for(const f of Array.isArray(list)?list.slice(0,FX_MAX):[]){const D=f&&FX_DEFS[f.k];if(!D)continue;const o={k:f.k,on:f.on!==false};
    for(const [k,,a,b,,def] of D.p)o[k]=Array.isArray(a)?(a.includes(f[k])?f[k]:b):Math.round(numIn(f[k],def,a,b)*1000)/1000;out.push(o)}
  return out;
}
const fxNew=k=>{const o={k,on:true};for(const [p,,a,b,,def] of FX_DEFS[k].p)o[p]=Array.isArray(a)?b:def;return o};
// SAFETY: a sample is audio as a data: URL, under the size cap; ids are plain.
function cleanSamples(list){
  const out=[],ids=new Set();for(const s of Array.isArray(list)?list.slice(0,SMP_MAX):[]){
    if(!s||typeof s.url!=='string'||!/^data:audio\/[\w.+-]+;base64,[A-Za-z0-9+/=]+$/.test(s.url)||s.url.length>SMP_BYTES*1.4)continue;
    const id=String(s.id||'').replace(/[^\w-]/g,'').slice(0,20)||nid('a');if(ids.has(id))continue;ids.add(id);
    const sec=+s.sec;out.push({id,name:String(s.name||'Sample').replace(/[\u0000-\u001f]/g,'').slice(0,60),url:s.url,...(Number.isFinite(sec)&&sec>0?{sec:Math.min(3600,sec)}:{})})}
  return out;
}

// SECTION: live routing (editor)
// PERF: one input per track, chain rebuilt only when that track's effects change; keyed to the current output bus,
//   which seqStop replaces to cut ringing notes.
const live={bus:null,master:null,tracks:new Map(),bufs:new Map()};
function liveChain(key,fx,dest){
  const sig=JSON.stringify(fx||[]),old=key==='master'?live.master:live.tracks.get(key);
  if(old&&old.sig===sig&&old.dest===dest)return old.in;
  if(old)setTimeout(()=>{try{old.in.disconnect();old.oscs.forEach(o=>o.stop())}catch(e){}},4000);
  const inp=ac.createGain(),oscs=pxFx(ac,inp,fx||[],dest),rec={in:inp,sig,oscs,dest};
  if(key==='master')live.master=rec;else live.tracks.set(key,rec);return inp;
}
function trackIn(t){
  const bus=seqOut();if(!bus)return null;
  if(live.bus!==bus){live.bus=bus;live.master=null;live.tracks.clear()}
  const m=state.music,master=liveChain('master',m&&m.fx,bus);return liveChain(t,t.fx,master);
}
async function sampleBuf(url){
  if(!url||!ac)return null;const c=live.bufs.get(url);if(c)return c instanceof Promise?null:c;
  // COMPAT: samples saved before their length was kept learn it the first time they're decoded.
  const p=(async()=>{try{const b=await ac.decodeAudioData(b64bytes(url.slice(url.indexOf(',')+1)).buffer);live.bufs.set(url,b);for(const so of state.songs)for(const x of so.samples||[])if(x.url===url&&!x.sec)x.sec=b.duration;return b}catch(e){live.bufs.delete(url);status('That sample could not be decoded.');return null}})();
  live.bufs.set(url,p);return null;
}
// RULE: before playing, every sample in the song is decoded, so the first hits aren't silent.
async function samplesReady(m){audio();if(!ac||!m)return;await Promise.all((m.samples||[]).map(s=>{const c=live.bufs.get(s.url);return c instanceof Promise?c:c?null:(sampleBuf(s.url),live.bufs.get(s.url))}))}
function samplePlay(t,p,at,dur,vel){
  const m=state.music,s=m&&(m.samples||[]).find(x=>x.id===t.smp),b=s&&live.bufs.get(s.url);if(!b||b instanceof Promise){if(s)sampleBuf(s.url);return}
  const dest=trackIn(t);if(dest)pxSample(ac,b,t,p,at,dur,vel,dest,synth);
}

// SECTION: samples in the song
// RULE: a sample arrives as a clip on its own track: one note from the start, as long as the recording at this tempo,
//   with bars added if it runs past the end, so the timeline shows how long it really is. A tempo change refits it.
// FORMAT: a sample is {id, name, url, sec}; sec is the recording's length in seconds.
const sampleTicks=(m,s)=>Math.max(1,Math.round(s.sec*m.bpm*PPQ/60));
function fitSongTo(m,tick){const bar=barTicks(m);m.bars=Math.min(64,Math.max(m.bars,Math.ceil(tick/bar)))}
function refitSamples(m,oldBpm){
  for(const t of m.tracks){const s=t.smp&&(m.samples||[]).find(x=>x.id===t.smp);if(!s||!s.sec)continue;
    const was=Math.round(s.sec*oldBpm*PPQ/60),now=sampleTicks(m,s);
    for(const n of t.notes)if(Math.abs(n.d-was)<=2){n.d=Math.min(now,SEQ_MAX_TICK-n.t);fitSongTo(m,n.t+n.d)}}
}
async function addSampleFile(file){
  const m=state.music;if(!m)return null;if(file.size>SMP_BYTES){status('That sample is over 24 MB; trim it first.');return null}
  if((m.samples||[]).length>=SMP_MAX){status(`A song holds at most ${SMP_MAX} samples.`);return null}
  const ext=(file.name.match(/\.(\w+)$/)||[])[1]||'',mime=file.type&&file.type.startsWith('audio/')?file.type:{wav:'audio/wav',mp3:'audio/mpeg',ogg:'audio/ogg',oga:'audio/ogg',flac:'audio/flac',m4a:'audio/mp4',aac:'audio/aac',webm:'audio/webm'}[ext.toLowerCase()]||'audio/wav';
  const url=`data:${mime};base64,${bytesB64(new Uint8Array(await file.arrayBuffer()))}`;audio();
  let buf;try{buf=await ac.decodeAudioData(b64bytes(url.slice(url.indexOf(',')+1)).buffer)}catch(e){status(`${file.name} isn’t audio this browser can play.`);return null}
  const s={id:nid('a'),name:file.name.replace(/\.\w+$/,'').slice(0,60),url,sec:buf.duration};let clip=null;
  seqEdit(()=>{(m.samples||(m.samples=[])).push(s);if(m.tracks.length<16){const t=seqTrack(false);t.name=s.name.slice(0,40);t.smp=s.id;t.root=60;t.pitched=true;t.gate=false;
    clip={t:0,d:Math.min(sampleTicks(m,s),SEQ_MAX_TICK),p:60,v:100};t.notes.push(clip);fitSongTo(m,clip.d);m.tracks.push(t);seq.sel=m.tracks.length-1}});
  live.bufs.set(url,buf);seqTracks();seqLayout();seqDraw();const mm=`${Math.floor(s.sec/60)}:${String(Math.round(s.sec%60)).padStart(2,'0')}`;
  status(clip?`Added “${s.name}” (${mm}) as a clip on its own track${clip.t+clip.d>songEnd(m)?'; it runs longer than 64 bars, so the song stops first':''}. Notes at C4 play it as recorded.`:`Added the sample “${s.name}” (${mm}). Every track is taken, so put it on one from the Effects panel.`);return s;
}

// SECTION: effects panel
const sfx2={t:null};
function openFxPanel(target){
  sfx2.t=target;const m=state.music,isM=target==='master',t=isM?null:target;
  $('#seqFxTitle').textContent=isM?`Master effects · ${m.name}`:`Effects · ${t.name}`;
  const sb=$('#seqFxSample');sb.replaceChildren();
  if(t&&t.smp){const s=(m.samples||[]).find(x=>x.id===t.smp);
    const root=mkEl('select');for(let p=24;p<=96;p++)root.append(mkEl('option',{value:p,textContent:NOTE_NAMES[p%12]+(Math.floor(p/12)-1)}));root.value=t.root??60;root.onchange=()=>seqEdit(()=>{t.root=+root.value});
    const ck=(label,k,title)=>{const l=mkEl('label',{className:'tog2',title}),c=mkEl('input',{type:'checkbox',checked:k==='pitched'?t.pitched!==false:!!t[k]});c.onchange=()=>seqEdit(()=>{t[k]=c.checked});l.append(c,' '+label);return l};
    sb.append(mkEl('b',{textContent:`Sample: ${s?s.name:'(missing)'}`}),mkEl('label',{className:'field2',textContent:'Recorded at '}),root,ck('Follow the notes','pitched','Off: every note plays it at its own pitch (drum hits)'),ck('Stop at note end','gate','Off: it plays to its end, however short the note'));
    sb.children[1].append(root)}
  drawSeqFx();$('#seqFx').hidden=false;
}
function fxChain(){const m=state.music;return sfx2.t==='master'?(m.fx||(m.fx=[])):(sfx2.t.fx||(sfx2.t.fx=[]))}
function drawSeqFx(){
  const box=$('#seqFxList');box.replaceChildren();const chain=fxChain();
  if(!chain.length)box.append(mkEl('p',{className:'shelp',textContent:'No effects yet: add one below. They run top to bottom.'}));
  chain.forEach((f,i)=>{const D=FX_DEFS[f.k],card=mkEl('div',{className:'sqfx'+(f.on?'':' off')}),head=mkEl('div',{className:'sqfxh'});
    const on=mkEl('input',{type:'checkbox',checked:f.on});on.setAttribute('aria-label','On');on.onchange=()=>{seqEdit(()=>{f.on=on.checked});card.classList.toggle('off',!f.on)};
    const b=(t,fn,title)=>{const x=mkEl('button',{type:'button',className:'btn sqm',textContent:t,title});x.setAttribute('aria-label',title);x.onclick=()=>{audio();fn()};return x};
    head.append(on,mkEl('b',{textContent:D.name}),b('↑',()=>{if(i){seqEdit(()=>{chain.splice(i-1,0,chain.splice(i,1)[0])});drawSeqFx()}},'Earlier in the chain'),
      b('↓',()=>{if(i<chain.length-1){seqEdit(()=>{chain.splice(i+1,0,chain.splice(i,1)[0])});drawSeqFx()}},'Later in the chain'),b('×',()=>{seqEdit(()=>{chain.splice(i,1)});drawSeqFx()},'Remove'));
    card.append(head);
    for(const [k,label,a,bb,step] of D.p){const row=mkEl('label',{className:'fxrow'}),val=mkEl('span',{className:'fxval'});row.append(mkEl('span',{textContent:label}));let inp;
      if(Array.isArray(a)){inp=mkEl('select');for(const o of a)inp.append(mkEl('option',{value:o,textContent:o}));inp.value=f[k]}
      else{inp=mkEl('input',{type:'range',min:a,max:bb,step,value:f[k]});val.textContent=f[k]}
      inp.dataset.k=k;inp.oninput=()=>{const v=inp.type==='range'?+inp.value:inp.value;seqEdit(()=>{f[k]=v});val.textContent=inp.type==='range'?v:''};row.append(inp,val);card.append(row)}
    box.append(card)});
  $('#seqFxAdd').disabled=chain.length>=FX_MAX;seqTracks();
}
{const sel=$('#seqFxAdd');for(const [k,D] of Object.entries(FX_DEFS))sel.append(mkEl('option',{value:k,textContent:D.name}));
  sel.onchange=()=>{const k=sel.value;sel.value='';if(!k)return;const chain=fxChain();if(chain.length>=FX_MAX)return;seqEdit(()=>{chain.push(fxNew(k))});drawSeqFx();audio();sfx('pop')}}
$('#seqFxClose').onclick=()=>{$('#seqFx').hidden=true};
$('#seqMasterFx').onclick=()=>{audio();openFxPanel('master')};
$('#seqSampleIn').onchange=async e=>{const fs=[...e.target.files];e.target.value='';for(const f of fs)await addSampleFile(f)};


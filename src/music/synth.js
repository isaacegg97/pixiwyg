// SECTION: built-in synth
// INVARIANT: self-contained; exported pages carry its source to play without PIXIWYG.
// FORMAT: map = [[program, voice], ...], the lowest program each voice starts at.
function pxSynth(ctx,out,map){
  const VOICES={
    piano:{o:[['triangle',1,1],['sine',2,.3]],a:.004,d:1.1,s:0,r:.25,lp:3200},
    epiano:{o:[['sine',1,1],['sine',2,.22]],a:.004,d:1.4,s:.15,r:.4},
    mallet:{o:[['sine',1,1],['sine',4,.18]],a:.002,d:.6,s:0,r:.3},
    organ:{o:[['sine',1,.7],['sine',2,.4],['sine',3,.25]],a:.01,d:.1,s:1,r:.06},
    pluck:{o:[['sawtooth',1,.8]],a:.003,d:.45,s:.08,r:.2,lp:4000,lpEnd:700},
    drive:{o:[['square',1,.5],['sawtooth',1.005,.5]],a:.005,d:.2,s:.8,r:.15,lp:2400},
    bass:{o:[['triangle',1,1],['square',1,.25]],a:.005,d:.3,s:.6,r:.1,lp:900},
    synbass:{o:[['sawtooth',1,.9]],a:.004,d:.25,s:.5,r:.1,lp:2200,lpEnd:380},
    strings:{o:[['sawtooth',1,.5],['sawtooth',1.006,.5]],a:.14,d:.2,s:.85,r:.45,lp:2800},
    brass:{o:[['sawtooth',1,.8]],a:.04,d:.2,s:.8,r:.15,lp:1100,lpEnd:2600},
    reed:{o:[['square',1,.7]],a:.03,d:.2,s:.85,r:.12,lp:1900},
    flute:{o:[['sine',1,1],['triangle',2,.08]],a:.06,d:.1,s:.9,r:.12},
    square:{o:[['square',1,.6]],a:.004,d:.1,s:.8,r:.1},
    saw:{o:[['sawtooth',1,.6]],a:.004,d:.1,s:.8,r:.1,lp:5000},
    pad:{o:[['sawtooth',1,.4],['sawtooth',1.008,.4]],a:.45,d:.3,s:.8,r:.9,lp:1500},
  };
  const voiceOf=prog=>{let v='piano';for(const [p,name] of map)if(p<=prog)v=name;return VOICES[v]||VOICES.piano};
  const hz=p=>440*Math.pow(2,(p-69)/12);
  const noiseBuf=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);{const d=noiseBuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1}
  function drum(p,at,g0,dest=out){
    const env=(node,peak,dec,off=0)=>{const g=ctx.createGain();g.gain.setValueAtTime(peak*g0,at+off);g.gain.exponentialRampToValueAtTime(.001,at+off+dec);node.connect(g);g.connect(dest);return g};
    const osc=(type,f0,f1,dec,peak)=>{const o=ctx.createOscillator();o.type=type;o.frequency.setValueAtTime(f0,at);if(f1)o.frequency.exponentialRampToValueAtTime(f1,at+dec);env(o,peak,dec);o.start(at);o.stop(at+dec+.05)};
    const noise=(type,f,dec,peak,q=1,off=0)=>{const s=ctx.createBufferSource();s.buffer=noiseBuf;const fl=ctx.createBiquadFilter();fl.type=type;fl.frequency.value=f;fl.Q.value=q;s.connect(fl);env(fl,peak,dec,off);s.start(at+off);s.stop(at+off+dec+.05)};
    if(p===35||p===36){osc('sine',150,42,.42,1.1);osc('triangle',90,40,.08,.4)}
    else if(p===38||p===40||p===37){noise('highpass',1200,.2,.6);osc('triangle',220,160,.1,.45)}
    else if(p===39){for(const k of [0,.011,.023])noise('bandpass',1500,k===.023?.18:.03,.55,2,k)}
    else if(p===42||p===44)noise('highpass',8000,.05,.4);
    else if(p===46)noise('highpass',7500,.3,.35);
    else if([41,43,45,47,48,50].includes(p)){const f=({41:90,43:110,45:130,47:160,48:190,50:220})[p];osc('sine',f*1.5,f,.35,.9)}
    else if(p===49||p===57)noise('highpass',5000,1.3,.35);
    else if(p===51||p===59){noise('highpass',9000,.6,.18);osc('square',5200,0,.4,.04)}
    else if(p===54)noise('bandpass',9000,.12,.4,1.5);
    else if(p===56){osc('square',540,0,.14,.2);osc('square',800,0,.14,.18)}
    else noise('bandpass',hz(p),.15,.4,3);
  }
  return{note(t,p,at,dur,vel,dest=out){
    const g0=(t.vol/127)*(vel/127);if(t.drums)return drum(p,at,g0,dest);
    const V=voiceOf(t.prog),amp=ctx.createGain(),end=at+dur;let node=amp;
    amp.gain.setValueAtTime(0,at);amp.gain.linearRampToValueAtTime(g0*.5,at+V.a);
    amp.gain.setTargetAtTime(g0*.5*V.s,at+V.a,V.d/3);amp.gain.setTargetAtTime(0,Math.max(end,at+V.a),V.r/3);
    if(V.lp){const f=ctx.createBiquadFilter();f.type='lowpass';f.frequency.setValueAtTime(V.lp,at);if(V.lpEnd)f.frequency.setTargetAtTime(V.lpEnd,at+V.a,V.d/2);f.connect(amp);node=f}
    amp.connect(dest);
    const stop=end+V.r*2+.05;
    for(const [type,mul,lvl] of V.o){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=hz(p)*mul;g.gain.value=lvl;o.connect(g);g.connect(node);o.start(at);o.stop(stop)}
  }};
}
// PERF: one OfflineAudioContext pass, exactly the song's length. Self-contained.
// INVARIANT: note(ctx,out,synth) may return a player (the editor's SoundFont); otherwise the synth plays.
async function pxRender(m,map,note){
  const PPQ=480,sp=60/m.bpm/PPQ,end=m.bars*m.beats*PPQ*4/(m.unit||4),sr=44100,len=Math.max(1,Math.ceil(end*sp*sr));
  const ctx=new OfflineAudioContext(2,len,sr),comp=ctx.createDynamicsCompressor(),bus=ctx.createGain();bus.gain.value=.45;bus.connect(comp);comp.connect(ctx.destination);
  // INVARIANT: notes go into their track's input, through the track's effects, then the song's, then the bus.
  const master=ctx.createGain();pxFx(ctx,master,m.fx,bus);
  const syn=pxSynth(ctx,master,map),play=(note&&note(ctx,master,syn))||syn.note,bufs={};
  for(const s of m.samples||[])try{const b=atob(s.url.slice(s.url.indexOf(',')+1)),u=new Uint8Array(b.length);for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);bufs[s.id]=await ctx.decodeAudioData(u.buffer)}catch(e){}
  for(const t of m.tracks){if(t.mute)continue;const tin=ctx.createGain();pxFx(ctx,tin,t.fx,master);
    for(const n of t.notes)if(n.t<end){const at=n.t*sp,d=Math.min(n.d,end-n.t)*sp;if(t.smp!=null){if(bufs[t.smp])pxSample(ctx,bufs[t.smp],t,n.p,at,d,n.v,tin)}else play(t,n.p,at,d,n.v,tin)}}
  return ctx.startRendering();
}
// FORMAT: AudioBuffer to 16-bit PCM WAV. Self-contained.
function pxWav(b){
  const ch=b.numberOfChannels,n=b.length,data=new DataView(new ArrayBuffer(44+n*ch*2)),s=(o,t)=>{for(let i=0;i<t.length;i++)data.setUint8(o+i,t.charCodeAt(i))};
  s(0,'RIFF');data.setUint32(4,36+n*ch*2,true);s(8,'WAVEfmt ');data.setUint32(16,16,true);data.setUint16(20,1,true);data.setUint16(22,ch,true);
  data.setUint32(24,b.sampleRate,true);data.setUint32(28,b.sampleRate*ch*2,true);data.setUint16(32,ch*2,true);data.setUint16(34,16,true);s(36,'data');data.setUint32(40,n*ch*2,true);
  const chans=[...Array(ch)].map((_,c)=>b.getChannelData(c));let o=44;
  for(let i=0;i<n;i++)for(let c=0;c<ch;c++){const v=Math.max(-1,Math.min(1,chans[c][i]));data.setInt16(o,v<0?v*32768:v*32767,true);o+=2}
  return new Blob([data],{type:'audio/wav'});
}

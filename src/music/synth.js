// SECTION: built-in synth
// INVARIANT: self-contained; exported pages carry its source to play without PIXIWYG.
// FORMAT: map = [[program, voice], ...], the lowest program each voice starts at.
// FORMAT: a voice: o oscillators [type, frequency ratio, level]; a d s r envelope; lp low-pass (lpEnd where it
//   settles, sweep where it peaks mid-note and closes again: a wobble per note; q resonance); trem [Hz, depth] amp
//   LFO; wow [Hz, cents] pitch drift from the start; vib [Hz, cents] vibrato that comes in after a moment; slide
//   cents it glides in from; noise [level, seconds] a burst at the attack; breath a steady breath level; formant
//   vowel band-passes in Hz.
// RULE: the synth's bpm and t0 (the song's zero on the audio clock) let a track's Sidechain pump effect duck each
//   note on the beat; with no bpm set (previews) notes don't pump.
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
    tapekeys:{o:[['sine',1,1],['sine',2,.22],['triangle',1,.08]],a:.006,d:1.4,s:.2,r:.5,lp:2600,wow:[.5,16]},
    glock:{o:[['sine',1,1],['sine',2.76,.32],['sine',5.4,.1]],a:.001,d:.55,s:0,r:.4},
    vibes:{o:[['sine',1,1],['sine',4,.1]],a:.002,d:1.8,s:.12,r:.7,trem:[5.5,.4]},
    marimba:{o:[['sine',1,1],['sine',4,.22],['sine',9.9,.05]],a:.002,d:.32,s:0,r:.15},
    accordion:{o:[['sawtooth',1,.4],['square',1.006,.3],['sawtooth',.997,.3]],a:.04,d:.1,s:.9,r:.1,lp:2200,trem:[6,.15]},
    fretless:{o:[['sine',1,1],['triangle',1,.35]],a:.025,d:.5,s:.65,r:.15,lp:1000,slide:-45},
    wobble:{o:[['sawtooth',1,.5],['square',1.007,.35],['sine',.5,.6]],a:.004,d:.1,s:1,r:.04,lp:160,sweep:2400,q:8},
    choir:{o:[['sawtooth',1,.5],['sawtooth',1.005,.5],['sawtooth',.995,.4]],a:.3,d:.3,s:.85,r:.7,formant:[730,1090,2440],vib:[5,8]},
    orchhit:{o:[['sawtooth',1,.55],['sawtooth',1.006,.45],['square',.5,.35],['sawtooth',2,.25]],a:.002,d:.4,s:0,r:.25,lp:5000,lpEnd:800,noise:[.4,.1]},
    stab:{o:[['sawtooth',1,.5],['sawtooth',1.011,.4],['square',2,.12]],a:.002,d:.16,s:.12,r:.1,lp:5500,lpEnd:900},
    sax:{o:[['sawtooth',1,.55],['square',1,.2]],a:.05,d:.2,s:.85,r:.15,lp:1800,vib:[5,12],breath:.04},
    panflute:{o:[['sine',1,1],['sine',2,.05]],a:.05,d:.1,s:.9,r:.15,breath:.18,vib:[4.5,6]},
    shakuhachi:{o:[['sine',1,1],['triangle',2,.06]],a:.09,d:.2,s:.85,r:.2,breath:.25,vib:[4,14],slide:-60},
    reese:{o:[['sawtooth',1,.5],['sawtooth',1.012,.5],['sine',.5,.45]],a:.01,d:.3,s:.9,r:.15,lp:650},
    supersaw:{o:[['sawtooth',1,.3],['sawtooth',.991,.26],['sawtooth',1.009,.26],['sawtooth',.982,.2],['sawtooth',1.018,.2],['sawtooth',.5,.18],['sawtooth',2.004,.1]],a:.01,d:.3,s:.85,r:.35,lp:7000},
    sitar:{o:[['sawtooth',1,.6],['sawtooth',2.01,.2]],a:.002,d:1.2,s:.1,r:.4,lp:3800,lpEnd:1400,q:6,slide:30},
    oud:{o:[['triangle',1,.8],['sawtooth',1,.25]],a:.002,d:.6,s:0,r:.25,lp:2600,lpEnd:900},
    koto:{o:[['triangle',1,.9],['sine',3,.2]],a:.001,d:.9,s:0,r:.35,lp:4200,lpEnd:1500,slide:-25},
    harpsi:{o:[['sawtooth',1,.45],['square',2,.15],['sawtooth',4.01,.08]],a:.001,d:.7,s:0,r:.2,lp:6000,lpEnd:2500},
    kalimba:{o:[['sine',1,1],['sine',5.4,.14]],a:.001,d:.7,s:0,r:.35},
    bagpipe:{o:[['sawtooth',1,.5],['square',1,.3]],a:.03,d:.1,s:.95,r:.08,lp:2800,q:3},
    fiddle:{o:[['sawtooth',1,.6],['sawtooth',1.003,.3]],a:.06,d:.2,s:.85,r:.15,lp:3200,vib:[5.5,14]},
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
    else if(p===37){noise('bandpass',2200,.04,.5,3);osc('triangle',420,0,.04,.35)}
    else if(p===52){osc('sine',72,64,3.5,.7);osc('sine',151,140,2.2,.25);noise('bandpass',420,2.4,.18,2)}
    else if(p>=60&&p<=64){const f=({60:420,61:310,62:360,63:330,64:200})[p];osc('sine',f*1.3,f,p>=62?.28:.14,.85);noise('bandpass',p===62?3200:2400,.025,p===62?.5:.3,2)}
    else if(p===69||p===70)noise('highpass',p===69?6500:5000,p===69?.05:.07,.32);
    else if(p===75)osc('sine',2500,0,.08,.45);
    else if(p===76||p===77){osc('sine',p===76?900:700,0,.07,.5);noise('bandpass',1100,.02,.25,2)}
    else if(p===80||p===81){osc('sine',4200,0,p===80?.25:1.2,.18);osc('sine',11340,0,p===80?.15:.8,.05)}
    else noise('bandpass',hz(p),.15,.4,3);
  }
  const api={bpm:0,t0:0,note(t,p,at,dur,vel,dest=out){
    const g0=(t.vol/127)*(vel/127);if(t.drums)return drum(p,at,g0,dest);
    const V=voiceOf(t.prog),amp=ctx.createGain(),end=at+dur;let node=amp,post=amp;
    const stop=end+V.r*2+.05,lfo=(rate,depth,into,from=at)=>{const l=ctx.createOscillator(),lg=ctx.createGain();l.frequency.value=rate;lg.gain.value=depth;l.connect(lg);for(const i of into)lg.connect(i);l.start(from);l.stop(stop)};
    amp.gain.setValueAtTime(0,at);amp.gain.linearRampToValueAtTime(g0*.5,at+V.a);
    amp.gain.setTargetAtTime(g0*.5*V.s,at+V.a,V.d/3);amp.gain.setTargetAtTime(0,Math.max(end,at+V.a),V.r/3);
    if(V.lp){const f=ctx.createBiquadFilter();f.type='lowpass';f.Q.value=V.q||.7;f.frequency.setValueAtTime(V.lp,at);
      if(V.sweep){const mid=at+Math.max(.02,dur/2);f.frequency.exponentialRampToValueAtTime(V.sweep,mid);f.frequency.exponentialRampToValueAtTime(V.lp,at+Math.max(.04,dur))}
      else if(V.lpEnd)f.frequency.setTargetAtTime(V.lpEnd,at+V.a,V.d/2);
      f.connect(node);node=f}
    if(V.formant){const inp=ctx.createGain();for(const fq of V.formant){const b=ctx.createBiquadFilter();b.type='bandpass';b.frequency.value=fq;b.Q.value=7;const bg=ctx.createGain();bg.gain.value=2.2;inp.connect(b);b.connect(bg);bg.connect(node)}node=inp}
    if(V.trem){const tg=ctx.createGain();tg.gain.value=1-V.trem[1]/2;post.connect(tg);post=tg;lfo(V.trem[0],V.trem[1]/2,[tg.gain])}
    // RULE: Sidechain pump: the note ducks on each pump of the beat and swells back over the first half of it.
    const pump=api.bpm>0&&(t.fx||[]).find(f=>f&&f.k==='pump'&&f.on!==false);
    if(pump){const pg=ctx.createGain(),per=60/api.bpm/Math.max(.5,+pump.rate||1),lo=1-Math.max(0,Math.min(1,+pump.depth||0)),sw=per*.55,ph=((at-api.t0)/per%1+1)%1;
      pg.gain.setValueAtTime(ph<.55?lo+(1-lo)*ph/.55:1,at);if(ph<.55)pg.gain.linearRampToValueAtTime(1,at+sw-ph*per);
      for(let b=api.t0+Math.ceil((at-api.t0)/per)*per;b<stop;b+=per){pg.gain.setValueAtTime(lo,b);pg.gain.linearRampToValueAtTime(1,b+sw)}
      post.connect(pg);post=pg}
    post.connect(dest);
    const det=[];
    for(const [type,mul,lvl] of V.o){const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=hz(p)*mul;g.gain.value=lvl;o.connect(g);g.connect(node);o.start(at);o.stop(stop);det.push(o.detune);
      if(V.slide){o.detune.setValueAtTime(V.slide,at);o.detune.linearRampToValueAtTime(0,at+.09)}}
    if(V.wow)lfo(V.wow[0],V.wow[1],det);
    if(V.vib)lfo(V.vib[0],V.vib[1],det,at+Math.min(.25,dur*.4));
    if(V.noise){const s=ctx.createBufferSource(),hp=ctx.createBiquadFilter(),ng=ctx.createGain();s.buffer=noiseBuf;hp.type='highpass';hp.frequency.value=1800;
      ng.gain.setValueAtTime(V.noise[0]*g0,at);ng.gain.exponentialRampToValueAtTime(.001,at+V.noise[1]);s.connect(hp);hp.connect(ng);ng.connect(amp);s.start(at);s.stop(at+V.noise[1]+.05)}
    if(V.breath){const s=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),bg=ctx.createGain();s.buffer=noiseBuf;s.loop=true;bp.type='bandpass';bp.frequency.value=hz(p)*2;bp.Q.value=1.2;bg.gain.value=V.breath;s.connect(bp);bp.connect(bg);bg.connect(node);s.start(at);s.stop(stop)}
  }};
  return api;
}
// PERF: one OfflineAudioContext pass, exactly the song's length. Self-contained.
// INVARIANT: note(ctx,out,synth) may return a player (the editor's SoundFont); otherwise the synth plays.
// FORMAT: tail is seconds rendered past the song's end, for reverbs and releases to ring out (exports); 0 for loops.
async function pxRender(m,map,note,tail=0){
  const PPQ=480,sp=60/m.bpm/PPQ,end=m.bars*m.beats*PPQ*4/(m.unit||4),sr=44100,len=Math.max(1,Math.ceil((end*sp+tail)*sr));
  const ctx=new OfflineAudioContext(2,len,sr),comp=ctx.createDynamicsCompressor(),bus=ctx.createGain();bus.gain.value=.45;bus.connect(comp);comp.connect(ctx.destination);
  // INVARIANT: notes go into their track's input, through the track's effects, then the song's, then the bus.
  const master=ctx.createGain();pxFx(ctx,master,m.fx,bus);
  const syn=pxSynth(ctx,master,map);syn.bpm=m.bpm;syn.t0=0;const play=(note&&note(ctx,master,syn))||syn.note,bufs={};
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

// SECTION: sequencer playback: the output bus, notes, scheduling ahead of the audio clock
let seqBus=null,synth=null;
function seqOut(){
  if(!ac)return null;
  if(!seqBus){const comp=ac.createDynamicsCompressor();seqBus=ac.createGain();seqBus.gain.value=.45;seqBus.connect(comp);comp.connect(ac.destination);synth=pxSynth(ac,seqBus,GMV)}
  return seqBus;
}
function playNote(track,p,at,dur,vel){
  const out=seqOut();if(!out)return;
  if(track.smp!=null){samplePlay(track,p,at,dur,vel);return}
  const dest=trackIn(track)||out;
  if(soundfont&&sfPlay(track,p,at,dur,vel,dest,ac,synth))return;   // RULE: notes the SoundFont lacks fall back to the synth.
  synth.note(track,p,at,dur,vel,dest);
}
// PERF: lookahead scheduler on the audio clock; timing holds when the main thread is busy.
const seqP={on:false,t0:0,from:0,next:0,timer:0,raf:0,loop:true,cursor:0,click:false};
const tickSec=m=>60/m.bpm/PPQ;
async function seqPlay(){
  audio();if(!ac||!seqOut())return;const m=state.music;if(!m)return;
  if((m.samples||[]).length){status('Loading samples…');await samplesReady(m);status('')}
  seqStop(true);seqP.on=true;seqP.from=Math.min(seqP.cursor,songEnd(m)-1);seqP.next=seqP.from;seqP.t0=ac.currentTime+.06;
  // INVARIANT: the synth's song zero, so a Sidechain pump lands on the song's beats wherever playback starts.
  synth.bpm=m.bpm;synth.t0=seqP.t0-seqP.from*tickSec(m);
  seqSchedule();seqP.timer=setInterval(seqSchedule,25);seqP.raf=requestAnimationFrame(seqFrame);
  $('#seqPlay').textContent='■ Stop';$('#seqPlay').setAttribute('aria-pressed','true');
}
function seqStop(quiet){
  clearInterval(seqP.timer);cancelAnimationFrame(seqP.raf);seqP.on=false;
  // HACK: notes already handed to the audio clock ring on; replacing the output bus is the only way to silence them.
  if(seqBus&&!quiet){const old=seqBus;old.gain.setTargetAtTime(0,ac.currentTime,.02);setTimeout(()=>old.disconnect(),200);seqBus=null}
  const b=$('#seqPlay');if(b){b.textContent='▶ Play';b.setAttribute('aria-pressed','false')}
  seqDraw();
}
function seqSchedule(){
  const m=state.music;if(!m||!seqP.on)return;
  const sp=tickSec(m),end=songEnd(m),horizon=ac.currentTime+.15;
  // INVARIANT: ticks count from seqP.from at seqP.t0; each pass schedules [next, horizon).
  for(;;){
    const until=Math.min(end,seqP.from+Math.floor((horizon-seqP.t0)/sp));
    if(until<=seqP.next)break;
    // RULE: while any track is soloed only soloed tracks play here; files, the player and exports play the full mix.
    const solo=m.tracks.some(t=>t.solo);
    if(seqP.click)seqClicks(m,seqP.next,until,sp);
    for(const t of m.tracks)if(!t.mute&&(!solo||t.solo))for(const n of t.notes)if(n.t>=seqP.next&&n.t<until)
      playNote(t,n.p,seqP.t0+(n.t-seqP.from)*sp,Math.min(n.d,end-n.t)*sp,n.v);
    seqP.next=until;
    if(until>=end){
      if(!seqP.loop){clearInterval(seqP.timer);setTimeout(()=>{if(seqP.on)seqStop(true)},Math.max(0,(seqP.t0+(end-seqP.from)*sp-ac.currentTime)*1000)+300);break}
      seqP.t0+=(end-seqP.from)*sp;seqP.from=0;seqP.next=0;synth.t0=seqP.t0;
    }else break;
  }
}
// RULE: the click: a high tick on each bar, a middle one on each accent group, a low one on the other beats.
function seqClicks(m,from,until,sp){
  const bt=beatTicks(m),bar=barTicks(m),groups=new Set(meterGroups(m).reduce((a,g)=>(a.push(a.at(-1)+g),a),[0]).slice(0,-1).map(b=>b*bt)),out=seqOut();if(!out)return 0;
  let n=0;
  for(let b=Math.ceil(from/bt)*bt;b<until;b+=bt,n++){
    const at=seqP.t0+(b-seqP.from)*sp,k=b%bar,f=k===0?1760:groups.has(k)?1320:990,o=ac.createOscillator(),g=ac.createGain();
    o.type='square';o.frequency.value=f;g.gain.setValueAtTime(k===0?.3:.18,at);g.gain.exponentialRampToValueAtTime(.001,at+.04);o.connect(g);g.connect(out);o.start(at);o.stop(at+.05);
  }
  return n;
}
function seqNow(){const m=state.music;if(!m||!ac)return null;const t=seqP.from+(ac.currentTime-seqP.t0)/tickSec(m);return t<seqP.from?null:t}
// RULE: the view turns the page when the playhead leaves it, unless a note is being dragged.
function seqFrame(){
  const now=seqP.on&&!seq.drag?seqNow():null;
  if(now!=null){const sc=$('#seqScroll'),X=SQ.KW+now/PPQ*SQ.BW-sc.scrollLeft;if(X>sc.clientWidth-16||X<SQ.KW)sc.scrollLeft=Math.max(0,now/PPQ*SQ.BW-24)}
  seqDraw();if(seqP.on)seqP.raf=requestAnimationFrame(seqFrame)}

// SECTION: playing a song for something else to follow (the Animate timeline)
// FORMAT: songRun(m, from) plays song m from `from` seconds, scheduled ahead on the audio clock like the sequencer;
//   {t0, stop()}, where t0 is the AudioContext time of the song's start. songTime() is where the listener is.
function songRun(m,from=0){
  audio();if(!ac||!m)return null;if(seqP.on)seqStop();if(!seqOut())return null;
  const sp=tickSec(m),end=songEnd(m),run={t0:ac.currentTime+.06-from,next:Math.max(0,Math.ceil(from/sp)),timer:0,
    // HACK: notes already handed to the audio clock ring on; replacing the output bus is the only way to silence them.
    stop(){clearInterval(run.timer);if(seqBus){const old=seqBus;old.gain.setTargetAtTime(0,ac.currentTime,.02);setTimeout(()=>old.disconnect(),200);seqBus=null}}};
  synth.bpm=m.bpm;synth.t0=run.t0;
  const go=()=>{const until=Math.min(end,Math.floor((ac.currentTime+.15-run.t0)/sp));if(until<=run.next)return;
    for(const t of m.tracks)if(!t.mute)for(const n of t.notes)if(n.t>=run.next&&n.t<until)playNote(t,n.p,run.t0+n.t*sp,Math.min(n.d,end-n.t)*sp,n.v);
    run.next=until;if(until>=end)clearInterval(run.timer)};
  go();run.timer=setInterval(go,25);return run;
}
// INVARIANT: what is heard lags what is scheduled by the output latency; the eye follows the ear.
const songTime=run=>ac.currentTime-run.t0-(ac.outputLatency||ac.baseLatency||0);

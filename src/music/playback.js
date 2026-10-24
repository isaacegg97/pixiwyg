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
  if(soundfont&&sfPlay(track,p,at,dur,vel,dest))return;   // RULE: notes the SoundFont lacks fall back to the synth.
  synth.note(track,p,at,dur,vel,dest);
}
// PERF: lookahead scheduler on the audio clock; timing holds when the main thread is busy.
const seqP={on:false,t0:0,from:0,next:0,timer:0,raf:0,loop:true,cursor:0};
const tickSec=m=>60/m.bpm/PPQ;
async function seqPlay(){
  audio();if(!ac||!seqOut())return;const m=state.music;if(!m)return;
  if((m.samples||[]).length){status('Loading samples…');await samplesReady(m);status('')}
  seqStop(true);seqP.on=true;seqP.from=Math.min(seqP.cursor,songEnd(m)-1);seqP.next=seqP.from;seqP.t0=ac.currentTime+.06;
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
    for(const t of m.tracks)if(!t.mute)for(const n of t.notes)if(n.t>=seqP.next&&n.t<until)
      playNote(t,n.p,seqP.t0+(n.t-seqP.from)*sp,Math.min(n.d,end-n.t)*sp,n.v);
    seqP.next=until;
    if(until>=end){
      if(!seqP.loop){clearInterval(seqP.timer);setTimeout(()=>{if(seqP.on)seqStop(true)},Math.max(0,(seqP.t0+(end-seqP.from)*sp-ac.currentTime)*1000)+300);break}
      seqP.t0+=(end-seqP.from)*sp;seqP.from=0;seqP.next=0;
    }else break;
  }
}
function seqNow(){const m=state.music;if(!m||!ac)return null;const t=seqP.from+(ac.currentTime-seqP.t0)/tickSec(m);return t<seqP.from?null:t}
function seqFrame(){seqDraw();if(seqP.on)seqP.raf=requestAnimationFrame(seqFrame)}


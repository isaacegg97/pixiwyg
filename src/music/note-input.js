// SECTION: note input (MIDI keyboards, the computer keys) and recording
// RULE: live notes sound for a fixed .35s on the way in; what is recorded keeps the real length from note-off.
// RULE: playing + Rec: notes land at the playhead, snapped to the grid. Stopped + Rec: step entry at the cursor,
//   which moves on one grid step per note (chords: notes held together share a step).
const KEYMAP={a:0,w:1,s:2,e:3,d:4,f:5,t:6,g:7,y:8,h:9,u:10,j:11,k:12,o:13,l:14,p:15,';':16};
const seqIn={rec:false,oct:60,held:new Map(),midi:null,step:null,take:false};
function seqNoteOn(p,v=100){
  const m=state.music;if(!m||p<0||p>127)return;const t=seqTrackSel();if(t.drums&&!DRUMS.some(d=>d[0]===p))return;
  audio();if(ac&&seqOut())playNote(t,p,ac.currentTime+.005,.35,v);
  if(!seqIn.rec||seqIn.held.has(p))return;
  const step=gridTicks(m),end=songEnd(m);
  if(!seqIn.take){pushUndo();seqIn.take=true}
  let at;
  if(seqP.on){const now=seqNow();if(now==null)return;at=Math.round((now%end)/step)*step%end}
  else{if(seqIn.step==null||!seqIn.held.size)seqIn.step=seqP.cursor;at=seqIn.step}
  seqIn.held.set(p,{at,v,t0:ac?ac.currentTime:0,track:t});
}
function seqNoteOff(p){
  const h=seqIn.held.get(p);if(!h)return;seqIn.held.delete(p);const m=state.music;if(!m)return;
  const step=gridTicks(m),end=songEnd(m);
  const d=seqP.on?Math.max(step,Math.round(((ac?ac.currentTime:0)-h.t0)/tickSec(m)/step)*step):h.track.drums?step:seqLastLen;
  h.track.notes.push({t:h.at,p,d:Math.min(d,end-h.at),v:h.v});seqTidy(h.track);
  if(!seqP.on&&!seqIn.held.size){seqP.cursor=(seqIn.step+(h.track.drums?step:seqLastLen))%end;seqIn.step=null}
  save();seqDraw();
}
function setRec(on){seqIn.rec=on;seqIn.take=false;seqIn.held.clear();const b=$('#seqRec');b.setAttribute('aria-pressed',String(on));b.classList.toggle('rec',on);
  status(on?(seqP.on?'Recording: play along, notes land where you play them':'Step entry: each note lands at the cursor and moves it on'):'Recording off')}
$('#seqRec').onclick=()=>{audio();setRec(!seqIn.rec)};
$('#seqModal').addEventListener('keydown',e=>{
  if(e.target.matches('input,select,textarea')||e.ctrlKey||e.metaKey||e.altKey)return;const k=e.key.toLowerCase();
  if(k==='z'||k==='x'){e.preventDefault();seqIn.oct=Math.max(24,Math.min(96,seqIn.oct+(k==='z'?-12:12)));status(`Computer keys from ${noteName(seqIn.oct)}`);return}
  if(k==='r'&&!e.repeat){e.preventDefault();setRec(!seqIn.rec);return}
  if(k in KEYMAP){e.preventDefault();if(!e.repeat)seqNoteOn(seqIn.oct+KEYMAP[k])}
});
$('#seqModal').addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(k in KEYMAP)seqNoteOff(seqIn.oct+KEYMAP[k])});
// SAFETY: Web MIDI without sysex; asked for only when the button is pressed.
$('#seqMidiIn').onclick=async()=>{audio();
  if(!navigator.requestMIDIAccess){status('This browser can’t use MIDI keyboards. The computer keys work: A–L, with Z and X for octaves.');return}
  try{seqIn.midi=await navigator.requestMIDIAccess({sysex:false})}catch(e){status('No permission to use MIDI keyboards');return}
  const hook=()=>{const ins=[...seqIn.midi.inputs.values()];for(const i of ins)i.onmidimessage=ev=>{const [st,p,v]=ev.data,c=st&0xf0;if(c===0x90&&v>0)seqNoteOn(p,v);else if(c===0x80||(c===0x90&&v===0))seqNoteOff(p)};
    $('#seqMidiIn').textContent=ins.length?`MIDI: ${ins[0].name}${ins.length>1?' +'+(ins.length-1):''}`:'MIDI: none';status(ins.length?`Listening to ${ins.map(i=>i.name).join(', ')}`:'No MIDI keyboard found. Plug one in; it’s picked up as it arrives.')};
  seqIn.midi.onstatechange=hook;hook()};
// RULE: the wheel over a note changes how hard it's played; lighter notes draw fainter.
$('#seqScroll').addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey)return;const t=seqTrackSel(),h=seqHit(e),n=h.zone==='grid'&&seqNoteAt(t,h);if(!n)return;e.preventDefault();
  seqEdit(()=>{n.v=Math.max(1,Math.min(127,n.v+(e.deltaY<0?8:-8)))});status(`Velocity ${n.v}`);seqDraw()},{passive:false});
$('#seqRepGo').onclick=()=>{audio();const m=state.music;if(!m)return;
  const a=Math.max(1,Math.min(m.bars,+$('#seqRepA').value||1)),b=Math.max(a,Math.min(m.bars,+$('#seqRepB').value||a)),bar=barTicks(m),lo=(a-1)*bar,hi=b*bar,len=hi-lo,end=songEnd(m);
  if(hi>=end){status('Those bars already run to the end of the song');return}
  seqEdit(()=>{for(const t of $('#seqRepAll').checked?m.tracks:[seqTrackSel()]){const src=t.notes.filter(n=>n.t>=lo&&n.t<hi);
    t.notes=t.notes.filter(n=>n.t<hi);for(let o=hi;o<end;o+=len)for(const n of src){const at=n.t-lo+o;if(at<end)t.notes.push({...n,t:at,d:Math.min(n.d,end-at)})}seqTidy(t)}});
  seqDraw();status(`Bars ${a}–${b} repeated to the end of the song`);sfx('pop')};


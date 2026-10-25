// SECTION: sequencer
// FORMAT: songs are kept in MIDI ticks (PPQ 480) so changing the grid never moves notes; up to 16 tracks, each an
//   instrument or the drum kit. The .mid is generated on demand, not stored.
// INVARIANT: room for 64 bars of the longest meter (32/2, 64 quarters a bar).
const PPQ=480,SEQ_MAX_TICK=64*64*PPQ;
// INVARIANT: sorted by program: a program plays the voice of the last entry at or below it (pxSynth's map).
const GM=[[0,'Piano','piano'],[4,'Electric piano','epiano'],[5,'Tape keys','tapekeys'],[6,'Harpsichord','harpsi'],[9,'Glockenspiel','glock'],[11,'Vibraphone','vibes'],
  [12,'Marimba','marimba'],[13,'Xylophone','mallet'],[16,'Organ','organ'],[21,'Accordion','accordion'],[24,'Nylon guitar','pluck'],
  [29,'Overdriven guitar','drive'],[33,'Electric bass','bass'],[35,'Fretless bass','fretless'],[38,'Synth bass','synbass'],[39,'Wobble bass','wobble'],
  [40,'Violin','strings'],[48,'Strings','strings'],[52,'Choir aahs','choir'],[55,'Orchestra hit','orchhit'],[56,'Trumpet','brass'],
  [61,'Brass section','brass'],[62,'Synth stab','stab'],[65,'Alto sax','reed'],[66,'Tenor sax','sax'],[73,'Flute','flute'],
  [75,'Pan flute','panflute'],[77,'Shakuhachi','shakuhachi'],[80,'Square lead','square'],[81,'Saw lead','saw'],[87,'Reese bass','reese'],
  [89,'Warm pad','pad'],[90,'Supersaw','supersaw'],[98,'Crystal','mallet'],[104,'Sitar','sitar'],[105,'Oud','oud'],[107,'Koto','koto'],
  [108,'Kalimba','kalimba'],[109,'Bagpipe','bagpipe'],[110,'Fiddle','fiddle'],[114,'Steel drums','mallet']];
// FORMAT: General MIDI drum notes, top to bottom as rows.
const DRUMS=[[49,'Crash'],[52,'Gong'],[51,'Ride'],[46,'Open hat'],[42,'Closed hat'],[81,'Triangle'],[54,'Tambourine'],[70,'Maracas'],[69,'Cabasa'],[56,'Cowbell'],
  [75,'Claves'],[76,'Wood block'],[60,'High bongo'],[61,'Low bongo'],[63,'Open conga'],[64,'Low conga'],[50,'High tom'],[47,'Mid tom'],[45,'Low tom'],[41,'Floor tom'],
  [39,'Clap'],[37,'Side stick'],[38,'Snare'],[36,'Kick']];
const SEQ_COLORS=['#ff2e88','#2e5bff','#1d9a5b','#d97a00','#7a3ff0','#00a3b4','#c2185b','#5d7a00'];
const NOTE_NAMES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const noteName=p=>NOTE_NAMES[p%12]+(Math.floor(p/12)-1);
const isBlack=p=>[1,3,6,8,10].includes(p%12);
function seqTrack(drums,i){return{id:nid('t'),name:drums?'Drums':'Piano',drums:!!drums,prog:0,vol:100,mute:false,notes:[]}}
function defaultMusic(){return{bpm:120,beats:4,res:4,bars:4,tracks:[seqTrack(false),seqTrack(true)]}}
// INVARIANT: songs are project files; state.music is the one open in the sequencer.
const songById=id=>id?state.songs.find(s=>s.id===id)||null:null;
function newSong(name,music){const s={id:nid('m'),name:name||`Song ${state.songs.length+1}`,...(music||defaultMusic())};state.songs.push(s);return s}
function useSong(id){state.music=songById(id)||state.music&&songById(state.music.id)||state.songs[0]||null;return state.music}
const cleanSongName=v=>String(v??'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,60)||'Song';
function cleanSong(x){const m=cleanMusic(x);return m&&{name:cleanSongName(x.name),...m}}
// SAFETY: songs from files are rebuilt from in-range numbers; anything else is dropped.
function cleanMusic(m){
  if(!m||typeof m!=='object'||!Array.isArray(m.tracks))return null;
  const int=(v,d,lo,hi)=>Math.round(numIn(v,d,lo,hi));
  const o={bpm:int(m.bpm,120,20,300),beats:int(m.beats,4,1,32),unit:METER_UNITS.includes(+m.unit)?+m.unit:4,res:[2,3,4,6,8].includes(+m.res)?+m.res:4,bars:int(m.bars,4,1,64),tracks:[]};
  const groups=parseGroups(Array.isArray(m.groups)?m.groups.join('+'):'',o.beats);if(groups)o.groups=groups;
  let total=0;
  for(const t of m.tracks.slice(0,16)){
    if(!t||typeof t!=='object')continue;
    const notes=[];
    for(const n of Array.isArray(t.notes)?t.notes:[]){
      if(!n||typeof n!=='object'||++total>20000)break;
      notes.push({t:int(n.t,0,0,SEQ_MAX_TICK),d:int(n.d,PPQ/4,1,SEQ_MAX_TICK),p:int(n.p,60,0,127),v:int(n.v,100,1,127)});
    }
    notes.sort((a,b)=>a.t-b.t||a.p-b.p);
    const tr={name:String(t.name??'Track').replace(/[\u0000-\u001f]/g,'').slice(0,40),drums:!!t.drums,prog:int(t.prog,0,0,127),vol:int(t.vol,100,0,127),mute:!!t.mute,notes};if(t.solo===true)tr.solo=true;
    const fx=cleanFx(t.fx);if(fx.length)tr.fx=fx;
    if(typeof t.smp==='string'){tr.smp=t.smp.replace(/[^\w-]/g,'').slice(0,20);tr.root=int(t.root,60,0,127);tr.pitched=t.pitched!==false;tr.gate=!!t.gate}
    o.tracks.push(tr);
  }
  const smp=cleanSamples(m.samples);if(smp.length)o.samples=smp;
  for(const tr of o.tracks)if(tr.smp!=null&&!smp.some(s=>s.id===tr.smp)){delete tr.smp;delete tr.root;delete tr.pitched;delete tr.gate}
  const mf=cleanFx(m.fx);if(mf.length)o.fx=mf;
  return o;
}
// FORMAT: a meter is beats (the top number, 1–32) of unit (the bottom): 2, 4, 8 or 16, or an irrational 3, 6 or 12,
//   a third, sixth or twelfth of a whole note (7/3 is seven beats of a triplet half). groups is the additive grouping
//   that places the accents (7/8 as 2+2+3); without one, meterGroups works it out.
const METER_UNITS=[2,3,4,6,8,12,16];
const beatTicks=m=>PPQ*4/(m.unit||4);
const barTicks=m=>m.beats*beatTicks(m);
const irrational=m=>(m.unit||4)%3===0;
// RULE: the note grid divides a quarter in ordinary meters; in an irrational one it divides the beat, in halves,
//   quarters or eighths, so notes stay on its beats (a sixteenth doesn't divide a 7/3 beat).
const gridTicks=m=>irrational(m)?beatTicks(m)/({2:2,3:2,4:4,6:4,8:8}[m.res]||4):PPQ/m.res;
// RULE: default grouping: simple meters of up to four beats accent every beat; 6/8, 9/8 and 12/8 go in threes; the
//   rest in twos with a three at the end (5 = 2+3, 7 = 2+2+3, 11 = 2+2+2+2+3).
function meterGroups(m){
  const g=m.groups,n=m.beats;
  if(Array.isArray(g)&&g.length&&g.every(x=>Number.isInteger(x)&&x>=1)&&g.reduce((a,b)=>a+b,0)===n)return g;
  if(n<=4&&(m.unit||4)<=4)return Array(n).fill(1);
  if((m.unit||4)>=8&&n%3===0)return Array(n/3).fill(3);
  const out=[];let k=n;while(k>4){out.push(2);k-=2}
  if(k===4)out.push(2,2);else if(k===3)out.push(3);else if(k===2)out.push(2);else if(out.length)out[out.length-1]++;else out.push(1);
  return out;
}
const parseGroups=(v,beats)=>{const g=String(v||'').split(/[+\s,]+/).filter(Boolean).map(Number);return g.length&&g.every(x=>Number.isInteger(x)&&x>=1)&&g.reduce((a,b)=>a+b,0)===beats?g:null};
const songEnd=m=>m.bars*barTicks(m);


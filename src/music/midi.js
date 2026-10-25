// SECTION: MIDI import
// SAFETY: parsed by hand with every length checked; anything inconsistent is refused, never half-read.
// RULE: a note never released is held to the end of its track; a channel's first volume (CC 7) is its track's
//   volume. What can't come across is counted for the import's message: tempo changes (the song keeps the first) and
//   notes past 64 bars.
// FORMAT: midiInfo = {tempos: distinct tempos seen, cut: notes past the song's last bar}, from the last parse.
let midiInfo={tempos:0,cut:0};
function parseMidi(buf){
  const b=new Uint8Array(buf),N=b.length,bad=()=>{throw new Error('That isn’t a MIDI file PIXIWYG can read.')};
  let i=0;const u32=()=>{if(i+4>N)bad();const v=(b[i]<<24|b[i+1]<<16|b[i+2]<<8|b[i+3])>>>0;i+=4;return v},u16=()=>{if(i+2>N)bad();const v=b[i]<<8|b[i+1];i+=2;return v};
  const id=()=>{if(i+4>N)bad();const v=String.fromCharCode(b[i],b[i+1],b[i+2],b[i+3]);i+=4;return v};
  if(id()!=='MThd')bad();const hl=u32();if(hl<6)bad();const fmt=u16(),ntrk=u16(),div=u16();i+=hl-6;
  if(fmt>2||!ntrk||ntrk>256)bad();if(div&0x8000)throw new Error('This MIDI file counts time in SMPTE frames, which PIXIWYG doesn’t read.');
  const k=PPQ/div;let bpm=0,beats=0,unit=4,total=0;const parts=new Map(),names=[],tempos=new Set(),vols=new Map();
  for(let tr=0;tr<ntrk&&i<N;tr++){
    while(i+8<=N&&String.fromCharCode(b[i],b[i+1],b[i+2],b[i+3])!=='MTrk'){i+=4;const l=u32();i+=l}
    if(i+8>N)break;id();const len=u32(),end=i+len;if(end>N)bad();
    let t=0,run=0,name='';const on=new Map(),prog=new Map();
    const close=(ch,p,n,tick)=>{if(!parts.has(ch))parts.set(ch,{ch,prog:prog.get(ch)??0,name:'',notes:[]});const P=parts.get(ch);
      if(++total>20000)throw new Error('That MIDI file has more than 20,000 notes, more than PIXIWYG keeps.');
      P.notes.push({t:n.t,d:Math.max(1,tick-n.t),p,v:Math.max(1,Math.min(127,n.v))});if(!P.name&&name)P.name=name;P.prog=prog.get(ch)??P.prog};
    const vlq=()=>{let v=0,c,n=0;do{if(i>=end||++n>4)bad();c=b[i++];v=v*128+(c&127)}while(c&128);return v};
    while(i<end){
      t+=vlq();let st=b[i];if(st&0x80){i++;if(st<0xf0)run=st}else{if(!run)bad();st=run}
      if(st===0xff){const ty=b[i++],l=vlq();if(i+l>end)bad();
        if(ty===0x51&&l===3){const q=6e7/(b[i]<<16|b[i+1]<<8|b[i+2]);tempos.add(Math.round(q));if(!bpm)bpm=q}
        if(ty===0x58&&l>=2&&!beats){beats=b[i];unit=2**b[i+1]}
        if(ty===0x03&&!name)name=String.fromCharCode(...b.slice(i,i+Math.min(l,40))).replace(/[^\x20-\x7e]/g,'').trim();
        i+=l;continue}
      if(st===0xf0||st===0xf7){const l=vlq();i+=l;if(i>end)bad();continue}
      const hi=st&0xf0,ch=st&15,a=b[i++],c=hi===0xc0||hi===0xd0?0:b[i++];if(i>end)bad();
      const key=ch*128+a,tick=Math.round(t*k);
      if(hi===0xc0)prog.set(ch,a&127);
      else if(hi===0xb0&&a===7&&!vols.has(ch))vols.set(ch,c&127);
      else if(hi===0x90&&c>0){if(!on.has(key))on.set(key,[]);on.get(key).push({t:tick,v:c})}
      else if(hi===0x80||(hi===0x90&&c===0)){const q=on.get(key);if(q&&q.length)close(ch,a&127,q.shift(),tick)}
    }
    const tEnd=Math.round(t*k);for(const [key,q] of on)for(const n of q)close(key>>7,key&127,n,Math.max(n.t+1,tEnd));
    names.push(name);i=end;
  }
  if(!parts.size)throw new Error('That MIDI file has no notes in it.');
  const bt=Math.max(1,Math.min(32,beats||4)),un=METER_UNITS.includes(unit)?unit:4,last=Math.max(...[...parts.values()].flatMap(p=>p.notes.map(n=>n.t+n.d)));
  const tracks=[...parts.values()].sort((a,b)=>a.ch-b.ch).slice(0,16).map(p=>({name:p.name||(p.ch===9?'Drums':GM.find(g=>g[0]===p.prog)?.[1]||'Program '+(p.prog+1)),drums:p.ch===9,prog:p.ch===9?0:p.prog,vol:vols.get(p.ch)??100,mute:false,notes:p.notes}));
  const m=cleanMusic({bpm:Math.round(bpm||120),beats:bt,unit:un,res:4,bars:Math.min(64,Math.ceil(last/(bt*PPQ*4/un))),tracks});
  if(m){const e=songEnd(m);midiInfo={tempos:tempos.size,cut:m.tracks.reduce((a,t)=>a+t.notes.filter(n=>n.t>=e).length,0)}}
  return m;
}
// RULE: a song reaches the page as a button that plays and stops it: a click node wired to the song's node.
function songButton(s,at){
  const st=nextStyleFor('button'),el={id:nid('e'),tag:'button',fileId:st.fileId,selector:st.selector,x:Math.round(at.x),y:Math.round(at.y),z:maxZ()+1,content:'▶ '+s.name};
  state.els.push(el);const L=state.logic||(state.logic=emptyGraph()),y=40+L.nodes.length*30;
  const a={id:'n'+nid('').slice(-8)+L.nodes.length,type:'click',x:40,y,f:{...nodeDefaults('click'),el:el.id}},b2={id:'n'+nid('').slice(-8)+(L.nodes.length+1),type:'song',x:320,y,f:{...nodeDefaults('song'),what:'toggle',song:s.id,el:el.id}};
  L.nodes.push(a,b2);L.wires.push({a:a.id,ap:'fire',b:b2.id,bp:'in'});renderAll();select(el.id);
  return el;
}
$('#seqToPage').onclick=()=>{audio();const s=useSong();if(!s||!state.project)return;pushUndo();const c=viewCenter();songButton(s,{x:c.x-60,y:c.y});save();sfx('pop');
  status(`“${s.name}” has a button on the page: pressing it plays the song. Double-click it to come back here.`)};
async function importMidi(file,at){
  let m;try{m=parseMidi(await file.arrayBuffer())}catch(e){status(e.message);return null}
  pushUndo();const s=newSong(cleanSongName(file.name.replace(/\.midi?$/i,'')),m);
  if(at&&state.project)songButton(s,at);
  save();if(!$('#seqModal').hidden){useSong(s.id);songSync();seqControls();seqTracks();seqLayout();seqDraw()}
  const warn=(midiInfo.tempos>1?` It changes tempo ${midiInfo.tempos-1} time${midiInfo.tempos>2?'s':''}; the song keeps the first.`:'')+(midiInfo.cut?` ${midiInfo.cut} notes past bar 64 were left out.`:'');
  status(`Imported ${s.name}: ${m.tracks.length} track${m.tracks.length===1?'':'s'}, ${m.bars} bars at ${m.bpm} BPM.${warn}${at?' Its button plays it; double-click the button to open it in the Sequencer.':''}`);
  return s;
}
// FORMAT: SMF format 1: a tempo track, then one track per unmuted instrument.
// HACK: a MIDI time signature's bottom number is a power of two, so an irrational meter (7/3) is written with the next
//   one up (7/4); the notes keep their real timing, only another program's bar lines differ.
function midiBytes(m,title){
  const vlq=n=>{const b=[n&127];while((n>>>=7)>0)b.unshift((n&127)|128);return b};
  const text=(type,s)=>{const b=[...te.encode(s)].slice(0,127);return[255,type,...vlq(b.length),...b]};
  const end=songEnd(m);
  const track=(evs)=>{evs.sort((a,b)=>a.t-b.t||a.o-b.o);let last=0;const out=[];for(const e of evs){out.push(...vlq(e.t-last),...e.d);last=e.t}out.push(...vlq(end-last),255,47,0);return out};
  const chunk=(id,data)=>{const n=data.length;return[...te.encode(id),n>>>24&255,n>>>16&255,n>>>8&255,n&255,...data]};
  const us=Math.round(6e7/m.bpm);
  const tracks=[track([{t:0,o:0,d:text(3,title||'PIXIWYG song')},{t:0,o:0,d:[255,81,3,us>>16&255,us>>8&255,us&255]},{t:0,o:0,d:[255,88,4,Math.min(255,m.beats),Math.round(Math.log2((m.unit||4)%3?m.unit||4:(m.unit*4/3))),24,8]}])];
  let ch=0;
  for(const t of m.tracks){
    if(t.mute)continue;
    let c;if(t.drums)c=9;else{if(ch===9)ch++;if(ch>15)continue;c=ch++}
    const evs=[{t:0,o:0,d:text(3,t.name)},{t:0,o:0,d:[176|c,7,t.vol]}];
    if(!t.drums||t.prog)evs.push({t:0,o:0,d:[192|c,t.prog]});
    for(const n of t.notes){if(n.t>=end)continue;
      // INVARIANT: note-offs sort before note-ons at the same tick so repeated notes restrike.
      evs.push({t:n.t,o:2,d:[144|c,n.p,n.v]},{t:Math.min(end,n.t+n.d),o:1,d:[128|c,n.p,0]})}
    tracks.push(track(evs));
  }
  const head=[0,1,tracks.length>>8,tracks.length&255,PPQ>>8,PPQ&255];
  return new Uint8Array([...chunk('MThd',head),...tracks.flatMap(t=>chunk('MTrk',t))]);
}


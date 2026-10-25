// SECTION: sequencer editor: the piano roll, tracks, songs, skins
// PERF: the roll canvas covers the viewport only and follows the scroll.
// RULE: the velocity lane starts hidden on short screens, where the notes need the height.
// FORMAT: selN holds note objects of the picked track; clip is copied notes, times from the first one's start.
const seq={sel:0,drag:null,hover:null,selN:new Set(),clip:null,mode:'draw',lane:innerHeight>=760};
// FORMAT: KW key column, RH ruler height, BW pixels a quarter note (the zoom, 24–384), LANE the velocity lane.
const SQ={KW:96,RH:22,BW:96,LANE:64};
// RULE: on touch screens rows are tall enough for a fingertip.
const SEQ_COARSE=matchMedia('(pointer:coarse)');
const seqTrackSel=()=>state.music.tracks[Math.min(seq.sel,state.music.tracks.length-1)];
function seqRows(t){return t.drums?DRUMS.map(k=>k[0]):Array.from({length:73},(_,i)=>96-i)}
const rowH=t=>t.drums?26:SEQ_COARSE.matches?22:15;
function seqSize(){
  const m=state.music,t=seqTrackSel(),quarters=songEnd(m)/PPQ;
  return{w:SQ.KW+quarters*SQ.BW,h:SQ.RH+seqRows(t).length*rowH(t)+(seq.lane?SQ.LANE:0)};
}
function songSync(){
  const sel=$('#seqSong');sel.replaceChildren();
  for(const s of state.songs)sel.append(mkEl('option',{value:s.id,textContent:s.name}));
  if(state.music)sel.value=state.music.id;$('#seqSongName').value=state.music?state.music.name:'';$('#seqSongDel').disabled=!state.music;
  if(typeof wsSync==='function')wsSync();
}
function openSong(id){if(seqP.on)seqStop();seqSelClear();useSong(id);seq.sel=0;songSync();seqControls();seqTracks();seqLayout();seqDraw()}
$('#seqSong').onchange=e=>openSong(e.target.value);
$('#seqSongName').oninput=e=>{if(!state.music)return;seqEdit(()=>{state.music.name=cleanSongName(e.target.value)});const o=$('#seqSong').selectedOptions[0];if(o)o.textContent=state.music.name;if(typeof wsSync==='function')wsSync()};
$('#seqSongNew').onclick=()=>{audio();pushUndo();const s=newSong();save();openSong(s.id);$('#seqSongName').select()};
$('#seqSongImport').onclick=()=>{audio();$('#seqMidiFile').click()};
$('#seqMidiFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f){const s=await importMidi(f);if(s)openSong(s.id)}};
$('#seqSongDel').onclick=()=>{const m=state.music;if(!m)return;const n=m.tracks.reduce((a,t)=>a+t.notes.length,0);
  if(n&&!confirm(`Remove “${m.name}” and its ${n} notes from the project?`))return;
  pushUndo();state.songs=state.songs.filter(s=>s!==m);if(!state.songs.length)newSong('Song 1');save();openSong(state.songs[0].id);status(`Removed ${m.name}. Undo brings it back.`)};
function skinSync(){
  const sel=$('#seqSkin');sel.replaceChildren();
  for(const s of SKINS)sel.append(mkEl('option',{value:s.id,textContent:s.name}));
  if(state.player&&state.player.skin==='custom')sel.append(mkEl('option',{value:'custom',textContent:state.player.name}));
  sel.value=state.player?state.player.skin:'base';
}
function setSkin(pl){pushUndo();state.player=pl;save();skinSync();PLAYER.skinChanged()}
async function loadSkinFile(file){
  if(file.size>SKIN_MAX){status(`That skin is ${(file.size/1048576).toFixed(1)} MB; skins over ${SKIN_MAX/1048576} MB aren’t kept.`);return false}
  const b=new Uint8Array(await file.arrayBuffer());
  if(b[0]!==0x50||b[1]!==0x4b){status('That isn’t a Winamp skin (.wsz files are zips).');return false}
  setSkin({skin:'custom',name:file.name.replace(/\.(wsz|zip)$/i,'').slice(0,60),data:`data:${SKIN_MIME};base64,${bytesB64(b)}`});
  status(`The player now wears ${state.player.name}`);return true;
}
$('#seqSkin').onchange=e=>{const v=e.target.value;if(v==='custom')return;setSkin(v==='base'?null:{skin:v})};
$('#seqSkinLoad').onclick=()=>{audio();$('#seqSkinFile').click()};
$('#seqSkinFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f)await loadSkinFile(f)};
$('#seqPlayer').onclick=()=>{audio();if(seqP.on)seqStop();PLAYER.control('play',$('#seqModal .seqwin'))};
function openSeq(){
  if(!state.project)return;if(state.editing)finishEdit();
  if(!useSong()){state.music=newSong('Song 1');save()}
  sfRestore();skinSync();songSync();
  seq.sel=Math.min(seq.sel,state.music.tracks.length-1);
  $('#seqModal').hidden=false;seqControls();seqTracks();seqToolsSync();
  requestAnimationFrame(()=>{seqLayout();seqShowNotes(true);seqDraw()});
  $('#seqScroll').focus();
}
function closeSeq(){if($('#seqModal').hidden)return;seqStop();$('#seqModal').hidden=true}
// INVARIANT: edits made in one synchronous run share one undo step.
// FIX: re-armed in a microtask, not a timer: Chromium runs queued input ahead of timers, so fast keys (a held arrow, a
//   quick nudge then Delete) merged separate edits into one step.
let seqArmed=true;
function seqEdit(fn){if(seqArmed){pushUndo();seqArmed=false;queueMicrotask(()=>seqArmed=true)}fn();save()}
function seqControls(){
  const m=state.music;$('#seqBpm').value=m.bpm;$('#seqBars').value=m.bars;$('#seqBeats').value=m.beats;$('#seqUnit').value=String(m.unit||4);$('#seqGroups').value=m.groups?m.groups.join('+'):'';$('#seqGroups').placeholder=meterGroups(m).join('+');$('#seqRes').value=m.res;$('#seqLoop').checked=seqP.loop;
}
function seqTracks(){
  const box=$('#seqTrackList'),m=state.music;box.replaceChildren();
  m.tracks.forEach((t,i)=>{
    const row=mkEl('div',{className:'sqtrack'+(i===seq.sel?' on':'')});row.style.setProperty('--tc',SEQ_COLORS[i%8]);
    row.onclick=e=>{if(e.target.closest('input,select,button'))return;seqPick(i)};
    const name=mkEl('input',{type:'text',value:t.name,maxLength:40});name.setAttribute('aria-label','Track name');
    name.onfocus=()=>{if(seq.sel!==i)seqPick(i)};
    name.oninput=()=>seqEdit(()=>{t.name=name.value});
    const inst=mkEl('select');inst.setAttribute('aria-label',t.drums?'Drum kit':'Instrument');
    const choices=seqChoices(t);for(const [p,n] of choices)inst.append(mkEl('option',{value:p,textContent:n}));
    if(!choices.some(c=>c[0]===t.prog))inst.append(mkEl('option',{value:t.prog,textContent:(t.drums?'Kit ':'Program ')+(t.prog+1)+(soundfont?' (not in this SoundFont)':'')}));
    // RULE: melodic tracks can play a sample from the song instead of an instrument.
    if(!t.drums){const og=mkEl('optgroup');og.label='Samples';for(const s of m.samples||[])og.append(mkEl('option',{value:'s:'+s.id,textContent:'♬ '+s.name}));og.append(mkEl('option',{value:'add',textContent:'+ Load a sample…'}));inst.append(og)}
    inst.value=t.smp!=null?'s:'+t.smp:t.prog;inst.disabled=t.drums&&choices.length<2;
    inst.onchange=()=>{if(inst.value==='add'){inst.value=t.smp!=null?'s:'+t.smp:t.prog;$('#seqSampleIn').click();return}
      if(inst.value.startsWith('s:')){const id=inst.value.slice(2);seqEdit(()=>{t.smp=id;t.root=t.root??60;t.pitched=t.pitched!==false;t.gate=!!t.gate});seqTracks();audio();samplesReady(m).then(()=>playNote(t,t.root??60,ac.currentTime+.02,.5,100));return}
      seqEdit(()=>{delete t.smp;delete t.root;delete t.pitched;delete t.gate;const was=choices.find(c=>c[0]===t.prog);t.prog=+inst.value;const g=choices.find(c=>c[0]===t.prog);
      if(!t.drums&&g&&((was&&was[1]===t.name)||GM.some(x=>x[1]===t.name)||/^Track( \d+)?$/.test(t.name)))t.name=g[1].replace(/^\d+\. /,'')});seqTracks();audio();playNote(t,60,ac.currentTime+.01,.4,100)};
    const vol=mkEl('input',{type:'range',min:0,max:127,value:t.vol});vol.setAttribute('aria-label','Volume');vol.title='Volume';
    vol.onchange=()=>seqEdit(()=>{t.vol=+vol.value});
    const solo=mkEl('button',{type:'button',className:'btn sqm'+(t.solo?' on':''),textContent:'S',title:'Solo: hear only this track (and other soloed ones) here. Files and the page still play every track'});solo.setAttribute('aria-pressed',!!t.solo);
    solo.onclick=()=>{seqEdit(()=>{if(t.solo)delete t.solo;else t.solo=true});seqTracks();seqDraw()};
    const mute=mkEl('button',{type:'button',className:'btn sqm'+(t.mute?' on':''),textContent:'M',title:'Mute: not played, and left out of the .mid file'});mute.setAttribute('aria-pressed',t.mute);
    mute.onclick=()=>{seqEdit(()=>{t.mute=!t.mute});seqTracks();seqDraw()};
    const del=mkEl('button',{type:'button',className:'btn sqm',textContent:'×',title:'Remove this track'});del.setAttribute('aria-label','Remove track');
    del.disabled=m.tracks.length<2;
    del.onclick=()=>{if(t.notes.length&&!confirm(`Remove “${t.name}” and its ${t.notes.length} notes?`))return;seqEdit(()=>{m.tracks.splice(i,1)});seq.sel=Math.min(seq.sel,m.tracks.length-1);seqTracks();seqLayout();seqDraw()};
    const fxb=mkEl('button',{type:'button',className:'btn sqm'+((t.fx||[]).some(f=>f.on)?' on':''),textContent:'FX'+((t.fx||[]).length?' '+t.fx.length:''),title:'Effects on this track: EQ, filter, compressor, drive, chorus, delay, reverb, pan'});
    fxb.onclick=()=>{audio();openFxPanel(t)};
    const top=mkEl('div',{className:'sqtop'});top.append(mkEl('i',{className:'sqdot'}),name,fxb,solo,mute,del);
    const bot=mkEl('div',{className:'sqtop'});bot.append(inst,vol);
    row.append(top,bot);box.append(row);
  });
  $('#seqAddMel').disabled=$('#seqAddDrum').disabled=m.tracks.length>=16;
}
// RULE: picking a track keeps the list DOM (a name being typed keeps focus) and redraws only the grid.
function seqPick(i){if(seq.sel!==i)seqSelClear();seq.sel=i;[...$('#seqTrackList').children].forEach((r,k)=>r.classList.toggle('on',k===i));seqLayout();seqShowNotes();seqDraw()}
// RULE: a track's notes are never off screen when it is picked: if none show, they are centered (C5 for an empty
//   track when asked to place it anyway).
function seqShowNotes(always){
  const t=seqTrackSel();if(!t||t.drums)return;const sc=$('#seqScroll'),rh=rowH(t),vh=sc.clientHeight-SQ.RH;
  if(!t.notes.length){if(always)sc.scrollTop=(96-72)*rh;return}
  let lo=127,hi=0;for(const n of t.notes){if(n.p<lo)lo=n.p;if(n.p>hi)hi=n.p}
  const top=(96-Math.min(96,hi))*rh,bot=(96-Math.max(24,lo)+1)*rh;
  if(!always&&t.notes.some(n=>{const y=(96-n.p)*rh;return y>=sc.scrollTop&&y+rh<=sc.scrollTop+vh}))return;
  sc.scrollTop=Math.max(0,(top+bot)/2-vh/2);
}
// RULE: zoom keeps the moment under the pointer (or the view's left edge) where it is.
function seqZoomTo(bw,cx){
  const sc=$('#seqScroll'),r=sc.getBoundingClientRect(),vx=cx==null?SQ.KW:cx-r.left,tick=(vx-SQ.KW+sc.scrollLeft)*PPQ/SQ.BW;
  const nb=Math.max(24,Math.min(384,Math.round(bw)));if(nb===SQ.BW)return;
  SQ.BW=nb;seqLayout();sc.scrollLeft=Math.max(0,tick*nb/PPQ-vx+SQ.KW);seqDraw();
}
function seqChoices(t){
  if(soundfont){const list=soundfont.presets.filter(p=>t.drums?p.bank===128:p.bank!==128).sort((a,b)=>a.prog-b.prog||a.bank-b.bank),seen=new Set(),out=[];
    for(const p of list)if(!seen.has(p.prog)){seen.add(p.prog);out.push([p.prog,`${p.prog+1}. ${p.name}`])}
    if(out.length)return out}
  return t.drums?[[0,'Drum kit']]:GM.map(([p,n])=>[p,n]);
}
function seqLayout(){
  const sc=$('#seqScroll'),{w,h}=seqSize(),sp=$('#seqSpace');sp.style.width=w+'px';sp.style.height=h+'px';
  const cv=$('#seqCanvas'),dpr=devicePixelRatio||1,vw=sc.clientWidth,vh=sc.clientHeight;
  cv.style.width=vw+'px';cv.style.height=vh+'px';cv.width=Math.round(vw*dpr);cv.height=Math.round(vh*dpr);
}
function seqColors(){const cs=getComputedStyle(document.body),v=k=>cs.getPropertyValue(k).trim();return{paper:v('--paper')||'#fff',ink:v('--ink')||'#000',chrome:v('--chrome')||'#eee',chrome2:v('--chrome2')||'#ccc',muted:v('--muted')||'#666',sel:v('--sel')||'#2e5bff',hot:v('--hot')||'#ff2e88'}}
function seqDraw(){
  if($('#seqModal').hidden||!state.music)return;
  const m=state.music,t=seqTrackSel(),rows=seqRows(t),rh=rowH(t),sc=$('#seqScroll'),cv=$('#seqCanvas'),x=cv.getContext('2d');
  // PERF: the selection is checked against the track once per edit (save or undo bumps editGen), not every frame.
  if(seq.selN.size&&seq.selGen!==editGen){seq.selGen=editGen;seqSelPrune()}
  const dpr=devicePixelRatio||1,vw=sc.clientWidth,vh=sc.clientHeight,L=sc.scrollLeft,T=sc.scrollTop,C=seqColors();
  x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,vw,vh);
  const {KW,RH,BW}=SQ,gt=gridTicks(m),tk=PPQ/BW,sw=gt/tk,end=songEnd(m),gx=tick=>KW+tick/tk-L,gy=r=>RH+r*rh-T;
  x.fillStyle=C.paper;x.fillRect(KW,RH,vw-KW,vh-RH);
  const hv=!seq.drag&&seq.hover&&seq.hover.ok&&(seq.hover.zone==='grid'||seq.hover.zone==='keys')?seq.hover:null,hr=hv?rows.indexOf(hv.p):-1;
  rows.forEach((p,r)=>{const y=gy(r);if(y+rh<RH||y>vh)return;
    if(t.drums?r%2:isBlack(p)){x.fillStyle=C.chrome;x.globalAlpha=.7;x.fillRect(KW,y,vw-KW,rh);x.globalAlpha=1}
    if(r===hr){x.fillStyle=C.sel;x.globalAlpha=.12;x.fillRect(KW,y,vw-KW,rh);x.globalAlpha=1}
    if(!t.drums&&p%12===0){x.fillStyle=C.chrome2;x.fillRect(KW,y+rh-1,vw-KW,1)}});
  const first=Math.max(0,Math.floor((L)/sw)),last=Math.ceil((L+vw)/sw);
  // RULE: lines get heavier from grid to beat to group (the meter's accents) to bar.
  const bt=beatTicks(m),barT=barTicks(m),starts=new Set(meterGroups(m).reduce((a,g)=>(a.push(a.at(-1)+g),a),[0]).slice(0,-1).map(b=>b*bt));
  for(let s=first;s<=last;s++){const tick=s*gt;if(tick>end)break;const X=Math.round(gx(tick))+.5;if(X<KW)continue;
    const bar=tick%barT===0,group=!bar&&starts.has(tick%barT),beat=tick%bt===0;
    x.strokeStyle=bar||group?C.ink:beat?C.muted:C.chrome2;x.globalAlpha=bar?.9:group?.6:beat?.45:.6;x.lineWidth=bar?1.5:group?1.25:1;
    x.beginPath();x.moveTo(X,RH);x.lineTo(X,vh);x.stroke();x.globalAlpha=1}
  const ex=gx(end);if(ex<vw){x.fillStyle=C.ink;x.globalAlpha=.12;x.fillRect(Math.max(KW,ex),RH,vw,vh);x.globalAlpha=1}
  // RULE: other melodic tracks draw faintly so parts can be written against each other.
  const row=new Map(rows.map((p,i)=>[p,i])),col=i=>SEQ_COLORS[i%8];
  if(!t.drums)m.tracks.forEach((o,i)=>{if(o===t||o.drums)return;x.fillStyle=col(i);x.globalAlpha=.22;
    for(const n of o.notes){const r=row.get(n.p);if(r==null)continue;const X=gx(n.t),W=n.d/tk;if(X+W<KW||X>vw)continue;x.fillRect(X+1,gy(r)+2,W-2,rh-4)}x.globalAlpha=1});
  const ti=m.tracks.indexOf(t);
  for(const n of t.notes){const r=row.get(n.p);if(r==null)continue;const X=gx(n.t),W=Math.max(4,n.d/tk),Y=gy(r);if(X+W<KW||X>vw||Y+rh<RH||Y>vh)continue;
    x.globalAlpha=(n.t>=end?.3:t.mute?.45:1)*(.35+.65*n.v/127);x.fillStyle=col(ti);x.fillRect(X+1,Y+1,W-2,rh-2);x.globalAlpha=n.t>=end?.3:t.mute?.45:1;
    const on=seq.selN.has(n);x.strokeStyle=on?C.sel:C.ink;x.lineWidth=on?3:n.v>110?2.5:1;x.strokeRect(X+1.5,Y+1.5,W-3,rh-3);
    if(n.v>110){x.fillStyle='#fff';x.fillRect(X+3,Y+3,3,rh-6)}x.globalAlpha=1}
  const bx=seq.drag&&seq.drag.kind==='box'?seq.drag:null;
  if(bx){const X0=gx(Math.min(bx.t0,bx.t1)),X1=gx(Math.max(bx.t0,bx.t1)),Y0=gy(Math.min(bx.r0,bx.r1)),Y1=gy(Math.max(bx.r0,bx.r1)+1);
    x.fillStyle=C.sel;x.globalAlpha=.12;x.fillRect(X0,Y0,X1-X0,Y1-Y0);x.globalAlpha=1;x.strokeStyle=C.sel;x.lineWidth=1.5;x.setLineDash([5,3]);x.strokeRect(X0+.5,Y0+.5,X1-X0,Y1-Y0);x.setLineDash([])}
  // RULE: the velocity lane draws each note's start as a stem as tall as it plays hard, selected ones outlined.
  if(seq.lane){const top=vh-SQ.LANE,H=SQ.LANE-8;x.fillStyle=C.chrome;x.fillRect(KW,top,vw-KW,SQ.LANE);x.fillStyle=C.ink;x.fillRect(KW,top,vw-KW,2);
    for(const n of t.notes){const X=gx(n.t);if(X<KW-6||X>vw)continue;const sh=Math.max(2,H*n.v/127),on=seq.selN.has(n);
      x.fillStyle=col(ti);x.globalAlpha=seq.selN.size&&!on?.4:1;x.fillRect(X,vh-4-sh,4,sh);x.fillRect(X-2,vh-4-sh,8,3);
      if(on){x.strokeStyle=C.sel;x.lineWidth=2;x.strokeRect(X-3,vh-5-sh,10,sh+2)}x.globalAlpha=1}}
  // RULE: hovering empty grid shows the note a click would make, at the length the last one was drawn.
  if(hv&&hv.zone==='grid'&&!hv.note&&hv.snap<end){const X=gx(hv.snap),W=Math.min(t.drums?hv.step:seqLastLen,end-hv.snap)/tk,Y=gy(hr);
    x.strokeStyle=col(ti);x.lineWidth=2;x.setLineDash([4,3]);x.strokeRect(X+1.5,Y+1.5,W-3,rh-3);x.setLineDash([])}
  x.fillStyle=C.chrome;x.fillRect(0,RH,KW,vh-RH);x.font='11px '+(getComputedStyle(document.body).getPropertyValue('--f-mono')||'monospace');x.textBaseline='middle';
  rows.forEach((p,r)=>{const y=gy(r);if(y+rh<RH||y>vh)return;
    if(t.drums){if(r===hr){x.fillStyle=C.sel;x.globalAlpha=.3;x.fillRect(0,y,KW,rh);x.globalAlpha=1}x.fillStyle=C.ink;x.fillText(DRUMS[r][1],8,y+rh/2)}
    else{x.fillStyle='#fdfcff';x.fillRect(0,y,KW,rh);if(isBlack(p)){x.fillStyle='#16121f';x.fillRect(0,y+1,58,rh-2)}
      if(p%12===0||p%12===5){x.fillStyle='#b9b4cc';x.fillRect(0,y+rh-1,KW,1)}
      if(r===hr){x.fillStyle=C.sel;x.globalAlpha=.45;x.fillRect(0,y,KW,rh);x.globalAlpha=1}
      if(p%12===0||r===hr){x.fillStyle='#16121f';x.fillText(noteName(p),KW-30,y+rh/2)}}});
  if(seq.lane){x.fillStyle=C.chrome;x.fillRect(0,vh-SQ.LANE,KW,SQ.LANE);x.fillStyle=C.ink;x.fillRect(0,vh-SQ.LANE,KW,2);x.fillText('Velocity',8,vh-SQ.LANE/2)}
  x.fillStyle=C.ink;x.fillRect(KW-2,RH,2,vh-RH);
  x.fillStyle=C.chrome;x.fillRect(0,0,vw,RH);x.fillStyle=C.ink;x.fillRect(0,RH-2,vw,2);
  for(let b=0;b<m.bars;b++){const X=gx(b*barTicks(m));if(X<KW-40||X>vw)continue;if(X>=KW){x.fillRect(Math.round(X),0,1.5,RH);x.fillText(String(b+1),X+5,RH/2)}}
  const cx=gx(seqP.cursor);if(cx>=KW){x.fillStyle=C.hot;x.beginPath();x.moveTo(cx-6,0);x.lineTo(cx+6,0);x.lineTo(cx,10);x.fill()}
  const now=seqP.on?seqNow():null;if(now!=null){const X=gx(now);if(X>=KW&&X<=vw){x.fillStyle=C.hot;x.fillRect(X-1,RH,2,vh-RH)}}
  x.fillStyle=C.chrome;x.fillRect(0,0,KW,RH);
}
function seqHit(e){
  const m=state.music,t=seqTrackSel(),cv=$('#seqCanvas').getBoundingClientRect(),sc=$('#seqScroll');
  const vx=e.clientX-cv.left,vy=e.clientY-cv.top,rows=seqRows(t),rh=rowH(t),lane=seq.lane?SQ.LANE:0,vh=sc.clientHeight;
  const tick=Math.max(0,(vx-SQ.KW+sc.scrollLeft)*PPQ/SQ.BW),r=Math.floor((vy-SQ.RH+sc.scrollTop)/rh);
  const step=gridTicks(m),vel=Math.max(1,Math.min(127,Math.round(127*(vh-4-vy)/(lane-8||1))));
  return{zone:vy<SQ.RH?'ruler':lane&&vy>=vh-lane?(vx<SQ.KW?'lanekeys':'vel'):vx<SQ.KW?'keys':'grid',tick,snap:Math.floor(tick/step)*step,p:rows[Math.max(0,Math.min(rows.length-1,r))],row:r,ok:r>=0&&r<rows.length,step,vel,vx};
}
function seqNoteAt(t,h){return t.notes.find(n=>n.p===h.p&&h.tick>=n.t&&h.tick<n.t+n.d)}
// RULE: a note's grab edge is its last 6 px, or its last third when it is drawn shorter than 18 px.
const seqEdge=(n,h)=>h.tick>=n.t+n.d-Math.min(n.d/3,6*PPQ/SQ.BW);
// INVARIANT: notes of one pitch never overlap; the earlier is cut where the later starts (MIDI can't represent overlap).
function seqTidy(t){
  t.notes.sort((a,b)=>a.p-b.p||a.t-b.t);
  for(let i=0;i<t.notes.length-1;i++){const a=t.notes[i],b=t.notes[i+1];if(a.p===b.p&&a.t+a.d>b.t){if(a.t===b.t){t.notes.splice(i,1);i--}else a.d=b.t-a.t}}
  t.notes.sort((a,b)=>a.t-b.t||a.p-b.p);
}
const seqHear=(t,p)=>{audio();if(ac&&seqOut())playNote(t,p,ac.currentTime+.01,.35,100)};
let seqLastLen=PPQ/4;
// RULE: Draw mode (the default) draws: click empty grid for a note, drag it for its length, click a note to
//   remove it, drag a note (or the selection it belongs to) to move, drag a note's end to resize. Select mode, or
//   Ctrl/Cmd in Draw, selects: click a note, Ctrl/Cmd+click to add or drop one, drag empty grid for a box.
function seqDown(e){
  if(e.button>0)return;const m=state.music,t=seqTrackSel(),h=seqHit(e);
  if(h.zone==='ruler'){seqP.cursor=Math.min(h.snap,songEnd(m)-h.step);if(seqP.on)seqPlay();seqDraw();return}
  if(h.zone==='keys'){if(h.ok)seqHear(t,h.p);return}
  if(h.zone==='lanekeys')return;
  const sc=$('#seqScroll');
  if(h.zone==='vel'){sc.setPointerCapture(e.pointerId);seq.drag={kind:'vel',moved:false,last:null};seqVelPaint(h);return}
  if(!h.ok||h.snap>=songEnd(m))return;
  sc.setPointerCapture(e.pointerId);
  const n=seqNoteAt(t,h),add=e.ctrlKey||e.metaKey,picking=seq.mode==='select'||add;
  if(n&&e.shiftKey&&!picking){seqEdit(()=>{n.v=n.v>110?100:127});seqDraw();return}
  if(n){
    if(picking){if(add){if(seq.selN.has(n)){seq.selN.delete(n);seqDraw();seqToolsSync();return}seq.selN.add(n)}else if(!seq.selN.has(n))seq.selN=new Set([n])}
    else if(!seq.selN.has(n))seq.selN.clear();
    const group=seq.selN.has(n)?[...seq.selN]:[n];
    if(!t.drums&&seqEdge(n,h))seq.drag={kind:'len',n,old:true,moved:false,group:group.map(x=>({n:x,d0:x.d})),d0:n.d};
    else seq.drag={kind:'move',n,h0:h,moved:false,pick:picking,group:group.map(x=>({n:x,t0:x.t,p0:x.p}))};
    seqDraw();seqToolsSync();return;
  }
  if(picking){if(!add)seq.selN.clear();seq.drag={kind:'box',t0:h.tick,r0:h.row,t1:h.tick,r1:h.row,base:new Set(seq.selN)};seqDraw();seqToolsSync();return}
  seq.selN.clear();seqToolsSync();
  const len=t.drums?h.step:seqLastLen;
  const nn={t:h.snap,d:Math.max(h.step,Math.min(len,songEnd(m)-h.snap)),p:h.p,v:100};
  seqEdit(()=>{t.notes.push(nn);seqTidy(t)});seqHear(t,h.p);
  seq.drag=t.drums?{kind:'paint',p:h.p,done:new Set([h.snap])}:{kind:'len',n:nn,moved:false,group:[{n:nn,d0:nn.d}],d0:nn.d};
  seqDraw();
}
function seqMove(e){
  const d=seq.drag;if(!d)return;const m=state.music,t=seqTrackSel(),h=seqHit(e),end=songEnd(m);
  if(d.kind==='vel'){seqVelPaint(h);return}
  if(d.kind==='box'){d.t1=h.tick;d.r1=h.row;seqDraw();return}
  if(d.kind==='len'){
    const dd=Math.max(h.step,Math.ceil((h.tick-d.n.t)/h.step)*h.step),delta=dd-d.d0;
    if(dd!==d.n.d){if(d.old&&!d.moved)pushUndo();for(const g of d.group)g.n.d=Math.max(h.step,Math.min(g.d0+delta,end-g.n.t));d.moved=true;seqDraw()}}
  else if(d.kind==='paint'){if(!d.done.has(h.snap)&&h.snap<end&&!t.notes.some(n=>n.p===d.p&&n.t===h.snap)){d.done.add(h.snap);t.notes.push({t:h.snap,d:h.step,p:d.p,v:100});seqTidy(t);seqHear(t,d.p);seqDraw()}}
  else if(d.kind==='move'){
    // INVARIANT: a group moves as one: the shift is clamped so no note leaves the song or the rows.
    const rows=seqRows(t),ri=p=>rows.indexOf(p),G=d.group;
    let dt=Math.round((h.tick-d.h0.tick)/h.step)*h.step,dr=ri(h.p)-ri(d.h0.p);
    const t0=Math.min(...G.map(g=>g.t0)),t1=Math.max(...G.map(g=>g.t0)),r0=Math.min(...G.map(g=>ri(g.p0))),r1=Math.max(...G.map(g=>ri(g.p0)));
    dt=Math.max(-t0,Math.min(end-h.step-t1,dt));dr=Math.max(-r0,Math.min(rows.length-1-r1,dr));
    if(G[0].n.t!==G[0].t0+dt||G[0].n.p!==rows[ri(G[0].p0)+dr]){
      if(!d.moved){pushUndo();d.moved=true}
      const lead=G.find(g=>g.n===d.n),np=rows[ri(lead.p0)+dr];if(np!==d.n.p)seqHear(t,np);
      for(const g of G){g.n.t=g.t0+dt;g.n.p=rows[ri(g.p0)+dr]}seqDraw()}
  }
}
function seqUp(){
  const d=seq.drag;seq.drag=null;if(!d)return;const t=seqTrackSel();
  if(d.kind==='box'){
    const rows=seqRows(t),lo=Math.min(d.t0,d.t1),hi=Math.max(d.t0,d.t1),ra=Math.min(d.r0,d.r1),rb=Math.max(d.r0,d.r1);
    seq.selN=new Set(d.base);for(const n of t.notes){const r=rows.indexOf(n.p);if(r>=ra&&r<=rb&&n.t<hi&&n.t+n.d>lo)seq.selN.add(n)}
    if(seq.selN.size)status(`${seq.selN.size} note${seq.selN.size===1?'':'s'} selected. Ctrl+C copies, Ctrl+V pastes at the cursor, arrows move, Delete removes.`);
  }
  else if(d.kind==='vel'){if(d.moved)save()}
  else if(d.kind==='move'&&!d.moved){if(!d.pick){seqEdit(()=>{t.notes.splice(t.notes.indexOf(d.n),1)});seq.selN.delete(d.n)}}
  else if(d.kind==='len'){if(d.moved||!d.old)seqLastLen=d.n.d;seqTidy(t);save()}
  else{seqTidy(t);save()}
  seqSelPrune();seqDraw();seqToolsSync();
}
// INVARIANT: the selection only holds notes still in the picked track (tidying can merge notes away).
function seqSelPrune(){const t=seqTrackSel(),have=new Set(t?t.notes:[]),k=seq.selN.size;for(const n of seq.selN)if(!have.has(n))seq.selN.delete(n);if(seq.selN.size!==k)seqToolsSync()}
// RULE: the lane sets how hard notes play by height; a drag paints across them. With a selection only selected notes
//   change.
function seqVelPaint(h){
  const d=seq.drag,t=seqTrackSel(),pool=seq.selN.size?[...seq.selN]:t.notes,px=PPQ/SQ.BW;
  const a=d.last||{tick:h.tick,vel:h.vel},b={tick:h.tick,vel:h.vel},lo=Math.min(a.tick,b.tick)-4*px,hi=Math.max(a.tick,b.tick)+4*px;
  const hit=pool.filter(n=>n.t>=lo&&n.t<=hi);d.last={tick:h.tick,vel:h.vel};if(!hit.length)return;
  if(!d.moved){pushUndo();d.moved=true}
  for(const n of hit){const f=b.tick!==a.tick?(n.t-a.tick)/(b.tick-a.tick):1;n.v=Math.max(1,Math.min(127,Math.round(a.vel+(b.vel-a.vel)*Math.max(0,Math.min(1,f)))))}
  status(`Velocity ${hit.at(-1).v}`);seqDraw();
}
function saveMidi(){
  const m=state.music;if(!m)return;
  const name=slug(m.name||'song')+'.mid';
  // RULE: MIDI has 15 channels for instruments (10 is the drums); a song with more says which didn't fit.
  const mel=m.tracks.filter(t=>!t.mute&&!t.drums),over=mel.slice(15).map(t=>t.name);
  download(new Blob([midiBytes(m,m.name||'PIXIWYG song')],{type:'audio/midi'}),name);
  status(over.length?`Saved ${name}, without ${over.join(', ')}: a MIDI file holds 15 instruments besides the drums.`:'Saved '+name);
}
{
  const sc=$('#seqScroll');
  sc.addEventListener('scroll',seqDraw);
  sc.addEventListener('pointerdown',seqDown);sc.addEventListener('pointermove',seqMove);
  sc.addEventListener('pointerup',seqUp);sc.addEventListener('pointercancel',seqUp);
  // PERF: hover redraws only when what it points at changes (row, grid step, or note and edge).
  sc.addEventListener('pointermove',e=>{if(seq.drag)return;const t=seqTrackSel(),h=seqHit(e),n=h.zone==='grid'&&h.ok&&seqNoteAt(t,h),edge=!!n&&!t.drums&&seqEdge(n,h);
    sc.style.cursor=h.zone!=='grid'?'pointer':edge?'ew-resize':n?'grab':'crosshair';
    const v={zone:h.zone,ok:h.ok,p:h.p,snap:h.snap,step:h.step,note:!!n,edge},o=seq.hover;
    if(!o||o.zone!==v.zone||o.ok!==v.ok||o.p!==v.p||o.snap!==v.snap||o.note!==v.note||o.edge!==v.edge){seq.hover=v;seqDraw()}});
  sc.addEventListener('pointerleave',()=>{if(seq.hover){seq.hover=null;seqDraw()}});
  sc.addEventListener('wheel',e=>{if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();seqZoomTo(SQ.BW*Math.pow(1.0015,-e.deltaY),e.clientX)},{passive:false});
  sc.addEventListener('contextmenu',e=>{e.preventDefault();const t=seqTrackSel(),h=seqHit(e),n=h.zone==='grid'&&seqNoteAt(t,h);if(n){seqEdit(()=>{t.notes.splice(t.notes.indexOf(n),1)});seqDraw()}});
  new ResizeObserver(()=>{if(!$('#seqModal').hidden){seqLayout();seqDraw()}}).observe(sc);
  // RULE: a tempo change while playing carries on from the same spot at the new speed; the cursor stays put.
  const num=(id,k,lo,hi)=>$(id).addEventListener('change',e=>{const v=Math.round(numIn(e.target.value,state.music[k],lo,hi)),m=state.music,at=k==='bpm'&&seqP.on?seqNow():null;
    seqEdit(()=>{const was=m[k];m[k]=v;if(k==='bpm')refitSamples(m,was)});e.target.value=v;$('#seqBars').value=m.bars;seqLayout();seqDraw();
    if(at!=null){const c=seqP.cursor,g=gridTicks(m);seqP.cursor=Math.floor((at%songEnd(m))/g)*g;seqPlay().finally(()=>{seqP.cursor=c})}});
  num('#seqBpm','bpm',20,300);num('#seqBars','bars',1,64);
  // RULE: changing the meter keeps the notes where they are in time and drops a grouping that no longer adds up.
  const meter=()=>{const m=state.music,b=Math.round(numIn($('#seqBeats').value,m.beats,1,32)),u=+$('#seqUnit').value,g=parseGroups($('#seqGroups').value,b);
    seqEdit(()=>{m.beats=b;m.unit=METER_UNITS.includes(u)?u:4;if(g)m.groups=g;else delete m.groups});seqControls();seqLayout();seqDraw()};
  $('#seqBeats').onchange=meter;$('#seqUnit').onchange=meter;$('#seqGroups').onchange=meter;
  $('#seqRes').onchange=e=>{seqEdit(()=>{state.music.res=+e.target.value});seqLastLen=gridTicks(state.music);seqDraw()};
  $('#seqLoop').onchange=e=>{seqP.loop=e.target.checked};
  $('#seqClick').onchange=e=>{audio();seqP.click=e.target.checked};
  $('#seqPlay').onclick=()=>{if(seqP.on)seqStop();else seqPlay()};
  $('#seqSave').onclick=()=>{audio();saveMidi()};
  const add=drums=>{const m=state.music;if(m.tracks.length>=16)return;seqEdit(()=>{const t=seqTrack(drums);if(!drums&&m.tracks.some(x=>x.name==='Piano'))t.name='Track '+(m.tracks.length+1);m.tracks.push(t)});seq.sel=m.tracks.length-1;seqTracks();seqLayout();seqDraw()};
  $('#seqAddMel').onclick=()=>add(false);$('#seqAddDrum').onclick=()=>add(true);
  $('#seqClear').onclick=()=>{const t=seqTrackSel();if(!t.notes.length)return;seqEdit(()=>{t.notes=[]});seqDraw();status('Cleared '+t.name)};
  $('#seqDone').onclick=closeSeq;$('#seqClose').onclick=closeSeq;
  // RULE: inside the sequencer Space toggles playback and undo/redo act on the song.
  $('#seqModal').addEventListener('keydown',e=>{
    const field=e.target.matches('input[type=text],input[type=number],select');
    if(e.key===' '&&!field){e.preventDefault();e.stopPropagation();if(seqP.on)seqStop();else seqPlay();return}
    if((e.key==='-'||e.key==='='||e.key==='+')&&!field&&!e.ctrlKey&&!e.metaKey){e.preventDefault();seqZoomTo(SQ.BW*(e.key==='-'?.8:1.25));return}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!field){e.preventDefault();e.stopPropagation();e.shiftKey?doRedo():doUndo();seqSelClear();if(!useSong())state.music=newSong('Song 1');songSync();seqControls();seqTracks();seqLayout();seqDraw()}
  });
}


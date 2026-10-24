// SECTION: sequencer editor: the piano roll, tracks, songs, skins
// PERF: the roll canvas covers the viewport only and follows the scroll.
const seq={sel:0,drag:null};
const SQ={KW:96,RH:22,BW:96};
const seqTrackSel=()=>state.music.tracks[Math.min(seq.sel,state.music.tracks.length-1)];
function seqRows(t){return t.drums?DRUMS.map(k=>k[0]):Array.from({length:73},(_,i)=>96-i)}
const rowH=t=>t.drums?26:15;
function seqSize(){
  const m=state.music,t=seqTrackSel(),beats=m.bars*m.beats;
  return{w:SQ.KW+beats*SQ.BW,h:SQ.RH+seqRows(t).length*rowH(t)};
}
function songSync(){
  const sel=$('#seqSong');sel.replaceChildren();
  for(const s of state.songs)sel.append(mkEl('option',{value:s.id,textContent:s.name}));
  if(state.music)sel.value=state.music.id;$('#seqSongName').value=state.music?state.music.name:'';$('#seqSongDel').disabled=!state.music;
  if(typeof wsSync==='function')wsSync();
}
function openSong(id){if(seqP.on)seqStop();useSong(id);seq.sel=0;songSync();seqControls();seqTracks();seqLayout();seqDraw()}
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
  $('#seqModal').hidden=false;seqControls();seqTracks();
  requestAnimationFrame(()=>{seqLayout();const t=seqTrackSel();if(!t.drums){const sc=$('#seqScroll');sc.scrollTop=(96-72)*rowH(t)}seqDraw()});
  $('#seqScroll').focus();
}
function closeSeq(){if($('#seqModal').hidden)return;seqStop();$('#seqModal').hidden=true}
let seqArmed=true;
function seqEdit(fn){if(seqArmed){pushUndo();seqArmed=false;setTimeout(()=>seqArmed=true,0)}fn();save()}
function seqControls(){
  const m=state.music;$('#seqBpm').value=m.bpm;$('#seqBars').value=m.bars;$('#seqBeats').value=m.beats;$('#seqRes').value=m.res;$('#seqLoop').checked=seqP.loop;
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
    const mute=mkEl('button',{type:'button',className:'btn sqm'+(t.mute?' on':''),textContent:'M',title:'Mute: not played, and left out of the .mid file'});mute.setAttribute('aria-pressed',t.mute);
    mute.onclick=()=>{seqEdit(()=>{t.mute=!t.mute});seqTracks();seqDraw()};
    const del=mkEl('button',{type:'button',className:'btn sqm',textContent:'×',title:'Remove this track'});del.setAttribute('aria-label','Remove track');
    del.disabled=m.tracks.length<2;
    del.onclick=()=>{if(t.notes.length&&!confirm(`Remove “${t.name}” and its ${t.notes.length} notes?`))return;seqEdit(()=>{m.tracks.splice(i,1)});seq.sel=Math.min(seq.sel,m.tracks.length-1);seqTracks();seqLayout();seqDraw()};
    const fxb=mkEl('button',{type:'button',className:'btn sqm'+((t.fx||[]).some(f=>f.on)?' on':''),textContent:'FX'+((t.fx||[]).length?' '+t.fx.length:''),title:'Effects on this track: EQ, filter, compressor, drive, chorus, delay, reverb, pan'});
    fxb.onclick=()=>{audio();openFxPanel(t)};
    const top=mkEl('div',{className:'sqtop'});top.append(mkEl('i',{className:'sqdot'}),name,fxb,mute,del);
    const bot=mkEl('div',{className:'sqtop'});bot.append(inst,vol);
    row.append(top,bot);box.append(row);
  });
  $('#seqAddMel').disabled=$('#seqAddDrum').disabled=m.tracks.length>=16;
}
// RULE: picking a track keeps the list DOM (a name being typed keeps focus) and redraws only the grid.
function seqPick(i){seq.sel=i;[...$('#seqTrackList').children].forEach((r,k)=>r.classList.toggle('on',k===i));seqLayout();seqDraw()}
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
  const dpr=devicePixelRatio||1,vw=sc.clientWidth,vh=sc.clientHeight,L=sc.scrollLeft,T=sc.scrollTop,C=seqColors();
  x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,vw,vh);
  const {KW,RH,BW}=SQ,sw=BW/m.res,tk=PPQ/BW,end=songEnd(m),gx=tick=>KW+tick/tk-L,gy=r=>RH+r*rh-T;
  x.fillStyle=C.paper;x.fillRect(KW,RH,vw-KW,vh-RH);
  rows.forEach((p,r)=>{const y=gy(r);if(y+rh<RH||y>vh)return;
    if(t.drums?r%2:isBlack(p)){x.fillStyle=C.chrome;x.globalAlpha=.7;x.fillRect(KW,y,vw-KW,rh);x.globalAlpha=1}
    if(!t.drums&&p%12===0){x.fillStyle=C.chrome2;x.fillRect(KW,y+rh-1,vw-KW,1)}});
  const first=Math.max(0,Math.floor((L)/sw)),last=Math.ceil((L+vw)/sw);
  for(let s=first;s<=last;s++){const tick=s*PPQ/m.res;if(tick>end)break;const X=Math.round(gx(tick))+.5;if(X<KW)continue;
    const bar=tick%(m.beats*PPQ)===0,beat=tick%PPQ===0;
    x.strokeStyle=bar?C.ink:beat?C.muted:C.chrome2;x.globalAlpha=bar?.9:beat?.45:.6;x.lineWidth=bar?1.5:1;
    x.beginPath();x.moveTo(X,RH);x.lineTo(X,vh);x.stroke();x.globalAlpha=1}
  const ex=gx(end);if(ex<vw){x.fillStyle=C.ink;x.globalAlpha=.12;x.fillRect(Math.max(KW,ex),RH,vw,vh);x.globalAlpha=1}
  // RULE: other melodic tracks draw faintly so parts can be written against each other.
  const row=new Map(rows.map((p,i)=>[p,i])),col=i=>SEQ_COLORS[i%8];
  if(!t.drums)m.tracks.forEach((o,i)=>{if(o===t||o.drums)return;x.fillStyle=col(i);x.globalAlpha=.22;
    for(const n of o.notes){const r=row.get(n.p);if(r==null)continue;const X=gx(n.t),W=n.d/tk;if(X+W<KW||X>vw)continue;x.fillRect(X+1,gy(r)+2,W-2,rh-4)}x.globalAlpha=1});
  const ti=m.tracks.indexOf(t);
  for(const n of t.notes){const r=row.get(n.p);if(r==null)continue;const X=gx(n.t),W=Math.max(4,n.d/tk),Y=gy(r);if(X+W<KW||X>vw||Y+rh<RH||Y>vh)continue;
    x.globalAlpha=(n.t>=end?.3:t.mute?.45:1)*(.35+.65*n.v/127);x.fillStyle=col(ti);x.fillRect(X+1,Y+1,W-2,rh-2);x.globalAlpha=n.t>=end?.3:t.mute?.45:1;
    x.strokeStyle=C.ink;x.lineWidth=n.v>110?2.5:1;x.strokeRect(X+1.5,Y+1.5,W-3,rh-3);
    if(n.v>110){x.fillStyle='#fff';x.fillRect(X+3,Y+3,3,rh-6)}x.globalAlpha=1}
  x.fillStyle=C.chrome;x.fillRect(0,RH,KW,vh-RH);x.font='11px '+(getComputedStyle(document.body).getPropertyValue('--f-mono')||'monospace');x.textBaseline='middle';
  rows.forEach((p,r)=>{const y=gy(r);if(y+rh<RH||y>vh)return;
    if(t.drums){x.fillStyle=C.ink;x.fillText(DRUMS[r][1],8,y+rh/2)}
    else{x.fillStyle='#fdfcff';x.fillRect(0,y,KW,rh);if(isBlack(p)){x.fillStyle='#16121f';x.fillRect(0,y+1,58,rh-2)}
      if(p%12===0||p%12===5){x.fillStyle='#b9b4cc';x.fillRect(0,y+rh-1,KW,1)}
      if(p%12===0){x.fillStyle='#16121f';x.fillText(noteName(p),KW-30,y+rh/2)}}});
  x.fillStyle=C.ink;x.fillRect(KW-2,RH,2,vh-RH);
  x.fillStyle=C.chrome;x.fillRect(0,0,vw,RH);x.fillStyle=C.ink;x.fillRect(0,RH-2,vw,2);
  for(let b=0;b<m.bars;b++){const X=gx(b*m.beats*PPQ);if(X<KW-40||X>vw)continue;if(X>=KW){x.fillRect(Math.round(X),0,1.5,RH);x.fillText(String(b+1),X+5,RH/2)}}
  const cx=gx(seqP.cursor);if(cx>=KW){x.fillStyle=C.hot;x.beginPath();x.moveTo(cx-6,0);x.lineTo(cx+6,0);x.lineTo(cx,10);x.fill()}
  const now=seqP.on?seqNow():null;if(now!=null){const X=gx(now);if(X>=KW&&X<=vw){x.fillStyle=C.hot;x.fillRect(X-1,RH,2,vh-RH)}}
  x.fillStyle=C.chrome;x.fillRect(0,0,KW,RH);
}
function seqHit(e){
  const m=state.music,t=seqTrackSel(),cv=$('#seqCanvas').getBoundingClientRect(),sc=$('#seqScroll');
  const vx=e.clientX-cv.left,vy=e.clientY-cv.top,rows=seqRows(t),rh=rowH(t);
  const tick=Math.max(0,(vx-SQ.KW+sc.scrollLeft)*PPQ/SQ.BW),r=Math.floor((vy-SQ.RH+sc.scrollTop)/rh);
  const step=PPQ/m.res;
  return{zone:vy<SQ.RH?'ruler':vx<SQ.KW?'keys':'grid',tick,snap:Math.floor(tick/step)*step,p:rows[Math.max(0,Math.min(rows.length-1,r))],ok:r>=0&&r<rows.length,step};
}
function seqNoteAt(t,h){return t.notes.find(n=>n.p===h.p&&h.tick>=n.t&&h.tick<n.t+n.d)}
// INVARIANT: notes of one pitch never overlap; the earlier is cut where the later starts (MIDI can't represent overlap).
function seqTidy(t){
  t.notes.sort((a,b)=>a.p-b.p||a.t-b.t);
  for(let i=0;i<t.notes.length-1;i++){const a=t.notes[i],b=t.notes[i+1];if(a.p===b.p&&a.t+a.d>b.t){if(a.t===b.t){t.notes.splice(i,1);i--}else a.d=b.t-a.t}}
  t.notes.sort((a,b)=>a.t-b.t||a.p-b.p);
}
const seqHear=(t,p)=>{audio();if(ac&&seqOut())playNote(t,p,ac.currentTime+.01,.35,100)};
let seqLastLen=PPQ/4;
function seqDown(e){
  if(e.button>0)return;const m=state.music,t=seqTrackSel(),h=seqHit(e);
  if(h.zone==='ruler'){seqP.cursor=Math.min(h.snap,songEnd(m)-h.step);if(seqP.on)seqPlay();seqDraw();return}
  if(h.zone==='keys'){if(h.ok)seqHear(t,h.p);return}
  if(!h.ok||h.snap>=songEnd(m))return;
  $('#seqScroll').setPointerCapture(e.pointerId);
  const n=seqNoteAt(t,h);
  if(n){
    if(e.shiftKey){seqEdit(()=>{n.v=n.v>110?100:127});seqDraw();return}
    seq.drag={kind:'move',n,t0:n.t,p0:n.p,h0:h,moved:false};return;
  }
  const len=t.drums?h.step:seqLastLen;
  const nn={t:h.snap,d:Math.max(h.step,Math.min(len,songEnd(m)-h.snap)),p:h.p,v:100};
  seqEdit(()=>{t.notes.push(nn);seqTidy(t)});seqHear(t,h.p);
  seq.drag=t.drums?{kind:'paint',p:h.p,done:new Set([h.snap])}:{kind:'len',n:nn,moved:false};
  seqDraw();
}
function seqMove(e){
  const d=seq.drag;if(!d)return;const m=state.music,t=seqTrackSel(),h=seqHit(e),end=songEnd(m);
  if(d.kind==='len'){const dd=Math.max(h.step,Math.ceil((h.tick-d.n.t)/h.step)*h.step);if(dd!==d.n.d){d.n.d=Math.min(dd,end-d.n.t);d.moved=true;seqDraw()}}
  else if(d.kind==='paint'){if(!d.done.has(h.snap)&&h.snap<end&&!t.notes.some(n=>n.p===d.p&&n.t===h.snap)){d.done.add(h.snap);t.notes.push({t:h.snap,d:h.step,p:d.p,v:100});seqTidy(t);seqHear(t,d.p);seqDraw()}}
  else if(d.kind==='move'){
    const dt=Math.round((h.tick-d.h0.tick)/h.step)*h.step,rows=seqRows(t),dr=rows.indexOf(h.p)-rows.indexOf(d.h0.p);
    const nt=Math.max(0,Math.min(end-h.step,d.t0+dt)),np=rows[Math.max(0,Math.min(rows.length-1,rows.indexOf(d.p0)+dr))];
    if(nt!==d.n.t||np!==d.n.p){if(!d.moved){pushUndo();d.moved=true}if(np!==d.n.p)seqHear(t,np);d.n.t=nt;d.n.p=np;seqDraw()}
  }
}
function seqUp(){
  const d=seq.drag;seq.drag=null;if(!d)return;const t=seqTrackSel();
  if(d.kind==='move'&&!d.moved){seqEdit(()=>{t.notes.splice(t.notes.indexOf(d.n),1)});}
  else if(d.kind==='len'){seqLastLen=d.n.d;seqTidy(t);save()}
  else{seqTidy(t);save()}
  seqDraw();
}
function saveMidi(){
  const m=state.music;if(!m)return;
  const name=slug(m.name||'song')+'.mid';
  download(new Blob([midiBytes(m,m.name||'PIXIWYG song')],{type:'audio/midi'}),name);status('Saved '+name);
}
{
  const sc=$('#seqScroll');
  sc.addEventListener('scroll',seqDraw);
  sc.addEventListener('pointerdown',seqDown);sc.addEventListener('pointermove',seqMove);
  sc.addEventListener('pointerup',seqUp);sc.addEventListener('pointercancel',seqUp);
  sc.addEventListener('contextmenu',e=>{e.preventDefault();const t=seqTrackSel(),h=seqHit(e),n=h.zone==='grid'&&seqNoteAt(t,h);if(n){seqEdit(()=>{t.notes.splice(t.notes.indexOf(n),1)});seqDraw()}});
  new ResizeObserver(()=>{if(!$('#seqModal').hidden){seqLayout();seqDraw()}}).observe(sc);
  const num=(id,k,lo,hi)=>$(id).addEventListener('change',e=>{const v=Math.round(numIn(e.target.value,state.music[k],lo,hi));seqEdit(()=>{const was=state.music[k];state.music[k]=v;if(k==='bpm')refitSamples(state.music,was)});e.target.value=v;$('#seqBars').value=state.music.bars;seqLayout();seqDraw()});
  num('#seqBpm','bpm',20,300);num('#seqBars','bars',1,64);
  $('#seqBeats').onchange=e=>{seqEdit(()=>{state.music.beats=+e.target.value});seqLayout();seqDraw()};
  $('#seqRes').onchange=e=>{seqEdit(()=>{state.music.res=+e.target.value});seqLastLen=PPQ/state.music.res;seqDraw()};
  $('#seqLoop').onchange=e=>{seqP.loop=e.target.checked};
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
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!field){e.preventDefault();e.stopPropagation();e.shiftKey?doRedo():doUndo();if(!useSong())state.music=newSong('Song 1');songSync();seqControls();seqTracks();seqLayout();seqDraw()}
  });
}


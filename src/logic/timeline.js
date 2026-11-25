// SECTION: Animate (timeline)
// FORMAT: TL.song is the song the timeline plays along with and measures in bars ('' none, undefined not chosen yet).
const TL={pps:160,t:0,run:null,playing:false,raf:0,drag:null,song:undefined,audio:null};
const tlSongM=()=>TL.song?songById(TL.song):null;
const beatMsOf=m=>beatTicks(m)*tickSec(m)*1000;
const tlItems=()=>state.els.filter(e=>e.anim).map(el=>({el,spec:animSpec(el.anim)})).filter(x=>x.spec).sort((a,b)=>a.spec.delay-b.spec.delay||(a.el.z||0)-(b.el.z||0));
const tlReps=s=>s.repeat==='forever'?3:s.repeat==='twice'?2:1;
const tlLen=items=>{const m=tlSongM();return Math.max(3,m?Math.ceil(songEnd(m)*tickSec(m)):0,Math.ceil(Math.max(0,...items.map(({spec:s})=>(s.delay+s.dur*tlReps(s))/1000))+1))};
const beatsLabel=(ms,s)=>s.beatMs?`${+(ms/s.beatMs).toFixed(2)} beats`:`${ms} ms`;
// RULE: the timeline plays along with the song an animation follows or counts its beats in, until another is chosen.
function tlSongPick(items){
  if(TL.song===undefined){const s=items.map(x=>x.spec).find(s=>s.song||s.tempo);TL.song=s?(s.song||s.tempo):''}
  if(TL.song&&!songById(TL.song))TL.song='';
  const sel=$('#tlSong');sel.replaceChildren(mkEl('option',{value:'',textContent:'No song'}),...state.songs.map(m=>mkEl('option',{value:m.id,textContent:m.name})));sel.value=TL.song;
}
function tlRender(){
  if($('#timeline').hidden)return;
  const items=tlItems();tlSongPick(items);const len=tlLen(items),pps=TL.pps,box=$('#tlRows'),sel=state.sel,m=tlSongM();box.replaceChildren();
  $('#tlEmpty').hidden=items.length>0;
  const ruler=$('#tlRuler');ruler.replaceChildren();ruler.style.width=box.style.width=(len*pps+20)+'px';
  // RULE: with a song the ruler counts its bars (numbered) and beats; without one, seconds.
  if(m){const bs=beatMsOf(m)/1000;for(let b=0;b*bs<=len;b++){const bar=!(b%m.beats),tk=mkEl('i',{className:'tltick'+(bar?' major':'')});tk.style.left=(b*bs*pps)+'px';if(bar)tk.textContent=String(b/m.beats+1);ruler.append(tk)}}
  else for(let s=0;s<=len*2;s++){const tk=mkEl('i',{className:'tltick'+(s%2?'':' major')});tk.style.left=(s*pps/2)+'px';if(!(s%2))tk.textContent=(s/2)+'s';ruler.append(tk)}
  for(const {el,spec} of items){
    const row=mkEl('div',{className:'tlrow'+(el.id===sel?' on':'')});row.dataset.id=el.id;
    const lab=mkEl('button',{type:'button',className:'tllab',textContent:elName(el.id),title:'Select it · double-click to edit its animation'});
    lab.onclick=()=>{audio();select(el.id)};lab.ondblclick=()=>openAnimEditor(el);
    const chip=mkEl('span',{className:'tlchip',textContent:TRIGGER_NAMES[spec.trigger]||spec.trigger});
    const lane=mkEl('div',{className:'tllane'});
    const reps=tlReps(spec);
    for(let k=0;k<reps;k++){
      const bar=mkEl('div',{className:'tlbar'+(k?' ghost':'')+(spec.alt&&k%2?' back':'')});bar.style.left=(spec.delay+k*spec.dur)/1000*pps+'px';bar.style.width=Math.max(6,spec.dur/1000*pps)+'px';
      if(!k){bar.title=`Starts ${beatsLabel(spec.delay,spec)} in, lasts ${beatsLabel(spec.dur,spec)}. Drag to move; drag the right edge to change how long.`;bar.dataset.id=el.id;
        bar.append(mkEl('span',{textContent:`${beatsLabel(spec.dur,spec)}${spec.repeat!=='once'?' · '+spec.repeat:''}${spec.alt?' · ↔':''}`}),mkEl('i',{className:'tlgrip'}));bar.ondblclick=()=>openAnimEditor(el)}
      for(const kf of spec.keys||[]){const m=mkEl('b',{className:'tlkey',title:`Keyframe at ${kf.at}%`});m.style.left=(spec.alt&&k%2?100-kf.at:kf.at)+'%';bar.append(m)}
      lane.append(bar);
    }
    row.append(mkEl('div',{className:'tlhead'}),lane);row.firstChild.append(lab,chip);box.append(row);
  }
  tlPlayhead();
}
const tlMark=()=>{for(const r of document.querySelectorAll('#tlRows .tlrow'))r.classList.toggle('on',r.dataset.id===state.sel)};
function tlPlayhead(){const x=TL.t*TL.pps,m=tlSongM();$('#tlHead').style.left=x+'px';
  if(m){const b=Math.floor(TL.t*1000/beatMsOf(m)+1e-6);$('#tlTime').textContent=`bar ${Math.floor(b/m.beats)+1} · beat ${b%m.beats+1}`}else $('#tlTime').textContent=TL.t.toFixed(2)+' s'}
// INVARIANT: preview builds every animation paused, as Play does, then seeks to the playhead.
function tlSeek(t){
  const items=tlItems();TL.t=Math.max(0,Math.min(tlLen(items),t));tlPlayhead();
  if(!TL.run){if(!items.length)return;
    TL.run=pxRuntime(emptyGraph(),items.map(({el,spec})=>({ref:el.id,spec:{...spec,trigger:'logic'}})),{el:id=>{const h=hostOf(id);return h?{host:h,target:h._target}:null},animate(){}})}
  for(const {el} of items){const h=hostOf(el.id);if(!h)continue;for(const a of [...h.getAnimations(),...(h._target?h._target.getAnimations():[])]){a.pause();a.currentTime=TL.t*1000}}
  updateSel();
}
function tlReset(){tlStop();if(TL.run){TL.run.stop();TL.run=null;TL.t=0;if(!$('#timeline').hidden)tlPlayhead();updateSel()}}
function tlStop(){TL.playing=false;cancelAnimationFrame(TL.raf);if(TL.audio){TL.audio.stop();TL.audio=null}$('#tlPlay').textContent='▶ Play';$('#tlPlay').setAttribute('aria-pressed','false')}
function tlPlay(){
  if(TL.playing){tlStop();return}
  const len=tlLen(tlItems());if(TL.t>=len-.01)TL.t=0;
  TL.playing=true;$('#tlPlay').textContent='❚❚ Pause';$('#tlPlay').setAttribute('aria-pressed','true');
  // INVARIANT: with a song, the playhead is the song's own position on the audio clock, so the picture can't drift from it.
  const m=tlSongM(),t0=performance.now()-TL.t*1000;TL.audio=m?songRun(m,TL.t):null;
  const step=now=>{if(!TL.playing)return;const t=TL.audio?Math.max(0,songTime(TL.audio)):(now-t0)/1000;if(t>=len){tlSeek(len);tlStop();return}tlSeek(t);TL.raf=requestAnimationFrame(step)};
  TL.raf=requestAnimationFrame(step);
}
// RULE: drag a bar to move its start, its right edge to change duration; 50ms steps, Shift for 10. With a song the
//   steps are its beats, Shift for quarter beats; an animation counted in beats keeps beats.
$('#tlRows').addEventListener('pointerdown',e=>{
  const bar=e.target.closest('.tlbar:not(.ghost)');if(!bar||e.button>0)return;e.preventDefault();
  const el=state.els.find(x=>x.id===bar.dataset.id),tr=el&&el.anim.nodes.find(n=>n.type==='transition');if(!tr)return;
  select(el.id);tlReset();bar.setPointerCapture(e.pointerId);
  const sp=animSpec(el.anim);TL.drag={el,tr,kind:e.target.classList.contains('tlgrip')?'dur':'delay',x0:e.clientX,d0:sp.delay,u0:sp.dur,k:sp.beatMs||1,moved:false,bar};
});
$('#tlRows').addEventListener('pointermove',e=>{
  const d=TL.drag;if(!d)return;const dx=e.clientX-d.x0;if(!d.moved&&Math.abs(dx)<3)return;if(!d.moved){pushUndo();d.moved=true}
  const m=tlSongM(),b=m?beatMsOf(m):0,q=b?(e.shiftKey?b/4:b):(e.shiftKey?10:50),ms=dx/TL.pps*1000,put=v=>d.k===1?Math.round(v):+(v/d.k).toFixed(3);
  if(d.kind==='delay')d.tr.f.delay=put(Math.max(0,Math.round((d.d0+ms)/q)*q));else d.tr.f.dur=put(Math.max(q,Math.round((d.u0+ms)/q)*q));
  const s=animSpec(d.el.anim);d.bar.style.left=s.delay/1000*TL.pps+'px';d.bar.style.width=Math.max(6,s.dur/1000*TL.pps)+'px';d.bar.firstChild.textContent=beatsLabel(s.dur,s);
  $('#tlTime').textContent=d.kind==='delay'?`starts ${beatsLabel(s.delay,s)}`:`lasts ${beatsLabel(s.dur,s)}`;
});
const tlUp=()=>{const d=TL.drag;TL.drag=null;if(d&&d.moved){save();tlRender()}};
$('#tlRows').addEventListener('pointerup',tlUp);$('#tlRows').addEventListener('pointercancel',tlUp);
$('#tlRuler').addEventListener('pointerdown',e=>{
  if(e.button>0)return;tlStop();const r=$('#tlRuler'),at=ev=>tlSeek((ev.clientX-r.getBoundingClientRect().left)/TL.pps);
  r.setPointerCapture(e.pointerId);at(e);const mv=ev=>at(ev),up=()=>{r.removeEventListener('pointermove',mv);r.removeEventListener('pointerup',up)};
  r.addEventListener('pointermove',mv);r.addEventListener('pointerup',up);
});
$('#tlPlay').onclick=()=>{audio();tlPlay()};
$('#tlStart').onclick=()=>{audio();tlStop();tlSeek(0)};
$('#tlAnimate').onclick=()=>{audio();const el=selected();if(!el){status('Select something on the page first, then animate it.');return}tlReset();openAnimEditor(el)};
$('#tlZoom').oninput=e=>{TL.pps=+e.target.value;tlRender()};
$('#tlSong').onchange=e=>{audio();tlStop();TL.song=e.target.value;tlRender()};


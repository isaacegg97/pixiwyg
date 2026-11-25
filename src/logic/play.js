// SECTION: play mode
let playing=null;
// FORMAT: the instrument live notes sound on in Play: a piano, through the SoundFont when one is loaded.
const LIVE_KEYS={id:'live',name:'Keys',drums:false,prog:0,vol:110,mute:false,notes:[]};
// SECTION: Play across pages
// RULE: Play runs the page in front; Go to page (or a link) leaves it for another, with the same variables. A page
//   seen before in this Play doesn't run On start again, as in the exported site.
let playSite=null;
function playStart(){
  const cur=state.site?state.site.cur:'',anims=state.els.filter(e=>e.anim).map(e=>({ref:e.id,spec:animSpec(e.anim)})).filter(a=>a.spec);
  const notes=new Map(),songOf=id=>songById(id)||state.songs[0]||null,frames=new Map();
  // PERF: a flipbook on the beat is decoded into its frames once, as Play starts; until then it plays at its own pace.
  for(const a of anims)if(a.spec.frameMs){const el=state.els.find(e=>e.id===a.ref);if(el&&el.tag==='img')decodeAPNG(el.content).then(x=>{if(x)frames.set(a.ref,x.frames)})}
  const env={el:id=>{const h=id&&hostOf(id);return h?{host:h,target:h._target}:null},animate(){},music:(what,e,song)=>PLAYER.control(what,e&&e.host,window,song),
    clock:()=>{const c=PLAYER.clock(),m=c&&songOf(c.song);return m?{song:m.id,t:c.t}:null},
    notes:id=>{if(!notes.has(id))notes.set(id,pxSongNotes(songById(id)));return notes.get(id)},
    listen:cb=>pxLiveNotes(window,cb),frames:ref=>frames.get(ref),sound:e=>{audio();if(ac&&seqOut())playNote(LIVE_KEYS,e.p,ac.currentTime+.005,1.2,e.v)},
    vars:playSite.vars,noStart:playSite.seen.has(cur),pageName:()=>state.site?curPage().name:(state.project&&state.project.name)||'',go:t=>playGo(t)};
  playSite.seen.add(cur);const run=pxRuntime(state.logic,anims,env),drag=px3dDrag([...hosts.values()]);return{...run,stop(){drag.stop();run.stop()}};
}
function playGo(t){
  if(!playing||!state.site)return;const ids=siteTree().map(x=>x.p.id),cur=state.site.cur;let id=t;
  if(t==='next')id=ids[ids.indexOf(cur)+1];else if(t==='previous')id=ids[ids.indexOf(cur)-1];else if(t==='first')id=ids[0];else if(t==='back')id=playSite.history.pop();
  if(!id||!sitePage(id)||id===cur)return;if(t!=='back')playSite.history.push(cur);
  // INVARIANT: routing is asked for from inside the running logic; the swap waits until that step has unwound.
  setTimeout(()=>{if(!playing)return;playing.stop();goPage(id,{quiet:true});playing=playStart();status(`Playing ${curPage().name}. Esc stops.`)},0);
}
// RULE: links to pages route in Play; in the editor they never navigate the editor itself.
document.addEventListener('click',e=>{const path=e.composedPath(),a=path.find(x=>x&&x.dataset&&x.dataset.pxpage);
  if(a){e.preventDefault();if(playing)playGo(a.dataset.pxpage);return}
  if(!playing)return;const h=path.find(x=>x&&x.classList&&x.classList.contains('el'));const el=h&&state.els.find(x=>x.id===h.dataset.id);if(el&&el.link)playGo(el.link)},true);
function setPlay(on){
  if(on===!!playing)return;
  if(on&&TL.run)tlReset();
  // RULE: Play shows the page; from Music or Paint it switches to Page first.
  if(on&&['music','paint','model'].includes(document.body.dataset.ws))setWorkspace('page');
  if(on){
    if(state.editing)finishEdit();select(null);hoverOff();
    playSite={vars:{},seen:new Set(),history:[]};
    try{playing=playStart()}catch(e){logErr('logic',e.message,e.stack);status('The page logic could not start');return}
    document.body.classList.add('playing');$('#playBar').hidden=false;
    // RULE: Play says what the page listens for when that isn't the mouse: the keys, and a song nothing plays.
    const sp=state.els.map(e=>e.anim&&animSpec(e.anim)).filter(Boolean),keys=sp.some(s=>s.trigger==='note'&&s.note.from!=='song')||state.logic.nodes.some(n=>n.type==='note'&&n.f.from!=='song');
    const deaf=sp.some(s=>s.trigger==='song'||(s.trigger==='note'&&s.note.from==='song'))&&!state.logic.nodes.some(n=>n.type==='song');
    status(`Playing.${keys?' Play notes on the keys A–L (Z and X for octaves) or a MIDI keyboard.':' Click and type on the page.'}${deaf?' Something here goes with a song, but nothing plays one: add Play a song to the page logic.':''} Esc stops.`);
  }else{
    playing.stop();playing=null;PLAYER.stop();document.body.classList.remove('playing');$('#playBar').hidden=true;renderAll();status('Stopped. The page is back as you left it.');
  }
  $('#playBtn').setAttribute('aria-pressed',!!playing);$('#playBtn').innerHTML=playing?'■<span class="tblabel"> Stop</span>':'▶<span class="tblabel"> Play</span>';$('#playBtn').setAttribute('aria-label',playing?'Stop':'Play');
}
$('#playBtn').onclick=()=>{audio();sfx(playing?'whoosh':'pop');setPlay(!playing)};
$('#playStop').onclick=()=>{audio();setPlay(false)};


// SECTION: play mode
let playing=null;
// SECTION: Play across pages
// RULE: Play runs the page in front; Go to page (or a link) leaves it for another, with the same variables. A page
//   seen before in this Play doesn't run On start again, as in the exported site.
let playSite=null;
function playStart(){
  const cur=state.site?state.site.cur:'',anims=state.els.filter(e=>e.anim).map(e=>({ref:e.id,spec:animSpec(e.anim)})).filter(a=>a.spec);
  const env={el:id=>{const h=id&&hostOf(id);return h?{host:h,target:h._target}:null},animate(){},music:(what,e,song)=>PLAYER.control(what,e&&e.host,window,song),
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
    status('Playing. Click and type on the page; Esc stops.');
  }else{
    playing.stop();playing=null;PLAYER.stop();document.body.classList.remove('playing');$('#playBar').hidden=true;renderAll();status('Stopped. The page is back as you left it.');
  }
  $('#playBtn').setAttribute('aria-pressed',!!playing);$('#playBtn').innerHTML=playing?'■<span class="tblabel"> Stop</span>':'▶<span class="tblabel"> Play</span>';$('#playBtn').setAttribute('aria-label',playing?'Stop':'Play');
}
$('#playBtn').onclick=()=>{audio();sfx(playing?'whoosh':'pop');setPlay(!playing)};
$('#playStop').onclick=()=>{audio();setPlay(false)};


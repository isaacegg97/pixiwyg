// SECTION: Creative Quest
// RULE: a guided first hour for kids, in the XMB. Seven missions, each making one real thing (a title, a drawing, a
//   tune, something that moves, a story, a 3D shape, then Play), one short sentence at a time. A step finishes only
//   when its thing is made: there is no Next. A glowing ring points at what to touch and follows the child between
//   screens; finishing a mission earns a star and a burst of them.
// RULE: it isn't for skipping. No close button; Back and Esc don't end it; a reload resumes it; it keeps the XMB on.
//   A grown-up ends it by holding the corner button for 3 seconds.
// FORMAT: pixiwyg.quest = {i: step index, base: counts the step measures from} while it runs; gone when it ends.
const QUEST_KEY='pixiwyg.quest',QUEST_NAME='My Creative Quest';
const QUEST_MISSIONS=[['Your title','▦'],['Draw','🖌'],['Make music','♪'],['Make it move','◷'],['Tell a story','✒'],['Build in 3D','⬢'],['Showtime','▶']];
const QUEST_IDEAS=['A comic about your pet','A song for a rainy day','A poster for a pretend circus','A dragon that flies across the page',
  'A birthday card for someone you love','Your dream treehouse, in 3D','A story where you are a superhero','A map of a secret island',
  'A band of animals, and their first song','A page about your favorite food','A robot that dances when you press Play','A spooky story with a twist'];
const Q={on:false,i:0,base:{},drew:false,played:false,timer:0,hold:0};
const qImgs=()=>state.els.filter(e=>e.tag==='img');
const qH1=()=>state.els.find(e=>e.tag==='h1');
const qNotes=()=>state.songs.reduce((a,s)=>a+s.tracks.reduce((b,t)=>b+t.notes.length,0),0);
const qWords=()=>state.docs.reduce((a,d)=>a+((d.text||'').match(/[A-Za-z0-9À-￿]+/g)||[]).length,0);
const qHost=el=>el&&hostOf(el.id);
// FORMAT: m = mission, ws = the workspace the step happens in (the guide walks there first), clear = needs the page
//   uncovered, say and el may be functions, enter() records what done() measures from.
const QUEST=[
  {m:0,ws:'page',say:'Tap ＋ Add down below. It’s your box of parts!',el:()=>$('#xmbAdd'),done:()=>sideShown('sideL')||!!qH1()},
  {m:0,ws:'page',enter(){setTab('w-styles')},say:()=>sideShown('sideL')?'Drag the h1 button onto your page. It makes a big title!':'Tap ＋ Add to open your box of parts.',
    el:()=>sideShown('sideL')?[...document.querySelectorAll('#palette .pal')].find(b=>b.querySelector('b')?.textContent==='h1'):$('#xmbAdd'),done:()=>!!qH1()},
  {m:0,ws:'page',clear:true,say:'Double-tap your title and type your name! Then tap an empty spot on the page.',el:()=>qHost(qH1()),
    done:()=>{const h=qH1();return!!h&&!state.editing&&h.content!==TAGS.h1.content&&!!(h.content||'').replace(/<[^>]*>/g,'').trim()}},
  {m:1,ws:'paint',enter(){Q.drew=false},say:'Draw your favorite animal with your finger! 🐱 🐶 🦄',el:()=>$('#sstack'),done:()=>Q.drew},
  {m:1,ws:'paint',enter(b){b.img=qImgs().length},say:'All done drawing? Tap “Place on page” to stick it on your page.',el:()=>$('#sPlace'),done:b=>qImgs().length>b.img},
  {m:2,ws:'music',enter(b){b.notes=qNotes()},say:'Tap the grid 5 times to make notes. Higher up is a higher sound! 🎵',el:()=>$('#seqScroll'),done:b=>qNotes()>=b.notes+5},
  {m:2,ws:'music',enter(){Q.played=false},say:'Press ▶ to hear your song!',el:()=>$('#xmbPrimary'),done:()=>Q.played},
  {m:3,ws:'animate',clear:true,say:'Tap your drawing to pick it.',el:()=>qHost(qImgs().at(-1)||qH1()),done:()=>!!selected()},
  {m:3,ws:'animate',clear:true,say:()=>selected()?'Tap “Animate the selection”. ✨':'Tap your drawing to pick it.',el:()=>selected()?$('#tlAnimate'):qHost(qImgs().at(-1)||qH1()),done:()=>state.els.some(e=>e.anim)},
  {m:3,say:'Look, it moves! Tap Done to keep it.',el:()=>$('#nodeModal').hidden?null:$('#nodeDone'),done:()=>$('#nodeModal').hidden},
  {m:4,ws:'write',say:'Tap “New manuscript” to start a story. 📖',el:()=>$('#wrStart'),done:()=>state.docs.length>0},
  {m:4,ws:'write',enter(b){b.words=qWords()},say:'Write a story! Even one sentence, like “Once upon a time…”',el:()=>$('#writer [contenteditable="true"]'),done:b=>qWords()>=b.words+4},
  {m:5,ws:'model',say:'Tap “Start from shapes” to build in 3D! 🧊',el:()=>$('#m3dNewScene'),done:()=>!!m3d.scene},
  {m:5,ws:'model',say:'Pick a shape from “Add a shape”. Then spin it with your finger!',el:()=>$('#m3dAdd'),done:()=>!!m3d.scene&&m3d.scene.parts.length>=2},
  {m:6,ws:'page',clear:true,enter(){Q.played=false},say:'Last one! Press ▶ Play to bring your page to life! 🎉',el:()=>$('#xmbPrimary'),done:()=>!!playing},
];
const qSave=()=>lsSet(QUEST_KEY,JSON.stringify({i:Q.i,base:Q.base}));
function qLoad(){try{const v=JSON.parse(lsGet(QUEST_KEY,'null'));if(v&&Number.isInteger(v.i)){Q.on=true;Q.i=v.i;Q.base=v.base||{}}}catch(e){}}

// SECTION: Creative Quest flow
function startQuest(){
  if(!ui.on)setUi('xmb');
  $('#qIntroStars').replaceChildren(...QUEST_MISSIONS.map(([n,i])=>mkEl('span',{textContent:'☆',title:n})));
  $('#qIntro').hidden=false;$('#qGo').focus();
}
async function qBegin(){
  $('#qIntro').hidden=true;audio();sfx('boing');
  await newProject(QUEST_NAME,false,kindCanvas('web'));
  // RULE: the quest page starts with one cheerful stylesheet, so the first title already looks like something.
  addFile('bubblegum-os.css',SAMPLES['bubblegum-os.css'],true);renderProject();save();
  setSide('sideL',false);setSide('sideR',false);
  Q.on=true;Q.i=0;Q.base={};qEnter();qSave();xmbClose();qShow();status('Your Creative Quest has begun!');
}
function qEnter(){const s=QUEST[Q.i];Q.base={};if(s&&s.enter)s.enter(Q.base)}
function qAdvance(){
  const s=QUEST[Q.i],next=QUEST[Q.i+1];Q.i++;
  if(!next||next.m!==s.m){audio();sfx('boing');qBurst();status(`⭐ Mission ${s.m+1} done: ${QUEST_MISSIONS[s.m][0]}!`)}else{audio();sfx('pop')}
  if(!next){qSave();qFinish();return}
  qEnter();qSave();qRender();
}
function qFinish(){
  qHide();$('#qEndStars').replaceChildren(...QUEST_MISSIONS.map(([n])=>mkEl('span',{textContent:'★',title:n})));
  const pool=[...QUEST_IDEAS];$('#qIdeas').replaceChildren(...Array.from({length:3},()=>mkEl('li',{textContent:pool.splice(Math.floor(Math.random()*pool.length),1)[0]})));
  $('#qEnd').hidden=false;$('#qDone').focus();
}
function qEnd(){
  Q.on=false;try{localStorage.removeItem(QUEST_KEY)}catch(e){}
  $('#qEnd').hidden=$('#qIntro').hidden=true;qHide();
}
function qShow(){
  if(!Q.on)return;$('#qCard').hidden=false;document.body.classList.add('quest');qRender();
  clearInterval(Q.timer);Q.timer=setInterval(qTick,300);
}
function qHide(){
  clearInterval(Q.timer);$('#qCard').hidden=$('#qRing').hidden=true;document.body.classList.remove('quest');
  document.documentElement.style.setProperty('--tbh',$('#topbar').offsetHeight+'px');
}

// SECTION: Creative Quest guide
// RULE: before a step's own words, the guide walks the child to where the step happens: to their project, out of
//   the home or into the right category, to the right tool, with the page uncovered.
function qGuide(s){
  const home=!$('#xmb').hidden,cat=qCatTab;
  if(!state.project){
    if(!home)return{say:'Tap ☰ Menu.',el:$('#xmbHome')};
    if(XMB_CATS[XMB.c].id!=='project')return{say:'Tap ▣ Project to find your quest.',el:cat('project')};
    return{say:`Tap “${QUEST_NAME}” to keep going.`,el:[...document.querySelectorAll('#xmbItems .xitem')].find(b=>b.textContent.includes(QUEST_NAME))||null};
  }
  if(s.ws&&(home||document.body.dataset.ws!==s.ws)){
    const w=WS[s.ws];
    if(!home)return{say:`Tap ☰ Menu to find ${w.icon} ${w.name}.`,el:$('#xmbHome')};
    if(XMB_CATS[XMB.c].ws!==s.ws)return{say:`Now tap ${w.icon} ${w.name}.`,el:cat(s.ws)};
    return{say:s.ws==='page'?'Tap your page to open it.':`Tap “Open ${w.name}”.`,el:$('#xmbItems .xitem')};
  }
  if(home)return{say:'Tap the yellow button to go back to work.',el:$('#xmbResume')};
  if(s.clear&&(sideShown('sideL')||sideShown('sideR')))return{say:'Close the box to see your page: tap it again.',el:sideShown('sideL')?$('#xmbAdd'):$('#xmbProps')};
  if(document.body.dataset.sheet&&s.ws!=='paint')xmbSheet(null);
  return null;
}
// RULE: a category tab scrolled out of the row can't be tapped, so the guide points at the furthest tab still in
//   view on the way to it; tapping that re-centres the row and the next hint reaches it.
function qCatTab(id){
  const tabs=[...$('#xmbCats').children],t=XMB_CATS.findIndex(c=>c.id===id),v=$('#xmbCats').parentElement.getBoundingClientRect();
  const seen=i=>{const r=tabs[i].getBoundingClientRect();return Math.min(r.right,v.right)-Math.max(r.left,v.left)>=r.width*.8};
  if(seen(t))return tabs[t];
  const dir=t>XMB.c?1:-1;let best=XMB.c;for(let i=XMB.c+dir;i!==t;i+=dir)if(seen(i))best=i;
  return best===XMB.c?null:tabs[best];
}
function qTick(){
  if(!Q.on)return;
  if(!ui.on)setUi('xmb');
  if(seqP.on||(TL&&TL.playing))Q.played=true;
  const s=QUEST[Q.i];if(!s){qFinish();return}
  if(state.project&&s.done(Q.base)){qAdvance();return}
  qRender();
}
function qRender(){
  const s=QUEST[Q.i];if(!s)return;
  const g=qGuide(s),say=g?g.say:typeof s.say==='function'?s.say():s.say,el=g?g.el:s.el();
  $('#qMission').textContent=`Mission ${s.m+1} of ${QUEST_MISSIONS.length} · ${QUEST_MISSIONS[s.m][1]} ${QUEST_MISSIONS[s.m][0]}`;
  if($('#qSay').textContent!==say)$('#qSay').textContent=say;
  const stars=$('#qStars');stars.setAttribute('aria-label',`${s.m} of ${QUEST_MISSIONS.length} stars`);
  if(stars.childElementCount!==QUEST_MISSIONS.length)stars.replaceChildren(...QUEST_MISSIONS.map(()=>mkEl('span')));
  [...stars.children].forEach((x,k)=>{x.textContent=k<s.m?'★':'☆';x.classList.toggle('lit',k<s.m)});
  const card=$('#qCard');document.documentElement.style.setProperty('--qh',card.offsetHeight+'px');document.documentElement.style.setProperty('--tbh',card.offsetHeight+'px');
  qPoint(el);
}
// RULE: the ring sits on the target and the finger taps just below it; it hides when there's nothing to point at.
function qPoint(el){
  const ring=$('#qRing');let r=el&&el.getBoundingClientRect();
  if(!r||!r.width||!r.height){ring.hidden=true;return}
  // RULE: a target below the fold (or under the card or the strip) is scrolled to the middle before it's pointed at.
  const top=$('#qCard').offsetHeight,bottom=innerHeight-($('#xmbStrip').hidden?0:$('#xmbStrip').offsetHeight);
  if((r.top<top||r.bottom>bottom)&&r.height<bottom-top){el.scrollIntoView({block:'center',inline:'nearest'});r=el.getBoundingClientRect()}
  const vw=innerWidth,vh=innerHeight,x=Math.max(4,r.left-6),y=Math.max(4,r.top-6),w=Math.min(vw-8,r.width+12),h=Math.min(vh-8,r.height+12);
  ring.style.cssText=`left:${x}px;top:${y}px;width:${Math.min(w,vw-x-4)}px;height:${Math.min(h,vh-y-4)}px`;ring.hidden=false;
  ring.classList.toggle('inside',h>vh*.4);ring.classList.toggle('above',h<=vh*.4&&y+h>vh-90);
}
function qBurst(){
  if(matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  const box=$('#qBurst');box.replaceChildren();
  for(let k=0;k<18;k++){const a=k/18*Math.PI*2,d=110+Math.random()*90,s=mkEl('span',{textContent:['⭐','✨','🎉','💖'][k%4]});
    s.style.cssText=`--dx:${Math.cos(a)*d}px;--dy:${Math.sin(a)*d}px;animation-delay:${Math.random()*80}ms`;box.append(s)}
  setTimeout(()=>box.replaceChildren(),1400);
}

// SECTION: Creative Quest controls
$('#qGo').onclick=()=>qBegin();
$('#qDone').onclick=()=>{audio();sfx('whoosh');qEnd();xmbOpen('project');status('Make anything you like. 💡 Project → Give me an idea, whenever you need one.')};
document.addEventListener('pointerup',e=>{if(Q.on&&e.target.closest&&e.target.closest('#sstack'))Q.drew=true},true);
// RULE: the grown-up exit is a 3-second hold (pointer or Enter/Space); letting go early cancels it.
{const b=$('#qGrown'),go=()=>{if(Q.hold)return;b.classList.add('holding');Q.hold=setTimeout(()=>{Q.hold=0;b.classList.remove('holding');qEnd();xmbOpen('project');status('The Creative Quest is over. Project → Creative Quest starts it again.')},3000)},
  stop=()=>{clearTimeout(Q.hold);Q.hold=0;b.classList.remove('holding')};
  b.addEventListener('pointerdown',e=>{e.preventDefault();go()});for(const t of ['pointerup','pointerleave','pointercancel'])b.addEventListener(t,stop);
  b.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();go()}});b.addEventListener('keyup',stop);
  b.addEventListener('contextmenu',e=>e.preventDefault())}
// RULE: Esc never ends the quest; on the intro and the finale it does nothing at all.
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(!$('#qIntro').hidden||!$('#qEnd').hidden)){e.preventDefault();e.stopImmediatePropagation()}},true);
addEventListener('resize',()=>{if(Q.on)qRender()});
qLoad();if(Q.on)qShow();

// SECTION: Creative Quest
// RULE: a guided first hour for kids, in the XMB, that builds one mini website: every mission puts one real thing on
//   the page (a title, a drawing, a song's play button, an animation, a story, a spinning 3D shape) and Showtime plays
//   it all. A mission opens with a card that says what the tool is, with a tiny live example; then one short sentence
//   at a time, and a step finishes only when its thing is made: there is no Next. A spotlight dims everything but what
//   to touch and follows the child between screens; finishing a mission earns a star and a burst of them.
// RULE: it isn't for skipping. No close button; Back and Esc don't end it; a reload resumes it; it keeps the XMB on.
//   A grown-up ends it by holding the corner button for 3 seconds.
// FORMAT: pixiwyg.quest = {i: step index, base: counts the step measures from, seen: missions whose card was shown}
//   while it runs; gone when it ends.
const QUEST_KEY='pixiwyg.quest',QUEST_NAME='My Creative Quest';
// FORMAT: [name, icon, what the tool is, what this mission makes, the card's button]; the demos are drawn by quest.css.
const QUEST_MISSIONS=[
  ['Your title','▦','Every website starts with a page.','You’ll give yours a big title with your name.','Let’s go!'],
  ['Draw','🖌','Paint is your art room: brushes, colours, stamps and more.','You’ll draw something and stick it on your page.','Let’s draw!'],
  ['Make music','♪','Make songs by tapping notes on a grid. Higher up is a higher sound.','You’ll make a tune and give it a button on your page.','Let’s make music!'],
  ['Make it move','◷','Animate makes anything on your page move: bounce, spin, slide or fade.','You’ll make your drawing move.','Let’s move!'],
  ['Tell a story','✒','Write stories, and they appear right on your page.','You’ll write a story, even a tiny one.','Let’s write!'],
  ['Build in 3D','⬢','Build things out of 3D shapes, then turn them around.','You’ll build something that spins on your page.','Let’s build!'],
  ['Showtime','▶','Your mini website is ready.','Press Play and watch every part come alive together.','Showtime!'],
];
const QUEST_DEMOS=[
  '',
  '<svg viewBox="0 0 200 90"><path class="qdraw" d="M12 62 C 40 8, 70 92, 100 46 S 158 18, 188 60"/><circle class="qdot" cx="150" cy="30" r="9"/></svg>',
  '<div class="qroll">'+Array.from({length:32},(_,k)=>{const n=[2,9,20,27,13].indexOf(k);return`<i${n<0?'':` class="on" style="--n:${n}"`}></i>`}).join('')+'</div>',
  '<span class="qbounce">⭐</span>',
  '<p class="qtype">Once upon a time, a dragon…</p>',
  '<div class="qcube"><i></i><i></i><i></i><i></i><i></i><i></i></div>',
  '<div class="qsite"><b>Luna’s site</b><span><i class="qhop">🐱</i></span><span>▶ My song</span><span><i class="qspin">⬢</i></span><p>Once upon a time…</p></div>',
];
const QUEST_IDEAS=['A comic about your pet','A song for a rainy day','A poster for a pretend circus','A dragon that flies across the page',
  'A birthday card for someone you love','Your dream treehouse, in 3D','A story where you are a superhero','A map of a secret island',
  'A band of animals, and their first song','A page about your favourite food','A robot that dances when you press Play','A spooky story with a twist'];
const Q={on:false,i:0,base:{},seen:[],drew:false,played:false,timer:0,raf:0,hold:0,el:null,scrolled:null};
const qImgs=()=>state.els.filter(e=>e.tag==='img');
const qH1=()=>state.els.find(e=>e.tag==='h1');
const qNotes=()=>state.songs.reduce((a,s)=>a+s.tracks.reduce((b,t)=>b+t.notes.length,0),0);
const qWords=()=>state.docs.reduce((a,d)=>a+((d.text||'').match(/[A-Za-z0-9À-￿]+/g)||[]).length,0);
const qSongBtns=()=>state.els.filter(e=>songOfEl(e.id)!==undefined).length;
const q3d=()=>state.els.filter(e=>e.attrs&&e.attrs['data-px3d']).length;
const qHost=el=>el&&hostOf(el.id);
// RULE: Make it move is about the drawing: only it counts as picked (the title, if there's no drawing).
// RULE: the card to drag is the first one wearing a stylesheet, so the first title already looks like something.
const qStyledCard=()=>[...document.querySelectorAll('#sgrid .scard')].find(c=>!/no stylesheet/i.test(c.textContent))||$('#sgrid .scard');
const qPickee=()=>qImgs().at(-1)||qH1();
const qPicked=()=>{const s=selected();return!!s&&s===qPickee()};
const qSheet=(id,then)=>document.body.dataset.sheet===id?then:$(`#xmbSheets [data-sheet=${id}]`);
// FORMAT: m = mission, ws = the workspace the step happens in (the guide walks there first), clear = needs the page
//   uncovered, say and el may be functions, enter(base) records what done(base) measures from.
const QUEST=[
  {m:0,ws:'page',say:'Tap ＋ Add down below. It’s your box of parts!',el:()=>$('#xmbAdd'),done:()=>sideShown('sideL')||!!qH1()},
  {m:0,ws:'page',enter(){setTab('w-styles');showTag('h1')},say:()=>sideShown('sideL')?'Drag a Big Headline onto your page. Slide it sideways!':'Tap ＋ Add to open your box of parts.',
    el:()=>sideShown('sideL')?qStyledCard()||[...document.querySelectorAll('#palette .pal')].find(b=>b.querySelector('b')?.textContent==='h1'):$('#xmbAdd'),done:()=>!!qH1()},
  {m:0,ws:'page',clear:true,say:'Double-tap your title and type your name! Then tap an empty spot on the page.',el:()=>qHost(qH1()),
    done:()=>{const h=qH1();return!!h&&!state.editing&&h.content!==TAGS.h1.content&&!!(h.content||'').replace(/<[^>]*>/g,'').trim()}},
  {m:1,ws:'paint',enter(){Q.drew=false},say:'Draw your favourite animal with your finger! 🐱 🐶 🦄',el:()=>$('#sstack'),done:()=>Q.drew},
  {m:1,ws:'paint',enter(b){b.img=qImgs().length},say:'All done drawing? Tap “Place on page” to stick it on your page.',el:()=>$('#sPlace'),done:b=>qImgs().length>b.img},
  {m:2,ws:'music',enter(b){b.notes=qNotes()},say:'Tap the grid 5 times to make notes. 🎵',el:()=>$('#seqScroll'),done:b=>qNotes()>=b.notes+5},
  {m:2,ws:'music',enter(){Q.played=false},say:'Press ▶ to hear your song!',el:()=>$('#xmbPrimary'),done:()=>Q.played},
  {m:2,ws:'music',enter(b){b.btn=qSongBtns()},say:()=>document.body.dataset.sheet==='song'?'Tap “Put on page” to give your song a button.':'Tap ♪ Song to see your song’s buttons.',
    el:()=>qSheet('song',$('#seqToPage')),done:b=>qSongBtns()>b.btn},
  {m:3,ws:'animate',clear:true,enter(){select(null)},say:'Tap your drawing to pick it.',el:()=>qHost(qPickee()),done:qPicked},
  {m:3,ws:'animate',clear:true,say:()=>qPicked()?'Tap “Animate the selection”. ✨':'Tap your drawing to pick it.',el:()=>qPicked()?$('#tlAnimate'):qHost(qPickee()),done:()=>!!qPickee()&&!!qPickee().anim},
  {m:3,say:'Look, it moves! Tap Done to keep it.',el:()=>$('#nodeModal').hidden?null:$('#nodeDone'),done:()=>$('#nodeModal').hidden},
  {m:4,ws:'write',say:'Tap “New manuscript” to start a story. 📖',el:()=>$('#wrStart'),done:()=>state.docs.length>0},
  {m:4,ws:'write',enter(b){b.words=qWords()},say:'Tap the page and write a story! Even one sentence, like “Once upon a time…”',el:()=>$('#docPage'),done:b=>qWords()>=b.words+4},
  {m:5,ws:'model',say:'Tap “Start from shapes” to build in 3D! 🧊',el:()=>$('#m3dNewScene'),done:()=>!!m3d.scene},
  {m:5,ws:'model',say:'Pick a shape from “Add a shape”. Then spin it with your finger!',el:()=>$('#m3dAdd'),done:()=>!!m3d.scene&&m3d.scene.parts.length>=2},
  {m:5,ws:'model',enter(b){b.n=q3d();const c=$('#m3dSpin');if(c&&!c.checked){c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}))}},
    say:'Tap “Place on page” so it spins on your page!',el:()=>$('#m3dPlace'),done:b=>q3d()>b.n},
  {m:6,ws:'page',clear:true,enter(){Q.played=false;qTidy();qFrame()},say:'Press ▶ Play to bring your whole website to life! 🎉',el:()=>$('#xmbPrimary'),done:()=>!!playing},
];
const qSave=()=>lsSet(QUEST_KEY,JSON.stringify({i:Q.i,base:Q.base,seen:Q.seen}));
function qLoad(){try{const v=JSON.parse(lsGet(QUEST_KEY,'null'));if(v&&Number.isInteger(v.i)){Q.on=true;Q.i=v.i;Q.base=v.base||{};Q.seen=v.seen||[]}}catch(e){}}
// RULE: after every mission the page gets even spacing in reading order, so each new piece (dropped mid-page, often
//   on top of the last) takes its own place and the site reads as one; nothing ever hides another's spot to tap.
function qTidy(){if(state.els.length>1)try{autoformat()}catch(e){logErr('quest',e.message,e.stack)}}
// RULE: the finished site is shown framed: all of it, as large as fits, from the top.
const qFrame=()=>requestAnimationFrame(()=>xmbFitContent(true));

// SECTION: Creative Quest flow
function startQuest(){
  if(!ui.on)setUi('xmb');
  $('#qIntroStars').replaceChildren(...QUEST_MISSIONS.map(([n])=>mkEl('span',{textContent:'☆',title:n})));
  $('#qIntro').hidden=false;$('#qGo').focus();
}
async function qBegin(){
  $('#qIntro').hidden=true;audio();sfx('boing');
  await newProject(QUEST_NAME,false,kindCanvas('web'));
  // RULE: the quest page starts with one cheerful stylesheet, so the first title already looks like something.
  addFile('bubblegum-os.css',SAMPLES['bubblegum-os.css'],true);renderProject();save();
  setSide('sideL',false);setSide('sideR',false);
  // RULE: the Pixi intro already says what the first mission is, so its card is counted as seen.
  Q.on=true;Q.i=0;Q.base={};Q.seen=[0];qEnter();qSave();xmbClose();qShow();status('Your Creative Quest has begun!');
}
function qEnter(){const s=QUEST[Q.i];Q.base={};Q.scrolled=null;if(s&&s.enter)s.enter(Q.base)}
function qAdvance(){
  const s=QUEST[Q.i],next=QUEST[Q.i+1];Q.i++;
  if(!next||next.m!==s.m){audio();sfx('boing');qBurst();qTidy();status(`⭐ Mission ${s.m+1} done: ${QUEST_MISSIONS[s.m][0]}!`)}else{audio();sfx('pop')}
  if(!next){qSave();qFinish();return}
  qEnter();qSave();qRender();
}
// RULE: a mission's card shows once, as the mission starts; its one button is the way on.
function qMissionCard(m){
  const [name,icon,what,make,go]=QUEST_MISSIONS[m];
  $('#qMcNum').textContent=`Mission ${m+1} of ${QUEST_MISSIONS.length}`;$('#qMcH').textContent=`${icon} ${name}`;
  $('#qMcWhat').textContent=what;$('#qMcMake').textContent=make;$('#qMcGo').textContent=go+' ▶';
  $('#qMcDemo').innerHTML=QUEST_DEMOS[m];$('#qMissionCard').hidden=false;$('#qSpot').hidden=true;$('#qMcGo').focus();
}
function qFinish(){
  qHide();
  const made=[['▦','A big title',!!qH1()],['🖌','Your drawing',qImgs().length>0],['♪','A song button',qSongBtns()>0],['◷','Something that moves',state.els.some(e=>e.anim)],
    ['✒','Your story',qWords()>0],['⬢','A spinning 3D shape',q3d()>0]];
  $('#qMade').replaceChildren(...made.map(([i,t,ok])=>mkEl('li',{className:ok?'ok':'',textContent:`${ok?'✓':'○'} ${i} ${t}`})));
  const pool=[...QUEST_IDEAS];$('#qIdeas').replaceChildren(...Array.from({length:3},()=>mkEl('li',{textContent:pool.splice(Math.floor(Math.random()*pool.length),1)[0]})));
  $('#qEnd').hidden=false;$('#qDone').focus();
}
function qEnd(){
  Q.on=false;try{localStorage.removeItem(QUEST_KEY)}catch(e){}
  $('#qEnd').hidden=$('#qIntro').hidden=$('#qMissionCard').hidden=true;qHide();
}
function qShow(){
  if(!Q.on)return;$('#qCard').hidden=false;document.body.classList.add('quest');qRender();
  clearInterval(Q.timer);Q.timer=setInterval(qTick,300);
  // PERF: the spotlight follows its target every frame (one layout read); the steps themselves are checked every 300 ms.
  cancelAnimationFrame(Q.raf);const follow=()=>{if(!Q.on)return;qPoint(Q.el);Q.raf=requestAnimationFrame(follow)};Q.raf=requestAnimationFrame(follow);
}
function qHide(){
  clearInterval(Q.timer);cancelAnimationFrame(Q.raf);Q.el=null;$('#qCard').hidden=$('#qSpot').hidden=true;document.body.classList.remove('quest');
  document.documentElement.style.setProperty('--tbh',$('#topbar').offsetHeight+'px');
}

// SECTION: Creative Quest guide
// RULE: a category tab scrolled out of the row can't be tapped, so the guide points at the furthest tab still in
//   view on the way to it; tapping that re-centres the row and the next hint reaches it.
function qCatTab(id){
  const tabs=[...$('#xmbCats').children],t=XMB_CATS.findIndex(c=>c.id===id),v=$('#xmbCats').parentElement.getBoundingClientRect();
  const seen=i=>{const r=tabs[i].getBoundingClientRect();return Math.min(r.right,v.right)-Math.max(r.left,v.left)>=r.width*.8};
  if(seen(t))return tabs[t];
  const dir=t>XMB.c?1:-1;let best=XMB.c;for(let i=XMB.c+dir;i!==t;i+=dir)if(seen(i))best=i;
  return best===XMB.c?null:tabs[best];
}
// RULE: before a step's own words, the guide walks the child to where the step happens: to their project, out of
//   the home or into the right category, to the right tool, with the page uncovered.
function qGuide(s){
  const home=!$('#xmb').hidden;
  if(!state.project){
    if(!home)return{say:'Tap ☰ Menu.',el:$('#xmbHome')};
    if(XMB_CATS[XMB.c].id!=='project')return{say:'Tap ▣ Project to find your quest.',el:qCatTab('project')};
    return{say:`Tap “${QUEST_NAME}” to keep going.`,el:[...document.querySelectorAll('#xmbItems .xitem')].find(b=>b.textContent.includes(QUEST_NAME))||null};
  }
  if(s.ws&&(home||document.body.dataset.ws!==s.ws)){
    const w=WS[s.ws];
    if(!home)return{say:`Tap ☰ Menu to find ${w.icon} ${w.name}.`,el:$('#xmbHome')};
    if(XMB_CATS[XMB.c].ws!==s.ws)return{say:`Now tap ${w.icon} ${w.name}.`,el:qCatTab(s.ws)};
    return{say:s.ws==='page'?'Tap your page to open it.':`Tap “Open ${w.name}”.`,el:$('#xmbItems .xitem')};
  }
  if(home)return{say:'Tap the yellow button to go back to work.',el:$('#xmbResume')};
  if(s.clear&&(sideShown('sideL')||sideShown('sideR')))return{say:'Close the box to see your page: tap it again.',el:sideShown('sideL')?$('#xmbAdd'):$('#xmbProps')};
  if(document.body.dataset.sheet&&s.ws!=='paint'&&s.ws!=='music')xmbSheet(null);
  return null;
}
function qTick(){
  if(!Q.on||!$('#qMissionCard').hidden)return;
  if(!ui.on)setUi('xmb');
  if(seqP.on||(TL&&TL.playing))Q.played=true;
  const s=QUEST[Q.i];if(!s){qFinish();return}
  if(!Q.seen.includes(s.m)){Q.seen.push(s.m);qSave();qMissionCard(s.m);return}
  if(state.project&&s.done(Q.base)){qAdvance();return}
  qRender();
}
function qRender(){
  const s=QUEST[Q.i];if(!s)return;
  const g=qGuide(s),say=g?g.say:typeof s.say==='function'?s.say():s.say;
  Q.el=g?g.el:s.el();
  $('#qMission').textContent=`Mission ${s.m+1} of ${QUEST_MISSIONS.length} · ${QUEST_MISSIONS[s.m][1]} ${QUEST_MISSIONS[s.m][0]}`;
  if($('#qSay').textContent!==say)$('#qSay').textContent=say;
  const stars=$('#qStars');stars.setAttribute('aria-label',`${s.m} of ${QUEST_MISSIONS.length} stars`);
  if(stars.childElementCount!==QUEST_MISSIONS.length)stars.replaceChildren(...QUEST_MISSIONS.map(()=>mkEl('span')));
  [...stars.children].forEach((x,k)=>{x.textContent=k<s.m?'★':'☆';x.classList.toggle('lit',k<s.m)});
  const h=$('#qCard').offsetHeight+'px',r=document.documentElement.style;
  if(r.getPropertyValue('--qh')!==h){r.setProperty('--qh',h);r.setProperty('--tbh',h)}
}
// RULE: the spotlight dims everything but the target, its cut-out following the target's own corners; a target
//   bigger than a third of the screen (the canvas, the piano roll) gets a pulsing tap spot at its middle instead.
//   A target below the fold, or under the card or the strip, is scrolled to the middle first, once.
function qPoint(el){
  const spot=$('#qSpot');let r=el&&el.isConnected&&el.getBoundingClientRect();
  if(!r||!r.width||!r.height||!$('#qMissionCard').hidden){spot.hidden=true;return}
  const top=$('#qCard').offsetHeight,bottom=innerHeight-($('#xmbStrip').hidden?0:$('#xmbStrip').offsetHeight),vw=innerWidth,vh=innerHeight;
  if(Q.scrolled!==el&&(r.top<top||r.bottom>bottom)&&r.height<bottom-top){Q.scrolled=el;el.scrollIntoView({block:'center',inline:'nearest'});r=el.getBoundingClientRect()}
  const big=r.width*r.height>vw*vh/3;
  let x,y,w,h,rad;
  if(big){w=h=84;x=r.left+r.width/2-42;y=r.top+r.height/2-42;rad=42}
  else{const p=8;x=Math.max(2,r.left-p);y=Math.max(2,r.top-p);w=Math.min(vw-2,r.right+p)-x;h=Math.min(vh-2,r.bottom+p)-y;rad=(parseFloat(getComputedStyle(el).borderTopLeftRadius)||6)+p}
  const css=`left:${x|0}px;top:${y|0}px;width:${w|0}px;height:${h|0}px;border-radius:${rad|0}px`;
  if(spot.style.cssText!==css)spot.style.cssText=css;
  spot.classList.toggle('big',big);spot.classList.toggle('above',!big&&y+h>vh-110);spot.hidden=false;
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
$('#qMcGo').onclick=()=>{audio();sfx('pop');$('#qMissionCard').hidden=true;qRender()};
$('#qWatch').onclick=()=>{audio();qEnd();setWorkspace('page');xmbFitContent(true);setPlay(true)};
$('#qDone').onclick=()=>{audio();sfx('whoosh');if(playing)setPlay(false);qEnd();xmbOpen('project');status('Make anything you like. 💡 Project → Give me an idea, whenever you need one.')};
document.addEventListener('pointerup',e=>{if(Q.on&&e.target.closest&&e.target.closest('#sstack'))Q.drew=true},true);
// RULE: the grown-up exit is a 3-second hold (pointer or Enter/Space); letting go early cancels it.
{const b=$('#qGrown'),go=()=>{if(Q.hold)return;b.classList.add('holding');Q.hold=setTimeout(()=>{Q.hold=0;b.classList.remove('holding');qEnd();xmbOpen('project');status('The Creative Quest is over. Project → Creative Quest starts it again.')},3000)},
  stop=()=>{clearTimeout(Q.hold);Q.hold=0;b.classList.remove('holding')};
  b.addEventListener('pointerdown',e=>{e.preventDefault();go()});for(const t of ['pointerup','pointerleave','pointercancel'])b.addEventListener(t,stop);
  b.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();go()}});b.addEventListener('keyup',stop);
  b.addEventListener('contextmenu',e=>e.preventDefault())}
// RULE: Esc never ends the quest; on the intro, a mission card and the finale it does nothing at all.
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&(!$('#qIntro').hidden||!$('#qEnd').hidden||!$('#qMissionCard').hidden)){e.preventDefault();e.stopImmediatePropagation()}},true);
addEventListener('resize',()=>{if(Q.on)qRender()});
qLoad();if(Q.on)qShow();

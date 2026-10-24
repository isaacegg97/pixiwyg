// SECTION: examples (shipped in examples/, opened as new projects)
async function openExample(name){
  let blob;try{const r=await fetch(`examples/${name}.pixiwyg`,{cache:'no-store'});if(!r.ok)throw 0;blob=await r.blob()}
  catch(e){status('The example pages couldn’t be loaded. They live in the examples folder next to index.html.');return false}
  return openProjectFile(new File([blob],name+'.pixiwyg'),name+'.pixiwyg');
}

// SECTION: first visit
// FIX: the title screen focuses its own buttons as it opens; the welcome takes focus on the next frame, after it.
function showWelcome(){$('#obModal').hidden=false;themeCards($('#obThemes'));const f=()=>{if(!$('#obModal').hidden)($('#obThemes [aria-checked="true"]')||$('#obModal .obcard')).focus()};f();requestAnimationFrame(()=>requestAnimationFrame(f))}
function closeWelcome(){$('#obModal').hidden=true;lsSet('pixiwyg.onboarded','1')}
async function chooseProfile(p){
  closeWelcome();lsSet('pixiwyg.profile',p);audio();sfx('pop');
  if(!(await openExample(PROFILES[p].example)))return;
  runTour(PROFILES[p].name,profileTour(p));
}
for(const b of document.querySelectorAll('#obModal .obcard'))b.onclick=()=>chooseProfile(b.dataset.p);
$('#obComp').onclick=async()=>{closeWelcome();audio();await newProject('Component workshop',true);runTour('Components',COMPONENTS)};
$('#obQuest').onclick=()=>{closeWelcome();audio();startQuest()};
$('#obFull').onclick=()=>{closeWelcome();audio();startTour()};
$('#obSkip').onclick=$('#obClose').onclick=()=>{closeWelcome();audio();sfx('whoosh');status('Fair enough. The tours are on this screen if you change your mind.')};
async function maybeWelcome(){if(lsGet('pixiwyg.onboarded',null))return;if((await listProjects()).length)return;showWelcome()}



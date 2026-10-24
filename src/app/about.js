// SECTION: beta (version, problem reports, storage, one window per project, backups)
// SECTION: about
// FORMAT: the desktop app is the page on app:// (Tauri, in the system web engine); its engine is named from the agent.
function engineName(){const u=navigator.userAgent,m=u.match(/(Firefox|Chrome|Version)\/([\d.]+)/);
  if(location.protocol==='app:'||location.hostname==='app.localhost'){const w=u.match(/Edg\/([\d.]+)/),k=u.match(/AppleWebKit\/([\d.]+)/);
    return`PIXIWYG app (Tauri, ${w?`WebView2 ${w[1]}`:k&&!/Chrome\//.test(u)?`WebKit ${k[1]}`:m?`${m[1]} ${m[2]}`:'system web engine'})`}
  if(/Firefox\//.test(u))return`Firefox ${(u.match(/Firefox\/([\d.]+)/)||[])[1]}`;
  if(/Chrome\//.test(u))return`Chromium ${(u.match(/Chrome\/([\d.]+)/)||[])[1]}`;
  if(/Safari\//.test(u))return`Safari ${(u.match(/Version\/([\d.]+)/)||[])[1]||''}`;return u}
const fmtBytes=n=>n>=1e9?(n/1e9).toFixed(1)+' GB':n>=1e6?(n/1e6).toFixed(1)+' MB':Math.max(1,Math.round(n/1e3))+' KB';
async function storageLine(){
  try{const e=await navigator.storage.estimate(),p=await navigator.storage.persisted();
    return`Using ${fmtBytes(e.usage||0)} of ${fmtBytes(e.quota||0)} in this ${location.protocol==='app:'||location.hostname==='app.localhost'?'app':'browser'}. ${p?'Kept until you delete it.':'The browser may clear it if the disk runs low; Back up everything keeps a copy.'}`}
  catch(e){return''}
}
async function openAbout(){
  $('#aboutVersion').textContent=`Version ${APP_VERSION}`;$('#aboutEngine').textContent=engineName();
  $('#aboutStorage').textContent=await storageLine();
  const n=$('#aboutNotices');if(!n.value)fetchLib('NOTICES.txt').then(t=>{n.value=t}).catch(()=>{n.value='The license notices ship in lib/NOTICES.txt.'});
  $('#aboutModal').hidden=false;$('#aboutClose').focus();
}
$('#aboutBtn').onclick=()=>{audio();openAbout()};
$('#aboutClose').onclick=()=>{$('#aboutModal').hidden=true};
$('#aboutModal').addEventListener('pointerdown',e=>{if(e.target.id==='aboutModal')$('#aboutModal').hidden=true});


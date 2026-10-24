// SECTION: autopublish
// TODO: the collecting API isn't written yet. This is the client half; tools/publish-sock.js forwards the POST to a
//   local Unix socket from both the desktop app and the dev server.
// FORMAT: POST <page dir>/__publish, application/json:
//   {format:'pixiwyg-publish', version:1, app, name, slug, html, references:[{path,kind,note?}]}
//   html is the self-contained export. Any 2xx is success; a JSON body's "url" or "message" is shown to the user.
// SAFETY: same-origin, so connect-src 'self' already allows it; no CSP change.
const PUBLISH_PATH='__publish';
function publishPayload(html){
  const name=state.project?state.project.name:'page';
  return{format:'pixiwyg-publish',version:1,app:'PIXIWYG '+APP_VERSION,name,slug:slug(name),html,references:state.refs.map(r=>({...r}))};
}
async function publishSite(){
  if(!state.project)return null;if(state.editing)finishEdit();
  status('Publishing…');
  let res,info=null;
  try{
    const html=await buildExport();if(!html){status('Nothing to publish.');return null}
    res=await fetch(PUBLISH_PATH,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(publishPayload(html))});
    try{info=await res.json()}catch(e){}
  }catch(e){status('Publishing failed: no publisher answered. '+e.message);return{ok:false,error:e.message}}
  const msg=info&&typeof info==='object'&&(info.url||info.message||info.error);
  if(res.ok){sfx('boing');status('Published.'+(msg?' '+String(msg).slice(0,200):''))}
  else status(res.status===503?'No publisher is running. Start the local publish API, then try again.':`Publishing failed (${res.status}).${msg?' '+String(msg).slice(0,200):''}`);
  return{ok:res.ok,status:res.status,info};
}


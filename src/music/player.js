// SECTION: Webamp player
// INVARIANT: self-contained; exports build theirs from this source.
// FORMAT: o = {win, Webamp(): Promise<ctor>, song(): Promise<{key,blob,duration,title,artist}|null>, skin(): url|null, skins: [{url,name}]}
function pxPlayer(o){
  let wa=null,open=false,key='',busy=null;
  async function ready(anchor){
    const W=await o.Webamp();if(!W||(W.browserIsSupported&&!W.browserIsSupported()))return null;
    if(!wa){
      const sk=o.skin();
      wa=new W({initialSkin:sk?{url:sk}:undefined,availableSkins:o.skins||[],zIndex:o.z||99000,
        windowLayout:{main:{position:{top:0,left:0}},equalizer:{position:{top:116,left:0},closed:true},playlist:{position:{top:116,left:0},closed:true}}});
      wa.onClose(()=>{open=false});
      await wa.renderWhenReady(anchor&&anchor.isConnected?anchor:o.win.document.body);open=true;
      if(!wa.isRepeatEnabled())wa.toggleRepeat();
    }else if(!open){wa.reopen();open=true}
    return wa;
  }
  // HACK: Webamp's play() loads the track asynchronously and starts audio once it decodes, even after a stop() that
  //   arrived mid-load. The wanted state is kept and stop re-asserted while the load settles.
  let want='stop',hold=0;
  const halt=()=>{want='stop';if(!wa)return;wa.stop();clearInterval(hold);let n=0;hold=setInterval(()=>{if(want!=='stop'||++n>20){clearInterval(hold);return}if(wa.getMediaStatus()==='PLAYING')wa.stop()},100)};
  async function go(what,anchor,which){
    if(what==='stop'||(what==='toggle'&&wa&&open&&(wa.getMediaStatus()==='PLAYING'||want==='play'))){halt();return}
    want='play';clearInterval(hold);
    const w=await ready(anchor);if(!w||want!=='play')return;
    const s=await o.song(which);if(!s||want!=='play')return;
    if(s.key!==key){key=s.key;w.setTracksToPlay([{blob:s.blob,duration:s.duration,metaData:{artist:s.artist,title:s.title}}])}
    w.play();
  }
  return{
    control(what,anchor,which){busy=(busy||Promise.resolve()).then(()=>go(what,anchor,which)).catch(e=>console.error(e));return busy},
    playing(){return!!(wa&&open&&wa.getMediaStatus()==='PLAYING')},
    shown(){return!!(wa&&open)},
    skin(url){if(wa)wa.setSkinFromUrl(url)},
    close(){if(wa){halt();if(open)wa.close()}},
  };
}
const SKINS=[{id:'base',name:'Winamp classic (base skin)',file:null},{id:'dashamp-ii',name:'DashAmp II',file:'skin-dashamp-ii.wsz'},{id:'smoothamp',name:'SmoothAmp',file:'skin-smoothamp.wsz'}];
const SKIN_MIME='application/x-winamp-skin',SKIN_MAX=3*1024*1024;
const GMV=GM.map(([p,,v])=>[p,v]);
function cleanPlayer(p,restore=x=>x){
  if(!p||typeof p!=='object')return null;
  if(p.skin==='custom'){const d=restore(String(p.file||p.data||''));return d.startsWith(`data:${SKIN_MIME};base64,`)&&d.length<SKIN_MAX*1.4?{skin:'custom',name:String(p.name||'Custom skin').replace(/[\u0000-\u001f]/g,'').slice(0,60),data:d}:null}
  return SKINS.some(s=>s.id===p.skin)?{skin:p.skin}:null;
}
const skinUrl=(pl=state.player)=>{if(!pl)return null;if(pl.skin==='custom')return pl.data;const s=SKINS.find(s=>s.id===pl.skin);return s&&s.file?new URL('lib/'+s.file,location.href).href:null};
let songCache=null;
async function editorSong(id){
  const m=songById(id)||state.songs[0];if(!m||!m.tracks.some(t=>t.notes.length)){status(m?`“${m.name}” has no notes yet. Write some in the Sequencer.`:'There’s no song yet. Write one in the Sequencer.');return null}
  const key=JSON.stringify(m)+'|'+(soundfont?soundfont.file:'');
  if(songCache&&songCache.key===key)return songCache;
  status('Rendering the song…');
  const buf=await pxRender(m,GMV,soundfont?(ctx,out,syn)=>(t,p,at,d,v,dest)=>{if(!sfPlay(t,p,at,d,v,dest||out,ctx))syn.note(t,p,at,d,v,dest)}:null);
  songCache={key,blob:pxWav(buf),duration:buf.duration,title:m.name,artist:state.project?state.project.name:'PIXIWYG'};
  status('');return songCache;
}
const webampFor=win=>()=>win.Webamp?Promise.resolve(win.Webamp):new Promise((res,rej)=>{
  const s=win.document.createElement('script');s.src=new URL('lib/webamp.bundle.min.js',location.href).href;s.onload=()=>res(win.Webamp);s.onerror=()=>{status('The music player couldn’t be loaded.');rej(new Error('webamp'))};win.document.head.append(s)});
const playerFor=win=>pxPlayer({win,Webamp:webampFor(win),song:editorSong,skin:()=>skinUrl(),skins:SKINS.filter(s=>s.file).map(s=>({url:new URL('lib/'+s.file,location.href).href,name:s.name}))});
// INVARIANT: every music path (Play mode, live preview) goes through PLAYER.
const PLAYER={
  main:null,
  of(win){if(win===window)return this.main||(this.main=playerFor(window));if(!win.__pxPlayer)win.__pxPlayer=playerFor(win);return win.__pxPlayer},
  control(what,anchor,win=window,song){return this.of(win).control(what,anchor,song)},
  playing(){return!!(this.main&&this.main.playing())},
  stop(){if(this.main)this.main.close()},
  skinChanged(){const u=skinUrl();if(this.main)this.main.skin(u)},
};

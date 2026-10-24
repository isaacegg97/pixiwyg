// SECTION: live preview
// SAFETY: the window holds the export without its script (the desktop CSP runs no script but the app's); the editor
//   drives logic and animations into it, so it behaves as the published page will.
const livePv={win:null,run:null,t:0,busy:false,again:false,watch:0};
function liveOpen(){
  if(livePv.win&&!livePv.win.closed){livePv.win.focus();return}
  const u=URL.createObjectURL(new Blob(['<!doctype html><meta charset="utf-8"><title>PIXIWYG live preview</title><body style="font:14px system-ui;padding:24px">Building the preview…'],{type:'text/html'}));
  const w=window.open(u,'_blank',liveFeatures());setTimeout(()=>URL.revokeObjectURL(u),60000);
  if(!w){status('The preview window was blocked. Allow pop-ups for this page, then try again.');return}
  livePv.win=w;liveSync();liveRefresh();
  clearInterval(livePv.watch);livePv.watch=setInterval(()=>{if(livePv.win&&livePv.win.closed)liveClose()},1000);
  status('Live preview open. It follows your edits; close its window to stop.');
}
// RULE: the window opens at the page's own width; height is the page's, capped to the screen. A capped window gets a
//   vertical scrollbar, so it is widened by one scrollbar to keep a horizontal one from appearing.
function liveFeatures(){
  const d=isFixed()?pageDims():{w:W,h:H},sw=screen.availWidth||1280,sh=(screen.availHeight||800)-60;
  const h=Math.max(200,Math.min(Math.round(d.h)||sh,sh)),w=Math.max(320,Math.min(Math.round(d.w)+(h<d.h?16:0),sw));
  return`popup,width=${w},height=${h}`;
}
function liveClose(){
  clearInterval(livePv.watch);clearTimeout(livePv.t);liveStopRun();
  if(livePv.win&&!livePv.win.closed)livePv.win.close();livePv.win=null;liveSync();
}
function liveSync(){const on=!!livePv.win;$('#liveBtn').setAttribute('aria-pressed',on);$('#liveBtn').textContent=on?'■ Live preview':'Live preview'}
function liveStopRun(){if(livePv.run){try{livePv.run.stop()}catch(e){}livePv.run=null}if(livePv.drag){livePv.drag.stop();livePv.drag=null}}
function livePing(){if(livePv.win&&!livePv.win.closed){clearTimeout(livePv.t);livePv.t=setTimeout(liveRefresh,300)}}
async function liveRefresh(){
  const w=livePv.win;if(!w||w.closed)return;
  // HACK: the window holds about:blank, then the blob shell; write only once the shell loaded. After the first fill the
  //   window carries the editor's origin, so readiness is known.
  let ready=false;try{ready=w.document.readyState==='complete'&&(livePv.filled===w||w.location.protocol==='blob:')}catch(e){}
  if(!ready){livePv.t=setTimeout(liveRefresh,60);return}
  if(livePv.busy){livePv.again=true;return}livePv.busy=true;
  try{
    if(state.editing)return;   // INVARIANT: mid-edit text isn't in the page yet; finishEdit saves, which re-enters here.
    const o=expOpt.nojs;expOpt.nojs=true;let html;try{html=await buildExport({live:true})}finally{expOpt.nojs=o}
    if(w.closed)return;
    liveStopRun();
    if(w.__pxPlayer){w.__pxPlayer.close();w.__pxPlayer=null}
    const sx=w.scrollX,sy=w.scrollY,d=w.document;d.open();d.write(html);d.close();livePv.filled=w;w.scrollTo(sx,sy);
    const {G,anims}=buildExport.live;
    livePv.drag=px3dDrag([...d.querySelectorAll('.el')]);
    if(G.nodes.length||anims.length)livePv.run=pxRuntime(G,anims,{el:i=>{const h=d.querySelector(`.el[data-px="${i}"]`);return h?{host:h,target:h.shadowRoot&&h.shadowRoot.querySelector('[data-pxt]')}:null},animate(){},IO:w.IntersectionObserver,music:(what,e,song)=>PLAYER.control(what,e&&e.host,w,song)});
  }catch(e){logErr('live preview',e.message,e.stack)}
  finally{livePv.busy=false;if(livePv.again){livePv.again=false;livePing()}}
}
$('#liveBtn').onclick=()=>{audio();sfx('blip');if(state.editing)finishEdit();if(livePv.win&&!livePv.win.closed)liveClose();else liveOpen()};
addEventListener('pagehide',()=>{if(livePv.win&&!livePv.win.closed)livePv.win.close()});
async function saveExportFile(){
  // RULE: a site can leave as a zip of real pages (index.html, about.html, …) for hosting with their own addresses.
  if(multiPage()&&siteOn()&&expOpt.site){const files=await exportSiteFiles(),name=slug(state.project?state.project.name:'site')+'-site.zip';download(zipFiles(sortEntries(files)),name);status(`Saved ${name}: ${files.size} pages.`);sfx('boing');return}
  let html=$('#expText').value;if(!html||$('#copyBtn').disabled)html=await buildExport();
  const name=slug(state.project?state.project.name:'page')+'.html';
  download(new Blob([html],{type:'text/html;charset=utf-8'}),name);status('Saved '+name);sfx('boing');
}
$('#saveHtmlBtn').onclick=()=>{audio();saveExportFile()};
$('#copyBtn').onclick=()=>{const ta=$('#expText');navigator.clipboard.writeText(ta.value).then(()=>status('Copied the HTML'),()=>{ta.focus();ta.select();status('Press Ctrl/Cmd+C to copy the selected HTML')})};


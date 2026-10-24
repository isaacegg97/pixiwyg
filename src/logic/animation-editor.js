// SECTION: animation editor (same dialog, four fixed nodes, live preview)
function openAnimEditor(el){
  if(!el.anim){pushUndo();el.anim=defaultAnimGraph();save()}
  openNodeEditor({title:`Animate · ${elName(el.id)}`,graph:el.anim,mode:'anim',el:el.id,onChange:g=>{el.anim=g;save()}});
}
let prevRun=null;
function nedPreview(rebuild){
  const box=$('#nodePrevBox'),el=state.els.find(e=>e.id===ned.el);if(!el)return;
  if(rebuild||!box.firstChild){
    box.replaceChildren();const h=mkEl('div',{className:'nprevhost'});h.attachShadow({mode:'open'});h._target=buildInto(h.shadowRoot,{...el,w:el.w?Math.min(el.w,260):null});box.append(h);
  }
  const spec=animSpec(el.anim),h=box.firstChild;if(prevRun){prevRun.stop();prevRun=null}if(!spec)return;
  prevRun=pxRuntime(emptyGraph(),[{ref:'p',spec:{...spec,trigger:'logic',repeat:spec.repeat==='forever'?'twice':spec.repeat}}],{el:()=>({host:h,target:h._target}),animate(){}});
  $('#nodePrevNote').textContent=`Plays ${TRIGGER_NAMES[spec.trigger]}, ${spec.from==='B'?'from state B back to A':'from A to B'}.`;
  requestAnimationFrame(()=>{if(prevRun)playPreview()});
}
function playPreview(){const box=$('#nodePrevBox'),h=box.firstChild;if(!h||!h.getAnimations)return;for(const a of [...h.getAnimations(),...(h._target?h._target.getAnimations():[])]){a.currentTime=0;a.playbackRate=1;a.play()}}
$('#nodePreview').onclick=()=>{audio();playPreview()};


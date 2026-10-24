// SECTION: header actions
let stT;function status(t){$('#status').textContent=t;clearTimeout(stT);if(t)stT=setTimeout(()=>$('#status').textContent='',4000)}
// RULE: the toolbar's undo follows the same context as Ctrl/Cmd+Z: strokes in the Paint Studio, the project elsewhere.
const inPaint=()=>state.ctx==='studio'&&!$('#w-studio').hidden;
$('#undoBtn').onclick=()=>{audio();inPaint()?sUndo():doUndo()};
$('#redoBtn').onclick=()=>{audio();inPaint()?sRedo():doRedo()};
$('#dynaBtn').onclick=()=>{audio();pushUndo();sfx('boom');stage.classList.remove('boom');void stage.offsetWidth;stage.classList.add('boom');
  setTimeout(()=>{state.els=[];state.bgd.layers=[];state.sel=null;renderAll();renderBackground();renderBgWin();renderInspector();save();status('Kaboom. Undo brings it all back.')},300);
  setTimeout(()=>stage.classList.remove('boom'),600)};


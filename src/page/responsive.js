// SECTION: responsive viewport mode
// RULE: resp mode is on by default for web canvases and persists per-user in localStorage.
//   It shows the stage centered in a bounded column with the checkerboard desk surround so the
//   page boundary is visible. Fixed canvases are never affected — they already have page rects.
//   Authors: pixiwyg contributors  Timestamp: 2026-10-16
const RESP_KEY='pixiwyg.respMode';
function respModeOn(){
  // RULE: default on (null = never set = treat as true).
  const v=localStorage.getItem(RESP_KEY);return v===null?true:v==='1';
}
function respWidth(){
  const sel=$('#respWidthSel');return sel?Number(sel.value)||1280:1280;
}
function setRespMode(on){
  localStorage.setItem(RESP_KEY,on?'1':'0');applyCanvas();
}
function syncRespHud(){
  const btn=$('#respBtn'),grp=$('#respGroup');if(!btn||!grp)return;
  const webCanvas=!isFixed();
  // RULE: the group is hidden on fixed canvases because resp mode has no effect there.
  grp.style.display=webCanvas?'':'none';
  const on=respModeOn();btn.setAttribute('aria-pressed',webCanvas&&on?'true':'false');
  btn.textContent=(webCanvas&&on)?'Resp on':'Resp off';
}
$('#respBtn').onclick=()=>{audio();sfx('blip');setRespMode(!respModeOn())};
$('#respWidthSel').onchange=()=>{if(respModeOn())applyCanvas()};


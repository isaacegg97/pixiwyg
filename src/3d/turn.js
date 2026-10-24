// SECTION: drag to turn, on the page
// RULE: self-contained (it is serialised into the exported page): finds .px3d.drag in each host's shadow root and
//   steps the atlas cell with the pointer, sideways for the angle and up/down for the height. A spinning one stops
//   spinning once someone grabs it. Script-free exports keep the spin and lose the drag.
function px3dDrag(hosts){
  const off=[];
  for(const h of hosts){
    const t=h&&h.shadowRoot&&h.shadowRoot.querySelector('.px3d.drag');if(!t)continue;
    let s={};try{s=JSON.parse(t.getAttribute('data-px3d')||'{}')}catch(e){}
    const cols=Math.max(1,+s.az||16),rows=Math.max(1,+s.rows||1);let f=Math.min(cols-1,+s.frame||0),r=Math.min(rows-1,+s.row||0),d=null;
    const show=()=>{t.style.animation='none';t.style.backgroundPosition=(cols>1?f/(cols-1)*100:0)+'% '+(rows>1?r/(rows-1)*100:0)+'%'};
    const down=e=>{if(e.button>0)return;d={x:e.clientX,y:e.clientY,f,r};try{t.setPointerCapture(e.pointerId)}catch(_){}t.style.cursor='grabbing';e.preventDefault();e.stopPropagation()};
    const move=e=>{if(!d)return;const step=Math.max(4,t.clientWidth/cols);
      f=((d.f+Math.round((e.clientX-d.x)/step))%cols+cols)%cols;r=Math.max(0,Math.min(rows-1,d.r-Math.round((e.clientY-d.y)/(step*3))));show()};
    const up=()=>{d=null;t.style.cursor=''};
    t.addEventListener('pointerdown',down);t.addEventListener('pointermove',move);t.addEventListener('pointerup',up);t.addEventListener('pointercancel',up);
    off.push(()=>{t.removeEventListener('pointerdown',down);t.removeEventListener('pointermove',move);t.removeEventListener('pointerup',up);t.removeEventListener('pointercancel',up)});
  }
  return{stop(){off.forEach(f=>f())}};
}


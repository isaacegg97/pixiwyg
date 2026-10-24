// SECTION: Paint Studio palettes
// RULE: Tools, Color, Brushes, Layers and Frames are palettes, not fixed columns: each docks left of, right of or below the
//   canvas, or floats over it wherever it's dropped. Drag one by its header; on its grip the arrow keys dock it
//   (← left, → right, ↓ below) or float it (↑); – folds it to its title; double-clicking a header puts every palette
//   back. Docks take room from the view, floats sit over it. The layout persists per browser.
const PALKEY='pixiwyg.paint.palettes.v1';
const PAL_DEF={tools:{dock:'l',i:0},color:{dock:'r',i:0},brushes:{dock:'r',i:1},layers:{dock:'r',i:2},frames:{dock:'b',i:0}};
const PAL_WHERE={l:'left of the canvas',r:'right of the canvas',b:'below the canvas',f:'floating over the canvas'};
const smain=$('#studioMain'),palEls=[...smain.querySelectorAll(':scope>.spal')];
let pals=(()=>{try{const p=JSON.parse(localStorage.getItem(PALKEY));return p&&typeof p==='object'?p:{}}catch(e){return{}}})();
const savePals=()=>{try{localStorage.setItem(PALKEY,JSON.stringify(pals))}catch(e){}};
const palOf=el=>({...PAL_DEF[el.dataset.pal],...(pals[el.dataset.pal]||{})});
function applyPals(){
  const docks={l:[],r:[],b:[]};
  for(const el of palEls){const p=palOf(el),fold=el.querySelector('.spalfold');
    el.classList.toggle('folded',!!p.fold);fold.setAttribute('aria-expanded',String(!p.fold));fold.textContent=p.fold?'+':'–';fold.title=p.fold?`Open the ${el.dataset.title} palette`:`Fold the ${el.dataset.title} palette to its title`;
    if(docks[p.dock]){docks[p.dock].push([p.i??0,el]);el.classList.remove('float');el.style.left=el.style.top=''}
    else{el.classList.add('float');smain.append(el);placeFloat(el,p)}}
  for(const [d,list] of Object.entries(docks)){const box=smain.querySelector(`:scope>.sdock.${d}`);list.sort((a,b)=>a[0]-b[0]).forEach(([,el])=>box.append(el));box.hidden=!list.length}
  smain.classList.toggle('nopal',!!pals.hidden);$('#sPalBtn').setAttribute('aria-pressed',String(!pals.hidden));
}
function placeFloat(el,p){const W0=smain.clientWidth,H0=smain.clientHeight;el.style.left=Math.max(0,Math.min(p.x??48,W0-el.offsetWidth))+'px';el.style.top=Math.max(0,Math.min(p.y??48,H0-34))+'px'}
// FORMAT: to is l|r|b (dock, at index i among that dock's palettes, else last) or f (float at {x, y} in the main area).
function movePal(el,to,at){
  const k=el.dataset.pal;
  if(to==='f'){const r=el.getBoundingClientRect(),m=smain.getBoundingClientRect();pals[k]={...palOf(el),dock:'f',x:at?at.x:Math.round(r.left-m.left+32),y:at?at.y:Math.round(r.top-m.top+32)}}
  else{const others=palEls.filter(x=>x!==el&&palOf(x).dock===to).sort((a,b)=>palOf(a).i-palOf(b).i);others.splice(at==null?others.length:Math.max(0,Math.min(at,others.length)),0,el);
    others.forEach((x,i)=>{pals[x.dataset.pal]={...palOf(x),dock:to,i}})}
  savePals();applyPals();status(`${el.dataset.title} is ${PAL_WHERE[to]}.`);
}
function togglePalettes(){pals.hidden=!pals.hidden;savePals();applyPals();audio();sfx(pals.hidden?'whoosh':'pop');status(pals.hidden?'Palettes hidden. Ctrl/⌘+\\ brings them back.':'Palettes shown.')}
function palDrag(e,el){
  if(e.button>0||e.target.closest('.spalfold'))return;
  // FIX: the palette moves to another parent as it lifts, which drops pointer capture; the document hears the rest.
  const r=el.getBoundingClientRect(),dx=e.clientX-r.left,dy=e.clientY-r.top;let moved=false,zone=null;e.preventDefault();
  const mv=ev=>{
    if(!moved&&Math.hypot(ev.clientX-e.clientX,ev.clientY-e.clientY)<5)return;
    const M=smain.getBoundingClientRect();
    if(!moved){moved=true;el.style.width=r.width+'px';el.classList.add('float','dragging');smain.append(el)}
    el.style.left=Math.max(0,Math.min(ev.clientX-M.left-dx,M.width-40))+'px';el.style.top=Math.max(0,Math.min(ev.clientY-M.top-dy,M.height-30))+'px';
    zone=ev.clientX<M.left+64?'l':ev.clientX>M.right-64?'r':ev.clientY>M.bottom-64?'b':null;
    if(zone)smain.dataset.drop=zone;else delete smain.dataset.drop;
  };
  const up=ev=>{document.removeEventListener('pointermove',mv);document.removeEventListener('pointerup',up);document.removeEventListener('pointercancel',up);
    delete smain.dataset.drop;el.classList.remove('dragging');el.style.width='';if(!moved)return;
    if(zone){const others=palEls.filter(x=>x!==el&&palOf(x).dock===zone).sort((a,b)=>palOf(a).i-palOf(b).i);
      const i=others.filter(x=>{const b=x.getBoundingClientRect();return zone==='b'?b.left+b.width/2<ev.clientX:b.top+b.height/2<ev.clientY}).length;movePal(el,zone,i)}
    else movePal(el,'f',{x:Math.round(parseFloat(el.style.left)),y:Math.round(parseFloat(el.style.top))});
    sfx('pop')};
  document.addEventListener('pointermove',mv);document.addEventListener('pointerup',up);document.addEventListener('pointercancel',up);
}
for(const el of palEls){
  const name=el.dataset.title,body=mkEl('div',{className:'spalbody'});body.append(...el.childNodes);
  const head=mkEl('div',{className:'spalhead'}),grip=mkEl('button',{type:'button',className:'spalgrip',textContent:'⠿'}),fold=mkEl('button',{type:'button',className:'spalfold'});
  grip.setAttribute('aria-label',`Move the ${name} palette`);grip.title=`Drag the header to move ${name}. Arrow keys here: ← dock left, → dock right, ↓ dock below, ↑ float. Double-click the header to put every palette back.`;
  head.append(grip,mkEl('b',{textContent:name}),fold);el.append(head,body);el.setAttribute('role','region');el.setAttribute('aria-label',name);
  fold.onclick=()=>{audio();sfx('click');const k=el.dataset.pal;pals[k]={...palOf(el),fold:!palOf(el).fold};savePals();applyPals()};
  grip.onkeydown=e=>{const to={ArrowLeft:'l',ArrowRight:'r',ArrowDown:'b',ArrowUp:'f'}[e.key];if(!to)return;e.preventDefault();e.stopPropagation();movePal(el,to);grip.focus()};
  head.ondblclick=e=>{if(e.target.closest('.spalfold'))return;pals={hidden:pals.hidden};savePals();applyPals();status('Palettes are back where they started.')};
  head.addEventListener('pointerdown',e=>palDrag(e,el));
}
new ResizeObserver(()=>{for(const el of palEls)if(el.classList.contains('float')&&!el.classList.contains('dragging'))placeFloat(el,palOf(el))}).observe(smain);
$('#sPalBtn').onclick=()=>togglePalettes();
applyPals();

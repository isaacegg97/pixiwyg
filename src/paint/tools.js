// SECTION: tools UI
const TOOLS=[
  {id:'brush',key:'b',group:'brush',name:'Brush',hint:'Brush: paints with the brush picked in Brushes. Make your own there: a round tip, a shape wearing a style, or a picture.',svg:'<path d="M14 4l6 6-8 8-6-6z"/><path d="M6 12c-2 0-3 2-3 4 0 2-1 3-2 4 3 0 7-1 8-4"/>'},
  {id:'pencil',key:'b',group:'brush',name:'Pencil',hint:'Pencil: drag to draw in the current color.',svg:'<path d="M4 20l1-5L16 4l4 4L9 19z"/><path d="M14 6l4 4"/>'},
  {id:'rainbow',key:'b',group:'brush',name:'Rainbow brush',hint:'Rainbow brush: the color cycles as you drag.',svg:'<path d="M3 18a9 9 0 0 1 18 0"/><path d="M6.5 18a5.5 5.5 0 0 1 11 0"/><path d="M10 18a2 2 0 0 1 4 0"/>'},
  {id:'spray',key:'b',group:'brush',name:'Spray can',hint:'Spray can: hold still to build up paint.',svg:'<rect x="8" y="9" width="8" height="12" rx="1"/><path d="M10 9V6h4v3"/><path d="M18 4h.01M20 6h.01M18 8h.01M21 3h.01"/>'},
  {id:'bubbles',key:'b',group:'brush',name:'Bubbles',hint:'Bubbles: drag to blow bubbles outlined in the current color.',svg:'<circle cx="9" cy="14" r="5"/><circle cx="17" cy="7" r="3"/><circle cx="18" cy="17" r="2"/>'},
  {id:'select',key:'m',name:'Select',hint:'Select: drag a box; drag inside it to move those pixels. Filters then apply only inside. Delete clears it, Esc lets go.',svg:'<path d="M4 4h4M12 4h4M20 4v4M20 12v4M20 20h-4M12 20H8M4 20v-4M4 12V8" />'},
  {id:'stamp',key:'s',name:'Stamp',hint:'Stamp: click to stamp, drag for a trail. Brush size sets stamp size.',svg:'<path d="M9 4h6v5l4 3v3H5v-3l4-3z"/><path d="M4 20h16"/>'},
  {id:'bucket',key:'g',name:'Paint bucket',hint:'Paint bucket: fills an enclosed area with the current color.',svg:'<path d="M5 11l7-7 7 7-7 7z"/><path d="M19 11c1.5 2.5 2 4 2 5a2 2 0 0 1-4 0c0-1 .5-2.5 2-5z"/>'},
  {id:'eraser',key:'e',name:'Eraser',hint:'Eraser: rubs back to transparent.',svg:'<path d="M4 16l9-9 6 6-6 6H8z"/><path d="M9 21h11"/>'},
  {id:'eyedrop',key:'i',name:'Eyedropper',hint:'Eyedropper: click the painting to pick up a color. Alt+click does the same with any brush.',svg:'<path d="M15 4l5 5-2.5 2.5-5-5z"/><path d="M13.5 8.5L5 17v2h2l8.5-8.5"/>'},
];
const toolsEl=$('#tools');
TOOLS.forEach((t,i)=>{const b=document.createElement('button');b.className='tool';b.dataset.tool=t.id;b.title=`${t.name} (${t.group?'B, Shift+B cycles brushes':t.key.toUpperCase()})`;b.setAttribute('aria-label',t.name);b.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${t.svg}</svg>`;b.onclick=()=>{audio();sfx('click');setTool(t.id)};toolsEl.append(b)});
function setTool(t){
  if(!TOOLS.some(x=>x.id===t))t='pencil';
  state.tool=t;
  toolsEl.querySelectorAll('.tool').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tool===t));
  if(BRUSHES.includes(t))state.lastBrush=t;
  $('#sstack').style.cursor=t==='stamp'||t==='bucket'?'cell':'crosshair';
  renderOpts();
}
const COLORS=['#000000','#ffffff','#ff2e88','#ff3b30','#ff9500','#ffd23f','#34c759','#00a86b','#2ec5ff','#2e5bff','#7a3cff','#c86bff','#8b5a2b','#ffb3c7','#9aa0a6','#4a4a4a'];
const STAMPS=['🐴','🦖','🌵','⭐','🍕','🌈','👾','🍄','🐙','💀','🔥','🎲','🌻','🚀','🐌','🧃'];
const sws=$('#swatches');
function buildSwatches(){
  const usePal=state.palette&&palOpt.paint,list=usePal?state.palette.c:COLORS;
  sws.replaceChildren();sws.style.gridTemplateColumns=`repeat(${usePal?9:8},20px)`;
  list.forEach((c,i)=>{const b=document.createElement('button');b.className='sw';b.style.background=c;b.dataset.c=c;
    b.setAttribute('aria-label',(usePal?PAL_ROLES[i]+' ':'Color ')+c);b.title=usePal?`${PAL_ROLES[i]} ${c}`:c;
    b.onclick=e=>e.altKey?setBg(c):setColor(c);b.oncontextmenu=e=>{e.preventDefault();setBg(c)};sws.append(b)});
  sws.querySelectorAll('.sw').forEach(b=>b.setAttribute('aria-pressed',b.dataset.c===state.color));
}
function setColor(c){state.color=c;if(studio.brush)brushLooksChanged();$('#curColor').style.background=c;$('#colorPick').value=c;sws.querySelectorAll('.sw').forEach(b=>b.setAttribute('aria-pressed',b.dataset.c===c))}
function setBg(c){state.bg=c;$('#bgColor').style.background=c;$('#bgPick').value=c}
function swapColors(){const a=state.color;setColor(state.bg);setBg(a);sfx('click')}
function setSize(n){state.size=Math.max(1,Math.min(200,Math.round(n)));$('#size').value=state.size;$('#sizeVal').textContent=state.size+'px'}
$('#colorPick').oninput=e=>setColor(e.target.value);
$('#bgPick').oninput=e=>setBg(e.target.value);
$('#swapBtn').onclick=()=>{audio();swapColors()};
$('#defBtn').onclick=()=>{setColor('#000000');setBg('#ffffff')};
$('#size').oninput=e=>setSize(+e.target.value);
const stampsEl=$('#stamps');
STAMPS.forEach(s=>{const b=document.createElement('button');b.textContent=s;b.dataset.s=s;b.setAttribute('aria-label','Stamp '+s);b.onclick=()=>{state.stamp=s;audio();sfx('boing');renderOpts()};stampsEl.append(b)});
function renderOpts(){
  const t=TOOLS.find(x=>x.id===state.tool);
  stampsEl.hidden=state.tool!=='stamp';
  // RULE: the options bar shows only what the tool uses: size for marks, opacity and blend for what strokes lay down.
  const marks=PAINT.has(state.tool)&&state.tool!=='bucket';$('#optTool').textContent=t?t.name+(state.tool==='brush'?' · '+curBrush().name:''):'';
  $('#optSize').hidden=!marks;$('#optOpacity').hidden=!marks;$('#optBlend').hidden=!marks||state.tool==='eraser';
  stampsEl.querySelectorAll('button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.s===state.stamp));
  $('#hint').textContent=t?t.hint:'';
}


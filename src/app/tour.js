// SECTION: tour
// RULE: the tour runs on a fresh copy of the demo; everything stays usable, and leaving at any step leaves you in it.
const byStyle=sel=>state.els.find(e=>e.selector===sel&&fileById(e.fileId));
const pickEl=sel=>{const el=byStyle(sel);select(el?el.id:null)};
const K=(k,d)=>[k,d];
const FULL_TOUR=[
  // RULE: the tour opens on the title screen; Next builds the demo and continues inside it.
  {onTitle:true,enter:()=>{$('#tMore').open=true},target:'#tKinds',spot:['#tKinds','#tKindOpts','#tBlank'],title:'Start with a canvas',body:'Every project begins here, with what you’re making: a web page, a printed flyer or poster, a folded zine, an eight-page mini zine, or a fixed screen size. Click one to see its sizes; Create makes a blank one. Next opens the zine fair demo, a web page, to show everything working.',
   keys:[K('Esc','Leave the tour at any step')]},
  {title:'Welcome to PIXIWYG',body:'This is the zine fair demo, already saved as your own project. The tour shows you around and ends right here, so nothing you try along the way is lost or wasted.',
   keys:[K('Esc','Leave the tour at any step')],enter:()=>select(null)},
  {target:'#desk',title:'The page',body:'Everything on the page is a real HTML element wearing a style from a real stylesheet. Drag one to move it; pink guides show when it lines up with something. The handles scale it: Shift keeps proportions, Alt scales from the middle.',
   keys:[K('Arrows','Nudge 1px'),K('Shift+Arrows','Nudge one grid step'),K(M+'+drag','Move or scale without snapping'),K(M+'+J','Duplicate'),K('Delete','Delete')],enter:()=>pickEl('p.lead')},
  {target:'#wsBtn',spot:['#wsBtn','#filesBtn'],title:'Workspaces and files',body:'One project, six ways to work on it, one menu away. Page lays it out; Write is a word processor on the real page; Paint, Music, Animate and 3D give one job the whole screen. On the right, every file in the project (the page, songs, drawings, animations, logic, stylesheets), each opened where it belongs.',
   keys:[K('Alt+1 – 6','Page, Write, Paint, Music, Animate, 3D'),K(M+'+P','Every file in the project')]},
  {target:'#tree',title:'The tree, and contexts',body:'The project tree stays in view: the page, its elements and their parts, then everything else. To choose what to edit about an element (the component on its own, its logic, animation, text or text effects), use ⋯ Edit on its selection box, or double-click it once it’s selected. Panels fold to rails and move anywhere around the page by their headers.',
   keys:[K('↑ ↓','Move through the tree'),K('→ ←','Open, close'),K(M+'+\\','Hide or show both panels')]},
  {target:'#w-styles',title:'The catalog',body:'Every style your stylesheets offer, as live previews, grouped by element type. Drag any card onto the page to add that element. With something selected, hovering a card tries it on and clicking keeps it.',
   keys:[K('1 – 9','Drop that element type at the pointer'),K(', .','Previous, next style for the selection')],enter:()=>{setSide('sideL',true);setTab('w-styles');pickEl('h1.outline')}},
  {target:'#w-selected',title:'The inspector',body:'Edits whatever is selected: its style, extra classes, colors (your own, or the color scheme’s), its text and its position. Colors can follow the page palette or ignore it, element by element. Open as nodes turns its stylesheet rule into a node graph you can edit, and Text effects styles words inside it.',
   keys:[K('Enter','Edit text on the page (or double-click)'),K(M+'+D','Deselect')],enter:()=>{setSide('sideR',true);pickEl('h1.outline');$('#sideR').scrollTop=0}},
  {target:'#w-selected',title:'Text inside markup',body:'This window is markup from 98.css. Instead of making you edit its HTML, the inspector finds each piece of text in it and names the field after the part it fills: the title bar, the buttons, the body.',
   enter:()=>{setSide('sideR',true);pickEl('.window');$('#sideR').scrollTop=0}},
  {target:'#w-files',title:'Stylesheets',body:`Drop in CSS files, folders or a .zip, and fonts and images they point to are baked in. The library has ${LIBRARY.length} frameworks, one click each. Every rule that can style an element shows up in the catalog.`,
   enter:()=>{select(null);setSide('sideL',true);setTab('w-files')}},
  {target:'#w-prims',title:'Primitives',body:'Your own parts bin, shared by every project: drawings, styled elements and backgrounds. It starts stocked with zine furniture, cut-and-paste bits, Web 1.0 relics, windows, paper and doodles. Drag one onto the page to use it; anything selected can be saved as a primitive from the inspector.',
   enter:()=>{setSide('sideL',true);setTab('w-prims')}},
  {target:'#w-bg',title:'Page background',body:'A base color with layers on top: images, gradients and patterns. The doodles behind this page are one image layer, painted in the Paint Studio.',
   enter:()=>{setSide('sideR',true);$('#w-bg').open=true;$('#w-bg').scrollIntoView({block:'start'})}},
  {target:'#w-palette',title:'Color schemes',body:'Pick from hundreds of terminal color schemes, or import your own. Every style on the page can be recolored to match, and colors set to a palette role follow along when you switch.',
   enter:()=>{setSide('sideR',true);$('#w-palette').open=true;$('#w-palette').scrollIntoView({block:'start'})},leave:()=>{$('#w-palette').open=false}},
  {ws:'paint',target:'#w-studio',title:'The Paint Studio',body:'The Paint workspace: a small paint program for stickers, doodles and backgrounds, full size. Empty space stays transparent, and a drawing can have frames, for a flipbook. Finished drawings go on the page, become the background or become a primitive.',
   keys:[K('P','Paint, and back'),K('B','Brush'),K('S','Stamp'),K('G','Paint bucket'),K('E','Eraser'),K('I','Eyedropper'),K('[ ]','Brush size'),K('X','Swap colors')],enter:()=>select(null)},
  {ws:'write',target:'#writer',title:'The writer',body:'The Write workspace is a word processor on the real page: the canvas’s size and margins, each kind of block in its stylesheet’s type, and a paragraph that won’t fit moving to the next sheet. The ribbon has the tools, the status bar counts pages and words, and View → Pages shows the typeset result.',
   keys:[K(M+'+B '+M+'+I','Bold, italic'),K(M+'+1 2 3','Headings'),K(M+'+F','Find'),K(M+'+H','Replace')],enter:()=>select(null)},
  {target:'#afBtn',title:'Markdown and Autoformat',body:'Markdown can be a manuscript you keep writing (in Write, on the page) or become page elements, styled by the stylesheet you choose. Autoformat lays the whole page out again, with presets for an article, notes, a wide column, a two-column newsletter or a tidy-up in place.',
   keys:[K(M+'+V','Paste Markdown onto the page'),K(M+'+Shift+L','Autoformat again with the last settings')],spot:['#mdBtn','#afBtn']},
  {target:'#snapBtn',title:'Snapping and the grid',body:'Snap lines elements up with each other and the page; the grid rounds positions and widths to a step, and Show grid draws it while you work.',
   keys:[K(M+'+Shift+;','Snapping on or off'),K(M+"+'",'Grid lines on or off')],spot:['#snapBtn','.gridctl','#showGridBtn']},
  {target:'#projBtn',title:'Projects and files',body:'Projects save themselves in this browser as you work. Projects goes back to the title screen. Save file downloads a .pixiwyg file: a small zip that rebuilds the page anywhere. Export HTML makes a standalone page.',
   keys:[K(M+'+S','Save now'),K(M+'+Alt+S','Save file'),K(M+'+Shift+S','Export HTML'),K(M+'+Z','Undo'),K(M+'+Shift+Z','Redo')],spot:['#projBtn','#projName','#saveFileBtn','#exportBtn']},
  {target:'#w-canvas',title:'Canvases and print',body:'Every project has a canvas: a web page, printed pages, a folded zine, an eight-page mini zine or a screen size. Pick one when you make a project, or change it here. Paged canvases get margins, bleed, page numbers, and print exports that put pages on sheets in folding order.',
   keys:[K(M+'+= '+M+'+−','Zoom in, out'),K(M+'+0','Actual size'),K(M+'+scroll','Zoom around the pointer')],spot:['#w-canvas','#zoomCtl'],
   enter:()=>{select(null);setSide('sideR',true);$('#w-canvas').open=true;$('#w-canvas').scrollIntoView({block:'start'})},leave:()=>{$('#w-canvas').open=false}},
  {target:'#w-pages',title:'Pages and routing',body:'A web project can be a whole site: + New page adds one, each with its own elements, logic and background. Mark anything On every page for a shared header or footer. Navigation menus, previous/next links and breadcrumbs build themselves from the page list; any element can link to a page, and logic routes with Go to page. It exports as one file, or a zip of pages.',
   keys:[K('Alt+PageDown','Next page'),K('Alt+PageUp','Previous page')],enter:()=>{select(null);openSect('w-pages')},leave:()=>closeSect('w-pages')},
  {target:'#stylesBtn',title:'Styles made of nodes',body:'Styles… wires effects into a style of your own: fill, gradient, outline, shape, shadows, glow, filters, type and motion, plus every effect your stylesheets already use, lifted out as ready-made nodes. Switch a style on for anything in the Inspector’s Effects, or open a stylesheet rule as nodes to edit it the same way (the sheet itself is never changed). On the base primitives (text, shapes and vectors, in Primitives) one style colors the letters, the face or the paths alike.'},
  {target:'#logicBtn',spot:['#logicBtn','#liveBtn','#playBtn'],title:'Animation, logic, and trying it',body:'Animate (in the Inspector) moves an element between two states on hover, click, load or scroll. Logic wires elements together, enough for a working calculator. ▶ Play runs the page right here; Live preview shows the export in its own window as you edit.',
   keys:[K(M+'+Enter','Play the page'),K('Esc','Stop')],enter:()=>select(null)},
  {ws:'music',target:'#seqScroll',title:'The Sequencer',body:'The Music workspace: sketch a tune on a piano roll with drums, hear it through the built-in synth or a SoundFont, save it as a MIDI file, and play it on the page in a real Winamp. A project can hold as many songs as you like.',keys:[K('Space','Play or stop')]},
  {ws:'animate',target:'#timeline',title:'The timeline',body:'The Animate workspace: every animation on the page on one clock. Drag a bar to change when it starts, its edge to change how long; drag along the ruler to scrub.'},
  {ws:'model',target:'#m3dModal .m3dwin',title:'3D',body:'The 3D workspace bakes a low-poly model (OBJ, glTF or STL) into one sprite sheet of every angle, so the page can turn it, spin it or let people drag it round, without a 3D engine. Paint Studio paints its textures.'},
  {target:'#cmdBtn',title:'Commands',body:'Everything PIXIWYG can do, searchable: type a few letters and Enter. Every theme is in here too, so “theme nord” is all it takes.',
   keys:[K('/',"Open the command window"),K(M+'+K','The same'),K('↑ ↓ Enter','Pick and run')]},
  {target:'#moreMenu',spot:['#sideLBtn','#moreMenu','#sideRBtn'],title:'Room to work, and Settings',body:'The two panel buttons fold either side away. More has Settings: the interface theme (thirteen, from Paper to Windows 98 to Dredful, or your own .css), sound, grid and snap defaults, export defaults and resets. When the window is narrow, the tools that don’t fit wait in More too.',
   keys:[K(M+'+,','Settings'),K(M+'+\\','Hide or show both panels'),K('F1 ?','Every keyboard shortcut'),K('Shift+F1 Shift+F2','Dark, light')]},
  {title:'That’s the tour',body:'You’re in the zine fair demo, saved as a project of your own. Move things, restyle them, paint on it, or blow it all up with Dynamite and start fresh. Undo brings anything back.',
   keys:[K('F1','Every shortcut, any time')],enter:()=>select(null),last:true},
];
const tour={on:false,i:0,steps:[],name:'Tour'};
function tourRects(s){
  const vw=innerWidth,vh=innerHeight,p=5;
  return(s.spot||[s.target]).map(q=>q&&$(q)).filter(x=>x&&x.getClientRects().length).map(x=>{const r=x.getBoundingClientRect();
    const l=Math.max(2,r.left-p),t=Math.max(2,r.top-p);return{left:l,top:t,right:Math.min(vw-2,r.right+p),bottom:Math.min(vh-2,r.bottom+p)}});
}
function placeTour(){
  if(!tour.on)return;
  const s=tour.steps[tour.i],card=$('#tourCard'),g=16,vw=innerWidth,vh=innerHeight,cw=card.offsetWidth,ch=card.offsetHeight;
  const rs=tourRects(s);
  $('#tourDim').querySelector('path').setAttribute('d',`M0 0H${vw}V${vh}H0Z`+rs.map(r=>`M${r.left} ${r.top}H${r.right}V${r.bottom}H${r.left}Z`).join(''));
  $('#tourSpots').replaceChildren(...rs.map(r=>{const d=mkEl('div',{className:'tourspot'});Object.assign(d.style,{left:r.left+'px',top:r.top+'px',width:r.right-r.left+'px',height:r.bottom-r.top+'px'});return d}));
  let x,y;
  if(rs.length){
    const r={left:Math.min(...rs.map(r=>r.left)),top:Math.min(...rs.map(r=>r.top)),right:Math.max(...rs.map(r=>r.right)),bottom:Math.max(...rs.map(r=>r.bottom))};
    if(vw-r.right>=cw+g*2){x=r.right+g;y=r.top}
    else if(r.left>=cw+g*2){x=r.left-g-cw;y=r.top}
    else if(vh-r.bottom>=ch+g*2){x=r.left;y=r.bottom+g}
    else if(r.top>=ch+g*2){x=r.left;y=r.top-g-ch}
    else{x=(vw-cw)/2;y=vh-ch-g}
  }else{x=(vw-cw)/2;y=(vh-ch)/2}
  card.style.left=Math.round(Math.max(g,Math.min(x,vw-cw-g)))+'px';card.style.top=Math.round(Math.max(g,Math.min(y,vh-ch-g)))+'px';
}
// RULE: a step that points at a toolbar tool moved into More (narrow windows) opens More, so the spot is real.
function tourReveal(s){const qs=s.spot||[s.target],hid=qs.some(q=>q&&$(q)&&$(q).closest('#tbOverflow'));$('#moreMenu').open=hid}
function tourGo(n){
  const prev=tour.steps[tour.i];if(prev&&prev.leave)prev.leave();
  tour.i=Math.max(0,Math.min(tour.steps.length-1,n));const s=tour.steps[tour.i];
  if(!s.onTitle&&state.project)setWorkspace(s.ws||'page');
  if(s.enter)s.enter();tourReveal(s);
  // RULE: steps over a dialog (sequencer, node editor) lift the tour above dialogs.
  $('#tour').classList.toggle('over',!!s.over);
  $('#tourStep').textContent=`${tour.name} · ${tour.i+1} of ${tour.steps.length}`;$('#tourTitle').textContent=s.title;$('#tourBody').textContent=s.body;
  const dl=$('#tourKeys');dl.replaceChildren();dl.hidden=!s.keys;
  for(const [k,d] of s.keys||[]){const dt=mkEl('dt');for(const x of k.split(' '))dt.append(mkEl('kbd',{textContent:x}));dl.append(dt,mkEl('dd',{textContent:d}))}
  $('#tourBack').disabled=tour.i===0||tour.steps[tour.i-1].onTitle;$('#tourNext').textContent=s.last?'Let me loose':'Next';
  $('#tourCard').querySelectorAll('.tourx').forEach(b=>b.remove());
  for(const c of s.choices||[]){const b=mkEl('button',{type:'button',className:'btn tourx',textContent:c.label});b.onclick=()=>{audio();const st=tour.steps[tour.i];if(st.leave)st.leave();c.fn()};$('#tourNext').before(b)}
  placeTour();requestAnimationFrame(placeTour);setTimeout(placeTour,260);
  $('#tourNext').focus();sfx('blip');
}
// RULE: tours walk the desktop interface, so in XMB they don't start: a profile picked there just opens its example.
function runTour(name,steps){if(document.body.classList.contains('xmb'))return;tour.name=name;tour.steps=steps;tour.i=0;tour.on=true;$('#tour').hidden=false;if(!narrow()){setSide('sideL',true);setSide('sideR',true)}tourGo(0)}
function startTour(){runTour('Tour',FULL_TOUR)}
async function tourNext(){
  const s=tour.steps[tour.i];if(s.last){endTour();return}
  if(s.onTitle){const b=$('#tourNext');b.disabled=true;try{await newProject('Zine fair',true)}finally{b.disabled=false}if(!tour.on)return}
  tourGo(tour.i+1);
}
function endTour(){
  if(!tour.on)return;const s=tour.steps[tour.i];if(s.leave)s.leave();
  tour.on=false;$('#tour').hidden=true;$('#tour').classList.remove('over');$('#moreMenu').open=false;select(null);setTab('w-styles');if(narrow()){setSide('sideL',false);setSide('sideR',false)}
  audio();sfx('boing');status(state.project&&$('#title').hidden?`You’re in ${state.project.name}. It’s saved as a project; Projects has the rest.`:'Pick a canvas and Create, or take the tour any time.');
}
$('#tourNext').onclick=()=>{audio();tourNext()};
$('#tourBack').onclick=()=>{audio();tourGo(tour.i-1)};
$('#tourClose').onclick=endTour;
// FIX: the card keeps Enter/Space so a button press doesn't also edit the selected element.
$('#tourCard').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' ')e.stopPropagation();if(e.key==='ArrowRight'){e.stopPropagation();e.preventDefault();$('#tourNext').click()}if(e.key==='ArrowLeft'){e.stopPropagation();e.preventDefault();if(!$('#tourBack').disabled)$('#tourBack').click()}});
addEventListener('resize',placeTour);
$('#tTour').onclick=()=>{audio();sfx('pop');showWelcome()};
const pickSome=(...prefs)=>{for(const p of prefs){const el=state.els.find(e=>fileById(e.fileId)&&(e.selector===p||e.tag===p));if(el){select(el.id);return el}}select(null);return null};
const openSect=id=>{setSide('sideR',true);const d=$('#'+id);d.open=true;d.scrollIntoView({block:'start'})};
const closeSect=id=>{$('#'+id).open=false};
const S_PAGE={target:'#desk',title:'The page',body:'Everything on it is real HTML wearing a real stylesheet. Drag to move; pink guides mean it lines up with something. The handles scale it: Shift keeps the proportions, Alt scales from the middle, and double-clicking a handle undoes your ambition.',
  keys:[K('Arrows','Nudge 1px'),K('Shift+Arrows','Nudge one grid step'),K(M+'+drag','Move or scale without snapping'),K(M+'+J','Duplicate'),K('Enter','Edit its text'),K('Delete','Delete')],enter:()=>pickSome('h1','p')};
const S_CATALOG={target:'#w-styles',title:'The catalog',body:'Every style your stylesheets offer, as little pictures, grouped by element. Drag one onto the page to add it. With something selected, hovering a card tries it on and clicking keeps it. Commitment issues, catered for.',
  keys:[K('1 – 9','Drop that element type at the pointer'),K(', .','Previous, next style for the selection')],enter:()=>{setSide('sideL',true);setTab('w-styles');pickSome('h1','p')}};
const S_INSPECTOR={target:'#w-selected',title:'The inspector',body:'Edits whatever is selected: its style, colors, text, position and scale. Change a color and the style’s own shading follows, so a recolored button doesn’t keep a ghost of the old one. Animate, Add logic and Save as primitive live at the bottom.',
  keys:[K('Enter','Edit text on the page (or double-click)'),K(M+'+D','Deselect')],enter:()=>{setSide('sideR',true);pickSome('h1','p');$('#sideR').scrollTop=0}};
const S_SHEETS={target:'#t-files',spot:['#t-prims','#t-files'],title:'Stylesheets and primitives',body:`Stylesheets is where looks come from: ${LIBRARY.length} frameworks one click away, or drop in your own CSS, fonts and all. Primitives is your parts bin, shared by every project: drawings, styled elements and backgrounds.`,
  enter:()=>{select(null);setSide('sideL',true);setTab('w-files')},leave:()=>setTab('w-styles')};
const S_SAVE={target:'#exportBtn',spot:['#projBtn','#saveFileBtn','#exportBtn','#liveBtn'],title:'Saving, and getting it out',body:'It saves itself as you go; Projects has the rest. Save file is the project as one small file. Export HTML is the finished page as one file you can host anywhere, or save straight to disk. Live preview keeps a window open on exactly that, updating while you fiddle.',
  keys:[K(M+'+S','Save now'),K(M+'+Alt+S','Save file'),K(M+'+Shift+S','Export HTML'),K(M+'+Z','Undo')],enter:()=>select(null)};
const S_WS={target:'#wsBtn',spot:['#wsBtn','#filesBtn'],title:'Workspaces and files',body:'One project, six ways to work on it: Page, Write, Paint, Music, Animate and 3D. This one opened in the one that suits it; the others are a click away. On the right, every file in the project (songs, drawings, animations, logic, stylesheets), each opened where it belongs.',
  keys:[K('Alt+1 – 6','Page, Write, Paint, Music, Animate, 3D'),K(M+'+P','Every file in the project')],enter:()=>select(null)};
const S_TREE={target:'#tree',title:'The tree',body:'Everything in the project, always in view: the page, each element on it with its parts (style, effects, animation, logic, the song it plays), then songs, drawings, styles and the rest. Click anything to open it. ⋯ Edit on an element’s selection box (or a double-click once it’s selected) chooses what to edit: the component on its own, its logic, its animation, its text or text effects. Every panel folds to a rail (–), moves to the other side (⇄), or drags by its header to anywhere around the page.',
  keys:[K('↑ ↓ → ←','Walk the tree'),K('Double-click','Choose what to edit (when it’s selected)'),K('Esc','Back to the whole page')],enter:()=>pickSome('button','h1')};
const BASICS=[S_PAGE,S_WS,S_TREE,S_CATALOG,S_INSPECTOR,S_SHEETS,S_SAVE];

const PROFILES={
  artist:{name:'Artist',pitch:'You draw things.',gets:'Pages, plus the Paint Studio',example:'artist',ws:'paint',
    intro:'This is the portfolio of a fictional artist who is, statistically, about to have a very good year. It’s yours now. Ten-ish steps, then you’re on your own.',
    steps:[
      {ws:'paint',target:'#w-studio',title:'The Paint workspace',body:'A small paint program for stickers, doodles and backgrounds, with the whole screen to itself. Empty space stays see-through, so whatever you draw sits on the page like a cut-out. It opened on one of the paintings: everything in this portfolio that isn’t text came out of here.',
       keys:[K('P','Paint, and back to the page'),K('B','Brush'),K('S','Stamp'),K('G','Paint bucket'),K('E','Eraser'),K('I','Eyedropper'),K('[ ]','Brush size'),K('X','Swap colors')],enter:()=>select(null)},
      {target:'#sPlace',spot:['#sPlace','#sAsBg','#sSavePrim'],title:'When it’s done (it’s never done)',body:'Put the drawing on the page, make it the page background, or keep it in Primitives to use again later. Double-click a picture on the page (or Edit in Paint) and it comes back here for more work.',
       ws:'paint'},
      {ws:'paint',target:'#frames',title:'Frames',body:'A drawing can be a flipbook: + Frame copies this one to change a little, and the frame before shows faintly underneath (onion skin). With more than one frame it leaves as an animated PNG, which plays anywhere with no script. The blinking blob on the page is six of them.',
       keys:[K(', .','Previous, next frame')]},
      {target:'#filesBtn',title:'Every drawing, one list',body:'The files list on the right has every drawing in the project: pictures on the page and background layers. Pick one and it opens here to paint on; Update puts it back where it came from.',keys:[K(M+'+P','Every file in the project')],ws:'paint'},
      {target:'#w-selected',title:'Symbols',body:'Select anything and ◈ Make a symbol (under Layout): every copy, made with '+M+'+J or placed from the tree, changes together when you restyle one. Each copy keeps its own text and colors, so one price tag can say SOLD while the rest stay hopeful.',
       keys:[K(M+'+J','Another copy')],enter:()=>{const el=state.els.find(e=>e.tag==='span'&&/SOLD|NEW|\d/.test(toText(e.content||'')))||state.els.find(e=>e.tag==='span');if(el)select(el.id);setSide('sideR',true);$('#sideR').scrollTop=0}},
      {target:'#w-bg',title:'Page background',body:'A base color with layers on top: drawings, images, gradients and patterns. Layers stack top to bottom, and each can tile, cover or sit once where you put it.',enter:()=>openSect('w-bg')},
      {target:'#w-palette',title:'Color schemes',body:'Hundreds of ready-made color schemes, or import your own. One click recolors every style on the page to match, and colors set to a palette role follow along when you change your mind. You will change your mind.',
       enter:()=>openSect('w-palette'),leave:()=>closeSect('w-palette')},
    ]},
  musician:{name:'Musician',pitch:'You make noise on purpose.',gets:'Pages, plus the Sequencer',example:'musician',ws:'music',
    intro:'This is the press kit of a band with more gear than gigs. The song is real, the tour dates are not. Ten-ish steps, then it’s all yours.',
    steps:[
      {ws:'music',target:'#wsBtn',spot:['#wsBtn','#seqScroll'],title:'The Music workspace',body:'Not a DAW. A place to sketch a tune, hear it, and save it as a MIDI file every other music program can open. This project opened here, on its song.',enter:()=>select(null)},
      {ws:'music',target:'#seqSong',spot:['#seqSong','#seqSongNew','#seqSongImport'],title:'Songs are files',body:'A project holds as many songs as you like. Open .mid turns any MIDI file into a new one; drop a .mid on the page and it comes with a button that plays it. Double-click a button like that and it offers to bring you back here.'},
      {ws:'music',target:'#seqTrackList',title:'Tracks',body:'Each track is an instrument or a drum kit, with its own volume. M mutes it (and leaves it out of the .mid). Add up to sixteen; your bandmates will want more.'},
      {ws:'music',target:'#seqScroll',title:'Writing notes',body:'Click to add a note, drag to make it longer. Click a note to remove it, or drag it somewhere better. Shift-click for an accent. Click the keys on the left to hear them; click the ruler to choose where play starts.',
       keys:[K('Space','Play or stop'),K('Right-click','Remove a note'),K(M+'+Z','Undo')]},
      {ws:'music',target:'#seqRec',spot:['#seqRec','#seqMidiIn'],title:'Playing it in',body:'● Rec, then play: a MIDI keyboard (MIDI in…) or the computer keys, A to L, with Z and X for octaves. Playing, notes land where you hit them; stopped, each lands at the cursor and steps on, chords included. The wheel over a note sets how hard it’s played.',
       keys:[K('R','Record on or off'),K('A – L','Play notes'),K('Z X','Octave down, up')]},
      {ws:'music',target:'#seqSfLoad',spot:['#seqSfName','#seqSfLoad','#seqSave','#seqSkin'],title:'Better sounds, the file, the player',body:'The built-in synth is honest about being a synth. Load a SoundFont (.sf2) and the sequencer plays real sampled instruments instead. Save .mid writes the song as a standard MIDI file. Player picks the Winamp skin the page’s player wears.',
      },
      {target:'#playBtn',spot:['#playBtn','#logicBtn'],title:'The player on the page',body:'The ▶ on this page is wired to Play the song in Logic, and the song plays in Webamp: a real Winamp, skins and all. Press ▶ Play up here (or Space), then the page’s ▶. The Sequencer picks the skin; bring your own .wsz from the Winamp Skin Museum.',
       keys:[K(M+'+Enter','Play the page'),K('Esc','Stop')],enter:()=>select(null)},
    ]},
  writer:{name:'Writer',pitch:'You have words, and opinions about kerning.',gets:'Pages, plus manuscripts, typesetting and print',example:'writer',ws:'write',
    intro:'This is a little folded zine. Its essay is a manuscript, written here like in a word processor and set onto the pages as it’s typed. The prose is a cry for help. Ten-ish steps, then the blank page is all yours.',
    steps:[
      {ws:'write',target:'#docPage',spot:['#wrTop','#docPage'],title:'The page you write on',body:'Write is a word processor on the real page: this zine’s page size and margins, each kind of block in the type its stylesheet gives it. Paragraphs that won’t fit move to the next sheet. It’s stored as plain Markdown, kept with the project as a .md file.',
       keys:[K(M+'+B '+M+'+I','Bold, italic'),K(M+'+K','Link'),K(M+'+1 2 3','Headings'),K(M+'+0','Body text')],enter:()=>{select(null);wrSetView('edit',true)}},
      {ws:'write',target:'#wrStyles',spot:['#wrStyles','#wrTabs'],title:'The ribbon',body:'Home has the font tools, lists, quotes and a style gallery drawn in the document’s own type; Insert adds pictures, tables and rules; Layout has the page setup and the stylesheet; View switches between the page, the Markdown and the typeset Pages.',
       keys:[K(M+'+F','Find'),K(M+'+H','Replace'),K(M+'+Shift+L','Bullets')]},
      {ws:'write',target:'.wrstatus',spot:['.wrstatus','#wrNav'],title:'Where you are',body:'Navigation lists the headings: click one to go there. The status bar counts pages and words, names the paragraph style under the caret, and zooms. Focus (in View) hides everything but the page, with typewriter scrolling.'},
      {target:'#w-selected',spot:['#w-selected','#desk'],title:'Blocks on the page',body:'Over in Page, the typeset pages are made of manuscript blocks: click one and the text knows where you are. Its look is the manuscript’s, so choose a style in the Catalog and every block of that kind follows.',
       enter:()=>{const el=state.els.find(e=>e.md&&e.tag==='p');if(el)select(el.id);setSide('sideR',true);$('#sideR').scrollTop=0}},
      {target:'#w-selected',title:'Converting',body:'Convert to a component and a block leaves the flow to become a PIXIWYG component of its own: move it, scale it, animate it. The text keeps a marker where it was, and Put back returns it. The title and the line under it on the cover were converted; Convert all (Layout, in Write) does the lot.',
       enter:()=>{const el=state.els.find(e=>e.from)||state.els.find(e=>e.md);if(el)select(el.id);setSide('sideR',true);$('#sideR').scrollTop=0}},
      {ws:'write',target:'#wrLayout',title:'Pages, margins, the stylesheet',body:'Layout shows the page size and margins (Page setup… changes them, and the number of pages), the stylesheet the manuscript wears, and which page it starts on. Change the paper and everything stays on its page.',
       enter:()=>{select(null);wrSetView('edit',true);$('#wrTabs [aria-controls=wrLayout]').click()},leave:()=>{if(wr.on)$('#wrTabs [aria-controls=wrHome]').click()}},
      {target:'#w-checks',title:'Before it goes out',body:'Checks finds text too faint to read, pictures with no description, headings that skip a level; most fix in one click. Versions ('+M+'+Alt+V) keeps named copies of the whole project, so the next draft can be brave.',enter:()=>{select(null);setSide('sideR',true);openSect('w-checks')},leave:()=>closeSect('w-checks')},
      {target:'#exportBtn',title:'To paper',body:(DESKTOP?'Export, then Save PDF:':'Export, then Open to print:')+' the pages go onto printer sheets in folding order, with crop or fold marks if you like. Print double-sided, flip on the short edge, fold, staple. You are now a publisher. Condolences.',
       keys:[K(M+'+Shift+S','Export')]},
    ]},
  animator:{name:'Animator',pitch:'You make things move. Mostly deadlines.',gets:'Pages, plus the Animate timeline',example:'animator',ws:'animate',
    intro:'This is the title sequence for a film that will never be finished, which makes it the most realistic thing in here. It opened in Animate. Ten-ish steps, then it’s all yours.',
    steps:[
      {ws:'animate',target:'#timeline',title:'The timeline',body:'Every animation on the page, one row each, on one clock. A bar starts when its animation starts and lasts as long as it does; faded bars are repeats, striped ones play backwards.'},
      {ws:'animate',target:'#tlRows',title:'Timing by hand',body:'Drag a bar to change when it starts; drag its right edge to change how long it takes. It snaps to 50 ms; hold Shift for 10. Click a row’s name to select it on the page.',keys:[K('Drag','Start time'),K('Drag the edge','Length'),K('Shift','10 ms steps')]},
      {ws:'animate',target:'#tlRuler',spot:['#tlRuler','#tlPlay','#tlStart'],title:'Scrubbing',body:'Drag along the ruler to see any moment, or Play to run the lot. Here everything starts from zero, whatever starts it on the page: hover, click, load or scrolling into view.'},
      {ws:'animate',target:'#tlAnimate',title:'Two states and a transition',body:'Animate the selection opens an element’s animation: state A is where it is, state B where it goes (moved, turned, scaled, faded, recolored), and the transition says how and when. + Keyframe adds stops on the way; pick custom easing and drag the curve. Double-click a row for the same.'},
      {target:'#playBtn',spot:['#playBtn','#liveBtn'],title:'For real',body:'▶ Play runs the page with each animation on its real trigger; Live preview shows the export in its own window. The exported page keeps them all, and hover, load and scroll animations even work without JavaScript.',keys:[K(M+'+Enter','Play'),K('Esc','Stop')],enter:()=>select(null)},
    ]},
};
function profileTour(p){
  const P=PROFILES[p];
  return[{ws:P.ws,title:`Hello, ${P.name.toLowerCase()}`,body:P.intro,keys:[K('→ ←','Next, back'),K('Esc','Leave the tour at any step')],enter:()=>select(null)},
    ...BASICS,...P.steps,
    {title:'That’s the short version',body:'You know enough to be dangerous. Everything here is yours to break; Undo brings anything back. If you want more: how to build components (animation, logic, reusable parts), or the full tour of everything.',
     keys:[K('F1','Every shortcut, any time')],enter:()=>select(null),last:true,
     choices:[{label:'Build components',fn:()=>runTour('Components',COMPONENTS)},{label:'Full tour',fn:()=>runTour('Tour',FULL_TOUR.slice(1))}]}];
}
const COMPONENTS=[
  {title:'Building components',body:'A component here is an element with a look, a behavior, and a place in your parts bin so you can use it again. You’ll make one. I’ll point at things.',enter:()=>pickSome('button','h1')},
  {target:'#w-selected',title:'The look',body:'Pick a style from the catalog, then set its colors here, or switch on a node style under Effects (make one with Styles…). Scale it with the handles if it needs to be louder. The Inspector’s colors carry into the style’s shading, hover and all.',enter:()=>{setSide('sideR',true);pickSome('button','h1');$('#sideR').scrollTop=0}},
  {ws:'animate',target:'#timeline',spot:['#timeline','#tlAnimate'],title:'Animation',body:'The Animate workspace puts every animation on a timeline. Animate the selection gives an element one: state A is it as it is, state B is where it goes (moved, turned, scaled, faded, recolored), and the transition says how, and when: on hover, on click, on load or when it scrolls into view.',
   enter:()=>pickSome('button','h1')},
  {over:true,target:'#nodeModal .nodewin',title:'Logic',body:'Logic wires elements together: when this is clicked, set that text, do some arithmetic, play an animation, show or hide something. The calculator in the Examples menu here is nothing but this. Drag from dot to dot to connect.',
   enter:()=>{select(null);if($('#nodeModal').hidden)openLogicEditor()},leave:()=>closeNodeEditor()},
  {target:'#playBtn',spot:['#playBtn','#liveBtn'],title:'Trying it',body:'▶ Play runs the page for real, right here, until Esc. Live preview opens it in its own window, exactly as it will be exported.',keys:[K(M+'+Enter','Play'),K('Esc','Stop')]},
  {target:'#insPrim',title:'Keeping it',body:'Save as primitive puts the element, its look, its scale and its animation into Primitives, ready for every project. That’s a component. Now go and make a worse calculator.',
   enter:()=>{pickSome('button','h1');$('#insPrim')?.scrollIntoView({block:'center'})},last:true,choices:[{label:'Full tour',fn:()=>runTour('Tour',FULL_TOUR.slice(1))}]},
];


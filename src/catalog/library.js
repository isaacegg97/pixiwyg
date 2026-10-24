// SECTION: the stylesheet library (lib/)
// FORMAT: lib/ holds pinned copies with licenses intact; kb is the file size so a large sheet is announced before it loads.
const LIB_GROUPS=['Zine house styles','Retro systems','Games and terminals','Classless and typography','Frameworks and kits'];
const LIBRARY=[
  {file:'base.css',name:'base.css',era:'Base primitives: text, shapes and vectors, colored by one style',kb:3,group:0,lic:'MIT · PIXIWYG'},
  {file:'xerox.css',name:'xerox.css',era:'Photocopied punk: ransom notes, tape, stamps',kb:7,group:0,lic:'MIT · PIXIWYG'},
  {file:'newsprint.css',name:'newsprint.css',era:'Broadsheet: mastheads, drop caps, columns',kb:6,group:0,lic:'MIT · PIXIWYG'},
  {file:'fanzine.css',name:'fanzine.css',era:'1998 fan page: WordArt, counters, webrings',kb:6,group:0,lic:'MIT · PIXIWYG'},
  {file:'bookish.css',name:'bookish.css',era:'Chapbook: small caps, epigraphs, footnotes',kb:4,group:0,lic:'MIT · PIXIWYG'},
  {file:'dredful.css',name:'dredful.css',era:'Techno-gothic punk: stone circuitry pulsing red, torn tape, Hawaiian patches',kb:40,group:0,lic:'MIT · PIXIWYG'},
  {file:'sugarplum.css',name:'sugarplum.css',era:'Lilac and pastel: unicorns, rainbows, hearts, bows, sparkles',kb:15,group:0,lic:'MIT · PIXIWYG'},
  {file:'undead-darlings.css',name:'undead-darlings.css',era:'Cute and a bit rotten: zombies, tombstones, toe tags, slime',kb:14,group:0,lic:'MIT · PIXIWYG'},
  {file:'velvet-requiem.css',name:'velvet-requiem.css',era:'90s goth: crushed velvet, damask, black lace, blood and silver',kb:15,group:0,lic:'MIT · PIXIWYG'},
  {file:'98.css',name:'98.css',era:'Windows 98',kb:65,group:1,lic:'MIT · jdan/98.css'},
  {file:'xp.css',name:'XP.css',era:'Windows XP',kb:342,group:1,lic:'MIT · botoxparty/XP.css'},
  {file:'7.css',name:'7.css',era:'Windows 7 Aero',kb:79,group:1,lic:'MIT · khang-nd/7.css'},
  {file:'system.css',name:'system.css',era:'Apple System 6',kb:88,group:1,lic:'MIT · sakofchit/system.css'},
  {file:'nes.css',name:'NES.css',era:'8-bit console',kb:282,group:2,lic:'MIT · nostalgic-css/NES.css'},
  {file:'rpgui.css',name:'RPGUI',era:'RPG game menus, wrap in .rpgui-content',kb:1869,group:2,lic:'Zlib · RonenNess/RPGUI'},
  {file:'tuicss.css',name:'TuiCss',era:'MS-DOS text mode',kb:146,group:2,lic:'MIT · vinibiavatti1/TuiCss'},
  {file:'terminal.css',name:'terminal.css',era:'Terminal',kb:15,group:2,lic:'MIT · Gioni06/terminal.css'},
  {file:'hack.css',name:'hack.css',era:'Hacker monospace',kb:12,group:2,lic:'MIT · egoist/hack'},
  {file:'tufte.css',name:'Tufte CSS',era:'Edward Tufte’s books, with sidenotes',kb:237,group:3,lic:'MIT · edwardtufte/tufte-css'},
  {file:'latex.css',name:'LaTeX.css',era:'A LaTeX paper, fonts included',kb:2828,group:3,lic:'MIT · vincentdoerig/latex-css'},
  {file:'sakura.css',name:'Sakura',era:'Minimal and soft',kb:5,group:3,lic:'MIT · oxalorg/sakura'},
  {file:'water.css',name:'Water.css',era:'Clean, light classless',kb:10,group:3,lic:'MIT · kognise/water.css'},
  {file:'simple.css',name:'Simple.css',era:'Plain and readable',kb:9,group:3,lic:'MIT · kevquirk/simple.css'},
  {file:'new.css',name:'new.css',era:'Modern classless',kb:5,group:3,lic:'MIT · xz/new.css'},
  {file:'marx.css',name:'Marx',era:'Classless reset',kb:11,group:3,lic:'MIT · mblode/marx'},
  {file:'bamboo.css',name:'Bamboo',era:'Tiny classless',kb:6,group:3,lic:'MIT · rilwis/bamboo'},
  {file:'mvp.css',name:'MVP.css',era:'Landing-page classless',kb:10,group:3,lic:'MIT · andybrewer/mvp'},
  {file:'pico.css',name:'Pico',era:'Polished classless',kb:69,group:3,lic:'MIT · picocss/pico'},
  {file:'paper.css',name:'PaperCSS',era:'Hand-drawn paper',kb:54,group:4,lic:'ISC · papercss/papercss'},
  {file:'chota.css',name:'Chota',era:'Micro framework: cards, tags, buttons',kb:18,group:4,lic:'MIT · jenil/chota'},
  {file:'bulma.css',name:'Bulma',era:'Cards, notifications, tags, heroes',kb:662,group:4,lic:'MIT · jgthms/bulma'},
  {file:'augmented-ui.css',name:'augmented-ui',era:'Sci-fi clipped corners, via data-augmented-ui',kb:164,group:4,lic:'BSD-2-Clause · propjockey/augmented-ui'},
];
const libText={};
async function fetchLib(file){if(libText[file])return libText[file];const r=await fetch('lib/'+file);if(!r.ok)throw new Error(r.status);return libText[file]=await r.text()}
async function addLib(file,enabled=true){
  const entry=LIBRARY.find(l=>l.file===file);if(!entry||state.files.some(f=>f.lib===file))return null;
  const text=await fetchLib(file);
  const f={id:nid('f'),name:file,text,lib:file,sample:false,enabled};compileFile(f);state.files.push(f);return f;
}
let uidn=0;const nid=p=>p+Date.now().toString(36)+(uidn++).toString(36);


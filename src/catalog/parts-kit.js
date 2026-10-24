// SECTION: parts kit
// INVARIANT: each kit primitive carries only the CSS it needs; placing one brings its library sheet into the project.
const PRIM_KIT=5;
const KIT=[
  ['Basics',[
    ['base.css','span','.text.display','Big Text','Display text'],['base.css','span','.text.serif','Serif words','Serif text'],['base.css','span','.text.hand','handwritten','Hand text'],
    ['base.css','span','.text.pixel','PIXELS','Pixel text'],['base.css','span','.text.terminal','> terminal','Terminal text'],['base.css','span','.text.label','A label','Label'],
    ['base.css','div','.shape.square','','Square',140],['base.css','div','.shape.rounded','','Rounded square',140],['base.css','div','.shape.circle','','Circle',140],['base.css','div','.shape.pill','','Pill',220],
    ['base.css','div','.shape.triangle','','Triangle',140],['base.css','div','.shape.diamond','','Diamond',140],['base.css','div','.shape.hexagon','','Hexagon',150],['base.css','div','.shape.star','','Star',150],
    ['base.css','div','.shape.burst','','Burst',150],['base.css','div','.shape.blob','','Blob',150],['base.css','div','.shape.arrow','','Arrow',220],['base.css','div','.shape.ring','','Ring',140],['base.css','div','.shape.bar','','Bar',300],
    ['base.css','div','.vector','<svg viewBox="0 0 100 100"><path d="M50 88C20 66 6 48 6 30a20 20 0 0 1 44-6 20 20 0 0 1 44 6c0 18-14 36-44 58z"/></svg>','Heart',130],
    ['base.css','div','.vector','<svg viewBox="0 0 100 100"><path d="M50 4l13 30 33 3-25 22 8 33-29-18-29 18 8-33L4 37l33-3z"/></svg>','Vector star',130],
    ['base.css','div','.vector','<svg viewBox="0 0 100 100"><path d="M58 2L18 56h26l-8 42 46-58H54z"/></svg>','Lightning',110],
    ['base.css','div','.vector','<svg viewBox="0 0 120 70"><path d="M30 66a26 26 0 0 1-2-52 34 34 0 0 1 64 8 22 22 0 0 1-2 44z"/></svg>','Cloud',170],
    ['base.css','div','.vector','<svg viewBox="0 0 100 100"><path d="M50 0C54 38 62 46 100 50 62 54 54 62 50 100 46 62 38 54 0 50 38 46 46 38 50 0z"/></svg>','Sparkle',110],
    ['base.css','div','.vector.line','<svg viewBox="0 0 200 40"><path d="M4 20c16-20 32-20 48 0s32 20 48 0 32-20 48 0 32 20 48 0"/></svg>','Wave',260],
    ['base.css','div','.vector.line','<svg viewBox="0 0 200 60"><path d="M6 40C30 6 40 54 64 22s34 30 58 2 30 26 52-6 20 14 20 14"/></svg>','Squiggle',260],
  ]],
  ['Zine furniture',[
    ['newsprint.css','h1','h1.masthead','THE PHOTOCOPY TIMES','Masthead',520],
    ['newsprint.css','p','p.dateline','Vol. 1 · No. 3 · Summer · Free','Dateline',520],
    ['newsprint.css','h3','h3.kicker','Local scene','Kicker'],
    ['newsprint.css','h1','h1.headline','Library photocopier achieves sentience, prints only in pink','Headline',460],
    ['newsprint.css','p','p.byline','By you, staff photocopier','Byline',300],
    ['newsprint.css','p','p.dropcap','Every zine starts with a stapler and a deadline. This one started with a stylesheet, which is arguably worse, and certainly pinker.','Drop-cap paragraph',320],
    ['newsprint.css','blockquote','blockquote.pull','Cut it out, paste it down, run off fifty more.','Pull quote',320],
    ['newsprint.css','div','.boxout','<b>How to fold it</b><br>Fold the sheet in half, then in half again. Staple twice along the spine.','Boxout',260],
    ['newsprint.css','p','p.caption','Fig. 1. The photocopier, moments before.','Caption',260],
    ['newsprint.css','p','p.classified','FOR SWAP: one stapler, barely jammed. Will trade for glue sticks or good gossip.','Classified ad',220],
    ['bookish.css','h1','h1.chapter','Chapter One','Chapter opener',360],
    ['bookish.css','p','p.epigraph','“Paint under it. Style on top of it.” — anonymous','Epigraph',360],
    ['bookish.css','ol','ol.contents','<li>Welcome</li><li>Riso prints</li><li>Mixtapes</li><li>Hand-cut stickers</li>','Contents',260],
    ['bookish.css','hr','hr.fleuron',null,'Fleuron rule',300],
    ['bookish.css','p','p.colophon','Printed in pink at the library. Fifty copies, numbered by hand.','Colophon',300],
  ]],
  ['Dredful',[
    ['dredful.css','h1','h1.eldritch','THE DREAD','Eldritch title',460],
    ['dredful.css','h1','h1.spine','TECHBASE','Spine title',460],
    ['dredful.css','h1','h1.aloha','ALOHA','Aloha title',420],
    ['dredful.css','h2','h2.sigil','Litany','Sigil heading',360],
    ['dredful.css','p','p.litany','The machine dreams in vertebrae. Its tubes hum a hymn in a key the living cannot hold.','Litany',340],
    ['dredful.css','blockquote','blockquote.necronomicon','That is not dead which can eternal lie, and with strange aeons even the shirt may die.','Necronomicon quote',360],
    ['dredful.css','div','.techbase','<b>SECTOR 7 · CRYO</b><br>Biomass nominal. Do not feed the walls.','Techbase panel',300],
    ['dredful.css','div','.aloha','<b>Mahalo</b> for visiting the void.','Aloha panel',260],
    ['dredful.css','div','.warning','Do not wake the archive','Warning stripe',300],
    ['dredful.css','button','button.ritual','Begin the rite','Ritual button'],
    ['dredful.css','button','button.aloha','Hang loose','Aloha button'],
    ['dredful.css','hr','hr',null,'Vertebrae rule',320],
    ['dredful.css','span','span.sigil','Sigil','Sigil tag'],
    ['dredful.css','h1','h1.stencil','NO GODS','Stencil title',460],
    ['dredful.css','p','p.scrawl','the walls are listening','Scrawl',280],
    ['dredful.css','div','.flyer','<b>LIVE IN THE CATACOMBS</b><br>Fri · 9pm · bring a torch','Flyer',260],
    ['dredful.css','span','span.tape','Do not resuscitate','Tape label'],
  ]],
  ['Sugarplum',[
    ['sugarplum.css','h1','h1.rainbow','Sweet Dreams','Rainbow title',460],
    ['sugarplum.css','h1','h1.unicorn','Unicorn Club','Unicorn title',420],
    ['sugarplum.css','h2','h2.ribbon','Best Friends','Ribbon heading',320],
    ['sugarplum.css','p','p.diary','Dear diary, today a unicorn borrowed my glitter pen and never gave it back.','Diary page',340],
    ['sugarplum.css','blockquote','blockquote.cloud','Be the sparkle you wish to see.','Cloud quote',320],
    ['sugarplum.css','div','.meadow','<b>Welcome!</b><br>Pull up a cloud and stay a while.','Meadow panel',300],
    ['sugarplum.css','div','.note','Don\u2019t forget: sleepover Friday!','Sticky note',240],
    ['sugarplum.css','button','button','Sprinkle magic','Pink button'],
    ['sugarplum.css','button','button.rainbow','Make a wish','Rainbow button'],
    ['sugarplum.css','hr','hr.garland',null,'Flower garland',320],
    ['sugarplum.css','span','span.glitter','glitter','Glitter word'],
  ]],
  ['Undead Darlings',[
    ['undead-darlings.css','h1','h1.slime','BRAAAINS','Slimy title',460],
    ['undead-darlings.css','h1','h1.grave','R.I.P.','Tombstone title',280],
    ['undead-darlings.css','h2','h2.tag','Patient Zero','Toe-tag heading',300],
    ['undead-darlings.css','p','p.epitaph','Here lies Gerald. He was a good boy, then a hungry one.','Epitaph',300],
    ['undead-darlings.css','div','.crypt','<b>NIGHT SHIFT</b><br>The graveyard is open late. Bring snacks (not brains).','Crypt panel',300],
    ['undead-darlings.css','div','.toe-tag','<b>Name:</b> Mortimer<br><b>Status:</b> mostly fine','Toe tag',260],
    ['undead-darlings.css','div','.slimed','Something oozed here.','Slimed panel',280],
    ['undead-darlings.css','button','button','Rise up','Slime button'],
    ['undead-darlings.css','button','button.brains','Snack time','Brains button'],
    ['undead-darlings.css','hr','hr.slime',null,'Slime rule',320],
    ['undead-darlings.css','span','span.brain','brain','Brain tag'],
  ]],
  ['Velvet Requiem',[
    ['velvet-requiem.css','h1','h1.bleeding','Nocturne','Bleeding title',460],
    ['velvet-requiem.css','h1','h1.crypt','Eternal','Crypt title',420],
    ['velvet-requiem.css','h2','h2.lace','The Masquerade','Lace heading',340],
    ['velvet-requiem.css','p','p.incantation','We are the children of the night, and the night is long.','Incantation',360],
    ['velvet-requiem.css','blockquote','blockquote.velvet','Love never dies. It only forgets to sleep.','Velvet quote',360],
    ['velvet-requiem.css','div','.damask','<b>Tonight only</b><br>Candles lit at midnight. Black attire requested.','Damask panel',300],
    ['velvet-requiem.css','div','.coffin','<b>Rest</b><br>in pieces','Coffin',200],
    ['velvet-requiem.css','div','.letter','My darling, the moon is full and the roses have all turned black.','Sealed letter',320],
    ['velvet-requiem.css','button','button.blood','Enter the crypt','Blood button'],
    ['velvet-requiem.css','button','button.silver','Remember me','Silver button'],
    ['velvet-requiem.css','hr','hr.blood',null,'Blood rule',320],
    ['velvet-requiem.css','span','span.sigil','Sigil','Sigil tag'],
  ]],
  ['Cut & paste',[
    ['xerox.css','h1','h1.ransom','No future','Ransom headline',480],
    ['xerox.css','h1','h1.blackout','Show tonight','Blackout title'],
    ['xerox.css','h1','h1.stencil','Riot','Stencil title'],
    ['xerox.css','span','.tape','Do not bend','Tape label'],
    ['xerox.css','span','.stamp','Approved','Rubber stamp'],
    ['xerox.css','span','.price','$2','Price sticker'],
    ['xerox.css','span','.label','Side A','Label strip'],
    ['xerox.css','p','p.typed','Typed on a borrowed typewriter, photocopied at midnight, stapled on the bus.','Typewritten note',320],
    ['xerox.css','p','p.scrawl','write back soon!!','Scrawl',240],
    ['xerox.css','blockquote','blockquote.cutout','Make it ugly. Make it yours.','Cut-out quote',300],
    ['xerox.css','div','.flyer','Basement show<br>Doors 8pm<br>No jerks','Flyer box',260],
    ['xerox.css','div','.taped','A note taped to the page. Drag it anywhere.','Taped note',240],
    ['xerox.css','hr','hr.scissors',null,'Scissors line',320],
    ['xerox.css','hr','hr.torn',null,'Torn edge',320],
  ]],
  ['Web 1.0',[
    ['fanzine.css','h1','h1.wordart','My Homepage','WordArt title',460],
    ['fanzine.css','h1','h1.chrome','Cyber Zone','Chrome title',420],
    ['fanzine.css','h1','h1.marquee','Welcome to my corner of the web!!!','Marquee',460],
    ['fanzine.css','div','.construction','🚧 Under construction 🚧','Under construction',300],
    ['fanzine.css','span','.counter','000417','Hit counter'],
    ['fanzine.css','div','.webring','<a href="#">« prev</a> · Zine Webring · <a href="#">next »</a>','Webring',300],
    ['fanzine.css','table','table.guestbook','<thead><tr><th>Name</th><th>Message</th></tr></thead><tbody><tr><td>xX_kat_Xx</td><td>cool site!!</td></tr><tr><td>webmaster</td><td>thx 4 visiting</td></tr></tbody>','Guestbook'],
    ['fanzine.css','button','button.glossy','Click here','Glossy button'],
    ['fanzine.css','button','button.enter','Enter','Enter button'],
    ['fanzine.css','span','.new','New!','New! badge'],
    ['fanzine.css','div','.sparkle','Thanks for stopping by ✨','Sparkle box',260],
    ['fanzine.css','hr','hr',null,'Rainbow rule',320],
    ['fanzine.css','hr','hr.construction',null,'Caution rule',320],
  ]],
  ['Windows & callouts',[
    ['98.css','div','.window','<div class="title-bar"><div class="title-bar-text">Notice.exe</div><div class="title-bar-controls"><button aria-label="Close"></button></div></div><div class="window-body"><p style="margin:0 0 8px">The zine is ready to print.</p><button>OK</button></div>','Windows 98 dialog',240],
    ['98.css','button','button','OK','Windows 98 button'],
    ['nes.css','div','.nes-container.with-title','<p class="title">Quest log</p><p style="margin:0">Find a stapler. Make fifty copies.</p>','NES box',300],
    ['nes.css','div','.nes-balloon.from-left','<p style="margin:0">It’s dangerous to zine alone.</p>','NES speech balloon',280],
    ['nes.css','button','.nes-btn.is-success','Continue','NES button'],
    ['chota.css','div','.card','<h4 style="margin:0 0 6px">Zine swap</h4><p style="margin:0">Bring one, take one. Saturday, noon.</p>','Card',260],
    ['chota.css','span','.tag','Free','Tag'],
  ]],
];
const KIT_BGS=[
  ['Newsprint',{c:'#f6f3ea'},[{type:'pattern',kind:'dots',a:{c:'#00000012'},b:{none:true},size:5,thick:1}]],
  ['Graph paper',{c:'#fbfbf6'},[{type:'pattern',kind:'grid',a:{c:'#9cc3e6'},b:{none:true},size:40,thick:1},{type:'pattern',kind:'grid',a:{c:'#d6e6f4'},b:{none:true},size:8,thick:1}]],
  ['Notebook',{c:'#fffdf5'},[{type:'pattern',kind:'scanlines',a:{c:'#a9c7ec'},b:{none:true},size:28,thick:1}]],
  ['Blueprint',{c:'#1d4e89'},[{type:'pattern',kind:'grid',a:{c:'#ffffff40'},b:{none:true},size:48,thick:1},{type:'pattern',kind:'grid',a:{c:'#ffffff18'},b:{none:true},size:12,thick:1}]],
  ['Halftone pink',{c:'#fff6e0'},[{type:'pattern',kind:'dots',a:{c:'#ff4fa3'},b:{none:true},size:10,thick:2}]],
  ['Kraft paper',{c:'#c9a477'},[{type:'pattern',kind:'crosshatch',a:{c:'#00000010'},b:{none:true},size:6,thick:1}]],
  ['Cutting mat',{c:'#2f6b4f'},[{type:'pattern',kind:'grid',a:{c:'#ffffff55'},b:{none:true},size:38,thick:1},{type:'pattern',kind:'grid',a:{c:'#ffffff1c'},b:{none:true},size:9,thick:1}]],
  ['Xerox grime',{c:'#f2f0eb'},[{type:'pattern',kind:'diagonal',a:{c:'#0000000a'},b:{none:true},size:3,thick:1},{type:'radial',a:{c:'#ffffff00'},b:{c:'#00000022'},shape:'ellipse',pos:'center'}]],
];
// RULE: doodles render here so they come out as transparent stickers, same as Paint Studio output.
function kitDoodles(){
  const out=[],cv=(w,h,fn)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');fn(x,w,h);return{src:c.toDataURL('image/png'),w,h}};
  out.push(['Starburst',cv(180,180,(x,w,h)=>{x.beginPath();for(let i=0;i<32;i++){const r=i%2?62:86,a=i*Math.PI/16;x.lineTo(w/2+Math.cos(a)*r,h/2+Math.sin(a)*r)}x.closePath();x.fillStyle='#ffd23f';x.fill();x.lineWidth=4;x.strokeStyle='#16121f';x.stroke();
    x.font='900 34px "Arial Black",Impact,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillStyle='#ff2e88';x.save();x.translate(w/2,h/2);x.rotate(-.18);x.fillText('NEW!',0,2);x.restore()})]);
  out.push(['Arrow',cv(220,90,(x)=>{x.lineCap=x.lineJoin='round';x.strokeStyle='#16121f';x.lineWidth=7;x.beginPath();x.moveTo(14,62);x.bezierCurveTo(60,10,130,90,196,40);x.stroke();x.beginPath();x.moveTo(170,30);x.lineTo(198,38);x.lineTo(184,64);x.stroke()})]);
  out.push(['Squiggle underline',cv(300,40,(x,w)=>{x.lineCap='round';x.strokeStyle='#ff2e88';x.lineWidth=6;x.beginPath();for(let i=0;i<=w-20;i+=4)x.lineTo(10+i,20+Math.sin(i/9)*9);x.stroke()})]);
  out.push(['Coffee ring',cv(200,200,(x,w,h)=>{for(let k=0;k<3;k++){x.beginPath();x.arc(w/2+k*3,h/2-k*2,74-k*2,0,Math.PI*2);x.lineWidth=8-k*2;x.strokeStyle=`rgba(120,72,30,${.28-k*.07})`;x.stroke()}})]);
  out.push(['Tape strip',cv(200,56,(x,w,h)=>{x.fillStyle='rgba(240,226,160,.85)';x.beginPath();x.moveTo(6,8);for(let i=6;i<=w-6;i+=12)x.lineTo(i,4+Math.random()*6);x.lineTo(w-4,h-8);for(let i=w-6;i>=6;i-=12)x.lineTo(i,h-4-Math.random()*6);x.closePath();x.fill()})]);
  out.push(['Hand-drawn star',cv(120,120,(x,w,h)=>{x.lineJoin='round';x.strokeStyle='#2e5bff';x.lineWidth=5;x.beginPath();for(let i=0;i<=10;i++){const r=i%2?22:52,a=-Math.PI/2+i*Math.PI/5;x.lineTo(w/2+Math.cos(a)*r+(Math.random()-.5)*3,h/2+Math.sin(a)*r+(Math.random()-.5)*3)}x.stroke()})]);
  return out;
}
const kitSheets={};
async function kitPrim([lib,tag,selector,content,name,w],col){
  let f=kitSheets[lib];
  if(!f){f={id:'kit-'+lib,name:lib,text:await fetchLib(lib),lib,enabled:true};compileFile(f);kitSheets[lib]=f}
  const el={tag,content:content??undefined,attrs:undefined,extra:'',w:w||null};
  const t=makeTree({...el,fileId:null,_sel:selector}),nodes=[t.node,...t.node.querySelectorAll('*')];
  const css=cssFrom(pruneRules(f.sheet.cssRules,nodes,false)),low=css.toLowerCase();
  const faces=parseFaces(f.fonts||'').filter(x=>x.fam&&low.includes(x.fam)).map(x=>x.css).join('\n');
  return{kind:'element',name,collection:col,data:{el,style:{sheet:lib,lib,selector,css:(faces?faces+'\n':'')+css}}};
}
// INVARIANT: runs once per PRIM_KIT version, so a deleted kit collection stays deleted.
async function seedKit(){
  if(+lsGet('pixiwyg.primkit','0')>=PRIM_KIT)return;
  const have=new Set(prims.cols),q={quiet:true};let n=0;
  for(const [col,list] of KIT){if(have.has(col))continue;for(const spec of [...list].reverse()){try{addPrim(await kitPrim(spec,col),q);n++}catch(e){}}}
  if(!have.has('Paper & surfaces'))for(const [name,base,layers] of [...KIT_BGS].reverse()){addPrim({kind:'background',name,collection:'Paper & surfaces',data:{bg:{base:cleanColor(base),layers:layers.map(cleanLayer).filter(Boolean)}}},q);n++}
  // RULE: Dredful's page background is its pulsing techbase, read from the sheet itself so the texture has one home.
  if(!have.has('Dredful'))try{const m=/--dr-techbase:url\("([^"]+)"\)/.exec(await fetchLib('dredful.css'));
    if(m)addPrim({kind:'background',name:'Techbase, pulsing',collection:'Dredful',data:{bg:{base:cleanColor({c:'#040303'}),layers:[cleanLayer({type:'image',src:m[1],w:240,h:240,fit:'tile',pos:'left top',scale:100})].filter(Boolean)}}},q),n++}catch(e){}
  // RULE: each house theme's page background is its wallpaper, read from its own sheet, like Dredful's techbase.
  for(const [col,file,v,name,base,w,h] of [['Sugarplum','sugarplum.css','sp-tile','Unicorn wallpaper','#efe3ff',240,240],['Undead Darlings','undead-darlings.css','ud-tile','Graveyard at night','#0b0f0b',260,260],['Velvet Requiem','velvet-requiem.css','vr-damask','Black damask','#0b0509',140,180]]){
    if(have.has(col))continue;try{const m=new RegExp(`--${v}:url\\("([^"]+)"\\)`).exec(await fetchLib(file));
      if(m)addPrim({kind:'background',name,collection:col,data:{bg:{base:cleanColor({c:base}),layers:[cleanLayer({type:'image',src:m[1],w,h,fit:'tile',pos:'left top',scale:100})].filter(Boolean)}}},q),n++}catch(e){}}
  if(!have.has('Doodles'))for(const [name,d] of kitDoodles().reverse()){addPrim({kind:'drawing',name,collection:'Doodles',data:d},q);n++}
  prims.sel=null;prims.view='*';savePrims();lsSet('pixiwyg.primkit',String(PRIM_KIT));
  return n;
}


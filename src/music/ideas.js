// SECTION: song ideas: melodies, basslines, drum beats and chords from a style, for the song's tempo and metre
// RULE: ideas come from music theory, not noise. A style picks a mode, a chord progression (one chord a bar, looping
//   every four), a drum pattern, a bass style and a melody rhythm. Drums are the style's pattern with a fill closing
//   each four-bar phrase and a crash after it; the bass follows the chord roots in the style's rhythm, approaching
//   the next chord; the melody is a one-bar motif heard as A A' B A'' over four bars: chord tones on strong beats,
//   steps between them, a leap answered by a step back, A' the same shape moved to the next chord, the phrase ending
//   on the tonic. The tempo thins the grid: sixteenths become eighths above about 150 BPM.
// RULE: any meter works, irrational ones too (7/3): a step is a sixteenth, or a quarter of an irrational beat, and in
//   anything but 4/4 the meter's groups (meterGroups: 7/8 as 2+2+3) place the kicks, backbeats, bass and accents.
//   Optionally the melody is polytonal (in a second key over the home key's harmony) or polymetric (phrased in
//   cycles of 3, 5 or 7 beats that drift across the bar).
// FORMAT: everything is in the song's ticks (PPQ). Seeded, so one seed always gives one idea.
const IDEA_MODES={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],mixolydian:[0,2,4,5,7,9,10],phrygian:[0,1,3,5,7,8,10],
  phrygdom:[0,1,4,5,7,8,10],harmonic:[0,2,3,5,7,8,11]};
const IDEA_MODE_NAMES={major:'major',minor:'minor',dorian:'Dorian',mixolydian:'Mixolydian',phrygian:'Phrygian',phrygdom:'Phrygian dominant',harmonic:'harmonic minor'};
// FORMAT: drum rows are a sixteen-step 4/4 bar: x hit, o soft (ghost), . rest; GM notes as in DRUMS.
const IDEA_DRUMS={
  pop:{36:'x.....x.x.......',38:'....x.......x...',42:'x.x.x.x.x.x.x.x.'},
  rock:{36:'x.....x.x.x.....',38:'....x.......x...',42:'x.x.x.x.x.x.x.x.'},
  boombap:{36:'x......x..x.....',38:'....x.....o.x...',42:'x.x.x.x.x.x.x.xo'},
  trap:{36:'x......x..x.....',39:'........x.......',42:'x.x.x.x.x.x.x.x.'},
  house:{36:'x...x...x...x...',39:'....x.......x...',46:'..x...x...x...x.',42:'x.x.x.x.x.x.x.x.'},
  synthwave:{36:'x.......x.......',38:'....x.......x...',42:'x.x.x.x.x.x.x.x.'},
  funk:{36:'x.....x...x..x..',38:'....x..o.o..x..o',42:'xxxxxxxxxxxxxxxx'},
  chip:{36:'x.......x.x.....',38:'....x.......x...',42:'x.x.x.x.x.x.x.x.'},
  onedrop:{36:'........x.......',38:'........x.......',42:'x.x.x.x.x.x.x.x.'},
  vapor:{36:'x.......x.x.....',38:'....x.......x...',42:'x...x...x...x...'},
  edu:{36:'x.......x.......',38:'....x.......x...',70:'x.x.x.x.x.x.x.x.',81:'x...............'},
  electro:{36:'x...x...x...x...',39:'....x.......x...',46:'..x...x...x...x.',42:'xxxxxxxxxxxxxxxx'},
  dubstep:{36:'x.........x.....',38:'........x.......',42:'x.x.x.x.x.x.x.x.'},
  hardcore:{36:'x...x...x...x...',39:'....x.......x...',46:'..x...x...x...x.',42:'x.x.x.x.x.x.x.x.'},
  bossa:{36:'x..x....x..x....',37:'x..x..x...x..x..',70:'xxxxxxxxxxxxxxxx'},
  afrobeat:{36:'x.....x...x.....',38:'....x..o....x.o.',42:'x.xxx.xxx.xxx.xx',56:'x.x.xx.x.x.xx.x.',70:'xxxxxxxxxxxxxxxx'},
  flamenco:{36:'x..x..x.x..x..x.',39:'x..x..x...x.x...',37:'....x.......x...'},
  baladi:{36:'x.x.....x.......',64:'x.x.....x.......',60:'......x.....x...',54:'x.x.x.x.x.x.x.x.'},
  taiko:{36:'x.......x..x....',41:'x.......x..x....',76:'....x.......x...'},
  celtic:{36:'x.......x.......',45:'x..x..x.x..x..x.',38:'....x.......x...'},
  gamelan:{36:'x.......x.......',52:'x...............',76:'x.x.x.x.x.x.x.x.',81:'....x.......x...'},
  dungeon:{36:'x...............',41:'x.......x.......',52:'x...............'},
};
// FORMAT: hand percussion and the like, for meters other than 4/4: shakers run on every subdivision, hand drums and
//   wood mark each group, a gong the bar, a triangle the second group.
const IDEA_SHAKERS=[54,69,70],IDEA_HANDS=[37,41,45,56,60,61,62,63,64,75,76,77];
// FORMAT: a style: name, icon, usual tempo, modes to pick from, progressions (scale degrees, 0 = the tonic), drum
//   pattern, bass style, melody grid (subdivisions a beat), density (0–1), gate (share of the gap a note holds), the
//   lead, bass and chord instruments (GM programs from the sequencer's own list), chord rhythm, sevenths, swing (0–1).
const IDEA_GENRES={
  pop:{name:'Pop',icon:'🎹',bpm:112,modes:['major'],progs:[[0,4,5,3],[0,5,3,4],[5,3,0,4],[3,4,0,0]],drums:'pop',bass:'pop',grid:2,density:.55,gate:.9,lead:4,bassProg:33,chordProg:0,chords:'whole'},
  rock:{name:'Rock',icon:'🎸',bpm:128,modes:['mixolydian','minor','major'],progs:[[0,6,3,0],[0,3,4,3],[0,5,6,0]],drums:'rock',bass:'drive',grid:2,density:.5,gate:.95,lead:29,bassProg:33,chordProg:29,chords:'eighths'},
  lofi:{name:'Lo-fi',icon:'☕',bpm:82,modes:['dorian','minor'],progs:[[1,4,0,0],[3,2,1,4],[0,5,1,4]],drums:'boombap',bass:'walk',grid:2,density:.4,gate:.85,lead:4,bassProg:33,chordProg:4,chords:'whole',sevenths:true,swing:.6},
  trap:{name:'Trap',icon:'🔥',bpm:140,modes:['minor','phrygian'],progs:[[0,5,6,4],[0,0,5,6],[0,3,5,4]],drums:'trap',bass:'808',grid:2,density:.35,gate:.8,lead:98,bassProg:38,chordProg:89,chords:'whole'},
  house:{name:'House',icon:'🏠',bpm:124,modes:['minor','dorian'],progs:[[0,5,3,4],[0,3,0,3],[0,6,5,6]],drums:'house',bass:'offbeat',grid:4,density:.4,gate:.5,lead:81,bassProg:38,chordProg:16,chords:'stabs',sevenths:true},
  synthwave:{name:'Synthwave',icon:'🌆',bpm:100,modes:['minor'],progs:[[0,5,2,6],[0,3,5,4],[5,3,0,4]],drums:'synthwave',bass:'octave',grid:2,density:.35,gate:1,lead:81,bassProg:38,chordProg:89,chords:'whole'},
  funk:{name:'Funk',icon:'🕺',bpm:104,modes:['dorian','mixolydian'],progs:[[0,0,3,3],[0,3,0,4],[0,6,0,6]],drums:'funk',bass:'funk',grid:4,density:.45,gate:.6,lead:61,bassProg:33,chordProg:4,chords:'stabs',sevenths:true,swing:.2},
  chip:{name:'Chiptune',icon:'👾',bpm:150,modes:['major','minor'],progs:[[0,4,5,3],[0,5,3,4],[5,3,4,0]],drums:'chip',bass:'arp',grid:4,density:.6,gate:.7,lead:80,bassProg:80,chordProg:80,chords:'whole'},
  reggae:{name:'Reggae',icon:'🌴',bpm:76,modes:['major','minor'],progs:[[0,3,4,3],[0,4,5,3],[0,3,0,4]],drums:'onedrop',bass:'reggae',grid:2,density:.4,gate:.8,lead:24,bassProg:33,chordProg:16,chords:'skank',swing:.3},
  // SECTION: song ideas: old internet styles
  vaporwave:{group:'old',name:'Vaporwave',icon:'📼',bpm:72,modes:['major','dorian'],progs:[[3,2,5,0],[1,4,0,5],[3,4,2,5]],drums:'vapor',bass:'walk',grid:2,density:.35,gate:1,lead:[5,66],bassProg:35,chordProg:5,chords:'whole',sevenths:true,swing:.25,chop:true,
    fx:{melody:[{k:'chorus',rate:.6,depth:.7,mix:.5},{k:'reverb',sec:4,decay:2.5,mix:.45}],chords:[{k:'chorus',rate:.5,depth:.6,mix:.5},{k:'reverb',sec:4,decay:2.5,mix:.4}],drums:[{k:'reverb',sec:1.2,decay:6,mix:.3}]}},
  futurefunk:{group:'old',name:'Future funk',icon:'💿',bpm:118,modes:['major','dorian'],progs:[[3,2,5,4],[1,4,0,5],[3,4,2,5]],drums:'house',bass:'funk',grid:4,density:.4,gate:.6,lead:[66,62],bassProg:33,chordProg:[4,62],chords:'stabs',sevenths:true,swing:.1,
    fx:{chords:[{k:'filter',type:'lowpass',freq:2200,q:4},{k:'pump',depth:.6,rate:1}],bass:[{k:'pump',depth:.35,rate:1}]}},
  edu:{group:'old',name:'Edutainment',icon:'🫧',bpm:104,modes:['major'],progs:[[0,3,4,0],[0,5,3,4],[3,4,2,5]],drums:'edu',bass:'pop',grid:2,density:.5,gate:.8,lead:[12,11,9],bassProg:35,chordProg:4,chords:'whole',sevenths:true,
    fx:{melody:[{k:'reverb',sec:2,decay:3,mix:.3}],chords:[{k:'chorus',rate:.8,depth:.4,mix:.3}]}},
  electro:{group:'old',name:'Electro house',icon:'⚡',bpm:128,modes:['minor','phrygian'],progs:[[0,0,5,6],[0,5,3,6],[0,3,6,5]],drums:'electro',bass:'electro',grid:4,density:.3,gate:.5,lead:[55,62],bassProg:87,chordProg:90,chords:'stabs',
    fx:{bass:[{k:'drive',amt:.5,mix:.6},{k:'pump',depth:.8,rate:1}],chords:[{k:'pump',depth:.75,rate:1},{k:'reverb',sec:1.5,decay:3,mix:.2}],melody:[{k:'reverb',sec:1.5,decay:3,mix:.2}]}},
  brostep:{group:'old',name:'Brostep',icon:'💥',bpm:140,modes:['minor','phrygian'],progs:[[0,0,5,6],[0,1,0,6],[0,5,0,6]],drums:'dubstep',bass:'wobble',grid:2,density:.25,gate:.9,lead:[90,52],bassProg:39,chordProg:89,chords:'whole',
    fx:{bass:[{k:'drive',amt:.6,mix:.7},{k:'comp',thr:-24,ratio:6,att:5,rel:120,gain:6}],melody:[{k:'reverb',sec:2.5,decay:3,mix:.3}]}},
  nightcore:{group:'old',name:'Nightcore',icon:'🌟',bpm:172,modes:['major','minor'],progs:[[0,4,5,3],[5,3,0,4],[0,5,3,4]],drums:'hardcore',bass:'offbeat',grid:4,density:.55,gate:.8,lead:90,bassProg:81,chordProg:0,chords:'skank',
    fx:{melody:[{k:'delay',ms:'dot',fb:.3,mix:.25},{k:'reverb',sec:2,decay:3,mix:.25}],chords:[{k:'pump',depth:.6,rate:1}]}},
  trance:{group:'old',name:'Trance',icon:'🌀',bpm:138,modes:['minor'],progs:[[0,5,2,6],[5,3,0,4],[0,6,5,6]],drums:'house',bass:'rolling',grid:4,density:.7,gate:.6,lead:90,bassProg:81,chordProg:89,chords:'whole',
    fx:{melody:[{k:'delay',ms:'dot',fb:.4,mix:.3},{k:'reverb',sec:3,decay:3,mix:.3}],chords:[{k:'pump',depth:.5,rate:1}],bass:[{k:'pump',depth:.4,rate:1}]}},
  dungeon:{group:'old',name:'Dungeon synth',icon:'🏰',bpm:68,modes:['minor','harmonic','dorian'],progs:[[0,5,6,0],[0,3,5,4],[0,6,5,6],[0,0,5,6]],drums:'dungeon',bass:'drone',grid:2,density:.4,gate:1,lead:[73,6,52],bassProg:48,chordProg:[52,48,89],chords:'whole',backbeat:false,
    fx:{melody:[{k:'reverb',sec:5,decay:2.5,mix:.45}],chords:[{k:'reverb',sec:5,decay:2.5,mix:.4}],drums:[{k:'reverb',sec:4,decay:2,mix:.4}],bass:[{k:'reverb',sec:4,decay:2.5,mix:.3}]}},
  // SECTION: song ideas: world styles
  bossa:{group:'world',name:'Bossa nova',icon:'🥥',bpm:120,modes:['major','dorian'],progs:[[1,4,0,0],[0,5,1,4],[3,2,1,4]],drums:'bossa',bass:'bossa',grid:2,density:.45,gate:.85,lead:[73,66],bassProg:33,chordProg:24,chords:'bossa',sevenths:true,backbeat:false,
    fx:{melody:[{k:'reverb',sec:1.8,decay:3,mix:.2}]}},
  afrobeat:{group:'world',name:'Afrobeat',icon:'🥁',bpm:110,modes:['dorian','mixolydian'],progs:[[0,0,0,0],[0,3,0,3],[0,0,6,6]],drums:'afrobeat',bass:'funk',grid:4,density:.4,gate:.6,lead:61,bassProg:33,chordProg:[16,24],chords:'stabs',sevenths:true,swing:.1},
  flamenco:{group:'world',name:'Flamenco',icon:'💃',bpm:120,modes:['phrygdom'],keys:[4,9],progs:[[3,1,0,0],[0,1,0,1],[6,1,0,0]],drums:'flamenco',bass:'pop',grid:4,density:.5,gate:.7,lead:[24,40],bassProg:33,chordProg:24,chords:'strum',meter:[12,8,[3,3,2,2,2]],
    fx:{chords:[{k:'reverb',sec:1.2,decay:3,mix:.15}]}},
  hijaz:{group:'world',name:'Hijaz',icon:'🐪',bpm:100,modes:['phrygdom'],keys:[2,9,7],progs:[[0,0,1,0],[0,1,0,6],[0,0,6,1]],drums:'baladi',bass:'doum',grid:4,density:.5,gate:.8,lead:[105,73],bassProg:33,chordProg:89,chords:'drone',backbeat:false},
  japanese:{group:'world',name:'Japanese folk',icon:'⛩️',bpm:80,modes:['minor'],melScale:[0,1,5,7,8],progs:[[0,0,5,0],[0,3,0,0]],drums:'taiko',bass:'drone',grid:2,density:.35,gate:.9,lead:[107,77],bassProg:107,chordProg:107,chords:'drone',backbeat:false,
    fx:{melody:[{k:'reverb',sec:2.5,decay:3,mix:.3}]}},
  celtic:{group:'world',name:'Celtic jig',icon:'☘️',bpm:116,modes:['major','mixolydian','dorian'],progs:[[0,6,0,6],[0,3,0,4],[0,0,6,6]],drums:'celtic',bass:'drone',grid:2,density:.75,gate:.85,lead:[110,109,73],bassProg:109,chordProg:24,chords:'strum',meter:[6,8]},
  gamelan:{group:'world',name:'Gamelan',icon:'🔔',bpm:90,modes:['major'],melScale:[0,2,4,7,9],progs:[[0,0,0,0],[0,5,0,5]],drums:'gamelan',bass:'drone',grid:4,density:.65,gate:.7,lead:[9,108,114],bassProg:12,chordProg:11,chords:'drone',backbeat:false,
    fx:{melody:[{k:'reverb',sec:3,decay:2.5,mix:.3}]}},
};
const IDEA_GROUPS=[['now','Now'],['old','Old internet'],['world','World']];
// PERF: mulberry32: a whole idea is a few hundred draws; one seed reproduces it exactly (tests, and Another).
function ideaRng(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const ideaPick=(r,a)=>a[Math.floor(r()*a.length)];
const ROMAN=['I','II','III','IV','V','VI','VII'];

// RULE: a chord is stacked thirds inside the mode (a triad, or a seventh chord for jazzier styles).
function ideaChord(mode,deg,sevenths){const s=IDEA_MODES[mode],at=k=>s[(deg+k)%7]+12*Math.floor((deg+k)/7);return(sevenths?[0,2,4,6]:[0,2,4]).map(k=>at(k))}
function ideaRoman(mode,deg){const c=ideaChord(mode,deg),third=c[1]-c[0],fifth=c[2]-c[0];
  return third===4?ROMAN[deg]:fifth===6?ROMAN[deg].toLowerCase()+'°':ROMAN[deg].toLowerCase()}

function songIdeas(m,{genre='pop',parts={melody:true,bass:true,drums:true},key='auto',second=0,cycle=0,seed=1}={}){
  const g=IDEA_GENRES[genre]||IDEA_GENRES.pop,r=ideaRng(seed),bars=Math.max(1,Math.min(64,m.bars||4)),bpm=m.bpm||g.bpm;
  const mode=ideaPick(r,g.modes),scale=IDEA_MODES[mode],minorish=scale[2]===3;
  const tonic=key==='auto'?ideaPick(r,g.keys||(minorish?[9,4,2,7,0,5]:[0,7,2,9,5,4])):(+key%12+12)%12;
  const inst=v=>Array.isArray(v)?ideaPick(r,v):v;
  // FORMAT: a style's effects per part; a delay of 'dot' is a dotted eighth at the song's tempo.
  const fxFor=part=>((g.fx||{})[part]||[]).map(f=>({...f,on:true,...(f.ms==='dot'?{ms:Math.round(60000/bpm*.75)}:{})}));
  // FORMAT: second: semitones the melody's key sits above the home key (0 none, -1 surprise); cycle: the melody's
  //   phrase length in beats against the bar (0 the bar, -1 surprise).
  const shift=second<0?ideaPick(r,[1,2,3,4,6]):second|0,melTonic=(tonic+shift)%12;
  const beatT=beatTicks(m),barT=barTicks(m),irr=irrational(m),step=irr?beatT/4:PPQ/4,spb=beatT/step,stepsBar=barT/step,end=bars*barT;
  const groups=meterGroups(m),gStart=groups.reduce((a,x)=>(a.push(a.at(-1)+x*spb),a),[0]).slice(0,-1),gLen=groups.map(x=>x*spb);
  const isGroup=st=>gStart.includes(st),isBeat=st=>st%spb===0,half=Math.max(1,spb/2);
  // RULE: a style's own patterns are written for 4/4; every other meter is built from its groups.
  const common=!irr&&(m.unit||4)===4&&m.beats===4&&!m.groups;
  const prog=ideaPick(r,g.progs),fast=bpm>=150,swingT=Math.round(step*.33*(g.swing||0));
  const swing=(st,unit)=>st%(2*unit)===unit?swingT*(unit===1?1:2):0;
  const chordAt=b=>prog[((b%prog.length)+prog.length)%prog.length],tracks=[];
  const note=(t,d,p,v)=>({t:Math.max(0,Math.min(end-1,Math.round(t))),d:Math.max(1,Math.min(end-Math.round(t),Math.round(d))),p:Math.max(0,Math.min(127,Math.round(p))),v:Math.max(1,Math.min(127,Math.round(v)))});
  const hum=a=>(r()-.5)*2*a;

  // SECTION: song ideas: drums
  if(parts.drums){
    const notes=[],pat=IDEA_DRUMS[g.drums],snare=pat[39]?39:38,hatEvery=['funk','electro','afrobeat'].includes(g.drums)?1:fast?spb:half;
    const fourFloor=['house','electro','hardcore'].includes(g.drums),halfTime=['trap','dubstep'].includes(g.drums),extra=Object.keys(pat).map(Number).filter(n=>![36,38,39,42,46].includes(n));
    for(let b=0;b<bars;b++){
      const t0=b*barT,fill=bars>=4&&b%4===3,crash=b%4===0&&!['trap','boombap','onedrop'].includes(g.drums),fillFrom=stepsBar-Math.min(4,gLen.at(-1));
      const hit=(st,p,v)=>notes.push(note(t0+st*step+swing(st,1),step/2,p,v+hum(8)));
      if(common){
        for(const [n,row] of Object.entries(pat))for(let st=0;st<16;st++){
          let c=row[st];if((+n===42||+n===46)&&fast&&g.drums!=='trap'&&st%2)c='.';
          if(fill&&st>=12&&+n!==42&&+n!==46)c='.';
          if(c==='.'||(+n===42&&g.drums!=='funk'&&g.drums!=='trap'&&c==='x'&&r()<.06))continue;
          hit(st,+n,c==='x'?(st%4===0?104:92):52);
        }
      }else{
        // RULE: in any other meter the groups carry the beat: a kick starts the bar and every second group after it,
        //   a backbeat starts the groups between (one group alone gets it halfway through), hats run on the
        //   subdivisions with an accent on each group. House kicks every beat; trap's backbeat sits on the middle
        //   group (half time); the one-drop is kick and snare together on the middle group only.
        const mid=gStart[Math.floor(groups.length/2)]||Math.floor(stepsBar/2);
        for(let st=0;st<stepsBar;st++){
          if(fill&&st>=fillFrom)continue;
          const gi=gStart.indexOf(st);
          if(g.drums==='onedrop'){if(st===mid){hit(st,36,100);hit(st,38,96)}}
          else{
            if(gi>=0&&gi%2===0||fourFloor&&isBeat(st))hit(st,36,gi===0?108:98);
            const back=halfTime?st===mid&&groups.length>1:gi>=0&&gi%2===1||groups.length===1&&st===Math.floor(stepsBar/2);
            if(back&&g.backbeat!==false)hit(st,snare,100);
            else if(['funk','boombap','afrobeat'].includes(g.drums)&&!isBeat(st)&&r()<.12)hit(st,38,48);
          }
          if(pat[42]&&st%hatEvery===0&&!(g.drums!=='funk'&&g.drums!=='trap'&&r()<.06))hit(st,42,isGroup(st)?100:isBeat(st)?86:70);
          if(pat[46]&&spb>=2&&st%spb===spb/2)hit(st,46,84);
          for(const n of extra){
            if(IDEA_SHAKERS.includes(n)&&st%half===0)hit(st,n,isGroup(st)?84:62);
            else if(IDEA_HANDS.includes(n)&&gi>=0)hit(st,n,gi%2?88:100);
            else if(n===52&&st===0)hit(st,n,96);
            else if((n===80||n===81)&&st===(gStart[1]??Math.floor(stepsBar/2)))hit(st,n,80);
          }
        }
      }
      if(g.drums==='trap'&&r()<.6){
        // RULE: trap hats roll: half a beat in thirty-seconds or triplets, once a bar or so, in the last group.
        const at=t0+gStart.at(-1)*step+Math.max(0,gLen.at(-1)-half)*step,div=ideaPick(r,[8,6]),len=half*step;
        for(let k=0;k<div/2;k++)notes.push(note(at+k*len*2/div,len/div,42,70+k*6));
      }
      if(fill){const at=t0+fillFrom*step,n=stepsBar-fillFrom,toms=r()<.5;
        for(let k=0;k<n;k++)notes.push(note(at+k*step,step/2,toms?[50,50,47,45,45,45][Math.min(5,k)]:38,72+k*10));
        notes.push(note(at,step/2,36,96))}
      if(crash||(b>0&&b%4===0))notes.push(note(t0,beatT,49,98));
    }
    tracks.push({name:`Drums · ${g.name}`,drums:true,prog:0,vol:100,notes,fx:fxFor('drums')});
  }

  // SECTION: song ideas: bass
  const pcOf=(deg,t=tonic)=>(t+scale[deg%7])%12;
  const bassRoot=deg=>{let p=36+pcOf(deg);if(p>45)p-=12;return p};
  if(parts.bass){
    const notes=[];
    for(let b=0;b<bars;b++){
      const deg=chordAt(b),root=bassRoot(deg),ch=ideaChord(mode,deg,g.sevenths).map(i=>root+i-scale[deg%7]),next=bassRoot(chordAt(b+1)),t0=b*barT;
      const fifth=root+7,oct=root+12,approach=next+(next>root?-1:1);
      const hits=(steps,pitch,gate=.9)=>{const s=[...new Set(steps)].filter(x=>x>=0&&x<stepsBar).sort((a,b)=>a-b);s.forEach((st,i)=>{const nx=i+1<s.length?s[i+1]:stepsBar;notes.push(note(t0+st*step+swing(st,common?2:half),(nx-st)*step*gate,pitch(st,i,s.length),st===0?108:isGroup(st)?98:88+hum(6)))})};
      // RULE: wobble bass is written as cells a beat long: held, eighths, sixteenths or triplets of the same note, each
      //   note one sweep of the filter (the wobble voice); roots mostly, with the octave and the flat second for spice.
      const wobble=()=>{for(let k=0;k<m.beats;k++){const at=t0+k*beatT,cell=k===0?ideaPick(r,['hold','8','16']):ideaPick(r,['hold','8','16','3','8','16']),n={hold:1,'8':2,'16':4,'3':3}[cell],len=beatT/n;
        const p=k===0?root:ideaPick(r,[root,root,oct,root+1,fifth]);for(let j=0;j<n;j++)notes.push(note(at+j*len,len,p,k===0&&j===0?112:100+hum(6)))}};
      const every=k=>Array.from({length:Math.ceil(stepsBar/k)},(_,i)=>i*k),offs=spb>=2?every(spb).map(x=>x+spb/2):every(2).map(x=>x+1);
      if(common)switch(g.bass){
        case'pop':hits([0,6,8,14],(st,i,n)=>i===n-1?approach:i===2&&r()<.5?fifth:root);break;
        case'drive':hits(every(2),(st,i,n)=>i===n-1&&r()<.6?approach:root,.85);break;
        case'walk':hits(every(4),(st,i,n)=>i===0?root:i===n-1?approach:ideaPick(r,[ch[1],ch[2],ch[3]||oct]));break;
        case'808':hits([...IDEA_DRUMS.trap[36]].map((c,i)=>c==='x'?i:-1),(st,i,n)=>i===n-1&&r()<.4?oct:root,1);break;
        case'offbeat':hits([2,6,10,14],(st,i,n)=>i===n-1&&r()<.4?oct:root,.5);break;
        case'octave':hits(every(2),(st,i)=>i%2?oct:root,.8);break;
        case'funk':hits([0,3,5,6,10,12,15],(st,i)=>i===0?root:ideaPick(r,[root,oct,oct,fifth,root+10]),.45);break;
        case'arp':hits(every(2),(st,i)=>[root,fifth,oct,fifth][i%4],.7);break;
        case'reggae':hits([0,3,6,10],(st,i)=>[root,ch[1],ch[2],root][i]??root,.8);break;
        case'electro':hits(every(2).map(x=>x+1),(st,i)=>i%4===3?oct:root,.5);break;
        case'rolling':hits(every(1).filter(x=>x%4),(st,i,n)=>i===n-1&&r()<.5?approach:root,.7);break;
        case'bossa':hits([0,6,8,14],(st,i)=>i%2?fifth-12:root,.9);break;
        case'doum':hits([0,2,8],()=>root,.9);break;
        case'drone':hits([0],()=>root,1);break;
        case'wobble':wobble();break;
      }else switch(g.bass){
        case'electro':hits(every(1).filter(x=>x%2),(st,i)=>i%4===3?oct:root,.5);break;
        // RULE: rolling bass skips the beats; where every step is a beat (x/16) it skips the group starts instead.
        case'rolling':hits(every(1).filter(x=>spb>1?!isBeat(x):!isGroup(x)),(st,i,n)=>i===n-1&&r()<.5?approach:root,.7);break;
        case'bossa':hits(gStart.flatMap((s,i)=>[s,s+Math.floor(gLen[i]/2)]),(st,i)=>i%2?fifth-12:root,.9);break;
        case'doum':hits(gStart,()=>root,.9);break;
        case'drone':hits([0],()=>root,1);break;
        case'wobble':wobble();break;
        // RULE: in other meters the bass lands on the groups: on every group start, or on every subdivision for the
        //   driving styles, or on the offbeats for house; the last note walks into the next chord.
        case'drive':case'octave':case'arp':hits(every(half),(st,i,n)=>g.bass==='octave'?(i%2?oct:root):g.bass==='arp'?[root,fifth,oct,fifth][i%4]:i===n-1&&r()<.6?approach:root,.8);break;
        case'walk':hits(every(spb),(st,i,n)=>i===0?root:i===n-1?approach:ideaPick(r,[ch[1],ch[2],ch[3]||oct]));break;
        case'offbeat':hits(offs,(st,i,n)=>i===n-1&&r()<.4?oct:root,.5);break;
        case'funk':hits([...gStart,...gStart.map((s,i)=>s+1+Math.floor(r()*(gLen[i]-1)))],(st,i)=>i===0?root:ideaPick(r,[root,oct,fifth,root+10]),.45);break;
        default:hits([...gStart,...(g.bass==='pop'?[stepsBar-half]:[])],(st,i,n)=>g.bass==='pop'&&i===n-1?approach:g.bass==='reggae'?[root,ch[1],ch[2],root][i%4]:i&&isGroup(st)&&r()<.3?fifth:root,g.bass==='808'?1:.9);
      }
    }
    tracks.push({name:`Bass · ${g.name}`,drums:false,prog:inst(g.bassProg),vol:100,notes,fx:fxFor('bass')});
  }

  // SECTION: song ideas: chords
  if(parts.chords){
    const notes=[];
    for(let b=0;b<bars;b++){
      const deg=chordAt(b),base=48+pcOf(deg)+(pcOf(deg)>7?-12:0),voice=ideaChord(mode,deg,g.sevenths).map(i=>base+i-scale[deg%7]),t0=b*barT;
      // RULE: with a second key the chord is bitonal: the same degree's triad in that key stacked above the home one.
      if(shift)voice.push(...ideaChord(mode,deg,false).map(i=>base+12+shift+i-scale[deg%7]));
      const offs=spb>=2?Array.from({length:m.beats},(_,i)=>i*spb+spb/2):Array.from({length:Math.floor(stepsBar/2)},(_,i)=>i*2+1);
      const at=(steps,len,v)=>steps.filter(s=>s<stepsBar).forEach(st=>voice.forEach(p=>notes.push(note(t0+st*step+swing(st,1),len,p,v+hum(4)))));
      if(g.chords==='drone'){[base,base+7,base+12].forEach(p=>notes.push(note(t0,barT*.99,p,64)));continue}
      // RULE: a strum spreads the chord's notes a few milliseconds apart, low to high, like a hand across strings.
      const strum=(steps,len,v)=>steps.filter(s=>s<stepsBar).forEach(st=>voice.forEach((p,k)=>notes.push(note(t0+st*step+k*PPQ/48,len,p,v+hum(6)))));
      if(g.chords==='strum'){strum(common?[0,3,6,8,11,14]:gStart.flatMap((s,i)=>[s,s+Math.max(1,Math.floor(gLen[i]/2))]),step*1.5,76);continue}
      if(g.chords==='bossa'){at(common?[0,3,6,10,12]:gStart.flatMap((s,i)=>[s,s+Math.max(1,gLen[i]-1)]),step*1.4,62);continue}
      if(g.chords==='whole')at([0],barT*.98,70);
      else if(g.chords==='eighths')at(Array.from({length:Math.ceil(stepsBar/half)},(_,i)=>i*half),half*step*.8,66);
      else at(common&&g.chords==='stabs'?[2,6,10,14]:offs,step*.9,g.chords==='stabs'?74:72);
    }
    tracks.push({name:`Chords · ${g.name}`,drums:false,prog:inst(g.chordProg),vol:80,notes,fx:fxFor('chords')});
  }

  // SECTION: song ideas: melody
  if(parts.melody){
    const notes=[],unit=g.grid===4&&!fast?Math.max(1,spb/4):half;
    const lo=60+melTonic>67?48+melTonic:60+melTonic,pool=[];
    // RULE: a style's melody scale (a pentatonic over the harmony's full scale) narrows the notes the melody may use.
    const mscale=g.melScale||scale;
    for(let p=lo-3;p<=lo+19;p++)if(mscale.includes(((p-melTonic)%12+12)%12))pool.push(p);
    const idx=p=>pool.reduce((b,q,i)=>Math.abs(q-p)<Math.abs(pool[b]-p)?i:b,0);
    const chordPcs=b=>{const c=ideaChord(mode,chordAt(b),g.sevenths).map(i=>(melTonic+i)%12),ok=c.filter(pc=>mscale.includes(((pc-melTonic)%12+12)%12));return ok.length?ok:[melTonic]};
    const nearestChordTone=(b,from)=>{const pcs=chordPcs(b);let best=null;for(const p of pool)if(pcs.includes(p%12)&&(best===null||Math.abs(p-from)<Math.abs(best-from)||Math.abs(p-from)===Math.abs(best-from)&&r()<.5))best=p;return best};
    // FORMAT: the melody's phrases are segments: the bars, or with a cycle, runs of that many beats laid end to end
    //   across the bars (a polymeter); a segment takes the chord sounding where it starts.
    const cyc=cycle<0?ideaPick(r,[3,5,7]):cycle|0,segSteps=cyc>0?cyc*spb:stepsBar,segs=[];
    for(let t=0;t<end;t+=segSteps*step)segs.push({t0:t,steps:Math.min(segSteps,Math.round((end-t)/step)),bar:Math.floor(t/barT)});
    const strongAt=(seg,st)=>cyc>0?st%spb===0&&(st===0||st%(spb*2)===0):isGroup(st)||isBeat(st);
    const rhythm=steps=>{const on=[];for(let st=0;st<steps;st+=unit){const strong=strongAt({},st);if(r()<(strong?g.density+.25:g.density-.1))on.push(st)}if(!on.includes(0))on.unshift(0);if(on.length<2&&steps>unit)on.push(Math.floor(steps/2/unit)*unit);return on};
    let prev=pool[Math.floor(pool.length/2)],leap=0,motif=null;
    const rA=rhythm(segSteps),rB=rhythm(segSteps);
    segs.forEach((seg,si)=>{
      const ph=si%4,last=ph===3||si===segs.length-1,rh=(ph===2?rB:rA).filter(st=>st<seg.steps),pitches=[];
      if(!rh.length)return;
      // RULE: A' and A'' replay A's shape (its steps through the scale), moved to start on this segment's chord.
      if((ph===1||ph===3)&&motif&&motif.length>=rh.length){let i=idx(nearestChordTone(seg.bar,prev));for(const d of motif.slice(0,rh.length)){i=Math.max(0,Math.min(pool.length-1,i+d));pitches.push(pool[i])}}
      else{
        rh.forEach((st,k)=>{let p;
          if(k===0||strongAt(seg,st))p=nearestChordTone(seg.bar,prev+(r()<.5?2:-2));
          else{let i=idx(prev);if(leap){i+=-Math.sign(leap);leap=0}else if(r()<.15){leap=ideaPick(r,[-4,-3,3,4]);i+=leap}else i+=r()<(ph<2?.6:.4)?1:-1;p=pool[Math.max(0,Math.min(pool.length-1,i))]}
          pitches.push(p);prev=p});
        if(ph===0)motif=pitches.map((p,k)=>k?idx(p)-idx(pitches[k-1]):0);
      }
      // RULE: a phrase ends on the tonic, the one nearest the note before it.
      if(last){const ref=pitches.length>1?pitches.at(-2):prev;let best=null;for(const p of pool)if(p%12===melTonic&&(best===null||Math.abs(p-ref)<Math.abs(best-ref)))best=p;if(best!==null)pitches[pitches.length-1]=best}
      // RULE: a vaporwave B section is chopped: the opening beat of the motif looped, the way a sample gets stuck.
      if(g.chop&&ph===2&&pitches.length){const cut=rh.filter(st=>st<spb),bits=cut.length?cut:[0];
        for(let b0=0;b0<seg.steps;b0+=spb)bits.forEach((st,k)=>{if(b0+st<seg.steps)notes.push(note(seg.t0+(b0+st)*step,Math.min(spb-st,(bits[k+1]??spb)-st)*step*.9,pitches[k]??pitches[0],92+hum(6)))});
        prev=pitches.at(-1);return}
      rh.forEach((st,k)=>{const nx=k+1<rh.length?rh[k+1]:seg.steps,hold=last&&k===rh.length-1?seg.steps-st:Math.min(nx-st,(g.gate>=1?2:1)*spb);
        notes.push(note(seg.t0+st*step+swing(st,unit),hold*step*Math.min(.95,g.gate),pitches[k],(strongAt(seg,st)?100:86)+hum(6)))});
      prev=pitches.at(-1);
    });
    tracks.push({name:`Melody · ${g.name}`,drums:false,prog:inst(g.lead),vol:90,notes,fx:fxFor('melody')});
    if(cyc>0)tracks.at(-1).cycle=cyc;
  }
  for(const t of tracks){t.notes.sort((a,b)=>a.t-b.t||a.p-b.p);if(!t.fx.length)delete t.fx}
  const meter=`${m.beats}/${m.unit||4}`+(groups.length>1&&!common?` (${groups.join('+')})`:'');
  const melCycle=tracks.find(t=>t.cycle)?.cycle;for(const t of tracks)delete t.cycle;
  return{tracks,summary:{genre:g.name,key:NOTE_NAMES[tonic]+' '+IDEA_MODE_NAMES[mode],mode,tonic,melTonic,second:shift,
    melScale:(g.melScale||scale).map(i=>(i+melTonic)%12),melodyKey:shift?NOTE_NAMES[melTonic]+' '+IDEA_MODE_NAMES[mode]:null,cycle:melCycle||0,meter,prog:prog.map(d=>ideaRoman(mode,d)).join(' – '),bpm,bars}};
}

// SECTION: song ideas panel
// RULE: Generate adds the idea as new tracks (clearing out empty tracks first, so a new song's blank Piano and Drums
//   don't linger) and plays it at once; Another swaps the last idea for a fresh one. Each is one undo step.
const IDEAS={genre:'pop',parts:{melody:true,bass:true,drums:true,chords:false},last:null};
// FORMAT: meter quick picks: [label, beats, unit, groups]; the first keeps the song's own meter.
const IDEA_METERS=[['The song’s'],['The style’s own'],['4/4',4,4],['3/4',3,4],['5/4',5,4],['6/8',6,8],['7/8 (2+2+3)',7,8,[2,2,3]],['7/8 (3+2+2)',7,8,[3,2,2]],
  ['9/8 (2+2+2+3)',9,8,[2,2,2,3]],['11/8',11,8],['13/16',13,16],['7/3 (irrational)',7,3],['5/6 (irrational)',5,6]];
function ideasDraw(){
  const box=$('#seqIdeasGenres');box.replaceChildren();
  // RULE: the styles come in groups (now, old internet, world), each under its own heading, one radio group across.
  for(const [gid,glabel] of IDEA_GROUPS){box.append(mkEl('h5',{className:'idgroup',textContent:glabel}));
  for(const [id,g] of Object.entries(IDEA_GENRES).filter(([,x])=>(x.group||'now')===gid)){
    const b=mkEl('button',{type:'button',className:'idgenre'});b.setAttribute('role','radio');b.setAttribute('aria-checked',IDEAS.genre===id);b.tabIndex=IDEAS.genre===id?0:-1;
    b.append(mkEl('i',{textContent:g.icon}),mkEl('b',{textContent:g.name}),mkEl('small',{textContent:g.bpm+' BPM'}));b.firstChild.setAttribute('aria-hidden','true');
    if(g.meter)b.title=`Plays in ${g.meter[0]}/${g.meter[1]} with “The style’s own” meter`;
    b.onclick=()=>{audio();sfx('click');IDEAS.genre=id;ideasDraw()};box.append(b);
  }}
  for(const b of document.querySelectorAll('#seqIdeas [data-part]'))b.setAttribute('aria-pressed',!!IDEAS.parts[b.dataset.part]);
  $('#seqIdeasTempoText').textContent=`Use ${IDEA_GENRES[IDEAS.genre].name}’s tempo (${IDEA_GENRES[IDEAS.genre].bpm} BPM)`;
  $('#seqIdeasAgain').disabled=!IDEAS.last;
}
function openIdeas(){if(!$('#seqFx').hidden)$('#seqFx').hidden=true;ideasDraw();$('#seqIdeas').hidden=false;$('#seqIdeasGenres [aria-checked=true]')?.focus()}
function ideasGenerate(again){
  const m=state.music;if(!m)return;
  if(!Object.values(IDEAS.parts).some(Boolean)){status('Pick at least one part to make.');return}
  if($('#seqIdeasTempo').checked&&m.bpm!==IDEA_GENRES[IDEAS.genre].bpm)seqEdit(()=>{m.bpm=IDEA_GENRES[IDEAS.genre].bpm});
  // RULE: a meter picked here becomes the song's (undoable), so the sequencer's bar lines match the idea.
  const pick=+$('#seqIdeasMeter').value,gm=IDEA_GENRES[IDEAS.genre].meter,mt=pick===1?['',...(gm||[4,4])]:IDEA_METERS[pick];
  if(mt&&mt[1])seqEdit(()=>{m.beats=mt[1];m.unit=mt[2];if(mt[3])m.groups=[...mt[3]];else delete m.groups});
  const r=songIdeas(m,{genre:IDEAS.genre,parts:IDEAS.parts,key:$('#seqIdeasKey').value,second:+$('#seqIdeasSecond').value,cycle:+$('#seqIdeasCycle').value,seed:Math.floor(Math.random()*2**32)});
  seqEdit(()=>{
    const drop=new Set(again&&IDEAS.last||[]);
    m.tracks=m.tracks.filter(t=>!drop.has(t)&&(t.notes.length||t.smp));
    const add=r.tracks.slice(0,16-m.tracks.length).map(t=>({...seqTrack(t.drums),...t,mute:false}));
    m.tracks.push(...add);IDEAS.last=add;
  });
  seq.sel=Math.max(0,m.tracks.length-1);seqControls();seqTracks();seqLayout();seqDraw();ideasDraw();
  const s=r.summary;$('#seqIdeasSays').textContent=`${s.genre} in ${s.key}${s.melodyKey?`, melody in ${s.melodyKey}`:''}: ${s.prog}, ${s.meter}${s.cycle?`, melody in ${s.cycle}-beat cycles`:''}, ${s.bars} bar${s.bars===1?'':'s'} at ${s.bpm} BPM.`;
  status(`✨ ${s.genre} idea in ${s.key}. Another tries a new one; Undo takes it back.`);
  if(!seqP.on)seqPlay();
}
$('#seqIdeasBtn').onclick=()=>{audio();sfx('click');if($('#seqIdeas').hidden)openIdeas();else $('#seqIdeas').hidden=true};
$('#seqIdeasClose').onclick=()=>{$('#seqIdeas').hidden=true};
$('#seqIdeasGo').onclick=()=>{audio();ideasGenerate(false)};
$('#seqIdeasAgain').onclick=()=>{audio();ideasGenerate(true)};
for(const b of document.querySelectorAll('#seqIdeas [data-part]'))b.onclick=()=>{audio();sfx('click');IDEAS.parts[b.dataset.part]=!IDEAS.parts[b.dataset.part];ideasDraw()};
$('#seqIdeasTempo').onchange=()=>ideasDraw();
{const k=$('#seqIdeasKey');NOTE_NAMES.forEach((n,i)=>k.append(mkEl('option',{value:String(i),textContent:n})));
  const mt=$('#seqIdeasMeter');IDEA_METERS.forEach(([l],i)=>mt.append(mkEl('option',{value:String(i),textContent:l})))}
// RULE: the styles are a radio group: one tab stop, arrows move and pick.
// RULE: Esc backs out one layer: an open Ideas panel closes first, wherever the focus is.
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#seqIdeas').hidden&&!e.target.closest?.('input,textarea,select')){e.preventDefault();e.stopImmediatePropagation();$('#seqIdeas').hidden=true;if(!$('#seqModal').hidden)$('#seqIdeasBtn').focus()}},true);
$('#seqIdeas').addEventListener('keydown',e=>{
  const cards=[...$('#seqIdeasGenres').querySelectorAll('.idgenre')],i=cards.indexOf(document.activeElement);if(i<0)return;
  const d={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key];if(!d)return;e.preventDefault();e.stopPropagation();cards[(i+d+cards.length)%cards.length].click();$('#seqIdeasGenres [aria-checked=true]')?.focus()});

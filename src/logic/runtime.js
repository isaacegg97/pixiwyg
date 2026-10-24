// SECTION: logic and animation
// FORMAT: two graph kinds share one editor. Logic (per page): events run exec chains of actions that read data
//   nodes. Animation (per element): a trigger runs a transition between state A (as-is) and state B (modified).
const ELF=['el','Element','element',''];
const NT={
  click:{t:'On click',cat:'Events',f:[ELF],outs:[['fire','then','exec']]},
  change:{t:'On change',cat:'Events',f:[['el','Field','element','']],outs:[['fire','then','exec'],['value','value','data']]},
  start:{t:'On start',cat:'Events',outs:[['fire','then','exec']]},
  pageOpen:{t:'On page open',cat:'Events',outs:[['fire','then','exec']]},
  every:{t:'Every',cat:'Events',f:[['ms','Milliseconds','number',1000]],outs:[['fire','then','exec']]},
  number:{t:'Number',cat:'Values',f:[['value','','number',0]],outs:[['out','number','data']]},
  text:{t:'Text',cat:'Values',f:[['value','','text','']],outs:[['out','text','data']]},
  elText:{t:'Text of',cat:'Values',f:[ELF],outs:[['out','text','data']]},
  getVar:{t:'Variable',cat:'Values',f:[['name','Name','text','x']],outs:[['out','value','data']]},
  curPage:{t:'Current page',cat:'Values',outs:[['out','page name','data']]},
  random:{t:'Random number',cat:'Values',f:[['min','From','number',1],['max','To','number',6]],outs:[['out','number','data']]},
  math:{t:'Math',cat:'Math and text',f:[['op','','select','+','+ − × ÷ % min max']],ins:[['a','a','data','number'],['b','b','data','number']],outs:[['out','result','data']]},
  calc:{t:'Calculate',cat:'Math and text',ins:[['expr','sum','data','text']],outs:[['out','result','data']]},
  join:{t:'Join text',cat:'Math and text',ins:[['a','a','data','text'],['b','b','data','text']],outs:[['out','text','data']]},
  compare:{t:'Compare',cat:'Math and text',f:[['op','','select','=','= ≠ < > ≤ ≥']],ins:[['a','a','data','text'],['b','b','data','text']],outs:[['out','yes or no','data']]},
  setText:{t:'Set text',cat:'Actions',f:[ELF],ins:[['in','','exec'],['value','to','data','text']],outs:[['next','then','exec']]},
  addText:{t:'Add text',cat:'Actions',f:[ELF],ins:[['in','','exec'],['value','add','data','text']],outs:[['next','then','exec']]},
  setVar:{t:'Set variable',cat:'Actions',f:[['name','Name','text','x']],ins:[['in','','exec'],['value','to','data','text']],outs:[['next','then','exec']]},
  branch:{t:'If',cat:'Actions',ins:[['in','','exec'],['cond','is true','data','text']],outs:[['yes','yes','exec'],['no','no','exec']]},
  wait:{t:'Wait',cat:'Actions',f:[['ms','Milliseconds','number',500]],ins:[['in','','exec']],outs:[['next','then','exec']]},
  animate:{t:'Play animation',cat:'Actions',f:[ELF,['dir','','select','forward','forward back toggle']],ins:[['in','','exec']],outs:[['next','then','exec']]},
  show:{t:'Show or hide',cat:'Actions',f:[ELF,['mode','','select','toggle','show hide toggle']],ins:[['in','','exec']],outs:[['next','then','exec']]},
  cls:{t:'Add or remove class',cat:'Actions',f:[ELF,['mode','','select','toggle','add remove toggle'],['name','Class','text','']],ins:[['in','','exec']],outs:[['next','then','exec']]},
  goPage:{t:'Go to page',cat:'Actions',f:[['to','','select','page','page next previous back first'],['page','Page','page','']],ins:[['in','','exec']],outs:[['next','then','exec']]},
  song:{t:'Play a song',cat:'Actions',f:[['what','','select','play','play stop toggle'],['song','Song','song',''],['el','Show the player at','element','']],ins:[['in','','exec']],outs:[['next','then','exec']]},
  trigger:{t:'Trigger',cat:'Animation',anim:true,f:[['on','Starts on','select','hover','hover click load inview logic']],outs:[['fire','start','exec']]},
  transition:{t:'Transition',cat:'Animation',anim:true,f:[['dur','Duration (ms)','number',400],['delay','Delay (ms)','number',0],['ease','Easing','select','ease','ease ease-in ease-out ease-in-out linear bounce custom'],['curve','Curve','curve','.25,.1,.25,1'],['repeat','Repeat','select','once','once twice forever'],['alt','Back and forth','check',false]],ins:[['in','','exec'],['from','from','state'],['to','to','state'],['via','via','key']]},
  key:{t:'Keyframe',cat:'Animation',anim:true,f:[['at','At (% of the way)','number',50],['x','Move right (px)','number',0],['y','Move down (px)','number',0],['rot','Turn (°)','number',0],['scale','Scale (%)','number',100],['op','Opacity (%)','number',100]],outs:[['out','keyframe','key']]},
  stateA:{t:'State A · as it is',cat:'Animation',anim:true,outs:[['out','state','state']]},
  stateB:{t:'State B',cat:'Animation',anim:true,f:[['x','Move right (px)','number',0],['y','Move down (px)','number',0],['rot','Turn (°)','number',0],['scale','Scale (%)','number',100],['op','Opacity (%)','number',100],['fg','Text color','color',''],['bg','Background','color','']],outs:[['out','state','state']]},
};
const TRIGGER_NAMES={hover:'on hover',click:'on click',load:'on load',inview:'when scrolled into view',logic:'from page logic'};
const emptyGraph=()=>({nodes:[],wires:[]});

// SECTION: runtime
// INVARIANT: self-contained (no outside names); exports carry its source via toString. env supplies elements and animations.
function pxRuntime(G,anims,env){
  // RULE: variables are the site's, not one page's: every page's logic shares one store when the host gives it.
  const vars=env.vars||{},timers=[],offs=[],byId=new Map(G.nodes.map(n=>[n.id,n]));
  const wireIn=(n,p)=>G.wires.find(w=>w.b===n.id&&w.bp===p);
  const wiresOut=(n,p)=>G.wires.filter(w=>w.a===n.id&&w.ap===p);
  const isField=t=>t&&/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);
  const textOf=ref=>{const e=env.el(ref);if(!e||!e.target)return'';return isField(e.target)?e.target.value:e.target.textContent};
  // SAFETY: arithmetic only (numbers, + - * / % and brackets); anything else is an error, never eval.
  function calc(src){
    const s=String(src).replace(/[×x]/g,'*').replace(/÷/g,'/').replace(/−/g,'-').replace(/,/g,'.');const tk=s.match(/\d*\.?\d+(?:e[+-]?\d+)?|[-+*/%()]/gi);
    if(!tk||tk.join('')!==s.replace(/\s+/g,''))return'Error';let i=0;
    const num=()=>{const t=tk[i++];if(t==='-')return-num();if(t==='+')return num();if(t==='('){const v=sum();if(tk[i++]!==')')throw 0;return v}const v=parseFloat(t);if(isNaN(v))throw 0;return v};
    const prod=()=>{let v=num();while(i<tk.length&&/[*/%]/.test(tk[i])){const o=tk[i++],r=num();v=o==='*'?v*r:o==='/'?v/r:v%r}return v};
    const sum=()=>{let v=prod();while(i<tk.length&&/[-+]/.test(tk[i])){const o=tk[i++],r=prod();v=o==='+'?v+r:v-r}return v};
    try{const v=sum();if(i!==tk.length||!isFinite(v))return'Error';return String(+v.toPrecision(12))}catch(e){return'Error'}
  }
  const truthy=v=>!(v===false||v===''||v==null||v===0||v==='0'||v==='false'||v==='no');
  function value(n,p){const w=wireIn(n,p);if(w){const s=byId.get(w.a);return s?data(s,w.ap):''}return n.f[p]??''}
  function data(n,p){
    const f=n.f;
    switch(n.type){
      case 'number':return+f.value||0;
      case 'text':return String(f.value??'');
      case 'elText':return textOf(f.el);
      case 'getVar':return vars[f.name]??'';
      case 'curPage':return env.pageName?env.pageName():'';
      case 'random':{const a=Math.ceil(Math.min(+f.min||0,+f.max||0)),b=Math.floor(Math.max(+f.min||0,+f.max||0));return a+Math.floor(Math.random()*(b-a+1))}
      case 'change':return n.last??textOf(f.el);
      case 'calc':return calc(value(n,'expr'));
      case 'join':return String(value(n,'a'))+String(value(n,'b'));
      case 'math':{const a=+value(n,'a')||0,b=+value(n,'b')||0;return({'+':a+b,'−':a-b,'×':a*b,'÷':b?a/b:NaN,'%':b?a%b:NaN,min:Math.min(a,b),max:Math.max(a,b)})[f.op]}
      case 'compare':{const a=value(n,'a'),b=value(n,'b'),na=+a,nb=+b,num=a!==''&&b!==''&&!isNaN(na)&&!isNaN(nb),x=num?na:String(a),y=num?nb:String(b);
        return({'=':x===y,'≠':x!==y,'<':x<y,'>':x>y,'≤':x<=y,'≥':x>=y})[f.op]}
    }
    return'';
  }
  let steps=0;
  function fire(n,p){for(const w of wiresOut(n,p)){const t=byId.get(w.b);if(t)run(t)}}
  function run(n){
    if(++steps>5000)return;   // SAFETY: runaway chains stop at 5000 steps instead of freezing the page.
    const f=n.f,e=f.el!=null?env.el(f.el):null;
    switch(n.type){
      case 'setText':case 'addText':{if(!e||!e.target)break;const v=String(value(n,'value')),t=e.target;
        if(isField(t))t.value=n.type==='addText'?t.value+v:v;else t.textContent=n.type==='addText'?t.textContent+v:v;break}
      case 'setVar':vars[f.name]=value(n,'value');break;
      case 'branch':fire(n,truthy(value(n,'cond'))?'yes':'no');return;
      case 'wait':timers.push(setTimeout(()=>{steps=0;fire(n,'next')},Math.max(0,+f.ms||0)));return;
      case 'animate':env.animate(f.el,f.dir);break;
      case 'song':if(env.music)env.music(f.what,e,f.song);break;
      // RULE: routing leaves this page, so nothing after it runs here; the next page's logic takes over.
      case 'goPage':if(env.go){env.go(f.to==='page'?f.page:f.to);return}break;
      // SAFETY: only a plain class name reaches classList; anything else is ignored.
      case 'cls':{const c=String(f.name||'').trim();if(e&&e.target&&/^[\w-]+$/.test(c))e.target.classList[f.mode==='add'?'add':f.mode==='remove'?'remove':'toggle'](c);break}
      case 'show':if(e&&e.host){const h=e.host,hide=f.mode==='hide'||(f.mode==='toggle'&&h.style.visibility!=='hidden');h.style.visibility=hide?'hidden':''}break;
    }
    fire(n,'next');
  }
  const start=n=>{steps=0;fire(n,'fire')};
  for(const n of G.nodes){
    const e=n.f.el!=null?env.el(n.f.el):null;
    if(n.type==='click'&&e&&e.host){const h=()=>start(n);e.host.addEventListener('click',h);offs.push(()=>e.host.removeEventListener('click',h))}
    if(n.type==='change'&&e&&e.target){const h=()=>{n.last=textOf(n.f.el);start(n)};for(const ev of ['input','change'])e.target.addEventListener(ev,h);offs.push(()=>{for(const ev of ['input','change'])e.target.removeEventListener(ev,h)})}
    if(n.type==='every')timers.push(setInterval(()=>start(n),Math.max(50,+n.f.ms||1000)));
  }
  // PERF: each animation is built once, paused at its from-state, and played forwards or backwards.
  const played=new Map();
  const ease=(e,c)=>e==='bounce'?'cubic-bezier(.34,1.56,.64,1)':e==='custom'&&c?`cubic-bezier(${c})`:e||'ease';
  const frame=s=>({transform:`translate(${s.x||0}px,${s.y||0}px) rotate(${s.rot||0}deg) scale(${(s.scale??100)/100})`,opacity:(s.op??100)/100});
  function build(ref,spec){
    const e=env.el(ref);if(!e||!e.host)return null;
    // RULE: a scaled element rotates and scales about the center of what shows, not its layout box.
    const box=e.host.shadowRoot&&e.host.shadowRoot.querySelector('.__html');
    if(box&&box.style.transform){const hr=e.host.getBoundingClientRect(),br=box.getBoundingClientRect(),k=hr.width/(e.host.offsetWidth||1)||1;
      e.host.style.transformOrigin=((br.left-hr.left+br.width/2)/k)+'px '+((br.top-hr.top+br.height/2)/k)+'px'}
    const A={},B=spec.b,[from,to]=spec.from==='B'?[B,A]:[A,B];
    const opt={duration:Math.max(0,spec.dur),delay:Math.max(0,spec.delay),easing:ease(spec.ease,spec.curve),iterations:spec.repeat==='forever'?Infinity:spec.repeat==='twice'?2:1,direction:spec.alt?'alternate':'normal',fill:'both'};
    const ks=(spec.keys||[]).map(k=>({...frame(k),offset:(spec.from==='B'?100-k.at:k.at)/100})).sort((a,b)=>a.offset-b.offset);
    const list=[e.host.animate([frame(from),...ks,frame(to)],opt)];
    if(e.target&&(B.fg||B.bg)){const cs=getComputedStyle(e.target),a={color:cs.color,backgroundColor:cs.backgroundColor},b={color:B.fg||cs.color,backgroundColor:B.bg||cs.backgroundColor};
      list.push(e.target.animate(spec.from==='B'?[b,a]:[a,b],opt))}
    for(const x of list)x.pause();
    return{list,fwd:false};
  }
  function play(ref,dir){
    const a=played.get(ref);if(!a)return;
    const fwd=dir==='back'?false:dir==='toggle'?!a.fwd:true;a.fwd=fwd;
    for(const x of a.list){x.playbackRate=fwd?1:-1;x.play()}
  }
  const IO=env.IO||(typeof IntersectionObserver!=='undefined'?IntersectionObserver:null),io=IO?new IO(es=>{for(const en of es)if(en.isIntersecting){play(en.target.__pxRef,'forward');io.unobserve(en.target)}}):null;
  for(const {ref,spec} of anims){
    const a=build(ref,spec);if(!a)continue;played.set(ref,a);const h=env.el(ref).host;
    if(spec.trigger==='hover'){const on=()=>play(ref,'forward'),off=()=>play(ref,'back');h.addEventListener('pointerenter',on);h.addEventListener('pointerleave',off);offs.push(()=>{h.removeEventListener('pointerenter',on);h.removeEventListener('pointerleave',off)})}
    else if(spec.trigger==='click'){const t=()=>play(ref,'toggle');h.addEventListener('click',t);offs.push(()=>h.removeEventListener('click',t))}
    else if(spec.trigger==='load')play(ref,'forward');
    else if(spec.trigger==='inview'&&io){h.__pxRef=ref;io.observe(h)}
  }
  env.animate=(ref,dir)=>play(ref,dir);
  // RULE: On start runs once per visit of the site (a page seen before doesn't start again); On page open, each time.
  if(!env.noStart)for(const n of G.nodes)if(n.type==='start')start(n);
  for(const n of G.nodes)if(n.type==='pageOpen')start(n);
  return{stop(){for(const o of offs)o();for(const t of timers){clearTimeout(t);clearInterval(t)}if(io)io.disconnect();for(const a of played.values())for(const x of a.list)x.cancel()}};
}

function animSpec(g){
  if(!g||!g.nodes)return null;
  const N=t=>g.nodes.find(n=>n.type===t),tr=N('transition'),b=N('stateB'),trig=N('trigger');if(!tr||!b)return null;
  const into=p=>{const w=g.wires.find(w=>w.b===tr.id&&w.bp===p);return w&&g.nodes.find(n=>n.id===w.a)};
  const fromN=into('from'),started=trig&&g.wires.some(w=>w.a===trig.id&&w.b===tr.id);
  // INVARIANT: keys are sorted by at, clamped to (0,100); a reversed animation (from B) mirrors them to 100-at.
  const keys=g.wires.filter(w=>w.b===tr.id&&w.bp==='via').map(w=>g.nodes.find(n=>n.id===w.a)).filter(n=>n&&n.type==='key')
    .map(n=>({at:Math.min(99.9,Math.max(.1,+n.f.at||0)),x:+n.f.x||0,y:+n.f.y||0,rot:+n.f.rot||0,scale:n.f.scale===''?100:+n.f.scale,op:n.f.op===''?100:+n.f.op})).sort((a,b)=>a.at-b.at);
  return{trigger:started?trig.f.on:'logic',dur:+tr.f.dur||0,delay:+tr.f.delay||0,ease:tr.f.ease,curve:tr.f.curve,keys,repeat:tr.f.repeat,alt:!!tr.f.alt,from:fromN&&fromN.type==='stateB'?'B':'A',
    b:{x:+b.f.x||0,y:+b.f.y||0,rot:+b.f.rot||0,scale:b.f.scale===''?100:+b.f.scale,op:b.f.op===''?100:+b.f.op,fg:b.f.fg||'',bg:b.f.bg||''}};
}
function defaultAnimGraph(){
  const g={nodes:[{id:'n1',type:'trigger',x:30,y:40},{id:'n2',type:'stateA',x:30,y:200},{id:'n3',type:'stateB',x:30,y:310},{id:'n4',type:'transition',x:330,y:120}],
    wires:[{a:'n1',ap:'fire',b:'n4',bp:'in'},{a:'n2',ap:'out',b:'n4',bp:'from'},{a:'n3',ap:'out',b:'n4',bp:'to'}]};
  for(const n of g.nodes)n.f=nodeDefaults(n.type);g.nodes.find(n=>n.type==='stateB').f.scale=110;return g;
}
function nodeDefaults(type){const d=NT[type],f={};for(const [k,,kind,def] of d.f||[])f[k]=def;for(const [k,,,ft] of d.ins||[])if(ft)f[k]=ft==='number'?0:'';return f}

// SECTION: graph sanitizing
// FORMAT: curve = cubic-bezier control points "x1,y1,x2,y2"; x in [0,1] as CSS requires, y in [-2,3].
const cleanCurve=v=>{const p=String(v??'').split(',').map(Number);if(p.length!==4||p.some(x=>!Number.isFinite(x)))return null;
  const r=x=>Math.round(x*1000)/1000;return[r(Math.min(1,Math.max(0,p[0]))),r(Math.min(3,Math.max(-2,p[1]))),r(Math.min(1,Math.max(0,p[2]))),r(Math.min(3,Math.max(-2,p[3])))].join(',')};
// SAFETY: graphs from project files and primitives are rebuilt from known node types and fields only.
function cleanField(kind,v,def,opts,ref,songRef=x=>x,pageRef=x=>x){
  if(kind==='code')return String(v??def).slice(0,4000);
  if(kind==='song'){if(v===''||v==null)return'';const r=songRef(v);return r==null?'':r}
  if(kind==='page'){if(v===''||v==null)return'';const r=pageRef(v);return r==null?'':r}
  if(kind==='number')return numIn(v,def,-1e9,1e9);
  if(kind==='text')return String(v??def).slice(0,500);
  if(kind==='check')return!!v;
  if(kind==='color')return okHex(v)?v:'';
  if(kind==='select'){const o=opts.split(' ');return o.includes(v)?v:def}
  if(kind==='curve')return cleanCurve(v)??def;
  if(kind==='element'){const r=ref(v);return r==null?'':r}
  return def;
}
function cleanGraph(g,{anim=false,style=false,ref=v=>v,songRef=v=>v,pageRef=v=>v}={}){
  const want=anim?'anim':style?'style':'logic',kindOf=d=>d.anim?'anim':d.style?'style':'logic';
  const nodes=[],ids=new Set();
  for(const n of (g&&Array.isArray(g.nodes)?g.nodes:[]).slice(0,600)){
    const d=n&&NT[n.type];if(!d||kindOf(d)!==want)continue;
    const id=String(n.id??'').replace(/[^\w-]/g,'').slice(0,24);if(!id||ids.has(id))continue;ids.add(id);
    const src=n.f&&typeof n.f==='object'?n.f:{},f={};
    for(const [k,,kind,def,opts] of d.f||[])f[k]=cleanField(kind,src[k],def,opts||'',ref,songRef,pageRef);
    for(const [k,,,ft] of d.ins||[])if(ft)f[k]=cleanField(ft,src[k],ft==='number'?0:'','',ref);
    nodes.push({id,type:n.type,x:Math.round(numIn(n.x,0,-1e5,1e5)),y:Math.round(numIn(n.y,0,-1e5,1e5)),f});
  }
  const byId=new Map(nodes.map(n=>[n.id,n])),wires=[],taken=new Set();
  for(const w of (g&&Array.isArray(g.wires)?g.wires:[]).slice(0,2000)){
    const a=w&&byId.get(w.a),b=w&&byId.get(w.b);if(!a||!b)continue;
    const op=(NT[a.type].outs||[]).find(p=>p[0]===w.ap),ip=(NT[b.type].ins||[]).find(p=>p[0]===w.bp);
    if(!op||!ip||op[2]!==ip[2])continue;
    // INVARIANT: data/state inputs take one wire; exec and key inputs may have many.
    const key=b.id+'|'+ip[0];if(ip[2]!=='exec'&&ip[2]!=='key'&&taken.has(key))continue;taken.add(key);
    if(wires.some(x=>x.a===a.id&&x.ap===op[0]&&x.b===b.id&&x.bp===ip[0]))continue;
    wires.push({a:a.id,ap:op[0],b:b.id,bp:ip[0]});
  }
  return{nodes,wires};
}


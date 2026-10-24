// SECTION: node editor
const ned={g:null,mode:'logic',onChange:null,view:{x:40,y:40,z:1},sel:null,el:null,armed:true};
const elName=id=>{const el=state.els.find(e=>e.id===id);if(!el)return'(gone)';const t=(el.tag==='img'?(el.attrs&&el.attrs.alt)||'image':toText(el.content??(TAGS[el.tag]||{}).content??'')).replace(/\s+/g,' ').trim();return`<${el.tag}> ${t.slice(0,26)}${t.length>26?'…':''}`};
function nedChanged(){if(ned.armed){pushUndo();ned.armed=false}ned.onChange(ned.g);drawWires();if(ned.mode==='anim')nedPreview(false);nedValidate()}
function openNodeEditor({title,graph,mode,onChange,el}){
  Object.assign(ned,{g:graph,mode,onChange,el,sel:null,armed:true,view:{x:30,y:30,z:1}});
  hideCtxMenu();if(iso.id)exitIso();
  $('#nodeTitle').textContent=title;$('#nodeModal').hidden=false;$('#nodeModal').classList.add('docked');syncDock();
  $('#nodeModal').classList.toggle('anim',mode==='anim'||mode==='style');
  $('#nodePreview').hidden=mode!=='anim';$('#nodeExamples').hidden=mode!=='logic';$('#nodeStyleBar').hidden=mode!=='style';
  drawPalette();drawNodes();requestAnimationFrame(()=>{nedFit();if(mode==='anim')nedPreview(true)});
  $('#nodeView').focus();
}
function closeNodeEditor(){if($('#nodeModal').hidden)return;$('#nodeModal').hidden=true;syncDock();treeLater();$('#nodePrevBox').replaceChildren();renderInspector();if(document.body.dataset.ws==='animate')tlRender()}
function drawPalette(){
  const box=$('#nodePal');box.replaceChildren();box.hidden=false;
  if(ned.mode==='anim'){box.append(mkEl('h4',{textContent:'Animation'}));const b=mkEl('button',{type:'button',className:'btn',textContent:'+ Keyframe',title:'A stop on the way from one state to the other'});
    b.onclick=()=>{audio();sfx('pop');addKey()};box.append(b,mkEl('p',{className:'credit',textContent:'Keyframes wire into the Transition’s “via”. Each sets where the element is at a point on the way.'}));return}
  const style=ned.mode==='style',mine=d=>!d.anim&&!d.hidden&&!!d.style===style&&!(style&&d===NT.look);
  // RULE: logic opens with ideas read off the page, above the parts bin.
  if(ned.mode==='logic'){const ideas=suggestInteractions().slice(0,8);if(ideas.length){box.append(mkEl('h4',{textContent:'Ideas from this page'}));
    for(const it of ideas){const b=mkEl('button',{type:'button',className:'btn idea',textContent:it.title,title:it.why});b.onclick=()=>{audio();applyIdea(it);drawPalette()};box.append(b)}}}
  const cats=[...new Set(Object.values(NT).filter(mine).map(d=>d.cat))];
  for(const c of cats){box.append(mkEl('h4',{textContent:c}));
    for(const [type,d] of Object.entries(NT))if(d.cat===c&&mine(d)){const b=mkEl('button',{type:'button',className:'btn',textContent:d.t});b.onclick=()=>{audio();sfx('pop');addNode(type)};box.append(b)}}
  if(style)drawFxPalette(box);
}
function drawFxPalette(box){
  const fx=fxLibrary();box.append(mkEl('h4',{textContent:`From your stylesheets (${fx.length})`}));
  if(!fx.length){box.append(mkEl('p',{className:'credit',textContent:'Add a stylesheet and its shadows, gradients, filters, shapes and motion show up here.'}));return}
  const by=new Map();for(const x of fx){if(!by.has(x.kind))by.set(x.kind,[]);by.get(x.kind).push(x)}
  for(const [kind,list] of by){const d=mkEl('details');d.append(mkEl('summary',{textContent:`${kind} · ${list.length}`}));
    for(const x of list.slice(0,80)){const b=mkEl('button',{type:'button',className:'btn fxbtn',title:`${x.prop}: ${x.value}\n${x.from}`});b.append(fxSwatch(x),mkEl('span',{textContent:x.from}));
      b.onclick=()=>{audio();sfx('pop');const n=addNode('sFx');n.f.from=x.from;n.f.css=`${x.prop}:${x.value}`;n.f.kf=x.kf||'';drawNodes();nedChanged()};d.append(b)}
    box.append(d)}
}
function addKey(){
  const tr=ned.g.nodes.find(n=>n.type==='transition');if(!tr)return;const ks=ned.g.nodes.filter(n=>n.type==='key');
  const trH=$(`#nodeLayer .nnode[data-id="${tr.id}"]`)?.offsetHeight||420,n=addNode('key',{x:tr.x+ks.length*24,y:tr.y+trH+30+ks.length*24});n.f.at=ks.length?Math.min(95,Math.max(...ks.map(k=>+k.f.at||0))+(100-Math.max(...ks.map(k=>+k.f.at||0)))/2|0):50;
  ned.g.wires.push({a:n.id,ap:'out',b:tr.id,bp:'via'});drawNodes();nedFit();nedChanged();return n;
}
function addNode(type,at){
  const v=$('#nodeView').getBoundingClientRect(),z=ned.view.z,n={id:'n'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),type,
    x:Math.round(at?at.x:(v.width/2-ned.view.x)/z-90),y:Math.round(at?at.y:(v.height/2-ned.view.y)/z-40),f:nodeDefaults(type)};
  if(ned.el&&'el' in n.f)n.f.el=ned.el;
  ned.g.nodes.push(n);ned.sel=n.id;drawNodes();nedChanged();return n;
}
// RULE: drag either handle; the text field takes exact numbers. y may overshoot (bounce) within [-2,3].
function curveField(n,k){
  const w=mkEl('span',{className:'ncurve'}),c=mkEl('canvas',{width:132,height:96}),t=mkEl('input',{type:'text',value:n.f[k]||'.25,.1,.25,1',spellcheck:false});
  t.setAttribute('aria-label','Curve: cubic-bezier x1,y1,x2,y2');c.setAttribute('aria-hidden','true');
  const X=x=>14+x*104,Y=y=>78-y*60,ix=px=>(px-14)/104,iy=py=>(78-py)/60;
  const pts=()=>(cleanCurve(n.f[k])||'.25,.1,.25,1').split(',').map(Number);
  const draw=()=>{const x=c.getContext('2d'),[a,b,d,e]=pts(),ink=getComputedStyle(c).color||'#000';x.clearRect(0,0,c.width,c.height);
    x.globalAlpha=.25;x.strokeStyle=ink;x.strokeRect(X(0),Y(1),104,60);x.globalAlpha=1;
    x.beginPath();x.moveTo(X(0),Y(0));x.lineTo(X(a),Y(b));x.moveTo(X(1),Y(1));x.lineTo(X(d),Y(e));x.globalAlpha=.5;x.stroke();x.globalAlpha=1;
    x.lineWidth=2;x.beginPath();x.moveTo(X(0),Y(0));x.bezierCurveTo(X(a),Y(b),X(d),Y(e),X(1),Y(1));x.stroke();x.lineWidth=1;
    x.fillStyle='#ff2e88';for(const [p,q] of [[a,b],[d,e]]){x.beginPath();x.arc(X(p),Y(q),5,0,7);x.fill()}};
  let hold=-1;
  c.addEventListener('pointerdown',ev=>{ev.stopPropagation();const r=c.getBoundingClientRect(),px=(ev.clientX-r.left)*c.width/r.width,py=(ev.clientY-r.top)*c.height/r.height,[a,b,d,e]=pts();
    hold=Math.hypot(px-X(a),py-Y(b))<=Math.hypot(px-X(d),py-Y(e))?0:1;c.setPointerCapture(ev.pointerId)});
  c.addEventListener('pointermove',ev=>{if(hold<0)return;const r=c.getBoundingClientRect(),p=pts(),px=(ev.clientX-r.left)*c.width/r.width,py=(ev.clientY-r.top)*c.height/r.height;
    p[hold*2]=ix(px);p[hold*2+1]=iy(py);n.f[k]=cleanCurve(p.join(','));t.value=n.f[k];
    const tr=n;if(tr.f.ease!=='custom'){tr.f.ease='custom';const sel=w.closest('.nnode')?.querySelector('select');if(sel&&[...sel.options].some(o=>o.value==='custom'))sel.value='custom'}draw();nedChanged()});
  const up=()=>{hold=-1};c.addEventListener('pointerup',up);c.addEventListener('pointercancel',up);
  t.addEventListener('change',()=>{const v=cleanCurve(t.value);if(v){n.f[k]=v;if(n.f.ease!=='custom'){n.f.ease='custom';const sel=w.closest('.nnode')?.querySelector('select');if(sel)sel.value='custom'}}t.value=n.f[k];draw();nedChanged()});
  w.append(c,t);requestAnimationFrame(draw);return w;
}
function portKind(n,dir,k){const p=(NT[n.type][dir]||[]).find(p=>p[0]===k);return p&&p[2]}
function drawNodes(){
  const layer=$('#nodeLayer');layer.querySelectorAll('.nnode').forEach(x=>x.remove());
  for(const n of ned.g.nodes){
    const d=NT[n.type],box=mkEl('div',{className:'nnode k-'+d.cat.replace(/\W+/g,'').toLowerCase()+(ned.sel===n.id?' on':'')});box.dataset.id=n.id;
    box.style.left=n.x+'px';box.style.top=n.y+'px';
    const head=mkEl('div',{className:'nhead'});head.append(mkEl('b',{textContent:d.t}));
    if((ned.mode!=='anim'||n.type==='key')&&n.type!=='look'){const x=mkEl('button',{type:'button',className:'nx',textContent:'×',title:'Remove this node'});x.setAttribute('aria-label','Remove node');x.onclick=e=>{e.stopPropagation();removeNode(n.id)};head.append(x)}
    box.append(head);
    const field=(kind,k,def,opts,label)=>{
      let inp;
      if(kind==='select'){inp=mkEl('select');for(const o of opts.split(' '))inp.append(mkEl('option',{value:o,textContent:o}))}
      else if(kind==='song'){inp=mkEl('select');inp.append(mkEl('option',{value:'',textContent:'The first song'}));for(const s of state.songs)inp.append(mkEl('option',{value:s.id,textContent:s.name}));
        if(n.f[k]&&!songById(n.f[k]))inp.append(mkEl('option',{value:n.f[k],textContent:'(song was removed)'}))}
      else if(kind==='page'){inp=mkEl('select');inp.append(mkEl('option',{value:'',textContent:'Choose a page…'}));for(const {p} of siteTree())inp.append(mkEl('option',{value:p.id,textContent:p.name}));
        if(n.f[k]&&!sitePage(n.f[k]))inp.append(mkEl('option',{value:n.f[k],textContent:'(page was removed)'}))}
      else if(kind==='element'){inp=mkEl('select');inp.append(mkEl('option',{value:'',textContent:'Choose an element…'}));
        for(const e of [...state.els].sort((a,b)=>a.y-b.y||a.x-b.x))inp.append(mkEl('option',{value:e.id,textContent:elName(e.id)}));
        if(n.f[k]&&!state.els.some(e=>e.id===n.f[k]))inp.append(mkEl('option',{value:n.f[k],textContent:'(element was removed)'}))}
      else if(kind==='check'){inp=mkEl('input',{type:'checkbox',checked:!!n.f[k]})}
      else if(kind==='color'){const w=mkEl('span',{className:'ncolor'}),c=mkEl('input',{type:'color',value:n.f[k]||'#ff2e88'}),clr=mkEl('button',{type:'button',className:'nx',textContent:n.f[k]?'×':'—',title:'No change'});
        c.oninput=()=>{n.f[k]=c.value;clr.textContent='×';w.classList.add('set');nedChanged()};clr.onclick=()=>{n.f[k]='';clr.textContent='—';w.classList.remove('set');nedChanged()};
        w.classList.toggle('set',!!n.f[k]);w.append(c,clr);return w}
      else if(kind==='curve')return curveField(n,k);
      else if(kind==='code'){inp=mkEl('textarea',{spellcheck:false})}
      else inp=mkEl('input',{type:kind==='number'?'number':'text'});
      if(kind!=='check')inp.value=n.f[k]??def;
      inp.setAttribute('aria-label',label||k);
      inp.addEventListener(kind==='check'||kind==='select'||kind==='element'?'change':'input',()=>{n.f[k]=kind==='check'?inp.checked:kind==='number'?(inp.value===''?'':+inp.value):inp.value;if(kind==='element')highlightEl(n.f[k]);nedChanged()});
      if(kind==='element')inp.addEventListener('focus',()=>highlightEl(n.f[k]));
      return inp;
    };
    for(const [k,label,kind,def,opts] of d.f||[]){const r=mkEl('label',{className:'nrow nf'});if(label)r.append(mkEl('span',{textContent:label}));r.append(field(kind,k,def,opts||'',label));box.append(r)}
    const rows=Math.max((d.ins||[]).length,(d.outs||[]).length);
    for(let i=0;i<rows;i++){
      const r=mkEl('div',{className:'nrow'}),ip=(d.ins||[])[i],op=(d.outs||[])[i],L=mkEl('span',{className:'nin'}),R=mkEl('span',{className:'nout'});
      if(ip){const dot=mkEl('i',{className:'port '+ip[2]});dot.dataset.n=n.id;dot.dataset.p=ip[0];dot.dataset.dir='ins';dot.title=ip[2]==='exec'?'when':ip[1];L.append(dot);
        if(ip[1])L.append(mkEl('span',{textContent:ip[1]}));
        const wired=ned.g.wires.some(w=>w.b===n.id&&w.bp===ip[0]);if(ip[3]&&!wired)L.append(field(ip[3],ip[0],'','',ip[1]))}
      if(op){if(op[1])R.append(mkEl('span',{textContent:op[1]}));const dot=mkEl('i',{className:'port '+op[2]});dot.dataset.n=n.id;dot.dataset.p=op[0];dot.dataset.dir='outs';R.append(dot)}
      r.append(L,R);box.append(r);
    }
    layer.append(box);
  }
  applyView();drawWires();nedValidate();
}
function removeNode(id){ned.g.nodes=ned.g.nodes.filter(n=>n.id!==id);ned.g.wires=ned.g.wires.filter(w=>w.a!==id&&w.b!==id);if(ned.sel===id)ned.sel=null;drawNodes();nedChanged()}
function applyView(){const v=ned.view;$('#nodeLayer').style.transform=`translate(${v.x}px,${v.y}px) scale(${v.z})`}
function portXY(n,p,dir){
  const dot=$('#nodeLayer').querySelector(`.port[data-n="${n}"][data-p="${p}"][data-dir="${dir}"]`);if(!dot)return null;
  const r=dot.getBoundingClientRect(),L=$('#nodeLayer').getBoundingClientRect(),z=ned.view.z;
  return{x:(r.left+r.width/2-L.left)/z,y:(r.top+r.height/2-L.top)/z};
}
const curve=(a,b)=>{const dx=Math.max(40,Math.abs(b.x-a.x)/2);return`M${a.x},${a.y} C${a.x+dx},${a.y} ${b.x-dx},${b.y} ${b.x},${b.y}`};
function drawWires(){
  const svg=$('#nodeWires');svg.replaceChildren();
  for(const w of ned.g.wires){const a=portXY(w.a,w.ap,'outs'),b=portXY(w.b,w.bp,'ins');if(!a||!b)continue;
    const kind=portKind(ned.g.nodes.find(n=>n.id===w.a),'outs',w.ap);
    const p=document.createElementNS('http://www.w3.org/2000/svg','path');p.setAttribute('d',curve(a,b));p.setAttribute('class','wire '+kind);
    const hit=document.createElementNS('http://www.w3.org/2000/svg','path');hit.setAttribute('d',curve(a,b));hit.setAttribute('class','wirehit');
    const t=document.createElementNS('http://www.w3.org/2000/svg','title');t.textContent='Click to remove this wire';hit.append(t);
    hit.addEventListener('click',()=>{audio();sfx('whoosh');ned.g.wires=ned.g.wires.filter(x=>x!==w);drawNodes();nedChanged()});
    svg.append(p,hit);
  }
}
function highlightEl(id){const h=id&&hostOf(id);if(!h)return;h.animate([{outline:'3px solid #ff2e88',outlineOffset:'4px'},{outline:'3px solid transparent',outlineOffset:'4px'}],{duration:900})}
function nedFit(){
  const v=$('#nodeView').getBoundingClientRect(),ns=ned.g.nodes;if(!ns.length){ned.view={x:40,y:40,z:1};applyView();drawWires();return}
  const boxes=[...$('#nodeLayer').querySelectorAll('.nnode')].map(b=>({x:b.offsetLeft,y:b.offsetTop,w:b.offsetWidth,h:b.offsetHeight}));
  const x0=Math.min(...boxes.map(b=>b.x)),y0=Math.min(...boxes.map(b=>b.y)),x1=Math.max(...boxes.map(b=>b.x+b.w)),y1=Math.max(...boxes.map(b=>b.y+b.h));
  // RULE: zoom floor .6 keeps labels readable; a big graph opens at its top-left.
  const z=Math.max(.6,Math.min(1.2,(v.width-60)/(x1-x0),(v.height-60)/(y1-y0)));
  ned.view={z,x:Math.max(30,(v.width-(x1-x0)*z)/2)-x0*z,y:Math.max(30,(v.height-(y1-y0)*z)/2)-y0*z};applyView();drawWires();
}
$('#nodeView').addEventListener('pointerdown',e=>{
  if(e.button>0)return;const view=$('#nodeView'),port=e.target.closest('.port'),head=e.target.closest('.nhead'),node=e.target.closest('.nnode');
  if(e.target.closest('input,select,button,textarea'))return;
  // FIX: the pan branch captures the pointer, and a captured pointer's click goes to #nodeView, never the wire.
  if(e.target.classList.contains('wirehit'))return;
  const z=ned.view.z,start={x:e.clientX,y:e.clientY};
  if(port){
    e.preventDefault();view.setPointerCapture(e.pointerId);
    const from={n:port.dataset.n,p:port.dataset.p,dir:port.dataset.dir},a=portXY(from.n,from.p,from.dir),kind=port.classList.contains('exec')?'exec':port.classList.contains('state')?'state':'data';
    const tmp=document.createElementNS('http://www.w3.org/2000/svg','path');tmp.setAttribute('class','wire temp '+kind);$('#nodeWires').append(tmp);
    const L=$('#nodeLayer').getBoundingClientRect();
    const mv=ev=>{const b={x:(ev.clientX-L.left)/z,y:(ev.clientY-L.top)/z};tmp.setAttribute('d',from.dir==='outs'?curve(a,b):curve(b,a))};
    const up=ev=>{view.removeEventListener('pointermove',mv);view.removeEventListener('pointerup',up);tmp.remove();
      const t=document.elementFromPoint(ev.clientX,ev.clientY),to=t&&t.closest&&t.closest('.port');
      if(!to||to.dataset.dir===from.dir||to.dataset.n===from.n)return;
      const out=from.dir==='outs'?from:{n:to.dataset.n,p:to.dataset.p},inn=from.dir==='ins'?from:{n:to.dataset.n,p:to.dataset.p};
      const on=ned.g.nodes.find(n=>n.id===out.n),inode=ned.g.nodes.find(n=>n.id===inn.n),ok=portKind(on,'outs',out.p),ik=portKind(inode,'ins',inn.p);
      if(ok!==ik){status(`That connects a ${ok==='exec'?'"then"':ok} to a ${ik==='exec'?'"then"':ik}; they don't fit`);return}
      // INVARIANT: data/state inputs take one wire; a new one replaces the old.
      if(ik!=='exec'&&ik!=='key')ned.g.wires=ned.g.wires.filter(w=>!(w.b===inn.n&&w.bp===inn.p));
      if(!ned.g.wires.some(w=>w.a===out.n&&w.ap===out.p&&w.b===inn.n&&w.bp===inn.p))ned.g.wires.push({a:out.n,ap:out.p,b:inn.n,bp:inn.p});
      audio();sfx('click');drawNodes();nedChanged()};
    view.addEventListener('pointermove',mv);view.addEventListener('pointerup',up);return;
  }
  if(head&&node){
    e.preventDefault();view.setPointerCapture(e.pointerId);const n=ned.g.nodes.find(x=>x.id===node.dataset.id),x0=n.x,y0=n.y;ned.sel=n.id;
    view.querySelectorAll('.nnode.on').forEach(b=>b.classList.remove('on'));node.classList.add('on');let moved=false;
    const mv=ev=>{moved=true;n.x=Math.round(x0+(ev.clientX-start.x)/z);n.y=Math.round(y0+(ev.clientY-start.y)/z);node.style.left=n.x+'px';node.style.top=n.y+'px';drawWires()};
    const up=()=>{view.removeEventListener('pointermove',mv);view.removeEventListener('pointerup',up);if(moved)nedChanged()};
    view.addEventListener('pointermove',mv);view.addEventListener('pointerup',up);return;
  }
  if(node)return;
  e.preventDefault();view.setPointerCapture(e.pointerId);const vx=ned.view.x,vy=ned.view.y;
  const mv=ev=>{ned.view.x=vx+ev.clientX-start.x;ned.view.y=vy+ev.clientY-start.y;applyView()};
  const up=()=>{view.removeEventListener('pointermove',mv);view.removeEventListener('pointerup',up)};
  view.addEventListener('pointermove',mv);view.addEventListener('pointerup',up);
});
$('#nodeView').addEventListener('wheel',e=>{
  e.preventDefault();const v=$('#nodeView').getBoundingClientRect(),z0=ned.view.z,z=Math.max(.3,Math.min(2,z0*Math.exp(-e.deltaY*.0015)));
  const px=e.clientX-v.left,py=e.clientY-v.top;ned.view.x=px-(px-ned.view.x)*z/z0;ned.view.y=py-(py-ned.view.y)*z/z0;ned.view.z=z;applyView();drawWires();
},{passive:false});
$('#nodeView').addEventListener('keydown',e=>{if((e.key==='Delete'||e.key==='Backspace')&&ned.sel&&ned.mode!=='anim'&&!e.target.closest('input,select')){e.preventDefault();removeNode(ned.sel)}});
$('#nodeClose').onclick=$('#nodeDone').onclick=()=>{audio();closeNodeEditor()};
$('#nodeFit').onclick=()=>{audio();nedFit()};
$('#nodeModal').addEventListener('pointerdown',e=>{if(e.target.id==='nodeModal')closeNodeEditor()});


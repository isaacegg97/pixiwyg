// SECTION: interaction discovery
// RULE: the page is read for interactions it already suggests; each idea is one click that wires real nodes, which
//   then show (and can be changed) in Logic. An idea is not offered again once its trigger element has logic.
const lcText=el=>(el.tag==='input'||el.tag==='textarea'?'':toText(el.content??(TAGS[el.tag]||{}).content??'')).replace(/\s+/g,' ').trim();
const lcBox=el=>{const h=hostOf(el.id),b=h?layoutBox(el,h):{w:el.w||100,h:30};return{x:el.x,y:el.y,w:b.w,h:b.h}};
function lcDist(a,b){const A=lcBox(a),B=lcBox(b),dx=Math.max(0,Math.max(A.x,B.x)-Math.min(A.x+A.w,B.x+B.w)),dy=Math.max(0,Math.max(A.y,B.y)-Math.min(A.y+A.h,B.y+B.h));return Math.hypot(dx,dy)}
// RULE: "on" a box means mostly over it: close buttons often hang past a title bar's edge.
const lcInside=(a,b)=>{const A=lcBox(a),B=lcBox(b),ix=Math.max(0,Math.min(A.x+A.w,B.x+B.w)-Math.max(A.x,B.x)),iy=Math.max(0,Math.min(A.y+A.h,B.y+B.h)-Math.max(A.y,B.y));return ix*iy>=A.w*A.h*.5&&A.w*A.h<B.w*B.h};
const lcNearest=(el,pred,max=280)=>{let best=null,bd=max;for(const o of state.els)if(o!==el&&!o.md&&pred(o)){const d=lcDist(el,o);if(d<bd){bd=d;best=o}}return best};
const isTexty=o=>/^(p|span|h[1-6]|label|div|code|blockquote)$/.test(o.tag)&&!!lcText(o);
const isField=o=>o.tag==='input'&&!/checkbox|radio/i.test(o.attrs&&o.attrs.type||'')||o.tag==='textarea';
const lcName=el=>`<${el.tag}> “${(lcText(el)||el.tag).slice(0,24)}”`;
// FORMAT: an idea = {key, title, why, nodes:[[type, fields]], wires:[[from, port, to, port]]}, node refs by index.
function ideasFor(el){
  const t=lcText(el),out=[],btn=el.tag==='button'||(el.tag==='a'&&!!t),songs=state.songs.length;
  const used=new Set((state.logic.nodes||[]).filter(n=>n.type==='click'||n.type==='change').map(n=>n.f.el));if(used.has(el.id))return out;
  if(btn&&/^\s*(\+1?|＋|add|like|♥|❤️?|up|more)\s*$/i.test(t)){const num=lcNearest(el,o=>/^\s*-?\d+\s*$/.test(lcText(o)));
    if(num)out.push({key:'count',title:`Count up: ${lcName(el)} adds 1 to ${lcName(num)}`,why:'A + button next to a number',nodes:[['click',{el:el.id}],['setText',{el:num.id}],['math',{op:'+'}],['elText',{el:num.id}],['number',{value:1}]],wires:[[0,'fire',1,'in'],[3,'out',2,'a'],[4,'out',2,'b'],[2,'out',1,'value']]})}
  // RULE: a close button belongs to the smallest box it sits on, not the biggest thing underneath.
  if(btn&&/^\s*(×|✕|✖|x|close|dismiss|hide)\s*$/i.test(t)){const box=state.els.filter(o=>o!==el&&!o.md&&lcInside(el,o)).sort((a,b)=>{const A=lcBox(a),B=lcBox(b);return A.w*A.h-B.w*B.h})[0];
    if(box)out.push({key:'close',title:`Close: ${lcName(el)} hides ${lcName(box)}`,why:'A close button sitting on a box',nodes:[['click',{el:el.id}],['show',{el:box.id,mode:'hide'}]],wires:[[0,'fire',1,'in']]})}
  if(btn&&/(show|hide|more|menu|open|details|toggle|read|reveal)/i.test(t)){const below=lcNearest(el,o=>o.tag!=='button'&&o.y>el.y,320);
    if(below)out.push({key:'toggle',title:`Show and hide: ${lcName(el)} toggles ${lcName(below)}`,why:'A show/more button above something',nodes:[['click',{el:el.id}],['show',{el:below.id,mode:'toggle'}]],wires:[[0,'fire',1,'in']]})}
  if(btn&&songs&&/(play|listen|▶|♪|♫|music|song)/i.test(t))out.push({key:'song',title:`Play music: ${lcName(el)} plays “${state.songs[0].name}”`,why:'A play button, and the project has a song',
    nodes:[['click',{el:el.id}],['song',{what:'toggle',song:state.songs[0].id}]],wires:[[0,'fire',1,'in']]});
  if(btn&&/(roll|dice|random|shuffle|🎲)/i.test(t)){const tgt=lcNearest(el,o=>o!==el&&isTexty(o)&&o.tag!=='button');
    if(tgt)out.push({key:'dice',title:`Roll: ${lcName(el)} puts a number from 1 to 6 in ${lcName(tgt)}`,why:'A roll/random button',nodes:[['click',{el:el.id}],['setText',{el:tgt.id}],['random',{min:1,max:6}]],wires:[[0,'fire',1,'in'],[2,'out',1,'value']]})}
  if(btn){const field=lcNearest(el,isField,260);
    if(field){const outEl=lcNearest(field,o=>o!==el&&o!==field&&isTexty(o)&&o.tag!=='button'&&o.tag!=='label',360);
      if(outEl)out.push({key:'copy',title:`Send: ${lcName(el)} puts what’s typed in ${lcName(field)} into ${lcName(outEl)}`,why:'A button beside a field',nodes:[['click',{el:el.id}],['setText',{el:outEl.id}],['elText',{el:field.id}]],wires:[[0,'fire',1,'in'],[2,'out',1,'value']]})}}
  if(btn){const an=lcNearest(el,o=>!!o.anim&&o!==el,500);
    if(an)out.push({key:'anim',title:`Animate: ${lcName(el)} plays ${lcName(an)}’s animation`,why:'A button near something animated',nodes:[['click',{el:el.id}],['animate',{el:an.id,dir:'toggle'}]],wires:[[0,'fire',1,'in']]})}
  if(isField(el)){const outEl=lcNearest(el,o=>isTexty(o)&&o.tag!=='label'&&o.tag!=='button',300);
    if(outEl)out.push({key:'mirror',title:`Live preview: what’s typed in ${lcName(el)} shows in ${lcName(outEl)}`,why:'A field near some text',nodes:[['change',{el:el.id}],['setText',{el:outEl.id}]],wires:[[0,'fire',1,'in'],[0,'value',1,'value']]})}
  if(el.tag==='input'&&/checkbox/i.test(el.attrs&&el.attrs.type||'')){const tgt=lcNearest(el,o=>o.tag!=='label'&&o.tag!=='input',320);
    if(tgt)out.push({key:'check',title:`Checkbox: ${lcName(el)} shows and hides ${lcName(tgt)}`,why:'A checkbox near something',nodes:[['change',{el:el.id}],['show',{el:tgt.id,mode:'toggle'}]],wires:[[0,'fire',1,'in']]})}
  return out;
}
// PERF: only triggers (buttons, links, fields, checkboxes) start ideas, so a page of text costs next to nothing.
function suggestInteractions(){const out=[];for(const el of state.els)if(!el.md&&/^(button|a|input|textarea)$/.test(el.tag))out.push(...ideasFor(el));return out}
function applyIdea(idea){
  pushUndo();const L=state.logic,x0=(L.nodes.length?Math.max(...L.nodes.map(n=>n.x)):0)+(L.nodes.length?300:40),y0=40,ids=[];
  idea.nodes.forEach(([type,f],i)=>{const id='n'+nid('i');ids.push(id);L.nodes.push({id,type,x:x0+(i%2)*240,y:y0+Math.floor(i/2)*150+(i%2)*40,f:{...nodeDefaults(type),...f}})});
  for(const [a,ap,b,bp] of idea.wires)L.wires.push({a:ids[a],ap,b:ids[b],bp});
  save();if(!$('#nodeModal').hidden&&ned.mode==='logic'){drawNodes();nedFit()}renderInspector();
  sfx('boing');status(`Added: ${idea.title}. Try it with ▶ Play; change it in Logic.`);
}
$('#nodeProblems').onclick=()=>{audio();nedNextProblem()};


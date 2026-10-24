// SECTION: logic checks (validated as it is built)
// RULE: every change to the page logic is checked; problems show on the node itself, in the editor's footer, and in
//   the Checks panel even with the editor shut. Errors break something; warnings are something that does nothing.
// FORMAT: problems = [{node, level:'error'|'warn', msg}].
const LC_EL=new Set(['click','change','elText','setText','addText','animate','show','cls']);
const execOut=(n,p)=>{const d=NT[n.type];return!!(d&&(d.outs||[]).some(o=>o[0]===p&&o[2]==='exec'))};
function validateLogic(g=state.logic){
  const out=[],nodes=g&&g.nodes||[],wires=g&&g.wires||[],byId=new Map(nodes.map(n=>[n.id,n])),add=(n,level,msg)=>out.push({node:n.id,level,msg});
  const ex=wires.filter(w=>{const a=byId.get(w.a);return a&&execOut(a,w.ap)});
  const reached=new Set(),todo=nodes.filter(n=>NT[n.type]&&NT[n.type].cat==='Events').map(n=>n.id);
  while(todo.length){const id=todo.pop();if(reached.has(id))continue;reached.add(id);for(const w of ex)if(w.a===id)todo.push(w.b)}
  const setNames=new Set(nodes.filter(n=>n.type==='setVar').map(n=>String(n.f.name)));
  for(const n of nodes){const d=NT[n.type];if(!d||d.anim||d.style)continue;
    if(LC_EL.has(n.type)){if(!n.f.el)add(n,'error','Choose an element for it');else if(!state.els.some(e=>e.id===n.f.el))add(n,'error','Its element was removed from the page')}
    if(n.type==='song'){if(!state.songs.length)add(n,'error','There are no songs: make one in Music');else if(n.f.song&&!songById(n.f.song))add(n,'error','Its song was removed')}
    if(d.cat==='Events'&&!ex.some(w=>w.a===n.id))add(n,'warn','Does nothing yet: wire “then” to an action');
    if((d.ins||[]).some(i=>i[2]==='exec')&&!reached.has(n.id))add(n,'warn','Never runs: no event leads to it');
    for(const [k,label,kind,inline] of d.ins||[]){if(kind!=='data'||wires.some(w=>w.b===n.id&&w.bp===k))continue;
      if(n.type==='setText'&&k==='value')continue;
      if(!inline||String(n.f[k]??'')==='')add(n,'warn',`Nothing goes into “${label||k}”`)}
    if(n.type==='getVar'&&!setNames.has(String(n.f.name)))add(n,'warn',`Variable “${n.f.name}” is never set`);
    if(n.type==='animate'&&n.f.el){const el=state.els.find(e=>e.id===n.f.el);if(el&&!el.anim)add(n,'error','That element has no animation yet: give it one in Animate')}
    if(n.type==='every'&&+n.f.ms<100)add(n,'warn','Faster than 10 times a second; pages slow down');
    if(n.type==='cls'&&!/^[\w-]+$/.test(String(n.f.name||'').trim()))add(n,'error','Give it a class name (letters, numbers, - and _)');
  }
  // RULE: a loop of actions with no Wait in it runs until the 5000-step guard stops it: an error.
  const adj=new Map();for(const w of ex){const b=byId.get(w.b);if(!b||b.type==='wait')continue;if(!adj.has(w.a))adj.set(w.a,[]);adj.get(w.a).push(w.b)}
  const state2=new Map(),inLoop=new Set(),stack=[];
  const dfs=id=>{state2.set(id,1);stack.push(id);for(const nx of adj.get(id)||[]){if(state2.get(nx)===1)stack.slice(stack.indexOf(nx)).forEach(x=>inLoop.add(x));else if(!state2.get(nx))dfs(nx)}stack.pop();state2.set(id,2)};
  for(const n of nodes)if(!state2.get(n.id))dfs(n.id);
  for(const id of inLoop)add(byId.get(id),'error','Loops forever: put a Wait in the loop');
  return out;
}
let lcAt=0;
function nedValidate(){
  if(ned.mode!=='logic'){$('#nodeProblems').hidden=true;return[]}
  const list=validateLogic(ned.g),by=new Map();for(const p of list){const a=by.get(p.node)||[];a.push(p);by.set(p.node,a)}
  for(const b of $('#nodeLayer').querySelectorAll('.nnode')){const ps=by.get(b.dataset.id)||[];b.classList.toggle('bad',ps.some(p=>p.level==='error'));b.classList.toggle('warn',ps.length>0&&!ps.some(p=>p.level==='error'));
    b.title=ps.map(p=>(p.level==='error'?'✖ ':'⚠ ')+p.msg).join('\n')}
  const btn=$('#nodeProblems'),ne=list.filter(p=>p.level==='error').length;btn.hidden=false;
  btn.textContent=list.length?`${ne?'✖':'⚠'} ${list.length} problem${list.length===1?'':'s'}`:'✓ No problems';btn.classList.toggle('bad',!!ne);btn.title=list.map(p=>p.msg).join('\n');
  return list;
}
// RULE: the footer button walks through the problems one by one, centring and selecting each node.
function nedNextProblem(){
  const list=validateLogic(ned.g);if(!list.length)return;const p=list[lcAt++%list.length],box=$('#nodeLayer').querySelector(`.nnode[data-id="${p.node}"]`);if(!box)return;
  const v=$('#nodeView').getBoundingClientRect(),z=ned.view.z;ned.view.x=v.width/2-(box.offsetLeft+box.offsetWidth/2)*z;ned.view.y=v.height/2-(box.offsetTop+box.offsetHeight/2)*z;applyView();drawWires();
  ned.sel=p.node;$('#nodeLayer').querySelectorAll('.nnode.on').forEach(b=>b.classList.remove('on'));box.classList.add('on');status(p.msg);
}
function logicChecks(){return validateLogic().map(p=>({id:null,kind:'logic',msg:p.msg,note:'Page logic · '+((NT[(state.logic.nodes.find(n=>n.id===p.node)||{}).type]||{}).t||'node'),open:()=>{openLogicEditor();requestAnimationFrame(()=>{lcAt=validateLogic().findIndex(q=>q.node===p.node);if(lcAt<0)lcAt=0;nedNextProblem()})}}))}


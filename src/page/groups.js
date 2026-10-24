// SECTION: groups and multi-selection
// RULE: Shift-click adds to (or takes from) the selection; Ctrl/Cmd+G makes it a group, Ctrl/Cmd+Shift+G undoes that.
//   Clicking any member selects its whole group; double-clicking drills into one member (then its menu, as before).
//   Whatever is done to the selection happens to all of it: move, nudge, delete, duplicate, restack, and every
//   Inspector or catalog change, mirrored from the element being edited to the others (style only to the same tag).
// FORMAT: el.group = group id; state.groupNames = {id: name}. state.multi (a Set of ids) is the rest of the
//   selection beside state.sel, and is never saved.
const MIRROR=['extra','colors','pal','anim','sx','sy'];
const groupMembers=gid=>state.els.filter(e=>e.group===gid);
function selIds(){const out=state.sel?[state.sel]:[];for(const id of state.multi)if(id!==state.sel&&state.els.some(e=>e.id===id))out.push(id);return out}
const selEls=()=>selIds().map(id=>state.els.find(e=>e.id===id)).filter(Boolean);
// INVARIANT: select() calls this before anything else reads the selection.
function selectSet(id){
  state.multi=new Set();const el=id&&state.els.find(e=>e.id===id);
  if(el&&el.group&&state.drill!==el.group)for(const m of groupMembers(el.group))if(m.id!==id)state.multi.add(m.id);
  if(!el||el.group!==state.drill)state.drill=null;
}
function toggleInSel(id){
  const el=state.els.find(e=>e.id===id);if(!el)return;
  const ids=el.group&&state.drill!==el.group?groupMembers(el.group).map(e=>e.id):[id],all=selIds(),has=ids.every(x=>all.includes(x));
  const next=has?all.filter(x=>!ids.includes(x)):[...new Set([...all,...ids])];
  state.sel=next[0]||null;state.multi=new Set(next.slice(1));mirrorBase();updateSel();renderInspector();
}
function groupSel(){
  const els=selEls();if(els.length<2){status('Shift-click two or more things to group them.');return}
  pushUndo();const gid=nid('g'),old=new Set(els.map(e=>e.group).filter(Boolean));
  for(const e of els)e.group=gid;
  (state.groupNames||(state.groupNames={}))[gid]=`Group ${Object.keys(state.groupNames).length+1}`;
  for(const g of old)if(!groupMembers(g).length)delete state.groupNames[g];
  state.drill=null;updateSel();renderInspector();if(typeof treeLater==='function')treeLater();save();sfx('boing');status(`Grouped ${els.length}. Click any of them to take them all; double-click to reach one.`);
}
function ungroupSel(){
  const gs=new Set(selEls().map(e=>e.group).filter(Boolean));if(!gs.size){status('Nothing grouped in the selection.');return}
  pushUndo();for(const e of state.els)if(gs.has(e.group))delete e.group;for(const g of gs)if(state.groupNames)delete state.groupNames[g];
  state.drill=null;updateSel();renderInspector();if(typeof treeLater==='function')treeLater();save();status('Ungrouped. They are separate again, and still selected.');
}
// RULE: mirroring compares the edited element with how it was when the selection last settled, and copies what
//   changed. Position and text never mirror: those are each element's own.
const mirrorKey=el=>el?JSON.stringify([el.tag,el.fileId,el.selector,...MIRROR.map(k=>el[k]??null)]):'';
function mirrorBase(){state._mb=mirrorKey(selected())}
function mirrorSel(){
  if(!state.multi||!state.multi.size)return;const el=selected();if(!el)return;const now=mirrorKey(el);if(now===state._mb)return;
  const was=state._mb?JSON.parse(state._mb):null;state._mb=now;if(!was||was[0]!==el.tag)return;
  const styleChanged=was[1]!==el.fileId||was[2]!==el.selector;
  for(const o of selEls()){if(o===el)continue;let ch=false;
    MIRROR.forEach((k,i)=>{const v=el[k]??null;if(JSON.stringify(was[3+i])!==JSON.stringify(v)){if(v==null)delete o[k];else o[k]=JSON.parse(JSON.stringify(v));ch=true}});
    if(styleChanged&&o.tag===el.tag){o.fileId=el.fileId;o.selector=el.selector;ch=true}
    if(ch)renderEl(o)}
}
// SECTION: actions on the whole selection
function selDelete(){
  const els=selEls();if(els.length<2)return false;pushUndo();const gone=new Set(els.map(e=>e.id));
  if(iso.id&&gone.has(iso.id))exitIso(true);state.els=state.els.filter(e=>!gone.has(e.id));for(const id of gone)dropHost(id);
  state.sel=null;state.multi=new Set();updateSel();renderInspector();save();sfx('whoosh');status(`Deleted ${gone.size}. Undo brings them back.`);return true;
}
function selDuplicate(){
  const els=selEls();if(els.length<2)return false;pushUndo();const remap=new Map(),made=[];let z=maxZ();
  for(const e of els){const c={...JSON.parse(JSON.stringify(e)),id:nid('e'),x:e.x+18,y:e.y+18,z:++z};
    if(e.group){if(!remap.has(e.group)){const g=nid('g');remap.set(e.group,g);if(state.groupNames)state.groupNames[g]=(state.groupNames[e.group]||'Group')+' copy'}c.group=remap.get(e.group)}
    delete c.box;delete c.bo;state.els.push(c);renderEl(c);made.push(c)}
  state.sel=made[0].id;state.multi=new Set(made.slice(1).map(e=>e.id));state.drill=null;mirrorBase();updateSel();renderInspector();save();sfx('pop');return true;
}
function selNudge(dx,dy){const els=selEls();for(const e of els){e.x+=dx;e.y+=dy;const h=hostOf(e.id);if(h){h.style.left=e.x+'px';h.style.top=e.y+'px'}}updateSel();save()}
function selRestack(how){
  const els=selEls();if(els.length<2)return false;pushUndo();const set=new Set(els),order=[...state.els].sort((a,b)=>(a.z||0)-(b.z||0)),rest=order.filter(e=>!set.has(e)),mine=order.filter(e=>set.has(e));
  let next;if(how==='front'||how>0)next=[...rest,...mine];else next=[...mine,...rest];
  next.forEach((x,n)=>{x.z=n+1;const h=hostOf(x.id);if(h)h.style.zIndex=x.z});updateSel();save();status(how==='back'||how<0?'Sent back':'Brought forward');return true;
}
// RULE: the selection box wraps everything selected; scale handles are for one thing at a time.
function selUnion(){
  const els=selEls();if(els.length<2)return null;let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;
  for(const e of els){const h=hostOf(e.id);if(!h)continue;const b=elBox(e,h);x0=Math.min(x0,h.offsetLeft);y0=Math.min(y0,h.offsetTop);x1=Math.max(x1,h.offsetLeft+b.w);y1=Math.max(y1,h.offsetTop+b.h)}
  return x1>x0?{x:x0,y:y0,w:x1-x0,h:y1-y0,n:els.length}:null;
}
function markSel(){const ids=new Set(selIds());for(const h of hosts.values())h.classList.toggle('insel',ids.size>1&&ids.has(h.dataset.id))}

// SECTION: groups as primitives
// FORMAT: kind 'group' {items:[{dx,dy,data}]}: data is an element primitive's data, dx/dy its place in the group.
function groupPrim(){
  const els=selEls();if(els.length<2)return null;const x0=Math.min(...els.map(e=>e.x)),y0=Math.min(...els.map(e=>e.y)),g=els[0].group;
  const items=[...els].sort((a,b)=>(a.z||0)-(b.z||0)).map(e=>({dx:e.x-x0,dy:e.y-y0,data:primFromElement(e).data}));
  return addPrim({kind:'group',name:(g&&state.groupNames&&state.groupNames[g])||`Group of ${els.length}`,data:{items}});
}
async function useGroupPrim(p,at){
  const c=at||viewCenter(),gid=nid('g'),made=[];pushUndo();let z=maxZ();
  for(const it of p.data.items){const e=JSON.parse(JSON.stringify(it.data.el));let fid=null,sel=null;if(it.data.style){const f=await resolvePrimSheet(it.data.style);if(f){fid=f.id;sel=it.data.style.selector}}
    const el={...e,fileId:fid,selector:sel,id:nid('e'),x:Math.round(c.x+it.dx),y:Math.round(c.y+it.dy),z:++z,group:gid};state.els.push(el);renderEl(el);made.push(el)}
  (state.groupNames||(state.groupNames={}))[gid]=p.name;
  state.sel=made[0].id;state.multi=new Set(made.slice(1).map(e=>e.id));state.drill=null;mirrorBase();updateSel();renderInspector();save();sfx('pop');
}
// SECTION: autoformat helpers
// RULE: a group is one block to autoformat: placed as a whole, its members keep their places inside it.
function groupUnits(list){
  const units=[],seen=new Set();
  for(const el of list){if(seen.has(el))continue;
    if(el.group){const ms=list.filter(e=>e.group===el.group);ms.forEach(m=>seen.add(m));units.push(ms)}else{seen.add(el);units.push([el])}}
  return units;
}


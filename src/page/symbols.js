// SECTION: symbols
// RULE: a symbol is an element drawn many times. Look, style, effects and animation are shared: editing any copy
//   edits them all. Text and colors changed on one copy become that copy's own, unless the symbol itself is being
//   edited (isolation), where they go to every copy that hasn't its own. Position and size are always per copy.
// INVARIANT: every instance carries its full data, so export, flow, logic and readers that ignore symbols just work.
const SYM_SHARED=['tag','fileId','selector','extra','attrs','anim','pal','nopal'],SYM_OWN=['content','colors'];
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const symById=id=>state.syms.find(x=>x.id===id)||null;
const cleanSymName=v=>String(v??'').replace(/[\u0000-\u001f]/g,'').trim().slice(0,60)||'Symbol';
const pickShared=el=>Object.fromEntries(SYM_SHARED.filter(k=>el[k]!==undefined).map(k=>[k,clone(el[k])]));
const symFrom=el=>({m:pickShared(el),content:el.content,colors:clone(el.colors)});
const symEl=x=>({...clone(x.m),content:x.content,colors:clone(x.colors),x:0,y:0});
const symCopies=id=>state.els.filter(e=>e.sym===id);
function applySym(el,x){
  for(const k of SYM_SHARED){if(x.m[k]===undefined)delete el[k];else el[k]=clone(x.m[k])}
  for(const k of SYM_OWN)if(!(el.own&&el.own[k])){if(x[k]==null)delete el[k];else el[k]=clone(x[k])}
}
function syncSyms(){
  const el=selected();if(!el||!el.sym)return;const x=symById(el.sym);if(!x){delete el.sym;delete el.own;return}
  const master=iso.id===el.id,sh=pickShared(el);let changed=false;
  if(JSON.stringify(sh)!==JSON.stringify(x.m)){x.m=sh;changed=true}
  for(const k of SYM_OWN){
    if(JSON.stringify(el[k]??null)===JSON.stringify(x[k]??null))continue;
    if(master){x[k]=clone(el[k]);if(el.own&&el.own[k]){const o={...el.own};delete o[k];el.own=Object.keys(o).length?o:undefined}changed=true}
    else if(!(el.own&&el.own[k]))el.own={...el.own,[k]:1};
  }
  if(changed)for(const i of state.els)if(i!==el&&i.sym===x.id){applySym(i,x);renderEl(i)}
}
function makeSymbol(el){
  if(!el||el.md||el.sym)return;pushUndo();
  const base=elLabel(el)||el.tag,x={id:nid('s'),name:cleanSymName(base),...symFrom(el)};
  state.syms.push(x);el.sym=x.id;delete el.own;renderInspector();save();treeLater();
  status(`“${x.name}” is a symbol. Duplicate it (${M}+J) or place it from the tree; every copy changes together.`);sfx('boing');
}
function placeSymbol(id,at){
  const x=symById(id);if(!x)return null;pushUndo();const p=at||viewCenter();
  const el={id:nid('e'),...symEl(x),x:Math.round(p.x),y:Math.round(p.y),w:null,z:maxZ()+1,sym:x.id};
  const like=symCopies(id)[0];if(like){el.w=like.w;if(like.sx)el.sx=like.sx;if(like.sy)el.sy=like.sy}
  if(el.content==null)delete el.content;if(!el.colors)delete el.colors;
  state.els.push(el);renderEl(el);if(writing())confine(el);select(el.id);save();sfx('pop');return el;
}
function resetOwn(el){const x=el&&symById(el.sym);if(!x||!el.own)return;pushUndo();delete el.own;applySym(el,x);renderEl(el);updateSel();renderInspector();save();status('Back to the symbol’s text and colors')}
function detachSym(el){if(!el||!el.sym)return;pushUndo();delete el.sym;delete el.own;renderInspector();save();treeLater();status('Detached: an ordinary element again; the symbol and its other copies are unchanged')}
function deleteSym(id){const x=symById(id);if(!x)return;pushUndo();for(const e of symCopies(id)){delete e.sym;delete e.own}state.syms=state.syms.filter(s=>s!==x);renderInspector();save();treeLater();status(`Removed the symbol “${x.name}”. Its copies stay, as ordinary elements.`)}
function symRow(el,mk){
  const x=symById(el.sym),n=symCopies(el.sym).length,box=mk('div',{className:'symrow'}),top=mk('div',{className:'row'});
  const nm=mk('input',{type:'text',value:x.name,maxLength:60,title:'The symbol’s name'});nm.setAttribute('aria-label','Symbol name');
  nm.onchange=()=>{pushUndo();x.name=cleanSymName(nm.value);nm.value=x.name;save();treeLater()};
  top.append(mk('b',{textContent:'◈'}),nm,mk('small',{textContent:`${n} cop${n===1?'y':'ies'}`}));box.append(top);
  const own=SYM_OWN.filter(k=>el.own&&el.own[k]),row=mk('div',{className:'row'}),b=(t,fn,tt,dis)=>{const q=mk('button',{type:'button',className:'btn sqm',textContent:t,title:tt});q.disabled=!!dis;q.onclick=()=>{audio();fn()};row.append(q)};
  if(iso.id!==el.id)b('Edit symbol',()=>enterIso(el.id),'Edit the symbol on its own: text and colors go to every copy');
  b('Use symbol’s',()=>resetOwn(el),own.length?`This copy has its own ${own.join(' and ')}; go back to the symbol’s`:'This copy uses the symbol’s text and colors',!own.length);
  b('Detach',()=>detachSym(el),'Make this copy an ordinary element');b('Remove symbol',()=>deleteSym(x.id),'Every copy stays, as an ordinary element');box.append(row);
  box.append(mk('p',{className:'note',textContent:iso.id===el.id?'Editing the symbol: every copy changes, text and colors too (except where a copy has its own).':own.length?`Its own: ${own.join(', ')}. Everything else follows the symbol.`:'Change its look and every copy follows. Text and colors you change here stay with this copy.'}));
  return box;
}

// SECTION: checks (accessibility)
// RULE: WCAG 2.2 AA: 4.5:1 for body text, 3:1 for large (>=24px, or >=18.66px bold). Text over a background image
//   or gradient can't be measured from styles and is left to the eye rather than guessed.
const relLum=([r,g,b])=>{const f=c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
const contrast=(a,b)=>{const x=relLum(a),y=relLum(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
const over=(t,u)=>[0,1,2].map(i=>t[i]*t[3]+u[i]*(1-t[3])).concat(1);
const toHex=c=>'#'+c.slice(0,3).map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
function a11yCheck(){
  const out=[],layered=state.bgd.layers.some(l=>!l.hidden),base=parseColor(colorOf(state.bgd.base))||[255,255,255,1];
  let prev=0,h1=false,heads=0;
  for(const el of readingOrder(state.els)){
    const host=hostOf(el.id);if(!host)continue;const root=host.shadowRoot;let worst=null,k=0;
    for(const n of root.querySelectorAll('*')){
      if(++k>300)break;if(![...n.childNodes].some(t=>t.nodeType===3&&t.nodeValue.trim()))continue;
      const cs=getComputedStyle(n);if(cs.visibility==='hidden'||cs.display==='none')continue;
      const fg=parseColor(cs.color);if(!fg||fg[3]<.5)continue;
      const stack=[];let img=false;
      for(let a=n;a&&a.nodeType===1;a=a.parentElement){const st=getComputedStyle(a);if(st.backgroundImage!=='none'){img=true;break}const b=parseColor(st.backgroundColor);if(b&&b[3]>0){stack.push(b);if(b[3]>=1)break}}
      if(img||(layered&&!(stack.length&&stack[stack.length-1][3]>=1)))continue;
      let bg=stack.length&&stack[stack.length-1][3]>=1?stack.pop():base;for(let i=stack.length-1;i>=0;i--)bg=over(stack[i],bg);
      const fc=fg[3]<1?over(fg,bg):fg,size=parseFloat(cs.fontSize),large=size>=24||(size>=18.66&&+cs.fontWeight>=700),need=large?3:4.5,r=contrast(fc,bg);
      if(r<need&&(!worst||r/need<worst.r/worst.need))worst={r,need,bg};
    }
    if(worst){const w=contrast([0,0,0],worst.bg)>=contrast([255,255,255],worst.bg)?'#000000':'#ffffff';
      out.push({id:el.id,kind:'contrast',msg:`Text contrast ${worst.r.toFixed(2)}:1; it needs ${worst.need}:1`,note:`on ${toHex(worst.bg)}`,fix:{label:w==='#000000'?'Black text':'White text',run:()=>{el.colors={...el.colors,fg:{c:w,role:null}}}}})}
    if(el.tag==='img'&&!(el.attrs&&String(el.attrs.alt||'').trim()))out.push({id:el.id,kind:'alt',msg:'A picture with no description',note:'Say what it shows, for people who can’t see it',edit:'alt'});
    else if(root.querySelector('img:not([alt]),img[alt=""]')&&el.tag!=='img')out.push({id:el.id,kind:'alt',msg:'A picture inside it has no description',note:'Edit its HTML and add alt text'});
    for(const b of root.querySelectorAll('button,a[href],[role=button]'))if(!(b.textContent.trim()||b.getAttribute('aria-label')||b.title||b.querySelector('img[alt]:not([alt=""]),svg title'))){out.push({id:el.id,kind:'name',msg:`A ${b.tagName==='A'?'link':'button'} with no name`,note:'Give it some text, or a label for screen readers'});break}
    for(const h of root.querySelectorAll('h1,h2,h3,h4,h5,h6')){const lv=+h.tagName[1];heads++;if(lv===1)h1=true;
      if(prev&&lv>prev+1)out.push({id:el.id,kind:'heading',msg:`A heading jumps from h${prev} to h${lv}`,note:`Use h${prev+1} here, or restyle it instead`});prev=lv}
  }
  // RULE: page-logic problems are listed with the rest, so they show up even with the logic editor shut.
  out.push(...logicChecks());
  if(heads&&!h1)out.unshift({id:null,kind:'heading',msg:'The page has headings but no h1',note:'One top-level heading tells readers and search engines what the page is'});
  return out;
}
const CHK_ICON={contrast:'◐',alt:'▨',name:'⌧',heading:'H',logic:'⚙'};
let chkT=0;
function renderChecks(){
  const box=$('#chkList');if(!box)return;box.replaceChildren();const list=a11yCheck();
  $('#chkTitle').textContent=list.length?`Checks · ⚠ ${list.length}`:'Checks · ✓';
  if(!list.length){box.append(mkEl('li',{className:'ok',textContent:'Nothing to fix that can be checked from here.'}));return list}
  for(const it of list){const li=mkEl('li'),go=mkEl('button',{type:'button',className:'go'});
    const who=it.id&&state.els.find(e=>e.id===it.id);
    go.append(mkEl('b',{textContent:it.msg}),mkEl('small',{textContent:(who?`<${who.tag}> ${elLabel(who)}`+(it.note?' · ':''):'')+(it.note||'')}));li.append(mkEl('i',{textContent:CHK_ICON[it.kind]||'•'}),go);
    go.onclick=()=>{audio();if(it.open){it.open();return}if(!it.id)return;if(document.body.dataset.ws!=='page'&&document.body.dataset.ws!=='write')setWorkspace('page');select(it.id);hostOf(it.id)?.scrollIntoView({block:'center',inline:'nearest'});
      if(it.edit==='alt')setTimeout(()=>{const f=[...document.querySelectorAll('#ins label')].find(l=>/^alt/i.test(l.textContent));f&&$('#'+f.htmlFor)?.focus()},0)};
    if(it.fix){const fx=mkEl('button',{type:'button',className:'btn sqm',textContent:it.fix.label,title:'Set this element’s text color so it reads'});
      fx.onclick=()=>{audio();pushUndo();it.fix.run();const el=state.els.find(e=>e.id===it.id);if(el)renderEl(el);if(state.sel===it.id)renderInspector();save();renderChecks();sfx('pop')};li.append(fx)}
    box.append(li)}
  return list;
}
$('#chkRun').onclick=()=>{audio();const n=renderChecks().length;status(n?`${n} thing${n===1?'':'s'} to look at`:'Nothing found');sfx(n?'blip':'boing')};
// PERF: while the section is open the list follows edits, debounced; closed, nothing runs.
const checksLater=()=>{if(!$('#w-checks').open)return;clearTimeout(chkT);chkT=setTimeout(renderChecks,600)};
$('#w-checks').addEventListener('toggle',()=>{if($('#w-checks').open)renderChecks()});


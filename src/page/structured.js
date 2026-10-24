// SECTION: structured content (tables, lists, dropdowns, link bars)
// INVARIANT: each kind parses content into a model, edits the model, writes HTML back; a cell keeps its own markup
//   until its text is edited.
const textOf=h=>frag(h).textContent;
const kept=(o,v)=>{if(v!==textOf(o.html))o.html=escH(v)};
const TABLE_KIND={label:'Table',
  // HACK: <tr>/<td> only survive the HTML parser inside a <table>, so content is parsed wrapped in one.
  parse(h){const tp=document.createElement('template');tp.innerHTML=`<table>${h||''}</table>`;const d=tp.content.firstElementChild,all=[...d.querySelectorAll('tr')],cap=d.querySelector('caption');
    let hr=d.querySelector('thead tr');if(!hr&&all[0]&&all[0].children.length&&[...all[0].children].every(c=>c.tagName==='TH'))hr=all[0];
    const rows=(hr?[hr,...all.filter(r=>r!==hr)]:all).map(r=>[...r.children].map(c=>({html:c.innerHTML.trim()})));
    const n=Math.max(1,...rows.map(r=>r.length));rows.forEach(r=>{while(r.length<n)r.push({html:''})});
    if(!rows.length)rows.push(Array.from({length:2},()=>({html:''})));
    return{head:!!hr,rows,caption:cap?cap.innerHTML.trim():''}},
  write(m){const cell=(t,c)=>`<${t}>${c.html}</${t}>`,[h,...b]=m.head?m.rows:[null,...m.rows];
    return(m.caption?`<caption>${m.caption}</caption>`:'')+(h?`<thead><tr>${h.map(c=>cell('th',c)).join('')}</tr></thead>`:'')+`<tbody>${b.map(r=>`<tr>${r.map(c=>cell('td',c)).join('')}</tr>`).join('')}</tbody>`}};
const LIST_KIND={label:'Items',add:'Add item',fields:[{k:'text',ph:'Item'}],
  parse:h=>({items:[...frag(h).children].filter(x=>x.tagName==='LI').map(li=>({html:li.innerHTML}))}),
  write:m=>m.items.map(i=>`<li>${i.html}</li>`).join(''),blank:()=>({html:''})};
const SELECT_KIND={label:'Options',add:'Add option',fields:[{k:'text',ph:'Shown as'},{k:'value',ph:'Value (optional)',small:true},{k:'selected',radio:'Starts selected'}],
  parse:h=>({items:[...frag(h).querySelectorAll('option')].map(o=>({html:o.innerHTML,value:o.getAttribute('value')??'',selected:o.hasAttribute('selected')}))}),
  write:m=>m.items.map(i=>`<option${i.value?` value="${escH(i.value)}"`:''}${i.selected?' selected':''}>${i.html}</option>`).join(''),blank:()=>({html:'',value:'',selected:false})};
const NAV_KIND={label:'Links',add:'Add link',fields:[{k:'text',ph:'Label'},{k:'href',ph:'URL',small:true}],
  parse(h){const d=frag(h),as=[...d.querySelectorAll('a')];let sep=' · ';
    if(as.length>1){let t='';for(let n=as[0].nextSibling;n&&n!==as[1];n=n.nextSibling)t+=n.textContent;sep=t}
    return{items:as.map(a=>({html:a.innerHTML,href:a.getAttribute('href')??'#'})),sep}},
  write:m=>m.items.map(i=>`<a href="${escH(i.href||'#')}">${i.html}</a>`).join(escH(m.sep??' · ')),blank:()=>({html:'',href:'#'}),
  extra:[{k:'sep',label:'Between links',ph:'nothing'}]};
const STRUCT={table:TABLE_KIND,ul:LIST_KIND,ol:LIST_KIND,select:SELECT_KIND,nav:NAV_KIND};

function structEditor(el,onChange,big){
  const K=STRUCT[el.tag],m=K.parse(el.content??(TAGS[el.tag]||{}).content??''),root=mkEl('div',{className:'sed'+(big?' big':'')});
  const emit=()=>onChange(K.write(m));
  const btn=(t,title,fn,cls='')=>{const b=mkEl('button',{type:'button',className:'btn '+cls,textContent:t,title});b.setAttribute('aria-label',title);b.onclick=()=>{audio();fn()};return b};
  const redraw=focus=>{draw();if(focus){const x=root.querySelector(focus);if(x){x.focus();x.select&&x.select()}}};
  const draw=K===TABLE_KIND?drawTable:drawList;
  function drawTable(){
    root.replaceChildren();const n=m.rows[0].length;
    const bar=mkEl('div',{className:'sedbar'}),hd=mkEl('label',{className:'tog2'}),cb=mkEl('input',{type:'checkbox',checked:m.head});
    cb.onchange=()=>{m.head=cb.checked;emit();redraw()};hd.append(cb,' First row is the header');
    bar.append(hd,btn('+ Row','Add a row at the end',()=>{m.rows.push(Array.from({length:n},()=>({html:''})));emit();redraw(`[data-r="${m.rows.length-1}"][data-c="0"]`)}),
      btn('+ Column','Add a column at the end',()=>{m.rows.forEach(r=>r.push({html:''}));emit();redraw(`[data-r="0"][data-c="${n}"]`)}));
    const cap=mkEl('input',{type:'text',value:textOf(m.caption),placeholder:'Caption (optional)',className:'sedcap'});cap.dataset.cat=1;
    cap.oninput=()=>{const o={html:m.caption};kept(o,cap.value);m.caption=cap.value?o.html:'';emit()};
    const wrap=mkEl('div',{className:'sedgrid'}),t=mkEl('table'),top=mkEl('tr');
    top.append(mkEl('th'));
    for(let c=0;c<n;c++){const th=mkEl('th');
      th.append(btn('‹',`Move column ${c+1} left`,()=>{if(!c)return;m.rows.forEach(r=>[r[c-1],r[c]]=[r[c],r[c-1]]);emit();redraw()},'tiny'),
        btn('×',`Remove column ${c+1}`,()=>{if(n<2)return;m.rows.forEach(r=>r.splice(c,1));emit();redraw()},'tiny'),
        btn('›',`Move column ${c+1} right`,()=>{if(c>=n-1)return;m.rows.forEach(r=>[r[c+1],r[c]]=[r[c],r[c+1]]);emit();redraw()},'tiny'));
      top.append(th)}
    t.append(top);
    m.rows.forEach((row,r)=>{const tr=mkEl('tr',{className:m.head&&!r?'hrow':''}),ctl=mkEl('td',{className:'rctl'});
      ctl.append(btn('↑',`Move row ${r+1} up`,()=>{if(!r)return;[m.rows[r-1],m.rows[r]]=[m.rows[r],m.rows[r-1]];emit();redraw()},'tiny'),
        btn('×',`Remove row ${r+1}`,()=>{if(m.rows.length<2)return;m.rows.splice(r,1);emit();redraw()},'tiny'));
      tr.append(ctl);
      row.forEach((cell,c)=>{const td=mkEl('td'),inp=mkEl('input',{type:'text',value:textOf(cell.html)});
        inp.dataset.r=r;inp.dataset.c=c;inp.dataset.cat=1;inp.setAttribute('aria-label',`${m.head&&!r?'Header':'Row '+(m.head?r:r+1)}, column ${c+1}`);
        inp.size=Math.max(6,Math.min(big?40:18,inp.value.length+1));
        inp.oninput=()=>{kept(cell,inp.value);inp.size=Math.max(6,Math.min(big?40:18,inp.value.length+1));emit()};
        inp.onkeydown=e=>{if(e.key!=='Enter')return;e.preventDefault();e.stopPropagation();
          if(r===m.rows.length-1){m.rows.push(Array.from({length:n},()=>({html:''})));emit()}redraw(`[data-r="${r+1}"][data-c="${c}"]`)};
        td.append(inp);tr.append(td)});
      t.append(tr)});
    wrap.append(t);root.append(bar,cap,wrap);
    root.append(mkEl('small',{className:'credit',textContent:'Enter moves down a row and adds one at the end. Tab moves across.'}));
  }
  function drawList(){
    root.replaceChildren();
    for(const x of K.extra||[]){const inp=mkEl('input',{type:'text',value:m[x.k]??'',placeholder:x.ph});inp.dataset.cat=1;const w=mkEl('label',{className:'field2'});w.append(x.label+' ',inp);inp.oninput=()=>{m[x.k]=inp.value;emit()};root.append(w)}
    const list=mkEl('div',{className:'sedlist'});
    m.items.forEach((it,i)=>{const row=mkEl('div',{className:'sedrow'});
      row.append(mkEl('span',{className:'sednum',textContent:el.tag==='ol'?i+1+'.':'•'}));
      for(const f of K.fields){
        if(f.radio){const rb=mkEl('input',{type:'radio',name:'sedsel-'+el.id+(big?'-big':''),checked:!!it[f.k],title:f.radio});rb.setAttribute('aria-label',f.radio);rb.onchange=()=>{m.items.forEach(o=>o[f.k]=o===it);emit()};row.append(rb);continue}
        const inp=mkEl('input',{type:'text',value:f.k==='text'?textOf(it.html):it[f.k]??'',placeholder:f.ph,className:f.small?'small':''});
        inp.dataset.i=i;inp.dataset.k=f.k;inp.dataset.cat=1;inp.setAttribute('aria-label',`${f.ph} ${i+1}`);
        inp.oninput=()=>{if(f.k==='text')kept(it,inp.value);else it[f.k]=inp.value;emit()};
        if(f.k==='text')inp.onkeydown=e=>{
          if(e.key==='Enter'){e.preventDefault();e.stopPropagation();m.items.splice(i+1,0,K.blank());emit();redraw(`[data-i="${i+1}"][data-k="text"]`)}
          else if(e.key==='Backspace'&&!inp.value&&m.items.length>1){e.preventDefault();e.stopPropagation();m.items.splice(i,1);emit();redraw(`[data-i="${Math.max(0,i-1)}"][data-k="text"]`)}};
        row.append(inp)}
      row.append(btn('↑','Move up',()=>{if(!i)return;[m.items[i-1],m.items[i]]=[m.items[i],m.items[i-1]];emit();redraw(`[data-i="${i-1}"][data-k="text"]`)},'tiny'),
        btn('↓','Move down',()=>{if(i>=m.items.length-1)return;[m.items[i+1],m.items[i]]=[m.items[i],m.items[i+1]];emit();redraw(`[data-i="${i+1}"][data-k="text"]`)},'tiny'),
        btn('×','Remove',()=>{m.items.splice(i,1);emit();redraw()},'tiny'));
      list.append(row)});
    root.append(list,btn('+ '+K.add,K.add,()=>{m.items.push(K.blank());emit();redraw(`[data-i="${m.items.length-1}"][data-k="text"]`)}));
    root.append(mkEl('small',{className:'credit',textContent:'Enter adds an item after this one. Backspace in an empty item removes it.'}));
  }
  draw();return root;
}
function openStructWindow(el){
  const K=STRUCT[el.tag];let armed=true;
  $('#sedTitle').textContent=`${K.label} · <${el.tag}>`;
  $('#sedBody').replaceChildren(structEditor(el,html=>{if(armed){pushUndo();armed=false}el.content=html;renderEl(el);updateSel();save()},true));
  $('#sedModal').hidden=false;const f=$('#sedBody input[type=text]');if(f)f.focus();
}
function closeStructWindow(){if($('#sedModal').hidden)return;$('#sedModal').hidden=true;renderInspector();renderStyles()}
$('#sedClose').onclick=closeStructWindow;
$('#sedModal').addEventListener('pointerdown',e=>{if(e.target.id==='sedModal')closeStructWindow()});

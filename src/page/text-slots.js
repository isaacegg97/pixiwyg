// SECTION: text slots (editable words found in an element's markup, named by the part they fill)
const TAG_WORD={p:'Paragraph',h1:'Heading',h2:'Heading',h3:'Heading',h4:'Heading',h5:'Heading',h6:'Heading',button:'Button',a:'Link',li:'Item',label:'Label',legend:'Legend',summary:'Summary',caption:'Caption',figcaption:'Caption',code:'Code',pre:'Code',small:'Small text',b:'Bold',strong:'Bold',i:'Italic',em:'Italic',u:'Underline',mark:'Highlight',span:'Text',div:'Text',option:'Option',blockquote:'Quote',q:'Quote',dt:'Term',dd:'Description',kbd:'Key',sup:'Superscript',sub:'Subscript',abbr:'Abbreviation',time:'Time',cite:'Citation',header:'Header',footer:'Footer',nav:'Nav',section:'Section',article:'Article',aside:'Aside'};
const TEXT_ATTRS=['aria-label','title','placeholder','alt','value','label','data-label','data-title','data-text','data-content','data-tooltip','data-caption','data-badge','data-count','data-before','data-after'];
const human=t=>{t=String(t).replace(/[-_]+/g,' ').replace(/([a-z])([A-Z])/g,'$1 $2').trim();return t&&t[0].toUpperCase()+t.slice(1)};
// RULE: a naming class names a part (title-bar-text), not a modifier (is-primary, active).
const nameClass=n=>[...n.classList].find(c=>c.length>1&&!/^(is|has|js|u)[-_]|^-/.test(c)&&!/^(active|selected|disabled|primary|secondary|small|large|big|dark|light|left|right|center|rounded|outline)$/.test(c));
function partName(n,root){
  const c=nameClass(n);if(c)return human(c);if(n.id)return human(n.id);
  const t=n.tagName.toLowerCase();
  if(t==='td'||t==='th'){const rows=[...(n.closest('table')||root).querySelectorAll('tr')],r=rows.indexOf(n.parentElement),k=[...n.parentElement.children].indexOf(n);return`${t==='th'?'Header':'Cell'} row ${r+1}, column ${k+1}`}
  const word=TAG_WORD[t]||human(t);
  for(let a=n.parentElement;a;a=a.parentElement){const nm=nameClass(a)||a.id;if(nm)return`${human(nm)} › ${word}`}
  return word;
}
function textSlots(html){
  const tpl=document.createElement('template');tpl.innerHTML=html;const root=tpl.content,slots=[];
  const w=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  for(let n=w.nextNode();n;n=w.nextNode()){
    if(n.nodeType===3){
      if(!n.nodeValue.trim())continue;
      // INVARIANT: edits keep the surrounding whitespace so the markup's layout doesn't shift.
      const m=n.nodeValue.match(/^(\s*)([\s\S]*?)(\s*)$/),p=n.parentElement;
      slots.push({node:n,label:p?partName(p,root):'Text',value:m[2],set:v=>{n.nodeValue=m[1]+v+m[3]}});
    }else for(const a of TEXT_ATTRS)if(n.hasAttribute(a))slots.push({node:n,attr:a,label:`${partName(n,root)} · ${a}`,value:n.getAttribute(a),set:v=>n.setAttribute(a,v)});
  }
  return{tpl,root,slots};
}
function numberSame(slots){const n={},k={};for(const s of slots)n[s.label]=(n[s.label]||0)+1;for(const s of slots){const b=s.label;if(n[b]>1){const i=b.lastIndexOf(' · '),x=k[b]=(k[b]||0)+1;s.label=i<0?`${b} ${x}`:`${b.slice(0,i)} ${x}${b.slice(i)}`}}}
// RULE: a stylesheet printing attr(data-x) in content: is offering a text slot.
function cssAttrSlots(el){
  const f=fileById(el.fileId);if(!f)return[];
  if(!f.attrRules||!f.attrRules.length)return[];
  const t=makeTree(el),nodes=[t.target,...t.target.querySelectorAll('*')],out=[],seen=new Set();
  for(const {sel,names} of f.attrRules)for(const s of splitSel(sel)){
    if(!/::?(before|after|marker)\b/i.test(s))continue;
    const q=s.replace(PSEUDO,'').trim()||'*';let hits;try{hits=nodes.filter(n=>n.matches(q))}catch(e){continue}
    for(const n of hits)for(const a of names){const key=nodes.indexOf(n)+'|'+a;if(seen.has(key))continue;seen.add(key);
      const path=[];for(let x=n;x!==t.target;x=x.parentNode)path.unshift([...x.parentNode.childNodes].indexOf(x));
      out.push({attr:a,path,via:showSel(s)})}
  }
  return out;
}

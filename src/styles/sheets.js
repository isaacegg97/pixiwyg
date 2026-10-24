// SECTION: stylesheet files
function compileFile(f){
  let imports=0;
  const text=f.text.replace(/@import[^;]*;/g,()=>{imports++;return''});
  const sh=new CSSStyleSheet();f.error='';
  try{sh.replaceSync(text)}catch(e){f.error=e.message}
  const fonts=[],sels=new Map(),attrRules=[];
  const walk=rules=>{for(const r of rules){
    if(r instanceof CSSStyleRule){
      const ns=rewriteSel(r.selectorText);if(ns!==r.selectorText){try{r.selectorText=ns}catch(e){}}
      const ct=r.style.getPropertyValue('content');if(ct&&/attr\(/i.test(ct))attrRules.push({sel:r.selectorText,names:[...ct.matchAll(/attr\(\s*([\w-]+)/gi)].map(m=>m[1].toLowerCase())});
      for(const s of splitSel(r.selectorText)){const c=cleanSel(s);if(c&&!sels.has(c)){const ch=parseChain(c);if(ch)sels.set(c,ch)}}
    }else if(r instanceof CSSFontFaceRule)fonts.push(r.cssText);
    else if(r.cssRules)walk(r.cssRules);
  }};
  walk(sh.cssRules);
  f.sheet=sh;f.fonts=fonts.join('\n');f.imports=imports;f.sels=[...sels];f.attrRules=attrRules;
}
function addFile(name,text,sample){const f={id:nid('f'),name,text,sample:!!sample,enabled:true};compileFile(f);state.files.push(f);return f}
const fileById=id=>state.files.find(f=>f.id===id&&f.enabled)||null;
function refreshFonts(){$('#fontfaces').textContent=state.files.filter(f=>f.enabled).map(f=>f.fonts).join('\n')}

// HACK: class-only selectors (.nes-btn, .window) name no tag; the element is guessed from the class name.
const HINTS=[
  [/textarea/i,'textarea'],[/select|dropdown|combobox/i,'select'],
  [/btn|button/i,'button'],
  [/input|form-control|text-?field|textbox|checkbox|radio|range|slider|searchbox/i,'input'],
  [/table/i,'table'],[/blockquote|quote/i,'blockquote'],
  [/breadcrumb|navbar|\bnav|menubar|tabs?\b/i,'nav'],
  [/(^|[-_ ])(list|menu|tree-?view)([-_ ]|$)/i,'ul'],
  [/badge|chip|pill|tag\b|kbd|label\b/i,'span'],
  [/link/i,'a'],[/(^|[-_ ])(avatar|img|image|thumbnail)([-_ ]|$)/i,'img'],
  [/(^|[-_ ])(hr|divider|separator)([-_ ]|$)/i,'hr'],
  [/(^|[-_ ])(pre|codeblock|code-block|highlight)([-_ ]|$)/i,'pre'],
  [/(^|[-_ ])(code|terminal-code)([-_ ]|$)/i,'code'],
  [/card|window|panel|container|box|dialog|modal|alert|balloon|notice|frame|toast|callout|well|jumbotron|hero|progress|field-?set|group/i,'div'],
];
function hintTag(L){if(L._hint!==undefined)return L._hint;const n=L.classes.join(' ');L._hint=null;for(const [re,t] of HINTS)if(re.test(n)){L._hint=t;break}return L._hint}
function candidates(tag){
  const out=[];
  for(const f of state.files){if(!f.enabled||f.gen)continue;
    const exact=[],hinted=[],gen=[];
    for(const [sel,chain] of f.sels){
      const L=chain[chain.length-1];
      if(L.classes.includes('__html')||L.classes.includes('__body'))continue;
      if(L.tag===tag){if(sel!==tag)exact.push(sel)}
      else if((!L.tag||L.tag==='*')&&(L.classes.length||L.id)){if(hintTag(L)===tag)hinted.push(sel);else gen.push(sel)}
    }
    exact.push(...hinted);
    out.push({file:f,exact:[tag,...exact],gen});
  }
  return out;
}
function nextStyleFor(tag){const n=state.nextStyle[tag];if(n&&(n.fileId===null||fileById(n.fileId)))return n;const f=state.files.find(f=>f.enabled);return{fileId:f?f.id:null,selector:f?tag:null}}


// SECTION: markdown import
const MD_EXT=new Set(['md','markdown','mdown','mkd']);
const mdOpt={sheet:lsGetEarly('pixiwyg.md.sheet',''),width:+lsGetEarly('pixiwyg.md.width','640')||640};
function lsGetEarly(k,d){try{return localStorage.getItem(k)??d}catch(e){return d}}
function mdUrl(u,path){if(/^data:/i.test(u)||isRemote(u))return u;return findAsset(path||'',u)||u}
function mdInline(s,path){
  const codes=[];s=s.replace(/`([^`\n]+)`/g,(m,c)=>{codes.push(c);return`\u0000${codes.length-1}\u0000`});
  s=escH(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g,(m,a,u)=>`<img alt="${a}" src="${escH(mdUrl(u.replace(/&amp;/g,'&'),path))}">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g,(m,t,u)=>`<a href="${u}">${t}</a>`)
    .replace(/&lt;(https?:\/\/[^&\s]+)&gt;/g,'<a href="$1">$1</a>')
    .replace(/\*\*(?=\S)([^*]+?)\*\*|__(?=\S)([^_]+?)__/g,(m,a,b)=>`<strong>${a??b}</strong>`)
    .replace(/(^|[^*\w])\*(?=\S)([^*\n]+?)\*(?!\*)|(^|[^_\w])_(?=\S)([^_\n]+?)_(?!\w)/g,(m,p1,a,p2,b)=>`${p1??p2??''}<em>${a??b}</em>`)
    .replace(/~~([^~]+)~~/g,'<del>$1</del>')
    .replace(/ {2,}\n|\\\n/g,'<br>').replace(/\n/g,' ');
  return s.replace(/\u0000(\d+)\u0000/g,(m,i)=>`<code>${escH(codes[+i])}</code>`);
}
function parseMarkdown(src,path){
  const L=src.replace(/\r\n?/g,'\n').replace(/^---\n[\s\S]*?\n---\n/,'').split('\n'),out=[];let i=0;
  const blank=l=>!l.trim(),inl=t=>mdInline(t,path);
  const startsBlock=l=>/^\s{0,3}(#{1,6}\s|>|```|~~~|([-*+]|\d+[.)])\s)/.test(l)||/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l);
  while(i<L.length){
    const l=L[i];let m;
    if(blank(l)){i++;continue}
    if((m=l.match(/^\s{0,3}(`{3,}|~{3,})/))){const fence=m[1],buf=[];i++;while(i<L.length&&!L[i].trim().startsWith(fence)){buf.push(L[i]);i++}i++;out.push({tag:'pre',text:buf.join('\n')});continue}
    if((m=l.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/))){const n=m[1].length;out.push({tag:n===1?'h1':n===2?'h2':'h3',html:inl(m[2])});i++;continue}
    if(/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l)){out.push({tag:'hr'});i++;continue}
    if(/^\s{0,3}>/.test(l)){const buf=[];while(i<L.length&&!blank(L[i])){buf.push(L[i].replace(/^\s{0,3}>\s?/,''));i++}out.push({tag:'blockquote',html:inl(buf.join('\n'))});continue}
    if((m=l.match(/^\s*([-*+]|\d+[.)])\s+/))){
      const ordered=/\d/.test(m[1]),items=[];
      while(i<L.length){const t=L[i],mm=t.match(/^\s*([-*+]|\d+[.)])\s+(.*)$/);
        if(mm&&/\d/.test(mm[1])!==ordered)break; // RULE: switching between - and 1. starts a new list (CommonMark).
        if(mm){items.push(mm[2]);i++}
        else if(!blank(t)&&items.length&&/^\s+\S/.test(t)){items[items.length-1]+='\n'+t.trim();i++}
        else if(blank(t)&&i+1<L.length&&(()=>{const n=L[i+1].match(/^\s*([-*+]|\d+[.)])\s+/);return n&&/\d/.test(n[1])===ordered})()){i++}
        else break}
      out.push({tag:ordered?'ol':'ul',html:items.map(x=>`<li>${inl(x.replace(/^\[ \]\s*/,'☐ ').replace(/^\[[xX]\]\s*/,'☑ '))}</li>`).join('')});continue}
    if(l.includes('|')&&i+1<L.length&&/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(L[i+1])){
      const row=t=>t.trim().replace(/^\||\|$/g,'').split('|').map(c=>inl(c.trim()));
      const head=row(l);i+=2;const body=[];while(i<L.length&&L[i].includes('|')&&!blank(L[i])){body.push(row(L[i]));i++}
      out.push({tag:'table',html:`<thead><tr>${head.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${body.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`});continue}
    if((m=l.match(/^\s*!\[([^\]]*)\]\(([^)\s]+)[^)]*\)\s*$/))){out.push({tag:'img',src:mdUrl(m[2],path),alt:m[1]});i++;continue}
    if(/^\s{0,3}<[a-zA-Z!\/]/.test(l)){const buf=[];while(i<L.length&&!blank(L[i])){buf.push(L[i]);i++}out.push({tag:'div',html:buf.join('\n')});continue}
    const buf=[l];i++;
    while(i<L.length&&!blank(L[i])&&!startsBlock(L[i])){if(/^\s{0,3}=+\s*$/.test(L[i]))break;buf.push(L[i]);i++}
    if(i<L.length&&/^\s{0,3}(=+|-+)\s*$/.test(L[i])){out.push({tag:L[i].trim()[0]==='='?'h1':'h2',html:inl(buf.join('\n'))});i++;continue}
    out.push({tag:'p',html:inl(buf.join('\n'))});
  }
  return out;
}
// RULE: the simplest component class a sheet offers for a tag (.nes-btn, .window, .card), else the bare tag.
function bestStyleIn(f,tag){
  const g=candidates(tag).find(x=>x.file===f);if(!g)return{fileId:f.id,selector:tag};
  const comp=g.exact.filter(x=>x!==tag&&!/[\s\[>+~:]/.test(x)&&(()=>{const ch=parseChain(x),L=ch&&ch[ch.length-1];return L&&!L.tag&&hintTag(L)===tag})()).sort((a,b)=>a.length-b.length);
  return{fileId:f.id,selector:comp[0]||tag};
}
function importMarkdown(src,{at,path,sheet,width,replace}={}){
  const blocks=parseMarkdown(src,path);if(!blocks.length){status('No Markdown blocks found');return 0}
  pushUndo();
  if(replace){state.els=[];state.sel=null}
  width=Math.max(160,Math.min(W-32,+width||640));
  const f=sheet?state.files.find(x=>x.id===sheet&&x.enabled):null;
  const r=stage.getBoundingClientRect();
  let x0=at?Math.round(at.x):Math.max(16,Math.round((W-width)/2)),y0=at?Math.round(at.y):Math.max(16,Math.round(-r.top/Z+72));
  if(isFixed()&&!at){const cr=contentRect(pageInView());x0=cr.x;y0=cr.y;width=Math.min(width,cr.w)}
  let z=maxZ();const made=[];
  for(const b of blocks){
    const st=f?bestStyleIn(f,b.tag):nextStyleFor(b.tag);
    const el={id:nid('e'),tag:b.tag,fileId:st.fileId,selector:st.selector,x:x0,y:y0,w:width,z:++z};
    if(b.tag==='img'){el.content=okImg(b.src)||/^https?:/i.test(b.src)?b.src:IMG_PH;el.attrs={alt:b.alt};el.w=null}
    else if(b.tag==='pre')el.content=escH(b.text);
    else if(b.tag!=='hr')el.content=cleanHTML(b.html);
    state.els.push(el);made.push(el);
  }
  renderAll();
  flowColumn(made,x0,y0,width,mdOpt.gap||afOpt.gap);
  select(null);renderPalette();renderStyles();save();sfx('boing');
  return blocks.length;
}


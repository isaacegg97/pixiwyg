// SECTION: magnet links (stub; no spec yet)
// TODO: decide the metadata key that picks "link" vs "download". Candidates: an x.pxmode=link|download parameter in
//   the magnet URI itself, or a data-px-magnet attribute on the element. Until then every magnet renders as a plain
//   link, which is what the export already does: unsafeAttr only refuses javascript:/vbscript:/data:html.
// TODO: the scriptlet. The editor and live preview can resolve metadata themselves; the exported page needs a small
//   runtime appended beside pxRuntime (same CSP rule: it ships inside the export's one script, never as an inline
//   handler), that finds a[href^="magnet:"], parses it with the same parseMagnet, and swaps in name/size/download UI.
//   Skipped when expOpt.nojs is set, so a script-free export keeps the bare link.
// TODO: "resolving metadata" beyond what the URI carries (dn, xl) means a tracker/DHT/webseed fetch. connect-src is
//   'self' data: blob:, so that is a CSP decision for later; the stub resolves from the URI only.
// FORMAT: BEP 9 / magnet URI scheme. Repeated keys (xt, tr, ws, as, xs) collect into arrays; numbered forms
//   (xt.1, tr.2) fold into the same arrays. Unknown x.* keys land in ext.
const MAGNET_LIST=new Set(['xt','tr','ws','as','xs','so']);
function parseMagnet(uri){
  const s=String(uri||'').trim();if(!/^magnet:\?/i.test(s)||s.length>16384)return null;
  const out={xt:[],tr:[],ws:[],as:[],xs:[],so:[],dn:'',xl:null,kt:[],mt:'',ext:{},hashes:[]};
  for(const part of s.slice(8).split('&')){
    if(!part)continue;const i=part.indexOf('=');if(i<1)continue;
    let k=part.slice(0,i).toLowerCase(),v;
    try{v=decodeURIComponent(part.slice(i+1).replace(/\+/g,' '))}catch(e){continue}
    k=k.replace(/\.\d+$/,'');
    if(MAGNET_LIST.has(k))out[k].push(v);
    else if(k==='dn')out.dn=v.slice(0,500);
    else if(k==='xl'){const n=+v;if(Number.isSafeInteger(n)&&n>=0)out.xl=n}
    else if(k==='kt')out.kt=v.split(/[\s+]+/).filter(Boolean).slice(0,32);
    else if(k==='mt')out.mt=v;
    else if(k.startsWith('x.'))out.ext[k.slice(2)]=v;
  }
  for(const x of out.xt){const m=/^urn:(btih|btmh|sha1|ed2k|aich|kzhash|md5|tree:tiger):(.+)$/i.exec(x);if(m)out.hashes.push({type:m[1].toLowerCase(),value:m[2]})}
  return out.xt.length||out.dn||out.ws.length?out:null;
}
// TODO: replace with the real rule once the metadata key is chosen; 'link' keeps today's behaviour.
function magnetMode(meta){return meta&&meta.ext&&meta.ext.pxmode==='download'?'download':'link'}


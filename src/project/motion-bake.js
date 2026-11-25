// SECTION: motion baking: an export's CSS-animated SVG images become APNG
// RULE: an animated SVG re-renders whole, filters and all, on every frame it plays, and only browsers play it. Baked,
//   it is decoded once and plays in any browser or image viewer. The editor keeps the SVG; only exports are baked.
// COMPAT: the APNG is 2x and named through image-set(url() 2x) so it keeps the SVG's size (Chrome 113+, Firefox 89+,
//   Safari 17+). A baked image no longer follows the visitor's reduce-motion setting.
const BAKE_FPS=24,BAKE_MAX_S=12,BAKE_SLACK=.03,BAKE_MAX_BYTES=6<<20,BAKE_MAX_PX=1024;
const bakeCache=new Map();
const ANIM_PROP=/^animation(-(duration|delay|iteration-count|direction))?$/;
const isTime=t=>/^[+-]?(\d*\.)?\d+m?s$/i.test(t);
const secs=t=>/ms$/i.test(t)?parseFloat(t)/1000:parseFloat(t);
// FORMAT: splits on sep at paren depth 0, so cubic-bezier(a,b,c,d) and steps(n,end) stay whole.
function splitTop(s,sep){const out=[];let d=0,cur='';for(const ch of s){if(ch==='(')d++;else if(ch===')')d--;if(ch===sep&&!d){out.push(cur);cur=''}else cur+=ch}out.push(cur);return out.map(x=>x.trim()).filter(Boolean)}
// FORMAT: one declaration block's animations as layers [{dur, delay, cycle}]; cycle is null when not infinite.
function blockAnims(decls){
  let L=null;const set=(k,vals)=>{if(!L)L=vals.map(()=>({dur:0,delay:0,inf:false,alt:false}));L.forEach((a,i)=>{a[k]=vals[i%vals.length]})};
  for(const [p,v] of decls){
    const items=splitTop(v.replace(/!important/i,''),',');
    if(p==='animation'){L=items.map(it=>{const tk=splitTop(it,' '),tm=tk.filter(isTime).map(secs);
      return{dur:tm[0]||0,delay:tm[1]||0,inf:tk.includes('infinite'),alt:tk.some(x=>/^alternate/.test(x))}})}
    else if(p==='animation-duration')set('dur',items.map(secs));
    else if(p==='animation-delay')set('delay',items.map(secs));
    else if(p==='animation-iteration-count')set('inf',items.map(x=>x==='infinite'));
    else if(p==='animation-direction')set('alt',items.map(x=>/^alternate/.test(x)));
  }
  // RULE: animation:none and zero-length animations draw nothing over time, so they are not part of the loop.
  return(L||[]).filter(a=>a.dur>0).map(a=>({dur:a.dur,delay:a.delay,cycle:a.inf?a.dur*(a.alt?2:1):null}));
}
// FORMAT: every declaration block of the SVG that animates: {at, len, anims}, from <style> rules and style="" attributes.
function svgBlocks(svg){
  const out=[],scan=(text,base)=>{
    for(const m of text.matchAll(/\{([^{}]*)\}/g)){const decls=splitTop(m[1],';').map(d=>{const i=d.indexOf(':');return[d.slice(0,i).trim().toLowerCase(),d.slice(i+1).trim()]}).filter(([p])=>ANIM_PROP.test(p));
      const anims=decls.length&&blockAnims(decls);if(anims&&anims.length)out.push({at:base+m.index+1,len:m[1].length,anims})}};
  for(const m of svg.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))scan(m[1],m.index+m[0].indexOf('>')+1);
  for(const m of svg.matchAll(/\sstyle=(["'])(.*?)\1/gi)){const at=m.index+m[0].indexOf(m[1])+1;
    const decls=splitTop(m[2],';').map(d=>{const i=d.indexOf(':');return[d.slice(0,i).trim().toLowerCase(),d.slice(i+1).trim()]}).filter(([p])=>ANIM_PROP.test(p));
    const anims=decls.length&&blockAnims(decls);if(anims&&anims.length)out.push({at,len:m[2].length,anims})}
  return out.sort((a,b)=>a.at-b.at);
}
// RULE: the loop is the shortest one every animation fits a whole number of times, within BAKE_SLACK of its own speed;
//   each animation is retimed onto it, which nobody sees at 3%. null when there is none under BAKE_MAX_S.
function bakeLoop(cycles){
  const top=Math.max(...cycles);
  for(let k=1;k*top<=BAKE_MAX_S;k++){const P=k*top;if(cycles.every(c=>{const n=Math.round(P/c);return n>0&&Math.abs(P/c-n)/n<=BAKE_SLACK}))return P}
  return null;
}
// HACK: an SVG used as an image can't be seeked, but a paused animation shows the time its delay names: each frame is
//   the same SVG with every animation paused at that frame's moment. Reduce-motion queries are switched off, since the
//   frames must move whatever this browser is set to.
function svgFrame(svg,blocks,P,t){
  let out='',o=0;
  for(const b of blocks){
    const fit=b.anims.map(a=>{const n=Math.max(1,Math.round(P/a.cycle)),d=a.dur*(P/n)/a.cycle;return{d,delay:(a.dur?a.delay*d/a.dur:a.delay)-t}});
    const add=`;animation-duration:${fit.map(f=>f.d.toFixed(4)+'s').join(',')}!important;animation-delay:${fit.map(f=>f.delay.toFixed(4)+'s').join(',')}!important;animation-play-state:paused!important`;
    out+=svg.slice(o,b.at+b.len)+add;o=b.at+b.len;
  }
  return(out+svg.slice(o)).replace(/\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/gi,'(max-width:-1px)');
}
function svgText(url){
  const i=url.indexOf(',');if(i<0)return null;const head=url.slice(0,i),body=url.slice(i+1);
  try{return/;base64/i.test(head)?new TextDecoder().decode(b64bytes(body)):decodeURIComponent(body)}catch(e){return null}
}
function svgSize(svg){
  const tag=(svg.match(/<svg\b[^>]*>/i)||[''])[0],num=k=>{const m=tag.match(new RegExp(`\\s${k}=["']\\s*([\\d.]+)(px)?\\s*["']`));return m?+m[1]:0};
  let w=num('width'),h=num('height');
  if(!w||!h){const v=tag.match(/viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);if(v){w=w||+v[1];h=h||+v[2]}}
  return w&&h?{w,h}:null;
}
// FORMAT: bakeSVG(data URL) -> PNG data URL (APNG when it moves) at 2x, or null when it can't or shouldn't be baked.
// INVARIANT: only SVGs whose animations are all CSS and all infinite: SMIL can't be paused from outside, and an
//   animation that ends has no loop.
function bakeSVG(url){
  if(bakeCache.has(url))return bakeCache.get(url);
  const p=(async()=>{
    const svg=svgText(url);if(!svg||!/@keyframes|animation/i.test(svg)||/<(animate|animateTransform|animateMotion|set)\b/i.test(svg))return null;
    const blocks=svgBlocks(svg),anims=blocks.flatMap(b=>b.anims),sz=svgSize(svg);
    if(!anims.length||!sz||anims.some(a=>!a.cycle))return null;
    const P=bakeLoop(anims.map(a=>a.cycle));if(!P)return null;
    const N=Math.max(2,Math.round(P*BAKE_FPS)),W=Math.min(BAKE_MAX_PX,Math.round(sz.w*2)),H=Math.min(BAKE_MAX_PX,Math.round(sz.h*2));
    const c=imgCanvas(W,H),g=c.getContext('2d',{willReadFrequently:true}),frames=[];
    for(let k=0;k<N;k++){
      const img=await loadImg('data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgFrame(svg,blocks,P,k*P/N)));if(!img)return null;
      g.clearRect(0,0,W,H);g.drawImage(img,0,0,W,H);frames.push(g.getImageData(0,0,W,H).data);
    }
    if(frames.every(f=>f.every((v,i)=>v===frames[0][i])))return c.toDataURL('image/png');
    const out=await indexedAPNG(frames,W,H,N/P);
    return out.length*.75>BAKE_MAX_BYTES?null:out;
  })().catch(()=>null);
  bakeCache.set(url,p);return p;
}
// FORMAT: an 8-bit indexed APNG: one palette for every frame (APNG allows no other), with alpha per entry in tRNS so
//   glows keep soft edges, which GIF's one-bit transparency can't. Each frame after the first is the box that changed.
// PERF: a quarter of the bytes of RGBA frames, smooth gradients included, before deflate.
async function indexedAPNG(frames,W,H,fps){
  await needGifenc();
  const n=W*H,step=Math.max(1,Math.ceil(frames.length*n/400000)),sample=new Uint8Array(Math.ceil(n/step)*4*frames.length);let o=0;
  for(const f of frames)for(let i=0;i<n;i+=step){sample.set(f.subarray(i*4,i*4+4),o);o+=4}
  // HACK: the palette is matched at 4 bits a channel, which bands soft glows; a fixed 4x4 Bayer offset of up to one
  //   step trades the bands for a fine grain, the same in every frame so nothing shimmers and still areas stay still.
  const B=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  for(const f of frames)for(let y=0;y<H;y++)for(let x=0;x<W;x++){const d=(B[(y&3)*4+(x&3)]-7.5)*17/16,i=(y*W+x)*4;f[i]+=d;f[i+1]+=d;f[i+2]+=d;f[i+3]+=d}
  const pal=gifenc.quantize(sample.subarray(0,o),256,{format:'rgba4444'}),idx=frames.map(f=>gifenc.applyPalette(f,pal,'rgba4444'));
  const zlib=async raw=>new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const ihdr=new Uint8Array(13);new DataView(ihdr.buffer).setUint32(0,W);new DataView(ihdr.buffer).setUint32(4,H);ihdr[8]=8;ihdr[9]=3;
  const parts=[new Uint8Array(PNG_SIG),pngChunk('IHDR',ihdr),pngChunk('PLTE',new Uint8Array(pal.flatMap(c=>c.slice(0,3)))),pngChunk('tRNS',new Uint8Array(pal.map(c=>c.length>3?c[3]:255))),pngChunk('acTL',u32be(frames.length,0))];
  let seq=0;
  for(let k=0;k<idx.length;k++){
    const a=idx[k],b=k?idx[k-1]:null;let x0=0,y0=0,x1=W-1,y1=H-1;
    if(b){x0=W;y0=H;x1=-1;y1=-1;for(let y=0;y<H;y++)for(let x=0,r=y*W;x<W;x++)if(a[r+x]!==b[r+x]){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
      if(x1<0){x0=y0=0;x1=y1=0}}
    const w=x1-x0+1,h=y1-y0+1,raw=new Uint8Array((w+1)*h);
    for(let y=0;y<h;y++)raw.set(a.subarray((y0+y)*W+x0,(y0+y)*W+x0+w),y*(w+1)+1);
    const fc=new Uint8Array(26),dv=new DataView(fc.buffer);dv.setUint32(0,seq++);dv.setUint32(4,w);dv.setUint32(8,h);dv.setUint32(12,x0);dv.setUint32(16,y0);dv.setUint16(20,1);dv.setUint16(22,Math.round(fps));
    parts.push(pngChunk('fcTL',fc));const z=await zlib(raw);
    if(!k)parts.push(pngChunk('IDAT',z));else{const d=new Uint8Array(4+z.length);new DataView(d.buffer).setUint32(0,seq++);d.set(z,4);parts.push(pngChunk('fdAT',d))}
  }
  parts.push(pngChunk('IEND',new Uint8Array(0)));
  const all=new Uint8Array(parts.reduce((t,q)=>t+q.length,0));o=0;for(const q of parts){all.set(q,o);o+=q.length}
  return'data:image/png;base64,'+bytesB64(all);
}
// RULE: only url() in CSS is swapped, where image-set() can keep the size; the SVG stays wherever else it appears.
async function bakeMotion(html){
  const re=/url\(\s*(?:"(data:image\/svg\+xml[^"]*)"|'(data:image\/svg\+xml[^']*)')\s*\)/gi,found=new Map();
  for(const m of html.matchAll(re)){const u=m[1]||m[2];if(!found.has(u)&&/keyframes|animation/i.test(svgText(u)||''))found.set(u,null)}
  if(!found.size)return html;
  for(const u of found.keys())found.set(u,await bakeSVG(u));
  return html.replace(re,(m,a,b)=>{const png=found.get(a||b);return png?`image-set(url("${png}") 2x)`:m});
}

// SECTION: seed
async function seed(){
  const ids={};for(const [n,t] of Object.entries(SAMPLES))ids[n]=addFile(n,t,true).id;
  let N=null,W98=null;
  try{N=(await addLib('nes.css'))?.id;W98=(await addLib('98.css'))?.id;await addLib('system.css')}catch(e){status('Could not load the library stylesheets')}
  const R=ids['riso-zine.css'],P=ids['phosphor.css'],B=ids['bubblegum-os.css'];
  const ox=Math.max(16,Math.round((W-960)/2)),oy=24;
  let z=1;const E=(tag,fileId,selector,x,y,w,content)=>state.els.push({id:nid('e'),tag,fileId,selector,x:x+ox,y:y+oy,w,z:z++,...(content!=null?{content}:{})});
  E('h1',R,'h1.outline',48,40,520,'Zine fair saturday');
  E('p',R,'p.lead',52,168,370,'Tables, staplers, and one photocopier that only prints in pink. Bring something you made.');
  E('span',R,'.sticker',446,176,null,'FREE!');
  E('div',P,'.panel',600,44,312,'&gt; RSVP.EXE<br>Bring your own stylesheets. Every look on this page came from a CSS file in the sidebar.');
  E('label',B,'label',602,226,null,'Your name');
  E('input',B,'input',600,250,312);
  E('button',B,'.gel',600,308,null,'Count me in');
  E('blockquote',P,'blockquote',52,300,360,'Paint under it. Style on top of it.');
  E('ul',R,'ul.checks',56,392,300,'<li>Riso prints</li><li>Mixtapes</li><li>Hand-cut stickers</li>');
  E('table',B,'table',600,380,null,'<thead><tr><th>Table</th><th>Who</th></tr></thead><tbody><tr><td>A1</td><td>Comics</td></tr><tr><td>A2</td><td>Synth zines</td></tr></tbody>');
  if(N)E('button',N,'.nes-btn.is-primary',440,330,null,'Press start');
  if(W98)E('div',W98,'.window',380,410,210,'<div class="title-bar"><div class="title-bar-text">Guestbook.exe</div><div class="title-bar-controls"><button aria-label="Minimize"></button><button aria-label="Close"></button></div></div><div class="window-body"><p style="margin:0">Sign below. Be nice.</p></div>');
  state.nextStyle={h1:{fileId:R,selector:'h1'},button:{fileId:B,selector:'.gel'},div:{fileId:R,selector:'.card'}};
  const art=document.createElement('canvas');art.width=W;art.height=H;
  withCtx(art.getContext('2d'),()=>drawSeedArt(ox,oy));
  state.bgd={base:{c:'#ffffff',role:0},layers:[{id:nid('l'),type:'image',src:art.toDataURL(),w:W,h:H,fit:'once',pos:'left top',scale:100}]};
  state._seedArt=art;
}


// SECTION: GIF export
// RULE: every frame goes out at the studio's speed; each gets its own 256-colour palette with 1-bit transparency.
async function saveGif(){
  await needGifenc();if(studio.frames.length>1){saveFrame();await freshFlats()}
  const urls=studio.frames.length>1?studio.frames.map(f=>f.url||blankFrame()):[flatURL()];
  const enc=gifenc.GIFEncoder(),w=paint.width,h=paint.height,c=imgCanvas(w,h),g=c.getContext('2d',{willReadFrequently:true});
  for(const u of urls){
    const img=new Image();img.src=u;await img.decode();g.clearRect(0,0,w,h);g.drawImage(img,0,0,w,h);
    const d=g.getImageData(0,0,w,h).data,pal=gifenc.quantize(d,256,{format:'rgba4444',oneBitAlpha:true}),idx=gifenc.applyPalette(d,pal,'rgba4444');
    const ti=pal.findIndex(p=>p[3]===0);
    enc.writeFrame(idx,w,h,{palette:pal,delay:Math.round(1000/studio.fps),transparent:ti>=0,transparentIndex:Math.max(0,ti),dispose:2});
  }
  enc.finish();const name=slug((state.project&&state.project.name)||'drawing')+'.gif';
  download(new Blob([enc.bytes()],{type:'image/gif'}),name);status(`Saved ${name}${urls.length>1?` (${urls.length} frames)`:''}`);sfx('boing');
}

// SECTION: wiring
$('#sFx').onclick=()=>{audio();if($('#fxPanel').hidden)openFx();else closeFx(false)};
$('#fxApply').onclick=()=>{audio();closeFx(true)};
$('#fxCancel').onclick=$('#fxClose').onclick=()=>{audio();closeFx(false)};
$('#sSaveGif').onclick=()=>{audio();saveGif().catch(e=>status(e.message))};
$('#selCrop').onclick=()=>{audio();selCrop()};$('#selClear').onclick=()=>{audio();selClear()};$('#selNone').onclick=()=>{audio();selNone()};
$('#sFlipH').onclick=()=>{audio();flipCanvas(true)};$('#sFlipV').onclick=()=>{audio();flipCanvas(false)};
$('#sRotL').onclick=()=>{audio();rotate90(false)};$('#sRotR').onclick=()=>{audio();rotate90(true)};
$('#sHalf').onclick=()=>{audio();scaleBy(.5)};$('#sDouble').onclick=()=>{audio();scaleBy(2)};
for(const id of ['sFlipH','sFlipV','sRotL','sRotR','sHalf','sDouble'])$('#'+id).addEventListener('click',()=>{$('#sXform').open=false});
for(const id of ['sSaveFile','sSaveGif'])$('#'+id).addEventListener('click',()=>{$('#sSaveMenu').open=false});
{const sel=$('#sBlend');for(const [v,t] of BLENDS)sel.append(mkEl('option',{value:v,textContent:t}));sel.onchange=()=>{state.blend=sel.value}}
$('#sOpacity').oninput=()=>{state.opacity=+$('#sOpacity').value/100;$('#sOpacityVal').textContent=$('#sOpacity').value+'%'};


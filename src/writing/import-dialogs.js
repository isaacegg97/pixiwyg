// SECTION: import / autoformat dialogs
function sheetOptions(sel,firstLabel,value){
  sel.replaceChildren();const o=document.createElement('option');o.value='';o.textContent=firstLabel;sel.append(o);
  for(const f of state.files.filter(f=>f.enabled)){const x=document.createElement('option');x.value=f.id;x.textContent=f.name;sel.append(x)}
  sel.value=[...sel.options].some(o=>o.value===value)?value:'';
}
function mdPreviewCount(){
  const b=parseMarkdown($('#mdText').value),c={};for(const x of b)c[x.tag]=(c[x.tag]||0)+1;
  const name={h1:'heading',h2:'heading',h3:'heading',p:'paragraph',ul:'list',ol:'list',blockquote:'quote',pre:'code block',table:'table',hr:'rule',img:'image',div:'HTML block'};
  const t={};for(const [k,v] of Object.entries(c))t[name[k]]=(t[name[k]]||0)+v;
  $('#mdCount').textContent=b.length?`${b.length} block${b.length>1?'s':''}: `+Object.entries(t).map(([k,v])=>`${v} ${k}${v>1?'s':''}`).join(', '):'';
}
function openMd(text){
  sheetOptions($('#mdSheet'),'each type’s current pick',mdOpt.sheet);$('#mdWidth').value=mdOpt.width;$('#mdReplace').checked=false;
  if(text!=null)$('#mdText').value=text;mdPreviewCount();$('#mdModal').hidden=false;$('#mdText').focus();
}
$('#mdBtn').onclick=()=>{audio();sfx('blip');openMd()};
$('#mdClose').onclick=()=>{$('#mdModal').hidden=true};
$('#mdText').addEventListener('input',mdPreviewCount);
$('#mdFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(f){$('#mdText').value=await f.text();mdPreviewCount()}};
$('#mdGo').onclick=()=>{
  mdOpt.sheet=$('#mdSheet').value;mdOpt.width=+$('#mdWidth').value||640;lsSet('pixiwyg.md.sheet',mdOpt.sheet);lsSet('pixiwyg.md.width',mdOpt.width);
  const n=importMarkdown($('#mdText').value,{sheet:mdOpt.sheet,width:mdOpt.width,replace:$('#mdReplace').checked});
  if(n){$('#mdModal').hidden=true;status(`Imported ${n} block${n===1?'':'s'}. Autoformat (${M}+Shift+L) tidies them with the rest of the page.`)}
};
$('#mdDocGo').onclick=async()=>{const t=$('#mdText').value;if(!t.trim())return;$('#mdModal').hidden=true;await addManuscript('Manuscript '+(state.docs.length+1),t)};
$('#mdModal').addEventListener('click',e=>{if(e.target.id==='mdModal')$('#mdModal').hidden=true});
function afFields(){return{layout:(document.querySelector('input[name=afLayout]:checked')||{}).value||'column',width:Math.max(160,+$('#afWidth').value||640),gap:Math.max(0,+$('#afGap').value||0)}}
function afSetFields(o){for(const r of document.querySelectorAll('input[name=afLayout]'))r.checked=r.value===o.layout;$('#afWidth').value=o.width;$('#afGap').value=o.gap;afMark()}
function afMark(){const f=afFields();for(const b of $('#afPresets').children){const p=AF_PRESETS.find(x=>x.id===b.dataset.id);b.setAttribute('aria-pressed',p.layout===f.layout&&p.gap===f.gap&&(p.layout==='tidy'||p.width===f.width))}
  // RULE: on pages, text follows the page margins, not a width.
  $('#afWidth').disabled=f.layout==='tidy'||isFixed()}
for(const p of AF_PRESETS){const b=document.createElement('button');b.type='button';b.className='pal';b.dataset.id=p.id;b.innerHTML='<b></b><i></i>';b.querySelector('b').textContent=p.name;b.querySelector('i').textContent=p.note;
  b.onclick=()=>{audio();sfx('click');afSetFields(p)};$('#afPresets').append(b)}
$('#afModal').addEventListener('input',e=>{if(e.target.closest('#afWidth,#afGap,input[name=afLayout]'))afMark()});
$('#afModal').addEventListener('change',e=>{if(e.target.name==='afLayout')afMark()});
function openAf(){
  sheetOptions($('#afSheet'),'keep each element’s style',afOpt.sheet);
  afSetFields(afOpt);$('#afModal').hidden=false;$('#afGo').focus();
}
$('#afBtn').onclick=()=>{audio();sfx('blip');openAf()};
$('#afClose').onclick=()=>{$('#afModal').hidden=true};
$('#afModal').addEventListener('click',e=>{if(e.target.id==='afModal')$('#afModal').hidden=true});
$('#afGo').onclick=()=>{
  Object.assign(afOpt,afFields());afOpt.sheet=$('#afSheet').value;
  lsSet('pixiwyg.af.layout',afOpt.layout);lsSet('pixiwyg.af.width',afOpt.width);lsSet('pixiwyg.af.gap',afOpt.gap);
  $('#afModal').hidden=true;autoformat(afOpt);
};
document.addEventListener('paste',e=>{
  // FIX: text pasted while working in the Paint Studio (Linux pastes the selection on a middle click) isn't a manuscript.
  const t=e.target;if(state.editing||(t.closest&&t.closest('input,textarea,select,[contenteditable=true]')))return;
  if(state.ctx==='studio'&&!$('#w-studio').hidden)return;
  if(document.querySelector('.modal:not([hidden])')||!$('#title').hidden)return;
  const text=e.clipboardData&&e.clipboardData.getData('text/plain');if(!text||!text.trim())return;
  e.preventDefault();openMd(text);
});


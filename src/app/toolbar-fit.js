// SECTION: responsive toolbar
// RULE: least important first: decoration and hints hide, then tools move into More ▾ (keeping their handlers), and
//   the Commands button shrinks to its icon. Everything comes back, in its own place, when there is room again.
// FORMAT: [selector, 'hide' | 'move' | 'compact'].
const TB_STEPS=[['#logo','hide'],['#wsHint','hide'],['#liveBtn','move'],['#toolsGroup','move'],['#saveFileBtn','move'],['#filesBtn','move'],['#cmdBtn','compact'],['.topbar>.tgroup:has(#undoBtn)','move'],
  ['#projName','move'],['#wsBtn','compact'],['#projBtn','compact'],['#playBtn','compact'],['#exportBtn','compact'],['#moreMenu>summary','compact']];
const tbHome=new Map();
// FIX: the toolbar must not clip (its menus hang below it), so overflow is measured from where its items end.
const tbOver=bar=>{const edge=bar.getBoundingClientRect().right-(parseFloat(getComputedStyle(bar).paddingRight)||0)+1;return[...bar.children].some(c=>c.offsetParent!==null&&c.getBoundingClientRect().right>edge)};
function fitTopbar(){
  const bar=$('#topbar'),ov=$('#tbOverflow');if(!bar||!ov)return;
  for(const [el,mark] of tbHome){mark.replaceWith(el)}tbHome.clear();
  for(const [sel] of TB_STEPS){const el=bar.querySelector(sel)||document.querySelector(sel);if(el){el.classList.remove('tbhide','tbcompact')}}
  for(const [sel,how] of TB_STEPS){
    if(!tbOver(bar))break;const el=bar.querySelector(sel);if(!el||el.offsetParent===null&&how!=='compact')continue;
    if(how==='hide')el.classList.add('tbhide');else if(how==='compact')el.classList.add('tbcompact');
    else{const mark=document.createComment('tb');el.replaceWith(mark);tbHome.set(el,mark);ov.append(el)}
  }
  ov.hidden=!ov.childElementCount;
}
new ResizeObserver(()=>requestAnimationFrame(fitTopbar)).observe($('#topbar'));
document.fonts.addEventListener('loadingdone',()=>fitTopbar());
setSnap(pref('pixiwyg.snap','1')!=='0');state.showGrid=pref('pixiwyg.showgrid','0')==='1';setGrid(pref('pixiwyg.grid','8'));setShowGrid(state.showGrid);setTheme(pref('pixiwyg.theme','system'));


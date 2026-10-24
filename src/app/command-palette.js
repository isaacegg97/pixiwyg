// SECTION: command palette
// RULE: Command palette provides instant keyboard & mouse access to every primary workflow and tool.
/*
 * Purpose: Quick search and execution of PIXIWYG tools, workspaces, and dialogs.
 * Authors: isaacegg97, antigravity
 * Timestamp: 2026-10-16
 * Footguns: Commands that open modals must close the command palette first to prevent modal stacking.
 * Usage Example: openCmdPalette(); filterCmds('export'); execCmdIdx();
 */
// RULE: CMD_ITEMS is the one list of commands. The palette shows every entry; the XMB (src/xmb/) shows an entry under
//   the category its xmb field names, and an entry with on() as a toggle that shows its state and stays put. An entry
//   with when() is listed only while it returns true; one marked bare is listed with no project open too.
const CMD_ITEMS=[
  {cat:'Workspaces',name:'Page: Lay out the page',hint:'Normal canvas layout',keys:'Alt+1',run:()=>setWorkspace('page')},
  {cat:'Workspaces',name:'Write: Manuscript typesetting',hint:'Set it like a book inside margins',keys:'Alt+2',run:()=>setWorkspace('write')},
  {cat:'Workspaces',name:'Paint: Paint Studio',hint:'Pixel art, stamps, frames & animations',keys:'Alt+3',run:()=>setWorkspace('paint')},
  {cat:'Workspaces',name:'Music: Sequencer',hint:'Sketch songs, MIDI, soundfonts',keys:'Alt+4',run:()=>setWorkspace('music')},
  {cat:'Workspaces',name:'3D: Model to sprite sheet',hint:'Bake a low-poly model into one image of every angle',keys:'Alt+6',run:()=>setWorkspace('model')},
  {cat:'Workspaces',name:'Animate: Timeline',hint:'Multi-track animation timing',keys:'Alt+5',run:()=>setWorkspace('animate')},
  {cat:'Modes',name:'Play / Try the page',xmb:'play',hint:'Run animations and logic live',keys:'Ctrl+Enter',run:()=>setPlay(!playing)},
  {cat:'Modes',name:'Live Preview',xmb:'play',hint:'Open page in updating window',keys:'',run:()=>$('#liveBtn').click()},
  {cat:'Tools',name:'Autoformat layout…',xmb:'page',hint:'Even spacing in reading order',keys:'Ctrl+Shift+L',run:()=>openAf()},
  {cat:'Tools',name:'Import Markdown…',xmb:'write',hint:'Turn markdown blocks into elements',keys:'',run:()=>openMd()},
  {cat:'Tools',name:'Styles node editor…',xmb:'page',hint:'Fills, shapes, outlines, filters',keys:'',run:()=>openStyleEditor()},
  {cat:'Tools',name:'Page logic node editor…',xmb:'page',hint:'Clicks, timers, state variables',keys:'',run:()=>openLogicEditor()},
  {cat:'Output',name:'Export HTML…',xmb:'output',hint:'Self-contained HTML export',keys:'Ctrl+Shift+S',run:()=>openExport()},
  {cat:'Tools',name:'Load style set…',xmb:'page',hint:'Preview stylesheets, then append or replace',keys:'Ctrl+Shift+O',run:()=>openSset()},
  {cat:'Output',name:'Publish site',xmb:'output',hint:'Send the export to the local publish API',keys:'',run:()=>publishSite()},
  {cat:'Project',name:'References: files and folders…',xmb:'project',hint:'Point at files by relative path, without including them',keys:'',run:()=>openRefs()},
  {cat:'Output',name:'Save project file (.pixiwyg)',xmb:'output',hint:'Download project file',keys:'Ctrl+Alt+S',run:()=>downloadProject()},
  {cat:'View & Panels',name:'Toggle side panels',hint:'Show/hide left and right docks',keys:'Ctrl/⌘+\\',run:()=>togglePanels()},
  {cat:'View & Panels',name:'Toggle Add panel (Left)',hint:'Catalog, primitives, sheets',keys:'',run:()=>$('#sideLBtn').click()},
  {cat:'View & Panels',name:'Toggle Properties panel (Right)',hint:'Inspector, palette, background',keys:'',run:()=>$('#sideRBtn').click()},
  {cat:'View & Panels',name:'Toggle Snap',xmb:'page',on:()=>state.snap,hint:'Snap to elements and grid',keys:'Ctrl+Shift+;',run:()=>$('#snapBtn').click()},
  {cat:'View & Panels',name:'Toggle Grid lines',xmb:'page',on:()=>state.showGrid,hint:'Show/hide background grid',keys:"Ctrl+'",run:()=>$('#showGridBtn').click()},
  {cat:'View & Panels',name:'Responsive viewport',hint:'Show a web page inside a viewport boundary, to see how it responds to width',keys:'',xmb:'page',when:()=>!isFixed(),on:()=>respModeOn(),run:()=>setRespMode(!respModeOn())},
  {cat:'View & Panels',name:'Zoom: Actual size (100%)',xmb:'page',hint:'Reset zoom to 100%',keys:'Ctrl+0',run:()=>setZoom(1)},
  {cat:'View & Panels',name:'Zoom: Fit to window',xmb:'page',hint:'Fit pages to visible view',keys:'',run:()=>$('#zFit').click()},
  {cat:'View & Panels',name:'Interface theme: next',hint:'Step to the next theme; Settings shows them all',keys:'Shift+F1/F2',run:()=>{const s=themeStops();setTheme(s[(s.indexOf(theme)+1)%s.length]);status('Theme: '+themeLabel(theme))}},
  {cat:'Style',name:'Open style as nodes',xmb:'page',hint:'Edit the selected element’s stylesheet rule as a node graph, layered over the sheet',keys:'',run:()=>openRuleAsNodes()},
  {cat:'View & Panels',name:'Settings…',xmb:'settings',hint:'Themes, grid and snap, sound, export defaults, resets',keys:'Ctrl/⌘+,',run:()=>openSettings()},
  {cat:'Project',name:'Project files list…',hint:'Jump to any song, drawing, or sheet',keys:'Ctrl+P',run:()=>showFiles()},
  {cat:'Project',name:'Version checkpoints…',xmb:'project',hint:'Save and restore checkpoints',keys:'Ctrl+Alt+V',run:()=>openVersions()},
  {cat:'Project',name:'Check accessibility…',xmb:'output',hint:'Run contrast and heading checks',keys:'',run:()=>{setSide('sideR',true);$('#w-checks').open=true;$('#chkRun').click()}},
  {cat:'View & Panels',name:'Interface: XMB (touch)',hint:'Categories across, tools down; the interface PIXIWYG uses on phones and tablets',keys:'',run:()=>setUi('xmb')},
  {cat:'View & Panels',name:'Interface: Desktop',hint:'Toolbar, side panels and the project tree',keys:'',xmb:'settings',run:()=>setUi('desktop')},
  {cat:'View & Panels',name:'Sound effects',hint:'The little blips and boings',keys:'',xmb:'settings',on:()=>state.sound,run:()=>{setSound(!state.sound);audio();sfx('blip')}},
  {cat:'Help',name:'Creative Quest (for kids)',hint:'Seven hands-on missions with stars: a title, a drawing, a tune, a moving part, a story, a 3D shape',keys:'',xmb:'project',bare:true,run:()=>startQuest()},
  {cat:'Help',name:'Give me an idea',hint:'Something to make today',keys:'',xmb:'project',bare:true,stay:true,run:()=>{audio();sfx('blip');status('💡 '+QUEST_IDEAS[Math.floor(Math.random()*QUEST_IDEAS.length)])}},
  {cat:'Help',name:'Keyboard shortcuts',xmb:'settings',hint:'View all key bindings',keys:'F1 or ?',run:()=>toggleHelp()},
  {cat:'Help',name:'About PIXIWYG',xmb:'settings',hint:'Version and licenses',keys:'',run:()=>openAbout()},
  {cat:'Help',name:'Report a problem…',xmb:'settings',hint:'Prepare report for beta team',keys:'',run:()=>openReport()}
];
let cmdIdx=0,cmdFiltered=[];
function openCmdPalette(){
  $('#cmdModal').hidden=false;$('#cmdBtn').setAttribute('aria-expanded','true');
  $('#cmdSearch').value='';filterCmds('');$('#cmdSearch').focus();
}
function closeCmdPalette(){
  $('#cmdModal').hidden=true;$('#cmdBtn').setAttribute('aria-expanded','false');
  $('#cmdSearch').blur();try{$('#cmdBtn').focus()}catch(e){}
}
function filterCmds(q){
  const term=q.trim().toLowerCase();
  const live=CMD_ITEMS.filter(c=>!c.when||c.when());
  cmdFiltered=term?live.filter(c=>c.name.toLowerCase().includes(term)||c.hint.toLowerCase().includes(term)||c.cat.toLowerCase().includes(term)):live;
  cmdIdx=0;renderCmdList();
}
function renderCmdList(){
  const list=$('#cmdList');list.innerHTML='';
  if(!cmdFiltered.length){list.innerHTML='<div style="padding:12px;text-align:center;color:var(--muted)">No matching commands</div>';return}
  let lastCat='';
  cmdFiltered.forEach((cmd,i)=>{
    if(cmd.cat!==lastCat){
      lastCat=cmd.cat;
      const cdiv=document.createElement('div');cdiv.className='cmdcat';cdiv.textContent=lastCat;list.append(cdiv);
    }
    const item=document.createElement('button');item.type='button';item.className='cmditem'+(i===cmdIdx?' on':'');
    item.role='option';item.setAttribute('aria-selected',i===cmdIdx);
    item.innerHTML=`<span><b>${escH(cmd.name)}</b><small>${escH(cmd.hint)}</small></span>${cmd.on?`<em class="cmdon${cmd.on()?' lit':''}">${cmd.on()?'On':'Off'}</em>`:''}${cmd.keys?`<kbd>${cmd.keys}</kbd>`:''}`;
    item.onclick=()=>{closeCmdPalette();cmd.run()};
    list.append(item);
  });
  const on=list.querySelector('.cmditem.on');if(on)on.scrollIntoView({block:'nearest'});
}
function execCmdIdx(){if(cmdFiltered[cmdIdx]){closeCmdPalette();cmdFiltered[cmdIdx].run()}}
$('#cmdBtn').onclick=()=>{audio();sfx('click');openCmdPalette()};
$('#cmdClose').onclick=closeCmdPalette;
$('#cmdSearch').oninput=e=>filterCmds(e.target.value);
$('#cmdSearch').onkeydown=e=>{
  if(e.key==='ArrowDown'){e.preventDefault();if(cmdFiltered.length){cmdIdx=(cmdIdx+1)%cmdFiltered.length;renderCmdList()}}
  else if(e.key==='ArrowUp'){e.preventDefault();if(cmdFiltered.length){cmdIdx=(cmdIdx-1+cmdFiltered.length)%cmdFiltered.length;renderCmdList()}}
  else if(e.key==='Enter'){e.preventDefault();execCmdIdx()}
  else if(e.key==='Escape'){e.preventDefault();closeCmdPalette()}
};
$('#cmdModal').addEventListener('click',e=>{if(e.target===$('#cmdModal'))closeCmdPalette()});


// SECTION: keys window
const M=/Mac|iPhone|iPad/.test(navigator.platform||navigator.userAgent)?'⌘':'Ctrl';
const KEYS=[
  ['Page',[['Drag','Any style from the Catalog onto the page to add that element'],['Drag','A primitive onto the page to place or apply it'],['Click a tab','Show every style for that element type'],['1 – 9','Drop that element type at the pointer'],['P','Open or close the Paint Studio'],[M+'+Enter','Play: try animations and page logic (Esc stops)']]],
  ['Paint Studio (while you work in it)',[['B','Brush, back to the last one you used'],['Shift+B','Cycle the Brush, pencil, rainbow, spray, bubbles'],['Arrows','In Brushes, the next or previous brush'],['Esc','Close the brush editor (then the selection, then the studio)'],['S','Stamp'],['G','Paint bucket'],['E','Eraser'],['I','Eyedropper'],['Alt+click','Pick a color while using any brush'],['[ ]','Brush size down, up'],['Shift+[ Shift+]','Brush size in big steps'],['X','Swap foreground and background colors'],['D','Default colors, black and white'],['Alt+Backspace','Fill this layer with the foreground color'],[M+'+Backspace','Fill this layer with the background color'],[M+'+Z','Undo a stroke'],
    [M+'+Alt+N','New layer above this one'],[M+'+J','Duplicate this layer'],[M+'+E','Merge this layer down'],[M+'+[ '+M+'+]','Move this layer down, up'],['Alt+[ Alt+]','Paint on the layer below, above'],
    [M+'+= '+M+'+−','Zoom in, out (or '+M+'+wheel)'],[M+'+0','Fit the drawing to the view; again for 100%'],['Middle-drag','Move the view'],[M+'+\\','Hide or show the palettes'],['Esc','Close the studio'],['Right-click','A swatch sets the background color']]],
  ['Elements and styles',[[', .','Previous, next style for the selected element'],['Enter','Edit text (double-click works too)'],['Drag','Snaps to the edges and centers of other elements and the page'],['Drag a handle','Scale. Shift keeps proportions; Alt scales from the center; double-click a handle for 100%'],[M+'+drag','Move or scale without snapping'],[M+'+Shift+;','Turn snapping on or off'],['Arrows','Nudge 1px'],['Shift+Arrows','Nudge one grid step (10px with the grid off)'],[M+'+J','Duplicate'],[M+'+] '+M+'+[','Bring forward, send backward'],[M+'+Shift+] '+M+'+Shift+[','Bring to front, send to back'],['Delete','Delete the selected element'],[M+'+D','Deselect'],['Esc','Deselect and stop placing']]],
  ['File and view',[[M+'+Z','Undo'],[M+'+Shift+Z '+M+'+Y','Redo'],[M+'+S','Save now (it also saves by itself)'],[M+'+Alt+V','Versions: save one, go back to one'],[M+'+Alt+S','Save file: download the project'],[M+'+Shift+S','Export HTML'],[M+'+Shift+L','Autoformat with the last settings'],[M+'+V','Paste Markdown onto the page'],[M+'+\\','Hide or show both side panels'],['Space','Play the page (Esc stops)'],['Tab','Move between controls'],[M+"+'",'Show or hide the grid lines'],[M+'+= '+M+'+−','Zoom in, out'],[M+'+0','Actual size'],[M+'+scroll','Zoom around the pointer'],[M+'+,','Settings: themes and defaults'],['Shift+F1','Dark interface'],['Shift+F2','Light interface'],['F1 ?','Show this list (Esc closes it)']]],
];
function renderHelp(){
  const esc=t=>t.replace(/&/g,'&amp;').replace(/</g,'&lt;');
  $('#help').innerHTML=KEYS.map(([t,rows])=>`<section><h3>${t}</h3><dl>${rows.map(([k,d])=>`<dt>${k.split(' ').map(x=>`<kbd>${esc(x)}</kbd>`).join(' ')}</dt><dd>${esc(d)}</dd>`).join('')}</dl></section>`).join('');
}
function toggleHelp(show){
  const w=$('#helpModal');if(show===undefined)show=w.hidden;
  w.hidden=!show;if(show)$('#helpClose').focus();audio();sfx(show?'pop':'whoosh');
}
$('#helpClose').onclick=()=>toggleHelp(false);
$('#helpModal').addEventListener('pointerdown',e=>{if(e.target.id==='helpModal')toggleHelp(false)});
$('#keysBtn').onclick=()=>toggleHelp();


// SECTION: page logic
function openLogicEditor(focusEl){
  if(!state.logic)state.logic=emptyGraph();
  openNodeEditor({title:'Page logic',graph:state.logic,mode:'logic',el:focusEl||null,onChange:g=>{state.logic=g;save()}});
  if(focusEl&&!state.logic.nodes.some(n=>n.type==='click'&&n.f.el===focusEl)){const n=addNode('click');n.f.el=focusEl;drawNodes()}
}
$('#logicBtn').onclick=()=>{audio();sfx('blip');openLogicEditor()};

// SECTION: example calculator (built from the page's current styles)
function insertCalculator(){
  pushUndo();const c=viewCenter(),x0=Math.round(c.x-130),y0=Math.round(c.y-170);let z=maxZ();
  const mk=(tag,x,y,w,content,attrs)=>{const st=nextStyleFor(tag),el={id:nid('e'),tag,fileId:st.fileId,selector:st.selector,x,y,w,z:++z};if(content!=null)el.content=content;if(attrs)el.attrs=attrs;state.els.push(el);return el};
  const disp=mk('input',x0,y0,248,null,{readonly:'',placeholder:'0',value:''});
  const keys=['7','8','9','÷','4','5','6','×','1','2','3','−','C','0','=','+'],g=state.logic||(state.logic=emptyGraph());
  const nn=(type,x,y,f)=>{const n={id:'n'+nid('').slice(-8)+g.nodes.length,type,x,y,f:{...nodeDefaults(type),...f}};g.nodes.push(n);return n};
  const wire=(a,ap,b,bp)=>g.wires.push({a:a.id,ap,b:b.id,bp});
  const readD=nn('elText',40,20,{el:disp.id}),calc=nn('calc',280,20,{});wire(readD,'out',calc,'expr');
  keys.forEach((k,i)=>{
    const b=mk('button',x0+(i%4)*64,y0+56+Math.floor(i/4)*56,56,k),x=40+(i%4)*460,y=180+Math.floor(i/4)*170,ev=nn('click',x,y,{el:b.id});
    if(k==='C')wire(ev,'fire',nn('setText',x+220,y,{el:disp.id,value:''}),'in');
    else if(k==='='){const s=nn('setText',x+220,y,{el:disp.id});wire(ev,'fire',s,'in');wire(calc,'out',s,'value')}
    else wire(ev,'fire',nn('addText',x+220,y,{el:disp.id,value:k}),'in');
  });
  renderAll();save();sfx('boing');
  status('Added a calculator. Press ▶ Play to try it; Logic… shows how it works.');
  return disp.id;
}
$('#nodeExamples').onchange=e=>{const v=e.target.value;e.target.value='';if(v==='calc'){closeNodeEditor();insertCalculator();openLogicEditor()}};


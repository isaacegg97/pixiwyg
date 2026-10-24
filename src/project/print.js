// SECTION: print export (pages cut from the desk, laid out or imposed onto sheets)
// RULE: an element prints on every page it overlaps, bleed included.
function elPages(el,rs,bleed){const {w,h:ht}=layoutBox(el);
  return rs.filter(r=>el.x<r.x+r.w+bleed&&el.x+w>r.x-bleed&&el.y<r.y+r.h+bleed&&el.y+ht>r.y-bleed)}
// FORMAT: sheet order for imposition; null = empty slot, rot = page printed upside down.
function imposition(c){
  const n=c.pages;
  if(c.type==='minizine')return[[{p:4,rot:1},{p:3,rot:1},{p:2,rot:1},{p:1,rot:1},{p:5},{p:6},{p:7},{p:0}]];
  const out=[];for(let s=0;s<n/4;s++){out.push([{p:n-1-2*s},{p:2*s}],[{p:2*s+1},{p:n-2-2*s}])}return out;
}


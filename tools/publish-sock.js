'use strict';
// SECTION: autopublish forwarder (desktop app and dev server)
// TODO: the collecting API is the user's to write. This forwards the page's POST /__publish body, untouched, as
//   POST /publish over HTTP on a local Unix socket, and relays the reply.
// FORMAT: socket = $PIXIWYG_PUBLISH_SOCK, else $XDG_RUNTIME_DIR/pixiwyg-publish.sock, else <tmpdir>/pixiwyg-publish.sock.
//   No socket listening -> 503 {"error":"no publisher"}; the page tells the user to start it.
// SAFETY: only same-origin pages reach this; the body is capped and never interpreted here.
const http=require('node:http'),os=require('node:os'),path=require('node:path');
const MAX=256*1024*1024;
const sockPath=()=>process.env.PIXIWYG_PUBLISH_SOCK||path.join(process.env.XDG_RUNTIME_DIR||os.tmpdir(),'pixiwyg-publish.sock');
function forward(body,sock=sockPath()){
  return new Promise(done=>{
    if(body.length>MAX){done({status:413,type:'application/json',body:Buffer.from('{"error":"too large"}')});return}
    const req=http.request({socketPath:sock,path:'/publish',method:'POST',headers:{'content-type':'application/json','content-length':body.length},timeout:120000},res=>{
      const chunks=[];let n=0;
      res.on('data',c=>{n+=c.length;if(n<=1<<20)chunks.push(c)});
      res.on('end',()=>done({status:res.statusCode||502,type:res.headers['content-type']||'application/octet-stream',body:Buffer.concat(chunks)}));
    });
    const fail=status=>e=>done({status,type:'application/json',body:Buffer.from(JSON.stringify({error:status===503?'no publisher':String(e&&e.message||e)}))});
    req.on('error',e=>fail(e&&(e.code==='ENOENT'||e.code==='ECONNREFUSED')?503:502)(e));
    req.on('timeout',()=>{req.destroy(new Error('publisher timed out'))});
    req.end(body);
  });
}
module.exports={forward,sockPath};

(()=>{
// SECTION: comment tags. Every comment starts with one; grep -n '// TAG:' finds them all. No narrating comments.
//   SECTION    module boundary in this file; grep '// SECTION:' for the table of contents
//   INVARIANT  something the code relies on holding; break it and something else breaks
//   SAFETY     untrusted input, sanitizing, privilege, resource limits
//   PERF       why the code is shaped for speed or memory, with the numbers when measured
//   HACK       an upstream/engine workaround, or a deliberate clever trick
//   FIX        why a non-obvious line exists: the bug it prevents from coming back
//   COMPAT     old data, other browsers, other platforms
//   FORMAT     file formats, data shapes, wire protocols
//   RULE       product behaviour the code enforces on purpose; changing it is a design decision
//   TODO       known gap
// FORMAT: written into exports, project manifests and problem reports; tools/package.json must match (tests assert it).
const APP_VERSION='1.0.0-beta.1';
// INVARIANT: last 50 errors persist across reloads so a report filed after a crash still has them.
const ERRS=(()=>{try{const a=JSON.parse(localStorage.getItem('pixiwyg.errors'));return Array.isArray(a)?a.slice(-50):[]}catch(e){return[]}})();
function logErr(kind,msg,stack){ERRS.push({t:new Date().toISOString(),v:APP_VERSION,kind,msg:String(msg??'').slice(0,500),stack:String(stack||'').slice(0,1200)});if(ERRS.length>50)ERRS.splice(0,ERRS.length-50);try{localStorage.setItem('pixiwyg.errors',JSON.stringify(ERRS))}catch(e){}}
addEventListener('error',e=>logErr('error',e.message||(e.target&&e.target.src?'could not load '+e.target.src:'error'),e.error&&e.error.stack));
addEventListener('unhandledrejection',e=>{const r=e.reason;logErr('rejection',r&&r.message||r,r&&r.stack)});

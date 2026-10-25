'use strict';
// SAFETY: the one Content-Security-Policy, shared by the desktop wrapper (as a header) and the hosted page (stamped
//   into index.html as a meta tag by scripts/stamp-csp.mjs). Exactly the inline script by hash, plus 'self'.
const crypto=require('node:crypto');
const scriptOf=html=>{const m=html.match(/<script>([\s\S]*?)<\/script>/);if(!m)throw new Error('index.html has no inline script');return m[1]};
// FIX: the browser hashes the script after HTML parsing has turned CRLF and lone CR into LF; hashing the raw bytes
//   gave a Windows checkout (CRLF) a policy that blocked its own script, so the page never started there.
const hashOf=html=>crypto.createHash('sha256').update(scriptOf(html).replace(/\r\n?/g,'\n'),'utf8').digest('base64');
const policy=html=>[
  "default-src 'self'",
  `script-src 'self' 'sha256-${hashOf(html)}'`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https: http:",
  // INVARIANT: the player fetches its skin (data: when project-owned) and plays the song from a blob:.
  "connect-src 'self' data: blob:",
  "media-src 'self' blob: data:","object-src 'none'","frame-src 'none'","worker-src 'none'","base-uri 'none'","form-action 'none'",
].join('; ');
// FORMAT: meta CSP can't carry frame-ancestors, report-uri or sandbox; browsers ignore them there, so none are used.
const META_RE=/<meta http-equiv="Content-Security-Policy" content="[^"]*">/;
const stamp=html=>{const tag=`<meta http-equiv="Content-Security-Policy" content="${policy(html)}">`;
  return META_RE.test(html)?html.replace(META_RE,tag):html.replace('<meta charset=utf8>','<meta charset=utf8>'+tag)};
module.exports={policy,stamp,META_RE};

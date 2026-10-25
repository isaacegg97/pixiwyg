// INVARIANT: serves exactly what the app serves (index.html, lib/, examples/) on :4173 for the web tests.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname, join, posix} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const {stamp} = createRequire(import.meta.url)('../csp.js');
const {forward} = createRequire(import.meta.url)('../publish-sock.js');

const root = fileURLToPath(new URL('../..', import.meta.url));
const port = +(process.env.PORT || 4173);
const types = {'.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8'};

createServer(async (req, res) => {
  if (req.method === 'POST') {
    if (new URL(req.url, 'http://x').pathname !== '/__publish') { res.writeHead(405).end(); return; }
    const chunks = []; for await (const c of req) chunks.push(c);
    const r = await forward(Buffer.concat(chunks));
    res.writeHead(r.status, {'content-type': r.type, 'cache-control': 'no-store'}).end(r.body); return;
  }
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
  // FIX: path.normalize is the platform's, so on Windows lib/x.css came back with a backslash, failed the check below
  //   and every library file 404ed (each test then stalled until its timeout). URL paths are POSIX everywhere.
  rel = posix.normalize(rel);
  if (!(rel === 'index.html' || /^(lib|examples)\/[\w.-]+$/.test(rel))) { res.writeHead(404).end(); return; }
  try {
    // INVARIANT: index.html is served stamped, as the desktop app serves it; tests/security.spec checks the file on disk.
    let body = await readFile(join(root, rel));
    if (rel === 'index.html') body = stamp(body.toString('utf8'));
    res.writeHead(200, {'content-type': types[extname(rel)] || 'application/octet-stream', 'cache-control': 'no-store'}).end(body);
  } catch { res.writeHead(404).end(); }
}).listen(port, () => console.log(`PIXIWYG at http://localhost:${port}/`));

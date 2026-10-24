// FORMAT: stamps index.html's meta CSP with the current inline script's hash. Run after any edit to index.html:
//   npm run stamp   (pretest, dist and install-local run it too). --check exits 1 instead of writing.
import {readFileSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const {stamp} = createRequire(import.meta.url)('../csp.js');
const file = new URL('../../index.html', import.meta.url), html = readFileSync(file, 'utf8'), out = stamp(html);
if (process.argv.includes('--check')) { if (out !== html) { console.error('index.html CSP is stale: run npm run stamp'); process.exit(1); } }
else if (out !== html) { writeFileSync(file, out); console.log('stamped index.html'); }

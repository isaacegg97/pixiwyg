// FORMAT: node scripts/web.mjs  rebuilds ../index.html (CSP stamped) and stages the hostable app in dist/web/:
//   index.html, lib/, examples/ and an empty .nojekyll. Any static server can serve that folder as is, from any path.
// RULE: the copy is byte-for-byte what the desktop app serves; nothing is minified, renamed or rewritten here.
// HACK: .nojekyll stops GitHub Pages running Jekyll over the folder, which would drop files starting with _ or .
// INVARIANT: npm run dist empties dist/, so run this after it when building both locally.
import {execFileSync} from 'node:child_process';
import {cpSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url)), repo = join(here, '..'), out = join(here, 'dist', 'web');
execFileSync(process.execPath, [join(here, 'scripts', 'build.mjs')], {stdio: 'inherit'});
rmSync(out, {recursive: true, force: true});
mkdirSync(out, {recursive: true});
cpSync(join(repo, 'index.html'), join(out, 'index.html'));
for (const d of ['lib', 'examples']) cpSync(join(repo, d), join(out, d), {recursive: true});
writeFileSync(join(out, '.nojekyll'), '');
console.log(`Staged the web app in ${out}`);

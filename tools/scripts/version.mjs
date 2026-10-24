// FORMAT: npm run set-version -- <semver> (node scripts/version.mjs) sets the one app version in every place that carries it:
//   package.json, APP_VERSION in ../src/app/start.js (then ../index.html is rebuilt), ../tauri/tauri.conf.json and
//   ../tauri/Cargo.toml. Without an argument it prints them, and exits 1 if they disagree.
// INVARIANT: tests/app.spec.mjs fails when they differ; the release workflow refuses a tag that matches none.
import {readFileSync, writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const at = p => new URL(p, import.meta.url);
const FILES = {
  'tools/package.json': [at('../package.json'), /("version":\s*")([^"]+)(")/],
  'src/app/start.js': [at('../../src/app/start.js'), /(const APP_VERSION=')([^']+)(')/],
  'tauri/tauri.conf.json': [at('../../tauri/tauri.conf.json'), /("version":\s*")([^"]+)(")/],
  'tauri/Cargo.toml': [at('../../tauri/Cargo.toml'), /(\[package\][^[]*?\nversion\s*=\s*")([^"]+)(")/],
};
const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;
const want = process.argv[2];
if (!want) {
  const seen = Object.entries(FILES).map(([name, [u, re]]) => [name, (readFileSync(u, 'utf8').match(re) || [])[2]]);
  for (const [n, v] of seen) console.log(`${v || '?'}\t${n}`);
  process.exit(new Set(seen.map(x => x[1])).size === 1 ? 0 : 1);
}
if (!SEMVER.test(want)) { console.error(`Not a version: ${want} (expected like 1.0.0 or 1.0.0-beta.2)`); process.exit(1); }
for (const [name, [u, re]] of Object.entries(FILES)) {
  const s = readFileSync(u, 'utf8');
  if (!re.test(s)) { console.error(`No version found in ${name}`); process.exit(1); }
  writeFileSync(u, s.replace(re, `$1${want}$3`));
  console.log(`${want}\t${name}`);
}
execFileSync(process.execPath, [new URL('build.mjs', import.meta.url).pathname], {stdio: 'inherit'});

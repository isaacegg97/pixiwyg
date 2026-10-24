// SECTION: repository conventions the code is held to
import {test, expect} from '@playwright/test';

// FORMAT: every source file we write, found by walking the tree, so a new file is covered without being listed.
const ROOT = new URL('../../', import.meta.url);
const SKIP = /(^|\/)(node_modules|dist|test-results|target|gen)(\/|$)/;
async function ours() {
  const {readdirSync, statSync} = await import('node:fs');
  const {join, relative} = await import('node:path');
  const {fileURLToPath} = await import('node:url');
  const root = fileURLToPath(ROOT), out = [];
  const walk = d => { for (const f of readdirSync(d)) { const p = join(d, f), r = relative(root, p); if (SKIP.test(r)) continue;
    if (statSync(p).isDirectory()) walk(p); else if (/\.(js|mjs|css|sh|rs|yml)$/.test(f)) out.push(r); } };
  for (const d of ['src', 'tools', 'tauri/src', '.github/workflows']) walk(join(root, d));
  return out;
}

test('FORMAT: every whole-line comment in our own code carries a tag (continuations indent under it)', async () => {
  const {readFileSync} = await import('node:fs');
  const tag = /^\s*(\/\/|#|\/\*)\s?(SECTION|INVARIANT|SAFETY|PERF|HACK|FIX|COMPAT|FORMAT|RULE|TODO|INCLUDE|ASSET):|^\s*(\/\/|#)\s{3}/;
  const files = await ours();
  expect(files.length).toBeGreaterThan(100);
  const bad = [];
  for (const f of files) {
    const src = readFileSync(new URL(f, ROOT), 'utf8');
    // FORMAT: CSS comments open with /*, and INCLUDE:/ASSET: are the theme build's directives (build.mjs).
    const lead = /\.(sh|yml)$/.test(f) ? /^\s*#(?![!\[])/ : f.endsWith('.css') ? /^\s*\/\*/ : /^\s*\/\/(?!\/)/;
    src.split('\n').forEach((l, i) => { if (lead.test(l) && !tag.test(l)) bad.push(`${f}:${i + 1}: ${l.trim().slice(0, 80)}`); });
  }
  expect(bad).toEqual([]);
});

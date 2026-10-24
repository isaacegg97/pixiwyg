// FORMAT: node scripts/build.mjs [--watch] compiles src/ into ../index.html and stamps its CSP.
// FORMAT: src/build.json lists every source file, relative to src/, in three lists:
//     styles   concatenated into the page's one <style>
//     markup   concatenated into <body>; a line `<!-- INCLUDE: dir/file.html -->` is replaced by that file
//     scripts  concatenated, in load order, into the one inline <script>
//   Each list is joined as is, a newline closing any file that lacks one. src/template.html is the document around
//   them, with /* INJECT:STYLES */, <!-- INJECT:MARKUP --> and /* INJECT:SCRIPTS */ where they go.
// INVARIANT: scripts run in list order and share one scope (globals.mjs refuses a clash); styles cascade in list order.
/*
 * Purpose: Assemble modular source files into standalone embeddable index.html.
 * Authors: isaacegg97, antigravity
 * Timestamp: 2026-10-16
 * Footguns: Always use stamp() on output to ensure inline script hash matches Content-Security-Policy.
 * Usage Example: node scripts/build.mjs
 */
import {readFileSync, writeFileSync, existsSync, readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkGlobals} from './globals.mjs';

const {stamp} = createRequire(import.meta.url)('../csp.js');
const root = fileURLToPath(new URL('../..', import.meta.url));
const src = join(root, 'src');
const manifestPath = join(src, 'build.json');
const templatePath = join(src, 'template.html');
const outPath = join(root, 'index.html');
const themesDir = join(src, 'app', 'themes');

// FORMAT: built-in themes can borrow from the vendored libraries in lib/ (MIT, credited in lib/NOTICES.txt) with
//   directives in comments, resolved here so the theme files stay short and nothing loads from the network:
//     /* INCLUDE: lib/98.css @font-face Pixelated */   every @font-face whose block mentions that text
//     /* INCLUDE: lib/98.css scrollbars */             its ::-webkit-scrollbar rules, scoped to the theme
//     /* ASSET: --name lib/98.css <selector> */       the first url() of the last rule with that selector (the one that wins),
//                                                      as a custom property on :root[data-apptheme]
function libRules(css) {
  const out = [], src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (let i = 0; i < src.length;) {
    const open = src.indexOf('{', i); if (open < 0) break;
    const sel = src.slice(i, open).trim();
    let d = 1, j = open + 1; while (j < src.length && d) { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; }
    const body = src.slice(open + 1, j - 1);
    if (sel.startsWith('@media') || sel.startsWith('@supports')) out.push(...libRules(body));
    else out.push({sel, body});
    i = j;
  }
  return out;
}
const libCache = new Map();
const lib = f => { if (!libCache.has(f)) libCache.set(f, libRules(readFileSync(join(root, f), 'utf8'))); return libCache.get(f); };
const SCOPE = ':root[data-apptheme]';
export function resolveTheme(css, name) {
  const vars = [];
  css = css.replace(/\/\*\s*INCLUDE:\s*(lib\/[\w.-]+\.css)\s+([^*]*?)\s*\*\//g, (m, f, what) => {
    const rules = lib(f);
    if (what.startsWith('@font-face')) {
      const want = what.slice(10).trim(), hit = rules.filter(r => r.sel === '@font-face' && (!want || r.body.includes(want)));
      if (!hit.length) throw new Error(`src/app/themes/${name}: no @font-face matching "${want}" in ${f}`);
      return hit.map(r => `@font-face{${r.body}}`).join('\n');
    }
    if (what === 'scrollbars') {
      const hit = rules.filter(r => r.sel.split(',').every(x => /^\s*(\.has-scrollbar)?::-webkit-scrollbar/.test(x)));
      if (!hit.length) throw new Error(`src/app/themes/${name}: no scrollbar rules in ${f}`);
      return hit.map(r => r.sel.split(',').map(x => `${SCOPE} ${x.trim().replace(/^\.has-scrollbar/, '')}`).join(',') + `{${r.body}}`).join('\n');
    }
    throw new Error(`src/app/themes/${name}: unknown INCLUDE "${what}"`);
  });
  css = css.replace(/\/\*\s*ASSET:\s*(--[\w-]+)\s+(lib\/[\w.-]+\.css)\s+([^*]+?)\s*\*\//g, (m, v, f, sel) => {
    // FORMAT: quoted urls may hold SVG markup with parentheses in it, so a quoted value runs to its own quote.
    const re = /url\((?:(["'])(data:.*?)\1|(data:[^)]*))\)/, has = r => r.sel.split(',').some(x => x.trim() === sel);
    let r = lib(f).findLast(r => has(r) && re.test(r.body)), u = r && re.exec(r.body);
    // FORMAT: a rule may name its image by custom property (background-image:var(--x)); the url is where --x is set.
    if (!u) { const v = (lib(f).findLast(has) || {body: ''}).body.match(/var\((--[\w-]+)\)/); if (v) { const vr = new RegExp(v[1] + '\\s*:\\s*(url\\((?:(["\'])data:.*?\\2|data:[^)]*)\\))'); const def = lib(f).map(x => vr.exec(x.body)).find(Boolean); u = def && re.exec(def[1]); } }
    if (!u) throw new Error(`src/app/themes/${name}: no url() for "${sel}" in ${f}`);
    vars.push(`${v}:url("${(u[2] ?? u[3]).replace(/"/g, '%22')}")`); return '';
  });
  return vars.length ? `${SCOPE}{${vars.join(';')}}\n${css}` : css;
}

// FORMAT: src/app/themes/*.css (but template.css) become the built-in interface themes: [{id, name, about, css}], named
//   by each file's first `SECTION: Name: about` comment. The files stay the one source; apptheme.js gets the list.
export function builtinThemes() {
  if (!existsSync(themesDir)) return [];
  return readdirSync(themesDir).filter(f => f.endsWith('.css') && f !== 'template.css').sort().map(f => {
    const css = readFileSync(join(themesDir, f), 'utf8'), m = /SECTION:\s*([^:\n]+):\s*([^\n]*?)(?:\*\/|\n)/.exec(css);
    // SAFETY: theme text lands inside the inline script; these would end it or make the parser mangle it.
    return {id: f.replace(/\.css$/, ''), name: m ? m[1].trim() : f.replace(/\.css$/, ''), about: m ? m[2].trim().replace(/\s*An example PIXIWYG interface theme\.?$/, '') : '', css: (() => { const r = resolveTheme(css, f); if (/<\/script|<!--/i.test(r)) throw new Error(`themes/${f} contains </script or <!--`); return r; })()};
  });
}

// FORMAT: an .html file's whole-line <!-- SECTION: … --> comments are for whoever edits it; the page leaves them out.
const read = f => { const t = readFileSync(join(src, f), 'utf8'); return f.endsWith('.html') ? t.replace(/^<!-- SECTION:[^\n]*-->\n/gm, '') : t; };
export const joinFiles = files => files.map(f => { const t = read(f); return t.endsWith('\n') ? t : t + '\n'; }).join('').replace(/\n$/, '');
// SAFETY: an include names a file under src/ and can't nest forever.
const includes = (html, depth = 0) => html.replace(/^[ \t]*<!-- INCLUDE: ([\w./-]+) -->\n/gm, (m, f) => {
  if (depth > 4 || f.includes('..')) throw new Error(`bad INCLUDE ${f}`);
  const t = includes(read(f), depth + 1); return t.endsWith('\n') ? t : t + '\n';
});

export function build() {
  if (!existsSync(manifestPath) || !existsSync(templatePath)) return false;
  const {styles, markup, scripts} = JSON.parse(readFileSync(manifestPath, 'utf8'));
  // RULE: modules share one scope; a clashing top-level name stops the build instead of breaking the app.
  const clashes = checkGlobals(src, scripts);
  if (clashes.length) throw new Error('Top-level name clash between modules:\n  ' + clashes.join('\n  '));
  const code = joinFiles(scripts).replace('/* INJECT:THEMES */[]', () => JSON.stringify(builtinThemes()));
  const html = readFileSync(templatePath, 'utf8')
    .replace('/* INJECT:STYLES */', () => joinFiles(styles))
    .replace('<!-- INJECT:MARKUP -->', () => includes(joinFiles(markup)))
    .replace('/* INJECT:SCRIPTS */', () => code);
  writeFileSync(outPath, stamp(html), 'utf8');
  console.log('Compiled src/ into index.html and stamped CSP');
  return true;
}

if (process.argv.includes('--watch')) {
  import('node:fs').then(({watch}) => {
    build();
    console.log('Watching src/ for changes...');
    let debounce;
    const onChange = (eventType, filename) => {
      if (filename) {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          console.log(`${filename} changed, rebuilding...`);
          try { build(); } catch (e) { console.error(e); }
        }, 80);
      }
    };
    watch(src, {recursive: true}, (t, f) => { if (f && !/\.spec\.mjs$/.test(f)) onChange(t, f); });
  });
} else {
  build();
}

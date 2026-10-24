// FORMAT: lists every module's top-level names and fails on a clash.
// RULE: all src/ scripts share one classic-script scope. A second `function x` or `var x` silently replaces the
//   first (the paint/sequencer drawFxList bug), and a clash with const/let kills the whole script at boot. Either
//   way the app breaks somewhere far from the cause, so the build refuses and names both files.
// HACK: a small scanner, not a parser: it tracks brackets, strings, template literals, comments and regex
//   literals, and reads declarations that start a line at depth 0, which is how every module is written.
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const ID = /[A-Za-z_$][\w$]*/y;
const REGEX_AFTER = new Set([...'(,=:[!&|?{};+-*%<>~^', '']);

// INVARIANT: returns the position after the literal/comment starting at i, or -1 if there is none at i.
function skipToken(s, i, prev) {
  const c = s[i], d = s[i + 1];
  if (c === '/' && d === '/') { const e = s.indexOf('\n', i); return e < 0 ? s.length : e; }
  if (c === '/' && d === '*') { const e = s.indexOf('*/', i + 2); return e < 0 ? s.length : e + 2; }
  if (c === '"' || c === "'") { let j = i + 1; while (j < s.length && s[j] !== c && s[j] !== '\n') j += s[j] === '\\' ? 2 : 1; return j + 1; }
  if (c === '`') return skipTemplate(s, i + 1);
  if (c === '/' && (REGEX_AFTER.has(prev) || /\b(return|typeof|in|of|case)$/.test(s.slice(Math.max(0, i - 7), i).trimEnd()))) {
    let j = i + 1, cls = false;
    while (j < s.length && s[j] !== '\n') { const k = s[j]; if (k === '\\') { j += 2; continue; } if (k === '[') cls = true; else if (k === ']') cls = false; else if (k === '/' && !cls) break; j++; }
    j++; while (/[a-z]/.test(s[j] || '')) j++; return j;
  }
  return -1;
}
function skipTemplate(s, j) {
  while (j < s.length) {
    if (s[j] === '\\') { j += 2; continue; }
    if (s[j] === '`') return j + 1;
    if (s[j] === '$' && s[j + 1] === '{') { j = skipBlock(s, j + 1); continue; }
    j++;
  }
  return j;
}
// INVARIANT: s[i] is an opening bracket; returns the position after its partner.
function skipBlock(s, i) {
  let depth = 0, prev = '';
  for (let j = i; j < s.length;) {
    const t = skipToken(s, j, prev);
    if (t >= 0) { j = t; prev = 'x'; continue; }
    const c = s[j];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c) && --depth === 0) return j + 1;
    if (!/\s/.test(c)) prev = c;
    j++;
  }
  return s.length;
}
function readName(s, i) { ID.lastIndex = i; const m = ID.exec(s); return m ? m[0] : null; }

// FORMAT: [{name, kind, line}] for one module's top-level declarations.
export function topLevelNames(src) {
  const out = [], lineAt = i => src.slice(0, i).split('\n').length;
  let prev = '';
  for (let i = 0; i < src.length;) {
    const lineStart = i === 0 || src[i - 1] === '\n';
    const m = lineStart && /^(async function\*?|function\*?|class|const|let|var)\s+/.exec(src.slice(i, i + 40));
    if (m) {
      const kind = m[1].replace(/\*$/, '').replace('async ', ''), at = i;
      i += m[0].length;
      if (kind === 'function' || kind === 'class') { const n = readName(src, i); if (n) out.push({name: n, kind, line: lineAt(at)}); prev = ''; continue; }
      // FORMAT: declarators until `;` or a depth-0 newline; destructuring lists each bound name.
      for (;;) {
        while (/[ \t]/.test(src[i])) i++;
        if (src[i] === '{' || src[i] === '[') {
          const end = skipBlock(src, i), pat = src.slice(i + 1, end - 1);
          for (const part of pat.split(',')) { const n = part.split(/[:=]/).pop().trim().replace(/^\.\.\./, ''); const nm = /^[A-Za-z_$][\w$]*$/.test(n) ? n : (part.includes(':') ? null : part.split('=')[0].trim()); if (nm) out.push({name: nm, kind, line: lineAt(at)}); }
          i = end;
        } else { const n = readName(src, i); if (!n) break; out.push({name: n, kind, line: lineAt(at)}); i += n.length; }
        let p = '';
        while (i < src.length) {
          const t = skipToken(src, i, p);
          if (t >= 0) { i = t; p = 'x'; continue; }
          const c = src[i];
          if ('([{'.includes(c)) { i = skipBlock(src, i); p = ')'; continue; }
          if (c === ',' || c === ';' || (c === '\n' && !/^[ \t]/.test(src[i + 1] || '') && !/[=,(+\-*?:&|]$/.test(p))) break;
          if (!/\s/.test(c)) p = c;
          i++;
        }
        if (src[i] !== ',') break;
        i++;
      }
      prev = ''; continue;
    }
    const t = skipToken(src, i, prev);
    if (t >= 0) { i = t; prev = 'x'; continue; }
    const c = src[i];
    if ('([{'.includes(c)) { i = skipBlock(src, i); prev = ')'; continue; }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
  return out;
}

// FORMAT: returns a list of human-readable clash lines; empty means clean.
// INVARIANT: scans the modules joined as the build joins them; the bundle's own `(()=>{` wrapper (opened in the
//   first module, closed in the last) is blanked so its body reads as top level.
export function checkGlobals(dir, files) {
  const parts = files.map(f => { const t = readFileSync(join(dir, f), 'utf8'); return t.endsWith('\n') ? t : t + '\n'; });
  let code = parts.join('');
  const wrap = /^\(\(\)=>\{\n/.exec(code);
  if (wrap) code = ' '.repeat(wrap[0].length - 1) + code.slice(wrap[0].length - 1);
  const starts = []; let line = 1;
  for (const [n, p] of parts.entries()) { starts.push({file: files[n], line}); line += p.split('\n').length - 1; }
  const where = l => { let s = starts[0]; for (const x of starts) if (x.line <= l) s = x; return `${s.file}:${l - s.line + 1}`; };
  const seen = new Map(), clashes = [];
  for (const d of topLevelNames(code)) {
    const was = seen.get(d.name);
    if (was) clashes.push(`${d.name}: ${was.kind} at ${where(was.line)} and ${d.kind} at ${where(d.line)}`);
    else seen.set(d.name, d);
  }
  return clashes;
}

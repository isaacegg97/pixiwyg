// SECTION: hostile-input corpus (CSS, Markdown, primitives packs, .pixiwyg)
// SAFETY: none of it may run script or hang the app.
import {test, expect} from '@playwright/test';
import {deflateRawSync} from 'node:zlib';
import {boot} from './helpers.mjs';

const PWN = 'window.__pwned=(window.__pwned||[]).concat';
const CSS = [
  `img[onerror="${PWN}('css-img')"]{border:1px solid red}`,
  `a[href="javascript:${PWN}('css-href')"]{color:red}`,
  `div[onmouseover="${PWN}('css-div')"]{color:red}`,
].join('\n');
const MD = [
  `<img src="x" onerror="${PWN}('md-img')">`, '',
  `[click](javascript:${PWN}('md-link'))`, '',
  `<svg><a href="#"><animate attributeName="href" to="javascript:${PWN}('md-anim')"/><text y="20">x</text></a></svg>`, '',
  `<iframe srcdoc="<script>parent.__pwned=['md-iframe']</script>"></iframe>`, '',
  `<a href=" jav&#x09;ascript:${PWN}('md-entity')">tab</a>`,
].join('\n');
const PRIMS = JSON.stringify({type: 'pixiwyg-primitives', version: 1, primitives: [
  {kind: 'element', name: 'evil', data: {el: {tag: 'div', content: `<img src=x onerror="${PWN}('prim-content')">`, attrs: {onclick: `${PWN}('prim-attr')`, href: 'javascript:alert(1)'}},
    style: {sheet: 'evil.css', selector: `div[onmouseover="${PWN}('prim-sel')"]`, css: 'div{color:red}'}}},
  {kind: 'drawing', name: 'not an image', data: {src: 'javascript:alert(1)', w: 1, h: 1}},
]});

const findings = page => page.evaluate(async () => {
  await new Promise(r => setTimeout(r, 600));
  const html = [...document.querySelectorAll('#layer .el')].map(h => h.shadowRoot.innerHTML).join('\n');
  return {pwned: window.__pwned || [], handler: /\son[a-z]+=/i.test(html), js: /javascript:/i.test(html), iframe: /<iframe/i.test(html)};
});
const clean = {pwned: [], handler: false, js: false, iframe: false};

test.beforeEach(async ({page}) => {
  await boot(page);
  await page.evaluate(() => window.__pixiwyg.newProject('Hostile', false, {type: 'web'}));
});

test('stylesheet selectors can’t carry script onto elements', async ({page}) => {
  await page.evaluate(css => {
    const T = window.__pixiwyg, f = T.addFile('evil.css', css, false);T.afterFilesChanged();
    const st = T.state();
    for (const [i, sel] of ['img[onerror]', 'a[href]', 'div[onmouseover]'].entries()) {
      const full = f.sels.map(s => s[0]).find(s => s.startsWith(sel.split('[')[0] + '['));
      st.els.push({id: 'e' + i, tag: sel.split('[')[0], fileId: f.id, selector: full, x: 10, y: 10 + i * 60, w: 100, z: i + 1, content: sel.startsWith('img') ? 'data:image/png;base64,AAAA' : 'x'});
    }
    T.renderAll();
  }, CSS);
  expect(await findings(page)).toEqual(clean);
});

test('Markdown can’t carry script, raw HTML included', async ({page}) => {
  await page.evaluate(md => window.__pixiwyg.importMarkdown(md, {width: 400}), MD);
  expect(await findings(page)).toEqual(clean);
});

test('a primitives pack can’t carry script', async ({page}) => {
  const n = await page.evaluate(async json => {
    const T = window.__pixiwyg, n = T.importPrimText(json, {quiet: true});
    const p = T.prims.list.find(x => x.name === 'evil');if (p) await T.usePrim(p, {x: 20, y: 20});
    return n;
  }, PRIMS);
  expect(n).toBe(1);
  expect(await findings(page)).toEqual(clean);
});

test('a project file can’t carry script', async ({page}) => {
  const ok = await page.evaluate(async ({css, pwn}) => {
    const T = window.__pixiwyg;
    const manifest = {format: 'pixiwyg-project', version: 1, name: 'Evil', canvas: {type: 'web'}, page: {width: 800, height: 600},
      stylesheets: [{id: 's1', name: 'evil.css', enabled: true, file: 'styles/s1-evil.css'}], palette: null, paletteOptions: {}, background: {base: {c: '#ffffff'}, layers: [{type: 'image', src: 'javascript:alert(1)'}]}, defaults: {},
      elements: [
        {tag: 'div', sheet: null, selector: null, x: 10, y: 10, content: `<img src=x onerror="${pwn}('proj-content')"><a href="javascript:${pwn}('proj-a')">a</a>`},
        {tag: 'a', sheet: null, selector: null, x: 10, y: 80, content: 'link', attrs: {href: `javascript:${pwn}('proj-attr')`, onclick: `${pwn}('proj-onclick')`}},
        {tag: 'img', sheet: 's1', selector: `img[onerror="${pwn}('proj-sel')"]`, x: 10, y: 140, content: 'data:image/png;base64,AAAA'},
      ], assets: []};
    const zip = T.zipFiles([['manifest.json', JSON.stringify(manifest)], ['styles/s1-evil.css', css]]);
    return T.openFiles(new Map(await T.unzip(zip)), {});
  }, {css: CSS, pwn: PWN});
  expect(ok).toBe(true);
  expect(await findings(page)).toEqual(clean);
});

// SAFETY: a zip whose single entry inflates to `real` bytes while its header claims `claimed`
function bomb(real, claimed) {
  const data = deflateRawSync(Buffer.alloc(real)), name = Buffer.from('manifest.json');
  const local = Buffer.alloc(30), central = Buffer.alloc(46), end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(claimed, 22); local.writeUInt16LE(name.length, 26);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10); central.writeUInt32LE(data.length, 20); central.writeUInt32LE(claimed, 24); central.writeUInt16LE(name.length, 28);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10); end.writeUInt32LE(46 + name.length, 12); end.writeUInt32LE(30 + name.length + data.length, 16);
  return Buffer.concat([local, name, data, central, name, end]).toString('base64');
}

test('zip bombs and lying zips are refused quickly', async ({page}) => {
  const lying = bomb(64 * 1024 * 1024, 1000), huge = bomb(1024, 400 * 1024 * 1024);
  const r = await page.evaluate(async zips => {
    const T = window.__pixiwyg, out = [];
    for (const b64 of zips) {
      const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), t = performance.now();
      try { await T.unzip(new Blob([bytes])); out.push('accepted'); } catch (e) { out.push(e.message); }
      out.push(performance.now() - t < 5000);
    }
    return out;
  }, [lying, huge]);
  expect(r).toEqual(['zip entry larger than it says', true, 'zip too large', true]);
});

test('SAFETY: the hosted page carries the same CSP as the desktop app, stamped with its own script hash', async ({page}) => {
  const {readFileSync} = await import('node:fs');
  const {createRequire} = await import('node:module');
  const {stamp, policy} = createRequire(import.meta.url)('../csp.js');
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
  expect(stamp(html), 'index.html CSP is stale: run npm run stamp').toBe(html);
  const errors = await boot(page);
  expect(await page.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]').content)).toBe(policy(html));
  const ran = await page.evaluate(async () => {
    window.__ran = false;
    const d = document.createElement('div'); d.innerHTML = '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" onload="window.__ran=true">'; document.body.append(d);
    const s = document.createElement('script'); s.textContent = 'window.__ran=true'; document.body.append(s);
    await new Promise(r => setTimeout(r, 200)); return window.__ran;
  });
  expect(ran).toBe(false);
  expect(errors.filter(e => !/Content Security Policy/.test(e))).toEqual([]);
});

test('SAFETY: the inline script never contains a comment-open or a closing script tag (the HTML parser would mangle it and the CSP would block it)', async () => {
  const {readFileSync} = await import('node:fs');
  const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8'), s = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  expect(s.includes('<!--')).toBe(false);
  expect(/<\/script/i.test(s)).toBe(false);
});


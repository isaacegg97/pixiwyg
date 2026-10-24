// SECTION: style graphs, base primitives, effects from imported CSS
import {test, expect, boot, tb, M, freshPage, addP} from '../../tools/tests/helpers.mjs';

const T = (page, fn, arg) => page.evaluate(fn, arg);
const setup = page => T(page, async () => {
  const P = window.__pixiwyg; await P.newProject('Looks', false, {type: 'web'}, 'page'); await P.addLib('base.css');
  const s = P.state(), f = s.files.find(x => x.name === 'base.css');
  s.els.push({id: 'eshape', tag: 'div', fileId: f.id, selector: '.shape.star', x: 40, y: 60, w: 160, z: 9, content: ''},
    {id: 'evec', tag: 'div', fileId: f.id, selector: '.vector', x: 240, y: 60, w: 130, z: 9, content: '<svg viewBox="0 0 100 100"><path d="M50 88C20 66 6 48 6 30a20 20 0 0 1 44-6 20 20 0 0 1 44 6c0 18-14 36-44 58z"></path></svg>'},
    {id: 'etext', tag: 'span', fileId: f.id, selector: '.text.display', x: 40, y: 280, z: 9, content: 'Hello'});
  P.renderAll();
});
const target = (page, id) => T(page, id => { const h = window.__pixiwyg.hostOf(id).shadowRoot; return getComputedStyle(h.querySelector('.__body > *')); }, id);

test('one style colors a shape, a vector and text alike; shadows follow their outlines', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await setup(page);
  await T(page, () => window.__pixiwyg.select('eshape'));
  await page.locator('#ins .btn', {hasText: 'Make a style for this'}).click();
  await expect(page.locator('#nodeModal')).toBeVisible();
  await expect(page.locator('#nodeTitle')).toContainText('.px-div-style');
  await expect(page.locator('#nodePal')).toContainText('From your stylesheets');
  const host = page.locator('#nodePrevBox .stylehost');
  await expect(host).toBeAttached();
  await page.click('#nodeDone');
  const cls = await T(page, () => window.__pixiwyg.state().els.find(e => e.id === 'eshape').extra);
  expect(cls).toBe('px-div-style');
  await T(page, c => { const s = window.__pixiwyg.state(); for (const id of ['evec', 'etext']) s.els.find(e => e.id === id).extra = c; window.__pixiwyg.renderAll(); }, cls);
  const r = await T(page, () => {
    const P = window.__pixiwyg, cs = id => getComputedStyle(P.hostOf(id).shadowRoot.querySelector('.__body > *')), shape = cs('eshape'), vec = cs('evec'), text = cs('etext');
    const face = getComputedStyle(P.hostOf('eshape').shadowRoot.querySelector('.shape'), '::before'), path = getComputedStyle(P.hostOf('evec').shadowRoot.querySelector('path'));
    return {fill: shape.getPropertyValue('--fill').trim(), face: face.backgroundColor, path: path.fill, letters: text.color, shapeBox: shape.boxShadow, shapeFilter: shape.filter, textBg: text.backgroundColor};
  });
  expect(r).toMatchObject({fill: '#ff2e88', face: 'rgb(255, 46, 136)', path: 'rgb(255, 46, 136)', letters: 'rgb(255, 46, 136)', shapeBox: 'none', textBg: 'rgba(0, 0, 0, 0)'});
  expect(r.shapeFilter).toMatch(/drop-shadow\(rgb\(22, 18, 31\) 6px 6px 0px\)/);
  expect(errors).toEqual([]);
});

test('nodes compile to CSS: stacking where CSS stacks, motion with its keyframes, and nothing escapes a declaration', async ({page}) => {
  const errors = await boot(page);
  await setup(page);
  const css = await T(page, () => {
    const P = window.__pixiwyg, s = P.newStyleGraph('stack'), L = s.g.nodes[0];
    s.g.nodes.push({id: 'm', type: 'sMix', x: 0, y: 0, f: {}}, {id: 's2', type: 'sShadow', x: 0, y: 0, f: {x: -2, y: -2, blur: 4, spread: 0, c: '#00ffcc', inset: false}},
      {id: 'mo', type: 'sMotion', x: 0, y: 0, f: {m: 'wobble', dur: 900, times: 'forever', ease: 'linear'}}, {id: 'fi', type: 'sFilter', x: 0, y: 0, f: {blur: 0, bright: 120, contrast: 100, sat: 100, hue: 30, gray: 0, invert: 0, sepia: 0}},
      {id: 'x', type: 'sCss', x: 0, y: 0, f: {css: 'color:red}body{display:none;@import url(https://evil.example/x.css);background:url(https://evil.example/t.png) red;letter-spacing:2px'}});
    s.g.wires = s.g.wires.filter(w => w.bp !== 'shadow');
    s.g.wires.push({a: 'n3', ap: 'out', b: 'm', bp: 'a'}, {a: 's2', ap: 'out', b: 'm', bp: 'b'}, {a: 'm', ap: 'out', b: L.id, bp: 'shadow'},
      {a: 'mo', ap: 'out', b: L.id, bp: 'motion'}, {a: 'fi', ap: 'out', b: L.id, bp: 'fx'}, {a: 'x', ap: 'out', b: L.id, bp: 'text'});
    return P.compileStyle(P.cleanGraph(s.g, {style: true}), 'px-stack');
  });
  expect(css).toContain('box-shadow:6px 6px 0px 0px #16121f, -2px -2px 4px 0px #00ffcc');
  expect(css).toContain('animation:px-wobble 900ms linear infinite');
  expect(css).toContain('@keyframes px-wobble{');
  expect(css).toContain('filter:brightness(120%) hue-rotate(30deg)');
  expect(css).toContain('letter-spacing:2px');
  expect(css.split('\n')[0].match(/[{}]/g)).toEqual(['{', '}']);
  expect(css).not.toContain('evil.example');
  expect(css).not.toContain('@import');
  expect(errors).toEqual([]);
});

test('effects found in imported CSS become nodes: pick one from the palette and it styles the element', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await setup(page);
  await T(page, async () => { await window.__pixiwyg.addLib('nes.css'); });
  const kinds = await T(page, () => [...new Set(window.__pixiwyg.fxLibrary().map(x => x.kind))]);
  expect(kinds).toEqual(expect.arrayContaining(['Shadows', 'Gradients', 'Motion', 'Filters']));
  await tb(page, '#stylesBtn');
  await expect(page.locator('#nodeModal')).toBeVisible();
  const before = await T(page, () => window.__pixiwyg.state().styleGraphs[0].g.nodes.length);
  await page.locator('#nodePal summary', {hasText: 'Shadows'}).first().click();
  await page.locator('#nodePal details[open] .fxbtn').first().click();
  const fx = await T(page, () => { const g = window.__pixiwyg.state().styleGraphs[0].g; return g.nodes.find(n => n.type === 'sFx'); });
  expect(fx.f.css).toMatch(/^box-shadow:/);
  expect(fx.f.from).toMatch(/nes\.css$/);
  expect(await T(page, () => window.__pixiwyg.state().styleGraphs[0].g.nodes.length)).toBe(before + 1);
  await T(page, () => { const P = window.__pixiwyg, s = P.state().styleGraphs[0], fx = s.g.nodes.find(n => n.type === 'sFx'), L = s.g.nodes.find(n => n.type === 'look');
    s.g.wires = s.g.wires.filter(w => w.bp !== 'shadow'); s.g.wires.push({a: fx.id, ap: 'out', b: L.id, bp: 'shadow'}); P.syncNodeSheet(true);
    P.state().els.push({id: 'eplain', tag: 'p', fileId: null, selector: null, x: 400, y: 300, w: 200, z: 9, content: 'Plain', extra: P.styleClasses().get(s.id)}); P.renderAll(); });
  const expected = await T(page, () => window.__pixiwyg.state().styleGraphs[0].g.nodes.find(n => n.type === 'sFx').f.css.slice('box-shadow:'.length));
  const got = (await target(page, 'eplain')).boxShadow;
  expect(got).not.toBe('none');
  expect(expected.length).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test('projects keep the graphs, not the CSS; renaming a style takes its elements along; exports carry what is used', async ({page}) => {
  const errors = await boot(page);
  await setup(page);
  const r = await T(page, async () => {
    const P = window.__pixiwyg, s = P.state(), a = P.newStyleGraph('alpha'), b = P.newStyleGraph('beta'); P.syncNodeSheet(true);
    const c = P.styleClasses(); s.els.find(e => e.id === 'eshape').extra = c.get(a.id); P.renderAll();
    a.g.nodes.find(n => n.type === 'look').f.name = 'Hot Pink'; P.syncNodeSheet(true);
    const renamed = s.els.find(e => e.id === 'eshape').extra;
    const gen = s.files.find(f => f.gen).text, f1 = P.packProject(), k = P.filesKey(f1), mf = f1.get('manifest.json'), man = JSON.parse(typeof mf === 'string' ? mf : new TextDecoder().decode(mf));
    await P.openFiles(new Map(await P.unzip(P.zipFiles(P.sortEntries(f1)))), {});
    const html = await (async () => { P.expOpt.nojs = true; P.expOpt.prune = true; return P.buildExport(); })();
    return {renamed, graphs: man.styleGraphs.length, listed: man.stylesheets.map(x => x.name), same: P.filesKey(P.packProject()) === k, regenerated: P.state().files.find(f => f.gen).text === gen,
      kept: P.state().els.find(e => e.extra === 'px-hot-pink') != null, exportHas: html.includes('.px-hot-pink.px-hot-pink.px-hot-pink'), exportSkips: !html.includes('px-beta')};
  });
  expect(r).toEqual({renamed: 'px-hot-pink', graphs: 2, listed: ['base.css'], same: true, regenerated: true, kept: true, exportHas: true, exportSkips: true});
  expect(errors).toEqual([]);
});

test('the parts bin has the basics: text, shapes and vectors, ready to drop', async ({page}) => {
  const errors = await boot(page);
  const r = await T(page, async () => { const P = window.__pixiwyg; await P.seedKit(); const list = P.prims.list.filter(p => p.collection === 'Basics');
    await P.newProject('Parts', false, {type: 'web'}, 'page'); const star = list.find(p => p.name === 'Star'); await P.usePrim(star, {x: 100, y: 100});
    const el = P.state().els.at(-1); return {n: list.length, names: list.map(p => p.name).slice(0, 4), sel: el.selector, sheet: P.state().files.some(f => f.name === 'base.css')}; });
  expect(r.n).toBeGreaterThan(20);
  expect(r.sel).toBe('.shape.star');
  expect(r.sheet).toBe(true);
  expect(errors).toEqual([]);
});

test('an imported rule opens as nodes: same look at first, each node edits one thing, the sheet is never written', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  const CSS = '.card{background:#ffee00;color:rgb(20,30,40);border:3px dashed #123456;border-radius:12px;box-shadow:4px 4px 0 #000,0 0 8px red;font-family:Georgia;font-size:20px;letter-spacing:2px;transform:rotate(3deg) scale(1.1);opacity:.9;filter:blur(1px) brightness(1.2);cursor:pointer;padding:10px 14px}.card:hover{background:#000}';
  const props = ['background-color', 'color', 'border-top-style', 'border-top-color', 'border-top-left-radius', 'box-shadow', 'font-family', 'font-size', 'letter-spacing', 'transform', 'opacity', 'filter', 'cursor', 'padding-left'];
  const before = await T(page, async ([css, props]) => {
    const P = window.__pixiwyg; await P.newProject('Rule', false, {type: 'web'}, 'page');
    const f = P.addFile('mine.css', css); P.afterFilesChanged();
    const s = P.state(); s.els.push({id: 'ecard', tag: 'div', fileId: f.id, selector: '.card', x: 60, y: 60, w: 260, z: 9, content: 'A card'}); P.renderAll(); P.select('ecard');
    const cs = getComputedStyle(P.hostOf('ecard').shadowRoot.querySelector('.__body > *'));return Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)]));
  }, [CSS, props]);
  await page.locator('#ins .btn', {hasText: 'Open as nodes'}).click();
  await expect(page.locator('#nodeModal')).toBeVisible();
  const r = await T(page, ([css, props]) => {
    const P = window.__pixiwyg, s = P.state(), g = s.styleGraphs[s.styleGraphs.length - 1], el = s.els.find(e => e.id === 'ecard');
    const cs = getComputedStyle(P.hostOf('ecard').shadowRoot.querySelector('.__body > *'));
    return {types: g.g.nodes.map(n => n.type).sort(), css: g.g.nodes.filter(n => n.type === 'sCss').map(n => n.f.css).join(''), wears: el.extra, after: Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)])),
      sheet: s.files.find(f => f.name === 'mine.css').text === css, status: document.getElementById('status').textContent};
  }, [CSS, props]);
  // RULE: everything that has a node gets one; the rest rides in a CSS node, unchanged.
  for (const t of ['sFill', 'sLine', 'sShape', 'sShadow', 'sType', 'sMove', 'sBlend', 'sFilter', 'sCss', 'look']) expect(r.types, t).toContain(t);
  expect(r.types.filter(t => t === 'sShadow').length).toBe(2);
  expect(r.css).toContain('cursor:pointer');
  expect(r.css).toContain('padding');
  expect(r.wears).toMatch(/px-card-nodes/);
  expect(r.after).toEqual(before);
  expect(r.sheet).toBe(true);
  expect(r.status).toContain('state variant');
  // RULE: editing a node changes that one thing over the sheet.
  const bg = await T(page, () => { const P = window.__pixiwyg, s = P.state(), g = s.styleGraphs[s.styleGraphs.length - 1].g, fill = g.nodes.find(n => n.type === 'sFill' && n.f.on === 'background'); fill.f.c = '#00ff00'; P.syncNodeSheet(true);
    return getComputedStyle(P.hostOf('ecard').shadowRoot.querySelector('.__body > *')).backgroundColor; });
  expect(bg).toBe('rgb(0, 255, 0)');
  // RULE: opening the same rule again on the same element reopens its graph instead of making another.
  await page.keyboard.press('Escape');
  const n = await T(page, () => window.__pixiwyg.state().styleGraphs.length);
  await T(page, () => window.__pixiwyg.openRuleAsNodes());
  expect(await T(page, () => window.__pixiwyg.state().styleGraphs.length)).toBe(n);
  expect(errors).toEqual([]);
});

test('a library rule written with var() shorthands opens as nodes and still looks exactly the same', async ({page}) => {
  const errors = await boot(page);
  const props = ['background-color', 'background-image', 'color', 'text-shadow', 'font-family', 'font-size', 'transform', 'clip-path', 'padding-left', 'display', 'animation-name'];
  const r = await T(page, async props => {
    const P = window.__pixiwyg; await P.newProject('Rule', false, {type: 'web'}, 'page');
    const f = await P.addLib('dredful.css'); P.afterFilesChanged();
    const s = P.state(); s.els.push({id: 'eh', tag: 'h1', fileId: f.id, selector: 'h1.eldritch', x: 60, y: 60, w: 520, z: 9, content: 'THE DREAD'}); P.renderAll(); P.select('eh');
    const read = () => { const cs = getComputedStyle(P.hostOf('eh').shadowRoot.querySelector('.__body > *')); return Object.fromEntries(props.map(p => [p, cs.getPropertyValue(p)])); };
    const before = read(); const g = P.openRuleAsNodes(); const after = read();
    return {before, after, types: g.g.nodes.map(n => n.type), bgSplit: g.g.nodes.some(n => n.type === 'sFill' && n.f.on === 'background') && !g.g.nodes.some(n => n.type === 'sCss' && /(^|;)background:/.test(n.f.css))};
  }, props);
  expect(r.after).toEqual(r.before);
  expect(r.types.filter(t => t === 'sTShadow').length).toBe(3);
  expect(r.bgSplit).toBe(true);
  expect(errors).toEqual([]);
});

test('a color scheme recolors the page, and undo takes it back', async ({page}) => {
  const errors = await freshPage(page);
  await T(page, () => window.__pixiwyg.schemes());
  const before = await T(page, () => JSON.stringify(window.__pixiwyg.state().palette));
  const name = await T(page, () => { const P = window.__pixiwyg, s = P.schemeFromEntry(P.SCHEMES()[7]); P.setPalette(s); return s.name; });
  expect(await T(page, () => window.__pixiwyg.state().palette.name)).toBe(name);
  expect(await T(page, () => window.__pixiwyg.state().palette.c.every(c => /^#[0-9a-f]{6}$/.test(c)))).toBe(true);
  await T(page, () => window.__pixiwyg.undo());
  expect(await T(page, () => JSON.stringify(window.__pixiwyg.state().palette))).toBe(before);
  expect(errors).toEqual([]);
});

test('load style set: hotkey and menu open it, the preview shows what each sheet brings, replace turns the old ones off', async ({page}) => {
  const errors = await freshPage(page);
  const before = await T(page, () => window.__pixiwyg.state().files.filter(f => f.enabled).map(f => f.name));
  await page.keyboard.press(`${M}+Shift+O`);
  await expect(page.locator('#ssetModal')).toBeVisible();
  await expect(page.locator('#ssetGo')).toBeDisabled();
  await page.selectOption('#ssetLib', 'xerox.css');
  await expect(page.locator('#ssetList .ssrow')).toHaveCount(1);
  await page.setInputFiles('#ssetFiles', {name: 'mine.css', mimeType: 'text/css', buffer: Buffer.from('h1.big{font-size:80px}button.go{color:red}p{margin:0}@font-face{font-family:X;src:local(Arial)}')});
  await expect(page.locator('#ssetList .ssrow')).toHaveCount(2);
  const mine = page.locator('#ssetList .ssrow', {hasText: 'mine.css'});
  await expect(mine).toContainText('3 styles · 1 font');
  await expect(mine.locator('.sschip')).toHaveText(['h1 1', 'button 1', 'p 1']);
  expect(await T(page, () => window.__pixiwyg.state().files.some(f => f.name === 'mine.css'))).toBe(false);
  await page.selectOption('#ssetMode', 'replace');
  await expect(page.locator('#ssetGo')).toHaveText('Load 2 stylesheets');
  await page.click('#ssetGo');
  await expect(page.locator('#ssetModal')).toBeHidden();
  // INVARIANT: the dialog closes first and loading finishes after, so wait for the sheets, not the dialog.
  await expect.poll(() => T(page, () => window.__pixiwyg.state().files.filter(f => f.enabled).map(f => f.name).sort())).toEqual(['mine.css', 'xerox.css']);
  const after = await T(page, () => window.__pixiwyg.state().files.map(f => ({name: f.name, on: f.enabled})));
  for (const n of before) expect(after.find(f => f.name === n)).toMatchObject({on: false});
  await T(page, () => document.getElementById('t-files').click()); await page.click('#ssetOpen');
  await expect(page.locator('#ssetModal')).toBeVisible();
  await page.click('#ssetClose');
  await expect(page.locator('#ssetModal')).toBeHidden();
  expect(errors).toEqual([]);
});

test('text effects drilldown: from the element menu, select words, wave and highlight them, export keeps them, remove one', async ({page}) => {
  const errors = await freshPage(page);
  const id = await addP(page, 'Make some noise tonight', 120, 120);
  const h = await T(page, id => { const r = window.__pixiwyg.hostOf(id).getBoundingClientRect(); return {x: r.x + 20, y: r.y + 10}; }, id);
  await page.mouse.dblclick(h.x, h.y);
  await page.locator('#ctxMenu .cmitem', {hasText: 'Text effects'}).click();
  await expect(page.locator('#tfxModal')).toBeVisible();
  const pick = word => T(page, word => { const box = document.getElementById('tfxText'), w = document.createTreeWalker(box, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { const i = n.nodeValue.indexOf(word); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + word.length); getSelection().removeAllRanges(); getSelection().addRange(r); return true; } } return false; }, word);
  await page.locator('#tfxList .fxitem', {hasText: 'Wave'}).click();
  expect(await pick('noise')).toBe(true);
  await page.click('#tfxApply');
  await page.locator('#tfxList .fxitem', {hasText: 'Highlighter'}).click();
  expect(await pick('tonight')).toBe(true);
  await page.click('#tfxApply');
  const r = await T(page, async id => { const P = window.__pixiwyg, el = P.state().els.find(e => e.id === id), t = P.hostOf(id)._target, w = t.querySelector('[data-pxfx=wave]');
    const prev = P.expOpt.nojs; P.expOpt.nojs = true; const html = await P.buildExport(); P.expOpt.nojs = prev;
    return {letters: w && w.querySelectorAll(':scope>span').length, anim: w && getComputedStyle(w.firstElementChild).animationName, hl: !!t.querySelector('[data-pxfx=highlight]'),
      text: t.textContent, kf: /@keyframes pxfx-wave/.test(html), inExport: /data-pxfx="wave"/.test(html), used: document.querySelectorAll('#tfxUsed .refrow').length}; }, id);
  expect(r).toEqual({letters: 5, anim: 'pxfx-wave', hl: true, text: 'Make some noise tonight', kf: true, inExport: true, used: 2});
  // RULE: an applied effect reopens with its own settings; Update changes it in place, or swaps it for another effect.
  await page.locator('#tfxUsed .refrow', {hasText: 'Highlighter'}).locator('.tfxname').click();
  await expect(page.locator('#tfxApply')).toHaveText('Update this effect');
  expect(await page.locator('#tfxParams input[type=color]').inputValue()).toBe('#fff176');
  await page.locator('#tfxParams input[type=color]').fill('#00ff00');
  await page.click('#tfxApply');
  const up = await T(page, id => { const t = window.__pixiwyg.hostOf(id)._target, s = t.querySelector('[data-pxfx=highlight]');
    return [s && s.textContent, s && JSON.parse(s.dataset.pxfxP).c, document.querySelectorAll('#tfxUsed .refrow').length, document.getElementById('tfxApply').textContent]; }, id);
  expect(up).toEqual(['tonight', '#00ff00', 2, 'Apply to selection']);
  await page.locator('#tfxUsed .refrow', {hasText: 'Highlighter'}).locator('.tfxname').click();
  expect(await page.locator('#tfxParams input[type=color]').inputValue()).toBe('#00ff00');
  await page.locator('#tfxList .fxitem', {hasText: 'Bounce'}).click();
  await page.click('#tfxApply');
  expect(await T(page, id => { const t = window.__pixiwyg.hostOf(id)._target; return [!!t.querySelector('[data-pxfx=highlight]'), t.querySelector('[data-pxfx=bounce]')?.textContent, t.textContent]; }, id))
    .toEqual([false, 'tonight', 'Make some noise tonight']);
  await page.locator('#tfxUsed .refrow', {hasText: 'Wave'}).locator('button.ico').click();
  expect(await T(page, id => { const t = window.__pixiwyg.hostOf(id)._target; return [!!t.querySelector('[data-pxfx=wave]'), t.textContent]; }, id)).toEqual([false, 'Make some noise tonight']);
  await T(page, () => window.__pixiwyg.undo());
  expect(await T(page, id => !!window.__pixiwyg.hostOf(id)._target.querySelector('[data-pxfx=wave]'), id)).toBe(true);
  await page.click('#tfxDone');
  // RULE: the project's own node styles are offered by name and apply as their class.
  await T(page, () => { const P = window.__pixiwyg; P.newStyleGraph('Zine pop'); P.syncNodeSheet(true); });
  await T(page, id => window.__pixiwyg.openTextFx(window.__pixiwyg.state().els.find(e => e.id === id)), id);
  await page.locator('#tfxList .fxitem', {hasText: 'Zine pop'}).click();
  expect(await pick('Make')).toBe(true);
  await page.click('#tfxApply');
  expect(await T(page, id => { const s = window.__pixiwyg.hostOf(id)._target.querySelector('[data-pxfx^="style:"]'); return s && s.className; }, id)).toBe('px-zine-pop');
  expect(errors).toEqual([]);
});

test('an element’s own color carries through its style’s shading: bevels, ::after, hover', async ({page, context}) => {
  const errors = await boot(page);
  const shade = () => page.evaluate(() => { const T = window.__pixiwyg, el = T.state().els.find(e => e.id === 'enes'), t = T.hostOf(el.id).shadowRoot.querySelector('button');
    return {after: getComputedStyle(t, '::after').boxShadow, bg: getComputedStyle(t).backgroundColor}; });
  await page.evaluate(async () => {
    const T = window.__pixiwyg; await T.newProject('NES', true, {type: 'web'});
    const f = T.addFile('nes.css', await T.fetchLib('nes.css')); T.afterFilesChanged();
    T.state().els.push({id: 'enes', tag: 'button', fileId: f.id, selector: '.nes-btn.is-success', x: 40, y: 40, z: 999, content: 'Go'});
    T.renderAll();
  });
  const before = await shade();
  expect(before.after).toContain('rgb(74, 165, 46)');
  await page.evaluate(() => { const T = window.__pixiwyg; T.state().els.find(e => e.id === 'enes').colors = {bg: {c: '#000000', role: null}}; T.renderAll(); });
  const after = await shade();
  expect(after.bg).toBe('rgb(0, 0, 0)');
  const rgb = after.after.match(/rgb\((\d+), (\d+), (\d+)\)/).slice(1).map(Number);
  expect(Math.max(...rgb) - Math.min(...rgb)).toBeLessThan(8);
  expect(rgb[0]).toBeLessThan(40);
  const hover = await page.evaluate(() => { const sh = window.__pixiwyg.hostOf('enes').shadowRoot.adoptedStyleSheets.find(s => [...s.cssRules].some(r => /:hover/.test(r.selectorText || '')) && s.cssRules.length < 200);
    return sh && [...sh.cssRules].filter(r => /is-success:hover$/.test(r.selectorText || '')).map(r => r.style.backgroundColor); });
  expect(hover.length).toBeGreaterThan(0);
  for (const c of hover) { const v = c.match(/\d+/g).map(Number); expect(Math.max(...v) - Math.min(...v)).toBeLessThan(8); }
  const html = await page.evaluate(async () => { const T = window.__pixiwyg; T.expOpt.nojs = true; return T.buildExport(); });
  const out = await context.newPage(); await out.setContent(html);
  const exp = await out.evaluate(() => { let found; for (const h of document.querySelectorAll('.el')) { const b = h.shadowRoot.querySelector('button.nes-btn.is-success'); if (b && b.textContent === 'Go') found = getComputedStyle(b, '::after').boxShadow; } return found; });
  expect(exp).toBe(after.after);
  expect(errors).toEqual([]);
});

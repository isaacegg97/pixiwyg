// SECTION: editing on the page: keys, handles, sizes, tables, backgrounds, checks
import {test, expect, boot, ws, tb, T, M, freshPage, addP} from '../../tools/tests/helpers.mjs';

test('keyboard: nudge, grid nudge, duplicate, delete, undo and redo', async ({page}) => {
  const errors = await freshPage(page);
  const id = await addP(page, 'keys');
  await page.locator('#desk').focus();
  const pos = () => T(page, id => { const e = window.__pixiwyg.state().els.find(x => x.id === id); return e && [e.x, e.y]; }, id);
  const [x0, y0] = await pos();
  await page.keyboard.press('ArrowRight');
  expect((await pos())[0]).toBe(x0 + 1);
  await page.keyboard.press('Shift+ArrowDown');
  expect((await pos())[1]).toBeGreaterThan(y0 + 1);
  const n = await T(page, () => window.__pixiwyg.state().els.length);
  await page.keyboard.press(`${M}+j`);
  expect(await T(page, () => window.__pixiwyg.state().els.length)).toBe(n + 1);
  await page.keyboard.press('Delete');
  expect(await T(page, () => window.__pixiwyg.state().els.length)).toBe(n);
  await page.keyboard.press(`${M}+z`);
  expect(await T(page, () => window.__pixiwyg.state().els.length)).toBe(n + 1);
  await page.keyboard.press(`${M}+Shift+z`);
  expect(await T(page, () => window.__pixiwyg.state().els.length)).toBe(n);
  for (const [k, ws] of [['1', 'page'], ['2', 'write'], ['4', 'music'], ['5', 'animate'], ['1', 'page']]) {
    await page.keyboard.press(`Alt+${k}`);
    expect(await T(page, () => window.__pixiwyg.ws())).toBe(ws);
  }
  await page.keyboard.press(`${M}+p`);
  await expect(page.locator('#filesPop')).toBeVisible();
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('background layers stack on the page, survive a round trip, and undo', async ({page}) => {
  const errors = await freshPage(page);
  await T(page, () => window.__pixiwyg.setSide('sideR', true));
  const layers = () => T(page, () => window.__pixiwyg.state().bgd.layers.map(l => l.type));
  const start = await layers();
  await page.locator('#bgAdd').selectOption('radial');
  await page.locator('#bgAdd').selectOption('pattern');
  expect(await layers()).toEqual(['pattern', 'radial', ...start]);
  expect(await T(page, () => getComputedStyle(document.getElementById('stage')).backgroundImage)).toMatch(/radial-gradient/);
  const manifest = await T(page, () => { const f = window.__pixiwyg.packProject().get('manifest.json'); return typeof f === 'string' ? f : new TextDecoder().decode(f); });
  expect(manifest).toMatch(/"radial"/);
  expect(manifest).toMatch(/"pattern"/);
  await T(page, () => window.__pixiwyg.undo());
  expect((await layers()).length).toBe(start.length + 1);
  expect(errors).toEqual([]);
});

test('a table edits as rows and columns, never as markup', async ({page}) => {
  const errors = await freshPage(page);
  const id = await T(page, () => {
    const P = window.__pixiwyg, S = P.state(), el = {id: 'tb', tag: 'table', content: '<tr><th>A</th><th>B</th></tr><tr><td>1</td><td>2</td></tr>', x: 100, y: 100, w: 300, z: 1, fileId: null, selector: null};
    S.els.push(el); P.renderAll(); P.select(el.id); P.openStructWindow(el); return el.id;
  });
  await expect(page.locator('#sedModal')).toBeVisible();
  await page.locator('#sedBody button', {hasText: '+ Row'}).click();
  await page.locator('#sedBody button', {hasText: '+ Column'}).click();
  const cells = await T(page, id => { const h = window.__pixiwyg.hostOf(id); return [h.shadowRoot.querySelectorAll('tr').length, h.shadowRoot.querySelector('tr').children.length]; }, id);
  expect(cells).toEqual([3, 3]);
  await page.locator('#sedBody input[type=text]').first().fill('<img src=x onerror=alert(1)>Name');
  await page.locator('#sedBody input[type=text]').first().dispatchEvent('input');
  expect(await T(page, id => window.__pixiwyg.state().els.find(e => e.id === id).content, id)).not.toMatch(/<img/);
  await page.locator('#sedClose').click();
  await expect(page.locator('#sedModal')).toBeHidden();
  expect(errors).toEqual([]);
});

test('checks: low contrast (with a one-click fix), pictures with no description, nameless buttons, skipped headings', async ({page}) => {
  const errors = await freshPage(page);
  await T(page, () => {
    const P = window.__pixiwyg, S = P.state(), add = (id, tag, content, y, extra = {}) => S.els.push({id, tag, content, x: 40, y, w: 300, z: 1, fileId: null, selector: null, ...extra});
    add('h1', 'h1', 'Title', 20);
    add('faint', 'p', 'Hard to read', 100, {colors: {fg: {c: '#dddddd', role: null}}});
    add('h3', 'h3', 'Skipped', 160);
    add('pic', 'img', undefined, 220, {w: 40});
    add('btn', 'button', '', 300);
    add('fine', 'p', 'Easy to read', 360);
    P.renderAll(); P.setSide('sideR', true);
  });
  await T(page, () => { document.getElementById('w-checks').open = true; });
  await page.locator('#chkRun').click();
  const kinds = await T(page, () => window.__pixiwyg.a11yCheck().map(x => `${x.kind}:${x.id}`));
  expect(kinds.sort()).toEqual(['alt:pic', 'contrast:faint', 'heading:h3', 'name:btn']);
  await expect(page.locator('#chkTitle')).toHaveText('Checks · ⚠ 4');
  await page.locator('#chkList li', {hasText: 'Text contrast'}).locator('button.btn').click();
  expect(await T(page, () => window.__pixiwyg.a11yCheck().some(x => x.id === 'faint'))).toBe(false);
  await page.locator('#chkList li', {hasText: 'no description'}).locator('button.go').click();
  expect(await T(page, () => window.__pixiwyg.state().sel)).toBe('pic');
  await T(page, () => window.__pixiwyg.undo());
  expect(await T(page, () => window.__pixiwyg.a11yCheck().some(x => x.id === 'faint'))).toBe(true);
  expect(errors).toEqual([]);
});

test('FIX: an ink-only heading selects as wide as its text, not its layout width; a painted box keeps its width', async ({page}) => {
  const errors = await freshPage(page);
  const r = await T(page, async () => {
    const P = window.__pixiwyg; await P.openExample('artist'); P.setWorkspace('page'); await document.fonts.ready;
    const S = P.state(), h1 = S.els.find(e => e.selector === 'h1.outline'), win = S.els.find(e => e.selector === '.window');
    P.select(h1.id);
    const host = P.hostOf(h1.id), t = host._target, rg = document.createRange(); rg.selectNodeContents(t);
    const ink = Math.max(...[...rg.getClientRects()].map(q => q.right)) - host.getBoundingClientRect().left;
    const sb = document.getElementById('selbox').getBoundingClientRect();
    return {box: P.elBox(h1).w, layout: host.offsetWidth * (h1.sx || 1), ink, sel: sb.width, win: P.elBox(win).w, winLayout: P.hostOf(win.id).offsetWidth};
  });
  expect(r.box).toBeLessThan(r.layout * 0.8);
  expect(r.box).toBeGreaterThanOrEqual(r.ink - 1);
  expect(r.box).toBeLessThanOrEqual(r.ink + 12);
  expect(Math.abs(r.sel - r.box)).toBeLessThanOrEqual(8);
  expect(r.win).toBe(r.winLayout);
  expect(errors).toEqual([]);
});

test('handles scale like an image editor: freely, with Shift in proportion, with Alt from the center', async ({page}) => {
  await page.setViewportSize({width: 1800, height: 900});
  await boot(page);
  const id = await page.evaluate(async () => {
    const T = window.__pixiwyg; await T.newProject('Scale', true, {type: 'web'});
    const s = T.state(); s.snap = false; s.grid = 0;
    await new Promise(r => setTimeout(r, 300));
    const el = s.els.find(e => e.tag === 'h1'); T.select(el.id); return el.id;
  });
  await expect(page.locator('#selbox .h[data-d="se"]')).toBeVisible();
  const box = () => page.evaluate(id => { const T = window.__pixiwyg, el = T.state().els.find(e => e.id === id), r = document.getElementById('selbox').getBoundingClientRect();
    return {sx: el.sx || 1, sy: el.sy || 1, cx: r.left + r.width / 2, cy: r.top + r.height / 2, l: r.left, t: r.top}; }, id);
  const drag = async (d, dx, dy, keys = []) => {
    const h = await page.locator(`#selbox .h[data-d="${d}"]`).boundingBox(), x = h.x + h.width / 2, y = h.y + h.height / 2;
    await page.mouse.move(x, y); await page.mouse.down();
    for (const k of keys) await page.keyboard.down(k);
    await page.mouse.move(x + dx / 2, y + dy / 2); await page.mouse.move(x + dx, y + dy);
    await page.mouse.up(); for (const k of keys) await page.keyboard.up(k);
  };
  const a = await box();
  await drag('se', 120, 10);
  const b = await box();
  expect(b.sx).toBeGreaterThan(1.05);
  expect(Math.abs(b.sx - b.sy)).toBeGreaterThan(.05);
  expect(Math.abs(b.l - a.l)).toBeLessThan(2);
  await page.evaluate(id => { const T = window.__pixiwyg; T.undo(); T.select(id); }, id);
  await drag('se', 120, 10, ['Shift']);
  const c = await box();
  expect(c.sx).toBeCloseTo(c.sy, 3);
  expect(c.sx).toBeGreaterThan(1.05);
  await page.evaluate(id => { const T = window.__pixiwyg; T.undo(); T.select(id); }, id);
  const a2 = await box();
  await drag('e', 80, 0, ['Alt']);
  const d = await box();
  expect(d.sy).toBe(a2.sy);
  expect(Math.abs(d.cx - a2.cx)).toBeLessThan(2);
  const kept = await page.evaluate(async id => { const T = window.__pixiwyg, f = T.packProject(), k = T.filesKey(f);
    await T.openFiles(new Map(await T.unzip(T.zipFiles(T.sortEntries(f)))), {}); return T.filesKey(T.packProject()) === k && (m => JSON.parse(typeof m === 'string' ? m : new TextDecoder().decode(m)))(f.get('manifest.json')).elements.some(e => e.sx > 1); }, id);
  expect(kept).toBe(true);
});

test('W and H always show the size it really is: after scaling, typing a size, or the content changing', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await page.evaluate(async () => { const T = window.__pixiwyg; await T.newProject('Size', true, {type: 'web'}, 'page'); await new Promise(r => setTimeout(r, 300)); T.state().snap = false; T.state().grid = 0;
    const el = T.state().els.find(e => e.tag === 'h1'); T.select(el.id); });
  const real = () => page.evaluate(() => { const T = window.__pixiwyg, el = T.state().els.find(e => e.id === T.state().sel), b = T.elBox(el); return {w: Math.round(b.w), h: Math.round(b.h)}; });
  const shown = async () => ({w: +(await page.locator('#ins [data-pos=w]').inputValue()), h: +(await page.locator('#ins [data-pos=h]').inputValue())});
  expect(await shown()).toEqual(await real());
  const hb = await page.locator('#selbox .h[data-d="se"]').boundingBox();
  await page.mouse.move(hb.x + 5, hb.y + 5); await page.mouse.down(); await page.mouse.move(hb.x + 80, hb.y + 40, {steps: 4}); await page.mouse.up();
  expect(await shown()).toEqual(await real());
  const r0 = await real();
  await page.locator('#ins [data-pos=w]').fill('600'); await page.locator('#ins [data-pos=w]').press('Enter');
  const r1 = await real();
  expect(r1.w).toBe(600);
  expect(Math.abs(r1.h / r1.w - r0.h / r0.w)).toBeLessThan(.01);
  expect(await shown()).toEqual(r1);
  await page.locator('#insLock').uncheck();
  await page.locator('#ins [data-pos=h]').fill('50'); await page.locator('#ins [data-pos=h]').press('Enter');
  expect(await real()).toEqual({w: 600, h: 50});
  await page.evaluate(() => { const T = window.__pixiwyg, el = T.state().els.find(e => e.id === T.state().sel); el.content = 'A much longer headline that wraps onto more lines than before'; T.renderAll(); T.select(el.id); });
  await expect.poll(async () => JSON.stringify(await shown())).toBe(JSON.stringify(await real()));
  await page.locator('#ins [data-pos=wrap]').fill('300');
  expect(await page.evaluate(() => window.__pixiwyg.state().els.find(e => e.id === window.__pixiwyg.state().sel).w)).toBe(300);
  await expect.poll(async () => JSON.stringify(await shown())).toBe(JSON.stringify(await real()));
  await page.locator('#insLock').check();
  expect(errors).toEqual([]);
});

test('FIX: hovering traces the box a click would select (the ink, not the layout width); the command window keeps its list inside', async ({page}) => {
  const errors = await freshPage(page);
  const id = await addP(page, 'Hi', 200, 200);
  await T(page, () => { const P = window.__pixiwyg; P.select(null); });
  const host = page.locator(`#layer .el[data-id="${id}"]`), hb = await host.boundingBox();
  await page.mouse.move(hb.x + 6, hb.y + hb.height / 2);
  await expect(page.locator('#hoverbox')).toBeVisible();
  const [hover, ink, layout] = await T(page, id => { const P = window.__pixiwyg, el = P.state().els.find(e => e.id === id); return [parseFloat(document.getElementById('hoverbox').style.width), P.elBox(el).w, P.hostOf(id).offsetWidth]; }, id);
  expect(hover).toBeCloseTo(ink, 0); expect(hover).toBeLessThan(layout / 2);
  await page.mouse.move(5, 300);
  await expect(page.locator('#hoverbox')).toBeHidden();
  // FIX: a theme with a taller title bar pushed the command list out of its window.
  await T(page, () => window.__pixiwyg.setTheme('t:dredful'));
  await page.keyboard.press('/');
  await expect(page.locator('#cmdModal')).toBeVisible();
  const fit = await T(page, () => { const w = document.querySelector('.cmdwin').getBoundingClientRect(), l = document.getElementById('cmdList').getBoundingClientRect(); return l.bottom <= w.bottom + 0.5 && l.height > 100; });
  expect(fit).toBe(true);
  expect(errors).toEqual([]);
});

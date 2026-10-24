// SECTION: Paint Studio layers and palettes: the stack, blending, frames with layers, palettes that move, zoom
import {test, expect, boot, T, M} from '../../tools/tests/helpers.mjs';

const paintWs = page => T(page, async () => { const P = window.__pixiwyg; await P.newProject('Layers', true, {type: 'web'}); P.setWorkspace('paint'); });
// FORMAT: fx, fy, fw, fh are fractions of the canvas, so the tests hold at any device pixel ratio.
const fill = (page, color, fx, fy, fw, fh) => T(page, ([c, fx, fy, fw, fh]) => {
  const p = document.getElementById('paint'), g = p.getContext('2d'); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = c;
  g.fillRect(Math.round(fx * p.width), Math.round(fy * p.height), Math.round(fw * p.width), Math.round(fh * p.height)); g.restore();
}, [color, fx, fy, fw, fh]);
const flatPx = (page, fx, fy) => T(page, async ([fx, fy]) => {
  const i = new Image(); i.src = window.__pixiwyg.flatURL(); await i.decode();
  const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
  return Array.from(g.getImageData(Math.floor(fx * i.width), Math.floor(fy * i.height), 1, 1).data);
}, [fx, fy]);
const layerPx = (page, fx, fy) => T(page, ([fx, fy]) => { const p = document.getElementById('paint'); return Array.from(p.getContext('2d').getImageData(Math.floor(fx * p.width), Math.floor(fy * p.height), 1, 1).data); }, [fx, fy]);
const names = page => T(page, () => window.__pixiwyg.layers().map(l => l.name));
const RED = [255, 0, 0, 255], BLUE = [0, 0, 255, 255], CLEAR = [0, 0, 0, 0];

test('layers stack, blend, hide, reorder, merge and delete, every step undoes, and the drawing leaves flattened', async ({page}) => {
  const errors = await boot(page); await paintWs(page);
  expect(await names(page)).toEqual(['Layer 1']);
  await fill(page, '#ff0000', 0, 0, .5, 1);
  await page.click('#lyAdd');
  expect(await T(page, () => window.__pixiwyg.layers().map(l => l.active))).toEqual([false, true]);
  await fill(page, '#0000ff', .25, 0, .75, 1);
  expect([await flatPx(page, .1, .5), await flatPx(page, .4, .5), await flatPx(page, .9, .5)]).toEqual([RED, BLUE, BLUE]);
  // RULE: the live stack shows what the flattened drawing will be: the same blend, by CSS and by canvas.
  await page.selectOption('#lyBlend', 'multiply');
  expect(await page.locator('#paint').evaluate(c => getComputedStyle(c).mixBlendMode)).toBe('multiply');
  expect([await flatPx(page, .4, .5), await flatPx(page, .9, .5)]).toEqual([[0, 0, 0, 255], BLUE]);
  await page.selectOption('#lyBlend', 'source-over');
  await page.locator('#lyOpacity').fill('50');
  const half = await flatPx(page, .4, .5);
  expect(Math.abs(half[0] - 128) < 4 && Math.abs(half[2] - 127) < 4).toBe(true);
  await page.locator('#lyOpacity').fill('100');
  // RULE: hidden layers stay out of the drawing, and can't be painted on.
  await page.locator('.lyrow.on .lyeye').click();
  expect(await page.locator('.lyrow.on .lyeye').getAttribute('aria-pressed')).toBe('false');
  expect([await flatPx(page, .4, .5), await flatPx(page, .9, .5)]).toEqual([RED, CLEAR]);
  const b = await page.locator('#paint').boundingBox();
  await page.mouse.move(b.x + b.width * .9, b.y + 10); await page.mouse.down(); await page.mouse.move(b.x + b.width * .9, b.y + 60); await page.mouse.up();
  await expect(page.locator('#status')).toContainText('hidden');
  await page.locator('.lyrow.on .lyeye').click();
  // RULE: moving a layer down puts it under; the DOM order of the canvases is the stack.
  await page.click('#lyDown');
  expect(await names(page)).toEqual(['Layer 2', 'Layer 1']);
  expect(await T(page, () => [...document.querySelectorAll('#slayers canvas')].map(c => c.id))).toEqual(['paint', '']);
  expect([await flatPx(page, .4, .5), await flatPx(page, .9, .5)]).toEqual([RED, BLUE]);
  expect(await page.locator('#lyMerge').isDisabled()).toBe(true);
  await page.locator('.lyrow').first().click();
  await page.click('#lyMerge');
  await expect.poll(() => names(page)).toEqual(['Layer 2']);
  expect([await flatPx(page, .1, .5), await flatPx(page, .4, .5), await flatPx(page, .9, .5)]).toEqual([RED, RED, BLUE]);
  await T(page, () => window.__pixiwyg.sUndo());
  expect(await names(page)).toEqual(['Layer 2', 'Layer 1']);
  expect(await flatPx(page, .4, .5)).toEqual(RED);
  await T(page, () => window.__pixiwyg.sRedo());
  expect(await names(page)).toEqual(['Layer 2']);
  await page.click('#lyDup');
  expect(await names(page)).toEqual(['Layer 2', 'Layer 2 copy']);
  await page.locator('.lyrow.on .lyname').dblclick();
  await page.locator('.lyedit').fill('Ink'); await page.keyboard.press('Enter');
  expect(await names(page)).toEqual(['Layer 2', 'Ink']);
  await page.click('#lyDel');
  expect(await names(page)).toEqual(['Layer 2']);
  expect(await page.locator('#lyDel').isDisabled()).toBe(true);
  // INVARIANT: what lands on the page is the flattened drawing.
  await page.click('#lyAdd'); await fill(page, '#00ff00', 0, 0, .1, .1);
  await page.click('#sPlace');
  const placed = await T(page, () => { const P = window.__pixiwyg, el = P.state().els.at(-1); return el.content === P.flatURL(); });
  expect(placed).toBe(true);
  expect(errors).toEqual([]);
});

test('every frame has the same layers with pixels of its own; merging reaches every frame and undoes in every frame', async ({page}) => {
  const errors = await boot(page); await paintWs(page);
  await fill(page, '#ff0000', 0, 0, 1, 1);
  await T(page, () => window.__pixiwyg.addFrame(true));
  await fill(page, '#00ff00', 0, 0, 1, 1);
  await page.click('#lyAdd');
  await fill(page, '#0000ff', 0, 0, .2, .2);
  await T(page, () => window.__pixiwyg.goFrame(0));
  expect(await names(page)).toEqual(['Layer 1', 'Layer 2']);
  expect(await T(page, () => window.__pixiwyg.layerBlank(document.getElementById('paint')))).toBe(true);
  expect(await flatPx(page, .1, .1)).toEqual(RED);
  const frames = await T(page, async () => { const P = window.__pixiwyg, out = await P.studioOutput(); return (await P.decodeAPNG(out)).frames.length; });
  expect(frames).toBe(2);
  await page.click('#lyMerge');
  await expect.poll(() => names(page)).toEqual(['Layer 1']);
  await T(page, () => window.__pixiwyg.goFrame(1));
  expect([await layerPx(page, .1, .1), await layerPx(page, .5, .5)]).toEqual([BLUE, [0, 255, 0, 255]]);
  await T(page, () => window.__pixiwyg.goFrame(0));
  await T(page, () => window.__pixiwyg.sUndo());
  expect(await names(page)).toEqual(['Layer 1', 'Layer 2']);
  await T(page, async () => { await window.__pixiwyg.goFrame(1); window.__pixiwyg.setActiveLayer(0); });
  expect(await layerPx(page, .1, .1)).toEqual([0, 255, 0, 255]);
  expect(await page.locator('#sRotL').isDisabled()).toBe(true);
  expect(errors).toEqual([]);
});

test('palettes dock left, right or below, float anywhere, fold, hide, and keep their places; the view zooms and fits', async ({page}) => {
  const errors = await boot(page); await page.setViewportSize({width: 1500, height: 900}); await paintWs(page);
  const where = () => T(page, () => Object.fromEntries([...document.querySelectorAll('.spal')].map(p => [p.dataset.pal, p.classList.contains('float') ? 'float' : p.parentNode.dataset.dock])));
  expect(await where()).toEqual({tools: 'l', color: 'r', brushes: 'r', layers: 'r', frames: 'b'});
  const drag = async (pal, x, y) => { const h = await page.locator(`.spal[data-pal=${pal}] .spalhead b`).boundingBox();
    await page.mouse.move(h.x + 8, h.y + 6); await page.mouse.down(); await page.mouse.move(h.x + 30, h.y + 30, {steps: 3}); await page.mouse.move(x, y, {steps: 8}); await page.mouse.up(); };
  const m = await page.locator('#studioMain').boundingBox();
  await drag('layers', m.x + m.width / 2, m.y + m.height / 3);
  await drag('tools', m.x + m.width - 20, m.y + 120);
  await page.locator('.spal[data-pal=color] .spalfold').click();
  expect(await where()).toEqual({tools: 'r', color: 'r', brushes: 'r', layers: 'float', frames: 'b'});
  expect(await page.locator('.spal[data-pal=color] .spalbody').isVisible()).toBe(false);
  // RULE: the keyboard docks a palette too, from its grip.
  await page.locator('.spal[data-pal=frames] .spalgrip').focus(); await page.keyboard.press('ArrowLeft');
  expect((await where()).frames).toBe('l');
  await page.click('#lyAdd'); await fill(page, '#ff0000', 0, 0, .3, .3);
  await page.locator('.lyrow.on .lyname').dblclick(); await page.locator('.lyedit').fill('Ink'); await page.keyboard.press('Enter');
  await page.waitForTimeout(1000);
  await page.reload(); await page.waitForFunction(() => window.__pixiwyg && !document.getElementById('title').hidden); await paintWs(page);
  expect(await where()).toEqual({tools: 'r', color: 'r', brushes: 'r', layers: 'float', frames: 'l'});
  expect(await names(page)).toEqual(['Layer 1', 'Ink']);
  await expect.poll(() => flatPx(page, .1, .1)).toEqual(RED);
  await page.locator('.spal[data-pal=tools] .spalhead b').dblclick();
  expect(await where()).toEqual({tools: 'l', color: 'r', brushes: 'r', layers: 'r', frames: 'b'});
  // RULE: Ctrl/Cmd+\ hides and shows the palettes in the studio, as it does the panels elsewhere.
  await page.locator('#sview').click({position: {x: 4, y: 4}, button: 'middle'});
  await page.keyboard.press(`${M}+Backslash`);
  expect(await page.locator('.spal[data-pal=layers]').isVisible()).toBe(false);
  expect(await page.locator('#sPalBtn').getAttribute('aria-pressed')).toBe('false');
  await page.click('#sPalBtn');
  expect(await page.locator('.spal[data-pal=layers]').isVisible()).toBe(true);
  // RULE: Fit, then 100%, then steps; the drawing is shown at the size the label says.
  const fit = await T(page, () => window.__pixiwyg.viewScale());
  await expect(page.locator('#sZoomFit')).toHaveText(`Fit ${Math.round(fit * 100)}%`);
  await page.click('#sZoomFit');
  await expect(page.locator('#sZoomFit')).toHaveText('100%');
  const w100 = await T(page, () => document.getElementById('sstack').getBoundingClientRect().width);
  await page.click('#sZoomIn');
  expect(await T(page, () => document.getElementById('sstack').getBoundingClientRect().width)).toBeCloseTo(w100 * 1.5, 0);
  const v = await page.locator('#sview').boundingBox();
  await page.mouse.move(v.x + v.width / 2, v.y + v.height / 2); await page.keyboard.down(M); await page.mouse.wheel(0, -100); await page.keyboard.up(M);
  await expect(page.locator('#sZoomFit')).toHaveText('200%');
  expect(await T(page, () => document.getElementById('sstack').classList.contains('pix'))).toBe(true);
  expect(errors).toEqual([]);
});

test('layer keys: new, duplicate, pick above and below, move, merge', async ({page}) => {
  await boot(page); await paintWs(page);
  await page.locator('#sview').click({position: {x: 4, y: 4}, button: 'middle'});
  await page.keyboard.press(`${M}+Alt+KeyN`);
  await page.keyboard.press(`${M}+KeyJ`);
  expect(await names(page)).toEqual(['Layer 1', 'Layer 2', 'Layer 2 copy']);
  await page.keyboard.press('Alt+BracketLeft'); await page.keyboard.press('Alt+BracketLeft');
  expect(await T(page, () => window.__pixiwyg.layers().findIndex(l => l.active))).toBe(0);
  await page.keyboard.press(`${M}+BracketRight`);
  expect(await names(page)).toEqual(['Layer 2', 'Layer 1', 'Layer 2 copy']);
  await page.keyboard.press(`${M}+KeyE`);
  await expect.poll(() => names(page)).toEqual(['Layer 2', 'Layer 2 copy']);
});

test('layer effects: a layer wears a node-editor style; shadow and outline follow the paint, the pixels never change, undo and merge carry them', async ({page}) => {
  const errors = await boot(page); await paintWs(page);
  await fill(page, '#ff0000', .4, .4, .2, .2);
  // FORMAT: probe(dx, dy) reads the flattened drawing dx, dy drawing px beyond the block's bottom-right corner.
  const probe = (dx, dy) => T(page, async ([dx, dy]) => { const p = document.getElementById('paint'), k = p.getContext('2d').getTransform().a || 1, i = new Image(); i.src = window.__pixiwyg.flatURL(); await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    return Array.from(g.getImageData(Math.round(.6 * p.width + dx * k), Math.round(.6 * p.height + dy * k), 1, 1).data); }, [dx, dy]);
  const raw = () => T(page, () => { const p = document.getElementById('paint'), d = p.getContext('2d').getImageData(0, 0, p.width, p.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
  const before = await raw();
  expect((await probe(3, 3))[3]).toBe(0);
  await page.click('#lyFxNew');
  await expect(page.locator('#nodeModal')).toBeVisible();
  // RULE: opened from Layers, the style preview shows the layer itself wearing the style.
  await expect(page.locator('.nlayerprev figcaption')).toHaveText('Layer 1 wearing this style');
  await T(page, () => window.__pixiwyg.closeNodeEditor());
  // INVARIANT: the default style casts a 6px dark shadow down and right; it shows past the paint, and the layer's own pixels are unchanged.
  await expect.poll(async () => (await probe(3, 3))[3]).toBeGreaterThan(200);
  expect((await probe(3, 3)).slice(0, 3).every(v => v < 60)).toBe(true);
  expect(await raw()).toBe(before);
  expect(await page.locator('.lyrow.on .lymeta').textContent()).toContain('fx: Layer 1 effects');
  expect(await T(page, () => { const L = window.__pixiwyg.studioLayer(0); return [!!L.v, L.c.style.visibility]; })).toEqual([true, 'hidden']);
  // RULE: an outline from the style rings the paint itself.
  await T(page, () => { const P = window.__pixiwyg, s = P.state().styleGraphs[0], g = s.g; g.nodes.push({id: 'n9', type: 'sLine', x: 40, y: 400, f: {w: 4, c: '#00ff00', style: 'solid', box: false}}); g.wires.push({a: 'n9', ap: 'out', b: 'n1', bp: 'line'}); P.syncNodeSheet(true); });
  await expect.poll(async () => { const p = await probe(-20, 2); return p[1] > 200 && p[0] < 80; }).toBe(true);
  // RULE: Recolor with its fill paints the layer in the style's fill, and undo takes it back.
  const mid = () => T(page, async () => { const p = document.getElementById('paint'), i = new Image(); i.src = window.__pixiwyg.flatURL(); await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return Array.from(g.getImageData(Math.round(.5 * p.width), Math.round(.5 * p.height), 1, 1).data); });
  expect(await mid()).toEqual([255, 0, 0, 255]);
  await page.check('#lyFxFill');
  await expect.poll(mid).toEqual([255, 46, 136, 255]);
  await T(page, () => window.__pixiwyg.sUndo());
  await expect.poll(mid).toEqual([255, 0, 0, 255]);
  // RULE: merging down bakes the effects into the layer below.
  await page.click('#lyAdd'); await page.click('#lyDown');
  expect(await names(page)).toEqual(['Layer 2', 'Layer 1']);
  await page.locator('.lyrow').first().click();
  await page.click('#lyMerge');
  await expect.poll(() => T(page, () => window.__pixiwyg.layers().length)).toBe(1);
  expect(await T(page, () => !!window.__pixiwyg.studioLayer(0).fx)).toBe(false);
  expect(await raw()).toBeGreaterThan(before);
  expect(errors).toEqual([]);
});

test('effects leave the studio as a second image: the page gets the drawing untouched plus an overlay of only what the effects change, grouped; Update and primitives keep the pair', async ({page}) => {
  const errors = await boot(page); await paintWs(page);
  await fill(page, '#ff0000', .4, .4, .2, .2);
  await page.click('#lyFxNew'); await T(page, () => window.__pixiwyg.closeNodeEditor());
  await page.click('#sPlace');
  await expect(page.locator('#status')).toContainText('second image');
  // FORMAT: px(url, fx, fy) reads a picture at fractions of its size; (.606, .606) is in the shadow, (.5, .5) in the paint.
  const read = () => T(page, async () => {
    const P = window.__pixiwyg, els = P.state().els, base = els.find(e => e.tag === 'img' && P.fxPartner(e)), o = base && P.fxPartner(base);
    const px = async (url, fx, fy) => { const i = new Image(); i.src = url; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return Array.from(g.getImageData(Math.floor(fx * i.width), Math.floor(fy * i.height), 1, 1).data); };
    if (!base) return {pair: false, imgs: els.filter(e => e.tag === 'img').length, groups: Object.keys(P.state().groupNames || {}).length};
    return {pair: true, sameGroup: !!base.group && base.group === o.group, marked: 'data-layer-fx' in o.attrs, above: o.z > base.z, place: [o.x, o.y, o.w].join() === [base.x, base.y, base.w].join(),
      baseShadow: (await px(base.content, .606, .606))[3], baseMid: await px(base.content, .5, .5), fxShadow: (await px(o.content, .606, .606))[3], fxMid: (await px(o.content, .5, .5))[3]};
  });
  expect(await read()).toEqual({pair: true, sameGroup: true, marked: true, above: true, place: true, baseShadow: 0, baseMid: [255, 0, 0, 255], fxShadow: 255, fxMid: 0});
  // RULE: Update keeps the pair: without effects the overlay goes (and the group with it); with them it comes back.
  await page.selectOption('#lyFx', '');
  await page.click('#sUpdate');
  expect(await read()).toEqual({pair: false, imgs: 1, groups: 0});
  await page.selectOption('#lyFx', {index: 1});
  await page.click('#sUpdate');
  expect((await read()).pair).toBe(true);
  // RULE: a drawing primitive carries the overlay and places as the same grouped pair.
  await page.click('#sSavePrim');
  const prim = await T(page, async () => { const P = window.__pixiwyg, p = P.prims.list.find(x => x.kind === 'drawing' && x.data.fx); if (!p) return null;
    const n0 = P.state().els.length; await P.usePrim(p); const els = P.state().els.slice(n0); return {added: els.length, grouped: els.length === 2 && els[0].group === els[1].group, marked: els.some(e => 'data-layer-fx' in (e.attrs || {}))}; });
  expect(prim).toEqual({added: 2, grouped: true, marked: true});
  expect(errors).toEqual([]);
});

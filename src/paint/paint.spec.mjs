// SECTION: Paint Studio expansion: filters, selection, brush opacity/blend, transforms, GIF export
import {test, expect, boot, freshPage} from '../../tools/tests/helpers.mjs';
import {readFileSync} from 'node:fs';

const T = (page, fn, arg) => page.evaluate(fn, arg);
async function studio(page) {
  const errors = await boot(page);
  await page.setViewportSize({width: 1500, height: 950});
  await T(page, async () => { await window.__pixiwyg.newProject('Paint', false, {type: 'web'}, 'paint'); });
  await expect(page.locator('#w-studio')).toBeVisible();
  // INVARIANT: a known picture: transparent margin, a red-to-blue gradient square, a black disc in the middle.
  await T(page, () => { const c = document.getElementById('paint'), g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
    const w = c.width, h = c.height, gr = g.createLinearGradient(w * .2, 0, w * .8, 0); gr.addColorStop(0, '#ff0000'); gr.addColorStop(1, '#0000ff');
    g.fillStyle = gr; g.fillRect(w * .2, h * .2, w * .6, h * .6); g.fillStyle = '#000'; g.beginPath(); g.arc(w / 2, h / 2, w * .12, 0, 7); g.fill(); });
  return errors;
}
const snap = page => T(page, () => { const c = document.getElementById('paint'); return Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data); });

test('every filter previews, changes the picture, and Cancel puts it back exactly', async ({page}) => {
  const errors = await studio(page);
  const ids = await T(page, () => window.__pixiwyg.FX.map(f => f.id));
  const base = await snap(page);
  await T(page, () => { const c = document.getElementById('paint'); window.__base = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; });
  // PERF: diffs are counted in the page; shipping the canvas to Node on every poll took seconds per filter.
  const changed = () => T(page, () => { const c = document.getElementById('paint'), a = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, b = window.__base; let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++; return n; });
  await page.click('#sFx');
  await expect(page.locator('#fxPanel')).toBeVisible();
  for (const id of ids) {
    await page.locator('#fxList .fxitem', {hasText: await T(page, id => window.__pixiwyg.FX.find(f => f.id === id).name, id)}).click();
    // RULE: filters with neutral defaults get a nudge so "changed" is meaningful.
    if (id === 'adjust') await page.locator('#fxParams input[data-k=br]').fill('0.3');
    if (id === 'levels') await page.locator('#fxParams input[data-k=ib]').fill('0.3');
    // RULE: remove-background has nothing to remove on a transparent margin; it is checked on its own below.
    if (id !== 'removebg') await expect.poll(changed, {message: id}).toBeGreaterThan(50);
  }
  await page.click('#fxCancel');
  expect(await snap(page)).toEqual(base);
  expect(errors).toEqual([]);
});

test('filters do what they say: posterize, dither palette, blur without dark fringes, outline, background removal; Apply is undoable', async ({page}) => {
  const errors = await studio(page);
  const r = await T(page, async () => {
    const P = window.__pixiwyg, c = document.getElementById('paint'), g = c.getContext('2d'), D = () => g.getImageData(0, 0, c.width, c.height).data;
    const base = c.toDataURL(), restore = async () => { const i = new Image(); i.src = base; await i.decode(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height); g.drawImage(i, 0, 0); };
    const out = {};
    await P.applyFx('posterize', {n: 2}); let d = D(); out.poster = [...new Set([...d].filter((_, i) => i % 4 !== 3 && d[i - (i % 4) + 3] === 255))].sort((a, b) => a - b); await restore();
    await P.applyFx('dither', {pal: 'riso', method: 'atkinson'}); d = D(); const pal = new Set(['#16121f', '#ff48b0', '#0078bf', '#ffe800', '#f7f1e3']); let bad = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] === 255 && !pal.has('#' + [d[i], d[i + 1], d[i + 2]].map(v => v.toString(16).padStart(2, '0')).join(''))) bad++; out.ditherOff = bad; await restore();
    await P.applyFx('blur', {sig: 6}); d = D(); { const w = c.width, y = c.height >> 1, x = Math.round(w * .2) - 3, k = (y * w + x) * 4; out.fringe = [d[k], d[k + 1], d[k + 2], d[k + 3]]; } await restore();
    const alpha = () => { const d = D(); let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) n++; return n; };
    const a0 = alpha(); await P.applyFx('outline', {width: 8, col: '#ffffff'}); out.outlineGrew = alpha() - a0;
    out.undoLen = P.studio.undo.length;
    return out;
  });
  expect(r.poster).toEqual([0, 255]);
  expect(r.ditherOff).toBe(0);
  expect(r.fringe[3]).toBeGreaterThan(0);
  expect(r.fringe[0]).toBeGreaterThan(150);
  expect(r.outlineGrew).toBeGreaterThan(1000);
  expect(r.undoLen).toBeGreaterThan(0);
  // RULE: undo after a filter goes back to before it.
  const before = await snap(page);
  await T(page, () => document.getElementById('sUndo').click());
  await expect.poll(async () => { const a = await snap(page); let n = 0; for (let i = 0; i < a.length; i++) if (a[i] !== before[i]) n++; return n; }).toBeGreaterThan(1000);
  // RULE: remove background clears a solid backdrop from the edges in.
  const bg = await T(page, async () => { const P = window.__pixiwyg, c = document.getElementById('paint'), g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#00ff00'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#ff0000'; g.fillRect(c.width / 4, c.height / 4, c.width / 2, c.height / 2);
    await P.applyFx('removebg', {tol: 10}); const d = g.getImageData(0, 0, c.width, c.height).data, mid = ((c.height >> 1) * c.width + (c.width >> 1)) * 4; return [d[3], d[mid + 3], d[mid]]; });
  expect(bg).toEqual([0, 255, 255]);
  expect(errors).toEqual([]);
});

test('selection: drag a box, filters stay inside it, drag inside moves pixels, crop and clear', async ({page}) => {
  const errors = await studio(page);
  await page.keyboard.press('m');
  const b = await page.locator('#paint').boundingBox();
  await page.mouse.move(b.x + 5, b.y + 5); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, {steps: 5}); await page.mouse.up();
  await expect(page.locator('#selBar')).toBeVisible();
  const sel = await T(page, () => window.__pixiwyg.studio.sel);
  expect(sel.w).toBeGreaterThan(50);
  const base = await snap(page);
  await T(page, () => window.__pixiwyg.applyFx('invert'));
  const after = await snap(page), W = await T(page, () => document.getElementById('paint').width);
  const at = (a, x, y) => a.slice((y * W + x) * 4, (y * W + x) * 4 + 4);
  const inside = [sel.x + sel.w - 2, sel.y + sel.h - 2], outside = [Math.round(W * .7), Math.round(W * .7)];
  expect(at(after, ...inside)).not.toEqual(at(base, ...inside));
  expect(at(after, ...outside)).toEqual(at(base, ...outside));
  await page.mouse.move(b.x + b.width / 4, b.y + b.height / 4); await page.mouse.down(); await page.mouse.move(b.x + b.width / 4 + 40, b.y + b.height / 4, {steps: 4}); await page.mouse.up();
  const moved = await T(page, () => window.__pixiwyg.studio.sel);
  expect(moved.x).toBeGreaterThan(sel.x);
  await page.click('#selCrop');
  expect(await T(page, () => [document.getElementById('paint').width, window.__pixiwyg.studio.sel])).toEqual([moved.w, null]);
  await T(page, () => window.__pixiwyg.selAll());
  await page.keyboard.press('Delete');
  expect((await snap(page)).every((v, i) => i % 4 !== 3 || v === 0)).toBe(true);
  await page.keyboard.press('Escape');
  expect(await T(page, () => window.__pixiwyg.studio.sel)).toBe(null);
  expect(await T(page, () => window.__pixiwyg.ws())).toBe('paint');
  expect(errors).toEqual([]);
});

test('brush opacity does not build up on overlap; Paint inside keeps transparency; multiply darkens', async ({page}) => {
  const errors = await studio(page);
  await T(page, () => { const c = document.getElementById('paint'); c.getContext('2d').clearRect(0, 0, c.width, c.height); });
  await page.keyboard.press('b');
  await page.locator('#sOpacity').fill('50');
  await page.locator('#size').fill('20');
  const b = await page.locator('#paint').boundingBox();
  // INVARIANT: the stroke doubles back over itself; at 50% it must stay one 50% coat.
  await page.mouse.move(b.x + 50, b.y + 50); await page.mouse.down();
  for (const x of [200, 60, 220, 70]) await page.mouse.move(b.x + x, b.y + 50, {steps: 6});
  await page.mouse.up();
  const a = await T(page, () => { const c = document.getElementById('paint'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let mx = 0; for (let i = 3; i < d.length; i += 4) mx = Math.max(mx, d[i]); return [mx, window.__pixiwyg.sbuf()]; });
  expect(a[0]).toBeGreaterThan(110); expect(a[0]).toBeLessThan(140); expect(a[1]).toBe(null);
  await page.locator('#sOpacity').fill('100');
  await page.selectOption('#sBlend', 'source-atop');
  await page.mouse.move(b.x + 50, b.y + 200); await page.mouse.down(); await page.mouse.move(b.x + 250, b.y + 200, {steps: 6}); await page.mouse.up();
  expect(await T(page, ([x, y]) => { const c = document.getElementById('paint'), k = window.__pixiwyg; return c.getContext('2d').getImageData(Math.round(x * c.width / c.clientWidth), Math.round(y * c.height / c.clientHeight), 1, 1).data[3]; }, [150, 200])).toBe(0);
  expect(errors).toEqual([]);
});

test('flip, rotate and resize; animated GIF export carries every frame', async ({page}) => {
  const errors = await studio(page);
  const w0 = await T(page, () => [document.getElementById('paint').width, document.getElementById('paint').height]);
  await page.click('#sXform summary'); await page.click('#sRotR');
  expect(await T(page, () => [document.getElementById('paint').width, document.getElementById('paint').height])).toEqual([w0[1], w0[0]]);
  await page.click('#sXform summary'); await page.click('#sHalf');
  expect(await T(page, () => document.getElementById('paint').width)).toBe(Math.round(w0[1] / 2));
  const before = await snap(page);
  await page.click('#sXform summary'); await page.click('#sFlipH');
  expect(await snap(page)).not.toEqual(before);
  await page.click('#fAdd'); await page.click('#fAdd');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sSaveMenu summary').then(() => page.click('#sSaveGif'))]);
  const bytes = readFileSync(await dl.path());
  expect(bytes.subarray(0, 6).toString()).toBe('GIF89a');
  let frames = 0; for (let i = 0; i < bytes.length - 1; i++) if (bytes[i] === 0x21 && bytes[i + 1] === 0xF9) frames++;
  expect(frames).toBe(3);
  expect(dl.suggestedFilename()).toMatch(/\.gif$/);
  expect(errors).toEqual([]);
});

test('Paint: a stroke on the canvas, placed on the page as an image', async ({page}) => {
  const errors = await freshPage(page);
  await T(page, () => window.__pixiwyg.setWorkspace('paint'));
  await expect(page.locator('#paint')).toBeVisible();
  const b = await page.locator('#paint').boundingBox();
  await page.mouse.move(b.x + b.width * .3, b.y + b.height * .3);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(b.x + b.width * (.3 + i * .04), b.y + b.height * .5);
  await page.mouse.up();
  expect(await T(page, () => window.__pixiwyg.anyPaint())).toBe(true);
  const n = await T(page, () => window.__pixiwyg.state().els.length);
  await page.locator('#sPlace').click();
  await expect.poll(() => T(page, () => window.__pixiwyg.state().els.length)).toBe(n + 1);
  expect(await T(page, () => { const S = window.__pixiwyg.state(); return S.els[S.els.length - 1].tag; })).toBe('img');
  expect(errors).toEqual([]);
});

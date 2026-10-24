// SECTION: brushes: the engine, the Brushes palette, making a brush with a live preview, styles from the node editor
import {test, expect, boot, T} from '../../tools/tests/helpers.mjs';

const paintWs = page => T(page, async () => { const P = window.__pixiwyg; await P.newProject('Brushes', true, {type: 'web'}); P.setWorkspace('paint'); });
const inked = (page, sel) => T(page, sel => { const c = document.querySelector(sel), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++; return n; }, sel);
const hash = (page, sel) => T(page, sel => { const d = document.querySelector(sel).getContext('2d').getImageData(0, 0, document.querySelector(sel).width, document.querySelector(sel).height).data; let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) | 0; return h; }, sel);
async function stroke(page, y = .5) {
  const b = await page.locator('#paint').boundingBox();
  await page.mouse.move(b.x + b.width * .1, b.y + b.height * y); await page.mouse.down();
  for (let i = 1; i <= 20; i++) await page.mouse.move(b.x + b.width * (.1 + i * .04), b.y + b.height * y);
  await page.mouse.up();
}

test('the built-in brushes are there with live swatches; picking one picks the Brush tool and paints a continuous line', async ({page}) => {
  const errors = await boot(page); await paintWs(page);
  const ids = await T(page, () => [...document.querySelectorAll('.brcard')].map(c => c.dataset.id));
  expect(ids).toEqual(await T(page, () => window.__pixiwyg.BUILTIN_BRUSHES.map(b => b.id)));
  for (const id of ids) await expect.poll(() => inked(page, `.brcard[data-id="${id}"] canvas`)).toBeGreaterThan(20);
  await page.click('.brcard[data-id="b:round"]');
  expect(await T(page, () => [window.__pixiwyg.state().tool, document.getElementById('optTool').textContent])).toEqual(['brush', 'Brush · Round']);
  expect(await page.locator('.brcard.on').getAttribute('aria-selected')).toBe('true');
  await stroke(page);
  // INVARIANT: dabs close enough to overlap: no gap along the stroke's row.
  const gaps = await T(page, () => { const c = document.getElementById('paint'), y = Math.round(c.height / 2), d = c.getContext('2d').getImageData(0, y, c.width, 1).data;
    let first = -1, last = -1, holes = 0; for (let x = 0; x < c.width; x++) if (d[x * 4 + 3] > 128) { if (first < 0) first = x; last = x; }
    for (let x = first; x <= last; x++) if (d[x * 4 + 3] <= 128) holes++; return {span: last - first, holes}; });
  expect(gaps.span).toBeGreaterThan(100); expect(gaps.holes).toBe(0);
  // RULE: a pen's pressure thins the Ink brush; the engine draws the same path lighter-handed with less ink.
  const [hard, light] = await T(page, () => { const P = window.__pixiwyg, ink = P.allBrushes().find(b => b.id === 'b:ink');
    return [1, .2].map(pr => { const c = document.createElement('canvas'); c.dataset.w = 200; c.dataset.h = 60; document.body.append(c);
      P.brushPreview(c, ink, {color: '#000000', size: 10, path: [{x: 10, y: 30, p: pr}, {x: 190, y: 30, p: pr}]});
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++; c.remove(); return n; }); });
  expect(light).toBeLessThan(hard * .5);
  expect(errors).toEqual([]);
});

test('making a brush: the editor previews live, scribbles redraw with every change, and a picture tip comes from the selection', async ({page}) => {
  const errors = await boot(page); await paintWs(page);
  await page.click('#brNew');
  await expect(page.locator('#brushEd')).toBeVisible();
  expect(await T(page, () => window.__pixiwyg.curBrush().builtin)).toBeFalsy();
  await expect.poll(() => inked(page, '#brPrev')).toBeGreaterThan(50);
  const p0 = await hash(page, '#brPrev');
  await page.locator('#brSize').fill('60');
  await expect.poll(() => hash(page, '#brPrev')).not.toBe(p0);
  expect(await T(page, () => [window.__pixiwyg.curBrush().size, window.__pixiwyg.state().size])).toEqual([60, 60]);
  await page.locator('#brSize').fill('12');
  // RULE: a scribble stays and is redrawn with the next change.
  const b = await page.locator('#brPrev').boundingBox();
  const corner = () => T(page, () => { const c = document.getElementById('brPrev'), d = c.getContext('2d').getImageData(0, c.height - Math.round(c.height * .12), Math.round(c.width * .12), Math.round(c.height * .12)).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) n++; return n; });
  expect(await corner()).toBe(0);
  await page.mouse.move(b.x + 8, b.y + b.height - 8); await page.mouse.down(); await page.mouse.move(b.x + 30, b.y + b.height - 10, {steps: 6}); await page.mouse.up();
  expect(await corner()).toBeGreaterThan(0);
  await page.locator('#brJScatter').fill('40');
  await expect.poll(() => T(page, () => window.__pixiwyg.curBrush().jitter.scatter)).toBe(.4);
  expect(await corner()).toBeGreaterThan(0);
  await page.click('#brPrevClear');
  expect(await corner()).toBe(0);
  await page.fill('#brName', 'Leaf');
  await expect(page.locator('.brcard.on .brname')).toHaveText('Leaf');
  // RULE: Use the selection makes the tip from what this layer has painted there.
  await T(page, () => { const c = document.getElementById('paint'), g = c.getContext('2d'); g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#00aa00'; g.fillRect(10, 10, 40, 20); g.restore(); });
  await page.locator('#brTip input[value=picture]').check();
  await page.click('#brPicSel');
  expect(await T(page, () => { const b = window.__pixiwyg.curBrush(); return [b.tip, /^data:image\/png;base64,/.test(b.picture)]; })).toEqual(['picture', true]);
  await page.keyboard.press('Escape');
  await expect(page.locator('#brushEd')).toBeHidden();
  await T(page, () => { const c = document.getElementById('paint'); c.getContext('2d').clearRect(0, 0, c.width, c.height); });
  await stroke(page, .7);
  expect(await inked(page, '#paint')).toBeGreaterThan(200);
  expect(errors).toEqual([]);
});

test('a brush wears a style graph like any element: the tip follows the node editor, and brush and style travel with the project', async ({page}) => {
  const errors = await boot(page); await paintWs(page);
  await page.click('.brcard[data-id="b:stars"]'); await page.click('#brEdit');
  expect(await T(page, () => window.__pixiwyg.curBrush().name)).toBe('Scatter stars (mine)');
  await page.click('#brStyleNew');
  await expect(page.locator('#nodeModal')).toBeVisible();
  await expect(page.locator('#brushEd')).toBeVisible();
  const cls = await T(page, () => { const P = window.__pixiwyg; return P.styleClasses().get(P.curBrush().style); });
  expect(cls).toBe('px-scatter-stars-mine');
  // INVARIANT: the brush editor floats above the node editor, so its preview stays in sight while the style changes.
  expect(await T(page, () => +getComputedStyle(document.getElementById('brushEd')).zIndex > +getComputedStyle(document.getElementById('nodeModal')).zIndex)).toBe(true);
  await page.click('#brPrevClear');
  const before = await hash(page, '#brPrev');
  await T(page, () => { const P = window.__pixiwyg, s = P.state().styleGraphs.find(x => x.id === P.curBrush().style), sh = s.g.nodes.find(n => n.type === 'sShadow'); sh.f.x = 3; sh.f.y = 3; sh.f.c = '#00ff00'; P.syncNodeSheet(true); });
  await expect.poll(() => hash(page, '#brPrev')).not.toBe(before);
  const green = () => T(page, () => { const c = document.getElementById('brPrev'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128 && d[i + 1] > d[i] + 60 && d[i + 1] > d[i + 2] + 60) n++; return n; });
  await expect.poll(green).toBeGreaterThan(20);
  const back = await T(page, async () => { const P = window.__pixiwyg, files = await P.packProject(); await P.readProject(files);
    const b = P.allBrushes().find(x => x.name === 'Scatter stars (mine)'), s = P.state().styleGraphs.find(x => x.id === b.style);
    return {tip: b.tip, shape: b.shape, style: !!s, shadow: s && s.g.nodes.find(n => n.type === 'sShadow').f.c, n: P.state().brushes.length}; });
  expect(back).toEqual({tip: 'shape', shape: 'star', style: true, shadow: '#00ff00', n: 1});
  // SAFETY: a brush from a file can't carry markup or remote pictures into the tip.
  const clean = await T(page, () => { const b = window.__pixiwyg.cleanBrush({letter: '<img src=x onerror=window.__pwned=1>', picture: 'data:text/html,<script>window.__pwned=1</script>', style: '"><script>', tip: 'picture', name: 'x'.repeat(99)});
    return [b.letter, b.picture, b.style, b.tip, b.name.length]; });
  expect(clean).toEqual(['<', null, null, 'round', 40]);
  expect(await T(page, () => window.__pwned)).toBeUndefined();
  expect(errors).toEqual([]);
});

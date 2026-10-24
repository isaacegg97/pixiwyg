// SECTION: the Add panel: catalog cards, primitives, dragging onto the page
import {test, expect, boot, T, freshPage} from '../../tools/tests/helpers.mjs';

test('primitives meet the catalog: each element type leads with its primitives, search filters them, a click places one', async ({page}) => {
  const errors = await freshPage(page);
  const r = await T(page, async () => { const P = window.__pixiwyg; await P.seedKit();
    const spans = P.primsForTag('span').length, divs = P.primsForTag('div').length, imgs = P.primsForTag('img').length, stars = P.primsForTag('div', 'star').map(p => p.name);
    return {spans, divs, imgs, stars}; });
  expect(r.spans).toBeGreaterThan(3);
  expect(r.divs).toBeGreaterThan(10);
  expect(r.imgs).toBeGreaterThan(0);
  expect(r.stars).toEqual(expect.arrayContaining(['Star', 'Vector star']));
  await page.click('#t-styles');
  await page.locator('#palette .pal', {has: page.locator('b', {hasText: /^div$/})}).click();
  const group = page.locator('#catPrims');
  await expect(group.locator('summary')).toContainText('Your primitives');
  await expect(group.locator('details')).not.toHaveAttribute('open', '');
  await group.locator('summary').click();
  await expect(group.locator('.pcard')).toHaveCount(Math.min(24, r.divs));
  if (r.divs > 24) { await group.locator('button.more').click(); await expect(group.locator('.pcard')).toHaveCount(r.divs); }
  await page.fill('#search', 'star');
  await expect.poll(() => group.locator('.pcard').count()).toBe(r.stars.length);
  const before = await T(page, () => window.__pixiwyg.state().els.length);
  await group.locator('.pcard', {hasText: /Vector star$/}).first().click();
  await expect.poll(() => T(page, () => window.__pixiwyg.state().els.length)).toBe(before + 1);
  expect(await T(page, () => window.__pixiwyg.state().els.at(-1).selector)).toBe('.vector');
  await T(page, () => { const P = window.__pixiwyg; P.addPrim({kind: 'element', name: 'Fresh star', data: {el: {tag: 'div', content: '★', extra: '', w: 80}, style: null}}, {quiet: true}); });
  await expect(group.locator('.pcard', {hasText: 'Fresh star'})).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('FIX: the drag ghost is the size of the element that lands (style included), so its snapping is honest', async ({page}) => {
  const errors = await freshPage(page);
  await T(page, async () => { const P = window.__pixiwyg; await P.addLib('fanzine.css'); P.afterFilesChanged(); });
  await page.click('#t-styles');
  const tab = page.locator('#palette .pal', {has: page.locator('b', {hasText: /^h1$/})});
  const b = await tab.boundingBox(), st = await page.locator('#stage').boundingBox();
  await page.mouse.move(b.x + 10, b.y + 10); await page.mouse.down();
  await page.mouse.move(st.x + 200, st.y + 200, {steps: 8});
  const ghost = await T(page, () => { const g = document.querySelector('.dragghost.outline'); return {w: parseFloat(g.style.width), h: parseFloat(g.style.height), label: g.textContent}; });
  await page.mouse.up();
  const placed = await T(page, () => { const P = window.__pixiwyg, el = P.state().els.at(-1), h = P.hostOf(el.id); return {w: h.offsetWidth, h: h.offsetHeight, tag: el.tag}; });
  expect(placed.tag).toBe('h1');
  expect(Math.abs(ghost.w - placed.w)).toBeLessThanOrEqual(1);
  expect(Math.abs(ghost.h - placed.h)).toBeLessThanOrEqual(1);
  expect(ghost.h).not.toBe(48);
  expect(ghost.label).toContain('<h1>');
  expect(errors).toEqual([]);
});

test('primitives persist, and the starter kit is stocked', async ({page}) => {
  await boot(page);
  const cols = await page.evaluate(() => [...new Set(window.__pixiwyg.prims.list.map(p => p.collection))].sort());
  expect(cols).toEqual(expect.arrayContaining(['Cut & paste', 'Doodles', 'Paper & surfaces', 'Starter kit', 'Web 1.0', 'Windows & callouts', 'Zine furniture']));
  await page.evaluate(async () => {
    const T = window.__pixiwyg;
    T.addPrim({kind: 'drawing', name: 'Persist me', data: {src: 'data:image/png;base64,AAAA', w: 1, h: 1}}, {quiet: true});
    await T.writePrims();
  });
  await page.reload();
  await page.waitForFunction(() => window.__pixiwyg && !document.getElementById('title').hidden);
  expect(await page.evaluate(() => window.__pixiwyg.prims.list.some(p => p.name === 'Persist me'))).toBe(true);
});

test('catalog cards and element primitives show pictures, not live elements', async ({page}) => {
  await boot(page);
  await page.evaluate(() => window.__pixiwyg.newProject('Pictures', true, {type: 'web'}));
  await page.waitForFunction(() => document.querySelectorAll('#sgrid .pv.shot').length >= 6);
  expect(await page.evaluate(() => [...document.querySelectorAll('#sgrid .pv')].filter(p => p.shadowRoot).length)).toBe(0);
  await page.click('#t-prims');
  await page.waitForFunction(() => { const c = [...document.querySelectorAll('#primGrid .pcard')].filter(c => c.querySelector('i').textContent === 'element'); return c.length && c.every(x => x.querySelector('.pthumb.shot')); });
  const ok = await page.evaluate(() => new Promise(r => { const i = new Image(); i.onload = () => r(i.naturalWidth === 400 && i.naturalHeight === 248); i.onerror = () => r(false); i.src = document.querySelector('#sgrid .pv.shot img').src; }));
  expect(ok).toBe(true);
});

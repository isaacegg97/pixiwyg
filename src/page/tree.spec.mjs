// SECTION: project tree, contexts, isolation, panel layout
import {test, expect, boot, ws} from '../../tools/tests/helpers.mjs';

const T = (page, fn, arg) => page.evaluate(fn, arg);

test('double-clicking something selected offers its contexts; Component isolates it; the tree lists its parts', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1700, height: 950});
  await T(page, async () => { await window.__pixiwyg.openExample('musician'); window.__pixiwyg.setWorkspace('page'); });
  const id = await T(page, () => { const P = window.__pixiwyg, el = P.state().els.find(e => e.content === '▶ Play'); P.select(el.id); return el.id; });
  const row = page.locator(`#tree .trow2[data-id="${id}"]`);
  await expect(row).toHaveClass(/on/);
  await expect(page.locator('#treeBody')).toContainText('Per Diem Blues');
  await expect(page.locator('#treeBody .tlabel', {hasText: 'logic'}).first()).toBeVisible();
  await page.locator(`.el[data-id="${id}"]`).dblclick();
  await expect(page.locator('#ctxMenu')).toBeVisible();
  expect(await page.locator('#ctxMenu .cmitem b').allTextContents()).toEqual(['Component', 'Logic', 'Animation', 'Text', 'Text effects', 'Open “Per Diem Blues”']);
  const zoom = await T(page, () => document.getElementById('desk').scrollLeft + ':' + document.querySelector('#zoomCtl').textContent);
  await page.locator('#ctxMenu .cmitem', {hasText: 'Component'}).click();
  expect(await T(page, () => window.__pixiwyg.iso())).toBe(id);
  await expect(page.locator('#ctxBar')).toBeVisible();
  await expect(page.locator('#ins .isorow')).toBeVisible();
  expect(await T(page, id => [...document.querySelectorAll('#layer .el')].filter(h => h.dataset.id !== id).every(h => h.classList.contains('isoff') && getComputedStyle(h).pointerEvents === 'none'), id)).toBe(true);
  await page.keyboard.press('Escape');
  expect(await T(page, () => window.__pixiwyg.iso())).toBeNull();
  expect(await T(page, () => document.getElementById('desk').scrollLeft + ':' + document.querySelector('#zoomCtl').textContent)).toBe(zoom);
  await page.locator('#treeBody .tlabel', {hasText: 'logic'}).first().click();
  await expect(page.locator('#nodeModal')).toBeVisible();
  const tree = await page.locator('#tree').boundingBox(), ed = await page.locator('#nodeModal').boundingBox();
  expect(ed.x).toBeGreaterThanOrEqual(tree.x + tree.width - 1);
  await expect(page.locator('#tree')).toBeVisible();
  await page.keyboard.press('Escape');
  await T(page, () => window.__pixiwyg.select(null));
  const p = await T(page, () => window.__pixiwyg.state().els.find(e => e.tag === 'p').id);
  await page.locator(`.el[data-id="${p}"]`).dblclick();
  await expect(page.locator('#ctxMenu')).toBeHidden();
  expect(await T(page, () => !!window.__pixiwyg.state().editing)).toBe(true);
  expect(errors).toEqual([]);
});

test('panels fold to rails, swap sides, move by dragging, reorder inside, and stay that way', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1700, height: 950});
  await T(page, async () => { await window.__pixiwyg.newProject('Panels', true, {type: 'web'}, 'page'); });
  const order = () => T(page, () => { const els = ['tree', 'sideL', 'sideR', 'desk'].map(id => [id, document.getElementById(id).getBoundingClientRect().left]); return els.sort((a, b) => a[1] - b[1]).map(x => x[0]); });
  expect(await order()).toEqual(['tree', 'sideL', 'desk', 'sideR']);
  await page.locator('#tree .dfold').click();
  expect(Math.round((await page.locator('#tree').boundingBox()).width)).toBe(30);
  await expect(page.locator('#tree .drail')).toBeVisible();
  await page.locator('#tree .drail').click();
  expect(Math.round((await page.locator('#tree').boundingBox()).width)).toBeGreaterThan(150);
  await page.locator('#sideR .dswap').click();
  expect(await order()).toEqual(['tree', 'sideL', 'sideR', 'desk']);
  const dw = (await page.locator('#desk').boundingBox()).width;
  await page.locator('#tree>.dockhead').dragTo(page.locator('#desk'), {targetPosition: {x: Math.round(dw * .8), y: 300}});
  expect(await order()).toEqual(['sideL', 'sideR', 'desk', 'tree']);
  await page.locator('#sideR>.dockhead').dragTo(page.locator('#sideL'), {targetPosition: {x: 20, y: 300}});
  expect(await order()).toEqual(['sideR', 'sideL', 'desk', 'tree']);
  await page.locator('#t-text').dragTo(page.locator('#t-styles'));
  expect(await page.locator('#sideL .ptab').evaluateAll(t => t.map(x => x.id))).toEqual(['t-text', 't-styles', 't-prims', 't-files']);
  await page.reload();
  await page.waitForFunction(() => window.__pixiwyg && !document.getElementById('title').hidden);
  await T(page, async () => { await window.__pixiwyg.newProject('Again', true, {type: 'web'}, 'page'); });
  expect(await order()).toEqual(['sideR', 'sideL', 'desk', 'tree']);
  expect(await page.locator('#sideL .ptab').first().getAttribute('id')).toBe('t-text');
  await page.locator('#tree>.dockhead b').dblclick();
  expect(await order()).toEqual(['tree', 'sideL', 'desk', 'sideR']);
  await ws(page, 'music');
  const tree = await page.locator('#tree').boundingBox(), seq = await page.locator('#seqModal').boundingBox();
  expect(Math.round(seq.x)).toBe(Math.round(tree.x + tree.width));
  await expect(page.locator('#sideL')).toBeHidden();
  expect(errors).toEqual([]);
});

test('selecting keeps the tree rows it can: only the rows that changed are rebuilt', async ({page}) => {
  const errors = await boot(page);
  await T(page, async () => { await window.__pixiwyg.openExample('musician'); window.__pixiwyg.setWorkspace('page'); });
  const ids = await T(page, () => window.__pixiwyg.state().els.filter(e => !e.md).slice(0, 3).map(e => e.id));
  await T(page, id => window.__pixiwyg.select(id), ids[0]);
  await page.waitForTimeout(50);
  await T(page, () => { for (const r of document.querySelectorAll('#treeBody .trow2')) r.__mark = 1; });
  await T(page, id => window.__pixiwyg.select(id), ids[2]);
  await page.waitForTimeout(50);
  const r = await T(page, () => {
    const rows = [...document.querySelectorAll('#treeBody .trow2')];
    return {kept: rows.filter(x => x.__mark).length, all: rows.length, on: rows.filter(x => x.classList.contains('on')).map(x => x.dataset.id).filter(Boolean)};
  });
  expect(r.on).toEqual([ids[2]]);
  expect(r.kept).toBeGreaterThan(r.all / 2);
  await page.locator(`#treeBody .trow2[data-id="${ids[0]}"] .tlabel`).click();
  expect(await T(page, () => window.__pixiwyg.state().sel)).toBe(ids[0]);
  await T(page, () => window.__pixiwyg.undo && window.__pixiwyg.undo());
  await expect(page.locator(`#treeBody .trow2[data-id="${ids[1]}"]`)).toHaveCount(1);
  expect(errors).toEqual([]);
});

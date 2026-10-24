// SECTION: laying the page out: canvases, autoformat, Boxes, groups
import {test, expect, boot, settle, T, freshPage, addP} from '../../tools/tests/helpers.mjs';

test('every autoformat preset lays the page out without overlaps', async ({page}) => {
  const errors = await freshPage(page);
  await T(page, () => { const P = window.__pixiwyg; P.importMarkdown(Array.from({length: 14}, (_, i) => i % 4 ? `Paragraph ${i} ` + 'words in a row '.repeat(10) : `## Part ${i}`).join('\n\n')); });
  for (const preset of ['column', 'two', 'tidy']) {
    const overlaps = await T(page, layout => {
      const P = window.__pixiwyg; P.autoformat({layout, width: 700, gap: 16, sheet: ''}, true);
      const b = P.state().els.map(e => { const h = P.hostOf(e.id); return {x: e.x, y: e.y, w: h.offsetWidth, h: h.offsetHeight}; });
      let n = 0; for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) { const p = b[i], q = b[j]; if (p.x < q.x + q.w && q.x < p.x + p.w && p.y < q.y + q.h && q.y < p.y + p.h) n++; }
      return n;
    }, preset);
    expect(overlaps, preset).toBe(0);
  }
  expect(errors).toEqual([]);
});

test('Boxes: split the page, drop elements in to tile them, resize with dividers, align, remove, undo, round-trip, off', async ({page}) => {
  const errors = await freshPage(page);
  const add = (text, x, y) => addP(page, text, x, y);
  const a = await add('First paragraph', 40, 500), b = await add('Second paragraph, a little longer than the first one', 60, 600), c = await add('Floater', 700, 700);
  await T(page, () => window.__pixiwyg.select(null));
  await page.click('#boxesBtn');
  await expect(page.locator('#boxLayer .bx')).toHaveCount(1);
  expect(await T(page, () => window.__pixiwyg.state().els.filter(e => e.box).length)).toBe(0);
  await page.locator('#boxLayer .bx .bxbar button', {hasText: '◫'}).click();
  await expect(page.locator('#boxLayer .bx')).toHaveCount(2);
  const R = () => T(page, () => [...window.__pixiwyg.boxRects().values()].filter(r => !r.b.split).map(r => ({id: r.b.id, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h)})));
  const [L, Rt] = await R();
  expect(Math.abs(L.w - Rt.w)).toBeLessThanOrEqual(1);
  // RULE: drag with the mouse, as a person would; the drop point picks the box.
  const drag = async (id, tx, ty, alt) => {
    const st = await page.locator('#stage').boundingBox(), z = await T(page, () => document.getElementById('stage').getBoundingClientRect().width / document.getElementById('stage').offsetWidth);
    const el = await T(page, id => { const h = window.__pixiwyg.hostOf(id).getBoundingClientRect(); return {x: h.x + 10, y: h.y + 8}; }, id);
    await page.mouse.move(el.x, el.y); await page.mouse.down(); if (alt) await page.keyboard.down('Alt');
    await page.mouse.move(st.x + tx * z, st.y + ty * z, {steps: 8}); await page.mouse.up(); if (alt) await page.keyboard.up('Alt');
  };
  await drag(a, L.x + 30, L.y + 30); await drag(b, L.x + 30, L.y + 200);
  const s1 = await T(page, ([a, b]) => { const P = window.__pixiwyg, A = P.state().els.find(e => e.id === a), B = P.state().els.find(e => e.id === b), hb = P.hostOf(a).offsetHeight; return {A: [A.box, A.x, A.y, A.w, A.bo], B: [B.box, B.x, B.y, B.w, B.bo], ha: hb, pad: P.state().boxes.pad, gap: P.state().boxes.gap}; }, [a, b]);
  expect(s1.A[0]).toBe(L.id); expect(s1.B[0]).toBe(L.id);
  expect(s1.A[1]).toBe(L.x + s1.pad); expect(s1.A[2]).toBe(L.y + s1.pad); expect(s1.A[3]).toBe(L.w - 2 * s1.pad);
  expect(s1.B[2]).toBe(s1.A[2] + s1.ha + s1.gap);
  await drag(c, Rt.x + 40, Rt.y + 40, true);
  expect(await T(page, c => window.__pixiwyg.state().els.find(e => e.id === c).box, c)).toBeUndefined();
  // RULE: a divider drag resizes both sides and the tiles follow.
  const dv = await page.locator('#boxLayer .bxdiv').boundingBox();
  await page.mouse.move(dv.x + dv.width / 2, dv.y + 50); await page.mouse.down(); await page.mouse.move(dv.x + dv.width / 2 - 100, dv.y + 50, {steps: 5}); await page.mouse.up();
  const [L2] = await R();
  expect(L2.w).toBeLessThan(L.w - 50);
  expect(await T(page, a => window.__pixiwyg.state().els.find(e => e.id === a).w, a)).toBe(L2.w - s1.pad * 2);
  await page.locator('#boxLayer .bx').first().locator('.bxbar button', {hasText: '↕'}).click();
  const yc = await T(page, a => window.__pixiwyg.state().els.find(e => e.id === a).y, a);
  expect(yc).toBeGreaterThan(s1.A[2] + 100);
  const packed = await T(page, async () => { const P = window.__pixiwyg, f = P.packProject(), k = P.filesKey(f); await P.openFiles(new Map(await P.unzip(P.zipFiles(P.sortEntries(f)))), {});
    return {same: P.filesKey(P.packProject()) === k, tiled: P.state().els.filter(e => e.box).length, on: P.state().boxes.on, leaves: [...P.boxRects().values()].filter(r => !r.b.split).length}; });
  expect(packed).toEqual({same: true, tiled: 2, on: true, leaves: 2});
  await page.locator('#boxLayer .bx').nth(1).locator('.bxbar button', {hasText: '✕'}).click();
  await expect(page.locator('#boxLayer .bx')).toHaveCount(1);
  expect(await T(page, () => { const P = window.__pixiwyg, root = P.state().boxes.roots[0].id; return P.state().els.filter(e => e.box).every(e => e.box === root); })).toBe(true);
  await T(page, () => window.__pixiwyg.undo());
  await expect(page.locator('#boxLayer .bx')).toHaveCount(2);
  await page.click('#boxesBtn');
  await expect(page.locator('#boxLayer')).toBeHidden();
  const frozen = await T(page, () => window.__pixiwyg.state().els.map(e => [e.x, e.y]));
  await page.click('#boxesBtn'); await page.click('#boxesBtn');
  expect(await T(page, () => window.__pixiwyg.state().els.map(e => [e.x, e.y]))).toEqual(frozen);
  expect(errors).toEqual([]);
});

test('Boxes on a page canvas: one root per page, inside the margins', async ({page}) => {
  const errors = await freshPage(page);
  const r = await T(page, async () => { const P = window.__pixiwyg; P.setCanvas({type: 'page', size: 'a5', orient: 'portrait', pages: 2, margin: 12, bleed: 3});
    P.setBoxes(true); const rects = [...P.boxRects().values()], pages = P.pageRects(); return {n: rects.length, x0: Math.round(rects[0].x), p0: Math.round(pages[0].x), y1: Math.round(rects[1].y), p1: Math.round(pages[1].y)}; });
  expect(r.n).toBe(2);
  expect(r.x0).toBeGreaterThan(r.p0);
  expect(r.y1).toBeGreaterThan(r.p1);
  expect(errors).toEqual([]);
});

test('autoformat keeps intent: rows stay rows, stickers stay on what they decorate, tight pairs stay tight, scale and narrow widths survive, Boxes tiles untouched', async ({page}) => {
  const errors = await freshPage(page);
  const r = await T(page, async () => {
    const P = window.__pixiwyg, S = P.state(), mk = o => { const el = {id: 'af' + Math.random().toString(36).slice(2, 7), z: S.els.length + 1, fileId: null, selector: null, ...o}; S.els.push(el); return el; };
    const pic = 'data:image/svg+xml;base64,' + btoa('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect width="300" height="200" fill="#3a86ff"/></svg>');
    const h = mk({tag: 'h1', content: 'Title', x: 900, y: 30, w: 400});
    const img = mk({tag: 'img', content: pic, x: 300, y: 400, w: 300});
    const cap = mk({tag: 'p', content: 'Caption under the picture', x: 300, y: 606, w: 300});
    const sticker = mk({tag: 'span', content: 'NEW!', x: 520, y: 410, sx: 1.5, sy: 1.5});
    const b1 = mk({tag: 'button', content: 'Yes', x: 100, y: 900}), b2 = mk({tag: 'button', content: 'No', x: 220, y: 902});
    const card = mk({tag: 'div', content: 'Narrow card', x: 700, y: 1200, w: 200});
    const p = mk({tag: 'p', content: 'Body text '.repeat(30), x: 50, y: 1400, w: 900});
    const tile = mk({tag: 'p', content: 'Tiled', x: 0, y: 0, w: 100});
    P.renderAll(); await document.fonts.ready;
    P.setBoxes(true); P.boxDrop(tile, 20, 20, false); const tileAt = [tile.x, tile.y, tile.box];
    const imgBox = () => { const hst = P.hostOf(img.id); return {h: hst.offsetHeight}; };
    P.autoformat({layout: 'column', width: 640, gap: 24, sheet: ''});
    const capGap = cap.y - (img.y + imgBox().h);
    const tileKept = tile.box === tileAt[2] && tile.x === tileAt[0] && tile.y === tileAt[1];
    return {tileKept, rowSameY: Math.abs(b1.y - b2.y) <= 4, rowOrder: b2.x > b1.x, stickerDx: sticker.x - img.x, stickerDy: sticker.y - img.y, capGap, sx: sticker.sx,
      cardW: card.w, pW: p.w, order: h.y < img.y && img.y < cap.y && cap.y < b1.y && b1.y < card.y && card.y < p.y, imgCentredish: img.x > 16};
  });
  expect(r.tileKept).toBe(true);
  expect(r.rowSameY).toBe(true);
  expect(r.rowOrder).toBe(true);
  expect([r.stickerDx, r.stickerDy]).toEqual([220, 10]);
  expect(r.capGap).toBeLessThan(14);
  expect(r.sx).toBe(1.5);
  expect(r.cardW).toBe(200);
  expect(r.pW).toBe(640);
  expect(r.order).toBe(true);
  expect(errors).toEqual([]);
});

test('groups: shift-click and Ctrl+G; a click takes the group; moves, nudges and Inspector changes apply to all; drill in; duplicate, delete, ungroup', async ({page}) => {
  const errors = await freshPage(page);
  await T(page, async () => { const P = window.__pixiwyg; await P.addLib('fanzine.css'); P.afterFilesChanged(); });
  const a = await addP(page, 'Alpha', 100, 100), b = await addP(page, 'Beta', 100, 220), c = await addP(page, 'Gamma', 600, 400);
  await T(page, () => window.__pixiwyg.select(null));
  const at = id => T(page, id => { const r = window.__pixiwyg.hostOf(id).getBoundingClientRect(); return {x: r.x + 15, y: r.y + 8}; }, id);
  const els = () => T(page, () => Object.fromEntries(window.__pixiwyg.state().els.map(e => [e.id, {x: e.x, y: e.y, g: e.group, sel: e.selector, extra: e.extra || ''}])));
  let p = await at(a); await page.mouse.click(p.x, p.y);
  p = await at(b); await page.keyboard.down('Shift'); await page.mouse.click(p.x, p.y); await page.keyboard.up('Shift');
  expect(await T(page, () => window.__pixiwyg.selIds().length)).toBe(2);
  await page.keyboard.press('Control+g');
  let s = await els();
  expect(s[a].g).toBeTruthy(); expect(s[a].g).toBe(s[b].g); expect(s[c].g).toBeUndefined();
  await page.mouse.click(5, 5).catch(() => {}); await T(page, () => window.__pixiwyg.select(null));
  p = await at(b); await page.mouse.click(p.x, p.y);
  expect((await T(page, () => window.__pixiwyg.selIds())).sort()).toEqual([a, b].sort());
  await expect(page.locator('#selLabel')).toContainText('2 elements');
  // RULE: dragging one member moves the group.
  p = await at(a); await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.mouse.move(p.x + 50, p.y + 30, {steps: 5}); await page.mouse.up();
  const s2 = await els();
  expect(s2[a].x - s[a].x).toBe(s2[b].x - s[b].x); expect(s2[a].y - s[a].y).toBe(s2[b].y - s[b].y); expect(s2[a].x).not.toBe(s[a].x);
  await page.keyboard.press('ArrowRight');
  const s3 = await els(); expect([s3[a].x - s2[a].x, s3[b].x - s2[b].x]).toEqual([1, 1]);
  // RULE: an Inspector change on one goes to all: here the extra classes field.
  await page.locator('#ins input[placeholder^="e.g."]').fill('loud');
  await page.locator('#ins input[placeholder^="e.g."]').press('Tab');
  await expect.poll(async () => { const q = await els(); return [q[a].extra, q[b].extra, q[c].extra]; }).toEqual(['loud', 'loud', '']);
  // RULE: the catalog's style choice goes to every member of the same tag.
  await page.click('#t-styles');
  await page.locator('#sgrid .scard[data-key*="|p"]').nth(1).click();
  await expect.poll(async () => { const q = await els(); return q[a].sel === q[b].sel && q[a].sel !== null; }).toBe(true);
  // RULE: double-click drills into one member.
  p = await at(b); await page.mouse.dblclick(p.x, p.y);
  expect(await T(page, () => window.__pixiwyg.selIds().length)).toBe(1);
  await T(page, () => window.__pixiwyg.select(null));
  p = await at(a); await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Control+j');
  const dup = await T(page, () => { const P = window.__pixiwyg, ids = P.selIds(), es = ids.map(id => P.state().els.find(e => e.id === id)); return {n: ids.length, g: [...new Set(es.map(e => e.group))]}; });
  expect(dup.n).toBe(2); expect(dup.g.length).toBe(1); expect(dup.g[0]).not.toBe(s[a].g);
  await page.keyboard.press('Delete');
  expect(await T(page, () => window.__pixiwyg.state().els.length)).toBe(3);
  p = await at(a); await page.mouse.click(p.x, p.y);
  await page.keyboard.press('Control+Shift+g');
  expect(await T(page, id => window.__pixiwyg.state().els.find(e => e.id === id).group, a)).toBeUndefined();
  expect(errors).toEqual([]);
});

test('groups: autoformat moves a group as one, groups round-trip, and a group saves and places as one primitive', async ({page}) => {
  const errors = await freshPage(page);
  const r = await T(page, async () => {
    const P = window.__pixiwyg, S = P.state(), mk = o => { const el = {id: 'g' + Math.random().toString(36).slice(2, 7), z: S.els.length + 1, fileId: null, selector: null, ...o}; S.els.push(el); return el; };
    const h = mk({tag: 'h1', content: 'Head', x: 40, y: 40, w: 300});
    const card = mk({tag: 'div', content: 'Card', x: 700, y: 300, w: 160}), badge = mk({tag: 'span', content: 'BADGE', x: 790, y: 290});
    const p = mk({tag: 'p', content: 'Body '.repeat(20), x: 40, y: 600, w: 500});
    P.renderAll(); P.select(card.id); P.toggleInSel(badge.id); P.groupSel();
    const off = [badge.x - card.x, badge.y - card.y];
    P.autoformat({layout: 'column', width: 640, gap: 24, sheet: ''});
    const off2 = [badge.x - card.x, badge.y - card.y], moved = card.x !== 700;
    const f = P.packProject(), k = P.filesKey(f); await P.openFiles(new Map(await P.unzip(P.zipFiles(P.sortEntries(f)))), {});
    const same = P.filesKey(P.packProject()) === k, groups = [...new Set(P.state().els.map(e => e.group).filter(Boolean))].length;
    const c2 = P.state().els.find(e => e.content === 'Card'); P.select(c2.id); const prim = P.groupPrim(); const before = P.state().els.length;
    await P.usePrim(prim, {x: 100, y: 900}); const placed = P.state().els.slice(before);
    return {off, off2, moved, same, groups, placed: placed.length, oneGroup: new Set(placed.map(e => e.group)).size === 1 && !!placed[0].group, kind: prim.kind};
  });
  expect(r.off2).toEqual(r.off);
  expect(r.moved).toBe(true);
  expect(r).toMatchObject({same: true, groups: 1, placed: 2, oneGroup: true, kind: 'group'});
  expect(errors).toEqual([]);
});

test('changing the canvas keeps elements on their page, and a zine’s back cover stays last', async ({page}) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const T = window.__pixiwyg;
    await T.newProject('Remap', false, {type: 'booklet', sheet: 'a4', pages: 8}, 'page');   // RULE: this one sits inside the margin on purpose
    const back = T.pageRects().find(p => p.i === 7);
    T.state().els.push({id: 'bc', tag: 'p', fileId: null, selector: null, x: back.x + 30, y: back.y + 40, w: 100, z: 1, content: 'back'});
    T.renderAll();
    T.setCanvas({...T.state().canvas, pages: 12});
    const e = T.state().els.find(x => x.id === 'bc'), pg = T.pageOf(e);
    const out = {page: pg.i, of: T.state().canvas.pages, dx: e.x - pg.x, dy: e.y - pg.y};
    T.undo();out.after = T.state().canvas.pages;return out;
  });
  expect(r).toEqual({page: 11, of: 12, dx: 30, dy: 40, after: 8});
});

test('autoformat flows long text across zine pages in reading order', async ({page}) => {
  await boot(page);
  await page.evaluate(async () => {
    const T = window.__pixiwyg;
    await T.newProject('Flow', false, {type: 'booklet', sheet: 'a4', pages: 4});
    let md = '# Flow\n\n';
    for (let i = 1; i <= 8; i++) md += `## Part ${i}\n\n` + `Paragraph ${i}. ` + 'Words words words. '.repeat(40) + '\n\n';
    T.importMarkdown(md, {width: 640});
    T.autoformat({layout: 'column', width: 640, gap: 16, sheet: ''});
  });
  await settle(page);
  const r = await page.evaluate(() => {
    const T = window.__pixiwyg, st = T.state();
    const heads = st.els.filter(e => e.tag === 'h2').map(e => ({n: +e.content.match(/\d+/)[0], page: T.pageOf(e).i, y: e.y}));
    heads.sort((a, b) => a.n - b.n);
    return {pages: st.canvas.pages, heads: heads.length, inOrder: heads.every((h, i) => !i || h.page > heads[i - 1].page || (h.page === heads[i - 1].page && h.y > heads[i - 1].y)), split: st.els.some(e => e.flow)};
  });
  expect(r.pages).toBeGreaterThan(4);
  expect(r.heads).toBe(8);
  expect(r.inOrder).toBe(true);
  expect(r.split).toBe(true);
});

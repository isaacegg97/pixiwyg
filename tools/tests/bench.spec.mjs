// SECTION: rendering benchmark (examples/benchmark.pixiwyg); invariants fail the suite, timings are logged
// RULE: bounds are 10x a dev machine's numbers, there to catch an O(n^2) slipping in, not to grade hardware.
//   npm run bench prints the timings.
import {test, expect} from '@playwright/test';
import {boot, settle} from './helpers.mjs';

test('benchmark page: opens clean, boxes are sane, ink rules hold, round-trips, and stays fast', async ({page}, info) => {
  test.setTimeout(180_000);
  const errors = await boot(page);
  await page.setViewportSize({width: 1700, height: 1000});
  const tOpen = await page.evaluate(async () => { const t = performance.now(); await window.__pixiwyg.openExample('benchmark'); window.__pixiwyg.setWorkspace('page'); return performance.now() - t; });
  await settle(page);
  const r = await page.evaluate(() => {
    const P = window.__pixiwyg, S = P.state(), ms = f => { const t = performance.now(); f(); return performance.now() - t; };
    const box = sel => { const el = S.els.find(e => e.selector === sel.s && (!sel.c || e.content === sel.c)), h = P.hostOf(el.id); return {ink: P.elBox(el).w, layout: h.offsetWidth * (el.sx || 1)}; };
    const bad = S.els.filter(e => { const b = P.elBox(e); return !(b.w > 0 && b.h > 0 && Number.isFinite(b.w) && Number.isFinite(b.h)); }).map(e => e.selector + ':' + e.id);
    const t = {
      renderAll: ms(() => P.renderAll()),
      select200: ms(() => { for (const e of S.els.slice(0, 200)) P.select(e.id); P.select(null); }),
      pack: ms(() => P.packProject()),
      tree: ms(() => P.renderTree && P.renderTree()),
    };
    return {n: S.els.length, bad, t,
      outline: box({s: 'h1.outline'}), centered: box({s: 'h1', c: 'Centered'}), underline: box({s: 'h2.underline'}), rtl: box({s: 'p', c: S.els.find(e => e.attrs && e.attrs.dir === 'rtl').content})};
  });
  const rt = await page.evaluate(async () => { const T = window.__pixiwyg, f1 = T.packProject(), k = T.filesKey(f1), t = performance.now();
    await T.openFiles(new Map(await T.unzip(T.zipFiles(T.sortEntries(f1)))), {}); return {same: T.filesKey(T.packProject()) === k, reopen: performance.now() - t}; });
  const timings = {open: tOpen, ...r.t, reopen: rt.reopen};
  info.annotations.push({type: 'timings (ms)', description: JSON.stringify(Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Math.round(v)])))});
  console.log(`benchmark: ${r.n} elements`, Object.fromEntries(Object.entries(timings).map(([k, v]) => [k, Math.round(v) + ' ms'])));
  expect(r.n).toBeGreaterThan(550);
  expect(r.bad).toEqual([]);
  expect(r.outline.ink).toBeLessThan(r.outline.layout * .8);
  expect(r.centered.ink).toBe(r.centered.layout);
  expect(r.underline.ink).toBe(r.underline.layout);
  expect(r.rtl.ink).toBe(r.rtl.layout);
  expect(rt.same).toBe(true);
  expect(timings.open).toBeLessThan(30_000);
  expect(timings.renderAll).toBeLessThan(10_000);
  // FIX: the Inspector's style list once rebuilt 13k options per select: 200 selects took 11s; now ~1-3s.
  expect(timings.select200).toBeLessThan(6_000);
  expect(timings.pack).toBeLessThan(5_000);
  expect(errors).toEqual([]);
});

// SECTION: symbols: shared look, per-copy text and colors, edit in isolation, project round trip, undo
import {test, expect, boot} from '../../tools/tests/helpers.mjs';

const T = (page, fn, arg) => page.evaluate(fn, arg);
const M = process.platform === 'darwin' ? 'Meta' : 'Control';

test('copies share their look; text and colors stay per copy; editing the symbol reaches every copy', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1700, height: 950});
  await T(page, async () => { await window.__pixiwyg.openExample('artist'); window.__pixiwyg.setWorkspace('page'); });
  const id = await T(page, () => { const P = window.__pixiwyg, el = P.state().els.find(e => e.tag === 'button' || e.tag === 'p'); P.select(el.id); return el.id; });
  await page.locator('#ins button', {hasText: 'Make a symbol'}).click();
  const sym = await T(page, id => window.__pixiwyg.state().els.find(e => e.id === id).sym, id);
  expect(sym).toBeTruthy();
  await page.locator('#desk').focus();
  await page.keyboard.press(`${M}+j`);
  await page.keyboard.press(`${M}+j`);
  const ids = await T(page, s => window.__pixiwyg.state().els.filter(e => e.sym === s).map(e => e.id), sym);
  expect(ids.length).toBe(3);
  await expect(page.locator('#ins .symrow small')).toHaveText('3 copies');
  const r = await T(page, ([ids, sym]) => {
    const P = window.__pixiwyg, S = P.state(), get = id => S.els.find(e => e.id === id), out = {};
    // RULE: a shared field edited on any copy reaches all of them
    P.select(ids[1]); P.pushUndo(); get(ids[1]).extra = 'shout'; P.save();
    out.extra = ids.map(i => get(i).extra);
    // RULE: text edited on one copy is that copy's own
    P.select(ids[2]); P.pushUndo(); get(ids[2]).content = 'mine'; P.save();
    out.own = get(ids[2]).own; out.texts1 = ids.map(i => get(i).content);
    // RULE: text edited on the symbol itself reaches every copy without its own
    P.enterIso(ids[0]); P.pushUndo(); get(ids[0]).content = 'everyone'; P.save(); P.exitIso();
    out.texts2 = ids.map(i => get(i).content);
    P.resetOwn(get(ids[2])); out.texts3 = ids.map(i => get(i).content);
    out.rendered = ids.slice(1).map(i => P.hostOf(i).shadowRoot.textContent.includes('everyone'));
    return out;
  }, [ids, sym]);
  expect(r.extra).toEqual(['shout', 'shout', 'shout']);
  expect(r.own).toEqual({content: 1});
  expect(r.texts1[2]).toBe('mine');
  expect(r.texts1[0]).toBe(r.texts1[1]);
  expect(r.texts2).toEqual(['everyone', 'everyone', 'mine']);
  expect(r.texts3).toEqual(['everyone', 'everyone', 'everyone']);
  expect(r.rendered).toEqual([true, true]);
  // FORMAT: symbols survive save and open, byte for byte, with each copy's own fields
  const back = await T(page, async () => {
    const P = window.__pixiwyg, f1 = P.packProject(), k = P.filesKey(f1);
    await P.openFiles(new Map(await P.unzip(P.zipFiles(P.sortEntries(f1)))), {});
    const S = P.state();
    return {same: P.filesKey(P.packProject()) === k, syms: S.syms.length, copies: S.els.filter(e => e.sym === S.syms[0].id).length};
  });
  expect(back).toEqual({same: true, syms: 1, copies: 3});
  // RULE: a placed copy from the tree arrives selected, as a copy
  await page.locator('#treeBody .tlabel', {hasText: 'Symbols'}).click();
  await page.locator('#treeBody .tlabel', {hasText: 'click to place one'}).click();
  expect(await T(page, () => { const S = window.__pixiwyg.state(); return S.els.filter(e => e.sym === S.syms[0].id).length; })).toBe(4);
  await T(page, () => window.__pixiwyg.undo());
  expect(await T(page, () => { const S = window.__pixiwyg.state(); return S.els.filter(e => e.sym === S.syms[0].id).length; })).toBe(3);
  expect(errors).toEqual([]);
});

// SECTION: the UX/UI spec (docs/UX_UI.md), held to: toolbar reach, keyboard, colour-independence, contrast
import {test, expect} from '@playwright/test';
import {boot} from './helpers.mjs';

const T = (page, fn, arg) => page.evaluate(fn, arg);
const open = async page => { const errors = await boot(page); await T(page, async () => { await window.__pixiwyg.openExample('musician'); window.__pixiwyg.setWorkspace('page'); }); return errors; };

test('RULE: the toolbar never runs off the screen; what does not fit is in More, and Export and Play always show', async ({page}) => {
  const errors = await open(page);
  for (const [w, h] of [[1440, 900], [1280, 800], [820, 1000], [390, 844]]) {
    await page.setViewportSize({width: w, height: h});
    await page.waitForTimeout(150);
    const r = await T(page, () => { const t = document.getElementById('topbar'), off = [...t.querySelectorAll('button,summary,input,select')].filter(b => { const x = b.getBoundingClientRect(); return x.width && x.right > innerWidth + 1; });
      const vis = id => { const b = document.getElementById(id); return !!b && !!b.offsetParent && !b.closest('#tbOverflow'); };
      return {fits: t.scrollWidth <= t.clientWidth + 1, off: off.length, play: vis('playBtn'), exp: vis('exportBtn'), more: !!document.querySelector('#moreMenu>summary').offsetParent}; });
    expect(r, `at ${w}px`).toEqual({fits: true, off: 0, play: true, exp: true, more: true});
  }
  // FIX: the toolbar's menus hang below it and must not be clipped: the open More menu takes clicks.
  await page.setViewportSize({width: 1280, height: 800}); await page.waitForTimeout(150);
  await page.click('#moreMenu summary');
  expect(await T(page, () => { const b = document.querySelector('#moreMenu .ddbody'), r = b.getBoundingClientRect(); return b.contains(document.elementFromPoint(r.left + 20, r.bottom - 12)); })).toBe(true);
  await page.click('#moreMenu summary');
  await page.click('#wsBtn');
  expect(await T(page, () => { const b = document.getElementById('wsTabs'), r = b.getBoundingClientRect(); return b.contains(document.elementFromPoint(r.left + 20, r.bottom - 12)); })).toBe(true);
  await page.keyboard.press('Escape');
  // RULE: an overflowed tool still works from More.
  await page.setViewportSize({width: 820, height: 1000}); await page.waitForTimeout(150);
  expect(await T(page, () => !!document.querySelector('#tbOverflow #saveFileBtn'))).toBe(true);
  await page.setViewportSize({width: 2400, height: 900}); await page.waitForTimeout(150);
  expect(await T(page, () => [!!document.querySelector('#topbar #saveFileBtn:not(#tbOverflow *)'), document.getElementById('tbOverflow').hidden])).toEqual([true, true]);
  // RULE: tools for other workspaces don't show.
  await T(page, () => window.__pixiwyg.setWorkspace('paint'));
  expect(await T(page, () => !!document.getElementById('afBtn').offsetParent)).toBe(false);
  expect(errors).toEqual([]);
});

test('RULE: keyboard: Tab moves focus (panels toggle on Ctrl+\\\\), Space plays the page, the tree walks with arrows', async ({page}) => {
  const errors = await open(page);
  await page.setViewportSize({width: 1440, height: 900});
  await T(page, () => { window.__pixiwyg.select(null); document.activeElement && document.activeElement.blur(); });
  const panels = () => T(page, () => [document.body.classList.contains('noL'), document.body.classList.contains('noR')]);
  const before = await panels();
  await page.keyboard.press('Tab');
  expect(await panels()).toEqual(before);
  expect(await T(page, () => document.activeElement !== document.body)).toBe(true);
  await T(page, () => document.activeElement.blur());
  await page.keyboard.press('Control+\\');
  expect(await panels()).toEqual([true, true]);
  await page.keyboard.press('Control+\\');
  expect(await panels()).toEqual([false, false]);
  await page.keyboard.press(' ');
  expect(await T(page, () => window.__pixiwyg.playing())).toBe(true);
  await page.keyboard.press('Escape');
  expect(await T(page, () => window.__pixiwyg.playing())).toBe(false);
  // RULE: the tree is one tab stop with a selected row marked by more than colour; arrows move, Right opens, Left goes up.
  const id = await T(page, () => { const P = window.__pixiwyg, el = P.state().els.find(e => e.content === '▶ Play'); P.select(el.id); return el.id; });
  await page.waitForTimeout(60);
  expect(await T(page, id => { const r = document.querySelector(`#treeBody .trow2[data-id="${id}"]`); return [r.getAttribute('aria-selected'), getComputedStyle(r.querySelector('.tlabel')).boxShadow !== 'none', document.querySelectorAll('#treeBody .tlabel[tabindex="0"]').length]; }, id)).toEqual(['true', true, 1]);
  await page.locator(`#treeBody .trow2[data-id="${id}"] .tlabel`).focus();
  await page.keyboard.press('ArrowDown');
  const next = await T(page, () => document.activeElement.parentElement.getAttribute('aria-level'));
  expect(next).toBe('3');
  await page.keyboard.press('ArrowLeft');
  expect(await T(page, () => document.activeElement.parentElement.dataset.id)).toBe(id);
  await page.keyboard.press('ArrowLeft');
  expect(await T(page, id => document.querySelector(`#treeBody .trow2[data-id="${id}"]`).getAttribute('aria-expanded'), id)).toBe('false');
  await page.keyboard.press('ArrowRight');
  expect(await T(page, id => document.querySelector(`#treeBody .trow2[data-id="${id}"]`).getAttribute('aria-expanded'), id)).toBe('true');
  expect(errors).toEqual([]);
});

test('RULE: the double-click menu has a visible door on the selection, and text effects sit in the Inspector', async ({page}) => {
  const errors = await open(page);
  await page.setViewportSize({width: 1440, height: 900});
  const id = await T(page, () => { const P = window.__pixiwyg, el = P.state().els.find(e => e.tag === 'p' && !e.md); P.select(el.id); return el.id; });
  await page.click('#selMore');
  await expect(page.locator('#ctxMenu')).toBeVisible();
  await expect(page.locator('#ctxMenu .cmitem b')).toContainText(['Component', 'Logic', 'Animation']);
  await page.keyboard.press('Escape');
  await page.locator('#ins .btn', {hasText: 'Text effects'}).click();
  await expect(page.locator('#tfxModal')).toBeVisible();
  expect(await T(page, () => window.__pixiwyg.state().sel)).toBe(id);
  expect(errors).toEqual([]);
});

test('RULE: contrast: text on the accent, the accent as text, muted text and errors clear AA; selection never relies on fill alone', async ({page}) => {
  const errors = await open(page);
  const r = await T(page, () => {
    const rgb = c => { const d = document.createElement('i'); d.style.color = c; document.body.append(d); const m = getComputedStyle(d).color.match(/[\d.]+/g).map(Number); d.remove(); return m; };
    const lum = c => { const [r, g, b] = rgb(c).map(v => v / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
    const cr = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
    const out = {};
    for (const t of ['light', 'dark', ...window.__pixiwyg.BUILTIN_THEMES.map(x => 't:' + x.id)]) {
      window.__pixiwyg.setTheme(t); const v = n => getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim();
      out[t] = {onhot: cr(v('onhot'), v('hot')), hotInk: Math.min(cr(v('hot-ink'), v('chrome')), cr(v('hot-ink'), v('paper'))), muted: Math.min(cr(v('muted'), v('chrome')), cr(v('muted'), v('chrome2'))), onbad: cr(v('onbad'), v('bad')), edge: cr(v('ink'), v('chrome'))};
    }
    return out;
  });
  const bad = Object.entries(r).flatMap(([t, o]) => Object.entries(o).filter(([k, v]) => v < (k === 'edge' ? 3 : 4.5)).map(([k, v]) => `${t} ${k} ${v.toFixed(2)}`));
  expect(bad).toEqual([]);
  expect(errors).toEqual([]);
});

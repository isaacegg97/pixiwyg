// SECTION: home screen: workflow starts, tours, the quest's grown-up question
import {test, expect, boot, T} from '../../tools/tests/helpers.mjs';

const ws = page => page.evaluate(() => document.body.dataset.ws);

test('home starts each workflow in one tap, where that work happens', async ({page}) => {
  const errors = await boot(page);
  const starts = [['A story', 'write', 'page'], ['A picture', 'paint', 'screen'], ['An animation', 'animate', 'screen'], ['Something in 3D', 'model', 'web']];
  for (const [name, w, kind] of starts) {
    await T(page, () => window.__pixiwyg.showTitle());
    await page.locator('.tstart', {hasText: name}).click();
    await expect.poll(() => ws(page)).toBe(w);
    expect(await T(page, () => window.__pixiwyg.state().canvas.type)).toBe(kind);
  }
  // RULE: a song starts with the ideas panel open, so there's something to play in one more tap.
  await T(page, () => window.__pixiwyg.showTitle());
  await page.fill('#tName', 'Tune');
  await page.locator('.tstart', {hasText: 'A song'}).click();
  await expect.poll(() => ws(page)).toBe('music');
  await expect(page.locator('#seqIdeas')).toBeVisible();
  expect(await T(page, () => window.__pixiwyg.state().project.name)).toBe('Tune');
  expect(errors).toEqual([]);
});

test('home lists every tour; the quest asks a grown-up first and Not now changes nothing', async ({page}) => {
  const errors = await boot(page);
  await T(page, () => window.__pixiwyg.showTitle());
  await expect(page.locator('.ttour')).toHaveCount(7);
  await page.locator('.ttour', {hasText: 'Creative Quest'}).click();
  await expect(page.locator('#qAsk')).toBeVisible();
  await expect(page.locator('#qAsk')).toContainText('3 seconds');
  await page.keyboard.press('Escape');
  await expect(page.locator('#qAsk')).toBeHidden();
  await expect(page.locator('#qIntro')).toBeHidden();
  await expect(page.locator('#title')).toBeVisible();
  expect(await T(page, () => window.__pixiwyg.ui().on)).toBe(false);
  expect(errors).toEqual([]);
});

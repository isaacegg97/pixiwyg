// SECTION: Creative Quest: the kids' guided first hour
import {test, expect, boot, T} from '../../tools/tests/helpers.mjs';

const say = page => page.locator('#qSay');
const step = page => page.evaluate(() => JSON.parse(localStorage.getItem('pixiwyg.quest') || 'null')?.i ?? null);

test('the Creative Quest starts from the welcome, steps only by doing, and nothing but a grown-up hold ends it', async ({page}) => {
  await page.setViewportSize({width: 600, height: 960});
  const errors = await boot(page, '/?test', {welcome: true});
  await expect(page.locator('#obModal')).toBeVisible();
  await page.click('#obQuest');
  // RULE: it asks a grown-up first, and switches nothing until they say yes.
  await expect(page.locator('#qAsk')).toBeVisible();
  expect(await T(page, () => window.__pixiwyg.ui().on)).toBe(false);
  await page.click('#qAskGo');
  await expect(page.locator('#qIntro')).toBeVisible();
  expect(await T(page, () => window.__pixiwyg.ui().on)).toBe(true);
  // RULE: the intro has one way forward.
  await page.keyboard.press('Escape');
  await expect(page.locator('#qIntro')).toBeVisible();
  await page.click('#qGo');
  await expect(page.locator('#qCard')).toBeVisible();
  await expect(say(page)).toContainText('Add');
  await expect(page.locator('#qSpot')).toBeVisible();
  expect(await T(page, () => window.__pixiwyg.state().project.name)).toBe('My Creative Quest');
  expect(await step(page)).toBe(0);

  // INVARIANT: touching something else doesn't move the quest on; doing the step does.
  await page.click('#xmbUndo');
  await page.waitForTimeout(500);
  expect(await step(page)).toBe(0);
  await page.click('#xmbAdd');
  await expect.poll(() => step(page)).toBe(1);
  await expect(say(page)).toContainText('Big Headline');

  // RULE: Esc, Back and a reload all leave it running, at the same step.
  await page.keyboard.press('Escape');
  await page.goBack().catch(() => {});
  await expect(page.locator('#qCard')).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => window.__pixiwyg && !document.getElementById('xmb').hidden, null, {timeout: 45_000});
  await expect(page.locator('#qCard')).toBeVisible();
  expect(await step(page)).toBe(1);
  await expect(say(page)).toContainText('Tap');

  // RULE: a short press on the grown-up button does nothing; three seconds' hold ends the quest.
  const g = await page.locator('#qGrown').boundingBox();
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
  await page.waitForTimeout(300);
  await expect(page.locator('#qCard')).toBeVisible();
  await page.mouse.down(); await page.waitForTimeout(3300); await page.mouse.up();
  await expect(page.locator('#qCard')).toBeHidden();
  expect(await step(page)).toBe(null);
  expect(await T(page, () => window.__pixiwyg.xmbItems())).toContain('Creative Quest (for kids)');
  expect(errors).toEqual([]);
});

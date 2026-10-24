// SECTION: XMB interface: the switch, the home, the keys, the strip
import {test, expect, boot, T} from '../../tools/tests/helpers.mjs';

const xmbBoot = async (page, size = {width: 390, height: 844}) => {
  await page.addInitScript(() => { try { localStorage.setItem('pixiwyg.ui', 'xmb'); } catch (e) {} });
  await page.setViewportSize(size);
  const errors = await boot(page);
  await expect(page.locator('#xmb')).toBeVisible();
  return errors;
};
const ui = page => T(page, () => window.__pixiwyg.ui());
const items = page => T(page, () => window.__pixiwyg.xmbItems());

test('XMB opens on Project with no project, starts one, and hands over to the tool and its strip', async ({page}) => {
  const errors = await xmbBoot(page);
  await expect(page.locator('#topbar')).toBeHidden();
  await expect(page.locator('#title')).toBeHidden();
  expect(await T(page, () => window.__pixiwyg.xmbCat())).toBe('project');
  // RULE: without a project, Esc and the workspace categories can't leave the home.
  await page.keyboard.press('Escape');
  await expect(page.locator('#xmb')).toBeVisible();
  await page.keyboard.press('ArrowRight');
  expect(await items(page)).toEqual(['Open or start a project first']);
  await page.keyboard.press('ArrowLeft');

  await page.locator('.xitem', {hasText: 'New: Web page'}).click();
  await expect(page.locator('#xmb')).toBeHidden();
  await expect(page.locator('#xmbStrip')).toBeVisible();
  await expect(page.locator('#xmbWsName')).toHaveText('Page');
  expect(await T(page, () => !!window.__pixiwyg.state().project)).toBe(true);

  // INVARIANT: the panels overlay the tool one at a time, from the strip.
  const body = page.locator('body');
  if ((await page.locator('#xmbAdd').getAttribute('aria-pressed')) === 'true') await page.click('#xmbAdd');
  await expect(body).toHaveClass(/\bnoL\b/);
  await page.click('#xmbAdd');
  await expect(page.locator('#sideL')).toBeVisible();
  await expect(page.locator('#xmbAdd')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#xmbProps');
  await expect(page.locator('#sideR')).toBeVisible();
  await expect(page.locator('#sideL')).toBeHidden();
  await page.click('#xmbProps');
  await expect(page.locator('#sideR')).toBeHidden();

  await page.click('#xmbPrimary');
  await expect(page.locator('#xmbPrimary')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#xmbPrimaryName')).toHaveText('Stop');
  await page.click('#xmbPrimary');
  await expect(page.locator('#xmbPrimaryName')).toHaveText('Play');

  await page.click('#xmbHome');
  await expect(page.locator('#xmb')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#xmb')).toBeHidden();
  expect(errors).toEqual([]);
});

test('XMB keys drive the cross; toggles flip in place; / searches every category', async ({page}) => {
  const errors = await xmbBoot(page);
  await page.locator('.xitem', {hasText: 'New: Web page'}).click();
  await page.click('#xmbHome');
  expect(await T(page, () => window.__pixiwyg.xmbCat())).toBe('page');
  // FORMAT: Project, the workspaces in WS order, Play, Output, Settings; ← from Project wraps to Settings.
  await T(page, () => window.__pixiwyg.xmbOpen('project'));
  await page.keyboard.press('ArrowLeft');
  expect(await T(page, () => window.__pixiwyg.xmbCat())).toBe('settings');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  expect(await T(page, () => window.__pixiwyg.xmbCat())).toBe('play');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');

  const sound = page.locator('.xitem', {hasText: 'Sound effects'});
  const before = await sound.getAttribute('aria-pressed');
  while (!(await sound.evaluate(b => b.classList.contains('on')))) await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Space');
  await expect(page.locator('#xmb')).toBeVisible();
  await expect(sound).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true');
  await expect(sound.locator('.xbadge')).toHaveText(before === 'true' ? 'Off' : 'On');

  await page.keyboard.press('/');
  await expect(page.locator('#xmbSearch')).toBeFocused();
  await page.keyboard.type('export html');
  expect(await items(page)).toContain('Export HTML…');
  await page.keyboard.press('Escape');
  await expect(page.locator('#xmbSearch')).toBeHidden();
  expect(await T(page, () => window.__pixiwyg.xmbCat())).toBe('settings');
  expect(errors).toEqual([]);
});

test('switching interfaces keeps the project and the desktop panel layout', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await T(page, async () => { const P = window.__pixiwyg; await P.newProject('Both ways'); P.setWorkspace('page'); });
  const body = page.locator('body');
  await page.click('#sideRBtn');
  await expect(body).toHaveClass(/\bnoR\b/);

  await page.keyboard.press('/');
  await page.fill('#cmdSearch', 'interface: xmb');
  await page.keyboard.press('Enter');
  await expect(page.locator('#xmb')).toBeVisible();
  await expect(page.locator('#topbar')).toBeHidden();
  expect((await ui(page)).mode).toBe('xmb');
  await expect(page.locator('#xmbProj')).toHaveText('Both ways');

  await page.keyboard.press('Escape');
  await page.click('#xmbAdd');
  await page.click('#xmbHome');
  await T(page, () => window.__pixiwyg.xmbOpen('settings'));
  await page.locator('.xitem', {hasText: 'Interface: Desktop'}).click();
  await expect(page.locator('#xmb')).toBeHidden();
  await expect(page.locator('#xmbStrip')).toBeHidden();
  await expect(page.locator('#topbar')).toBeVisible();
  // INVARIANT: what XMB opened and closed never reaches the saved desktop layout.
  await expect(body).not.toHaveClass(/\bnoL\b/);
  await expect(body).toHaveClass(/\bnoR\b/);
  expect(await T(page, () => window.__pixiwyg.state().project.name)).toBe('Both ways');

  await page.keyboard.press('Control+,');
  await expect(page.locator('#setUi')).toHaveValue('desktop');
  await page.selectOption('#setUi', 'xmb');
  expect((await ui(page)).on).toBe(true);
  await page.selectOption('#setUi', 'auto');
  // RULE: Auto follows the pointer: Chromium here has a mouse, so Auto is Desktop.
  expect(await ui(page)).toMatchObject({mode: 'auto', on: false});
  expect(errors).toEqual([]);
});

// FORMAT: real multi-touch through the DevTools protocol: each step is a list of [id, x, y] fingers down at once.
async function touch(page, steps) {
  const cdp = await page.context().newCDPSession(page);
  let down = [];
  for (const pts of steps) {
    const now = pts.map(([id, x, y]) => ({id, x, y}));
    const type = !down.length ? 'touchStart' : now.length > down.length ? 'touchStart' : now.length < down.length ? 'touchEnd' : 'touchMove';
    await cdp.send('Input.dispatchTouchEvent', {type, touchPoints: now});
    down = now;
    await page.waitForTimeout(16);
  }
  await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
}
const pinch = (cx, cy, from, to, n = 8) => Array.from({length: n + 1}, (_, i) => { const d = (from + (to - from) * i / n) / 2; return [[0, cx - d, cy], [1, cx + d, cy]]; });

test('XMB touch: two fingers zoom and pan the page and the drawing; one finger still selects and draws', async ({browser}) => {
  const ctx = await browser.newContext({viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true});
  const page = await ctx.newPage();
  const errors = await xmbBoot(page);
  await page.locator('.xitem', {hasText: 'New: Web page'}).click();
  await expect(page.locator('#xmbStrip')).toBeVisible();
  if ((await page.locator('#xmbAdd').getAttribute('aria-pressed')) === 'true') await page.click('#xmbAdd');

  const z0 = await T(page, () => window.__pixiwyg.zoom());
  await touch(page, pinch(195, 400, 80, 240));
  const z1 = await T(page, () => window.__pixiwyg.zoom());
  expect(z1).toBeGreaterThan(z0 * 2);
  // INVARIANT: a pinch never reaches the page as a click or a drag.
  expect(await T(page, () => window.__pixiwyg.state().els.length)).toBe(0);

  await T(page, () => window.__pixiwyg.setWorkspace('paint'));
  await page.waitForTimeout(300);
  const v = await page.locator('#sview').boundingBox();
  const s0 = await T(page, () => window.__pixiwyg.viewScale());
  await touch(page, pinch(v.x + v.width / 2, v.y + v.height / 2, 60, 180));
  expect(await T(page, () => window.__pixiwyg.viewScale())).toBeGreaterThan(s0 * 1.8);
  expect(await T(page, () => window.__pixiwyg.layerBlank(window.__pixiwyg.studioLayer(0).c))).toBe(true);

  await T(page, () => window.__pixiwyg.sZoomFit());
  const c = await page.locator('#sstack').boundingBox();
  await touch(page, Array.from({length: 10}, (_, i) => [[5, c.x + 20 + i * 12, c.y + 40 + i * 6]]));
  expect(await T(page, () => window.__pixiwyg.layerBlank(window.__pixiwyg.studioLayer(0).c))).toBe(false);
  expect(errors).toEqual([]);
  await ctx.close();
});

test('XMB sheets raise one at a time from the strip and go when the work is touched; Back backs out to the home', async ({page}) => {
  const errors = await xmbBoot(page);
  await page.locator('.xitem', {hasText: 'New: Web page'}).click();
  await expect(page.locator('#xmbStrip')).toBeVisible();
  await T(page, () => window.__pixiwyg.setWorkspace('paint'));
  const sheets = page.locator('#xmbSheets [data-sheet]');
  await expect(sheets).toHaveCount(6);
  await expect(page.locator('.spal[data-pal=color]')).toBeHidden();
  await page.click('#xmbSheets [data-sheet=color]');
  await expect(page.locator('.spal[data-pal=color]')).toBeVisible();
  await expect(page.locator('#xmbSheets [data-sheet=color]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('#xmbSheets [data-sheet=layers]');
  await expect(page.locator('.spal[data-pal=color]')).toBeHidden();
  await expect(page.locator('.spal[data-pal=layers]')).toBeVisible();
  await page.mouse.click(195, 300);
  await expect(page.locator('.spal[data-pal=layers]')).toBeHidden();
  await page.click('#xmbSheets [data-sheet=more]');
  await page.keyboard.press('Escape');
  await expect(page.locator('#w-studio .studio-top')).toBeHidden();
  await expect(page.locator('#xmbStrip')).toBeVisible();

  // RULE: Back closes a sheet first, then leaves the tool for the home.
  await page.click('#xmbSheets [data-sheet=tools]');
  await page.goBack();
  await expect(page.locator('.spal[data-pal=tools]')).toBeHidden();
  await expect(page.locator('#xmb')).toBeHidden();
  await page.goBack();
  await expect(page.locator('#xmb')).toBeVisible();
  expect(await T(page, () => window.__pixiwyg.xmbCat())).toBe('paint');

  // INVARIANT: the desktop palettes come back where they were docked.
  await T(page, () => window.__pixiwyg.setUi('desktop'));
  await expect(page.locator('.spal[data-pal=color]')).toBeVisible();
  expect(errors).toEqual([]);
});

test('XMB drag from the Add panel: the panel slides away so the page takes the drop', async ({page}) => {
  const errors = await xmbBoot(page);
  await page.locator('.xitem', {hasText: 'New: Web page'}).click();
  await expect(page.locator('#xmbStrip')).toBeVisible();
  if ((await page.locator('#xmbAdd').getAttribute('aria-pressed')) !== 'true') await page.click('#xmbAdd');
  await page.click('#sideL .ptab >> nth=0');
  const tab = page.locator('#palette .pal').first();
  const b = await tab.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 60, b.y + 80, {steps: 4});
  await expect(page.locator('body')).toHaveClass(/\bdragging\b/);
  await page.waitForTimeout(250);
  const side = await page.locator('#sideL').boundingBox();
  expect(side.x + side.width).toBeLessThanOrEqual(1);
  await page.mouse.move(200, 400, {steps: 6});
  await page.mouse.up();
  expect(await T(page, () => window.__pixiwyg.state().els.length)).toBe(1);
  expect(errors).toEqual([]);
});

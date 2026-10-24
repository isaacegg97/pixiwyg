// SECTION: the app itself: boot, file://, errors, panels, command palette
import {test, expect, boot, pkg, ws, T, M, freshPage} from '../../tools/tests/helpers.mjs';
import {fileURLToPath} from 'node:url';

test('command palette opens via button and keyboard, filters commands, and executes', async ({page}) => {
  const errors = await freshPage(page);
  await page.click('#cmdBtn');
  await expect(page.locator('#cmdModal')).toBeVisible();
  await expect(page.locator('#cmdSearch')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#cmdModal')).toBeHidden();

  await page.keyboard.press('/');
  await expect(page.locator('#cmdModal')).toBeVisible();
  await page.fill('#cmdSearch', 'write');
  await expect(page.locator('#cmdList')).toContainText('Write: Manuscript typesetting');
  await page.keyboard.press('Enter');
  await expect(page.locator('#cmdModal')).toBeHidden();
  expect(await T(page, () => window.__pixiwyg.ws())).toBe('write');

  await page.keyboard.press(`${M}+k`);
  await expect(page.locator('#cmdModal')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#cmdModal')).toBeHidden();

  // RULE: Stage HUD houses snap and grid controls (on the canvas; the writer hides it)
  await T(page, () => window.__pixiwyg.setWorkspace('page'));
  await expect(page.locator('#stageHud #snapBtn')).toBeVisible();
  await expect(page.locator('#stageHud #gridSize')).toBeVisible();
  await expect(page.locator('#stageHud #zoomCtl')).toBeVisible();

  expect(errors).toEqual([]);
});

test('boots clean to the title screen, stamped with the package version', async ({page}) => {
  const errors = await boot(page);
  await expect(page.locator('#envBar')).toBeHidden();
  expect(await page.evaluate(() => window.__pixiwyg.APP_VERSION)).toBe(pkg.version);
  // INVARIANT: one version everywhere: the page, package.json and the desktop shell (npm run set-version sets them all).
  const {readFileSync} = await import('node:fs');
  const conf = JSON.parse(readFileSync(new URL('../../tauri/tauri.conf.json', import.meta.url), 'utf8'));
  const cargo = readFileSync(new URL('../../tauri/Cargo.toml', import.meta.url), 'utf8').match(/\[package\][^[]*?\nversion\s*=\s*"([^"]+)"/)[1];
  expect([conf.version, cargo]).toEqual([pkg.version, pkg.version]);
  expect(await page.evaluate(() => window.__pixiwyg.ERRS.length)).toBe(0);
  expect(errors).toEqual([]);
});

test('says plainly why it can’t work when opened as a file', async ({page}) => {
  await page.goto('file://' + fileURLToPath(new URL('../../index.html', import.meta.url)));
  await expect(page.locator('#envBar')).toBeVisible();
  await expect(page.locator('#envBar')).toContainText('Opened as a file');
});

test('errors are recorded and land in the problem report', async ({page}) => {
  await boot(page);
  await page.evaluate(() => setTimeout(() => { throw new Error('boom-for-the-report'); }));
  await page.waitForFunction(() => window.__pixiwyg.ERRS.some(e => e.msg.includes('boom-for-the-report')));
  await page.evaluate(async () => { await window.__pixiwyg.newProject('Report', false, {type: 'web'}); });
  await page.click('#moreMenu summary');
  await page.click('#reportBtn');
  const text = await page.inputValue('#reportText');
  expect(text).toContain('boom-for-the-report');
  expect(text).toContain(`PIXIWYG ${pkg.version}`);
});

test('sidebars can be dragged wider, and keep their width', async ({page}) => {
  await boot(page);
  await page.evaluate(() => window.__pixiwyg.newProject('Wide', false, {type: 'web'}));
  const h = await page.locator('#rszL').boundingBox(), left = await page.evaluate(() => document.getElementById('sideL').getBoundingClientRect().left);
  await page.mouse.move(h.x + 4, h.y + 200); await page.mouse.down(); await page.mouse.move(left + 520, 300, {steps: 4}); await page.mouse.up();
  expect(await page.evaluate(() => Math.round(document.getElementById('sideL').getBoundingClientRect().width))).toBe(520);
  await page.reload();
  await page.waitForFunction(() => window.__pixiwyg && !document.getElementById('title').hidden);
  expect(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--lw').trim())).toBe('520px');
  await page.evaluate(() => window.__pixiwyg.newProject('Wide again', false, {type: 'web'}));
  await page.dblclick('#rszL');
  expect(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--lw').trim())).toBe('');
});

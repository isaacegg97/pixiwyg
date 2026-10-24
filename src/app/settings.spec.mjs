// SECTION: interface themes and the settings page
import {test, expect, T, freshPage} from '../../tools/tests/helpers.mjs';

test('FORMAT: src/app/themes/template.css is the in-app theme template at the light defaults (UPDATE_THEME=1 rewrites it)', async ({page}) => {
  const {readFileSync, writeFileSync} = await import('node:fs');
  const errors = await freshPage(page);
  const t = await T(page, () => { window.__pixiwyg.setTheme('light'); return window.__pixiwyg.themeTemplate(); });
  const file = new URL('themes/template.css', import.meta.url);
  if (process.env.UPDATE_THEME) writeFileSync(file, t);
  expect(t).toBe(readFileSync(file, 'utf8'));
  // INVARIANT: every token the template lists is defined by the app, so a theme can never name one that does nothing.
  expect(await T(page, () => window.__pixiwyg.APP_TOKENS.flatMap(([, t]) => t.map(([n]) => n)).filter(n => !getComputedStyle(document.documentElement).getPropertyValue('--' + n).trim()))).toEqual([]);
  expect(errors).toEqual([]);
});

test('interface themes: a loaded .css recolours the app, joins the Theme button, survives a reload, never reaches the network, and can be forgotten', async ({page}) => {
  const {readFileSync} = await import('node:fs');
  const errors = await freshPage(page);
  const css = readFileSync(new URL('themes/terminal.css', import.meta.url), 'utf8') + '\n@import url(https://example.com/x.css);\n:root[data-apptheme] .logo{background:url(https://example.com/track.png)}\n';
  const net = [];
  page.on('request', r => { if (r.url().includes('example.com')) net.push(r.url()); });
  await page.setInputFiles('#appThemeFile', {name: 'mine.css', mimeType: 'text/css', buffer: Buffer.from(css)});
  await expect.poll(() => T(page, () => window.__pixiwyg.theme())).toBe('custom');
  const tok = () => T(page, () => { const cs = getComputedStyle(document.documentElement); return {desk: cs.getPropertyValue('--desk').trim(), pix: document.documentElement.dataset.pix, on: document.documentElement.hasAttribute('data-apptheme'), btn: window.__pixiwyg.theme(), scheme: cs.colorScheme}; });
  expect(await tok()).toEqual({desk: '#0a120c', pix: 'dark', on: true, btn: 'custom', scheme: 'dark'});
  expect(await T(page, () => document.getElementById('appTheme').textContent)).not.toMatch(/example\.com/);
  expect(await T(page, () => !document.getElementById('appThemeForget').hidden)).toBe(true);
  // RULE: every theme, the loaded file too, is one search away in the command window.
  await page.keyboard.press('Escape');
  await T(page, () => window.__pixiwyg.setTheme('system'));
  await page.keyboard.press('/'); await page.fill('#cmdSearch', 'theme: mine'); await page.keyboard.press('Enter');
  expect((await tok()).btn).toBe('custom');
  await T(page, () => window.__pixiwyg.setTheme('system'));
  expect(await tok()).toMatchObject({on: false, btn: 'system'});
  expect(await T(page, () => document.getElementById('appTheme').textContent)).toBe('');
  await T(page, () => window.__pixiwyg.setTheme('custom'));
  await page.reload();
  await page.waitForFunction(() => window.__pixiwyg);
  expect(await tok()).toMatchObject({desk: '#0a120c', on: true, btn: 'custom'});
  await T(page, () => document.getElementById('appThemeForget').click());
  expect(await tok()).toMatchObject({on: false, btn: 'system'});
  expect(await T(page, () => document.getElementById('appThemeForget').hidden)).toBe(true);
  expect(net).toEqual([]);
  expect(errors).toEqual([]);
});

test('settings page: Ctrl+, opens it; themes pick and persist; editor, sound and export defaults are the same settings as the toolbar; resets work', async ({page}) => {
  const {readdirSync} = await import('node:fs');
  const errors = await freshPage(page);
  const files = readdirSync(new URL('themes/', import.meta.url)).filter(f => f.endsWith('.css') && f !== 'template.css');
  expect(await T(page, () => window.__pixiwyg.BUILTIN_THEMES.map(t => t.id + ':' + !!t.name + ':' + /data-apptheme/.test(t.css)))).toEqual(files.sort().map(f => f.replace('.css', '') + ':true:true'));
  // FORMAT: build directives are all resolved: borrowed fonts and icons arrive as data, nothing points elsewhere.
  expect(await T(page, () => window.__pixiwyg.BUILTIN_THEMES.filter(t => /INCLUDE:|ASSET:|url\((?!["']?data:)/.test(t.css.replace(/url\("data:[^"]*"\)|url\('data:[^']*'\)/g, ''))).map(t => t.id))).toEqual([]);
  expect(await T(page, () => { const t = window.__pixiwyg.BUILTIN_THEMES.find(t => t.id === 'win98'); return [/@font-face\{[^}]*Pixelated MS Sans Serif/.test(t.css), /--w98-check:url\("data:image\/svg/.test(t.css)]; })).toEqual([true, true]);
  await page.keyboard.press('Control+,');
  await expect(page.locator('#setModal')).toBeVisible();
  await expect(page.locator('#setThemes .thcard')).toHaveCount(3 + files.length);
  await page.locator('#setThemes .thcard', {hasText: 'Nord'}).click();
  const look = () => T(page, () => ({desk: getComputedStyle(document.documentElement).getPropertyValue('--desk').trim(), btn: window.__pixiwyg.theme(),
    checked: [...document.querySelectorAll('#setThemes .thcard[aria-checked="true"]')].map(b => b.dataset.theme)}));
  expect(await look()).toEqual({desk: '#2e3440', btn: 't:nord', checked: ['t:nord']});
  // RULE: a card is drawn in its own theme's colours.
  expect(await T(page, () => document.querySelector('#setThemes .thcard[data-theme="t:paper"] .thsw').style.getPropertyValue('--d'))).toBe('#e8e1d0');
  await page.locator('#setSnap').uncheck();
  await page.locator('#setGrid').selectOption('16');
  await page.locator('#setShowGrid').check();
  await page.locator('#setSound').uncheck();
  await page.locator('#setExp-nojs').uncheck();
  await page.locator('#setDocView').selectOption('md');
  expect(await T(page, () => ({snap: document.getElementById('snapBtn').textContent, grid: document.getElementById('gridSize').value, lines: !document.getElementById('gridlines').hidden,
    sound: window.__pixiwyg.state().sound, nojs: window.__pixiwyg.expOpt.nojs, view: localStorage.getItem('pixiwyg.doc.view')})))
    .toEqual({snap: 'Snap off', grid: '16', lines: true, sound: false, nojs: false, view: 'md'});
  await page.keyboard.press('Escape');
  await expect(page.locator('#setModal')).toBeHidden();
  await page.reload();
  await page.waitForFunction(() => window.__pixiwyg);
  expect(await look()).toMatchObject({desk: '#2e3440', btn: 't:nord'});
  expect(await T(page, () => [window.__pixiwyg.state().sound, window.__pixiwyg.state().snap, window.__pixiwyg.state().grid, window.__pixiwyg.expOpt.nojs])).toEqual([false, false, 16, false]);
  // RULE: the toolbar's own toggles are the same settings, so the page shows what they set.
  await T(page, () => { document.getElementById('setSound').click(); window.__pixiwyg.closeSettings(); });
  await T(page, () => window.__pixiwyg.openSettings());
  expect(await page.locator('#setSound').isChecked()).toBe(true);
  await T(page, () => { window.__pixiwyg.moveDock('sideR', 'before', 0); window.__pixiwyg.logErr('test', 'boom'); window.__pixiwyg.openSettings(); });
  await expect(page.locator('#setErrN')).not.toHaveText('empty');
  await T(page, () => document.getElementById('setResetPanels').click());
  expect(await T(page, () => window.__pixiwyg.dockLayout())).toEqual({before: ['tree', 'sideL'], after: ['sideR']});
  await T(page, () => document.getElementById('setClearErr').click());
  await expect(page.locator('#setErrN')).toHaveText('empty');
  expect(await T(page, () => window.__pixiwyg.ERRS.length)).toBe(0);
  await page.click('#setClose');
  await expect(page.locator('#setModal')).toBeHidden();
  expect(errors.filter(e => !/boom/.test(e))).toEqual([]);
});

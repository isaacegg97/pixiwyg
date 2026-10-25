// FORMAT: specs under src/ can't resolve tools/node_modules, so they take Playwright's test and expect from here.
export {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export const PUBLISH_SOCK = join(tmpdir(), `pixiwyg-test-publish-${process.getuid ? process.getuid() : 0}.sock`);

// RULE: a timing limit is set on a developer machine; shared CI runners are slower and noisier, so there it is
//   loosened 4×. A real regression (the 2× to 10× ones these tests exist for) still fails on either.
export const budget = ms => ms * (process.env.CI ? 4 : 1);

export const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));

// INVARIANT: returns page errors except Google Fonts, which a test machine may not reach and the app doesn't need.
//   The first-visit welcome is skipped unless asked for.
export async function boot(page, path = '/?test', {welcome = false} = {}) {
  const errors = [];
  if (!welcome) await page.addInitScript(() => { try { localStorage.setItem('pixiwyg.onboarded', '1'); } catch (e) {} });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts\.g(oogleapis|static)/.test(m.text() + (m.location().url || ''))) errors.push(m.text()); });
  await page.goto(path);
  await page.waitForFunction(() => window.__pixiwyg && !document.getElementById('title').hidden, null, {timeout: 45_000});
  return errors;
}

// HACK: waits for web fonts and a few frames so measured layouts are final.
export const settle = page => page.evaluate(async () => { await document.fonts.ready; await new Promise(r => setTimeout(r, 400)); });

// INVARIANT: workspaces live in a menu behind #wsBtn; switch the way a person does.
export async function ws(page, id) { await page.click('#wsBtn'); await page.click(`#wsTabs [data-ws=${id}]`); }

// RULE: a toolbar button that doesn't fit lives in More ▾; click it where a person would find it.
export async function tb(page, sel) {
  if (!(await page.locator(sel).isVisible())) await page.click('#moreMenu summary');
  await page.click(sel);
}

// FORMAT: shorthands the specs share: T runs a function in the page, M is the platform's command key.
export const T = (page, fn, arg) => page.evaluate(fn, arg);
export const M = process.platform === 'darwin' ? 'Meta' : 'Control';

// INVARIANT: a booted app at 1700x950 with a fresh, empty project in the Page workspace.
export async function freshPage(page) {
  const errors = await boot(page);
  await page.setViewportSize({width: 1700, height: 950});
  await T(page, async () => { const P = window.__pixiwyg; await P.newProject('features'); P.setWorkspace('page'); });
  return errors;
}
// FORMAT: adds a plain paragraph element at (x, y), selects it, and returns its id.
export const addP = (page, text, x = 120, y = 120) => T(page, ([text, x, y]) => {
  const P = window.__pixiwyg, S = P.state(), el = {id: 'k' + Math.random().toString(36).slice(2, 8), tag: 'p', content: text, x, y, w: 300, z: 1, fileId: null, selector: null};
  S.els.push(el); P.renderAll(); P.select(el.id); return el.id;
}, [text, x, y]);

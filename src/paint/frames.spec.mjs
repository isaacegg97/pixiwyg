// SECTION: Paint Studio frames: APNG out, frames back in
import {test, expect, boot, ws} from '../../tools/tests/helpers.mjs';

const T = (page, fn, arg) => page.evaluate(fn, arg);
const stroke = async (page, dx) => { const b = await page.locator('#paint').boundingBox(); await page.mouse.move(b.x + 30 + dx, b.y + 30); await page.mouse.down(); await page.mouse.move(b.x + 90 + dx, b.y + 80, {steps: 5}); await page.mouse.up(); };

test('frames: paint, add a frame, onion skin, play; out as an animated PNG and back in as frames', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await T(page, async () => { await window.__pixiwyg.newProject('Flip', false, {type: 'web'}, 'paint'); });
  await expect(page.locator('#w-studio')).toBeVisible();
  await stroke(page, 0);
  await page.click('#fAdd');
  await expect(page.locator('#fPos')).toHaveText('2 / 2');
  expect(await T(page, () => { const o = document.getElementById('onion'), d = o.getContext('2d').getImageData(0, 0, o.width, o.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; })).toBe(true);
  await page.click('#fBlank');
  await stroke(page, 120);
  await expect(page.locator('#fStrip .fthumb')).toHaveCount(3);
  await page.click('#fPlay'); await page.waitForTimeout(300); await page.click('#fPlay');
  await page.selectOption('#fFps', '12');
  await page.click('#sPlace');
  const info = await T(page, async () => { const P = window.__pixiwyg, el = P.state().els.find(e => e.tag === 'img'), a = await P.decodeAPNG(el.content); return {apng: el.content.startsWith('data:image/png;base64,'), frames: a && a.frames.length, fps: a && a.fps, alt: el.attrs.alt}; });
  expect(info).toEqual({apng: true, frames: 3, fps: 12, alt: 'Animation'});
  await ws(page, 'page');
  await page.keyboard.press('Control+p'); await page.locator('#filesList .fitem', {hasText: 'Animation'}).click();
  await expect(page.locator('#fPos')).toHaveText('1 / 3');
  await expect(page.locator('#fFps')).toHaveValue('12');
  expect(errors).toEqual([]);
});

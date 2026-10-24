// SECTION: music player: vendored Webamp, skins, Play mode, sequencer, exports
import {test, expect, boot, ws} from '../../tools/tests/helpers.mjs';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const LIB = new URL('../../lib/', import.meta.url);
const press = (page, label) => page.evaluate(l => { const T = window.__pixiwyg, el = T.state().els.find(e => e.content === l); T.hostOf(el.id).shadowRoot.querySelector('button').click(); }, label);
const playing = page => page.locator('#webamp #main-window.play');

test('the page’s ▶ opens Webamp in the project’s skin and plays the song; ■ and Esc stop it', async ({page}) => {
  const errors = await boot(page);
  await page.evaluate(() => window.__pixiwyg.openExample('musician'));
  await page.click('#playBtn');
  expect(await page.evaluate(() => window.__pixiwyg.state().player)).toEqual({skin: 'dashamp-ii'});
  const skin = page.waitForResponse(r => /\/lib\/skin-dashamp-ii\.wsz$/.test(r.url()) && r.ok());
  await press(page, '▶ Play');
  await skin;
  await expect(playing(page)).toBeAttached({timeout: 20_000});
  await press(page, '■ Stop');
  await expect.poll(() => page.evaluate(() => window.__pixiwyg.songPlaying())).toBe(false);
  await press(page, '▶ Play');
  await expect(playing(page)).toBeAttached();
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__pixiwyg.playerShown())).toBe(false);
  expect(errors).toEqual([]);
});

test('skins: the ones that ship, your own .wsz kept in the project, and anything else refused', async ({page}) => {
  const errors = await boot(page);
  await page.evaluate(() => window.__pixiwyg.openExample('musician'));
  await ws(page, 'music');
  expect(await page.locator('#seqSkin option').allTextContents()).toEqual(['Winamp classic (base skin)', 'DashAmp II', 'SmoothAmp']);
  await expect(page.locator('#seqSkin')).toHaveValue('dashamp-ii');
  await page.selectOption('#seqSkin', 'smoothamp');
  expect(await page.evaluate(() => window.__pixiwyg.state().player)).toEqual({skin: 'smoothamp'});
  await page.setInputFiles('#seqSkinFile', {name: 'not-a-skin.wsz', mimeType: 'application/octet-stream', buffer: Buffer.from('hello')});
  await expect(page.locator('#status')).toContainText('isn’t a Winamp skin');
  await page.setInputFiles('#seqSkinFile', {name: 'My Skin.wsz', mimeType: 'application/octet-stream', buffer: readFileSync(new URL('skin-dashamp-ii.wsz', LIB))});
  await expect(page.locator('#seqSkin')).toHaveValue('custom');
  await expect(page.locator('#seqSkin option:checked')).toHaveText('My Skin');
  const r = await page.evaluate(async () => {
    const T = window.__pixiwyg, f1 = T.packProject(), k = T.filesKey(f1), man = JSON.parse(typeof f1.get('manifest.json') === 'string' ? f1.get('manifest.json') : new TextDecoder().decode(f1.get('manifest.json')));
    await T.openFiles(new Map(await T.unzip(T.zipFiles(T.sortEntries(f1)))), {});
    return {player: man.player, asset: man.assets.find(a => a.path === man.player.file), same: T.filesKey(T.packProject()) === k, back: T.state().player.name};
  });
  expect(r.player).toMatchObject({skin: 'custom', name: 'My Skin', file: expect.stringMatching(/^assets\/[0-9a-f]+\.wsz$/)});
  expect(r.asset.type).toBe('application/x-winamp-skin');
  expect(r.same).toBe(true);
  expect(r.back).toBe('My Skin');
  expect(await page.evaluate(() => window.__pixiwyg.cleanPlayer({skin: 'custom', data: 'data:text/html;base64,PHNjcmlwdD4='}))).toBeNull();
  expect(await page.evaluate(() => window.__pixiwyg.cleanPlayer({skin: '../../etc/passwd'}))).toBeNull();
  expect(errors).toEqual([]);
});

test('the exported page carries the player: Webamp from unpkg pinned to our copy, or inlined, and it plays', async ({page, context}) => {
  const errors = await boot(page);
  await page.evaluate(() => window.__pixiwyg.openExample('musician'));
  const sri = 'sha384-' + createHash('sha384').update(readFileSync(new URL('webamp.bundle.min.js', LIB))).digest('base64');
  const cdn = await page.evaluate(async () => { const T = window.__pixiwyg; T.expOpt.nojs = false; T.expOpt.playerCdn = true; return T.buildExport(); });
  expect(cdn).toContain(`<script src="https://unpkg.com/webamp@2.3.1/built/webamp.bundle.min.js" integrity="${sri}" crossorigin="anonymous"></script>`);
  const inline = await page.evaluate(async () => { const T = window.__pixiwyg; T.expOpt.playerCdn = false; return T.buildExport(); });
  expect(inline).not.toContain('unpkg.com');
  expect(inline.length).toBeGreaterThan(900_000);
  const out = await context.newPage();
  const errs = []; out.on('pageerror', e => errs.push(e.message));
  await out.route('**/*', r => r.request().url().startsWith('data:') || r.request().url().startsWith('blob:') ? r.continue() : r.abort());
  await out.setContent(inline);
  await out.evaluate(() => { for (const h of document.querySelectorAll('.el')) { const b = h.shadowRoot.querySelector('button'); if (b && b.textContent === '▶ Play') b.click(); } });
  await expect(out.locator('#webamp #main-window.play')).toBeAttached({timeout: 30_000});
  expect(errs).toEqual([]);
  expect(errors).toEqual([]);
});

test('the vendored player and skins are what NOTICES says they are', async () => {
  const notices = readFileSync(new URL('NOTICES.txt', LIB), 'utf8');
  for (const [file, md5] of [['skin-dashamp-ii.wsz', '60fd23595aaf200c2ab6085581b69b0d'], ['skin-smoothamp.wsz', 'db5eec34ec01596b54929e08fb4fb139']]) {
    expect(createHash('md5').update(readFileSync(new URL(file, LIB))).digest('hex')).toBe(md5);
    expect(notices).toContain(`lib/${file}`);
    expect(notices).toContain(md5);
  }
  expect(notices).toContain('Webamp 2.3.1');
  expect(readFileSync(new URL('webamp.bundle.min.js', LIB), 'utf8')).toContain('Webamp');
});

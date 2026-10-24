// SECTION: first visit: profile, tour on an example, onward tours
import {test, expect, boot, T, freshPage} from '../../tools/tests/helpers.mjs';

async function walk(page, name) {
  await expect(page.locator('#tourStep')).toContainText(name + ' · 1 of');
  for (let guard = 0; guard < 40; guard++) {
    const t = await page.evaluate(() => window.__pixiwyg.tour());
    if (t.i === t.n - 1) return t;
    await page.click('#tourNext');
    await expect(page.locator('#tourStep')).toContainText(`${t.i + 2} of ${t.n}`);
  }
  throw new Error('the tour never ended');
}

test('a first visit asks who you are; each kind gets its example and its own short tour', async ({page}) => {
  test.setTimeout(180_000);
  const errors = await boot(page, '/?test', {welcome: true});
  await expect(page.locator('#obModal')).toBeVisible();
  for (const [p, name, project, ws] of [['artist', 'Artist', 'Mx. Pigment', 'paint'], ['musician', 'Musician', 'Unpaid Interns', 'music'], ['writer', 'Writer', 'Notes From the Margin', 'write'], ['animator', 'Animator', 'THE DEADLINE', 'animate']]) {
    if (!(await page.locator('#obModal').isVisible())) { await page.evaluate(() => window.__pixiwyg.showTitle()); await page.click('#tTour'); }
    await page.click(`#obModal .obcard[data-p="${p}"]`);
    await expect(page.locator('#title')).toBeHidden();
    await expect(page.locator('#projName')).toHaveValue(new RegExp(project));
    await expect.poll(() => page.evaluate(() => window.__pixiwyg.ws())).toBe(ws);
    const t = await walk(page, name);
    expect(t.n).toBeGreaterThan(8);
    if (p === 'musician') await expect(page.locator('#seqModal')).toBeHidden();
    await expect(page.locator('#tourNext')).toHaveText('Let me loose');
    await expect(page.locator('#tourCard .tourx')).toHaveText(['Build components', 'Full tour']);
    await page.click('#tourNext');
    await expect(page.locator('#tour')).toBeHidden();
  }
  expect(await page.evaluate(() => localStorage.getItem('pixiwyg.profile'))).toBe('animator');
  expect(errors).toEqual([]);
});

test('the components tutorial and the full tour follow on from a profile’s tour', async ({page}) => {
  test.setTimeout(120_000);
  const errors = await boot(page, '/?test', {welcome: true});
  await page.click('#obModal .obcard[data-p="artist"]');
  await walk(page, 'Artist');
  await page.locator('#tourCard .tourx', {hasText: 'Build components'}).click();
  const c = await walk(page, 'Components');
  expect(c.n).toBeGreaterThan(4);
  await expect(page.locator('#nodeModal')).toBeHidden();
  await page.locator('#tourCard .tourx', {hasText: 'Full tour'}).click();
  const f = await walk(page, 'Tour');
  expect(f.n).toBeGreaterThan(12);
  await page.click('#tourNext');
  await expect(page.locator('#tour')).toBeHidden();
  expect(errors).toEqual([]);
});

test('skipping is remembered, and the welcome is one click away on the title screen', async ({page}) => {
  await boot(page, '/?test', {welcome: true});
  await page.click('#obSkip');
  await expect(page.locator('#obModal')).toBeHidden();
  await expect(page.locator('#tour')).toBeHidden();
  await page.reload();
  await page.waitForFunction(() => window.__pixiwyg && !document.getElementById('title').hidden);
  await page.waitForTimeout(300);
  await expect(page.locator('#obModal')).toBeHidden();
  await page.click('#tTour');
  await expect(page.locator('#obModal')).toBeVisible();
  await page.click('#obFull');
  await expect(page.locator('#tourTitle')).toHaveText('Start with a canvas');
});

test('the example pages open, round-trip, and do what they show off', async ({page}) => {
  const errors = await boot(page);
  for (const name of ['artist', 'musician', 'writer', 'animator']) {
    const r = await page.evaluate(async name => {
      const T = window.__pixiwyg; if (!(await T.openExample(name))) return null;
      const s = T.state(), f1 = T.packProject(), k = T.filesKey(f1);
      await T.openFiles(new Map(await T.unzip(T.zipFiles(T.sortEntries(f1)))), {});
      return {same: T.filesKey(T.packProject()) === k, els: s.els.length, anims: T.state().els.filter(e => e.anim).length, scaled: T.state().els.filter(e => e.sx).length,
        logic: T.state().logic.nodes.length, music: T.state().music && T.state().music.tracks.length, canvas: T.state().canvas.type, pages: T.state().canvas.pages || 0};
    }, name);
    expect(r, name).not.toBeNull();
    expect(r.same, name).toBe(true);
    expect(r.els, name).toBeGreaterThan(10);
    expect(r.anims, name).toBeGreaterThan(0);
    if (name === 'artist') expect(r).toMatchObject({canvas: 'web', logic: 3});
    if (name === 'musician') expect(r).toMatchObject({canvas: 'web', music: 4, logic: 4});
    if (name === 'writer') expect(r).toMatchObject({canvas: 'booklet', pages: 8});
    if (name === 'animator') { expect(r).toMatchObject({canvas: 'screen'}); expect(r.anims).toBeGreaterThan(8); }
  }
  expect(errors).toEqual([]);
});

test('the musician’s player plays the song in Play mode, and stops with it', async ({page}) => {
  const errors = await boot(page);
  await page.evaluate(() => window.__pixiwyg.openExample('musician'));
  await page.click('#playBtn');
  const press = label => page.evaluate(l => { const T = window.__pixiwyg, el = T.state().els.find(e => e.content === l); T.hostOf(el.id).shadowRoot.querySelector('button').click(); }, label);
  await press('▶ Play');
  await expect.poll(() => page.evaluate(() => window.__pixiwyg.songPlaying())).toBe(true);
  await press('■ Stop');
  await expect.poll(() => page.evaluate(() => window.__pixiwyg.songPlaying())).toBe(false);
  await press('▶ Play');
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => window.__pixiwyg.songPlaying())).toBe(false);
  expect(errors).toEqual([]);
});

// RULE: every tour step that points at something points at something real and visible, in every tour, at a common
//   laptop width (where some toolbar tools have moved into More) and at full width.
for (const width of [1280, 1600]) test(`every tour step finds its target at ${width}px`, async ({page}) => {
  test.setTimeout(240_000);
  const errors = await boot(page, '/?test', {welcome: true});
  await page.setViewportSize({width, height: 900});
  const missing = [];
  const run = async name => {
    for (let guard = 0; guard < 45; guard++) {
      await page.waitForTimeout(120);
      const s = await page.evaluate(() => window.__pixiwyg.tourStep());
      if (s.target && !s.spots) missing.push(`${name}: “${s.title}” (${s.target}) in ${s.ws}`);
      if (s.last) return;
      await page.click('#tourNext');
    }
  };
  for (const p of await page.evaluate(() => window.__pixiwyg.PROFILE_IDS())) {
    if (!(await page.locator('#obModal').isVisible())) { await page.evaluate(() => window.__pixiwyg.showTitle()); await page.click('#tTour'); }
    await page.click(`#obModal .obcard[data-p="${p}"]`);
    await expect(page.locator('#tourStep')).toBeVisible();
    await run(p);
    await page.keyboard.press('Escape');
  }
  await page.evaluate(() => window.__pixiwyg.showTitle()); await page.click('#tTour'); await page.click('#obFull');
  await page.waitForTimeout(150); await page.click('#tourNext');
  await expect(page.locator('#title')).toBeHidden();
  await run('full');
  await page.keyboard.press('Escape');
  expect(missing).toEqual([]);
  expect(errors).toEqual([]);
});

test('first launch offers a theme: cards apply at once, arrows move between them, and the pick sticks', async ({page}) => {
  const errors = await boot(page, '/?test', {welcome: true});
  await expect(page.locator('#obModal')).toBeVisible();
  const n = await page.evaluate(() => 3 + window.__pixiwyg.BUILTIN_THEMES.length);
  await expect(page.locator('#obThemes .thcard')).toHaveCount(n);
  await expect(page.locator('#obThemes .thcard[aria-checked="true"]')).toBeFocused();
  await page.locator('#obThemes .thcard', {hasText: 'Windows 98'}).click();
  expect(await page.evaluate(() => [window.__pixiwyg.theme(), document.documentElement.hasAttribute('data-apptheme')])).toEqual(['t:win98', true]);
  await page.keyboard.press('ArrowRight');
  const next = await page.evaluate(() => window.__pixiwyg.theme());
  expect(next).not.toBe('t:win98');
  await expect(page.locator(`#obThemes .thcard[data-theme="${next}"]`)).toBeFocused();
  await page.locator('#obThemes .thcard', {hasText: 'Dredful'}).click();
  await page.click('#obSkip');
  await page.reload();
  await page.waitForFunction(() => window.__pixiwyg);
  expect(await page.evaluate(() => window.__pixiwyg.theme())).toBe('t:dredful');
  expect(errors).toEqual([]);
});

test('RULE: the example pages pass their own checks', async ({page}) => {
  const errors = await freshPage(page);
  for (const ex of ['artist', 'musician', 'writer', 'animator']) {
    const found = await T(page, async ex => { const P = window.__pixiwyg; await P.openExample(ex); P.setWorkspace('page'); await document.fonts.ready; return P.a11yCheck().map(x => x.msg); }, ex);
    expect(found, ex).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('the tour starts on the canvas picker and carries on into the demo', async ({page}) => {
  await boot(page);
  await page.click('#tTour');
  await page.click('#obFull');
  await expect(page.locator('#tourTitle')).toHaveText('Start with a canvas');
  await expect(page.locator('#title')).toBeVisible();
  await page.click('#tourNext');
  await expect(page.locator('#title')).toBeHidden();
  await expect(page.locator('#tourStep')).toContainText('2 of');
  expect(await page.evaluate(() => window.__pixiwyg.state().els.length)).toBeGreaterThan(8);
});

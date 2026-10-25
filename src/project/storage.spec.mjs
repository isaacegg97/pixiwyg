// SECTION: browser storage: content-addressed blobs shared across projects, old records still read, GC after delete
import {test, expect, boot, budget} from '../../tools/tests/helpers.mjs';

const T = (page, fn, arg) => page.evaluate(fn, arg);

test('assets are stored once, shared by projects, written only when new, and swept when nothing uses them', async ({page}) => {
  const errors = await boot(page);
  const r = await T(page, async () => {
    const P = window.__pixiwyg, out = {};
    const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#f0f'; x.fillRect(0, 0, 40, 40);
    const img = c.toDataURL('image/png');
    const blobs = () => P.tx(['blobs'], 'readonly', b => b.getAllKeys());
    await P.newProject('one'); P.state().els.push({id: 'i1', tag: 'img', content: img, x: 0, y: 0, w: 64}); await P.saveNow();
    const a = P.state().project.id;
    await P.newProject('two'); P.state().els.push({id: 'i2', tag: 'img', content: img, x: 9, y: 9, w: 64}); await P.saveNow();
    const b = P.state().project.id;
    out.shared = (await blobs()).length;
    const rec = await P.tx(['files'], 'readonly', f => f.get(b));
    out.inline = Object.values(rec.files).some(v => typeof v !== 'string');
    out.listed = rec.blobs.length;
    const back = await P.storedFiles(b);
    out.back = [...back.keys()].filter(k => k.startsWith('assets/')).length;
    // COMPAT: a v2 record with bytes inline still reads.
    await P.tx(['index', 'files'], 'readwrite', (i, f) => { i.put({id: 'old', name: 'old', created: 1, modified: 1}); f.put({id: 'old', files: Object.fromEntries(back)}); });
    out.old = [...(await P.storedFiles('old')).keys()].filter(k => k.startsWith('assets/')).length;
    await P.dropProject('old');
    await P.dropProject(a);
    out.afterOne = (await blobs()).length;
    await P.newProject('three');
    await P.dropProject(b);
    out.afterBoth = (await blobs()).length;
    return out;
  });
  expect(r).toEqual({shared: 1, inline: false, listed: 1, back: 1, old: 1, afterOne: 1, afterBoth: 0});
  expect(errors).toEqual([]);
});

test('PERF: autosave on a project with large images no longer clones them', async ({page}) => {
  const errors = await boot(page);
  const ms = await T(page, async () => {
    const P = window.__pixiwyg; await P.newProject('heavy'); const S = P.state();
    const c = document.createElement('canvas'); c.width = 1200; c.height = 1200; const x = c.getContext('2d');
    for (let i = 0; i < 8; i++) { const d = x.createImageData(1200, 1200); for (let k = 0; k < d.data.length; k++) d.data[k] = Math.random() * 255; x.putImageData(d, 0, 0); S.els.push({id: 'h' + i, tag: 'img', content: c.toDataURL('image/png'), x: i * 10, y: 0, w: 200}); }
    await P.saveNow();
    const t = [];
    for (let i = 0; i < 3; i++) { S.els[0].x += 1; const a = performance.now(); await P.saveNow(); t.push(performance.now() - a); }
    return Math.min(...t);
  });
  // PERF: ~140ms per save before v3 at this size; now text-only.
  expect(ms).toBeLessThan(budget(60));
  expect(errors).toEqual([]);
});

test('versions: save one, change things, go back; the state before is kept too; pictures survive GC while a version needs them', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1600, height: 900});
  const r = await T(page, async () => {
    const P = window.__pixiwyg, out = {};
    await P.newProject('versioned'); const S = P.state();
    const c = document.createElement('canvas'); c.width = 32; c.height = 32; c.getContext('2d').fillRect(0, 0, 16, 16);
    S.els.push({id: 'pic', tag: 'img', content: c.toDataURL('image/png'), x: 10, y: 10, w: 32}, {id: 'txt', tag: 'p', content: 'first', x: 10, y: 60, w: 200});
    P.renderAll(); await P.saveNow();
    await P.saveVersion('with picture');
    S.els = S.els.filter(e => e.id !== 'pic'); S.els.find(e => e.tag === 'p').content = 'second'; P.renderAll(); await P.saveNow();
    out.gc = await P.gcBlobs();
    out.blobs = (await P.tx(['blobs'], 'readonly', b => b.getAllKeys())).length;
    const v = (await P.listVersions(S.project.id)).find(x => x.name === 'with picture');
    out.ok = await P.restoreVersion(v.id);
    const S2 = P.state();
    out.after = S2.els.map(e => e.tag).sort();
    out.text = S2.els.find(e => e.tag === 'p').content;
    out.names = (await P.listVersions(S2.project.id)).map(x => x.name);
    out.sameId = S2.project.id === S.project.id;
    return out;
  });
  expect(r.gc).toBe(0);
  expect(r.blobs).toBe(1);
  expect(r.ok).toBe(true);
  expect(r.after).toEqual(['img', 'p']);
  expect(r.text).toBe('first');
  expect(r.names).toEqual(['Before restoring “with picture”', 'with picture']);
  expect(r.sameId).toBe(true);
  await page.keyboard.press('Escape');
  await page.locator('#desk').click({position: {x: 5, y: 5}});
  await page.keyboard.press(`${process.platform === 'darwin' ? 'Meta' : 'Control'}+Alt+v`);
  await expect(page.locator('#verModal')).toBeVisible();
  await page.locator('#verName').fill('by hand');
  await page.locator('#verName').press('Enter');
  await expect(page.locator('#verList li b').first()).toHaveText('by hand');
  await page.keyboard.press('Escape');
  await expect(page.locator('#verModal')).toBeHidden();
  expect(errors).toEqual([]);
});

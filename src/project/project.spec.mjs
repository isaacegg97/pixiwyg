// SECTION: projects: files that round-trip, one undo stack, backups, one window per project, references, publishing, magnet links
import {test, expect, boot, pkg, ws, T, freshPage, PUBLISH_SOCK} from '../../tools/tests/helpers.mjs';

test('one undo stack across features: element, manuscript, song and style graph each step back in turn', async ({page}) => {
  const errors = await freshPage(page);
  const snap = () => T(page, () => { const S = window.__pixiwyg.state(); return {els: S.els.filter(e => !e.md).length, docs: S.docs.length, songs: S.songs.length, styles: S.styleGraphs.length}; });
  const s0 = await snap();
  await T(page, () => { const P = window.__pixiwyg; P.pushUndo(); P.newDoc('d', 'Hello'); P.flowDocs(); });
  await T(page, () => { window.__pixiwyg.pushUndo(); window.__pixiwyg.newSong(); });
  await T(page, () => { window.__pixiwyg.pushUndo(); window.__pixiwyg.newStyleGraph(); });
  const s3 = await snap();
  expect(s3.docs).toBe(s0.docs + 1);
  expect(s3.styles).toBe(s0.styles + 1);
  await T(page, () => window.__pixiwyg.undo());
  expect((await snap()).styles).toBe(s0.styles);
  await T(page, () => window.__pixiwyg.undo());
  expect((await snap()).songs).toBe(s0.songs);
  await T(page, () => window.__pixiwyg.undo());
  expect((await snap()).docs).toBe(s0.docs);
  expect(errors).toEqual([]);
});

test('RULE: every workspace saves its work as a file: Paint saves a .png, an animated one with frames', async ({page}) => {
  const errors = await freshPage(page);
  await T(page, () => window.__pixiwyg.setWorkspace('paint'));
  const b = await page.locator('#paint').boundingBox();
  await page.mouse.move(b.x + 40, b.y + 40); await page.mouse.down(); await page.mouse.move(b.x + 120, b.y + 90); await page.mouse.up();
  let [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sSaveMenu summary').then(() => page.locator('#sSaveFile').click())]);
  const still = await (await dl.createReadStream()).toArray().then(c => Buffer.concat(c));
  expect([...still.subarray(1, 4)].map(c => String.fromCharCode(c)).join('')).toBe('PNG');
  expect(still.includes(Buffer.from('acTL'))).toBe(false);
  await page.locator('#fAdd').click();
  await page.mouse.move(b.x + 60, b.y + 120); await page.mouse.down(); await page.mouse.move(b.x + 150, b.y + 60); await page.mouse.up();
  [dl] = await Promise.all([page.waitForEvent('download'), page.click('#sSaveMenu summary').then(() => page.locator('#sSaveFile').click())]);
  expect(dl.suggestedFilename()).toMatch(/\.png$/);
  const anim = await (await dl.createReadStream()).toArray().then(c => Buffer.concat(c));
  expect(anim.includes(Buffer.from('acTL'))).toBe(true);
  expect(errors).toEqual([]);
});

test('references: relative paths only, kept without contents, explained in REFERENCES.md, and round-tripped', async ({page}) => {
  const errors = await freshPage(page);
  const r = await T(page, async () => {
    const P = window.__pixiwyg;
    const bad = ['/etc/passwd', '../up.txt', 'a/../b', 'https://x.test/a', 'C:\\win', 'javascript:alert(1)', '', './'].map(p => P.addRef(p, 'file'));
    P.addRef('media/intro.mp4', 'file', 'Rendered from the edit, 2 GB');
    P.addRef('./downloads\\', 'dir');
    P.addRef('media/intro.mp4', 'file');
    const f1 = P.packProject(), k = P.filesKey(f1), readme = new TextDecoder().decode(typeof f1.get('REFERENCES.md') === 'string' ? new TextEncoder().encode(f1.get('REFERENCES.md')) : f1.get('REFERENCES.md'));
    await P.openFiles(new Map(await P.unzip(P.zipFiles(P.sortEntries(f1)))), {});
    return {bad, refs: P.state().refs, same: P.filesKey(P.packProject()) === k, readme, listed: P.projectFiles().filter(f => f.group === 'References').map(f => f.name)};
  });
  expect(r.bad.every(x => x === null)).toBe(true);
  expect(r.refs).toEqual([{path: 'media/intro.mp4', kind: 'file', note: 'Rendered from the edit, 2 GB'}, {path: 'downloads/', kind: 'dir'}]);
  expect(r.same).toBe(true);
  expect(r.readme).toContain('`media/intro.mp4` (file) — Rendered from the edit, 2 GB');
  expect(r.readme).toContain('`downloads/` (folder)');
  expect(r.listed).toEqual(['media/intro.mp4', 'downloads/']);
  await page.keyboard.press('/'); await page.fill('#cmdSearch', 'references'); await page.keyboard.press('Enter');
  await expect(page.locator('#refsModal')).toBeVisible();
  await expect(page.locator('#refsList .refrow')).toHaveCount(2);
  await page.fill('#refPath', 'data/set.csv'); await page.click('#refAdd');
  await expect(page.locator('#refsList .refrow')).toHaveCount(3);
  await page.keyboard.press('Escape');
  await expect(page.locator('#refsModal')).toBeHidden();
  expect(errors).toEqual([]);
});

test('TODO: autopublish posts the export and references to the local socket, and says when nothing listens', async ({page}) => {
  const {createServer} = await import('node:http'), {rmSync} = await import('node:fs'), {PUBLISH_SOCK} = await import('../../tools/tests/helpers.mjs');
  const errors = await freshPage(page);
  rmSync(PUBLISH_SOCK, {force: true});
  const none = await T(page, () => window.__pixiwyg.publishSite());
  expect(none.status).toBe(503);
  await expect(page.locator('#status')).toContainText('No publisher is running');
  let got = null;
  const srv = createServer(async (req, res) => { const c = []; for await (const x of req) c.push(x); got = {url: req.url, method: req.method, body: JSON.parse(Buffer.concat(c))}; res.writeHead(200, {'content-type': 'application/json'}).end('{"url":"http://site.test/"}'); });
  await new Promise(r => srv.listen(PUBLISH_SOCK, r));
  try {
    const ok = await T(page, async () => { const P = window.__pixiwyg; P.addRef('media/a.mp4', 'file'); return P.publishSite(); });
    expect(ok).toMatchObject({ok: true, status: 200, info: {url: 'http://site.test/'}});
    expect(got.method).toBe('POST'); expect(got.url).toBe('/publish');
    expect(got.body).toMatchObject({format: 'pixiwyg-publish', version: 1, name: 'features', references: [{path: 'media/a.mp4', kind: 'file'}]});
    expect(got.body.html).toMatch(/^<!doctype html>/i);
    await expect(page.locator('#status')).toContainText('Published. http://site.test/');
  } finally { await new Promise(r => srv.close(r)); rmSync(PUBLISH_SOCK, {force: true}); }
  // INVARIANT: Chromium logs the deliberate 503 as a failed resource load; nothing else may show up.
  expect(errors.filter(e => !/status of 503/.test(e))).toEqual([]);
});

test('TODO: magnet stub parses BEP 9 URIs; display mode stays "link" until the metadata key is chosen', async ({page}) => {
  const errors = await freshPage(page);
  const r = await T(page, () => {
    const P = window.__pixiwyg;
    const m = P.parseMagnet('magnet:?xt=urn:btih:c12fe1c06bba254a9dc9f519b335aa7c1367a88a&dn=Big+Buck+Bunny&xl=276134947&tr=udp%3A%2F%2Ftracker.test%3A80&tr.2=wss%3A%2F%2Ft.test&ws=https%3A%2F%2Fw.test%2Fbbb.mp4&x.pxmode=download');
    return {m, mode: P.magnetMode(m), plain: P.magnetMode(P.parseMagnet('magnet:?xt=urn:sha1:ABC')), bad: [P.parseMagnet('http://x'), P.parseMagnet('magnet:?foo=1'), P.parseMagnet('magnet:?xt=%E0%A4%A')]};
  });
  expect(r.m).toMatchObject({dn: 'Big Buck Bunny', xl: 276134947, tr: ['udp://tracker.test:80', 'wss://t.test'], ws: ['https://w.test/bbb.mp4'], hashes: [{type: 'btih', value: 'c12fe1c06bba254a9dc9f519b335aa7c1367a88a'}], ext: {pxmode: 'download'}});
  expect(r.mode).toBe('download');
  expect(r.plain).toBe('link');
  expect(r.bad).toEqual([null, null, null]);
  expect(errors).toEqual([]);
});

test('project files round-trip byte for byte and carry the app version', async ({page}) => {
  await boot(page);
  const r = await page.evaluate(async () => {
    const T = window.__pixiwyg;
    await T.newProject('Round trip', true, {type: 'web'});
    const f1 = T.packProject(), zip = T.zipFiles(T.sortEntries(f1));
    await T.openFiles(new Map(await T.unzip(zip)), {});
    const f2 = T.packProject(), z2 = T.zipFiles(T.sortEntries(f2));
    const a = new Uint8Array(await zip.arrayBuffer()), b = new Uint8Array(await z2.arrayBuffer());
    return {same: T.filesKey(f1) === T.filesKey(f2), bytes: a.length === b.length && a.every((x, i) => x === b[i]),
      app: JSON.parse(f2.get('manifest.json')).app, gen: (await T.buildExport()).includes(`<meta name="generator" content="PIXIWYG ${T.APP_VERSION}">`)};
  });
  expect(r).toEqual({same: true, bytes: true, app: 'PIXIWYG ' + pkg.version, gen: true});
});

test('back up everything, then restore it into an empty browser', async ({page, browser}, info) => {
  await boot(page);
  await page.evaluate(async () => {
    const T = window.__pixiwyg;
    await T.newProject('Alpha', false, {type: 'web'});
    await T.newProject('Beta zine', false, {type: 'booklet', sheet: 'letter', pages: 8});
    await T.showTitle();
  });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#tBackup')]);
  const file = info.outputPath('backup.zip');
  await dl.saveAs(file);

  const fresh = await (await browser.newContext()).newPage();
  await boot(fresh);
  await fresh.setInputFiles('#tFile', file);
  await expect(fresh.locator('#status')).toContainText('Restored 2 projects');
  const names = await fresh.evaluate(async () => (await window.__pixiwyg.listProjects()).map(p => p.name).sort());
  expect(names).toEqual(['Alpha', 'Beta zine']);
  await fresh.setInputFiles('#tFile', file);
  await expect(fresh.locator('#status')).toContainText('skipped 2 already here');
});

test('one window per project: a second window can take over, and the first goes read-only', async ({context}) => {
  const a = await context.newPage(), b = await context.newPage();
  await boot(a);
  const id = await a.evaluate(async () => { await window.__pixiwyg.newProject('Shared', false, {type: 'web'}); return window.__pixiwyg.state().project.id; });
  await boot(b);
  await b.evaluate(id => { window.__opening = window.__pixiwyg.openStored(id); }, id);
  await expect(b.locator('#lockModal')).toBeVisible();
  await b.click('#lockTake');
  await b.waitForFunction(() => window.__opening.then(() => true));
  await expect(a.locator('#roBar')).toBeVisible();
  expect(await a.evaluate(() => window.__pixiwyg.readOnly())).toBe(true);
  expect(await b.evaluate(() => window.__pixiwyg.readOnly())).toBe(false);
});

test('the export saves as an .html file named after the project', async ({page}) => {
  await boot(page);
  await page.evaluate(async () => { await window.__pixiwyg.newProject('My Zine', true, {type: 'web'}); });
  await page.click('#exportBtn');
  await expect(page.locator('#copyBtn')).toBeEnabled();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#saveHtmlBtn')]);
  expect(dl.suggestedFilename()).toBe('my-zine.html');
  const text = await (await dl.createReadStream()).toArray().then(c => Buffer.concat(c).toString('utf8'));
  expect(text).toMatch(/^<!doctype html>/);
  expect(text).toBe(await page.locator('#expText').inputValue());
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('ControlOrMeta+s')]);
  expect(dl2.suggestedFilename()).toBe('my-zine.html');
});

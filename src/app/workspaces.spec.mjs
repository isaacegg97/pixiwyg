// SECTION: workspaces, project files, songs as files, MIDI in
import {test, expect, boot, ws as goWs, freshPage} from '../../tools/tests/helpers.mjs';

const T = (page, fn, arg) => page.evaluate(fn, arg);
const ws = page => page.evaluate(() => window.__pixiwyg.ws());

test('workspaces reshape the editor, and a project opens in the one it was left in', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await T(page, async () => { await window.__pixiwyg.newProject('Spaces', true, {type: 'web'}); });
  expect(await ws(page)).toBe('page');
  await goWs(page, 'music');
  await expect(page.locator('#seqModal')).toBeVisible();
  const bar = await page.locator('#topbar').boundingBox(), seq = await page.locator('#seqModal').boundingBox();
  expect(seq.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
  expect(seq.height).toBeGreaterThan(500);
  await expect(page.locator('#wsTabs [data-ws=music]')).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Alt+3');
  expect(await ws(page)).toBe('paint');
  await expect(page.locator('#w-studio')).toBeVisible();
  await expect(page.locator('#seqModal')).toBeHidden();
  await goWs(page, 'animate');
  await expect(page.locator('#timeline')).toBeVisible();
  await expect(page.locator('#w-studio')).toBeHidden();
  await goWs(page, 'page');
  await expect(page.locator('#timeline')).toBeHidden();
  await goWs(page, 'music');
  const back = await T(page, async () => { const P = window.__pixiwyg, f = P.packProject(), m = f.get('manifest.json');
    const man = JSON.parse(typeof m === 'string' ? m : new TextDecoder().decode(m)); await P.openFiles(new Map(await P.unzip(P.zipFiles(P.sortEntries(f)))), {}); return [man.workspace, P.ws()]; });
  expect(back).toEqual(['music', 'music']);
  await T(page, async () => { await window.__pixiwyg.newProject('Zine', false, {type: 'booklet', pages: 8}); });
  expect(await ws(page)).toBe('write');
  await T(page, () => window.__pixiwyg.showTitle());
  await page.selectOption('#tStart', 'animate');
  await page.fill('#tName', 'Moving');
  await page.click('#tBlank');
  await expect.poll(() => ws(page)).toBe('animate');
  expect(errors).toEqual([]);
});

test('Write keeps every element inside the page margins, however it gets there', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  const outside = () => T(page, () => { const P = window.__pixiwyg; return P.state().els.filter(el => { const b = P.writeBox(el), s = P.elBox(el); return el.x < b.x - 1 || el.x + s.w > b.x + b.w + 1 || (s.h <= b.h && (el.y < b.y - 1 || el.y + s.h > b.y + b.h + 1)); }).length; });
  await T(page, async () => { const P = window.__pixiwyg; await P.newProject('Margins', true, {type: 'page', size: 'a5'}); P.setWorkspace('page');
    const s = P.state(); s.els[0].x = -200; s.els[1].x = 5000; s.els[2].w = 4000; P.renderAll(); });
  expect(await outside()).toBeGreaterThan(0);
  await goWs(page, 'write');
  expect(await outside()).toBe(0);
  await expect(page.locator('#status')).toContainText('inside the margins');
  await T(page, () => window.__pixiwyg.undo());
  expect(await ws(page)).toBe('page');
  expect(await outside()).toBeGreaterThan(0);
  await goWs(page, 'write');
  expect(await outside()).toBe(0);
  const id = await T(page, () => { const P = window.__pixiwyg, el = P.state().els.find(e => e.tag === 'h1'); P.select(el.id); return el.id; });
  const box = await page.locator(`.el[data-id="${id}"]`).boundingBox();
  await page.mouse.move(box.x + 10, box.y + 10); await page.mouse.down(); await page.mouse.move(box.x + 1500, box.y + 10, {steps: 6}); await page.mouse.up();
  expect(await outside()).toBe(0);
  await T(page, () => { const P = window.__pixiwyg, s = P.state(); s.els.push({id: 'eadd', tag: 'p', fileId: s.els[0].fileId, selector: 'p', x: 9999, y: -50, z: 999, content: 'Late arrival'}); P.renderAll(); P.save(); });
  expect(await outside()).toBe(0);
  expect(errors).toEqual([]);
});

test('the timeline shows every animation; dragging a bar retimes it; the ruler scrubs', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await T(page, () => window.__pixiwyg.openExample('animator'));
  expect(await ws(page)).toBe('animate');
  const n = await T(page, () => window.__pixiwyg.tlItems().length);
  expect(n).toBeGreaterThan(8);
  await expect(page.locator('#tlRows .tlrow')).toHaveCount(n);
  // FORMAT: first row's bar is 80px right at 160px/s: half a second later
  const first = page.locator('#tlRows .tlbar:not(.ghost)').first();
  const before = await T(page, () => window.__pixiwyg.tlItems()[0].spec.delay);
  const bb = await first.boundingBox();
  await page.mouse.move(bb.x + 8, bb.y + bb.height / 2); await page.mouse.down(); await page.mouse.move(bb.x + 48, bb.y + bb.height / 2); await page.mouse.move(bb.x + 88, bb.y + bb.height / 2); await page.mouse.up();
  const moved = await T(page, () => { const P = window.__pixiwyg; return P.state().els.filter(e => e.anim).map(e => e.anim.nodes.find(x => x.type === 'transition').f.delay); });
  expect(moved).toContain(before + 500);
  await T(page, () => window.__pixiwyg.undo());
  const ruler = await page.locator('#tlRuler').boundingBox();
  await page.mouse.click(ruler.x + 160, ruler.y + 10);
  const at = await T(page, () => { const P = window.__pixiwyg, el = P.tlItems()[0].el, a = P.hostOf(el.id).getAnimations(); return a.length ? Math.round(a[0].currentTime) : null; });
  expect(at).toBe(1000);
  await T(page, () => window.__pixiwyg.tlReset());
  expect(await T(page, () => window.__pixiwyg.state().els.filter(e => window.__pixiwyg.hostOf(e.id).getAnimations().length).length)).toBe(0);
  expect(errors).toEqual([]);
});

test('every file in the project, one list away, each opening where it belongs', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await T(page, () => window.__pixiwyg.openExample('musician'));
  await goWs(page, 'page');
  await page.keyboard.press('Control+p');
  await expect(page.locator('#filesPop')).toBeVisible();
  const groups = await page.locator('#filesList h4').allTextContents();
  expect(groups).toEqual(expect.arrayContaining(['Page', 'Songs', 'Drawings', 'Animations', 'Logic', 'Stylesheets', 'Player']));
  await expect(page.locator('#filesList')).toContainText('Per Diem Blues');
  await expect(page.locator('#filesList')).toContainText('DashAmp II');
  await page.fill('#filesFilter', 'blues');
  await page.keyboard.press('Enter');
  await expect(page.locator('#filesPop')).toBeHidden();
  expect(await ws(page)).toBe('music');
  await expect(page.locator('#seqSong option:checked')).toHaveText('Per Diem Blues');
  await expect(page.locator('#wsFile')).toHaveText('Per Diem Blues');
  await T(page, () => window.__pixiwyg.openExample('artist'));
  await page.click('#filesBtn');
  await page.locator('#filesList .fitem', {hasText: 'Still Life With Ramen'}).click();
  expect(await ws(page)).toBe('paint');
  await expect(page.locator('#sUpdate')).toBeVisible();
  await expect(page.locator('#wsFile')).toHaveText('Still Life With Ramen');
  expect(errors).toEqual([]);
});

test('songs are files: add, rename, switch, remove; and logic still points at the right one after saving', async ({page}) => {
  const errors = await boot(page);
  await T(page, async () => { await window.__pixiwyg.newProject('Album', false, {type: 'web'}); });
  await goWs(page, 'music');
  await page.fill('#seqSongName', 'Side A');
  await page.click('#seqSongNew');
  await page.fill('#seqSongName', 'Side B');
  expect(await page.locator('#seqSong option').allTextContents()).toEqual(['Side A', 'Side B']);
  await page.selectOption('#seqSong', {label: 'Side A'});
  await expect(page.locator('#seqSongName')).toHaveValue('Side A');
  const r = await T(page, async () => {
    const P = window.__pixiwyg, s = P.state(), b = s.songs.find(x => x.name === 'Side B');
    b.tracks[0].notes.push({t: 0, d: 480, p: 60, v: 100});
    s.logic.nodes.push({id: 'nsong', type: 'song', x: 0, y: 0, f: {what: 'play', song: b.id, el: ''}});
    const f = P.packProject(); await P.openFiles(new Map(await P.unzip(P.zipFiles(P.sortEntries(f)))), {});
    const t = P.state(), n = t.logic.nodes.find(x => x.type === 'song');
    return {names: t.songs.map(x => x.name), target: t.songs.find(x => x.id === n.f.song)?.name, notes: t.songs[1].tracks[0].notes.length};
  });
  expect(r).toEqual({names: ['Side A', 'Side B'], target: 'Side B', notes: 1});
  await goWs(page, 'music');
  page.once('dialog', d => d.accept());
  await page.selectOption('#seqSong', {label: 'Side B'});
  await page.click('#seqSongDel');
  expect(await page.locator('#seqSong option').allTextContents()).toEqual(['Side A']);
  await page.keyboard.press('Control+z');
  expect(await page.locator('#seqSong option').allTextContents()).toEqual(['Side A', 'Side B']);
  expect(errors).toEqual([]);
});

test('a .mid file becomes a song; dropped on the page it brings a button, and double-clicking that offers the Sequencer', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await T(page, async () => { await window.__pixiwyg.newProject('Mixtape', true, {type: 'web'}); });
  const same = await T(page, async () => {
    const P = window.__pixiwyg, s = P.newSong('Original');
    s.bpm = 97; s.tracks[0].prog = 33; s.tracks[0].notes.push({t: 0, d: 240, p: 40, v: 90}, {t: 480, d: 960, p: 47, v: 127}); s.tracks[1].notes.push({t: 0, d: 120, p: 36, v: 110}, {t: 960, d: 120, p: 38, v: 100});
    const back = P.parseMidi(P.midiBytes(s, 'Original').buffer);
    return {bpm: back.bpm, bars: back.bars, progs: back.tracks.map(t => [t.drums, t.prog]), notes: back.tracks.map(t => t.notes)};
  });
  expect(same.bpm).toBe(97);
  expect(same.progs).toEqual([[false, 33], [true, 0]]);
  expect(same.notes).toEqual([[{t: 0, d: 240, p: 40, v: 90}, {t: 480, d: 960, p: 47, v: 127}], [{t: 0, d: 120, p: 36, v: 110}, {t: 960, d: 120, p: 38, v: 100}]]);
  const bid = await T(page, async () => {
    const P = window.__pixiwyg, s = P.newSong('Theme'); s.tracks[0].notes.push({t: 0, d: 480, p: 64, v: 100});
    const bytes = P.midiBytes(s, 'Theme'); P.state().songs = P.state().songs.filter(x => x !== s && x.name !== 'Original');
    await P.ingest([{path: 'Road Trip.mid', file: new File([bytes], 'Road Trip.mid', {type: 'audio/midi'})}], {x: 120, y: 520});
    const song = P.state().songs.find(x => x.name === 'Road Trip'), el = P.state().els.find(e => e.content === '▶ Road Trip');
    return song && el && P.songOfEl(el.id) === song.id ? el.id : null;
  });
  expect(bid).not.toBeNull();
  await page.locator(`.el[data-id="${bid}"]`).dblclick();
  await expect(page.locator('#ctxMenu')).toBeVisible();
  await page.locator('#ctxMenu .cmitem', {hasText: 'Open “Road Trip”'}).click();
  expect(await ws(page)).toBe('music');
  await expect(page.locator('#seqSong option:checked')).toHaveText('Road Trip');
  const bad = await T(page, () => ['hello', 'MThd\0\0\0\x06\0\x01\0\x01\x01\xe0MTrk\x7f\xff\xff\xff'].map(t => { try { window.__pixiwyg.parseMidi(new TextEncoder().encode(t).buffer); return 'ok'; } catch (e) { return e.message; } }));
  for (const m of bad) expect(m).toMatch(/MIDI/);
  expect(errors).toEqual([]);
});

test('workspace menu: one button, a menu built from the registry, keyboard and Alt+N, closes on Escape or outside', async ({page}) => {
  const errors = await freshPage(page);
  await expect(page.locator('#wsName')).toHaveText('Page');
  await expect(page.locator('#wsTabs')).toBeHidden();
  await page.click('#wsBtn');
  await expect(page.locator('#wsTabs .wstab')).toHaveCount(await T(page, () => document.querySelectorAll('#wsTabs .wstab').length));
  await expect(page.locator('#wsTabs .wstab')).toHaveText([/Page/, /Write/, /Paint/, /Music/, /Animate/, /3D/]);
  await expect(page.locator('#wsTabs [data-ws=page]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#wsTabs')).toBeHidden();
  await expect(page.locator('#wsBtn')).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
  await expect(page.locator('#wsTabs [data-ws=paint]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#wsTabs')).toBeHidden();
  expect(await T(page, () => window.__pixiwyg.ws())).toBe('paint');
  await expect(page.locator('#wsName')).toHaveText('Paint');
  await page.click('#wsBtn'); await expect(page.locator('#wsTabs')).toBeVisible();
  await page.mouse.click(5, 500);
  await expect(page.locator('#wsTabs')).toBeHidden();
  await page.keyboard.press('Alt+1');
  await expect(page.locator('#wsName')).toHaveText('Page');
  expect(errors).toEqual([]);
});

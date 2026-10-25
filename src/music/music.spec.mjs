// SECTION: sequencer: grid notes, preview synth, Standard MIDI File out
import {test, expect, boot, ws, T, sq} from '../../tools/tests/helpers.mjs';

// FORMAT: minimal SMF reader: format, tracks, every event with its absolute tick
function readMidi(buf) {
  const b = new Uint8Array(buf); let i = 0;
  const u32 = () => (b[i++] << 24 | b[i++] << 16 | b[i++] << 8 | b[i++]) >>> 0, u16 = () => b[i++] << 8 | b[i++];
  const id = () => String.fromCharCode(b[i++], b[i++], b[i++], b[i++]);
  const vlq = () => { let n = 0, c; do { c = b[i++]; n = n * 128 + (c & 127); } while (c & 128); return n; };
  expect(id()).toBe('MThd'); expect(u32()).toBe(6);
  const head = {format: u16(), ntrk: u16(), ppq: u16()}, tracks = [];
  for (let k = 0; k < head.ntrk; k++) {
    expect(id()).toBe('MTrk'); const len = u32(), stop = i + len, evs = []; let t = 0;
    while (i < stop) {
      t += vlq(); const s = b[i++];
      if (s === 0xff) { const type = b[i++], n = vlq(); evs.push({t, meta: type, data: [...b.slice(i, i + n)]}); i += n; }
      else { const hi = s & 0xf0, ch = s & 15, n = hi === 0xc0 || hi === 0xd0 ? 1 : 2; evs.push({t, type: hi, ch, data: [...b.slice(i, i + n)]}); i += n; }
    }
    expect(i).toBe(stop); tracks.push(evs);
  }
  expect(i).toBe(b.length);
  return {...head, tracks};
}

const open = async page => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await page.evaluate(async () => { await window.__pixiwyg.newProject('Tune', true, {type: 'web'}); });
  await ws(page, 'music');
  await expect(page.locator('#seqModal')).toBeVisible();
  // HACK: the roll scrolls to C5 a frame after it opens; coordinates taken before that land 24 rows off.
  await page.waitForFunction(() => document.getElementById('seqScroll').scrollTop > 0);
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  return errors;
};
const cell = (page, tick, row) => page.evaluate(([tick, row]) => {
  const sc = document.getElementById('seqScroll'), r = document.getElementById('seqCanvas').getBoundingClientRect();
  const drums = window.__pixiwyg.state().music.tracks[document.querySelector('.sqtrack.on') ? [...document.querySelectorAll('.sqtrack')].findIndex(x => x.classList.contains('on')) : 0].drums;
  const rh = drums ? 26 : 15;
  return {x: r.left + 96 + tick / 5 - sc.scrollLeft + 3, y: r.top + 22 + row * rh - sc.scrollTop + rh / 2};
}, [tick, row]);

test('notes drawn on the grid save as a MIDI file a player can read', async ({page}) => {
  const errors = await open(page);
  // FORMAT: rows run down from C7 (96); the roll opens with C5 at the top, so C4 is row 36 and E4 row 32
  const a = await cell(page, 0, 36);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  await page.mouse.move(a.x + 50, a.y); await page.mouse.move(a.x + 90, a.y); await page.mouse.up();
  const b = await cell(page, 480, 32);
  await page.mouse.click(b.x, b.y);
  let m = await page.evaluate(() => window.__pixiwyg.state().music);
  expect(m.tracks[0].notes).toEqual([{t: 0, d: 480, p: 60, v: 100}, {t: 480, d: 480, p: 64, v: 100}]);
  await page.mouse.click(b.x, b.y);
  expect(await page.evaluate(() => window.__pixiwyg.state().music.tracks[0].notes.length)).toBe(1);
  await page.mouse.click(b.x, b.y);
  await page.locator('.sqtrack').nth(1).click({position: {x: 4, y: 4}});
  // RULE: the kick is the kit's bottom row, wherever the hand percussion pushed it; scroll it into view.
  const kick = await page.evaluate(() => { const i = window.__pixiwyg.DRUMS.findIndex(d => d[0] === 36), sc = document.getElementById('seqScroll'); sc.scrollTop = Math.max(0, 22 + i * 26 - sc.clientHeight / 2); return i; });
  await page.waitForTimeout(100);
  const k = await cell(page, 0, kick);
  await page.mouse.move(k.x, k.y); await page.mouse.down();
  for (let s = 1; s < 4; s++) await page.mouse.move(k.x + s * 24, k.y);
  await page.mouse.up();
  m = await page.evaluate(() => window.__pixiwyg.state().music);
  expect(m.tracks[1].notes.map(n => [n.t, n.p])).toEqual([[0, 36], [120, 36], [240, 36], [360, 36]]);
  await page.locator('.sqtrack').nth(0).locator('select').selectOption('33');
  await page.fill('#seqBpm', '90'); await page.locator('#seqBpm').dispatchEvent('change');
  await page.fill('#seqSongName', 'Night Bus');
  const [dl] = await Promise.all([page.waitForEvent('download'), sq(page, '#seqSave')]);
  expect(dl.suggestedFilename()).toBe('night-bus.mid');
  const bytes = Buffer.concat(await (await dl.createReadStream()).toArray());
  const f = readMidi(bytes);
  expect([f.format, f.ntrk, f.ppq]).toEqual([1, 3, 480]);
  const tempo = f.tracks[0].find(e => e.meta === 0x51).data;
  expect(tempo[0] << 16 | tempo[1] << 8 | tempo[2]).toBe(Math.round(6e7 / 90));
  expect(f.tracks[0].find(e => e.meta === 0x58).data).toEqual([4, 2, 24, 8]);
  const bass = f.tracks[1], drums = f.tracks[2];
  expect(bass.find(e => e.type === 0xc0)).toMatchObject({ch: 0, data: [33]});
  expect(bass.filter(e => e.type === 0x90).map(e => [e.t, e.data[0]])).toEqual([[0, 60], [480, 64]]);
  expect(bass.filter(e => e.type === 0x80).map(e => [e.t, e.data[0]])).toEqual([[480, 60], [960, 64]]);
  expect(drums.every(e => e.type == null || e.ch === 9)).toBe(true);
  expect(drums.filter(e => e.type === 0x90).length).toBe(4);
  for (const t of f.tracks) expect(t.at(-1)).toMatchObject({t: 4 * 4 * 480, meta: 0x2f});
  expect(errors).toEqual([]);
});

test('the song plays, stops, and travels in the project file', async ({page}) => {
  const errors = await open(page);
  await page.evaluate(() => { const m = window.__pixiwyg.state().music; m.tracks[0].notes.push({t: 0, d: 240, p: 67, v: 127}); });
  await page.keyboard.press('Space');
  await expect(page.locator('#seqPlay')).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(300);
  await page.keyboard.press('Space');
  await expect(page.locator('#seqPlay')).toHaveAttribute('aria-pressed', 'false');
  await ws(page, 'page');
  await expect(page.locator('#seqModal')).toBeHidden();
  const r = await page.evaluate(async () => {
    const T = window.__pixiwyg, f1 = T.packProject(), k1 = T.filesKey(f1);
    await T.openFiles(new Map(await T.unzip(T.zipFiles(T.sortEntries(f1)))), {});
    return {same: T.filesKey(T.packProject()) === k1, notes: T.state().music.tracks[0].notes};
  });
  expect(r.same).toBe(true);
  expect(r.notes).toEqual([{t: 0, d: 240, p: 67, v: 127}]);
  expect(errors).toEqual([]);
});

test('a song from a file is rebuilt from numbers in range', async ({page}) => {
  await boot(page);
  const m = await page.evaluate(() => window.__pixiwyg.cleanMusic({bpm: 1e9, beats: 'x', res: 5, bars: -3, evil: '<script>',
    tracks: [{name: 'A\u0000<b>' + 'x'.repeat(99), prog: 999, vol: -5, drums: 1, notes: [{t: -10, d: 0, p: 300, v: 0, extra: 1}, 'nope', null]}, 'junk',
      ...Array.from({length: 20}, () => ({notes: []}))]}));
  expect(m).toMatchObject({bpm: 300, beats: 4, res: 4, bars: 1});
  expect(m.evil).toBeUndefined();
  expect(m.tracks.length).toBe(15);
  expect(m.tracks[0]).toMatchObject({drums: true, prog: 127, vol: 0, notes: [{t: 0, d: 1, p: 127, v: 1}]});
  expect(m.tracks[0].name.length).toBe(40);
  expect(m.tracks[0].name).not.toContain('\u0000');
  expect(await page.evaluate(() => window.__pixiwyg.cleanMusic('nope'))).toBeNull();
});

// FORMAT: minimal SoundFont: looped sine piano at bank 0 program 0, drum kit at bank 128 program 8
function tinySF2() {
  const le16 = n => [n & 255, n >> 8 & 255], le32 = n => [n & 255, n >> 8 & 255, n >> 16 & 255, n >>> 24 & 255];
  const name = (s, n = 20) => [...Buffer.from(s.padEnd(n, '\0').slice(0, n), 'latin1')];
  const chunk = (id, data) => [...Buffer.from(id), ...le32(data.length), ...data, ...(data.length & 1 ? [0] : [])];
  const list = (type, ...chunks) => chunk('LIST', [...Buffer.from(type), ...chunks.flat()]);
  const N = 2000, pcm = []; for (let i = 0; i < N; i++) pcm.push(...le16(Math.round(Math.sin(i / 22050 * 261.63 * 2 * Math.PI) * 12000) & 0xffff));
  for (let i = 0; i < 46; i++) pcm.push(0, 0);
  const phdr = [...name('Sine Piano'), ...le16(0), ...le16(0), ...le16(0), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ...name('Tiny Kit'), ...le16(8), ...le16(128), ...le16(1), ...Array(12).fill(0),
    ...name('EOP'), ...le16(0), ...le16(0), ...le16(2), ...Array(12).fill(0)];
  const pbag = [...le16(0), ...le16(0), ...le16(1), ...le16(0), ...le16(2), ...le16(0)];
  const pgen = [...le16(41), ...le16(0), ...le16(41), ...le16(0), 0, 0, 0, 0];
  const inst = [...name('Sine'), ...le16(0), ...name('EOI'), ...le16(1)];
  const ibag = [...le16(0), ...le16(0), ...le16(3), ...le16(0)];
  const igen = [...le16(43), 0, 127, ...le16(54), ...le16(1), ...le16(53), ...le16(0), 0, 0, 0, 0];
  const shdr = [...name('sine'), ...le32(0), ...le32(N), ...le32(200), ...le32(1800), ...le32(22050), 60, 0, ...le16(0), ...le16(1), ...name('EOS'), ...Array(26).fill(0)];
  const body = [...Buffer.from('sfbk'),
    ...list('INFO', chunk('ifil', [...le16(2), ...le16(1)]), chunk('INAM', [...Buffer.from('Tiny Test Font\0')])),
    ...list('sdta', chunk('smpl', pcm)),
    ...list('pdta', chunk('phdr', phdr), chunk('pbag', pbag), chunk('pmod', Array(10).fill(0)), chunk('pgen', pgen),
      chunk('inst', inst), chunk('ibag', ibag), chunk('imod', Array(10).fill(0)), chunk('igen', igen), chunk('shdr', shdr))];
  return Buffer.from(chunk('RIFF', body));
}

test('a SoundFont replaces the synth, lists its instruments and kits, and stays loaded', async ({page}) => {
  const errors = await open(page);
  await expect(page.locator('#seqSound option:checked')).toHaveText('Built-in synth');
  await page.setInputFiles('#seqSfFile', {name: 'tiny.sf2', mimeType: 'audio/x-soundfont', buffer: tinySF2()});
  await expect(page.locator('#seqSound option:checked')).toHaveText('tiny.sf2');
  expect(await page.evaluate(() => window.__pixiwyg.soundfont())).toEqual({name: 'Tiny Test Font', file: 'tiny.sf2', presets: 2});
  expect(await page.locator('.sqtrack').nth(0).locator('select > option').allTextContents()).toEqual(['1. Sine Piano']);
  expect(await page.locator('.sqtrack').nth(1).locator('select > option').allTextContents()).toEqual(['9. Tiny Kit', 'Kit 1 (not in this SoundFont)']);
  const v0 = await page.evaluate(() => window.__pixiwyg.sfStats.voices);
  await page.evaluate(() => { const m = window.__pixiwyg.state().music; m.tracks[0].notes.push({t: 0, d: 480, p: 64, v: 100}); m.tracks[1].prog = 8; m.tracks[1].notes.push({t: 0, d: 120, p: 36, v: 100}); });
  await page.click('#seqPlay'); await page.waitForTimeout(400); await page.click('#seqPlay');
  expect(await page.evaluate(() => window.__pixiwyg.sfStats.voices)).toBeGreaterThan(v0 + 1);
  // FORMAT: the kit goes in the .mid as a program change on channel 10
  const [dl] = await Promise.all([page.waitForEvent('download'), sq(page, '#seqSave')]);
  const f = readMidi(Buffer.concat(await (await dl.createReadStream()).toArray()));
  expect(f.tracks[2].find(e => e.type === 0xc0)).toMatchObject({ch: 9, data: [8]});
  await page.reload();
  await page.waitForFunction(() => window.__pixiwyg && !document.getElementById('title').hidden);
  await page.evaluate(async () => { await window.__pixiwyg.newProject('Again', true, {type: 'web'}); });
  await ws(page, 'music');
  await expect(page.locator('#seqSound option:checked')).toHaveText('tiny.sf2');
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  if (!(await page.locator('#seqSound').isVisible())) await page.click('#seqMore summary');
  await page.selectOption('#seqSound', 'synth');
  await expect(page.locator('#seqSound option:checked')).toHaveText('Built-in synth');
  expect(errors).toEqual([]);
});

test('a broken or hostile SoundFont is refused with a reason, never half-loaded', async ({page}) => {
  await boot(page);
  const good = tinySF2();
  const r = await page.evaluate(bufs => bufs.map(b => { try { window.__pixiwyg.parseSF2(new Uint8Array(b).buffer); return 'ok'; } catch (e) { return e.message; } }),
    [[...Buffer.from('not a soundfont at all')], [...good.subarray(0, 300)], (() => { const b = Buffer.from(good), at = b.indexOf('smpl') + 4; b.writeUInt32LE(0xfffffff0, at); return [...b]; })(), (() => { const b = Buffer.from(good); b.write('XXXX', b.indexOf('shdr')); return [...b]; })()]);
  expect(r[0]).toMatch(/isn’t a SoundFont/);
  expect(r[1]).toMatch(/cut short|missing/);
  expect(r[2]).not.toBe('ok');
  expect(r[3]).toMatch(/missing its shdr/);
});

// COMPAT: a real GM SoundFont where the machine has one (Fedora fluid-soundfont-gm)
import {existsSync} from 'node:fs';
const FLUID = '/usr/share/soundfonts/FluidR3_GM.sf2';
test('a full General MIDI SoundFont loads and covers every program and the drum kit', async ({page}) => {
  test.skip(!existsSync(FLUID), 'no FluidR3_GM.sf2 on this machine');
  const errors = await open(page);
  await page.setInputFiles('#seqSfFile', FLUID);
  await expect(page.locator('#seqSound option:checked')).toHaveText('FluidR3_GM.sf2', {timeout: 60_000});
  const r = await page.evaluate(() => {
    const T = window.__pixiwyg; T.audio(); const out = T.seqOut(), missing = [];
    for (let prog = 0; prog < 128; prog++) if (![60, 36].some(p => T.sfPlay({drums: false, prog, vol: 100}, p, 0, .05, 100, out))) missing.push(prog);   // COMPAT: some GM instruments (contrabass) stop short of middle C
    const kit = [36, 38, 42, 46, 49, 51].filter(p => !T.sfPlay({drums: true, prog: 0, vol: 100}, p, 0, .05, 100, out));
    return {presets: T.soundfont().presets, missing, kit};
  });
  expect(r.presets).toBeGreaterThan(128);
  expect(r.missing).toEqual([]);
  expect(r.kit).toEqual([]);
  expect(await page.locator('.sqtrack').nth(0).locator('select > option').count()).toBe(128);
  expect(errors).toEqual([]);
});

test('recording from the computer keys: step entry with chords, octave shift, velocity by wheel, bars repeated to the end', async ({page}) => {
  const errors = await open(page);
  await page.evaluate(() => { const m = window.__pixiwyg.state().music; m.tracks[0].notes = []; m.tracks.forEach(t => { if (t !== m.tracks[0]) t.notes = []; }); });
  await page.locator('.sqtrack').nth(0).click({position: {x: 4, y: 4}});
  await page.locator('#seqScroll').focus();
  await page.keyboard.press('r');
  await expect(page.locator('#seqRec')).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('a');
  await page.keyboard.press('d');
  await page.keyboard.down('a'); await page.keyboard.down('g'); await page.keyboard.up('a'); await page.keyboard.up('g');
  await page.keyboard.press('x');
  await page.keyboard.press('a');
  const notes = await page.evaluate(() => window.__pixiwyg.state().music.tracks[0].notes.map(n => [n.t, n.p]));
  // RULE: one step per note; a chord shares its step; X moves the keys up an octave
  expect(notes).toEqual([[0, 60], [120, 64], [240, 60], [240, 67], [360, 72]]);
  const c = await cell(page, 0, 36);
  await page.mouse.move(c.x, c.y);
  await page.mouse.wheel(0, 100); await page.mouse.wheel(0, 100);
  expect(await page.evaluate(() => window.__pixiwyg.state().music.tracks[0].notes.find(n => n.t === 0).v)).toBe(84);
  await page.keyboard.press('r');
  await page.fill('#seqRepA', '1'); await page.fill('#seqRepB', '1');
  await page.click('#seqRepGo');
  const m = await page.evaluate(() => { const m = window.__pixiwyg.state().music; return {bars: m.bars, bar: m.beats * 480, notes: m.tracks[0].notes.length}; });
  expect(m.notes).toBe(5 * m.bars);
  await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => window.__pixiwyg.state().music.tracks[0].notes.length)).toBe(5);
  expect(errors).toEqual([]);
});

// INVARIANT: a real WAV file, written byte by byte: mono 16-bit, a 440 Hz tone with a quick fade.
function sineWav(sec = .4, hz = 440, sr = 22050) {
  const n = Math.round(sec * sr), b = Buffer.alloc(44 + n * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
  b.writeUInt32LE(sr, 24); b.writeUInt32LE(sr * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin(2 * Math.PI * hz * i / sr) * 20000 * Math.min(1, (n - i) / 200)), 44 + i * 2);
  return b;
}

test('effects change the sound: reverb adds a tail, delay echoes, a high-pass cuts a low note; chains are cleaned on load', async ({page}) => {
  await boot(page);
  const out = await page.evaluate(async () => {
    const P = window.__pixiwyg, mk = (p, trackFx, fx) => P.cleanMusic({bpm: 120, beats: 4, res: 4, bars: 1, fx, tracks: [{name: 'A', drums: false, prog: 0, vol: 110, mute: false, fx: trackFx, notes: [{t: 0, d: 120, p, v: 120}]}]});
    const rms = (b, s0, s1) => { const d = b.getChannelData(0), a = Math.floor(s0 * b.sampleRate), z = Math.floor(s1 * b.sampleRate); let e = 0; for (let i = a; i < z; i++) e += d[i] * d[i]; return Math.sqrt(e / Math.max(1, z - a)); };
    const dry = await P.renderSong(mk(60)), wet = await P.renderSong(mk(60, [{k: 'reverb', sec: 1.5, decay: 2, mix: .8}])), echo = await P.renderSong(mk(60, [{k: 'delay', ms: 600, fb: .3, mix: .6}]));
    const lowDry = await P.renderSong(mk(36)), lowCut = await P.renderSong(mk(36, null, [{k: 'filter', type: 'highpass', freq: 3000, q: 1}]));
    const cleaned = P.cleanMusic({bpm: 120, beats: 4, res: 4, bars: 1, fx: [{k: 'nope'}, {k: 'delay', ms: 99999, fb: 7, mix: 'x'}], samples: [{id: 'a', url: 'data:text/html;base64,AAAA'}], tracks: [{name: 'A', notes: [], smp: 'a'}]});
    return {tailDry: rms(dry, .9, 1.4), tailWet: rms(wet, .9, 1.4), echoAt: rms(echo, .62, .72), dryAt: rms(dry, .62, .72), low: [rms(lowDry, 0, .3), rms(lowCut, 0, .3)],
      cleanedFx: cleaned.fx, cleanedSamples: cleaned.samples, cleanedSmp: cleaned.tracks[0].smp};
  });
  expect(out.tailWet).toBeGreaterThan(out.tailDry * 3 + 1e-4);
  expect(out.echoAt).toBeGreaterThan(out.dryAt * 3 + 1e-4);
  expect(out.low[1]).toBeLessThan(out.low[0] * .5);
  expect(out.cleanedFx).toEqual([{k: 'delay', on: true, ms: 2000, fb: .95, mix: .3}]);
  expect(out.cleanedSamples).toBeUndefined();
  expect(out.cleanedSmp).toBeUndefined();
});

test('samples: a WAV loads onto its own track, plays pitched or not, survives save and open as an audio asset; the FX panel builds chains', async ({page}) => {
  const errors = await boot(page);
  await page.evaluate(async () => { await window.__pixiwyg.newProject('Samples', false, {type: 'web'}, 'music'); });
  await expect(page.locator('#seqModal')).toBeVisible();
  await page.setInputFiles('#seqSampleIn', {name: 'beep.wav', mimeType: 'audio/wav', buffer: sineWav()});
  await expect(page.locator('#status')).toContainText('Added “beep”');
  const t = await page.evaluate(() => { const m = window.__pixiwyg.state().music, t = m.tracks.at(-1); return {n: m.tracks.length, smp: t.smp, root: t.root, sname: m.samples[0].name, url: m.samples[0].url.slice(0, 20)}; });
  expect(t).toMatchObject({n: 3, root: 60, sname: 'beep', url: 'data:audio/wav;base6'});
  // RULE: the sample arrives as a clip as long as the recording (0.4 s at 120 BPM is 384 ticks), refitted when the tempo changes.
  const clip = () => page.evaluate(() => { const m = window.__pixiwyg.state().music, n = m.tracks.at(-1).notes; return {notes: n.length, t: n[0] && n[0].t, d: n[0] && n[0].d, p: n[0] && n[0].p, bars: m.bars}; });
  expect(await clip()).toEqual({notes: 1, t: 0, d: 384, p: 60, bars: 4});
  await page.fill('#seqBpm', '60'); await page.locator('#seqBpm').dispatchEvent('change');
  expect((await clip()).d).toBe(192);
  await page.fill('#seqBpm', '120'); await page.locator('#seqBpm').dispatchEvent('change');
  const audible = await page.evaluate(async () => {
    const P = window.__pixiwyg, m = P.state().music, tr = m.tracks.at(-1), rms = (b, s0, s1) => { const d = b.getChannelData(0), a = Math.floor(s0 * b.sampleRate), z = Math.floor(s1 * b.sampleRate); let e = 0; for (let i = a; i < z; i++) e += d[i] * d[i]; return Math.sqrt(e / Math.max(1, z - a)); };
    tr.notes = [{t: 0, d: 240, p: 60, v: 120}]; const at = await P.renderSong(P.cleanMusic(m));
    tr.notes = [{t: 0, d: 240, p: 72, v: 120}]; const up = await P.renderSong(P.cleanMusic(m));
    return {root: rms(at, .05, .3), rootLate: rms(at, .3, .38), up: rms(up, .05, .15), upLate: rms(up, .25, .38)};
  });
  expect(audible.root).toBeGreaterThan(.01);
  expect(audible.rootLate).toBeGreaterThan(.005);
  expect(audible.up).toBeGreaterThan(.01);
  expect(audible.upLate).toBeLessThan(audible.rootLate * .2);
  await page.locator('.sqtrack').last().locator('button', {hasText: 'FX'}).click();
  await expect(page.locator('#seqFx')).toBeVisible();
  await expect(page.locator('#seqFxSample')).toContainText('Sample: beep');
  await page.selectOption('#seqFxAdd', 'reverb'); await page.selectOption('#seqFxAdd', 'eq');
  await expect(page.locator('#seqFxList .sqfx')).toHaveCount(2);
  await page.locator('#seqFxList .sqfx').first().locator('input[data-k=mix]').fill('0.7');
  await page.locator('#seqFxList .sqfx').nth(1).locator('button[aria-label="Earlier in the chain"]').click();
  await sq(page, '#seqMasterFx'); await page.selectOption('#seqFxAdd', 'comp');
  const s = await page.evaluate(async () => { const P = window.__pixiwyg, m = P.state().music, f1 = P.packProject(), k = P.filesKey(f1), man = JSON.parse(new TextDecoder().decode(typeof f1.get('manifest.json') === 'string' ? new TextEncoder().encode(f1.get('manifest.json')) : f1.get('manifest.json')));
    await P.openFiles(new Map(await P.unzip(P.zipFiles(P.sortEntries(f1)))), {});
    const m2 = P.state().songs[0];
    return {fx: m.tracks.at(-1).fx.map(f => f.k), mix: m.tracks.at(-1).fx[1].mix, master: m.fx.map(f => f.k), asset: man.assets.some(a => a.type === 'audio/wav'), inline: /data:audio/.test(f1.get('manifest.json').toString()),
      same: P.filesKey(P.packProject()) === k, back: m2.samples[0].url.startsWith('data:audio/wav'), backFx: m2.tracks.at(-1).fx.length}; });
  expect(s).toEqual({fx: ['eq', 'reverb'], mix: .7, master: ['comp'], asset: true, inline: false, same: true, back: true, backFx: 2});
  // RULE: a recording longer than the song adds bars (10 s at 120 BPM in 4/4 is 9600 ticks, five bars), and its length is kept.
  await page.setInputFiles('#seqSampleIn', {name: 'long.wav', mimeType: 'audio/wav', buffer: sineWav(10, 220)});
  await expect(page.locator('#status')).toContainText('Added “long” (0:10)');
  expect(await clip()).toEqual({notes: 1, t: 0, d: 9600, p: 60, bars: 5});
  expect(await page.evaluate(() => Math.round(window.__pixiwyg.cleanMusic(window.__pixiwyg.state().music).samples.at(-1).sec))).toBe(10);
  expect(errors).toEqual([]);
});

test('piano roll: drag a note’s end to change its length, zoom keeps the pointer’s moment, a picked track shows its notes, the view follows the playhead', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await T(page, async () => { const P = window.__pixiwyg; await P.newProject('Roll'); P.setWorkspace('music'); });
  await T(page, () => { const P = window.__pixiwyg, m = P.state().music; m.bars = 8; m.bpm = 300;
    m.tracks[0].notes = [{t: 0, d: 480, p: 72, v: 100}];
    m.tracks.push({id: 'tlow', name: 'Low', drums: false, prog: 33, vol: 100, mute: false, notes: [{t: 0, d: 960, p: 31, v: 100}]});
    P.closeSeq(); P.openSeq(); });
  await page.waitForTimeout(200);
  const geo = () => T(page, () => { const sc = document.getElementById('seqScroll'), r = sc.getBoundingClientRect(); return {l: r.left, t: r.top, sl: sc.scrollLeft, st: sc.scrollTop, h: sc.clientHeight, w: sc.clientWidth, space: parseFloat(document.getElementById('seqSpace').style.width)}; });
  const notes = i => T(page, i => window.__pixiwyg.state().music.tracks[i].notes.map(n => [n.t, n.d]), i);
  let g = await geo();
  const y = g.t + 22 + (96 - 72) * 15 - g.st + 7, x = g.l + 96 + 96 - 3 - g.sl;
  await page.mouse.move(x, y);
  expect(await T(page, () => document.getElementById('seqScroll').style.cursor)).toBe('ew-resize');
  await page.mouse.down(); await page.mouse.move(x + 100, y, {steps: 5}); await page.mouse.up();
  expect(await notes(0)).toEqual([[0, 1080]]);
  await T(page, () => window.__pixiwyg.undo());
  expect(await notes(0)).toEqual([[0, 480]]);
  // RULE: a click on a note's end without a drag leaves it alone.
  await page.mouse.click(x, y);
  expect(await notes(0)).toEqual([[0, 480]]);
  await page.click('.sqtrack:nth-child(3)');
  g = await geo();
  const lowY = (96 - 31) * 15;
  expect(lowY).toBeGreaterThanOrEqual(g.st);
  expect(lowY + 15).toBeLessThanOrEqual(g.st + g.h - 22);
  const tickAt = g => (g.l + 500 - g.l - 96 + g.sl) / ((g.space - 96) / (8 * 4));
  // INVARIANT: zooming out at the very start can't keep the anchor (nothing left of zero to scroll to); start scrolled.
  await T(page, () => { document.getElementById('seqScroll').scrollLeft = 800; });
  g = await geo();
  const before = tickAt(g);
  await page.mouse.move(g.l + 500, g.t + 200);
  await page.keyboard.down('Control'); await page.mouse.wheel(0, 300); await page.keyboard.up('Control');
  g = await geo();
  expect(g.space).toBeLessThan(96 + 32 * 96);
  expect(Math.abs(tickAt(g) - before)).toBeLessThan(0.05);
  await page.focus('#seqScroll');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Equal');
  await page.click('#seqPlay');
  await expect.poll(async () => (await geo()).sl, {timeout: 8000}).toBeGreaterThan(0);
  await page.click('#seqPlay');
  expect(errors).toEqual([]);
});

test('piano roll: box select, copy and paste at the cursor, duplicate, nudge, delete, the velocity lane, Select mode', async ({page}) => {
  const errors = await open(page);
  const P = () => window.__pixiwyg;
  await page.evaluate(() => { const m = window.__pixiwyg.state().music; m.tracks[0].notes = [[0, 60], [240, 64], [480, 67], [1920, 60]].map(([t, p]) => ({t, d: 240, p, v: 100})); });
  const notes = () => page.evaluate(() => window.__pixiwyg.state().music.tracks[0].notes.map(n => [n.t, n.p]));
  const sel = () => page.evaluate(() => window.__pixiwyg.seqSel());
  // RULE: Ctrl+drag on empty grid draws a selection box in Draw mode.
  const a = await cell(page, 0, 96 - 68), b = await cell(page, 700, 96 - 58);
  await page.mouse.move(a.x - 2, a.y);
  await page.keyboard.down('Control'); await page.mouse.down(); await page.mouse.move(b.x, b.y, {steps: 4}); await page.mouse.up(); await page.keyboard.up('Control');
  expect(await sel()).toEqual([[0, 60], [240, 64], [480, 67]]);
  await expect(page.locator('#seqCopy')).toBeEnabled();
  await page.keyboard.press('Control+c');
  await expect(page.locator('#seqPaste')).toBeEnabled();
  // RULE: the ruler sets the cursor; a paste lands there, is selected, and moves the cursor a whole number of beats on.
  const r = await cell(page, 3840, 0), rulerY = await page.evaluate(() => document.getElementById('seqCanvas').getBoundingClientRect().top + 11);
  await page.mouse.click(r.x, rulerY);
  expect(await page.evaluate(() => window.__pixiwyg.seqCursor())).toBe(3840);
  await page.keyboard.press('Control+v');
  expect(await sel()).toEqual([[3840, 60], [4080, 64], [4320, 67]]);
  expect(await page.evaluate(() => window.__pixiwyg.seqCursor())).toBe(4800);
  await page.click('#seqPaste');
  expect(await sel()).toEqual([[4800, 60], [5040, 64], [5280, 67]]);
  await page.focus('#seqScroll');
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('Shift+ArrowRight');
  expect(await sel()).toEqual([[6720, 61], [6960, 65], [7200, 68]]);
  await page.keyboard.press('Delete');
  expect((await notes()).length).toBe(7);
  await page.keyboard.press('Control+z');
  expect((await notes()).length).toBe(10);
  await page.keyboard.press('Control+a');
  expect((await sel()).length).toBe(10);
  await page.keyboard.press('Escape');
  expect(await sel()).toEqual([]);
  await expect(page.locator('#seqCopy')).toBeDisabled();
  // RULE: Duplicate puts a copy right after the selection; the clipboard keeps what was copied.
  await page.evaluate(() => { const m = window.__pixiwyg.state().music; m.tracks[0].notes = m.tracks[0].notes.filter(n => n.t < 1920); });
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Control+d');
  expect(await sel()).toEqual([[960, 60], [1200, 64], [1440, 67]]);
  // RULE: dragging across the velocity lane sets how hard notes play, from the stem height.
  await page.keyboard.press('Escape');
  if (await page.locator('#seqLaneBtn').getAttribute('aria-pressed') !== 'true') await page.click('#seqLaneBtn');
  await page.evaluate(() => { document.getElementById('seqScroll').scrollLeft = 0; });
  const lane = await page.evaluate(() => { const c = document.getElementById('seqScroll').getBoundingClientRect(), sc = document.getElementById('seqScroll'); return {y: c.top + sc.clientHeight - 10, l: c.left}; });
  const x0 = (await cell(page, 0, 0)).x - 3, x1 = (await cell(page, 500, 0)).x;
  await page.mouse.move(x0, lane.y); await page.mouse.down(); await page.mouse.move(x1, lane.y, {steps: 6}); await page.mouse.up();
  const vs = await page.evaluate(() => window.__pixiwyg.state().music.tracks[0].notes.map(n => [n.t, n.v]));
  expect(vs.filter(([t]) => t <= 480).map(([, v]) => v < 25)).toEqual([true, true, true]);
  expect(vs.filter(([t]) => t >= 960).every(([, v]) => v === 100)).toBe(true);
  // RULE: in Select mode a click picks a note instead of removing it, and a click on empty grid lets go.
  await page.click('#seqModeSel');
  const n = await cell(page, 960, 96 - 60);
  await page.mouse.click(n.x + 4, n.y);
  expect(await sel()).toEqual([[960, 60]]);
  expect((await notes()).length).toBe(6);
  const e = await cell(page, 2880, 96 - 50);
  await page.mouse.click(e.x, e.y);
  expect(await sel()).toEqual([]);
  expect((await notes()).length).toBe(6);
  expect(errors).toEqual([]);
});

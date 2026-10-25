// SECTION: music tooling: the bundled SoundFont, chokes, the pump on every voice, MIDI import edges, click and solo
import {test, expect, boot, ws} from '../../tools/tests/helpers.mjs';

const open = async page => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await page.evaluate(async () => { await window.__pixiwyg.newProject('Tooling', true, {type: 'web'}); });
  await ws(page, 'music');
  await expect(page.locator('#seqModal')).toBeVisible();
  return errors;
};
// INVARIANT: waits two frames first: the song bar refits a frame after a resize, moving tools into More.
const pickSound = async (page, v) => {
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  if (!(await page.locator('#seqSound').isVisible())) await page.click('#seqMore summary');
  await page.selectOption('#seqSound', v);
};
// FORMAT: peak of channel 0 between two times in seconds.
const PEAK = `(b, a, z) => { const d = b.getChannelData(0), s = Math.floor(a * b.sampleRate), e = Math.min(d.length, Math.floor(z * b.sampleRate)); let m = 0; for (let i = s; i < e; i++) m = Math.max(m, Math.abs(d[i])); return m; }`;

test('the bundled TimGM6mb SoundFont loads from lib/, covers every GM program and the kit, and is remembered', async ({page}) => {
  const errors = await open(page);
  await pickSound(page, 'b:TimGM6mb.sf2');
  await expect(page.locator('#seqSound option:checked')).toContainText('TimGM6mb', {timeout: 30_000});
  await expect.poll(() => page.evaluate(() => window.__pixiwyg.soundfont() && window.__pixiwyg.soundfont().file)).toBe('TimGM6mb.sf2');
  const r = await page.evaluate(() => {
    const T = window.__pixiwyg; T.audio(); const out = T.seqOut(), missing = [];
    for (let prog = 0; prog < 128; prog++) if (![60, 48, 36, 72].some(p => T.sfPlay({drums: false, prog, vol: 100}, p, 0, .05, 100, out))) missing.push(prog);
    const kit = [35, 36, 37, 38, 42, 46, 49, 51].filter(p => !T.sfPlay({drums: true, prog: 0, vol: 100}, p, 0, .05, 100, out));
    return {missing, kit};
  });
  expect(r.missing).toEqual([]);
  expect(r.kit).toEqual([]);
  // RULE: the choice is the app's: a reload and another project still use it, without storing the file again.
  await page.reload();
  await page.waitForFunction(() => window.__pixiwyg && !document.getElementById('title').hidden);
  await page.evaluate(async () => { await window.__pixiwyg.newProject('Again', true, {type: 'web'}); });
  await ws(page, 'music');
  await expect(page.locator('#seqSound option:checked')).toContainText('TimGM6mb', {timeout: 30_000});
  await pickSound(page, 'synth');
  await expect(page.locator('#seqSound option:checked')).toHaveText('Built-in synth');
  expect(errors).toEqual([]);
});

test('a closed hi-hat chokes an open one, in the synth and through a SoundFont’s exclusive class; side stick isn’t the snare', async ({page}) => {
  const errors = await open(page);
  const r = await page.evaluate(async PEAK => {
    const T = window.__pixiwyg, peak = eval(PEAK), Q = 480;
    const song = notes => T.cleanMusic({bpm: 120, beats: 4, unit: 4, res: 4, bars: 1, tracks: [{name: 'kit', drums: true, prog: 0, vol: 110, notes}]});
    // RULE: the closing hat is played at velocity 1 and has stopped by 0.31 s (the bus compressor looks ahead
    //   6 ms), so what is left then is the open hat's ring or nothing.
    const open = song([{t: 0, d: 120, p: 46, v: 110}]), choked = song([{t: 0, d: 120, p: 46, v: 110}, {t: Q * .4, d: 60, p: 42, v: 1}]);
    const a = await T.renderSong(open), b = await T.renderSong(choked);
    const snare = await T.renderSong(song([{t: 0, d: 60, p: 38, v: 110}])), stick = await T.renderSong(song([{t: 0, d: 60, p: 37, v: 110}]));
    return {ring: peak(a, .315, .345), cut: peak(b, .315, .345), snareTail: peak(snare, .08, .15), stickTail: peak(stick, .08, .15)};
  }, PEAK);
  expect(r.cut).toBeLessThan(r.ring * .2);
  expect(r.stickTail).toBeLessThan(r.snareTail * .5);
  await pickSound(page, 'b:TimGM6mb.sf2');
  await expect.poll(() => page.evaluate(() => !!window.__pixiwyg.soundfont())).toBe(true);
  const s = await page.evaluate(async PEAK => {
    const T = window.__pixiwyg, peak = eval(PEAK), Q = 480;
    const song = notes => T.cleanMusic({bpm: 120, beats: 4, unit: 4, res: 4, bars: 1, tracks: [{name: 'kit', drums: true, prog: 0, vol: 110, notes}]});
    const a = await T.renderSongSF(song([{t: 0, d: 960, p: 46, v: 110}])), b = await T.renderSongSF(song([{t: 0, d: 960, p: 46, v: 110}, {t: Q / 2, d: 60, p: 44, v: 1}]));
    return {ring: peak(a, .4, .6), cut: peak(b, .4, .6)};
  }, PEAK);
  expect(s.cut).toBeLessThan(s.ring * .3);
  expect(errors).toEqual([]);
});

test('the sidechain pump ducks SoundFont voices and samples, not only the synth', async ({page}) => {
  const errors = await open(page);
  await pickSound(page, 'b:TimGM6mb.sf2');
  await expect.poll(() => page.evaluate(() => !!window.__pixiwyg.soundfont())).toBe(true);
  const r = await page.evaluate(async PEAK => {
    const T = window.__pixiwyg, peak = eval(PEAK), w = .03;
    const pad = fx => T.cleanMusic({bpm: 120, beats: 4, unit: 4, res: 4, bars: 1, tracks: [{name: 'pad', drums: false, prog: 89, vol: 110, notes: [{t: 0, d: 1920, p: 60, v: 110}], ...(fx ? {fx} : {})}]});
    const pumped = await T.renderSongSF(pad([{k: 'pump', on: true, depth: .9, rate: 1}]));
    // FORMAT: a second of 220 Hz sine as a 16-bit WAV data URL, for a sample track.
    const sr = 22050, n = sr * 2, buf = new DataView(new ArrayBuffer(44 + n * 2)), s = (o, t) => { for (let i = 0; i < t.length; i++) buf.setUint8(o + i, t.charCodeAt(i)); };
    s(0, 'RIFF'); buf.setUint32(4, 36 + n * 2, true); s(8, 'WAVEfmt '); buf.setUint32(16, 16, true); buf.setUint16(20, 1, true); buf.setUint16(22, 1, true); buf.setUint32(24, sr, true); buf.setUint32(28, sr * 2, true); buf.setUint16(32, 2, true); buf.setUint16(34, 16, true); s(36, 'data'); buf.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) buf.setInt16(44 + i * 2, Math.sin(2 * Math.PI * 220 * i / sr) * 20000, true);
    let bin = ''; const u = new Uint8Array(buf.buffer); for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
    const smp = await T.renderSong(T.cleanMusic({bpm: 120, beats: 4, unit: 4, res: 4, bars: 1, samples: [{id: 'a1', name: 'sine', url: 'data:audio/wav;base64,' + btoa(bin)}],
      tracks: [{name: 'smp', drums: false, prog: 0, vol: 110, smp: 'a1', root: 60, pitched: false, notes: [{t: 0, d: 1920, p: 60, v: 110}], fx: [{k: 'pump', on: true, depth: .9, rate: 1}]}]}));
    const at = (b, x) => peak(b, x, x + w);
    return {sfDuck: at(pumped, 1.01), sfSwell: at(pumped, 1.5 - w - .01), smpDuck: at(smp, 1.01), smpSwell: at(smp, 1.5 - w - .01)};
  }, PEAK);
  expect(r.sfDuck).toBeLessThan(r.sfSwell * .5);
  expect(r.smpDuck).toBeLessThan(r.smpSwell * .5);
  expect(errors).toEqual([]);
});

// FORMAT: a format-0 MIDI file from [delta, ...bytes] events, 480 ticks a quarter.
function midiFile(events) {
  const vlq = n => { const b = [n & 127]; while ((n >>>= 7) > 0) b.unshift((n & 127) | 128); return b; };
  const body = events.flatMap(([d, ...b]) => [...vlq(d), ...b]).concat([0, 0xff, 0x2f, 0]);
  const be32 = n => [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255];
  return [...Buffer.from('MThd'), ...be32(6), 0, 0, 0, 1, 1, 0xe0, ...Buffer.from('MTrk'), ...be32(body.length), ...body];
}

test('MIDI import: a note never released holds to the track’s end, CC 7 is the track’s volume, tempo changes and notes past bar 64 are reported', async ({page}) => {
  const errors = await open(page);
  const bytes = midiFile([
    [0, 0xff, 0x51, 3, 0x07, 0xa1, 0x20], [0, 0xb0, 7, 64], [0, 0x90, 60, 100],
    [480, 0xff, 0x51, 3, 0x06, 0x1a, 0x80], [0, 0x90, 62, 90], [480, 0x80, 62, 0],
    [70 * 1920 - 960, 0x90, 64, 80], [480, 0x80, 64, 0],
  ]);
  const r = await page.evaluate(b => { const T = window.__pixiwyg, m = T.parseMidi(new Uint8Array(b).buffer); return {m, info: T.midiInfo()}; }, bytes);
  expect(r.m.bpm).toBe(120);
  expect(r.m.bars).toBe(64);
  expect(r.m.tracks[0].vol).toBe(64);
  expect(r.m.tracks[0].notes.find(n => n.p === 60)).toMatchObject({t: 0, d: 70 * 1920 + 480});
  expect(r.m.tracks[0].notes.find(n => n.p === 62)).toMatchObject({t: 480, d: 480});
  expect(r.info).toEqual({tempos: 2, cut: 1});
  expect(errors).toEqual([]);
});

test('Click schedules a metronome tick a beat, and Solo plays only the soloed tracks in the Sequencer', async ({page}) => {
  const errors = await open(page);
  const clicks = await page.evaluate(() => { const T = window.__pixiwyg; T.audio(); const m = T.state().music; return [T.seqClicks(m, 0, 1920, .001), T.seqClicks({...m, beats: 7, unit: 8}, 0, 7 * 240, .001)]; });
  expect(clicks).toEqual([4, 7]);
  await page.check('#seqClick');
  await pickSound(page, 'b:TimGM6mb.sf2');
  await expect.poll(() => page.evaluate(() => !!window.__pixiwyg.soundfont())).toBe(true);
  await page.evaluate(() => { const m = window.__pixiwyg.state().music; m.bpm = 240; m.bars = 1;
    m.tracks[0].notes = [0, 480, 960, 1440].map(t => ({t, d: 240, p: 60, v: 100})); m.tracks[1].notes = [0, 480, 960, 1440].map(t => ({t, d: 120, p: 36, v: 100})); });
  await page.locator('.sqtrack').nth(1).locator('button:text-is("S")').click();
  await expect(page.locator('.sqtrack').nth(1).locator('button:text-is("S")')).toHaveAttribute('aria-pressed', 'true');
  const v0 = await page.evaluate(() => window.__pixiwyg.sfStats.voices);
  await page.click('#seqPlay'); await page.waitForTimeout(700); await page.click('#seqPlay');
  const heard = await page.evaluate(() => window.__pixiwyg.sfStats.voices) - v0;
  // RULE: only the soloed kit played: four kicks (a kick can be more than one voice), no piano.
  expect(heard).toBeGreaterThanOrEqual(4);
  expect(heard).toBeLessThan(12);
  expect(await page.evaluate(() => window.__pixiwyg.state().music.tracks[1].solo)).toBe(true);
  expect(errors).toEqual([]);
});

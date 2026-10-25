// SECTION: song ideas: the theory holds for every style, and the panel adds, swaps and undoes ideas
import {test, expect, boot, T} from '../../tools/tests/helpers.mjs';

test('song ideas: every style, in any meter (odd, compound, irrational), polytonal or polymetric, keeps key, chords and beat', async ({page}) => {
  const errors = await boot(page);
  const bad = await T(page, () => {
    const P = window.__pixiwyg, out = [], PPQ = 480;
    const meters = [[4, 4], [3, 4], [6, 8], [7, 8, [3, 2, 2]], [13, 16], [7, 3], [5, 6]];
    const runs = [{}, {second: 6}, {second: 1, cycle: 5}, {cycle: 7}];
    for (const genre of Object.keys(P.IDEA_GENRES)) for (const [beats, unit, groups] of meters) for (const extra of runs) for (let seed = 1; seed <= 4; seed++) {
      const m = {bpm: P.IDEA_GENRES[genre].bpm, beats, unit, res: 4, bars: 8, tracks: [], ...(groups ? {groups} : {})};
      const beatT = PPQ * 4 / unit, barT = beats * beatT, end = m.bars * barT;
      const opts = {genre, parts: {melody: true, bass: true, drums: true, chords: true}, seed, ...extra};
      const r = P.songIdeas(m, opts), again = P.songIdeas(m, opts);
      const say = msg => out.push(`${genre} ${beats}/${unit} ${JSON.stringify(extra)} seed ${seed}: ${msg}`);
      if (JSON.stringify(r) !== JSON.stringify(again)) say('the same seed gave a different idea');
      if (r.tracks.length !== 4) say(`${r.tracks.length} tracks`);
      for (const t of r.tracks) {
        if (!t.notes.length) say(`${t.name} is empty`);
        for (const n of t.notes) if (n.t < 0 || n.t + n.d > end || !Number.isInteger(n.t) || !Number.isInteger(n.d)) { say(`${t.name} has a note outside the song or off the tick grid`); break; }
      }
      // INVARIANT: the melody is in its own key: the home key, or the second key when polytonal.
      const melScale = r.summary.melScale;
      const mel = r.tracks.find(t => t.name.startsWith('Melody'));
      if (mel.notes.some(n => !melScale.includes(n.p % 12))) say('melody leaves its key');
      if (extra.second && r.summary.melTonic !== (r.summary.tonic + extra.second) % 12) say('the melody is not in the second key');
      const chords = r.tracks.find(t => t.name.startsWith('Chords')), bass = r.tracks.find(t => t.name.startsWith('Bass'));
      for (let b = 0; b < m.bars; b++) {
        const inBar = n => n.t >= b * barT && n.t < (b + 1) * barT;
        const first = bass.notes.find(inBar), chord = chords.notes.filter(inBar);
        if (first && chord.length && first.p % 12 !== Math.min(...chord.map(n => n.p)) % 12) { say(`bar ${b + 1}: bass isn't on the chord root`); break; }
        // INVARIANT: a bitonal chord carries the second key's chord too: its root, moved up by the second key's distance.
        if (extra.second && chord.length && P.IDEA_GENRES[genre].chords !== 'drone') {
          const root = Math.min(...chord.map(n => n.p)) % 12;
          if (!chord.some(n => n.p % 12 === (root + extra.second) % 12)) { say(`bar ${b + 1}: the chord isn't bitonal`); break; }
        }
      }
      const drums = r.tracks.find(t => t.drums);
      const g = P.meterGroups(m), common = beats === 4 && unit === 4 && !groups;
      const mid = g.slice(0, Math.floor(g.length / 2)).reduce((a, x) => a + x, 0) * beatT;
      const anchor = genre === 'reggae' ? (common ? 2 * PPQ : mid) : 0;
      for (let b = 0; b < m.bars; b++) {
        const t0 = b * barT;
        if (!drums.notes.some(n => n.p === 36 && Math.abs(n.t - t0 - anchor) < 40)) { say(`bar ${b + 1} has no kick on its anchor`); break; }
        if (P.IDEA_GENRES[genre].backbeat !== false && !drums.notes.some(n => (n.p === 38 || n.p === 39) && n.t >= t0 && n.t < t0 + barT)) { say(`bar ${b + 1} has no backbeat`); break; }
      }
      if (extra.cycle && r.summary.cycle !== extra.cycle) say('the melody cycle was ignored');
    }
    return out;
  });
  expect(bad.slice(0, 12)).toEqual([]);
  expect(errors).toEqual([]);
});

test('meters: odd, compound and irrational meters lay out bars, beats and accent groups, save and come back', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await T(page, async () => { const P = window.__pixiwyg; await P.newProject('Meters'); P.setWorkspace('music'); });
  await page.fill('#seqBeats', '7'); await page.locator('#seqBeats').press('Enter');
  await page.selectOption('#seqUnit', '8');
  await expect(page.locator('#seqGroups')).toHaveAttribute('placeholder', '2+2+3');
  await page.fill('#seqGroups', '3+2+2'); await page.locator('#seqGroups').press('Enter');
  expect(await T(page, () => { const m = window.__pixiwyg.state().music; return [m.beats, m.unit, m.groups]; })).toEqual([7, 8, [3, 2, 2]]);
  // RULE: a grouping that doesn't add up to the beats is dropped, and the meter's own is used.
  await page.fill('#seqGroups', '4+4'); await page.locator('#seqGroups').press('Enter');
  expect(await T(page, () => window.__pixiwyg.state().music.groups)).toBeUndefined();
  await page.fill('#seqBeats', '7'); await page.locator('#seqBeats').press('Enter');
  await page.selectOption('#seqUnit', '3');
  // INVARIANT: an irrational beat is a whole number of ticks, and the grid divides it.
  const r = await T(page, () => { const P = window.__pixiwyg, m = P.state().music; return {bar: P.barTicks(m), grid: P.gridTicks(m), beat: P.beatTicks(m)}; });
  expect(r).toEqual({bar: 7 * 640, grid: 160, beat: 640});
  const back = await T(page, async () => { const P = window.__pixiwyg, f = P.packProject(); await P.openFiles(new Map(await P.unzip(P.zipFiles(P.sortEntries(f)))), {});
    const m = P.state().songs[0]; return [m.beats, m.unit]; });
  expect(back).toEqual([7, 3]);
  expect(errors).toEqual([]);
});

test('song ideas panel: Generate adds an idea and plays it, Another swaps it, Undo takes it back', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await T(page, async () => { const P = window.__pixiwyg; await P.newProject('Ideas'); P.setWorkspace('music'); });
  await page.click('#seqIdeasBtn');
  await expect(page.locator('#seqIdeas')).toBeVisible();
  await page.click('#seqIdeasGenres [role=radio]:has-text("Lo-fi")');
  await expect(page.locator('#seqIdeasGenres [aria-checked=true]')).toContainText('Lo-fi');
  const names = () => T(page, () => window.__pixiwyg.state().music.tracks.map(t => t.name));
  await page.click('#seqIdeasGo');
  // RULE: the new song's empty Piano and Drums make way for the idea.
  expect(await names()).toEqual(['Drums · Lo-fi', 'Bass · Lo-fi', 'Melody · Lo-fi']);
  await expect(page.locator('#seqPlay')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#seqIdeasSays')).toContainText('Lo-fi in');
  const first = await T(page, () => JSON.stringify(window.__pixiwyg.state().music.tracks.map(t => t.notes)));
  await page.click('#seqIdeasAgain');
  expect(await names()).toEqual(['Drums · Lo-fi', 'Bass · Lo-fi', 'Melody · Lo-fi']);
  expect(await T(page, () => JSON.stringify(window.__pixiwyg.state().music.tracks.map(t => t.notes)))).not.toBe(first);
  await page.locator('#seqIdeas [data-part=drums]').click();
  await page.click('#seqIdeasGo');
  expect(await names()).toEqual(['Drums · Lo-fi', 'Bass · Lo-fi', 'Melody · Lo-fi', 'Bass · Lo-fi', 'Melody · Lo-fi']);
  await page.click('#seqPlay');
  await T(page, () => window.__pixiwyg.undo());
  expect((await names()).length).toBe(3);
  await page.keyboard.press('Escape');
  await expect(page.locator('#seqIdeas')).toBeHidden();
  expect(errors).toEqual([]);
});

test('synth: every instrument and percussion sound is audible and clean, and a sidechain pump ducks on the beat', async ({page}) => {
  const errors = await boot(page);
  const r = await T(page, async () => {
    const P = window.__pixiwyg, PPQ = 480, out = {bad: []};
    const peak = (buf, a = 0, b = buf.length) => { let m = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = a; i < b; i++) { const v = Math.abs(d[i]); if (!Number.isFinite(v)) return NaN; if (v > m) m = v; } } return m; };
    const song = (tracks, bpm = 120) => ({bpm, beats: 4, unit: 4, res: 4, bars: 1, tracks});
    for (const [prog, name] of P.GM) {
      const buf = await P.pxRender(song([{name, drums: false, prog, vol: 110, mute: false, notes: [{t: 0, d: PPQ, p: 60, v: 110}]}]), P.GMV);
      const pk = peak(buf);
      if (!(pk > 0.01) || pk > 4) out.bad.push(`${name}: peak ${pk}`);
    }
    for (const [p, name] of P.DRUMS) {
      const buf = await P.pxRender(song([{name: 'kit', drums: true, prog: 0, vol: 110, mute: false, notes: [{t: 0, d: PPQ / 4, p, v: 110}]}]), P.GMV);
      const pk = peak(buf);
      if (!(pk > 0.005) || pk > 4) out.bad.push(`drum ${name}: peak ${pk}`);
    }
    // INVARIANT: with a pump, a held pad is quietest just after each beat and loudest just before the next.
    const pad = fx => ({name: 'pad', drums: false, prog: 89, vol: 110, mute: false, notes: [{t: 0, d: 4 * PPQ, p: 60, v: 110}], ...(fx ? {fx} : {})});
    const pumped = await P.pxRender(song([pad([{k: 'pump', on: true, depth: .9, rate: 1}])]), P.GMV);
    const sr = pumped.sampleRate, beat = sr * .5, w = Math.round(sr * .03);
    out.duck = peak(pumped, Math.round(beat * 2 + sr * .01), Math.round(beat * 2 + sr * .01) + w);
    out.swell = peak(pumped, Math.round(beat * 3 - w - sr * .01), Math.round(beat * 3 - sr * .01));
    return out;
  });
  expect(r.bad).toEqual([]);
  expect(r.duck).toBeLessThan(r.swell * .5);
  expect(errors).toEqual([]);
});

test('Save .mp3 downloads the song as a real MP3: valid frames, and it decodes to the song plus its ring-out', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  await T(page, async () => { const P = window.__pixiwyg; await P.newProject('Dungeon'); P.setWorkspace('music'); });
  await page.click('#seqIdeasBtn');
  await page.click('#seqIdeasGenres [role=radio]:has-text("Dungeon synth")');
  await page.click('#seqIdeas [data-part=chords]');
  await page.click('#seqIdeasGo');
  await page.click('#seqPlay');
  const [dl] = await Promise.all([page.waitForEvent('download', {timeout: 60_000}), page.click('#seqMp3')]);
  expect(dl.suggestedFilename()).toMatch(/\.mp3$/);
  const {readFileSync} = await import('node:fs');
  const bytes = readFileSync(await dl.path());
  // FORMAT: an MPEG-1 Layer III frame starts with the 11-bit sync and 0xFB (no CRC) or 0xFA.
  expect(bytes[0]).toBe(0xFF);
  expect([0xFB, 0xFA]).toContain(bytes[1]);
  const r = await page.evaluate(async b64 => {
    const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)), m = window.__pixiwyg.state().music;
    const buf = await new OfflineAudioContext(2, 44100, 44100).decodeAudioData(u.buffer);
    let peak = 0; const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    return {sec: buf.duration, song: m.bars * m.beats * (4 / (m.unit || 4)) * 60 / m.bpm, peak};
  }, bytes.toString('base64'));
  expect(r.sec).toBeGreaterThan(r.song + 1.5);
  expect(r.sec).toBeLessThan(r.song + 2.6);
  expect(r.peak).toBeGreaterThan(0.01);
  expect(errors).toEqual([]);
});

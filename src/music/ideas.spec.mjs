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
      const melScale = P.IDEA_MODES[r.summary.mode].map(i => (i + r.summary.melTonic) % 12);
      const mel = r.tracks.find(t => t.name.startsWith('Melody'));
      if (mel.notes.some(n => !melScale.includes(n.p % 12))) say('melody leaves its key');
      if (extra.second && r.summary.melTonic !== (r.summary.tonic + extra.second) % 12) say('the melody is not in the second key');
      const chords = r.tracks.find(t => t.name.startsWith('Chords')), bass = r.tracks.find(t => t.name.startsWith('Bass'));
      for (let b = 0; b < m.bars; b++) {
        const inBar = n => n.t >= b * barT && n.t < (b + 1) * barT;
        const first = bass.notes.find(inBar), chord = chords.notes.filter(inBar);
        if (first && chord.length && first.p % 12 !== Math.min(...chord.map(n => n.p)) % 12) { say(`bar ${b + 1}: bass isn't on the chord root`); break; }
        if (extra.second && chord.length && !chord.some(n => !P.IDEA_MODES[r.summary.mode].map(i => (i + r.summary.tonic) % 12).includes(n.p % 12)) && extra.second !== 0) {
          // RULE: a bitonal chord has notes outside the home key (the tritone and half step always do).
          if ([1, 6].includes(extra.second)) { say(`bar ${b + 1}: the chord isn't bitonal`); break; }
        }
      }
      const drums = r.tracks.find(t => t.drums);
      const g = P.meterGroups(m), common = beats === 4 && unit === 4 && !groups;
      const mid = g.slice(0, Math.floor(g.length / 2)).reduce((a, x) => a + x, 0) * beatT;
      const anchor = genre === 'reggae' ? (common ? 2 * PPQ : mid) : 0;
      for (let b = 0; b < m.bars; b++) {
        const t0 = b * barT;
        if (!drums.notes.some(n => n.p === 36 && Math.abs(n.t - t0 - anchor) < 40)) { say(`bar ${b + 1} has no kick on its anchor`); break; }
        if (!drums.notes.some(n => (n.p === 38 || n.p === 39) && n.t >= t0 && n.t < t0 + barT)) { say(`bar ${b + 1} has no backbeat`); break; }
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

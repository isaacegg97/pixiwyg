// SECTION: manuscripts: flow, manuscript blocks, convert one/all, put back
import {test, expect, boot, ws, freshPage} from '../../tools/tests/helpers.mjs';

const T = (page, fn, arg) => page.evaluate(fn, arg);
const ESSAY = ['# The Long Walk', '', '*An essay in six parts.*', '']
  .concat(...[1, 2, 3, 4, 5, 6].map(i => [`## Part ${i}`, '', 'One foot in front of the other, and then the other one, for a long time. '.repeat(i % 2 ? 26 : 12).trim(), '', `> A thought from part ${i}.`, '', '- first', '- second', ''])).join('\n');
const setup = async page => {
  await page.setViewportSize({width: 1440, height: 900});
  await T(page, async essay => { const P = window.__pixiwyg; await P.newProject('Walk', false, {type: 'booklet', pages: 8});
    const f = (await P.addLib('bookish.css')).id; const d = await P.addManuscript('The Long Walk.md', essay); d.sheet = f; P.flowDocs(d); await document.fonts.ready; P.flowDocs(d); }, ESSAY);
};
const md = page => T(page, () => window.__pixiwyg.state().els.filter(e => e.md).length);

test('a manuscript flows onto the pages, inside the margins, never overlapping, and follows edits', async ({page}) => {
  const errors = await boot(page);
  await setup(page);
  expect(await T(page, () => window.__pixiwyg.ws())).toBe('write');
  await expect(page.locator('#writer #docPage')).toBeVisible();
  const r = await T(page, () => {
    const P = window.__pixiwyg, els = P.state().els.filter(e => e.md), boxes = els.map(e => ({e, b: P.elBox(e), r: P.writeBox(e)}));
    const inside = boxes.every(({e, b, r}) => e.x >= r.x - 1 && e.x + b.w <= r.x + r.w + 1 && e.y >= r.y - 1 && e.y + b.h <= r.y + r.h + 1);
    let overlap = 0; for (const a of boxes) for (const c of boxes) if (a !== c && a.e.x < c.e.x + c.b.w && a.e.x + a.b.w > c.e.x && a.e.y < c.e.y + c.b.h && a.e.y + a.b.h > c.e.y) overlap++;
    return {n: els.length, inside, overlap, pages: new Set(els.map(e => P.pageOf(e).i)).size, split: els.some(e => e.flow)};
  });
  expect(r.n).toBeGreaterThan(20);
  expect(r).toMatchObject({inside: true, overlap: 0, split: true});
  expect(r.pages).toBeGreaterThan(2);
  const before = await md(page);
  await page.click('.wrstatus [data-wrview=md]'); // RULE: these steps are about the Markdown view.
  await page.locator('#docText').click();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('\n\n## Epilogue\n\nAnd then we sat down.');
  await expect.poll(() => md(page)).toBe(before + 2);
  await expect(page.locator('#wrWords')).toContainText('words');
  await T(page, () => window.__pixiwyg.undo());
  expect(await md(page)).toBe(before);
  expect(errors).toEqual([]);
});

test('the text and the page point at each other; styling one block styles them all; Delete takes it out of the text', async ({page}) => {
  const errors = await boot(page);
  await setup(page);
  const at = ESSAY.indexOf('> A thought from part 3') + 4;
  // RULE: text and canvas side by side is the Page workspace's job; Write is the word processor.
  await ws(page, 'page'); await T(page, () => window.__pixiwyg.showText());
  await page.click('#docViewMd'); // RULE: these steps are about the Markdown view.
  await page.locator('#docText').click();
  await T(page, at => { const ta = document.getElementById('docText'); ta.setSelectionRange(at, at); ta.dispatchEvent(new MouseEvent('click')); }, at);
  // FIX: under load the caret's block is found a beat later; wait for it rather than read once.
  await expect.poll(() => T(page, () => { const P = window.__pixiwyg, el = P.state().els.find(e => e.id === P.state().sel); return el && el.tag + ':' + el.content; })).toBe('blockquote:A thought from part 3.');
  const pid = await T(page, () => window.__pixiwyg.state().els.find(e => e.md && e.tag === 'h2' && e.content === 'Part 4').id);
  await page.locator(`.el[data-id="${pid}"]`).dblclick();
  await expect.poll(() => T(page, () => { const ta = document.getElementById('docText'); return ta.value.slice(ta.selectionStart, ta.selectionEnd); })).toBe('## Part 4');
  await expect(page.locator('#ins')).toContainText('Manuscript block');
  await expect(page.locator('#selbox .h').first()).toBeHidden();
  await T(page, () => { const P = window.__pixiwyg, el = P.state().els.find(e => e.md && e.tag === 'p'); P.select(el.id); });
  await T(page, () => { const P = window.__pixiwyg, el = P.state().els.find(e => e.id === P.state().sel); P.chooseStyle(el.fileId, 'p.indent'); });
  expect(await T(page, () => [...new Set(window.__pixiwyg.state().els.filter(e => e.md && e.tag === 'p').map(e => e.selector))])).toEqual(['p.indent']);
  await T(page, () => { const P = window.__pixiwyg, el = P.state().els.find(e => e.md && e.content === 'A thought from part 5.'); P.select(el.id); });
  await page.evaluate(() => document.activeElement && document.activeElement.blur()); await page.keyboard.press('Delete');
  await expect.poll(() => T(page, () => window.__pixiwyg.state().docs[0].text.includes('part 5.'))).toBe(false);
  expect(errors).toEqual([]);
});

test('a block converts to a component of its own and goes back; convert all; the project keeps the .md and rebuilds the rest', async ({page}) => {
  const errors = await boot(page);
  await setup(page);
  const r = await T(page, () => {
    const P = window.__pixiwyg, s = P.state(), d = s.docs[0], orig = d.text, el = s.els.find(e => e.md && e.tag === 'blockquote');
    P.convertOne(el);
    const c = s.els.find(e => e.from && e.tag === 'blockquote');
    return {orig, conv: !!c && !c.md, marker: /\x3C!-- pixiwyg:\w+ A thought from part 1/.test(d.text), still: s.els.filter(e => e.md && e.content === 'A thought from part 1.').length, sel: s.sel === (c && c.id)};
  });
  expect(r).toMatchObject({conv: true, marker: true, still: 0, sel: true});
  // RULE: a component is moved on the canvas, in the Page workspace; Write is for the words.
  await ws(page, 'page');
  const cid = await T(page, () => window.__pixiwyg.state().sel);
  const box = await page.locator(`.el[data-id="${cid}"]`).boundingBox();
  await page.mouse.move(box.x + 5, box.y + 5); await page.mouse.down(); await page.mouse.move(box.x + 60, box.y + 40, {steps: 4}); await page.mouse.up();
  await expect(page.locator('#ins')).toContainText('Put back into');
  await page.locator('#ins .btn', {hasText: 'Put back into'}).click();
  expect(await T(page, () => window.__pixiwyg.state().docs[0].text)).toBe(r.orig);
  const saved = await T(page, async () => {
    const P = window.__pixiwyg, f = P.packProject(), mf = f.get('manifest.json'), man = JSON.parse(typeof mf === 'string' ? mf : new TextDecoder().decode(mf)), n = P.state().els.filter(e => e.md).length;
    const file = man.docs[0].file, text = f.get(file); await P.openFiles(new Map(await P.unzip(P.zipFiles(P.sortEntries(f)))), {});
    return {file, sameText: (typeof text === 'string' ? text : new TextDecoder().decode(text)) === P.state().docs[0].text, stored: man.elements.length, rebuilt: P.state().els.filter(e => e.md).length, n};
  });
  expect(saved.file).toMatch(/^docs\/1-the-long-walk\.md$/);
  expect(saved.sameText).toBe(true);
  expect(saved.stored).toBe(0);
  expect(saved.rebuilt).toBe(saved.n);
  await ws(page, 'write');
  await page.click('#wrTabs [aria-controls=wrLayout]');
  await page.click('#wrConvertAll');
  await page.locator('#askBtns .btn', {hasText: 'Convert all'}).click();
  const all = await T(page, () => { const s = window.__pixiwyg.state(); return {md: s.els.filter(e => e.md).length, comps: s.els.filter(e => e.from).length, words: s.docs[0].text.replace(/\x3C!--[\s\S]*?-->/g, '').trim().length}; });
  expect(all).toMatchObject({md: 0, words: 0});
  expect(all.comps).toBeGreaterThan(20);
  expect(errors).toEqual([]);
});

test('the text steps past components in its way; a .md dropped on the page becomes a manuscript', async ({page}) => {
  const errors = await boot(page);
  await setup(page);
  const r = await T(page, () => {
    const P = window.__pixiwyg, s = P.state(), r1 = P.pageRects()[1], b = P.writeBox({x: r1.x + 10, y: r1.y + 10});
    s.els.push({id: 'eblock', tag: 'blockquote', fileId: s.els[0].fileId, selector: 'blockquote', x: b.x, y: b.y + 200, w: b.w, z: 50, content: 'A component in the way.'});
    P.renderAll(); P.flowDocs();
    const o = s.els.find(e => e.id === 'eblock'), ob = P.elBox(o);
    return s.els.filter(e => e.md).filter(e => { const eb = P.elBox(e); return e.x < o.x + ob.w && e.x + eb.w > o.x && e.y < o.y + ob.h && e.y + eb.h > o.y; }).length;
  });
  expect(r).toBe(0);
  const d = await T(page, async () => { const P = window.__pixiwyg; await P.ingest([{path: 'Notes.md', file: new File(['# Notes\n\nA second manuscript.'], 'Notes.md', {type: 'text/markdown'})}]); return P.state().docs.map(x => x.name); });
  expect(d).toEqual(['The Long Walk', 'Notes']);
  await expect(page.locator('#docSel option:checked')).toHaveText('Notes');
  expect(errors).toEqual([]);
});

test('Markdown made from an edited component, and the file list knows manuscripts', async ({page}) => {
  const errors = await boot(page);
  await setup(page);
  const r = await T(page, () => {
    const P = window.__pixiwyg, s = P.state(), d = s.docs[0], el = s.els.find(e => e.md && e.tag === 'ul');
    P.convertOne(el); const c = s.els.find(e => e.from && e.tag === 'ul'); c.content = '<li><strong>first</strong> and <em>foremost</em></li><li><a href="https://example.com">second</a></li>';
    P.putBack(c); return d.text.includes('- **first** and *foremost*\n- [second](https://example.com)');
  });
  expect(r).toBe(true);
  await page.keyboard.press('Control+p');
  await expect(page.locator('#filesList')).toContainText('The Long Walk');
  expect(errors).toEqual([]);
});

test('text wraps around a component beside it: narrower lines next to it, full width again below', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1440, height: 900});
  const r = await T(page, async () => {
    const P = window.__pixiwyg; await P.newProject('Wrap', false, {type: 'booklet', pages: 4});
    const s = P.state(), f = (await P.addLib('bookish.css')).id, r0 = P.pageRects()[0], b = P.writeBox({x: r0.x + 10, y: r0.y + 10});
    s.els.push({id: 'eside', tag: 'blockquote', fileId: f, selector: 'blockquote', x: b.x + Math.round(b.w / 2), y: b.y + 200, w: Math.round(b.w / 2), z: 50, content: 'A pull quote on the right, for the text to wrap around. Long enough to stand a few lines tall.'});
    P.renderAll();
    const d = await P.addManuscript('Wrap.md', 'Around and around the paragraph goes, past whatever sits in its way, and on down the page. '.repeat(40)); d.sheet = f; P.flowDocs(d); await document.fonts.ready; P.flowDocs(d);
    const o = s.els.find(e => e.id === 'eside'), ob = P.elBox(o), md = s.els.filter(e => e.md && P.pageOf(e).i === 0).map(e => ({e, b: P.elBox(e)}));
    const overlaps = md.filter(({e, b}) => e.x < o.x + ob.w && e.x + b.w > o.x && e.y < o.y + ob.h && e.y + b.h > o.y).length;
    const beside = md.filter(({e, b}) => e.y < o.y + ob.h && e.y + b.h > o.y);
    return {overlaps, pieces: md.length, above: md.some(({e, b: bb}) => e.y + bb.h <= o.y && bb.w > b.w * .9), beside: beside.length && beside.every(({e, b: bb}) => e.x + bb.w <= o.x && bb.w < b.w * .6),
      below: md.some(({e, b: bb}) => e.y >= o.y + ob.h && bb.w > b.w * .9), oneParagraph: md.every(({e}) => e.flow)};
  });
  expect(r).toEqual({overlaps: 0, pieces: 3, above: true, beside: true, below: true, oneParagraph: true});
  expect(errors).toEqual([]);
});

test('INVARIANT: an incremental reflow lays out exactly what a full reflow would, for every kind of edit, and is fast', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1600, height: 900});
  const r = await page.evaluate(async () => {
    const P = window.__pixiwyg; await P.newProject('inc', false, {type: 'booklet', sheet: 'a4', pages: 4}, 'page');
    const para = i => `Paragraph ${i} ` + 'lorem ipsum dolor sit amet consectetur '.repeat(6 + (i % 5));
    let md = Array.from({length: 300}, (_, i) => i % 9 ? para(i) : `## Heading ${i}`).join('\n\n');
    await P.addManuscript('long', md);
    const d = P.state().docs[0];
    const sig = () => P.state().els.filter(e => e.md === d.id).map(e => [e.tag, e.mdB, e.x, e.y, e.w, e.content]).sort((a, b) => a[1] - b[1] || a[3] - b[3] || a[2] - b[2]).map(x => JSON.stringify(x)).join('\n');
    const edits = [
      t => t.replace('Paragraph 150 ', 'Paragraph 150, edited '),
      t => t.replace('Paragraph 150, edited ', 'Paragraph 150 ' + 'much longer now '.repeat(30)),
      t => 'A new first paragraph.\n\n' + t,
      t => t.replace(/\n\nParagraph 77 [^\n]*/, ''),
      t => t + '\n\nThe very end.',
      t => t.replace('## Heading 99', '## Heading 99\n\nInserted under a heading.'),
    ];
    const out = {same: [], ms: []};
    for (const e of edits) {
      d.text = e(d.text);
      const ids0 = new Set(P.state().els.filter(e => e.md === d.id).map(e => e.id));
      const a = performance.now(); P.flowDocs(d, {inc: true}); out.ms.push(Math.round(performance.now() - a));
      out.kept = (out.kept || []).concat(P.state().els.filter(e => e.md === d.id && ids0.has(e.id)).length + '/' + ids0.size);
      const inc = sig(); const b = performance.now(); P.flowDocs(d); out.full = (out.full || []).concat(Math.round(performance.now() - b)); out.same.push(inc === sig());
    }
    out.pages = P.state().canvas.pages; out.type = P.state().canvas.type;
    return out;
  });
  console.log(JSON.stringify(r));
  expect(r.type).toBe('booklet');
  expect(r.pages).toBeGreaterThan(8);
  expect(r.same).toEqual([true, true, true, true, true, true]);
  // PERF: the same-height edit stops at its own page; the end append touches one block.
  expect(Math.min(r.ms[0], r.ms[4])).toBeLessThan(25);
  expect(errors).toEqual([]);
});

test('page view: writes like a word processor over the same Markdown, losing nothing it was not asked to change', async ({page}) => {
  const errors = await boot(page);
  const md = '# Title #\n\nSome _underscored_ words and a [link](https://x.test).\n\n* one\n* two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n```\ncode here\n```\n\n<div class="raw">html</div>\n\nLast paragraph.';
  await page.evaluate(async md => { const P = window.__pixiwyg; await P.newProject('Doc', false, {type: 'web'}); P.addManuscript('d.md', md); }, md);
  await page.evaluate(() => { const P = window.__pixiwyg; P.dpSetView('page'); });
  await expect(page.locator('#docPage')).toBeVisible();
  await expect(page.locator('#docPage > h1')).toHaveText('Title');
  await expect(page.locator('#docPage > .dpraw')).toHaveCount(3);
  const text = () => page.evaluate(() => window.__pixiwyg.state().docs[0].text);
  const els0 = await page.evaluate(() => window.__pixiwyg.state().els.length);
  // RULE: an edit in one paragraph rewrites only that paragraph; digits and Delete never reach the page's elements.
  const last = page.locator('#docPage > p').last();
  await last.click(); await page.keyboard.press('End'); await page.keyboard.type(' Added 123.');
  await page.keyboard.press('Delete');
  await expect.poll(text).toBe(md.replace('Last paragraph.', 'Last paragraph. Added 123.'));
  expect(await page.evaluate(() => window.__pixiwyg.state().els.length)).toBeGreaterThanOrEqual(els0);
  // RULE: Ctrl+B bolds the selection; Ctrl+2 makes a heading; "- " starts a list.
  await last.click(); await page.keyboard.press('Home'); await page.keyboard.press('Shift+End'); await page.keyboard.press('Control+b');
  await expect.poll(text).toContain('**Last paragraph. Added 123.**');
  await page.keyboard.press('Control+2');
  await expect.poll(text).toContain('## **Last paragraph. Added 123.**');
  await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('- first item');
  await expect.poll(text).toContain('- first item');
  expect((await text()).startsWith('# Title #\n\nSome _underscored_ words')).toBe(true);
  expect(await text()).toContain('| a | b |\n|---|---|\n| 1 | 2 |');
  // RULE: paste brings plain text only.
  await page.evaluate(() => { const p = document.querySelector('#docPage > p'); const r = document.createRange(); r.selectNodeContents(p); r.collapse(false); getSelection().removeAllRanges(); getSelection().addRange(r);
    const dt = new DataTransfer(); dt.setData('text/plain', ' pasted'); dt.setData('text/html', '<span style="color:red">pasted</span>'); document.getElementById('docPage').dispatchEvent(new ClipboardEvent('paste', {clipboardData: dt, bubbles: true, cancelable: true})); });
  await expect.poll(text).toContain('https://x.test). pasted');
  expect(await text()).not.toContain('color:red');
  await page.click('#docFocus');
  expect(await page.evaluate(() => document.body.classList.contains('docfocus'))).toBe(true);
  await page.locator('#docPage').press('Escape');
  expect(await page.evaluate(() => document.body.classList.contains('docfocus'))).toBe(false);
  expect(errors).toEqual([]);
});

test('Write is a word processor: the real page size, Word keys and styles, blocks kept on whole pages, find and replace, Pages and back', async ({page}) => {
  const errors = await boot(page);
  await setup(page);
  // RULE: the writer borrows the one editor and folds the side panels.
  expect(await T(page, () => ({inWriter: !!document.querySelector('#writer #docPage'), L: document.body.classList.contains('noL'), R: document.body.classList.contains('noR'),
    w: document.getElementById('docPage').offsetWidth, page: Math.round(window.__pixiwyg.pageRects()[0].w)}))).toEqual({inWriter: true, L: true, R: true, w: expect.any(Number), page: expect.any(Number)});
  expect(await T(page, () => document.getElementById('docPage').offsetWidth === Math.round(window.__pixiwyg.pageRects()[0].w))).toBe(true);
  // INVARIANT: no block crosses a sheet's bottom margin (blocks shorter than a page).
  const pg = await T(page, () => { const P = document.getElementById('docPage'), sh = [...document.querySelectorAll('#wrSheets>div')], h = sh[0].offsetHeight, m = parseFloat(P.style.padding), pitch = sh.length > 1 ? sh[1].offsetTop - sh[0].offsetTop : h;
    const bad = [...P.children].filter(k => { const t = k.offsetTop, b = t + k.offsetHeight, p = Math.floor(t / pitch); return k.offsetHeight <= h - 2 * m && (t - p * pitch < m - 1 || b - p * pitch > h - m + 1); }).length;
    return {sheets: sh.length, bad, status: document.getElementById('wrPageN').textContent}; });
  expect(pg.sheets).toBeGreaterThan(2);
  expect(pg.bad).toBe(0);
  expect(pg.status).toMatch(new RegExp(`^Page \\d+ of ${pg.sheets}$`));
  // RULE: the style gallery and Word's keys format the caret's paragraph; the Markdown follows.
  await page.locator('#docPage p').nth(1).click();
  await page.locator('#wrStyles .wrsty', {hasText: 'Heading 3'}).click();
  await expect(page.locator('#wrStyles .wrsty[aria-pressed="true"]')).toHaveText(/Heading 3/);
  await page.keyboard.press('Control+0');
  await page.keyboard.press('End'); await page.keyboard.press('Enter'); await page.keyboard.type('A new line, typed on the page.');
  await expect.poll(() => T(page, () => window.__pixiwyg.state().docs[0].text.includes('\n\nA new line, typed on the page.'))).toBe(true);
  // RULE: Ctrl+F finds (lit, not changed); Replace all goes through the editor and the Markdown.
  await page.keyboard.press('Control+f');
  await page.keyboard.type('the other one');
  await expect(page.locator('#wrFindN')).toHaveText(/^1 of \d+$/);
  const n = +(await page.locator('#wrFindN').textContent()).split(' of ')[1];
  expect(n).toBeGreaterThan(10);
  await T(page, () => window.__pixiwyg.wrFindOpen(true));
  await page.locator('#wrFindR').fill('another');
  await page.click('#wrRepAll');
  await expect.poll(() => T(page, () => window.__pixiwyg.state().docs[0].text.split('the other one').length - 1)).toBe(0);
  expect(await T(page, () => window.__pixiwyg.state().docs[0].text.split('then another').length - 1)).toBe(n);
  await page.keyboard.press('Escape');
  // RULE: Pages shows the typeset canvas; Back to writing returns; leaving Write hands the editor back to the Text panel.
  await page.click('.wrstatus [data-wrview=pages]');
  await expect(page.locator('#desk')).toBeVisible();
  await expect(page.locator('#writer')).toBeHidden();
  await page.click('#wrBackBtn');
  await expect(page.locator('#writer #docPage')).toBeVisible();
  await ws(page, 'page');
  expect(await T(page, () => [!!document.querySelector('#w-text #docPage'), !!document.querySelector('#w-text #docText'), document.getElementById('writer').hidden, document.body.classList.contains('noR')])).toEqual([true, true, true, false]);
  expect(errors).toEqual([]);
});

test('Markdown imports two ways: as components, or as a manuscript that keeps flowing', async ({page}) => {
  const errors = await freshPage(page);
  const md = '# Title\n\nFirst paragraph.\n\n- one\n- two\n\n> quoted';
  const comps = await T(page, md => { const P = window.__pixiwyg; P.importMarkdown(md); return P.state().els.filter(e => !e.md).map(e => e.tag); }, md);
  expect(comps).toEqual(expect.arrayContaining(['h1', 'p', 'ul', 'blockquote']));
  const flowed = await T(page, async md => { const P = window.__pixiwyg; await P.addManuscript('notes', md); return P.state().els.filter(e => e.md).map(e => e.tag); }, md);
  expect(flowed).toEqual(['h1', 'p', 'ul', 'blockquote']);
  // INVARIANT: flowed blocks measured off-layer land where they measured: stacked in order, no overlaps
  const boxes = await T(page, () => { const P = window.__pixiwyg; return P.state().els.filter(e => e.md).map(e => { const h = P.hostOf(e.id); return [e.y, h.offsetHeight, parseInt(h.style.top)]; }); });
  for (let i = 0; i < boxes.length; i++) {
    expect(boxes[i][2]).toBe(boxes[i][0]);
    if (i) expect(boxes[i][0]).toBeGreaterThanOrEqual(boxes[i - 1][0] + boxes[i - 1][1]);
  }
  expect(errors).toEqual([]);
});

test('PERF: a 1500-block manuscript reflows without going quadratic', async ({page}) => {
  const errors = await freshPage(page);
  const ms = await T(page, async () => {
    const P = window.__pixiwyg, md = Array.from({length: 1500}, (_, i) => i % 10 ? `Paragraph ${i} ` + 'lorem ipsum dolor sit amet '.repeat(12) : `## Heading ${i}`).join('\n\n');
    await P.addManuscript('big', md);
    const a = performance.now(); P.flowDocs(); return performance.now() - a;
  });
  // PERF: ~150ms measured after the off-layer measure fix; ~2000ms before it. 1000ms leaves room for slow CI.
  expect(ms).toBeLessThan(1000);
  expect(errors).toEqual([]);
});

test('FIX: the first line typed into a new, empty manuscript is kept', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1500, height: 950});
  await T(page, async () => { const P = window.__pixiwyg; await P.newProject('First words', false, {type: 'web'}); P.setWorkspace('write'); });
  await page.click('#wrStart');
  await page.click('#docPage');
  await page.keyboard.type('Once upon a time');
  await expect.poll(() => T(page, () => window.__pixiwyg.state().docs[0].text)).toBe('Once upon a time');
  await page.keyboard.type(' a dragon ate the moon.');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The end.');
  await expect.poll(() => T(page, () => window.__pixiwyg.state().docs[0].text)).toBe('Once upon a time a dragon ate the moon.\n\nThe end.');
  expect(errors).toEqual([]);
});

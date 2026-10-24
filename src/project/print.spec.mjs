// SECTION: print exports
// INVARIANT: Chromium's print-to-PDF must match the paper size the export asks for, with the right sheet count.
// TODO: folding and trimming still need paper.
import {test, expect, boot} from '../../tools/tests/helpers.mjs';

const PT = 72 / 96; // FORMAT: CSS px to PDF points

function pdfPages(buf) {
  const s = buf.toString('latin1'), out = [];
  for (const m of s.matchAll(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/g)) out.push([Math.round(m[3] - m[1]), Math.round(m[4] - m[2])]);
  return out;
}

async function exportFor(page, canvas, opts) {
  return page.evaluate(async ({canvas, opts}) => {
    const T = window.__pixiwyg;
    await T.newProject('Print', false, canvas);
    T.importMarkdown('# Print test\n\nA paragraph on the first page.', {width: 300});
    Object.assign(T.expOpt, {nojs: true, imposed: false, bleed: false, marks: false}, opts);
    return T.buildExport();
  }, {canvas, opts});
}
async function printed(browser, html) {
  const p = await browser.newPage();
  await p.setContent(html, {waitUntil: 'load'});
  const pdf = await p.pdf({preferCSSPageSize: true, printBackground: true});
  await p.close();
  return pdfPages(pdf);
}

test.beforeEach(async ({page}) => { await boot(page); });

test('a zine imposed on A4 prints two pages to a landscape sheet, four sheets for eight pages', async ({page, browser}) => {
  const pages = await printed(browser, await exportFor(page, {type: 'booklet', sheet: 'a4', pages: 8}, {imposed: true}));
  expect(pages).toHaveLength(4);
  for (const [w, h] of pages) { expect(w).toBe(842); expect(h).toBe(595); }
});

test('a mini zine prints all eight pages on one landscape Letter sheet', async ({page, browser}) => {
  const pages = await printed(browser, await exportFor(page, {type: 'minizine', sheet: 'letter'}, {imposed: true, marks: true}));
  expect(pages).toEqual([[792, 612]]);
});

test('zine pages in order print one half-A4 page each', async ({page, browser}) => {
  const pages = await printed(browser, await exportFor(page, {type: 'booklet', sheet: 'a4', pages: 8}, {}));
  expect(pages).toHaveLength(8);
  // FORMAT: half A4 is 148.5 x 210mm (421 x 595pt), half a millimetre wider than A5
  for (const [w, h] of pages) { expect(w).toBe(421); expect(h).toBe(595); }
});

test('bleed and crop marks make each page bigger by exactly the bleed and the mark strip', async ({page, browser}) => {
  const html = await exportFor(page, {type: 'page', size: 'a5', orient: 'portrait', pages: 2, bleed: 3}, {bleed: true, marks: true});
  const css = html.match(/\.page\{position:relative;width:(\d+)px;height:(\d+)px/);
  const dims = await page.evaluate(() => window.__pixiwyg.pageRects()[0]);
  const b = Math.round(3 * 96 / 25.4), sl = Math.round(10 * 96 / 25.4);
  expect(+css[1]).toBe(dims.w + 2 * b + 2 * sl);
  const pages = await printed(browser, html);
  expect(pages).toHaveLength(2);
  expect(pages[0][0]).toBe(Math.round(+css[1] * PT));
});

test('imposition puts pages in fold order', async ({page}) => {
  await boot(page);
  const r = await page.evaluate(() => {
    const I = window.__pixiwyg.imposition;
    return {booklet: I({type: 'booklet', pages: 8}).map(s => s.map(x => x.p)),
      mini: I({type: 'minizine', pages: 8})[0].map(x => (x.rot ? '^' : '') + x.p)};
  });
  // FORMAT: sheet fronts: back | front cover, then 2 | 7 on the back, and so on (0-based pages)
  expect(r.booklet).toEqual([[7, 0], [1, 6], [5, 2], [3, 4]]);
  // FORMAT: one-sheet mini zine: top row 5 4 3 2 upside down, bottom row 6 7 back front
  expect(r.mini).toEqual(['^4', '^3', '^2', '^1', '5', '6', '7', '0']);
});

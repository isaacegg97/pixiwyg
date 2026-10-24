// SECTION: site pages: pages, the shared layer, generated navigation, routing, saving, exporting
import {test, expect, boot} from '../../tools/tests/helpers.mjs';

const T = (page, fn, arg) => page.evaluate(fn, arg);
// FORMAT: a two-page site: Home with a heading and a button that routes to About; About with a heading.
const setup = page => T(page, async () => {
  const P = window.__pixiwyg; await P.newProject('Band', false, {type: 'web'}, 'page');
  const S = P.state(), add = (id, tag, content, x, y, extra = {}) => { S.els.push({id, tag, content, x, y, w: 300, z: S.els.length + 1, fileId: null, selector: null, ...extra}); return id; };
  add('ehome', 'h1', 'Home page', 40, 40); add('ebtn', 'button', 'To About', 40, 140); add('ehead', 'div', 'THE BAND', 40, 0, {shared: true});
  P.renderAll();
  const about = P.addPage('About'); add('eabout', 'h1', 'About us', 40, 40); add('eout', 'p', '', 40, 140); P.renderAll();
  const home = P.siteTree()[0].p.id;
  return {home, about: about.id};
});
const visible = page => T(page, () => window.__pixiwyg.state().els.map(e => e.id).sort());

test('pages each keep their own elements; the shared layer rides along, and can be narrowed to chosen pages', async ({page}) => {
  const errors = await boot(page);
  const {home, about} = await setup(page);
  expect(await visible(page)).toEqual(['eabout', 'ehead', 'eout']);
  await T(page, id => window.__pixiwyg.goPage(id), home);
  expect(await visible(page)).toEqual(['ebtn', 'ehead', 'ehome']);
  // RULE: the tree lists the pages; the other page is a row that opens it.
  const aboutRow = page.locator('#treeBody .tlabel').filter({has: page.locator('b', {hasText: /^About$/})});
  await expect(aboutRow).toBeVisible();
  await aboutRow.click();
  expect(await T(page, () => window.__pixiwyg.curPage().name)).toBe('About');
  // RULE: narrowing a shared element to Home takes it off About, and it comes back on Home.
  await T(page, id => { const P = window.__pixiwyg, el = P.state().els.find(e => e.id === 'ehead'); el.only = [id]; P.goPage(P.siteTree()[0].p.id); P.goPage(P.siteTree()[1].p.id); }, home);
  expect(await visible(page)).toEqual(['eabout', 'eout']);
  await T(page, id => window.__pixiwyg.goPage(id), home);
  expect(await visible(page)).toContain('ehead');
  // RULE: undo after a page change goes back to the page where the change was made, with it undone.
  await T(page, () => { const P = window.__pixiwyg; P.pushUndo(); P.state().els.find(e => e.id === 'ehome').content = 'Changed'; P.save(); });
  await T(page, id => window.__pixiwyg.goPage(id), about);
  await T(page, () => window.__pixiwyg.undo());
  expect(await T(page, () => [window.__pixiwyg.curPage().name, window.__pixiwyg.state().els.find(e => e.id === 'ehome').content])).toEqual(['Home', 'Home page']);
  expect(errors).toEqual([]);
});

test('generated navigation follows the pages: names, order, hidden pages, parents, previous/next and breadcrumbs', async ({page}) => {
  const errors = await boot(page);
  const {home, about} = await setup(page);
  const nav = await T(page, () => { const P = window.__pixiwyg; P.addNav('menu'); P.addNav('prevnext'); P.addNav('crumbs'); return P.state().els.filter(e => e.nav).map(e => e.id); });
  const html = () => T(page, ids => ids.map(id => window.__pixiwyg.state().els.find(e => e.id === id).content), nav);
  let [menu, pn, crumbs] = await html();
  expect(menu).toMatch(/href="#home"[^>]*>Home<.*href="#about"[^>]*aria-current="page">About</s);
  expect(pn).toMatch(/rel="prev">← Home</);
  expect(crumbs).toMatch(/Home<\/a> › <span aria-current="page">About/);
  await T(page, ([id, h]) => { const P = window.__pixiwyg; P.setPageProp(id, 'name', 'The Band'); P.setPageProp(id, 'parent', h); }, [about, home]);
  [menu] = await html();
  expect(menu).toMatch(/<li><a[^>]*>Home<\/a><ul><li><a href="#the-band"|<li><a[^>]*>Home<\/a><ul><li><a href="#about"/);
  await T(page, id => window.__pixiwyg.setPageProp(id, 'nav', false), about);
  [menu] = await html();
  expect(menu).not.toContain('The Band');
  // RULE: the menu is on every page and shows where you are.
  await T(page, id => window.__pixiwyg.goPage(id), home);
  [menu] = await html();
  expect(menu).toMatch(/aria-current="page">Home</);
  expect(errors).toEqual([]);
});

test('logic routes between pages in Play: Go to page, links, On page open, Current page, shared variables', async ({page}) => {
  const errors = await boot(page);
  const {home, about} = await setup(page);
  await T(page, ([home, about]) => {
    const P = window.__pixiwyg, S = P.state();
    // FORMAT: About: on page open, write "<current page> · <score>" into its paragraph.
    S.logic = {nodes: [{id: 'o', type: 'pageOpen', x: 0, y: 0, f: {}}, {id: 'c', type: 'curPage', x: 0, y: 0, f: {}}, {id: 'g', type: 'getVar', x: 0, y: 0, f: {name: 'score'}},
      {id: 'j', type: 'join', x: 0, y: 0, f: {}}, {id: 't', type: 'setText', x: 0, y: 0, f: {el: 'eout'}}],
      wires: [{a: 'o', ap: 'fire', b: 't', bp: 'in'}, {a: 'c', ap: 'out', b: 'j', bp: 'a'}, {a: 'g', ap: 'out', b: 'j', bp: 'b'}, {a: 'j', ap: 'out', b: 't', bp: 'value'}]};
    P.goPage(home);
    S.logic = {nodes: [{id: 'k', type: 'click', x: 0, y: 0, f: {el: 'ebtn'}}, {id: 's', type: 'setVar', x: 0, y: 0, f: {name: 'score', value: '7'}}, {id: 'p', type: 'goPage', x: 0, y: 0, f: {to: 'page', page: about}}],
      wires: [{a: 'k', ap: 'fire', b: 's', bp: 'in'}, {a: 's', ap: 'next', b: 'p', bp: 'in'}]};
    P.save();
  }, [home, about]);
  await page.click('#playBtn');
  await page.locator('.el[data-id="ebtn"]').click();
  await expect.poll(() => T(page, () => window.__pixiwyg.curPage().name)).toBe('About');
  await expect.poll(() => T(page, () => window.__pixiwyg.hostOf('eout')._target.textContent)).toBe('About7');
  // RULE: Back goes back; links in generated navigation route too.
  await T(page, () => window.__pixiwyg.playGo('back'));
  await expect.poll(() => T(page, () => window.__pixiwyg.curPage().name)).toBe('Home');
  await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});

test('a site saves and opens with its pages, shared layer, links, navigation and routing intact, byte for byte', async ({page}) => {
  const errors = await boot(page);
  const {home, about} = await setup(page);
  const r = await T(page, async ([home, about]) => {
    const P = window.__pixiwyg, S = P.state();
    S.logic = {nodes: [{id: 'p', type: 'goPage', x: 0, y: 0, f: {to: 'page', page: home}}], wires: []};
    P.goPage(home); S.els.find(e => e.id === 'ebtn').link = about; P.addNav('menu');
    const before = JSON.stringify([...P.packProject()].filter(([k]) => k === 'manifest.json'));
    await P.openFiles(new Map(await P.unzip(P.zipFiles(P.sortEntries(P.packProject())))), {});
    const S2 = P.state(), pages = P.siteTree().map(x => x.p), btn = S2.els.find(e => e.tag === 'button');
    const out = {pages: pages.map(p => p.name), cur: P.curPage().name, link: btn && pages.find(p => p.id === btn.link)?.name, nav: S2.els.some(e => e.nav), shared: S2.els.filter(e => e.shared).length};
    P.goPage(pages[1].id);
    out.aboutEls = P.state().els.filter(e => !e.shared).map(e => e.content).sort();
    out.route = P.state().logic.nodes.find(n => n.type === 'goPage')?.f.page === pages[0].id;
    P.goPage(pages[0].id);
    out.same = JSON.stringify([...P.packProject()].filter(([k]) => k === 'manifest.json')) === before;
    return out;
  }, [home, about]);
  expect(r).toEqual({pages: ['Home', 'About'], cur: 'Home', link: 'About', nav: true, shared: 2, aboutEls: ['', 'About us'], route: true, same: true});
  expect(errors).toEqual([]);
});

test('a site exports as one file whose pages route by address, with scripts off and on; the editor never moves', async ({page, browser}) => {
  const errors = await boot(page);
  const {home, about} = await setup(page);
  const html = await T(page, async ([home, about]) => {
    const P = window.__pixiwyg, S = P.state();
    S.logic = {nodes: [{id: 'k', type: 'click', x: 0, y: 0, f: {el: 'eabout'}}, {id: 'p', type: 'goPage', x: 0, y: 0, f: {to: 'first'}}], wires: [{a: 'k', ap: 'fire', b: 'p', bp: 'in'}]};
    P.goPage(home); S.els.find(e => e.id === 'ebtn').link = about; P.addNav('menu');
    const hostsBefore = document.querySelectorAll('#layer .el').length, cur = P.curPage().name;
    const prev = P.expOpt.nojs; P.expOpt.nojs = false; const h = await P.buildExport(); P.expOpt.nojs = prev;
    if (document.querySelectorAll('#layer .el').length !== hostsBefore || P.curPage().name !== cur) return 'EDITOR MOVED';
    return h;
  }, [home, about]);
  expect(html).toMatch(/<section class="page pxpage pxhome" id="home"/);
  expect(html).toMatch(/<section class="page pxpage" id="about"/);
  expect(html).toContain('<a class="pxlink" href="#about">');
  expect(html).toContain('hashchange');
  const view = await browser.newPage();
  const viewErr = [];view.on('pageerror', e => viewErr.push(e.message));
  await view.setContent(html);
  const shown = () => view.evaluate(() => [...document.querySelectorAll('.pxpage')].filter(s => getComputedStyle(s).display !== 'none').map(s => s.id));
  expect(await shown()).toEqual(['home']);
  // RULE: a linked element is a real link: About shows by :target.
  await view.locator('#home a.pxlink .el').click();
  await expect.poll(shown).toEqual(['about']);
  await expect(view).toHaveTitle(/^About/);
  // RULE: the router runs About's logic: clicking its heading routes to the first page.
  await view.locator('#about .el[data-px^="about-"]').first().click();
  await expect.poll(shown).toEqual(['home']);
  expect(viewErr).toEqual([]);
  await view.close();
  // FORMAT: the zip has index.html and about.html, linked to each other by file name.
  const files = await T(page, async () => { const m = await window.__pixiwyg.exportSiteFiles(); return Object.fromEntries([...m].map(([k, v]) => [k, /href="about\.html"/.test(v) || /href="index\.html"/.test(v)])); });
  expect(files).toEqual({'index.html': true, 'about.html': true});
  expect(errors).toEqual([]);
});

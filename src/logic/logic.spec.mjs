// SECTION: node editor: animations and page logic
import {test, expect, boot, tb} from '../../tools/tests/helpers.mjs';

const fresh = page => page.evaluate(async () => { await window.__pixiwyg.newProject('Logic', true, {type: 'web'}); });
// INVARIANT: clicks the element inside its stage box, as a person would
const press = (page, text) => page.evaluate(t => {
  const T = window.__pixiwyg, el = T.state().els.find(e => e.tag === 'button' && e.content === t);
  T.hostOf(el.id).shadowRoot.querySelector('button').click();
}, text);
let disp;
const display = page => page.evaluate(id => window.__pixiwyg.hostOf(id).shadowRoot.querySelector('input').value, disp);
const calculator = async page => { disp = await page.evaluate(() => window.__pixiwyg.insertCalculator()); };

test('the example calculator works in Play, and the page is back as it was after', async ({page}) => {
  const errors = await boot(page);
  await fresh(page);
  await calculator(page);
  await page.click('#playBtn');
  await expect(page.locator('#playBar')).toBeVisible();
  for (const k of ['1', '2', '+', '3', '×', '2', '=']) await press(page, k);
  expect(await display(page)).toBe('18');
  await press(page, 'C');
  for (const k of ['7', '÷', '0', '=']) await press(page, k);
  expect(await display(page)).toBe('Error');
  await page.keyboard.press('Escape');
  await expect(page.locator('#playBar')).toBeHidden();
  expect(await display(page)).toBe('');
  expect(errors).toEqual([]);
});

test('the node editor opens on the page logic and wires survive a round trip', async ({page}) => {
  await boot(page);
  await fresh(page);
  await calculator(page);
  await tb(page, '#logicBtn');
  await expect(page.locator('#nodeModal')).toBeVisible();
  expect(await page.locator('#nodeLayer .nnode').count()).toBe(34);
  expect(await page.locator('#nodeWires .wire').count()).toBeGreaterThan(17);
  await page.keyboard.press('Escape');
  await expect(page.locator('#nodeModal')).toBeHidden();
  const r = await page.evaluate(async () => {
    const T = window.__pixiwyg, f1 = T.packProject(), k1 = T.filesKey(f1);
    await T.openFiles(new Map(await T.unzip(T.zipFiles(T.sortEntries(f1)))), {});
    return {k1, k2: T.filesKey(T.packProject()), nodes: T.state().logic.nodes.length, wires: T.state().logic.wires.length};
  });
  expect(r.k2).toBe(r.k1);
  expect(r.nodes).toBe(34);
});

test('FIX: a real mouse click on a wire removes it', async ({page}) => {
  await boot(page);
  await fresh(page);
  await calculator(page);
  await tb(page, '#logicBtn');
  await expect(page.locator('#nodeModal')).toBeVisible();
  const before = await page.evaluate(() => window.__pixiwyg.state().logic.wires.length);
  // INVARIANT: picks the midpoint of the first wire nothing covers, so the click lands on the wire itself.
  const pt = await page.evaluate(() => {
    for (const p of document.querySelectorAll('#nodeWires .wirehit')) {
      const m = p.getPointAtLength(p.getTotalLength() / 2), s = new DOMPoint(m.x, m.y).matrixTransform(p.getScreenCTM());
      if (document.elementFromPoint(s.x, s.y) === p) return {x: s.x, y: s.y};
    }
    return null;
  });
  expect(pt).not.toBeNull();
  await page.mouse.click(pt.x, pt.y);
  expect(await page.evaluate(() => window.__pixiwyg.state().logic.wires.length)).toBe(before - 1);
});

test('an element animates between its two states when clicked', async ({page}) => {
  await boot(page);
  await fresh(page);
  await calculator(page);
  await page.evaluate(() => {
    const T = window.__pixiwyg, el = T.state().els.find(e => e.content === '7');
    T.openAnimEditor(el);
  });
  await expect(page.locator('#nodeModal')).toHaveClass(/anim/);
  await expect(page.locator('#nodePrevNote')).toContainText('from A to B');
  await page.locator('#nodeLayer .nnode', {hasText: 'Trigger'}).locator('select').selectOption('click');
  const scale = page.locator('#nodeLayer .nnode', {hasText: 'State B'}).getByLabel(/scale/i);
  await scale.fill('200');
  await page.click('#nodeDone');
  await expect(page.locator('#nodeModal')).toBeHidden();
  const spec = await page.evaluate(() => window.__pixiwyg.animSpec(window.__pixiwyg.state().els.find(e => e.content === '7').anim));
  expect(spec).toMatchObject({trigger: 'click', b: {scale: 200}});
  await page.click('#playBtn');
  await press(page, '7');
  await page.waitForTimeout(900);
  const t = await page.evaluate(() => { const T = window.__pixiwyg, el = T.state().els.find(e => e.content === '7'); return getComputedStyle(T.hostOf(el.id)).transform; });
  expect(t).toMatch(/^matrix\(2, 0, 0, 2,/);
  await page.keyboard.press('Escape');
});

test('the exported page carries its logic and runs it', async ({page, context}) => {
  await boot(page);
  await fresh(page);
  await calculator(page);
  const html = await page.evaluate(async () => { const T = window.__pixiwyg; T.expOpt.nojs = false; return T.buildExport(); });
  expect(html).toContain('data-px=');
  const out = await context.newPage();
  const errs = [];
  out.on('pageerror', e => errs.push(e.message));
  await out.setContent(html);
  const click = k => out.evaluate(k => { for (const h of document.querySelectorAll('.el')) { const b = h.shadowRoot.querySelector('button'); if (b && b.textContent === k) b.click(); } }, k);
  for (const k of ['4', '0', '÷', '8', '=']) await click(k);
  const i = await page.evaluate(id => [...window.__pixiwyg.state().els].sort((a, b) => (a.z || 0) - (b.z || 0)).findIndex(e => e.id === id), disp);
  expect(await out.evaluate(i => document.querySelector(`.el[data-px="${i}"]`).shadowRoot.querySelector('input').value, i)).toBe('5');
  expect(errs).toEqual([]);
});

test('hostile graphs are rebuilt from known parts only', async ({page}) => {
  await boot(page);
  const g = await page.evaluate(() => window.__pixiwyg.cleanGraph({
    nodes: [
      {id: 'a"><img src=x onerror=alert(1)>', type: 'click', f: {el: 'e1'}},
      {id: 'b', type: 'eval', f: {code: 'alert(1)'}},
      {id: 'c', type: 'setText', x: 1e12, f: {el: 'e2', value: 'x'.repeat(5000), __proto__: {}}},
      {id: 'd', type: 'math', f: {op: 'constructor'}},
      {id: 'c', type: 'number'},
      {id: 't', type: 'trigger'},
    ],
    wires: [{a: 'aimgsrcxonerroralert1', ap: 'fire', b: 'c', bp: 'in'}, {a: 'c', ap: 'next', b: 'd', bp: 'a'}, {a: 'zz', ap: 'x', b: 'c', bp: 'in'}],
  }));
  expect(g.nodes.map(n => n.id)).toEqual(['aimgsrcxonerroralert1', 'c', 'd']);
  expect(g.nodes[1].x).toBe(100000);
  expect(g.nodes[1].f.value.length).toBe(500);
  expect(g.nodes[2].f.op).toBe('+');
  expect(g.wires).toEqual([{a: 'aimgsrcxonerroralert1', ap: 'fire', b: 'c', bp: 'in'}]);
});

test('the live preview window shows the exported page, follows edits, and runs the logic', async ({page, context}) => {
  const errors = await boot(page);
  await fresh(page);
  await calculator(page);
  // RULE: the preview asks for the page's own size, not a fixed window.
  const feat = await page.evaluate(() => { const T = window.__pixiwyg, f = T.liveFeatures(), r = T.pageRects()[0]; return {f, w: r.w, h: r.h, sw: screen.availWidth, sh: screen.availHeight - 60}; });
  const fw = +/width=(\d+)/.exec(feat.f)[1], fh = +/height=(\d+)/.exec(feat.f)[1];
  expect(fh).toBe(Math.max(200, Math.min(feat.h, feat.sh)));
  expect(fw).toBe(Math.max(320, Math.min(feat.w + (fh < feat.h ? 16 : 0), feat.sw)));
  const [pv] = await Promise.all([context.waitForEvent('page'), tb(page, '#liveBtn')]);
  await expect(page.locator('#liveBtn')).toHaveAttribute('aria-pressed', 'true');
  await pv.waitForFunction(() => document.querySelectorAll('.el').length > 10 && document.querySelector('.el').shadowRoot);
  expect(await pv.evaluate(() => document.querySelectorAll('script').length)).toBe(0);
  const i = await page.evaluate(id => [...window.__pixiwyg.state().els].sort((a, b) => (a.z || 0) - (b.z || 0)).findIndex(e => e.id === id), disp);
  const click = k => pv.evaluate(k => { for (const h of document.querySelectorAll('.el')) { const b = h.shadowRoot.querySelector('button'); if (b && b.textContent === k) b.click(); } }, k);
  for (const k of ['6', '×', '7', '=']) await click(k);
  expect(await pv.evaluate(i => document.querySelector(`.el[data-px="${i}"]`).shadowRoot.querySelector('input').value, i)).toBe('42');
  await page.evaluate(() => { const T = window.__pixiwyg, el = T.state().els.find(e => e.tag === 'h1'); el.content = 'Changed live'; T.renderAll(); T.save(); });
  await pv.waitForFunction(() => [...document.querySelectorAll('.el')].some(h => h.shadowRoot.textContent.includes('Changed live')));
  await pv.close();
  await expect(page.locator('#liveBtn')).toHaveAttribute('aria-pressed', 'false', {timeout: 5000});
  expect(errors).toEqual([]);
});

test('keyframes: stops on the way, in order; custom easing curves; played in Play and in a script-free export', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1600, height: 950});
  const id = await page.evaluate(async () => {
    const P = window.__pixiwyg; await P.newProject('keys'); const S = P.state();
    const el = {id: 'k', tag: 'p', content: 'hop', x: 100, y: 100, w: 120, z: 1, fileId: null, selector: null};
    S.els.push(el); P.renderAll(); P.select('k'); return el.id;
  });
  await page.evaluate(() => window.__pixiwyg.openAnimEditor(window.__pixiwyg.state().els.find(e => e.id === 'k')));
  await expect(page.locator('#nodePal button', {hasText: '+ Keyframe'})).toBeVisible();
  await page.locator('#nodePal button', {hasText: '+ Keyframe'}).click();
  await page.locator('#nodePal button', {hasText: '+ Keyframe'}).click();
  const spec = await page.evaluate(() => {
    const P = window.__pixiwyg, el = P.state().els.find(e => e.id === 'k'), g = el.anim;
    const ks = g.nodes.filter(n => n.type === 'key'); ks[0].f.at = 70; ks[0].f.y = -40; ks[1].f.at = 30; ks[1].f.y = -80;
    const tr = g.nodes.find(n => n.type === 'transition'); tr.f.ease = 'custom'; tr.f.curve = '.2,1.8,.4,1'; tr.f.dur = 1000;
    g.nodes.find(n => n.type === 'trigger').f.on = 'load';
    return P.animSpec(g);
  });
  expect(spec.keys.map(k => [k.at, k.y])).toEqual([[30, -80], [70, -40]]);
  expect(spec.curve).toBe('.2,1.8,.4,1');
  // INVARIANT: a hostile curve is clamped to what CSS accepts
  expect(await page.evaluate(() => window.__pixiwyg.cleanGraph({nodes: [{id: 't', type: 'transition', f: {curve: '9,9,-4,1;}'}}], wires: []}, {anim: true}).nodes[0].f.curve)).toBe('.25,.1,.25,1');
  expect(await page.evaluate(() => window.__pixiwyg.cleanGraph({nodes: [{id: 't', type: 'transition', f: {curve: '1.5,4,-1,-9'}}], wires: []}, {anim: true}).nodes[0].f.curve)).toBe('1,3,0,-2');
  await page.keyboard.press('Escape');
  const frames = await page.evaluate(async () => {
    const P = window.__pixiwyg; P.setPlay(true); await new Promise(r => setTimeout(r, 50));
    const a = P.hostOf('k').getAnimations()[0], kf = a.effect.getKeyframes().map(k => [Math.round(k.computedOffset * 100), k.transform]);
    const easing = a.effect.getTiming().easing; P.setPlay(false); return {kf, easing};
  });
  expect(frames.kf.map(k => k[0])).toEqual([0, 30, 70, 100]);
  expect(frames.kf[1][1]).toContain('translate(0px, -80px)');
  expect(frames.easing).toBe('cubic-bezier(0.2, 1.8, 0.4, 1)');
  const html = await page.evaluate(async () => { const P = window.__pixiwyg, o = P.expOpt.nojs; P.expOpt.nojs = true; try { return await P.buildExport(); } finally { P.expOpt.nojs = o; } });
  expect(html).toMatch(/@keyframes px\d+\{from\{[^}]*\}30%\{transform:translate\(0px,-80px\)[^}]*\}70%\{/);
  expect(html).toContain('cubic-bezier(.2,1.8,.4,1)');
  expect(errors).toEqual([]);
});

test('logic is checked as it is built: on the nodes, in the footer, and in the Checks panel; the calculator is clean', async ({page}) => {
  const errors = await boot(page);
  await fresh(page);
  await calculator(page);
  expect(await page.evaluate(() => window.__pixiwyg.validateLogic())).toEqual([]);
  const probs = await page.evaluate(() => {
    const P = window.__pixiwyg, S = P.state(), b = S.els.find(e => e.tag === 'button'), L = S.logic, nd = (id, type, f = {}) => ({id, type, x: 0, y: 0, f: {...f}});
    L.nodes.push(nd('q1', 'click', {el: ''}), nd('q2', 'click', {el: b.id}), nd('q3', 'setText', {el: b.id, value: 'x'}), nd('q4', 'getVar', {name: 'never'}),
      nd('q5', 'start'), nd('q6', 'setVar', {name: 'a', value: '1'}), nd('q7', 'setVar', {name: 'b', value: '1'}), nd('q8', 'animate', {el: b.id, dir: 'forward'}), nd('q9', 'cls', {el: b.id, name: 'no good'}));
    L.wires.push({a: 'q5', ap: 'fire', b: 'q6', bp: 'in'}, {a: 'q6', ap: 'next', b: 'q7', bp: 'in'}, {a: 'q7', ap: 'next', b: 'q6', bp: 'in'});
    P.save(); return P.validateLogic().map(p => p.node + ':' + p.level + ':' + p.msg.split(':')[0]);
  });
  for (const want of ['q1:error:Choose an element for it', 'q2:warn:Does nothing yet', 'q3:warn:Never runs', 'q4:warn:Variable “never” is never set', 'q6:error:Loops forever', 'q7:error:Loops forever', 'q8:error:That element has no animation yet', 'q9:error:Give it a class name (letters, numbers, - and _)'])
    expect(probs).toContain(want);
  await tb(page, '#logicBtn');
  await expect(page.locator('#nodeLayer .nnode.bad').first()).toBeVisible();
  await expect(page.locator('#nodeProblems')).toContainText('problems');
  await page.click('#nodeProblems');
  expect(await page.locator('#nodeLayer .nnode.on').count()).toBe(1);
  await page.keyboard.press('Escape');
  await page.click('#w-checks summary'); await page.click('#chkRun');
  await expect(page.locator('#chkList li', {hasText: 'Loops forever'}).first()).toBeVisible();
  await page.locator('#chkList li', {hasText: 'Choose an element'}).locator('button.go').click();
  await expect(page.locator('#nodeModal')).toBeVisible();
  expect(errors).toEqual([]);
});

test('ideas read off the page: counter, close, send; one click wires them, and they work in Play; random and class nodes run', async ({page}) => {
  const errors = await boot(page);
  // INVARIANT: a blank page, so the sample content's own neighbours don't compete with these.
  await page.evaluate(async () => { await window.__pixiwyg.newProject('Ideas', false, {type: 'web'}); });
  const ids = await page.evaluate(() => {
    const P = window.__pixiwyg, S = P.state(), mk = o => { const el = {id: 'i' + Math.random().toString(36).slice(2, 7), z: S.els.length + 1, fileId: null, selector: null, ...o}; S.els.push(el); return el.id; };
    const r = {plus: mk({tag: 'button', content: '+', x: 100, y: 100}), num: mk({tag: 'p', content: '0', x: 160, y: 100, w: 60}),
      win: mk({tag: 'div', content: 'A window', x: 400, y: 100, w: 300}), close: mk({tag: 'button', content: '×', x: 660, y: 104}),
      field: mk({tag: 'input', x: 100, y: 400, w: 200}), send: mk({tag: 'button', content: 'Send', x: 320, y: 400}), out: mk({tag: 'p', content: 'Nothing yet', x: 100, y: 460, w: 300}),
      dice: mk({tag: 'button', content: 'Roll', x: 600, y: 400}), face: mk({tag: 'p', content: '?', x: 680, y: 400, w: 60})};
    P.renderAll(); return r;
  });
  const keys = await page.evaluate(() => window.__pixiwyg.suggestInteractions().map(i => i.key).sort());
  expect(keys).toEqual(expect.arrayContaining(['close', 'copy', 'count', 'dice']));
  // RULE: the Inspector offers the selected element's ideas; clicking one wires it.
  await page.evaluate(id => window.__pixiwyg.select(id), ids.plus);
  await page.locator('#ins .ideabar button', {hasText: 'Count up'}).click();
  await page.evaluate(() => { const P = window.__pixiwyg; for (const it of P.suggestInteractions()) P.applyIdea(it); });
  expect(await page.evaluate(() => window.__pixiwyg.validateLogic())).toEqual([]);
  expect(await page.evaluate(() => window.__pixiwyg.suggestInteractions().length)).toBe(0);
  await page.click('#playBtn');
  const tap = id => page.evaluate(id => window.__pixiwyg.hostOf(id).shadowRoot.querySelector('button').click(), id);
  const text = id => page.evaluate(id => window.__pixiwyg.hostOf(id).shadowRoot.textContent.trim(), id);
  await tap(ids.plus); await tap(ids.plus);
  expect(await text(ids.num)).toBe('2');
  await tap(ids.close);
  expect(await page.evaluate(id => window.__pixiwyg.hostOf(id).style.visibility, ids.win)).toBe('hidden');
  await page.evaluate(id => { const i = window.__pixiwyg.hostOf(id).shadowRoot.querySelector('input'); i.value = 'hello zine'; }, ids.field);
  await tap(ids.send);
  expect(await text(ids.out)).toBe('hello zine');
  await tap(ids.dice);
  expect(['1', '2', '3', '4', '5', '6']).toContain(await text(ids.face));
  await page.keyboard.press('Escape');
  // RULE: the class node adds and removes a class on the element in Play.
  const cls = await page.evaluate(id => { const P = window.__pixiwyg, L = P.state().logic; L.nodes.push({id: 'c1', type: 'click', x: 0, y: 0, f: {el: id}}, {id: 'c2', type: 'cls', x: 0, y: 0, f: {el: id, mode: 'toggle', name: 'lit'}});
    L.wires.push({a: 'c1', ap: 'fire', b: 'c2', bp: 'in'}); P.setPlay(true); P.hostOf(id).shadowRoot.querySelector('button').click(); const on = P.hostOf(id).shadowRoot.querySelector('button').classList.contains('lit'); P.setPlay(false); return on; }, ids.dice);
  expect(cls).toBe(true);
  expect(errors).toEqual([]);
});

// SECTION: animation driven by notes and songs
test('RULE: notes drive animations: a held key plays to B and back, a hit plays it whole, and the filter picks the notes', async ({page}) => {
  const errors = await boot(page);
  const r = await page.evaluate(async () => {
    const P = window.__pixiwyg, host = document.createElement('div'); document.body.append(host);
    const spec = o => ({trigger: 'note', dur: 400, delay: 0, ease: 'linear', keys: [], repeat: 'once', alt: false, from: 'A', b: {x: 50, y: 0, rot: 0, scale: 100, op: 100}, song: '', note: o});
    let send = null; const env = o => ({el: () => ({host, target: null}), animate() {}, listen: cb => { send = cb; return () => {}; }, ...o});
    const st = () => { const a = host.getAnimations()[0]; return a ? [a.playState, a.playbackRate] : null; };
    let run = P.pxRuntime({nodes: [], wires: []}, [{ref: 'a', spec: spec({from: 'any', notes: 'C4 kick F#3-G3', track: '', hold: true, sound: false})}], env({}));
    const out = {};
    send({on: true, p: 62, v: 90, src: 'keyboard'}); out.miss = st();
    send({on: true, p: 60, v: 90, src: 'keyboard'}); out.down = st();
    send({on: false, p: 60, v: 0, src: 'keyboard'}); out.up = st();
    send({on: true, p: 36, v: 90, src: 'keyboard'}); out.kick = st()[1];
    send({on: true, p: 55, v: 90, src: 'keyboard'}); out.range = st()[1];
    run.stop();
    run = P.pxRuntime({nodes: [], wires: []}, [{ref: 'a', spec: spec({from: 'keyboard', notes: '', hold: false, sound: false})}], env({}));
    send({on: true, p: 70, v: 90, src: 'keyboard'}); const a = host.getAnimations()[0]; a.currentTime = 300;
    send({on: true, p: 71, v: 90, src: 'keyboard'}); out.hit = [Math.round(a.currentTime), a.playbackRate];
    send({on: false, p: 71, v: 0, src: 'keyboard'}); out.hitUp = a.playbackRate;
    a.currentTime = 300; send({on: true, p: 60, v: 90, src: 'song'}); out.fromKeys = Math.round(a.currentTime) !== 300;
    run.stop();
    // RULE: the logic node hands on which note and how hard.
    const G = {nodes: [{id: 'n', type: 'note', f: {from: 'any', notes: 'kick', track: '', sound: true}}, {id: 's', type: 'setText', f: {el: 'x'}}, {id: 'v', type: 'setText', f: {el: 'y'}}],
      wires: [{a: 'n', ap: 'fire', b: 's', bp: 'in'}, {a: 'n', ap: 'pitch', b: 's', bp: 'value'}, {a: 'n', ap: 'off', b: 'v', bp: 'in'}, {a: 'n', ap: 'vel', b: 'v', bp: 'value'}]};
    const tx = document.createElement('p'), ty = document.createElement('p'); let sounded = 0;
    run = P.pxRuntime(G, [], {el: r => ({host: r === 'x' ? tx : ty, target: r === 'x' ? tx : ty}), animate() {}, listen: cb => { send = cb; return () => {}; }, sound: () => sounded++});
    send({on: true, p: 36, v: 77, src: 'keyboard'}); send({on: false, p: 36, v: 0, src: 'keyboard'}); send({on: true, p: 37, v: 77, src: 'keyboard'});
    out.logic = [tx.textContent, ty.textContent, sounded];
    run.stop(); host.remove(); return out;
  });
  expect(r).toEqual({miss: ['paused', 1], down: ['running', 1], up: ['running', -1], kick: 1, range: 1, hit: [0, 1], hitUp: 1, fromKeys: false, logic: ['C2', '0', 1]});
  expect(errors).toEqual([]);
});

test('INVARIANT: song notes and song animations follow the song clock: on time, released on a loop, never drifting', async ({page}) => {
  const errors = await boot(page);
  const r = await page.evaluate(async () => {
    const P = window.__pixiwyg, a = document.createElement('div'), b = document.createElement('div'); document.body.append(a, b);
    const spec = (trigger, o) => ({trigger, dur: 2000, delay: 500, ease: 'linear', keys: [], repeat: 'once', alt: false, from: 'A', b: {x: 100, y: 0, rot: 0, scale: 100, op: 100}, ...o});
    const notes = P.pxSongNotes({bpm: 120, tracks: [{name: 'Drums', mute: false, notes: [{t: 480, d: 240, p: 36, v: 100}]}, {name: 'Muted', mute: true, notes: [{t: 0, d: 480, p: 60, v: 100}]}]});
    let t = null, f = null; const step = x => { t = x; const g = f; f = null; g(); };
    const run = P.pxRuntime({nodes: [], wires: []}, [{ref: 'a', spec: spec('song', {song: 0})}, {ref: 'b', spec: spec('note', {song: '', note: {from: 'song', notes: 'kick', track: 'drums', hold: true}})}],
      {el: r => ({host: r === 'a' ? a : b, target: null}), animate() {}, clock: () => t == null ? null : {song: 0, t}, notes: () => notes, raf: g => { f = g; return 1; }, caf() {}});
    const rate = () => { const x = b.getAnimations()[0]; return x.playState === 'paused' ? 0 : x.playbackRate; }, out = {notes: notes.map(n => [n.t, n.d, n.p, n.track])};
    step(0); step(.4); out.before = rate(); step(.55); out.on = rate(); step(.8); out.off = rate();
    step(1.25); out.songAt = Math.round(a.getAnimations()[0].currentTime);
    step(.1); step(.55); out.again = rate(); step(.2); out.loopReleased = rate();
    step(null); step(null); out.stoppedAt = Math.round(a.getAnimations()[0].currentTime);
    run.stop(); a.remove(); b.remove(); return out;
  });
  expect(r).toEqual({notes: [[.5, .25, 36, 'Drums']], before: 0, on: 1, off: -1, songAt: 1250, again: 1, loopReleased: -1, stoppedAt: 200});
  expect(errors).toEqual([]);
});

test('RULE: an animation counted in beats follows its song\'s tempo; the timeline plays along in bars and snaps to beats', async ({page}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1400, height: 900});
  const r = await page.evaluate(async () => {
    const P = window.__pixiwyg; await P.newProject('beats', true, {type: 'web'}); const S = P.state();
    const m = P.newSong('Beat', {bpm: 120, beats: 4, res: 4, bars: 2, tracks: [{id: 't1', name: 'Drums', drums: true, prog: 0, vol: 100, mute: false, notes: [{t: 0, d: 120, p: 36, v: 100}]}]});
    const el = {id: 'k', tag: 'p', content: 'beat', x: 100, y: 100, w: 120, z: 1, fileId: null, selector: null, anim: P.defaultAnimGraph()};
    const tr = el.anim.nodes.find(n => n.type === 'transition'); Object.assign(tr.f, {unit: 'beats', tempo: m.id, dur: 2, delay: 1});
    S.els.push(el); P.renderAll();
    const at120 = P.animSpec(el.anim); m.bpm = 60; const at60 = P.animSpec(el.anim); m.bpm = 120;
    P.setWorkspace('animate'); P.tlRender();
    const labels = [...document.querySelectorAll('#tlRuler .tltick.major')].map(x => x.textContent);
    return {at120: [at120.dur, at120.delay, at120.beatMs], at60: [at60.dur, at60.delay], song: document.getElementById('tlSong').value === m.id, labels, bar: document.querySelector('#tlRows .tlbar span').textContent};
  });
  expect(r).toMatchObject({at120: [1000, 500, 500], at60: [2000, 1000], song: true, bar: '2 beats'});
  expect(r.labels.slice(0, 3)).toEqual(['1', '2', '3']);
  // RULE: dragging snaps to whole beats, and an animation counted in beats keeps beats.
  const bar = page.locator('#tlRows .tlbar:not(.ghost)').first(), bb = await bar.boundingBox(), pps = await page.evaluate(() => window.__pixiwyg.TL.pps);
  await page.mouse.move(bb.x + 10, bb.y + bb.height / 2); await page.mouse.down();
  await page.mouse.move(bb.x + 10 + pps * 0.6, bb.y + bb.height / 2, {steps: 4}); await page.mouse.up();
  expect(await page.evaluate(() => window.__pixiwyg.state().els.find(e => e.id === 'k').anim.nodes.find(n => n.type === 'transition').f.delay)).toBe(2);
  const moved = await page.evaluate(async () => {
    const P = window.__pixiwyg; P.tlPlay(); await new Promise(res => setTimeout(res, 400));
    const out = {audio: !!P.TL.audio, t: P.TL.t, label: document.getElementById('tlTime').textContent}; P.tlStop(); return {...out, stopped: !P.TL.audio};
  });
  expect(moved.audio).toBe(true); expect(moved.stopped).toBe(true);
  expect(moved.t).toBeGreaterThan(.1); expect(moved.label).toMatch(/^bar 1 · beat [12]$/);
  expect(errors).toEqual([]);
});

test('RULE: the trigger shows note and song options only for those triggers; a keyboard note animates in Play and in the export', async ({page, context}) => {
  const errors = await boot(page);
  await page.setViewportSize({width: 1600, height: 950});
  await page.evaluate(async () => {
    const P = window.__pixiwyg; await P.newProject('keys', true, {type: 'web'}); const S = P.state();
    S.els.push({id: 'k', tag: 'p', content: 'shout', x: 100, y: 100, w: 120, z: 1, fileId: null, selector: null}); P.renderAll(); P.select('k');
    P.openAnimEditor(S.els.find(e => e.id === 'k'));
  });
  const trig = page.locator('#nodeLayer .nnode', {hasText: 'Trigger'});
  await expect(trig.getByLabel('Notes (empty: any)')).toHaveCount(0);
  await trig.getByLabel('Starts on').selectOption('note');
  await expect(trig.getByLabel('Notes (empty: any)')).toBeVisible();
  await trig.getByLabel('Notes (empty: any)').fill('C4');
  await expect(trig.getByLabel('Song', {exact: true})).toHaveCount(0);
  await page.keyboard.press('Escape');
  const play = await page.evaluate(async () => {
    const P = window.__pixiwyg; P.setPlay(true); await new Promise(r => setTimeout(r, 50));
    const st = () => { const a = P.hostOf('k').getAnimations()[0]; return a.playState === 'paused' ? 0 : a.playbackRate; };
    const key = (type, key) => window.dispatchEvent(new KeyboardEvent(type, {key, bubbles: true}));
    const out = [st()]; key('keydown', 's'); out.push(st()); key('keydown', 'a'); out.push(st()); key('keyup', 'a'); out.push(st());
    P.setPlay(false); return out;
  });
  expect(play).toEqual([0, 0, 1, -1]);
  const html = await page.evaluate(() => { const P = window.__pixiwyg; P.expOpt.nojs = false; return P.buildExport(); });
  expect(html).toContain('window.__pxLive');
  const ex = await context.newPage(); const exErrors = []; ex.on('pageerror', e => exErrors.push(e.message));
  await ex.setContent(html); await ex.waitForTimeout(100);
  const exp = await ex.evaluate(() => { const h = [...document.querySelectorAll('.el')].find(x => x.shadowRoot && x.shadowRoot.textContent.includes('shout')), st = () => { const a = h.getAnimations()[0]; return a.playState === 'paused' ? 0 : a.playbackRate; };
    const out = [st()]; window.dispatchEvent(new KeyboardEvent('keydown', {key: 'a'})); out.push(st()); window.dispatchEvent(new KeyboardEvent('keyup', {key: 'a'})); out.push(st()); return out; });
  expect(exp).toEqual([0, 1, -1]); expect(exErrors).toEqual([]);
  expect(errors).toEqual([]);
});

test('RULE: a flipbook going with the song shows one frame per so many beats, in Play and in the export', async ({page}) => {
  const errors = await boot(page);
  const r = await page.evaluate(async () => {
    const P = window.__pixiwyg; await P.newProject('flip', true, {type: 'web'}); const S = P.state();
    const frame = c => { const k = document.createElement('canvas'); k.width = k.height = 8; const g = k.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 8, 8); return k.toDataURL('image/png'); };
    const apng = P.encodeAPNG(['#f00', '#0f0', '#00f'].map(frame), 8), m = P.newSong('Beat', {bpm: 120, beats: 4, res: 4, bars: 1, tracks: []});
    const g = P.defaultAnimGraph(); Object.assign(g.nodes.find(n => n.type === 'trigger').f, {on: 'song', song: m.id, beats: 2}); g.nodes.find(n => n.type === 'stateB').f.scale = 100;
    S.els.push({id: 'fb', tag: 'img', content: apng, attrs: {alt: 'Animation'}, x: 50, y: 50, w: 80, z: 9, fileId: null, selector: null, anim: g}); P.renderAll();
    const spec = P.animSpec(g), html = await (async () => { P.expOpt.nojs = false; return P.buildExport(); })();
    const fr = (await P.decodeAPNG(apng)).frames;
    let t = 0, f = null; const img = P.hostOf('fb')._target, frames = new Map([['fb', fr]]);
    const run = P.pxRuntime({nodes: [], wires: []}, [{ref: 'fb', spec}], {el: () => ({host: P.hostOf('fb'), target: img}), animate() {}, clock: () => ({song: m.id, t}), notes: () => [], frames: r => frames.get(r), raf: g => { f = g; return 1; }, caf() {}});
    const at = x => { t = x; const g2 = f; f = null; g2(); return fr.indexOf(img.src); };
    const seen = [at(0), at(.9), at(1.1), at(2.2), at(3.1)]; run.stop();
    return {frameMs: spec.frameMs, seen, restored: img.src === apng, embedded: html.includes('window.__pxFrames') && html.includes(fr[1])};
  });
  expect(r).toEqual({frameMs: 1000, seen: [0, 0, 1, 2, 0], restored: true, embedded: true});
  expect(errors).toEqual([]);
});

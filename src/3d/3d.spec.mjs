// SECTION: 3D models: parsers, bakes, the workspace, textures, primitives, drag to turn
import {test, expect, boot, ws, T, freshPage} from '../../tools/tests/helpers.mjs';

const CUBE_OBJ = 'v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nv 0 0 1\nv 1 0 1\nv 1 1 1\nv 0 1 1\nf 1 2 3 4\nf 5 8 7 6\nf 1 5 6 2\nf 2 6 7 3\nf 3 7 8 4\nf 5 1 4 8\n';
const stlOf = tris => { const b = Buffer.alloc(84 + tris.length * 50); b.writeUInt32LE(tris.length, 80);
  tris.forEach((t, i) => t.flat().forEach((v, k) => b.writeFloatLE(v, 84 + i * 50 + 12 + k * 4))); return b; };
test('3D: OBJ and STL parse; limits hold; a bake is one atlas of every angle, transparent around the model', async ({page}) => {
  const errors = await freshPage(page);
  const stl = [...stlOf([[[0, 0, 0], [1, 0, 0], [0, 1, 0]], [[0, 0, 0], [0, 1, 0], [0, 0, 1]]])];
  const r = await T(page, async ([obj, stl]) => {
    const P = window.__pixiwyg, cube = P.parseOBJ(obj), s = P.parseSTL(new Uint8Array(stl));
    const neg = P.parseOBJ('v 0 0 0\nv 1 0 0\nv 0 1 0\nf -3 -2 -1\n');
    let tooMany = ''; try { P.parseOBJ('v 0 0 0\nv 1 0 0\nv 0 1 0\n' + 'f 1 2 3\n'.repeat(20001)); } catch (e) { tooMany = e.message; }
    let empty = ''; try { P.parseOBJ('v 0 0 0\n'); } catch (e) { empty = e.message; }
    const b = await P.m3dBake(cube, {az: 8, rows: 2, cell: 64, color: '#ff0000', up: 'z', flat: true});
    const img = new Image(); img.src = b.atlas; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const a = (x, y) => g.getImageData(x, y, 1, 1).data;
    return {tris: cube.tri.length / 3, stl: s.tri.length / 3, neg: [...neg.tri], tooMany, empty, w: img.width, h: img.height, cols: b.cols, rows: b.rows,
      corner: a(1, 1)[3], centre: a(32, 32), centre2: a(7 * 64 + 32, 64 + 32)[3], normals: b.normals.startsWith('data:image/png')};
  }, [CUBE_OBJ, stl]);
  expect(r).toMatchObject({tris: 12, stl: 2, neg: [0, 1, 2], w: 512, h: 128, cols: 8, rows: 2, corner: 0, centre2: 255, normals: true});
  expect(r.tooMany).toContain('limit is 20,000');
  expect(r.empty).toContain('No faces');
  expect(r.centre[3]).toBe(255);
  expect(r.centre[0]).toBeGreaterThan(r.centre[1] + 40);
  expect(errors).toEqual([]);
});

test('3D: the workspace bakes the sample, places a sprite that shows one cell, spins without script, round-trips and exports', async ({page}) => {
  const errors = await freshPage(page);
  await page.keyboard.press('Alt+6');
  await expect(page.locator('#m3dModal')).toBeVisible();
  await page.click('#m3dSampleBtn');
  await expect(page.locator('#m3dInfo')).toContainText('16 angles × 2 heights');
  await page.check('#m3dSpin');
  await page.click('#m3dPlace');
  const r = await T(page, async () => {
    const P = window.__pixiwyg, el = P.state().els.at(-1), t = P.hostOf(el.id).shadowRoot.querySelector('.px3d'), cs0 = getComputedStyle(t);
    const cs = {backgroundSize: cs0.backgroundSize, animationName: cs0.animationName, backgroundImage: cs0.backgroundImage}, box = t.getBoundingClientRect();
    const f1 = P.packProject(), man = JSON.parse(typeof f1.get('manifest.json') === 'string' ? f1.get('manifest.json') : new TextDecoder().decode(f1.get('manifest.json')));
    const assets = man.assets.map(a => a.type).sort(), k = P.filesKey(f1);
    await P.openFiles(new Map(await P.unzip(P.zipFiles(P.sortEntries(f1)))), {});
    const same = P.filesKey(P.packProject()) === k, html = await P.buildExport();
    return {sel: el.selector, w: box.width, h: box.height, size: cs.backgroundSize, anim: cs.animationName,
      img: cs.backgroundImage.startsWith('url("data:image/png'), assets, same, src: /data-px3d-src/.test(html), kf: /@keyframes px3d-spin/.test(html), atlas: /data:image\/png;base64/.test(html)};
  });
  expect(r).toMatchObject({sel: 'div.px3d', size: '1600% 200%', anim: 'px3d-spin', img: true, same: true, src: false, kf: true, atlas: true});
  expect(Math.abs(r.w - r.h)).toBeLessThan(1);
  expect(r.assets).toEqual(expect.arrayContaining(['image/png', 'model/obj']));
  await page.keyboard.press('Alt+1');
  await T(page, () => { const P = window.__pixiwyg; P.select(P.state().els.at(-1).id); });
  await page.keyboard.press('Alt+6');
  await expect(page.locator('#m3dUpdate')).toBeVisible();
  await page.selectOption('#m3dAz', '8');
  await expect(page.locator('#m3dInfo')).toContainText('8 angles');
  await page.click('#m3dUpdate');
  expect(await T(page, () => getComputedStyle(window.__pixiwyg.hostOf(window.__pixiwyg.state().els.at(-1).id).shadowRoot.querySelector('.px3d')).backgroundSize)).toBe('800% 200%');
  await page.keyboard.press('Escape');
  expect(await T(page, () => window.__pixiwyg.ws())).toBe('page');
  expect(errors).toEqual([]);
});

test('3D: OBJ UVs per corner, box UVs when absent, and a texture colours the bake (transparent paint shows the base colour)', async ({page}) => {
  const errors = await freshPage(page);
  const r = await T(page, async obj => {
    const P = window.__pixiwyg;
    const withUV = P.parseOBJ('v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nf 1/1 2/2 3/3 4/4\n');
    const cube = P.parseOBJ(obj), box = P.m3dBoxUV(cube);
    const solid = c => { const k = document.createElement('canvas'); k.width = k.height = 16; const g = k.getContext('2d'); if (c) { g.fillStyle = c; g.fillRect(0, 0, 16, 16); } return k.toDataURL(); };
    const texOf = async url => { const i = new Image(); i.src = url; await i.decode(); const k = document.createElement('canvas'); k.width = k.height = 16; const g = k.getContext('2d'); g.drawImage(i, 0, 0); return {w: 16, h: 16, d: g.getImageData(0, 0, 16, 16).data}; };
    const px = async b => { const i = new Image(); i.src = b.atlas; await i.decode(); const k = document.createElement('canvas'); k.width = i.width; k.height = i.height; const g = k.getContext('2d'); g.drawImage(i, 0, 0); return [...g.getImageData(32, 32, 1, 1).data]; };
    const opt = {az: 8, rows: 1, cell: 64, color: '#ff0000', up: 'z', flat: true};
    const blue = await px(await P.m3dBake(cube, opt, null, await texOf(solid('#0000ff'))));
    const clear = await px(await P.m3dBake(cube, opt, null, await texOf(solid(null))));
    return {uv: withUV.uv && [...withUV.uv], boxLen: box.length, boxIn: box.every(v => v >= 0 && v <= 1), blue, clear, guide: P.m3dGuide(cube, opt, 64, 64).startsWith('data:image/png')};
  }, CUBE_OBJ);
  expect(r.uv).toEqual([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]);
  expect(r.boxLen).toBe(12 * 6);
  expect(r.boxIn).toBe(true);
  expect(r.blue[2]).toBeGreaterThan(r.blue[0] + 40);
  expect(r.clear[0]).toBeGreaterThan(r.clear[2] + 40);
  expect(r.guide).toBe(true);
  expect(errors).toEqual([]);
});

test('3D: Paint Studio paints the texture over a UV guide; Update re-bakes and updates the placed model; export drops the sources', async ({page}) => {
  const errors = await freshPage(page);
  await page.keyboard.press('Alt+6');
  await page.click('#m3dSampleBtn');
  await expect(page.locator('#m3dInfo')).toContainText('angles');
  await page.click('#m3dPlace');
  const before = await T(page, () => window.__pixiwyg.m3d().bake.atlas);
  await page.click('#m3dPaint');
  await expect.poll(() => T(page, () => window.__pixiwyg.ws())).toBe('paint');
  await expect(page.locator('#sUpdate')).toHaveText('Update the 3D texture');
  expect(await T(page, () => { const c = document.getElementById('sguide'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; })).toBe(true);
  await T(page, () => { const c = document.getElementById('paint'), g = c.getContext('2d'); g.fillStyle = '#00ff00'; g.fillRect(0, 0, c.width, c.height); });
  await page.click('#sUpdate');
  await expect.poll(() => T(page, () => { const m = window.__pixiwyg.m3d(); return !!m.tex && m.bake.atlas; })).not.toBe(before);
  const r = await T(page, async () => { const P = window.__pixiwyg, el = P.state().els.at(-1), html = await P.buildExport();
    return {tex: (el.attrs['data-px3d-tex'] || '').startsWith('data:image/png'), exportTex: /data-px3d-tex|data-px3d-src/.test(html)}; });
  expect(r).toEqual({tex: true, exportTex: false});
  // RULE: the guide belongs to the texture: opening any other image in Paint drops it.
  // INVARIANT: New on a painted canvas asks first; the second click confirms.
  await T(page, () => { document.getElementById('sNew').click(); document.getElementById('sNew').click(); });
  expect(await T(page, () => { const P = window.__pixiwyg, c = document.getElementById('sguide'), d = c.getContext('2d').getImageData(0, 0, c.width || 1, c.height || 1).data; return !P.studio.guide && !d.some((v, i) => i % 4 === 3 && v); })).toBe(true);
  expect(errors).toEqual([]);
});

test('3D: save as a baked sprite primitive or an unbaked model primitive; both survive export/import and place on the page', async ({page}) => {
  const errors = await freshPage(page);
  await page.keyboard.press('Alt+6');
  await page.click('#m3dSampleBtn');
  await expect(page.locator('#m3dInfo')).toContainText('angles');
  await page.click('#m3dPrimBaked');
  await page.click('#m3dPrimModel');
  const r = await T(page, async () => {
    const P = window.__pixiwyg, [model, sprite] = P.prims.list;
    const json = JSON.stringify({type: 'pixiwyg-primitives', version: 1, primitives: [model, sprite].map(({name, kind, data}) => ({name, kind, data}))});
    P.prims.list.splice(0, 2); const n = P.importPrimText(json, {quiet: true});
    const m2 = P.prims.list.find(p => p.kind === 'model'), s2 = P.prims.list.find(p => p.kind === 'element' && p.data.el.tag === 'div' && /px3d/.test(p.data.style && p.data.style.selector)); P.setWorkspace('page');
    const k0 = P.state().els.length;
    await P.usePrim(s2, {x: 50, y: 50}); const se = P.state().els.at(-1);
    await P.usePrim(m2, {x: 300, y: 50}); const me = P.state().els.at(-1);
    return {kinds: [model.kind, sprite.kind], n, spriteSrc: 'data-px3d-src' in sprite.data.el.attrs, thumb: !!model.data.thumb,
      placed: P.state().els.length - k0, se: se.selector, seAtlas: /data:image\/png/.test(se.attrs.style), me: me.selector, meSrc: (me.attrs['data-px3d-src'] || '').slice(0, 15)};
  });
  expect(r).toEqual({kinds: ['model', 'element'], n: 2, spriteSrc: false, thumb: true, placed: 2, se: 'div.px3d', seAtlas: true, me: 'div.px3d', meSrc: 'data:model/obj;'});
  expect(errors).toEqual([]);
});

// INVARIANT: a real GLB built byte by byte: one red quad (indexed, moved by its node) and one textured quad.
const PNG_1PX_BLUE = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
function makeGLB({extraRequired = []} = {}) {
  const f32 = a => Buffer.from(new Float32Array(a).buffer), u16 = a => Buffer.from(new Uint16Array(a).buffer);
  const pad = b => Buffer.concat([b, Buffer.alloc((4 - b.length % 4) % 4)]);
  const parts = [f32([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), u16([0, 1, 2, 0, 2, 3]), f32([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), f32([0, 0, 1, 0, 1, 1, 0, 1]), PNG_1PX_BLUE].map(pad);
  let off = 0; const views = parts.map(p => { const v = {buffer: 0, byteOffset: off, byteLength: p.length}; off += p.length; return v; });
  const bin = Buffer.concat(parts);
  const J = {asset: {version: '2.0'}, scene: 0, scenes: [{nodes: [0, 1]}], nodes: [{mesh: 0, translation: [5, 0, 0], scale: [2, 2, 2]}, {mesh: 1}],
    meshes: [{primitives: [{attributes: {POSITION: 0}, indices: 1, material: 0}]}, {primitives: [{attributes: {POSITION: 2, TEXCOORD_0: 3}, indices: 1, material: 1}]}],
    materials: [{pbrMetallicRoughness: {baseColorFactor: [1, 0, 0, 1]}}, {pbrMetallicRoughness: {baseColorTexture: {index: 0}}}],
    textures: [{source: 0}], images: [{bufferView: 4, mimeType: 'image/png'}],
    accessors: [{bufferView: 0, componentType: 5126, count: 4, type: 'VEC3'}, {bufferView: 1, componentType: 5123, count: 6, type: 'SCALAR'},
      {bufferView: 2, componentType: 5126, count: 4, type: 'VEC3'}, {bufferView: 3, componentType: 5126, count: 4, type: 'VEC2'}],
    bufferViews: views, buffers: [{byteLength: bin.length}], ...(extraRequired.length ? {extensionsRequired: extraRequired} : {})};
  const js = Buffer.from(JSON.stringify(J)), jsp = Buffer.concat([js, Buffer.alloc((4 - js.length % 4) % 4, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546C67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jsp.length + 8 + bin.length, 8);
  const ch = (type, body) => { const h = Buffer.alloc(8); h.writeUInt32LE(body.length, 0); h.writeUInt32LE(type, 4); return Buffer.concat([h, body]); };
  return {glb: Buffer.concat([head, ch(0x4E4F534A, jsp), ch(0x004E4942, bin)]), json: J, bin};
}
test('3D: glTF and GLB: transforms, indices, material colour, embedded texture with UVs; compressed files are refused; a .gltf takes its .bin when picked together', async ({page}) => {
  const errors = await freshPage(page);
  const {glb, json, bin} = makeGLB(), gltf = JSON.stringify({...json, buffers: [{byteLength: bin.length, uri: 'data:application/octet-stream;base64,' + bin.toString('base64')}]});
  const ext = JSON.stringify({...json, buffers: [{byteLength: bin.length, uri: 'scene.bin'}]}), draco = makeGLB({extraRequired: ['KHR_draco_mesh_compression']}).glb;
  const r = await T(page, ([glb, gltf, ext, draco]) => {
    const P = window.__pixiwyg, enc = s => new TextEncoder().encode(s), err = f => { try { f(); return ''; } catch (e) { return e.message; } };
    const m = P.parseGLTF(new Uint8Array(glb)), g = P.parseGLTF(enc(gltf));
    return {tris: m.tri.length / 3, x: [...m.pos].filter((_, i) => i % 3 === 0).slice(0, 4), red: [...m.col.slice(0, 3)], mask: [...m.texMask], tex: (m.texture || '').slice(0, 22),
      uvFlip: [...m.uv.slice(6 * 2, 6 * 2 + 2)], same: g.tri.length === m.tri.length && !!g.texture,
      ext: err(() => P.parseGLTF(enc(ext))), draco: err(() => P.parseGLTF(new Uint8Array(draco)))};
  }, [[...glb], gltf, ext, [...draco]]);
  expect(r).toMatchObject({tris: 4, x: [5, 7, 7, 5], red: [1, 0, 0], mask: [0, 0, 1, 1], tex: 'data:image/png;base64,', uvFlip: [0, 1], same: true});
  expect(r.ext).toContain('scene.bin');
  expect(r.draco).toContain('compressed');
  // RULE: through the workspace the texture comes along and the source is stored as GLB.
  await page.keyboard.press('Alt+6');
  await page.setInputFiles('#m3dFile', {name: 'thing.glb', mimeType: 'model/gltf-binary', buffer: glb});
  await expect(page.locator('#m3dInfo')).toContainText('4 triangles');
  expect(await T(page, () => { const m = window.__pixiwyg.m3d(); return [m.src.slice(0, 26), !!m.tex, m.opt.up]; })).toEqual(['data:model/gltf-binary;bas', true, 'y']);
  // RULE: a .gltf alone says which file it needs; picked with its .bin it opens, stored as one self-contained file.
  await page.setInputFiles('#m3dFile', {name: 'scene.gltf', mimeType: 'model/gltf+json', buffer: Buffer.from(ext)});
  await expect(page.locator('#status')).toContainText('scene.bin');
  await page.setInputFiles('#m3dFile', [{name: 'scene.gltf', mimeType: 'model/gltf+json', buffer: Buffer.from(ext)}, {name: 'scene.bin', mimeType: 'application/octet-stream', buffer: bin}]);
  await expect(page.locator('#m3dInfo')).toContainText('4 triangles');
  expect(await T(page, () => { const m = window.__pixiwyg.m3d(), j = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(m.src.split(',')[1]), c => c.charCodeAt(0)))); return [m.name, j.buffers[0].uri.slice(0, 5), !!m.tex]; }))
    .toEqual(['scene', 'data:', true]);
  expect(errors).toEqual([]);
});

test('3D: OBJ with its MTL and texture picked together: per-face colours, map_Kd matched by name, MTL kept inside the stored OBJ', async ({page}) => {
  const errors = await freshPage(page);
  const obj = 'mtllib thing.mtl\nv 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nv 0 0 1\nvt 0 0\nvt 1 0\nvt 1 1\nvt 0 1\nusemtl Red\nf 1/1 2/2 3/3\nusemtl Skin\nf 1/1 3/3 4/4\nusemtl Green\nf 1/1 2/2 5/1\n';
  const mtl = 'newmtl Red\nKd 1 0 0\nnewmtl Green\nKd 0 1 0\nnewmtl Skin\nKd 1 1 1\nmap_Kd textures\\skin.png\n';
  await page.keyboard.press('Alt+6');
  await page.setInputFiles('#m3dFile', [{name: 'thing.obj', mimeType: 'model/obj', buffer: Buffer.from(obj)}, {name: 'thing.mtl', mimeType: 'text/plain', buffer: Buffer.from(mtl)}, {name: 'skin.png', mimeType: 'image/png', buffer: PNG_1PX_BLUE}]);
  await expect(page.locator('#m3dInfo')).toContainText('3 triangles');
  const r = await T(page, () => { const P = window.__pixiwyg, m = P.m3d(), again = P.parseOBJ(new TextDecoder().decode(Uint8Array.from(atob(m.src.split(',')[1]), c => c.charCodeAt(0))));
    return {tex: !!m.tex, mask: [...m.mesh.texMask], cols: [0, 1, 2].map(t => [...m.mesh.col.slice(t * 9, t * 9 + 3)]), againCols: [...again.col.slice(18, 21)], againMask: [...again.texMask]}; });
  expect(r).toEqual({tex: true, mask: [0, 1, 0], cols: [[1, 0, 0], [1, 1, 1], [0, 1, 0]], againCols: [0, 1, 0], againMask: [0, 1, 0]});
  await page.setInputFiles('#m3dFile', [{name: 'thing.obj', mimeType: 'model/obj', buffer: Buffer.from(obj)}, {name: 'thing.mtl', mimeType: 'text/plain', buffer: Buffer.from(mtl)}]);
  await expect(page.locator('#status')).toContainText("skin.png wasn't included");
  expect(errors).toEqual([]);
});

test('3D: drag to turn works in Play and in the exported page, and is left out of script-free exports', async ({page, context}) => {
  const errors = await freshPage(page);
  await page.keyboard.press('Alt+6');
  await page.click('#m3dSampleBtn');
  await expect(page.locator('#m3dInfo')).toContainText('angles');
  await page.check('#m3dDrag');
  await page.click('#m3dPlace');
  await page.keyboard.press('Alt+1');
  const pos = () => T(page, () => { const P = window.__pixiwyg; return getComputedStyle(P.hostOf(P.state().els.at(-1).id).shadowRoot.querySelector('.px3d')).backgroundPositionX; });
  await page.click('#playBtn');
  const box = await T(page, () => { const P = window.__pixiwyg, r = P.hostOf(P.state().els.at(-1).id).shadowRoot.querySelector('.px3d').getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; });
  const p0 = await pos();
  await page.mouse.move(box.x, box.y); await page.mouse.down(); await page.mouse.move(box.x + 60, box.y, {steps: 6}); await page.mouse.up();
  expect(await pos()).not.toBe(p0);
  await page.keyboard.press('Escape');
  const {html, nojs} = await T(page, async () => { const P = window.__pixiwyg, was = P.expOpt.nojs; P.expOpt.nojs = false; const html = await P.buildExport(); P.expOpt.nojs = true; const nojs = await P.buildExport(); P.expOpt.nojs = was; return {html, nojs}; });
  expect(html).toContain('function px3dDrag');
  expect(nojs).not.toContain('px3dDrag');
  const pv = await context.newPage();
  await pv.setContent(html);
  await pv.waitForFunction(() => [...document.querySelectorAll('.el')].some(h => h.shadowRoot && h.shadowRoot.querySelector('.px3d.drag')));
  const t = () => pv.evaluate(() => { const h = [...document.querySelectorAll('.el')].find(h => h.shadowRoot.querySelector('.px3d')), r = h.shadowRoot.querySelector('.px3d'), b = r.getBoundingClientRect(); return {x: b.x + b.width / 2, y: b.y + b.height / 2, p: getComputedStyle(r).backgroundPositionX}; });
  const a = await t();
  await pv.mouse.move(a.x, a.y); await pv.mouse.down(); await pv.mouse.move(a.x - 80, a.y, {steps: 6}); await pv.mouse.up();
  expect((await t()).p).not.toBe(a.p);
  expect(errors).toEqual([]);
});

test('3D: build from shapes: add, cut and keep with csg.js; pick and move in the view; undo; the model stores its parts and opens as parts again', async ({page}) => {
  const errors = await boot(page);
  await page.evaluate(async () => { const P = window.__pixiwyg; await P.newProject('Build', true, {type: 'web'}); P.setWorkspace('model'); });
  await page.click('#m3dNewScene');
  await expect(page.locator('#m3dPartList .m3drow')).toHaveCount(1);
  const tris = () => page.evaluate(() => window.__pixiwyg.state && document.getElementById('m3dInfo').textContent);
  await page.selectOption('#m3dAdd', 'sphere');
  await expect(page.locator('#m3dPartList .m3drow')).toHaveCount(2);
  // RULE: adds alone join without csg.js; the first cut loads it from lib/ and carves.
  expect(await page.evaluate(() => !!window.CSG)).toBe(false);
  await page.check('input[name=m3dOp][value=cut]');
  await page.fill('[data-v="pos.2"]', '18');
  await expect.poll(() => page.evaluate(() => !!window.CSG)).toBe(true);
  await expect(page.locator('#m3dPartList .m3drow.on .m3dop')).toHaveText('− cut');
  await expect.poll(tris).toMatch(/triangles/);
  const carved = await page.evaluate(() => { const P = window.__pixiwyg, sc = P.m3dScene(); return {parts: sc.parts.map(p => p.kind + ':' + p.op), sel: sc.sel}; });
  expect(carved).toEqual({parts: ['box:add', 'sphere:cut'], sel: 1});
  // INVARIANT: a cut leaves the cutter's colour on the faces it carved, and no triangle from the sphere's outside.
  const parts = await page.evaluate(async () => { const P = window.__pixiwyg, m = await P.m3dSceneMesh(P.m3dScene()); return [m.part.filter(i => i === 0).length > 0, m.part.filter(i => i === 1).length > 0]; });
  expect(parts).toEqual([true, true]);
  // RULE: a click in the view picks the part under it; dragging the picked part slides it on the floor; Page Up lifts it by the snap (1 mm = .05 units).
  await page.click('#m3dPartList .m3drow >> nth=0');
  await page.locator('#m3dEdit').scrollIntoViewIfNeeded();
  const vpBox = await page.locator('#m3dEdit').boundingBox();
  await page.mouse.click(vpBox.x + vpBox.width / 2, vpBox.y + vpBox.height * .62);
  expect(await page.evaluate(() => window.__pixiwyg.m3dScene().sel)).toBe(0);
  const x0 = await page.evaluate(() => window.__pixiwyg.m3dScene().parts[0].pos.join());
  await page.mouse.move(vpBox.x + vpBox.width / 2, vpBox.y + vpBox.height * .62); await page.mouse.down();
  await page.mouse.move(vpBox.x + vpBox.width / 2 + 60, vpBox.y + vpBox.height * .62, {steps: 6}); await page.mouse.up();
  const x1 = await page.evaluate(() => window.__pixiwyg.m3dScene().parts[0].pos.join());
  expect(x1).not.toBe(x0);
  await page.keyboard.press('PageUp');
  expect(await page.evaluate(() => +window.__pixiwyg.m3dScene().parts[0].pos[2].toFixed(2))).toBe(+(+x1.split(',')[2] + .05).toFixed(2));
  // RULE: the model's own undo steps back through the edits.
  await page.keyboard.press('Control+z'); await page.keyboard.press('Control+z');
  expect(await page.evaluate(() => window.__pixiwyg.m3dScene().parts[0].pos.join())).toBe(x0);
  // FORMAT: placed, it stores an OBJ with vertex colours and its parts; opening the element brings the parts back.
  await page.click('#m3dPlace');
  await expect.poll(() => page.evaluate(() => window.__pixiwyg.state().els.some(e => e.attrs && e.attrs['data-px3d-src']))).toBe(true);
  const stored = await page.evaluate(async () => { const P = window.__pixiwyg, el = P.state().els.findLast(e => e.attrs && e.attrs['data-px3d-src']), src = el.attrs['data-px3d-src'], text = new TextDecoder().decode(Uint8Array.from(atob(src.split(',')[1]), c => c.charCodeAt(0)));
    return {vc: /^v -?[\d.]+ -?[\d.]+ -?[\d.]+ [\d.]+ [\d.]+ [\d.]+$/m.test(text), scene: /^#px3d-scene /m.test(text), parts: (P.m3dSceneFromSrc(src) || {parts: []}).parts.map(p => p.kind + ':' + p.op)}; });
  expect(stored).toEqual({vc: true, scene: true, parts: ['box:add', 'sphere:cut']});
  await page.evaluate(async () => { const P = window.__pixiwyg; P.m3dStartScene(false); });
  await expect(page.locator('#m3dPartList .m3drow')).toHaveCount(1);
  await page.evaluate(async () => { const P = window.__pixiwyg, el = P.state().els.findLast(e => e.attrs && e.attrs['data-px3d-src']); P.select(el.id); P.openM3d(); });
  await expect(page.locator('#m3dPartList .m3drow')).toHaveCount(2);
  // SAFETY: parts from a file are rebuilt from known kinds and ranges; model geometry that points outside itself is dropped.
  const clean = await page.evaluate(() => { const P = window.__pixiwyg;
    return [P.cleanScene({parts: [{kind: 'script', op: 'add'}]}), P.cleanScene({parts: [{kind: 'box', op: 'zap', size: [-5, 1e9, 1], color: 'red', name: 'x'.repeat(99)}]}).parts[0],
      P.cleanScene({parts: [{kind: 'model', geo: {pos: btoa(String.fromCharCode(...new Uint8Array(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]).buffer))), tri: btoa(String.fromCharCode(...new Uint8Array(new Uint32Array([0, 1, 9]).buffer)))}}]})]; });
  expect(clean[0]).toBeNull();
  expect([clean[1].op, clean[1].size, clean[1].color, clean[1].name.length]).toEqual(['add', [.01, 50, 1], '#c8b89a', 40]);
  expect(clean[2]).toBeNull();
  // RULE: an opened model can become a part to build on.
  await page.click('#m3dSampleBtn');
  await expect(page.locator('#m3dBuildOn')).toBeVisible();
  await page.click('#m3dBuildOn');
  expect(await page.evaluate(() => window.__pixiwyg.m3dScene().parts.map(p => p.kind))).toEqual(['model']);
  expect(errors).toEqual([]);
});

test('3D: handles size and turn the picked part; more shapes; 3D text; groups and multi-select; STL in millimetres', async ({page}) => {
  const errors = await boot(page);
  await page.evaluate(async () => { const P = window.__pixiwyg; await P.newProject('Handles', true, {type: 'web'}); P.setWorkspace('model'); });
  await page.click('#m3dNewScene');
  const sc = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__pixiwyg.m3dScene())));
  // RULE: the top handle sizes the height from the floor up, in snap steps; the ruler reads millimetres.
  await page.locator('#m3dEdit').scrollIntoViewIfNeeded();
  const box = await page.locator('#m3dEdit').boundingBox();
  const hs = await page.evaluate(() => { const vp = window.__pixiwyg.vp(), cv = document.getElementById('m3dEdit'), k = cv.getBoundingClientRect().width / cv.width; return vp.handles.map(h => ({kind: h.kind, a: h.a, side: h.side, x: h.x * k, y: h.y * k})); });
  expect(hs.filter(h => h.kind === 'size').length).toBeGreaterThanOrEqual(3);
  expect(hs.some(h => h.kind === 'lift')).toBe(true);
  const top = hs.find(h => h.kind === 'size' && h.a === 2);
  await page.mouse.move(box.x + top.x, box.y + top.y); await page.mouse.down();
  await page.mouse.move(box.x + top.x, box.y + top.y - 40, {steps: 5}); await page.mouse.up();
  let s = await sc();
  expect(s.parts[0].size[2]).toBeGreaterThan(1);
  expect(+(s.parts[0].pos[2] - s.parts[0].size[2] / 2).toFixed(4)).toBe(0);
  expect(Math.abs(s.parts[0].size[2] * 20 - Math.round(s.parts[0].size[2] * 20))).toBeLessThan(1e-6);
  // RULE: the lift cone raises it.
  const lift = (await page.evaluate(() => { const vp = window.__pixiwyg.vp(), cv = document.getElementById('m3dEdit'), k = cv.getBoundingClientRect().width / cv.width; return vp.handles.filter(h => h.kind === 'lift').map(h => ({x: h.x * k, y: h.y * k})); }))[0];
  const z0 = s.parts[0].pos[2];
  await page.mouse.move(box.x + lift.x, box.y + lift.y); await page.mouse.down();
  await page.mouse.move(box.x + lift.x, box.y + lift.y - 30, {steps: 5}); await page.mouse.up();
  s = await sc();
  expect(s.parts[0].pos[2]).toBeGreaterThan(z0);
  // FORMAT: the fields read millimetres: 1 unit = 20 mm by default.
  await page.fill('[data-v="size.0"]', '30');
  expect((await sc()).parts[0].size[0]).toBeCloseTo(1.5, 5);
  // RULE: the new shapes are closed solids; a tube's hole and a star's points are settable.
  for (const k of ['tube', 'dome', 'star']) await page.selectOption('#m3dAdd', k);
  await expect(page.locator('#m3dPHoleRow')).toBeHidden();
  await expect(page.locator('#m3dPSegLab')).toHaveText('Points');
  await page.locator('#m3dPartList .m3drow >> nth=1').click();
  await expect(page.locator('#m3dPHoleRow')).toBeVisible();
  // RULE: 3D text is filled with earcut, keeps the counters of its letters, and new words keep the height.
  await page.selectOption('#m3dAdd', 'text');
  await expect.poll(() => page.evaluate(() => !!window.earcut)).toBe(true);
  await expect(page.locator('#m3dPTextRow')).toBeVisible();
  const h0 = (await sc()).parts.at(-1).size[1], w0 = (await sc()).parts.at(-1).size[0];
  await page.fill('#m3dPText', 'Hello world');
  await expect.poll(async () => (await sc()).parts.at(-1).size[0]).toBeGreaterThan(w0 * 1.5);
  expect((await sc()).parts.at(-1).size[1]).toBe(h0);
  const closed = await page.evaluate(async () => { const t = await window.__pixiwyg.textSolid('o', 'sans-serif'), e = new Map(), k = v => v.map(n => n.toFixed(5)).join();
    for (const tri of t.tris) for (let i = 0; i < 3; i++) { const a = k(tri[i]), b = k(tri[(i + 1) % 3]); e.set(a + '|' + b, (e.get(a + '|' + b) || 0) + 1); }
    let open = 0; for (const [ab] of e) { const [a, b] = ab.split('|'); if (!e.has(b + '|' + a)) open++; } return {n: t.tris.length, open}; });
  expect(closed.n).toBeGreaterThan(20);
  expect(closed.open).toBe(0);
  // RULE: Shift+click picks several; Group makes them one part; Ungroup puts them back where they were.
  await page.locator('#m3dPartList .m3drow >> nth=1').click();
  await page.locator('#m3dPartList .m3drow >> nth=2').click({modifiers: ['Shift']});
  await expect(page.locator('#m3dPartList .m3drow.on')).toHaveCount(2);
  const before = (await sc()).parts.slice(1, 3).map(p => p.pos);
  await page.click('#m3dGroup');
  s = await sc();
  expect(s.parts.map(p => p.kind)).toEqual(['box', 'group', 'star', 'text']);
  expect(s.parts[1].parts.map(p => p.kind)).toEqual(['tube', 'dome']);
  await page.locator('#m3dEdit').focus(); await page.keyboard.press('ArrowRight');
  expect((await sc()).parts[1].pos[0]).toBeCloseTo(.05, 5);
  await page.click('#m3dUngroup');
  s = await sc();
  expect(s.parts.map(p => p.kind)).toEqual(['box', 'tube', 'dome', 'star', 'text']);
  expect(s.parts.slice(1, 3).map(p => p.pos.map((v, i) => +(v - before[0][i] * 0).toFixed(4)))).toEqual(before.map(p => [+(p[0] + .05).toFixed(4), +p[1].toFixed(4), +p[2].toFixed(4)]));
  expect(s.picked.length).toBe(2);
  // FORMAT: STL is binary, millimetres: 1 unit = 20 mm, so the box's 30 mm width comes out as 30.
  const stl = await page.evaluate(async () => { const P = window.__pixiwyg, s = P.m3dScene(), one = {...s, parts: [s.parts[0]]}, m = await P.m3dSceneMesh(one), b = P.m3dSceneSTL(m, 20), dv = new DataView(b.buffer);
    const n = dv.getUint32(80, true); let lo = 1e9, hi = -1e9; for (let t = 0; t < n; t++) for (let v = 0; v < 3; v++) { const x = dv.getFloat32(84 + t * 50 + 12 + v * 12, true); lo = Math.min(lo, x); hi = Math.max(hi, x); }
    return {n, len: b.length, w: +(hi - lo).toFixed(3)}; });
  expect(stl).toEqual({n: 12, len: 84 + 12 * 50, w: 30});
  // FORMAT: groups and text survive the stored scene.
  const round = await page.evaluate(() => { const P = window.__pixiwyg; return P.cleanScene({parts: [{kind: 'group', parts: [{kind: 'text', text: 'Hi\u0007', font: 'nope'}, {kind: 'tube', hole: 9}]}]}); });
  expect(round.parts[0].parts.map(p => [p.kind, p.text, p.font, p.hole])).toEqual([['text', 'Hi', 'Rubik Mono One', undefined], ['tube', undefined, undefined, .95]]);
  expect(errors).toEqual([]);
});

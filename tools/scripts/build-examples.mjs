// FORMAT: builds examples/*.pixiwyg by driving the real app with the editor's own calls and project writer.
//   Run after app changes the examples should show:  npm run examples
import {chromium} from '@playwright/test';
import {spawn} from 'node:child_process';
import {mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

const ROOT = fileURLToPath(new URL('../..', import.meta.url)), OUT = ROOT + 'examples/', PORT = 4199;
const server = spawn(process.execPath, [fileURLToPath(new URL('serve.mjs', import.meta.url))], {env: {...process.env, PORT: String(PORT)}, stdio: ['ignore', 'pipe', 'inherit']});
await new Promise(r => server.stdout.once('data', r));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({viewport: {width: 1600, height: 1000}});
  page.on('pageerror', e => console.error('page error:', e.message));
  await page.addInitScript(() => { try { localStorage.setItem('pixiwyg.onboarded', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/?test`);
  await page.waitForFunction(() => window.__pixiwyg && !document.getElementById('title').hidden, null, {timeout: 60_000});
  mkdirSync(OUT, {recursive: true});
  const WS = {artist: 'paint', musician: 'music', writer: 'write', animator: 'animate', benchmark: 'page'};
  // FORMAT: npm run examples [-- name ...] builds only the named examples; no names builds them all.
  const only = process.argv.slice(2).filter(a => WS[a]);
  for (const name of only.length ? only : Object.keys(WS)) {
    const bytes = await page.evaluate(async ([name, ws]) => {
      const T = window.__pixiwyg;
      let seed = 1234567; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
      let n = 0, z = 0;
      const E = o => { const el = {id: `x${name}${++n}`, z: ++z, ...o}; T.state().els.push(el); return el; };
      const lib = async f => (await T.addLib(f)).id, sample = f => T.addFile(f, T.SAMPLES[f], true).id;
      const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c.toDataURL('image/png'); };
      const anim = (on, b, tr = {}) => { const g = T.defaultAnimGraph(), N = t => g.nodes.find(x => x.type === t);
        N('trigger').f.on = on; Object.assign(N('stateB').f, {x: 0, y: 0, rot: 0, scale: 100, op: 100, fg: '', bg: ''}, b); Object.assign(N('transition').f, {dur: 400, delay: 0, ease: 'ease', repeat: 'once', alt: false}, tr); return g; };
      const enter = (b, tr) => { const g = anim('load', b, tr), w = g.wires; for (const x of w) { if (x.bp === 'from') x.bp = 'to'; else if (x.bp === 'to') x.bp = 'from'; } return g; };
      // INVARIANT: newProject replaces state.logic, so every lookup reads it fresh.
      const node = (type, f, x, y) => { const L = T.state().logic, nd = {id: 'n' + (L.nodes.length + 1), type, x, y, f}; L.nodes.push(nd); return nd; };
      const wire = (a, ap, b, bp) => T.state().logic.wires.push({a: a.id, ap, b: b.id, bp});
      const doodle = (ctx, x, y, s, col) => { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 4 * Math.PI / 5; ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s); } ctx.closePath(); ctx.stroke(); };

      if (name === 'artist') {
        await T.newProject('Mx. Pigment — portfolio', false, {type: 'web'});
        const R = sample('riso-zine.css'), W98 = await lib('98.css'), X = await lib('xerox.css');
        const blobs = canvas(600, 450, (c, w, h) => { c.fillStyle = '#f4ead5'; c.fillRect(0, 0, w, h);
          for (let i = 0; i < 9; i++) { const g = c.createRadialGradient(0, 0, 4, 0, 0, 130); const col = pick(['#ff4fa3', '#2b2bd9', '#ffd23f', '#ff7a00', '#1d9a5b']);
            g.addColorStop(0, col); g.addColorStop(1, col + '00'); c.save(); c.translate(rnd() * w, rnd() * h); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 130, 0, 7); c.fill(); c.restore(); }
          c.strokeStyle = '#16121f'; c.lineWidth = 14; c.lineCap = 'round'; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(rnd() * w, rnd() * h); c.bezierCurveTo(rnd() * w, rnd() * h, rnd() * w, rnd() * h, rnd() * w, rnd() * h); c.stroke(); }
          c.fillStyle = '#16121f'; for (let i = 0; i < 60; i++) { c.beginPath(); c.arc(rnd() * w, rnd() * h, rnd() * 5 + 1, 0, 7); c.fill(); } });
        const ramen = canvas(600, 450, (c, w, h) => { c.fillStyle = '#d9ecff'; c.fillRect(0, 0, w, h); c.fillStyle = '#c8a26b'; c.fillRect(0, 330, w, 120);
          c.fillStyle = '#e63946'; c.beginPath(); c.ellipse(300, 250, 190, 40, 0, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(110, 250); c.quadraticCurveTo(300, 520, 490, 250); c.fill();
          c.strokeStyle = '#fff'; c.lineWidth = 6; for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(170 + i * 65, 330, 16, 0, Math.PI); c.stroke(); }
          c.fillStyle = '#f2d28b'; c.beginPath(); c.ellipse(300, 248, 170, 30, 0, 0, Math.PI * 2); c.fill();
          c.strokeStyle = '#e0b354'; c.lineWidth = 5; for (let i = 0; i < 9; i++) { c.beginPath(); for (let x = 150; x < 450; x += 6) c.lineTo(x, 240 + Math.sin(x / 9 + i) * 9 + (i - 4) * 3); c.stroke(); }
          c.fillStyle = '#fff'; c.beginPath(); c.ellipse(380, 240, 32, 22, .3, 0, 7); c.fill(); c.fillStyle = '#ffb703'; c.beginPath(); c.arc(384, 240, 13, 0, 7); c.fill();
          c.strokeStyle = '#7f5539'; c.lineWidth = 9; c.beginPath(); c.moveTo(380, 120); c.lineTo(250, 260); c.moveTo(410, 125); c.lineTo(285, 262); c.stroke();
          c.strokeStyle = '#ffffffcc'; c.lineWidth = 4; for (let i = 0; i < 3; i++) { c.beginPath(); for (let y = 200; y > 60; y -= 4) c.lineTo(240 + i * 60 + Math.sin(y / 14) * 10, y); c.stroke(); } });
        const portrait = canvas(450, 600, (c, w, h) => { c.fillStyle = '#ffe9a8'; c.fillRect(0, 0, w, h);
          c.fillStyle = '#f2c4a0'; c.beginPath(); c.ellipse(225, 250, 120, 150, 0, 0, 7); c.fill(); c.strokeStyle = '#16121f'; c.lineWidth = 5; c.stroke();
          c.lineWidth = 4; for (let i = 0; i < 70; i++) { c.beginPath(); const a = Math.PI + rnd() * Math.PI; c.moveTo(225 + Math.cos(a) * 110, 230 + Math.sin(a) * 140); c.lineTo(225 + Math.cos(a) * (150 + rnd() * 50), 210 + Math.sin(a) * (170 + rnd() * 50)); c.stroke(); }
          c.fillStyle = '#7d5a9e88'; for (const x of [180, 270]) { c.beginPath(); c.ellipse(x, 262, 30, 18, 0, 0, 7); c.fill(); }
          c.fillStyle = '#16121f'; for (const x of [180, 270]) { c.fillRect(x - 18, 250, 36, 5); }
          c.beginPath(); c.moveTo(195, 340); c.quadraticCurveTo(225, 325, 255, 342); c.stroke();
          c.fillStyle = '#fff'; c.strokeStyle = '#16121f'; c.fillRect(260, 430, 110, 130); c.strokeRect(260, 430, 110, 130); c.beginPath(); c.arc(375, 495, 30, -1.3, 1.3); c.stroke();
          c.fillStyle = '#6f4518'; c.fillRect(266, 440, 98, 20);
          c.fillStyle = '#16121f'; c.font = 'bold 44px serif'; c.fillText('z', 360, 150); c.font = 'bold 30px serif'; c.fillText('z', 395, 115); c.font = 'bold 20px serif'; c.fillText('z', 420, 90); });
        const bg = canvas(1400, 1150, (c, w, h) => { for (let i = 0; i < 26; i++) { const x = rnd() < .5 ? rnd() * 140 : w - rnd() * 160, y = rnd() * h;
            c.fillStyle = pick(['#ff4fa355', '#2b2bd944', '#ffd23f77', '#1d9a5b44']); c.beginPath(); c.arc(x, y, 8 + rnd() * 34, 0, 7); c.fill(); }
          for (let i = 0; i < 9; i++) doodle(c, 60 + rnd() * (w - 120), 20 + rnd() * (h - 40), 10 + rnd() * 10, pick(['#2b2bd9', '#ff4fa3'])); });
        Object.assign(T.state().bgd, {base: {c: '#fff6e0', role: null}, layers: [{id: 'l1', type: 'image', src: bg, w: 1400, h: 1150, fit: 'once', pos: 'left top', scale: 100}]});

        E({tag: 'h1', fileId: R, selector: 'h1.outline', x: 48, y: 40, w: 640, content: 'Mx. Pigment', sx: 1.2, sy: 1.2});
        E({tag: 'p', fileId: R, selector: 'p.lead', x: 52, y: 150, w: 560, content: 'Paintings, drawings, and an alarming number of sticky notes about paintings and drawings. Based somewhere with good light and bad rent.'});
        const sticker = E({tag: 'span', fileId: R, selector: '.sticker', x: 640, y: 120, content: 'NEW WORK!', sx: 1.3, sy: 1.3});
        sticker.anim = anim('load', {scale: 125, rot: -8}, {dur: 700, ease: 'bounce', repeat: 'forever', alt: true});
        E({tag: 'div', fileId: W98, selector: '.window', x: 800, y: 40, w: 300, content: '<div class="title-bar"><div class="title-bar-text">about_me.txt</div><div class="title-bar-controls"><button aria-label="Minimize"></button><button aria-label="Close"></button></div></div><div class="window-body"><p style="margin:0">Hi. I make pictures. Some of them on purpose. Everything on this page that isn’t text came out of the Paint Studio, which is the whole joke.</p></div>'});
        const works = [[blobs, 'Untitled #47 (Rent Is Due)', 'Acrylic, anxiety. 2026.', 'SOLD (to my mum)'], [ramen, 'Still Life With Ramen', 'The ramen did not survive the sitting.', '€40 or best offer'], [portrait, 'Self Portrait, Before Coffee', 'Oil on whatever was nearby.', 'NOT FOR SALE (emotionally)']];
        works.forEach(([src, title, note, price], i) => {
          const x = 48 + i * 350, y = 280;
          E({tag: 'img', fileId: R, selector: 'img.tilt', x, y, w: i === 2 ? 240 : 300, content: src, attrs: {alt: title}});
          E({tag: 'p', fileId: R, selector: 'p.caption', x, y: y + (i === 2 ? 340 : 245), w: 300, content: `<b>${title}</b><br>${note}`});
        });
        // INVARIANT: price tags are placed last so each stacks above its painting.
        works.forEach(([, , , price], i) => { const p = E({tag: 'span', fileId: X, selector: '.price', x: 48 + i * 350 + (i === 2 ? 150 : 170), y: 262, content: price}); if (i === 1) { p.sx = 1.2; p.sy = 1.2; } });
        E({tag: 'h2', fileId: R, selector: 'h2.underline', x: 48, y: 700, content: 'Commissions'});
        E({tag: 'p', fileId: R, selector: 'p', x: 48, y: 760, w: 520, content: 'I will paint your pet, your house or your ex, in that order of enthusiasm. Turnaround is two weeks, or six, depending on the weather and my feelings about the weather.'});
        E({tag: 'table', fileId: R, selector: 'table', x: 48, y: 860, content: '<thead><tr><th>Thing</th><th>Price</th></tr></thead><tbody><tr><td>Small painting</td><td>€40</td></tr><tr><td>Large painting</td><td>€400</td></tr><tr><td>Explaining my art</td><td>Free, unfortunately</td></tr></tbody>'});
        const cta = E({tag: 'button', fileId: R, selector: '.btn.big', x: 400, y: 880, content: 'Commission me', colors: {bg: {c: '#ff4fa3', role: null}}});
        cta.anim = anim('hover', {scale: 112, rot: -4}, {dur: 260, ease: 'bounce'});
        E({tag: 'label', fileId: R, selector: 'label', x: 760, y: 720, content: 'Your email (I’ll lose it)'});
        const email = E({tag: 'input', fileId: R, selector: 'input.pill', x: 760, y: 750, w: 320, attrs: {placeholder: 'you@somewhere.art'}});
        const send = E({tag: 'button', fileId: R, selector: '.btn', x: 760, y: 810, content: 'Send'});
        const said = E({tag: 'p', fileId: R, selector: 'p.caption', x: 880, y: 820, w: 220, content: ' '});
        const c = node('click', {el: send.id}, 40, 40), s1 = node('setText', {el: said.id, value: 'Sent. Into the void, but sent.'}, 320, 40), s2 = node('setText', {el: email.id, value: ''}, 600, 40);
        wire(c, 'fire', s1, 'in'); wire(s1, 'next', s2, 'in');
        E({tag: 'span', fileId: X, selector: '.tape', x: 820, y: 960, content: 'This page is a demo. Mx. Pigment is not real. Yet.'});
        // RULE: the flipbook is APNG so it animates with or without script.
        const blink = [0, 0, 0, 1, 2, 1].map(k => canvas(240, 200, (c, w, h) => { c.fillStyle = '#ff4fa3'; c.strokeStyle = '#16121f'; c.lineWidth = 6;
          c.beginPath(); c.moveTo(40, 170); c.bezierCurveTo(10, 60, 90, 10, 130, 30); c.bezierCurveTo(200, 0, 240, 110, 200, 170); c.closePath(); c.fill(); c.stroke();
          for (const x of [95, 160]) { if (k === 0) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, 95, 18, 22, 0, 0, 7); c.fill(); c.stroke(); c.fillStyle = '#16121f'; c.beginPath(); c.arc(x + 4, 100, 8, 0, 7); c.fill(); }
            else { c.beginPath(); c.moveTo(x - 18, 95 + (k === 2 ? 4 : 0)); c.quadraticCurveTo(x, k === 2 ? 108 : 104, x + 18, 95 + (k === 2 ? 4 : 0)); c.stroke(); } }
          c.beginPath(); c.arc(128, 135, 16, .2, Math.PI - .2); c.stroke(); }));
        E({tag: 'img', fileId: null, selector: null, x: 1130, y: 200, w: 120, content: T.encodeAPNG(blink, 6), attrs: {alt: 'Self Portrait, Blinking (a flipbook)'}});
        E({tag: 'p', fileId: R, selector: 'p.caption', x: 1120, y: 310, w: 150, content: '<b>Self Portrait, Blinking</b><br>Six frames. Took a week.'});
      }

      if (name === 'musician') {
        await T.newProject('The Unpaid Interns — press kit', false, {type: 'web'});
        const F = await lib('fanzine.css'), W98 = await lib('98.css');
        const bg = canvas(1400, 1100, (c, w, h) => { c.font = '34px serif';
          for (let i = 0; i < 40; i++) { c.fillStyle = pick(['#ff33cc66', '#00808066', '#00008044', '#ffcc0099']); c.fillText(pick(['♪', '♫', '★', '♬']), rnd() * w, rnd() * h); } });
        Object.assign(T.state().bgd, {base: {c: '#fffbe6', role: null}, layers: [{id: 'l1', type: 'image', src: bg, w: 1400, h: 1100, fit: 'once', pos: 'left top', scale: 100}]});
        E({tag: 'h1', fileId: F, selector: 'h1.wordart', x: 48, y: 30, w: 760, content: 'The Unpaid Interns'});
        E({tag: 'h1', fileId: F, selector: 'h1.marquee', x: 48, y: 120, w: 1060, content: '★ NEW EP “EXPOSURE IS NOT A CURRENCY” OUT NOW ★ ON CASSETTE ★ AND IN THIS BROWSER ★ TELL YOUR FRIENDS ★ WE HAVE TWO'});
        E({tag: 'p', fileId: F, selector: 'p.comic', x: 52, y: 190, w: 540, content: 'Three chords and a mortgage. Formed in 2019 in a garage we were told we could use “for a week”. Influences include rent, other bands, and the hum from the fridge.'});
        const win = E({tag: 'div', fileId: W98, selector: '.window', x: 660, y: 190, w: 440, content: '<div class="title-bar"><div class="title-bar-text">Winamp-ish.exe</div><div class="title-bar-controls"><button aria-label="Minimize"></button><button aria-label="Close"></button></div></div><div class="window-body"><p style="margin:0 0 6px"><b>Now playing:</b> 01 – Per Diem Blues</p><p style="margin:0">4 bars, on loop, as is tradition. Made in the Sequencer; Save .mid takes it anywhere. ▶ opens a real Winamp, in DashAmp II, because we have taste.</p></div>'});
        const play = E({tag: 'button', fileId: W98, selector: 'button', x: 676, y: 300, content: '▶ Play'});
        const stop = E({tag: 'button', fileId: W98, selector: 'button', x: 776, y: 300, content: '■ Stop'});
        const p1 = node('click', {el: play.id}, 40, 40), p2 = node('song', {what: 'play', el: win.id}, 320, 40), q1 = node('click', {el: stop.id}, 40, 200), q2 = node('song', {what: 'stop', el: ''}, 320, 200);
        wire(p1, 'fire', p2, 'in'); wire(q1, 'fire', q2, 'in');
        E({tag: 'p', fileId: F, selector: 'p.small', x: 664, y: 344, w: 440, content: 'Press ▶ Play at the top of PIXIWYG first, then this one. The skin is DashAmp II from the Winamp Skin Museum; the Sequencer can change it, or take your own .wsz.'});
        const eq = ['#ff33cc', '#ff7a00', '#ffcc00', '#00ff66', '#008080', '#000080', '#7a00ff', '#ff33cc', '#ffcc00', '#00ff66'];
        eq.forEach((col, i) => { const b = E({tag: 'div', fileId: null, selector: null, x: 900 + i * 20, y: 300, w: 14, content: '&nbsp;<br>&nbsp;', colors: {bg: {c: col, role: null}}});
          b.anim = anim('load', {y: -18 - (i % 3) * 6, scale: 100}, {dur: 260 + (i * 97) % 300, ease: 'ease-in-out', repeat: 'forever', alt: true}); });
        E({tag: 'h2', fileId: F, selector: 'h2.banner', x: 48, y: 330, w: 560, content: 'TOUR DATES'});
        E({tag: 'table', fileId: F, selector: 'table', x: 48, y: 380, content: '<thead><tr><th>When</th><th>Where</th><th>Status</th></tr></thead><tbody><tr><td>Fri 13</td><td>Mum’s garage</td><td>SOLD OUT (3 seats)</td></tr><tr><td>Sat 14</td><td>The laundromat, open mic</td><td>Bring coins</td></tr><tr><td>Sun 15</td><td>Your living room?</td><td>Please</td></tr></tbody>'});
        E({tag: 'h2', fileId: F, selector: 'h2.banner', x: 48, y: 560, w: 560, content: 'MERCH'});
        E({tag: 'ul', fileId: F, selector: 'ul.stars', x: 48, y: 610, w: 560, content: '<li>T-shirts, sizes S to Regret</li><li>Tote bag (holds exactly one setlist)</li><li>The .mid file: free, like our labour</li>'});
        E({tag: 'div', fileId: F, selector: '.counter', x: 664, y: 420, content: '000047'});
        E({tag: 'p', fileId: F, selector: 'p.small', x: 664, y: 470, w: 420, content: 'Visitors since 2019. Four of them are us.'});
        E({tag: 'div', fileId: F, selector: '.webring', x: 664, y: 520, w: 420, content: '« prev · The Garage Band Webring · next »'});
        E({tag: 'hr', fileId: F, selector: 'hr.construction', x: 48, y: 740, w: 1060});
        E({tag: 'p', fileId: F, selector: 'p.center', x: 48, y: 800, w: 1060, content: 'Booking: our drummer’s mum. Press: also our drummer’s mum.'});
        const bar = 1920, notes = {drums: [], bass: [], keys: [], lead: []};
        const chords = [[45, [57, 60, 64]], [41, [53, 57, 60]], [48, [55, 60, 64]], [43, [55, 59, 62]]];
        chords.forEach(([root, tri], b) => { const t0 = b * bar;
          for (let k = 0; k < 8; k++) notes.bass.push({t: t0 + k * 240, d: 220, p: root + (k === 3 || k === 7 ? 12 : 0), v: k % 2 ? 90 : 110});
          for (const at of [480, 1440]) for (const p of tri) notes.keys.push({t: t0 + at, d: 220, p, v: 90});
          for (const at of [0, 960, 1200]) notes.drums.push({t: t0 + at, d: 120, p: 36, v: at ? 105 : 125});
          for (const at of [480, 1440]) notes.drums.push({t: t0 + at, d: 120, p: 38, v: 110});
          for (let k = 0; k < 8; k++) notes.drums.push({t: t0 + k * 240, d: 120, p: 42, v: k % 2 ? 80 : 100});
        });
        notes.drums.push({t: 0, d: 120, p: 49, v: 115});
        const mel = [[76, 0, 360], [74, 360, 120], [72, 480, 480], [69, 960, 480], [72, 1440, 480], [77, 1920, 480], [76, 2400, 240], [74, 2640, 240], [72, 2880, 960],
          [72, 3840, 240], [74, 4080, 240], [76, 4320, 480], [79, 4800, 480], [76, 5280, 480], [74, 5760, 480], [71, 6240, 480], [74, 6720, 240], [76, 6960, 240], [74, 7200, 480]];
        for (const [p, t, d] of mel) notes.lead.push({t, d, p, v: 105});
        T.state().player = {skin: 'dashamp-ii'};
        const song = T.newSong('Per Diem Blues', {bpm: 112, beats: 4, res: 4, bars: 4, tracks: [
          {name: 'Drums', drums: true, prog: 0, vol: 110, mute: false, notes: notes.drums},
          {name: 'Electric bass', drums: false, prog: 33, vol: 105, mute: false, notes: notes.bass},
          {name: 'Electric piano', drums: false, prog: 4, vol: 80, mute: false, notes: notes.keys},
          {name: 'Square lead', drums: false, prog: 80, vol: 85, mute: false, notes: notes.lead}]});
        T.useSong(song.id);
        for (const nd of T.state().logic.nodes) if (nd.type === 'song') nd.f.song = song.id;
      }

      if (name === 'writer') {
        await T.newProject('Notes From the Margin', false, {type: 'booklet', sheet: 'a4', pages: 8}, 'page');
        const B = await lib('bookish.css'), X = await lib('xerox.css');
        const d = T.newDoc('Notes From the Margin', `# Notes From the Margin

*A zine about writing, written instead of writing.*

## I. The page is not blank. It is smug.

Every writer knows the blank page. It sits there, white and patient, like a cat that has knocked something off a shelf and is waiting to see what you will do about it. People call it empty. It is not empty. It is full of every sentence you have not written, and it would like you to know that it has opinions about all of them.

The trick, I am told, is to write anything at all. A grocery list. A complaint. A letter to the council about the bins. Once there are words on the page, the page stops being smug and starts being a draft, and a draft is something you can argue with. You cannot argue with a blank page. I have tried. It wins on points.

> The first draft of anything is a liability. The second draft is a liability with better margins.

## II. A short history of procrastination, abridged because I got bored

Procrastination is older than writing. Scholars believe the first cave painting was made by someone who was meant to be sharpening a spear. The first poem was almost certainly written to avoid a conversation. The printing press was invented so that more people could not finish their novels at the same time.

In the modern era we have refined the art. We no longer simply fail to write. We research fonts. We reorganise the bookshelf by colour, then by author, then by colour again because it looked better. We buy a new notebook, because the old one had the wrong energy. We make a zine about not writing, and lay it out very nicely, and feel productive, and are not.

- Tidying the desk counts as preparation.
- Reading about writing counts as research.
- Choosing a typeface counts as writing, if you squint.
- Lying down counts as thinking. This one is true.

## III. Kerning, and other hills to die on

Kerning is the space between two letters. Most people will never notice it, which is exactly why the rest of us cannot stop. Once you have seen a badly kerned sign you will see it forever: the café that looks like it is called "CAFE" with a cough in the middle, the shop where FLICKS became something else entirely. You will point these out to your friends. Your friends will stop walking with you.

There are other hills. The serial comma, which is correct. Two spaces after a full stop, which is not. Whether a zine needs page numbers (it does, or the stapler wins). Whether a footnote can contain a joke (it must, or why have footnotes at all). Pick your hills early. Bring snacks. You will be up there for a while.

> Typography is what language looks like when it has had a shower and put on a nice shirt.

## IV. Advice I have not taken

Write every day. Write at the same time every day. Write in the morning, before the world gets its hands on you. Write at night, when the world has given up. Write by hand. Never write by hand, it is slow and you cannot read it later. Read your work aloud. Do not read your work aloud on public transport, I cannot stress this enough.

Finish things. This is the only advice that matters, and it is the one nobody takes, because finishing a thing means it can be judged, and an unfinished thing is perfect forever, in the way that a lottery ticket is perfect until the draw. Fold the paper. Staple the spine. Give it to someone. Let it be imperfect in their hands instead of perfect in your head.

## V. How this zine was made

The words were typed as Markdown, which is just writing with a few asterisks in it. PIXIWYG turned each paragraph into a page element and dressed it in a stylesheet that thinks it is a Penguin paperback. Autoformat poured the text across the pages, in order, and split the long paragraphs where the page ran out. The page numbers are automatic. The jokes are not, and you can tell.

To print it, export it, choose Open to print, and the pages land on A4 sheets in folding order. Print both sides, flip on the short edge, fold the stack in half, and staple the fold. Congratulations. You are a publisher now. The pay is the same as before.

*— The Management, who should be writing.*
`);
        d.sheet = B; d.from = 1; d.width = 480; d.gap = 14; T.flowDocs(d);
        await document.fonts.ready; T.flowDocs(d);
        const r0 = T.pageRects()[0], m = Math.round(T.state().canvas.margin * 96 / 25.4) + 10, cw = r0.w - 2 * m;
        const title = T.state().els.find(e => e.md && e.tag === 'h1'); T.convertOne(title);
        const ttl = T.state().els.find(e => e.from && e.tag === 'h1'); Object.assign(ttl, {selector: 'h1.title', x: r0.x + m, y: r0.y + m + 10, w: cw});
        const epi = T.state().els.find(e => e.md && e.tag === 'p'); T.convertOne(epi);
        const ep = T.state().els.find(e => e.from && e.tag === 'p'); Object.assign(ep, {selector: 'p.epigraph', x: r0.x + m, y: r0.y + m + 130, w: cw});
        const cover = canvas(840, 940, (c, w, h) => { c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#1b1b1b';
          for (let i = 0; i < 7; i++) { const cx = 90 + rnd() * (w - 180), cy = 500 + rnd() * 340, r = 46 + rnd() * 30; c.fillStyle = '#fdfaf2'; c.lineWidth = 4;
            c.beginPath(); for (let k = 0; k < 14; k++) { const a = k / 14 * Math.PI * 2, rr = r * (.75 + rnd() * .35); c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } c.closePath(); c.fill(); c.stroke();
            c.lineWidth = 2; for (let k = 0; k < 5; k++) { c.beginPath(); c.moveTo(cx + (rnd() - .5) * r, cy + (rnd() - .5) * r); c.lineTo(cx + (rnd() - .5) * r, cy + (rnd() - .5) * r); c.stroke(); } }
          c.strokeStyle = '#8a5a2b77'; c.lineWidth = 10; c.beginPath(); c.arc(610, 210, 110, 0, 7); c.stroke(); c.lineWidth = 4; c.beginPath(); c.arc(616, 204, 96, .4, 5.2); c.stroke();
          c.save(); c.translate(250, 250); c.rotate(-.6); c.fillStyle = '#1b1b1b'; c.fillRect(-170, -16, 300, 32); c.fillStyle = '#b08d57'; c.fillRect(70, -16, 14, 32);
          c.beginPath(); c.moveTo(130, -16); c.lineTo(200, 0); c.lineTo(130, 16); c.closePath(); c.fillStyle = '#c9a227'; c.fill(); c.restore();
          c.strokeStyle = '#1b1b1b'; c.lineWidth = 3; c.beginPath(); for (let x = 330; x < 760; x += 5) c.lineTo(x, 360 + Math.sin(x / 13) * 10 + Math.sin(x / 41) * 14); c.stroke(); });
        const art = E({tag: 'img', fileId: null, selector: null, x: r0.x + m + 10, y: r0.y + m + 190, w: cw - 20, content: cover, attrs: {alt: 'Crumpled drafts, a coffee ring, and the pen responsible'}});
        T.renderAll(); await T.hostOf(art.id).shadowRoot.querySelector('img').decode();
        const stamp = E({tag: 'span', fileId: X, selector: '.stamp', x: r0.x + m + 150, y: r0.y + r0.h - m - 120, content: 'NOW WITH 40% MORE WORDS', z: 999});
        stamp.anim = anim('load', {scale: 112, rot: -6}, {dur: 900, ease: 'bounce'});
        T.renderAll(); T.flowDocs(d);
        const rs = T.pageRects(), used = Math.max(...T.state().els.filter(e => e.md).map(e => T.pageOf(e).i));
        if (used > 4) throw new Error('the essay ran onto page ' + (used + 1) + '; it has to end by page 5 to leave room for the back pages');
        const at = (i, dx, dy) => ({x: rs[i].x + m + dx, y: rs[i].y + m + dy});
        if (used < 4) {
          E({tag: 'h1', fileId: X, selector: 'h1.ransom', ...at(4, 0, 150), w: cw, content: 'FINISH THINGS.', sx: 1.15, sy: 1.15});
          E({tag: 'p', fileId: X, selector: 'p.typed', ...at(4, 0, 300), w: cw, content: '(See Section IV. Then ignore it, as is traditional.)'});
          E({tag: 'span', fileId: X, selector: '.tape', ...at(4, 0, 420), content: 'pull quote, enlarged to fill a page we panicked about'});
        }
        E({tag: 'h2', fileId: B, selector: 'h2', ...at(5, 0, 20), w: cw, content: 'Reader questionnaire'});
        E({tag: 'ul', fileId: X, selector: 'ul.checkbox', ...at(5, 0, 90), w: cw, content: '<li>I read this instead of writing.</li><li>I read this instead of reading something better.</li><li>I am the author, checking the layout again.</li><li>I found a typo and I feel great about it.</li><li>I would like to complain about the kerning.</li>'});
        E({tag: 'p', fileId: B, selector: 'p.footnote', ...at(5, 0, 360), w: cw, content: 'Tear out and keep. Do not return. We have nowhere to put it.'});
        E({tag: 'h2', fileId: B, selector: 'h2', ...at(6, 0, 20), w: cw, content: 'Notes'});
        E({tag: 'p', fileId: B, selector: 'p.footnote', ...at(6, 0, 70), w: cw, content: 'For your notes, doodles, or the grocery list from Section I.'});
        for (let i = 0; i < 12; i++) E({tag: 'hr', fileId: X, selector: 'hr', ...at(6, 0, 130 + i * 40), w: cw});
        E({tag: 'h1', fileId: X, selector: 'h1.stencil', ...at(7, 0, 120), w: cw, content: 'THE END'});
        E({tag: 'p', fileId: B, selector: 'p.colophon', ...at(7, 0, 240), w: cw, content: 'Set from a Markdown manuscript by PIXIWYG, which flowed it onto the pages while it was typed. Printed on a machine that only works when watched.'});
        E({tag: 'span', fileId: X, selector: '.price', ...at(7, 40, 400), content: 'Price: one (1) compliment'});
        E({tag: 'span', fileId: X, selector: '.stamp', ...at(7, 10, 480), content: 'SECOND EDITION (THE FIRST ONE GOT WET)', sx: .8, sy: .8});
        T.renderAll(); T.flowDocs(d);
      }

      if (name === 'animator') {
        await T.newProject('THE DEADLINE — title sequence', false, {type: 'screen', size: 'slide'});
        const F = await lib('fanzine.css'), X = await lib('xerox.css'), R = sample('riso-zine.css'), r0 = T.pageRects()[0], at = (x, y) => ({x: r0.x + x, y: r0.y + y});
        const sky = canvas(1920, 1080, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b0820'); g.addColorStop(1, '#3a0d4f'); c.fillStyle = g; c.fillRect(0, 0, w, h);
          for (let i = 0; i < 220; i++) { c.fillStyle = `rgba(255,255,255,${.2 + rnd() * .7})`; c.beginPath(); c.arc(rnd() * w, rnd() * h * .8, rnd() * 1.8 + .3, 0, 7); c.fill(); }
          c.fillStyle = '#16121f'; c.beginPath(); c.moveTo(0, h); for (let x = 0; x <= w; x += 40) c.lineTo(x, h - 120 - Math.abs(Math.sin(x / 170)) * 90 - rnd() * 20); c.lineTo(w, h); c.fill(); });
        Object.assign(T.state().bgd, {base: {c: '#0b0820', role: null}, layers: [{id: 'l1', type: 'image', src: sky, w: 1920, h: 1080, fit: 'once', pos: 'left top', scale: 100}]});
        const clock = canvas(360, 360, (c, w, h) => { c.lineCap = 'round'; c.fillStyle = '#fff6e0'; c.strokeStyle = '#16121f'; c.lineWidth = 12; c.beginPath(); c.arc(180, 180, 150, 0, 7); c.fill(); c.stroke();
          c.lineWidth = 6; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; c.beginPath(); c.moveTo(180 + Math.cos(a) * 120, 180 + Math.sin(a) * 120); c.lineTo(180 + Math.cos(a) * 138, 180 + Math.sin(a) * 138); c.stroke(); }
          c.strokeStyle = '#ff2e88'; c.lineWidth = 10; c.beginPath(); c.moveTo(180, 180); c.lineTo(180, 60); c.stroke(); c.strokeStyle = '#16121f'; c.beginPath(); c.moveTo(180, 180); c.lineTo(250, 180); c.stroke(); });
        E({tag: 'p', fileId: X, selector: 'p.typed', ...at(160, 140), w: 900, content: 'A PIXIWYG PICTURE', colors: {fg: {c: '#fff6e0', role: null}}}).anim = enter({op: 0, y: -20}, {dur: 900});
        E({tag: 'h1', fileId: F, selector: 'h1.chrome', ...at(160, 260), w: 1200, content: 'THE DEADLINE', sx: 2.4, sy: 2.4}).anim = enter({y: -420, scale: 40, op: 0}, {delay: 800, dur: 1200, ease: 'bounce'});
        E({tag: 'p', fileId: R, selector: 'p.lead', ...at(170, 560), w: 1100, content: 'This summer, one file is due. Nobody has started it.', colors: {fg: {c: '#ffd23f', role: null}}, sx: 1.6, sy: 1.6}).anim = enter({x: -700, op: 0}, {delay: 2100, dur: 900, ease: 'ease-out'});
        E({tag: 'img', fileId: null, selector: null, ...at(1480, 160), w: 260, content: clock, attrs: {alt: 'A clock, ticking, as they do'}}).anim = anim('load', {rot: 360}, {dur: 4000, ease: 'linear', repeat: 'forever'});
        E({tag: 'span', fileId: X, selector: '.stamp', ...at(1300, 600), content: 'COMING SOON-ISH', sx: 1.8, sy: 1.8}).anim = enter({scale: 320, op: 0, rot: 20}, {delay: 3100, dur: 600, ease: 'bounce'});
        E({tag: 'p', fileId: X, selector: 'p.typed', ...at(170, 760), w: 1000, content: 'Starring a cursor, blinking. Also: coffee. Music by a laptop fan.', colors: {fg: {c: '#fff6e0', role: null}}}).anim = enter({op: 0, y: 30}, {delay: 3800, dur: 800});
        E({tag: 'span', fileId: X, selector: 'span', ...at(1130, 548), content: '|', colors: {fg: {c: '#ffd23f', role: null}}, sx: 3, sy: 3}).anim = anim('load', {op: 0}, {dur: 500, repeat: 'forever', alt: true, ease: 'linear'});
        [[300, 900], [760, 880], [1220, 920], [1700, 860]].forEach(([x, y], i) => { E({tag: 'span', fileId: F, selector: '.sparkle', ...at(x, y), content: '★', colors: {fg: {c: '#ffd23f', role: null}}, sx: 2, sy: 2}).anim = anim('load', {op: 15, scale: 70}, {delay: i * 350, dur: 700, repeat: 'forever', alt: true}); });
        E({tag: 'button', fileId: R, selector: '.btn.big', ...at(1460, 860), content: '▶ Watch the trailer'}).anim = anim('hover', {scale: 110, rot: -3}, {dur: 220, ease: 'bounce'});
      }

      // SECTION: benchmark: a stress page for rendering and editor bugs, not a showcase
      // RULE: each block names the failure it is there to expose; tests/bench.spec.mjs checks the invariants.
      if (name === 'benchmark') {
        await T.newProject('Rendering benchmark', false, {type: 'web'});
        const R = sample('riso-zine.css'), PH = sample('phosphor.css'), BG = sample('bubblegum-os.css');
        const X = await lib('xerox.css'), F = await lib('fanzine.css'), W98 = await lib('98.css'), XP = await lib('xp.css'), NES = await lib('nes.css'), BU = await lib('bulma.css'), TU = await lib('tufte.css'), RP = await lib('rpgui.css');
        const label = (x, y, t) => E({tag: 'p', fileId: PH, selector: 'p', x, y, w: 1500, content: t});
        // INVARIANT: block 1, heavy and many sheets: adoptedStyleSheets per host, style compile, catalog size (RPGUI is 1.8 MB).
        label(40, 20, '1 · Every heavy sheet at once: h1, p, button and input from each');
        [[R, 'riso'], [PH, 'phosphor'], [BG, 'bubblegum'], [X, 'xerox'], [F, 'fanzine'], [W98, '98'], [XP, 'xp'], [NES, 'nes'], [BU, 'bulma'], [TU, 'tufte'], [RP, 'rpgui']].forEach(([s, n], i) => {
          const x = 40 + (i % 6) * 250, y = 80 + Math.floor(i / 6) * 260;
          E({tag: 'h1', fileId: s, selector: 'h1', x, y, w: 230, content: n});
          E({tag: 'p', fileId: s, selector: 'p', x, y: y + 80, w: 230, content: 'The quick brown fox jumps over the lazy dog.'});
          E({tag: 'button', fileId: s, selector: 'button', x, y: y + 170, content: 'Button'});
          E({tag: 'input', fileId: s, selector: 'input', x: x + 100, y: y + 170, w: 120, attrs: {placeholder: 'input'}});
        });
        // INVARIANT: block 2, ink vs layout: selection must hug ink for ink-only text and keep layout width otherwise.
        label(40, 640, '2 · Ink vs layout: outline, shadow, stroke, centered, RTL, CJK/emoji, unbreakable word, rotated');
        E({tag: 'h1', fileId: R, selector: 'h1.outline', x: 40, y: 690, w: 640, content: 'Mx. Pigment', sx: 1.2, sy: 1.2});
        E({tag: 'h1', fileId: R, selector: 'h1', x: 40, y: 790, w: 640, content: 'Centered', attrs: {style: 'text-align:center'}});
        E({tag: 'h2', fileId: R, selector: 'h2', x: 760, y: 700, content: 'Rotated banner'});
        E({tag: 'h2', fileId: R, selector: 'h2.underline', x: 760, y: 760, w: 500, content: 'Underlined: a border, so full width'});
        E({tag: 'h1', fileId: F, selector: 'h1.wordart', x: 760, y: 820, w: 700, content: 'WordArt'});
        E({tag: 'p', fileId: R, selector: 'p', x: 40, y: 880, w: 320, content: 'مرحبا بالعالم — right to left, with a <b>bold</b> run.', attrs: {dir: 'rtl'}});
        E({tag: 'p', fileId: R, selector: 'p', x: 400, y: 880, w: 320, content: '日本語のテキストと絵文字 🎨🖌️🧵 mixed with Latin; 한국어도.'});
        E({tag: 'p', fileId: R, selector: 'p', x: 760, y: 900, w: 160, content: 'Supercalifragilisticexpialidocious-without-any-break-opportunity'});
        E({tag: 'p', fileId: R, selector: 'p.lead', x: 960, y: 900, w: 480, content: '<i>Italic overhang ffff</i> and <span style="letter-spacing:12px">spaced out</span>.'});
        // INVARIANT: block 3, nesting: selector chains build wrappers; deep content and long lists stress measure().
        label(40, 1000, '3 · Nesting: window chrome, 12-deep content, 40-row table, 60-item list');
        E({tag: 'div', fileId: W98, selector: '.window', x: 40, y: 1050, w: 340, content: '<div class="title-bar"><div class="title-bar-text">nested.txt</div><div class="title-bar-controls"><button aria-label="Close"></button></div></div><div class="window-body">' + '<div style="padding:2px;border:1px dotted #888">'.repeat(12) + 'deep' + '</div>'.repeat(12) + '</div>'});
        E({tag: 'table', fileId: F, selector: 'table', x: 420, y: 1050, w: 420, content: '<tr><th>#</th><th>Name</th><th>Value</th></tr>' + Array.from({length: 40}, (_, i) => `<tr><td>${i + 1}</td><td>row ${i + 1}</td><td>${(rnd() * 1000).toFixed(2)}</td></tr>`).join('')});
        E({tag: 'ul', fileId: X, selector: 'ul.checkbox', x: 880, y: 1050, w: 300, content: Array.from({length: 60}, (_, i) => `<li>item ${i + 1}</li>`).join('')});
        // INVARIANT: block 4, mass: 480 small hosts, mixed sheets, scales and z-order; drag, snap and tree cost.
        label(40, 2300, '4 · Mass: 480 elements, scaled, shuffled z-order');
        for (let i = 0; i < 480; i++) {
          const s = [X, F, R][i % 3], sel = ['.stamp', '.sparkle', '.sticker'][i % 3], k = .6 + rnd() * .9;
          const el = E({tag: 'span', fileId: s, selector: sel, x: 40 + (i % 24) * 62, y: 2350 + Math.floor(i / 24) * 40, content: sel === '.sparkle' ? '★' : String(i), sx: k, sy: k});
          el.z = Math.floor(rnd() * 2000);
        }
        // INVARIANT: block 5, motion: 40 forever-looping animations while editing, so any per-frame layout shows.
        label(1560, 2300, '5 · Motion: 40 looping animations');
        for (let i = 0; i < 40; i++) E({tag: 'span', fileId: F, selector: '.sparkle', x: 1560 + (i % 8) * 40, y: 2350 + Math.floor(i / 8) * 40, content: '✦'}).anim = anim('load', {rot: 360, scale: 60}, {dur: 900 + i * 37, ease: 'linear', repeat: 'forever', alt: i % 2 === 1});
        // INVARIANT: block 6, pixels: big images scaled down, plus a background image layer; asset packing and paint cost.
        label(40, 3200, '6 · Pixels: three 1600×1200 images, scaled; a background layer');
        const noise = (w, h, hue) => canvas(w, h, (c) => { for (let i = 0; i < 400; i++) { c.fillStyle = `hsl(${hue + rnd() * 60},80%,${40 + rnd() * 40}%)`; c.fillRect(rnd() * w, rnd() * h, 10 + rnd() * 200, 10 + rnd() * 200); } });
        for (let i = 0; i < 3; i++) E({tag: 'img', fileId: R, selector: 'img.tilt', x: 40 + i * 520, y: 3250, w: 480, content: noise(1600, 1200, i * 110), attrs: {alt: 'Noise ' + (i + 1)}});
        Object.assign(T.state().bgd, {base: {c: '#fbfaf5', role: null}, layers: [{id: 'l1', type: 'image', src: noise(800, 800, 200), w: 800, h: 800, fit: 'tile', pos: 'left top', scale: 100}]});
      }

      T.state().ws = ws;
      T.renderAll(); T.save();
      const zip = T.zipFiles(T.sortEntries(T.packProject()));
      return [...new Uint8Array(await zip.arrayBuffer())];
    }, [name, WS[name]]);
    writeFileSync(OUT + name + '.pixiwyg', Buffer.from(bytes));
    console.log(`examples/${name}.pixiwyg  ${(bytes.length / 1024).toFixed(0)} KB`);
  }
} finally {
  await browser.close();
  server.kill();
}

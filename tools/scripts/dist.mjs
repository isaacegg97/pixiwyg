// FORMAT: node scripts/dist.mjs  builds this platform's desktop installers with the Tauri CLI (from ../tauri), copies
//   them into dist/ and writes dist/SHA256SUMS.txt.
// RULE: installer formats that reject a semver prerelease get a valid version of their own, worked out here from the
//   one app version, so nobody edits per-format numbers:
//     RPM   1.0.0-beta.1 -> Version 1.0.0, Release 0.beta.1   (Fedora's prerelease convention; sorts before 1.0.0-1)
//     MSI   1.0.0-beta.1 -> 1.0.0.1                           (numeric fourth field; Tauri's MSI allows same-version
//                                                             upgrades, so the final 1.0.0 replaces it)
//     AppImage, .deb, NSIS .exe and .dmg take 1.0.0-beta.1 as it is.
//   A final version (no prerelease) needs no overrides and builds every format in one go.
// HACK: an override changes the version Tauri compiles in, so the RPM's binary reports 1.0.0 in its Help menu; the
//   page itself, and so problem reports, still say 1.0.0-beta.1.
// HACK: on Linux, `npm run dist -- --windows` cross-builds the Windows setup .exe instead (Tauri calls this
//   experimental): it needs `rustup target add x86_64-pc-windows-msvc`, `cargo install cargo-xwin` (which fetches
//   Microsoft's CRT and SDK under their license) and makensis (Fedora: mingw32-nsis). No .msi: WiX runs on Windows only.
// FORMAT: signing is optional. macOS: Tauri reads APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY
//   ("-" signs ad hoc), APPLE_ID, APPLE_PASSWORD and APPLE_TEAM_ID itself. Windows: PIXIWYG_WIN_THUMBPRINT names a
//   code-signing certificate in the current user's store. PIXIWYG_MAC_UNIVERSAL=1 builds one app for both Mac chips.
import {spawnSync, execFileSync} from 'node:child_process';
import {readFileSync, readdirSync, statSync, mkdirSync, rmSync, copyFileSync, existsSync} from 'node:fs';
import {join, basename} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url)), tauri = join(here, '..', 'tauri'), dist = join(here, 'dist');
const version = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8')).version;
const m = /^(\d+\.\d+\.\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
if (!m) { console.error(`package.json has no usable version: ${version}`); process.exit(1); }
const [, core, pre] = m;
const cli = join(here, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');
if (!existsSync(cli)) { console.error('The Tauri CLI is missing: run npm ci in tools/ first.'); process.exit(1); }

const started = Date.now() - 1000;
// INVARIANT: the bundles carry ../index.html as it is, so it is rebuilt (and its CSP stamped) first.
execFileSync(process.execPath, [join(here, 'scripts', 'build.mjs')], {stdio: 'inherit'});

function build(bundles, config, extra = []) {
  const args = [cli, 'build', '--bundles', bundles.join(','), ...extra];
  if (config) args.push('--config', JSON.stringify(config));
  console.log(`\n▸ tauri build --bundles ${bundles.join(',')}${config ? ' ' + JSON.stringify(config) : ''}`);
  const r = spawnSync(process.execPath, args, {cwd: tauri, stdio: 'inherit'});
  if (r.status !== 0) process.exit(r.status || 1);
}

const cross = process.argv.includes('--windows') && process.platform === 'linux';
const plat = cross ? 'win32' : process.platform;
let target = [];
if (plat === 'linux') {
  if (pre) {
    build(['appimage', 'deb']);
    // FORMAT: RPM Release allows letters, digits and dots; anything else in the prerelease becomes a dot.
    build(['rpm'], {version: core, bundle: {linux: {rpm: {release: `0.${pre.replace(/[^0-9A-Za-z.]+/g, '.')}`}}}});
  } else build(['appimage', 'deb', 'rpm']);
} else if (plat === 'win32') {
  const win = {};
  // FORMAT: the MSI's fourth field is the prerelease's last number (beta.1 -> 1, rc.12 -> 12), at most 65535.
  if (pre) win.wix = {version: `${core}.${Math.min(65535, +((pre.match(/(\d+)(?!.*\d)/) || [])[1] || 0))}`};
  if (process.env.PIXIWYG_WIN_THUMBPRINT) Object.assign(win, {certificateThumbprint: process.env.PIXIWYG_WIN_THUMBPRINT, digestAlgorithm: 'sha256', timestampUrl: 'http://timestamp.digicert.com'});
  if (cross) build(['nsis'], null, ['--runner', 'cargo-xwin', '--target', 'x86_64-pc-windows-msvc']);
  else build(['nsis', 'msi'], Object.keys(win).length ? {bundle: {windows: win}} : null);
} else if (plat === 'darwin') {
  if (process.env.PIXIWYG_MAC_UNIVERSAL === '1') target = ['--target', 'universal-apple-darwin'];
  build(['app', 'dmg'], null, target);
} else { console.error(`No installers for ${plat}`); process.exit(1); }

// SECTION: collect every installer this build made into dist/
const wanted = /\.(AppImage|deb|rpm|exe|msi|dmg)$/;
const found = [];
const walk = d => { if (!existsSync(d)) return; for (const f of readdirSync(d)) { const p = join(d, f), s = statSync(p);
  if (s.isDirectory()) { if (!f.endsWith('.app')) walk(p); } else if (wanted.test(f)) found.push(p); } };
for (const t of readdirSync(join(tauri, 'target'))) walk(join(tauri, 'target', t, 'release', 'bundle'));
walk(join(tauri, 'target', 'release', 'bundle'));
rmSync(dist, {recursive: true, force: true});mkdirSync(dist, {recursive: true});
// INVARIANT: only what this run made; older installers in target/ are left out.
const fresh = found.filter(p => statSync(p).mtimeMs >= started);
for (const p of new Set(fresh)) copyFileSync(p, join(dist, basename(p)));
if (!fresh.length) { console.error('The build made no installers.'); process.exit(1); }
execFileSync(process.execPath, [join(here, 'scripts', 'checksums.mjs')], {cwd: here, stdio: 'inherit'});

# PIXIWYG tools

PIXIWYG is `index.html` plus `lib/`, at the repository root. That pair can be hosted on any static web server as is.
This folder (`tools/`) holds everything else: the tooling that builds and packages the desktop app (`../tauri/`, which wraps
those two files, changing nothing in them), and the test suite. Run every command below from inside `tools/`.

## Requirements

- Node 22.12 or newer. On this machine: `nvm use 24`.
- `npm ci` installs the Tauri CLI 2.12.3 and Playwright 1.63.0, pinned in `package.json`.
- `npx playwright install chromium` once, for the tests.
- For the desktop app: Rust (stable), and on Linux the WebKitGTK build libraries:
  - Fedora: `sudo dnf install webkit2gtk4.1-devel libsoup3-devel javascriptcoregtk4.1-devel gtk3-devel openssl-devel rpm-build`
  - Debian/Ubuntu: `sudo apt install libwebkit2gtk-4.1-dev libsoup-3.0-dev libgtk-3-dev libssl-dev librsvg2-dev`

## Everyday commands

| Command | What it does |
| --- | --- |
| `npm run serve` | Serves the repository root (the hostable app) at http://localhost:4173/ |
| `npm start` | Runs the desktop app (`../tauri/`) from source |
| `npm test` | The Playwright suite in Chromium: each feature's specs in `../src/`, and the repository-wide ones in `tests/` |
| `npm run test:tauri` | The desktop shell's own tests (`cargo test` in `../tauri/`) |
| `npm run install-local` | Builds and installs (or upgrades) the app for the current user, on Linux |
| `npm run examples` | Rebuilds the example projects in `../examples/` from `scripts/build-examples.mjs`; `npm run examples -- benchmark` rebuilds just the named ones |
| `npm run bench` | Opens `examples/benchmark.pixiwyg`, checks its rendering invariants and prints timings |
| `npm run android` | Stages the web app and builds a signed release APK for 64-bit ARM (needs `JAVA_HOME` on a JDK 21, `ANDROID_HOME`, `NDK_HOME`; see `../tauri/README.md`) |
| `npm run web` | Stages the hostable app (`index.html`, `lib/`, `examples/`) in `dist/web/`, for any static server at any path |
| `npm run dist` | Builds this platform's installers into `dist/`, with `SHA256SUMS.txt` (see "Installers" below) |
| `npm run set-version -- 1.0.0-beta.2` | Sets the version everywhere it lives; with no argument, prints them and fails if they differ |
| `npm run build` | Compiles `../src/` (the files `../src/build.json` lists) into `../index.html` and stamps its CSP |
| `npm run watch` | Watches `../src/` and automatically recompiles `../index.html` on change |
| `npm run stamp` | Re-stamps the Content-Security-Policy in `../index.html` with its script's hash (`npm test`, `dist` and `install-local` run it) |
| `npm run tauri -- <args>` | The Tauri CLI, run in `../tauri/` |

## Installing it on your own machine (Linux)

`npm run install-local` builds the app from this checkout and installs it for you: the app in `~/.local/opt/pixiwyg/`,
a `pixiwyg` command in `~/.local/bin/`, and PIXIWYG in the app menu. Run it again any time to upgrade to what's in
the checkout now; it takes a few seconds, and asks you to close PIXIWYG first if it's open. `npm run uninstall-local`
removes it.

Projects live in the web engine's storage under `~/.local/share/app.pixiwyg.desktop`, apart from the installed files,
so upgrades and uninstalls leave them alone (`uninstall-local --delete-projects` removes them too). Back up everything
still applies before risky changes.

## The desktop app

The desktop app is the Tauri shell in `../tauri/` (its README covers what it does in detail). It wraps `../index.html`,
`../lib/` and `../examples/`, changing nothing in them, in the system web engine: WebKitGTK on Linux, WKWebView on
macOS, WebView2 on Windows.

- Serves them from `app://localhost` (`http://app.localhost` on Windows), with the page's own stamped
  Content-Security-Policy as a header. No IPC commands; navigation never leaves the app; web links open in the browser.
- Save PDF opens the system print dialog on the print export ("Print to File" for a PDF). Saved files go to Downloads.
- Writes errors to `pixiwyg.log` (Help → Open Log Folder). One instance per user.
- On Linux, picks Wayland or X11 from the session; `PIXIWYG_BACKEND=wayland|x11` overrides it, and the choice is logged.
- Rendering is the system engine's, so test on each platform you ship. Web MIDI input isn't available in WebKitGTK.
- Projects from the old Electron build (`~/.config/PIXIWYG`) aren't read: More → Back up everything there, then open
  the zip in this one.

## The hosted page's Content-Security-Policy

`index.html` carries the same policy as the desktop app, as a `<meta>` tag, stamped with the inline script's SHA-256.
Edit the script and the stamp goes stale: a hosted copy served as-is would then refuse to run its own script. `npm
run stamp` fixes the file; `npm test` stamps first, and a test fails if the committed file is stale. The dev server
and the desktop app stamp `index.html` as they serve it, so neither breaks mid-edit.

## The example projects

`../examples/` holds one finished page for each kind of user the welcome screen asks about (artist, musician, writer).
Each profile's tour opens its example as a new project. They're ordinary `.pixiwyg` files, made by
`scripts/build-examples.mjs`, which drives the real app: change the script, run `npm run examples`, and commit the files.
The page and the desktop app serve `examples/` next to `lib/`, and the installers include it.

## Autopublish (stub)

The page's Publish site command POSTs JSON to `__publish` next to `index.html` (same origin, so the CSP is
unchanged): `{format:'pixiwyg-publish', version:1, app, name, slug, html, references:[{path, kind, note?}]}`.
The desktop app and `npm run serve` forward that body unchanged as `POST /publish` over HTTP on a Unix socket:
`$PIXIWYG_PUBLISH_SOCK`, else `$XDG_RUNTIME_DIR/pixiwyg-publish.sock`, else the temp dir. Any 2xx reply counts as
published; a JSON `url` or `message` in it is shown to the user. Nothing listening gives a 503 and a hint. The
collecting API is yours to write (`publish-sock.js` is the forwarder). A static host can serve the same path itself.

## The version

The version lives in four places that must agree: `tools/package.json`, `const APP_VERSION` in `../src/app/start.js`
(built into `index.html`), `../tauri/tauri.conf.json` and `../tauri/Cargo.toml`. `npm run set-version -- <version>`
sets all four and rebuilds `index.html`; a test fails if they differ, and the release workflow refuses a tag that
doesn't match.

## Installers

`npm run dist` builds this platform's installers with Tauri and copies them into `dist/`:

| Platform | Files | Version inside |
| --- | --- | --- |
| Linux | `.AppImage`, `.deb` | `1.0.0-beta.1` |
| Linux | `.rpm` | Version `1.0.0`, Release `0.beta.1` (RPM allows no `-`; `0.` sorts it before the final `1.0.0-1`) |
| Windows | NSIS setup `.exe` | `1.0.0-beta.1` |
| Windows | `.msi` | `1.0.0.1` (MSI takes numbers only: the prerelease's last number; the final 1.0.0 still upgrades it) |
| macOS | `.dmg` | `1.0.0-beta.1` |

On Linux, `npm run dist -- --windows` cross-builds the Windows setup `.exe` (no `.msi`). It needs the
`x86_64-pc-windows-msvc` Rust target, `cargo install cargo-xwin` (which downloads Microsoft's C runtime and SDK under
their license) and `makensis` (Fedora: `mingw32-nsis`). Tauri calls this experimental; release builds come from a real
Windows runner.

The RPM and MSI numbers are worked out from the one app version by `scripts/dist.mjs`; nobody edits them. A final
version builds every format as is. The RPM's app reports 1.0.0 in its menu; the page, and problem reports, still say
the full version.

## Releasing a beta build

1. `npm run set-version -- 1.0.0-beta.2`.
2. Commit, then tag `v1.0.0-beta.2` and push the tag.
3. `.github/workflows/release.yml` tests on macOS, Windows and Linux, builds, and attaches the installers and
   `SHA256SUMS.txt` to a draft pre-release. Read it over, then publish it.

Signing is optional, per platform. With its secrets set, a platform signs (and on macOS, notarizes). Without them, it
builds unsigned, the run shows a warning, and the draft release notes say which builds are unsigned and how testers
open them:

- **Windows, unsigned:** keep the download if the browser flags it, then at “Windows protected your PC” click
  More info → Run anyway. Windows 11 with Smart App Control on can't run unsigned apps at all.
- **macOS, unsigned:** the build gets an ad-hoc signature (Apple Silicon won't run an app without one). The first
  launch is blocked: System Settings → Privacy & Security → Open Anyway.
- **Linux:** AppImages, .deb and .rpm are not signed.

Testers check every download against `SHA256SUMS.txt`, signed or not.

### Secrets the release workflow needs

| Secret | What it is |
| --- | --- |
| `MAC_CERT_P12_BASE64`, `MAC_CERT_PASSWORD` | Developer ID Application certificate, exported as .p12, base64-encoded |
| `MAC_SIGNING_IDENTITY` | Its name, e.g. `Developer ID Application: Your Name (TEAMID)` |
| `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID` | For notarization |
| `WIN_CERT_PFX_BASE64`, `WIN_CERT_PASSWORD` | Authenticode code-signing certificate (.pfx), base64-encoded |

## Checking print on paper (REQ-17)

The tests prove each export comes out of Chromium's print-to-PDF at the right paper size and sheet count. Folding
needs paper. For each printer (an inkjet, a laser, and a print shop's PDF check), from the desktop app, and once
from Chromium (the hosted page), since the desktop app prints with the system engine:

1. Zine on A4, 8 pages, imposed, fold marks on. Print double-sided, flip on the short edge. Fold the stack once and
   staple: pages read 1 to 8, and the fold ticks line up with the fold.
2. The same on Letter.
3. Mini zine on Letter, imposed, marks on. Fold in half lengthwise, cut the dashed slit, fold into a booklet: pages
   read cover, 2 to 7, back cover, and the upside-down row ends up the right way round.
4. A5 flyer with bleed and crop marks. Trim on the marks: no white edge, and nothing important cut.

Use the system print dialog with margins set to none and scale at 100%. Note anything off in a problem report.

## Comments in the code

Every comment starts with a tag (`SECTION:`, `RULE:`, `PERF:`…). [CONTRIBUTING.md](../CONTRIBUTING.md) has the tags,
how to use them, and the way around `src/`; `tests/conventions.spec.mjs` checks every source file for an untagged
comment.

## Third-party notices

`../lib/NOTICES.txt` holds the full license text of every bundled stylesheet, font and color scheme, and the app shows
it under More → About PIXIWYG. Adding a library means adding its notice there too.

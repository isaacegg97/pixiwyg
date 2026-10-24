# PIXIWYG

*Paint under it. Style on top of it.*

PIXIWYG is a page maker that runs entirely in one HTML file. You build a page out of elements styled by real
stylesheets, then paint, write, compose and wire logic into it. It saves to a single `.pixiwyg` file and exports a
page that works on its own.

- **Page:** drop in elements, style them with any CSS you import (98.css, NES.css and the rest of the bundled library,
  or your own), tile them with Boxes, group them, reuse them as symbols and primitives, and spread a site over several
  linked pages.
- **Paint:** a Paint Studio with brushes, selection, WebGL filters, frames, and animated PNG and GIF output.
- **Write:** manuscripts in Markdown that flow across pages, and a Write workspace that behaves like a word processor.
- **Music:** a sequencer with a built-in synth, SoundFonts, samples, effects, MIDI in and out, and a Webamp player on the page.
- **Logic and animation:** a node editor for page logic, keyframed animation, and a timeline. Play mode runs it all.
- **3D:** low-poly models (OBJ, STL, glTF) baked into sprite atlases that turn on the page.
- **Export:** a standalone HTML page or site, print layouts for zines and booklets, and PDFs.

It has two interfaces over the same projects. **Desktop** is a toolbar, docked panels and a project tree. **XMB** is
for phones and tablets: categories across the bottom, their items above, one tool at a time under a strip of
essentials, with pinch to zoom and two fingers to pan. Automatic picks XMB on touch-only devices; Settings → Interface
or the command palette switches either way.

For kids there's the **Creative Quest** (on the welcome screen, and in the XMB under Project): seven hands-on missions
that each make one real thing, with a pointer showing where to tap and a star for each. It finishes only by doing,
survives Back and reloads, and a grown-up ends it early by holding its corner button for three seconds.

Nothing loads from the network at run time, and the page runs under a strict Content-Security-Policy: no eval, no
wasm, and one inline script allowed by its hash.

## Run it

**In a browser:** `index.html` plus `lib/` (and `examples/` for the tutorials) is the whole app. Serve the repository
root from any static web server, at any path. `npm run web` stages just those files in `tools/dist/web/`, and each
release carries them as `PIXIWYG_<version>_web.zip`; publishing a release deploys that zip to GitHub Pages. Opened
straight from disk as `file://`, it can't load `lib/`, and it says so.

**On the desktop:** the Tauri app in `tauri/` wraps the same files in the system web engine. Installers for Linux
(AppImage, .deb, .rpm), Windows (.exe, .msi) and macOS (.dmg) come from `npm run dist`; see
[tools/README.md](tools/README.md).

**From a checkout:**

```sh
cd tools
npm ci                          # Node 22.12 or newer
npx playwright install chromium # once, for the tests
npm run serve                   # http://localhost:4173/
npm start                       # the desktop app (needs Rust and, on Linux, the WebKitGTK libraries)
```

## Where things are

| Folder | What's in it |
| --- | --- |
| `src/` | The app's source, one folder per feature, each holding that feature's scripts, styles, markup and tests |
| `index.html` | The built app, compiled from `src/` by `npm run build`. Committed, because it *is* the hostable app |
| `lib/` | Vendored stylesheets, fonts, color schemes, Webamp and the GIF encoder, unmodified, with `NOTICES.txt` |
| `examples/` | The example projects the welcome tours open |
| `tauri/` | The desktop shell (Rust) |
| `tools/` | Build, tests, packaging and release scripts; `npm` commands run from here |
| `docs/` | The UI/UX standard, notes, and research |

[CONTRIBUTING.md](CONTRIBUTING.md) is the guide to finding your way around `src/`, how a change travels from source to
the page, and how the code is commented.

## Testing

`npm test` (in `tools/`) builds the page and runs the whole Playwright suite in Chromium: each feature's specs from its
folder in `src/`, plus the repository-wide checks in `tools/tests/` (security, accessibility, comment conventions, the
benchmark). `npm run test:tauri` runs the desktop shell's Rust tests.

## Version

1.0.0-beta.1. `npm run set-version -- <version>` changes it everywhere it's written down.

## Licenses

Every bundled third-party file keeps its license, collected in `lib/NOTICES.txt` and shown in the app under
More → About PIXIWYG.

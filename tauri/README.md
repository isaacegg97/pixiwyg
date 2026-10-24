# PIXIWYG desktop (Tauri)

The desktop app: a Tauri 2 shell that wraps `../index.html`, `../lib/` and `../examples/`, changing nothing in them,
in the system web engine (WebKitGTK on Linux, WKWebView on macOS, WebView2 on Windows). Its tooling (installers,
versions, tests, install-local) lives in `../tools/`; see that README. Run the commands below from inside `tauri/`.

## Requirements

Rust (stable), the build libraries listed in `../tools/README.md`, and `npm ci` in `../tools/` (the Tauri CLI).
`npm run build` there first, so `../index.html` is current and its CSP is stamped.

## Commands

| Command | What it does |
| --- | --- |
| `cargo run` | Runs the app from source, serving the repository's `index.html`, `lib/` and `examples/` |
| `cargo test` | Backend choice, the publish forwarder, and what the `app://` origin serves (and refuses) |
| `npm run dist` (in `../tools/`) | Builds this platform's installers, with valid RPM and MSI versions for a prerelease |

## What the shell does

- Serves `index.html`, `lib/` and `examples/` from `app://localhost` (`http://app.localhost` on Windows). The
  Content-Security-Policy header is read from the page's own stamped meta tag, so there is one policy.
- No IPC commands are exposed. Navigation never leaves the app; web links open in the browser. The only windows the page
  may open are its own blob: previews (Live preview), sized as the page asks.
- Save PDF opens the system print dialog on the print export; choose "Print to File" for a PDF. (WebKitGTK has no silent
  print-to-PDF.)
- Files the page saves go to the Downloads folder, never over an existing file; the status line says where.
- `POST /__publish` goes to the same Unix socket as `npm run serve` (`$PIXIWYG_PUBLISH_SOCK`, else
  `$XDG_RUNTIME_DIR/pixiwyg-publish.sock`).
- One instance per user; launching again opens another window. Help → Open Log Folder has `pixiwyg.log`.
- `PIXIWYG_USER_DATA` (scratch profile) and `PIXIWYG_HIDDEN=1` (no window shown) are for tests and scripted runs.

## Wayland or X11: chosen for you

The shell picks the display backend from the session, before GTK starts (`src/backend.rs`):

1. `PIXIWYG_BACKEND=wayland` or `x11` wins (`PIXIWYG_WAYLAND=1` still means wayland). A `GDK_BACKEND` you set yourself
   is left alone.
2. A Wayland session (`WAYLAND_DISPLAY` or `XDG_SESSION_TYPE=wayland`) runs natively on Wayland; anything else on X11.
3. On NVIDIA's proprietary driver, WebKit's DMA-BUF renderer is turned off (the usual cause of blank windows there),
   unless `WEBKIT_DISABLE_DMABUF_RENDERER` is already set.

The choice is written to the log at startup.

## Moving from the Electron build

PIXIWYG shipped on Electron before 1.0.0-beta.1. Its projects live in Chromium's storage under `~/.config/PIXIWYG` and
this app can't read them: in the old app, More → Back up everything, then open the zip here. Web MIDI input isn't
available in WebKitGTK, and rendering is the system engine's, so test on each platform you ship.

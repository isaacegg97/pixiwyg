// SECTION: PIXIWYG desktop shell (Tauri)
// SAFETY: index.html, lib/ and examples/ are served from a private app:// origin with the page's own CSP; no IPC
//   commands are exposed, navigation never leaves the app (web links open in the browser), and the only windows the
//   page may open are its own blob: previews. The page is unchanged from the hosted build.
// INVARIANT: the page detects the desktop app by its app: origin (Linux, macOS); Windows serves the same scheme as
//   http://app.localhost, where the page behaves as the hosted build does.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod backend;
mod publish;

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU32, Ordering};
use tauri::http::{header, Request, Response, StatusCode};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::webview::{DownloadEvent, NewWindowResponse, PageLoadEvent};
use tauri::{AppHandle, Manager, Runtime, Url, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_opener::OpenerExt;

static SEQ: AtomicU32 = AtomicU32::new(0);

fn app_url(path: &str) -> Url {
  let base = if cfg!(windows) { "http://app.localhost/" } else { "app://localhost/" };
  format!("{base}{path}").parse().expect("app url")
}
// RULE: a page of ours: the app origin, its blob: documents (previews, print), or the blank page a new window starts on.
fn own(url: &Url) -> bool {
  match url.scheme() {
    "app" | "blob" => true,
    "http" | "https" => url.host_str() == Some("app.localhost"),
    "about" => url.as_str() == "about:blank",
    _ => false,
  }
}
fn web(url: &Url) -> bool {
  matches!(url.scheme(), "http" | "https") && !own(url)
}

// SECTION: files
// INVARIANT: in development the page is the repository's (../); a bundle carries index.html, lib/ and examples/ as
//   resources.
fn root<R: Runtime>(app: &AppHandle<R>) -> PathBuf {
  if cfg!(debug_assertions) {
    let dev = Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
    if dev.join("index.html").exists() {
      return dev;
    }
  }
  app.path().resource_dir().unwrap_or_else(|_| PathBuf::from("."))
}
fn decode(p: &str) -> Option<String> {
  let b = p.as_bytes();
  let mut out = Vec::with_capacity(b.len());
  let mut i = 0;
  while i < b.len() {
    if b[i] == b'%' {
      let h = std::str::from_utf8(b.get(i + 1..i + 3)?).ok()?;
      out.push(u8::from_str_radix(h, 16).ok()?);
      i += 3;
    } else {
      out.push(b[i]);
      i += 1;
    }
  }
  String::from_utf8(out).ok()
}
// SAFETY: only index.html and files directly inside lib/ and examples/ are reachable; no other path, no dot-segments.
fn allowed(rel: &str) -> bool {
  if rel == "index.html" {
    return true;
  }
  match rel.split_once('/') {
    Some((dir, name)) if dir == "lib" || dir == "examples" => {
      !name.is_empty() && name != "." && name != ".." && name.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c))
    }
    _ => false,
  }
}
fn mime(rel: &str) -> &'static str {
  match Path::new(rel).extension().and_then(|e| e.to_str()).unwrap_or("") {
    "html" => "text/html; charset=utf-8",
    "css" => "text/css; charset=utf-8",
    "js" => "text/javascript; charset=utf-8",
    "json" => "application/json",
    "txt" => "text/plain; charset=utf-8",
    "png" => "image/png",
    "woff2" => "font/woff2",
    "woff" => "font/woff",
    _ => "application/octet-stream",
  }
}
// FORMAT: the header carries the same policy as the page's stamped meta tag (tools/csp.js wrote both).
fn csp_of(html: &str) -> Option<String> {
  let key = "<meta http-equiv=\"Content-Security-Policy\" content=\"";
  let at = html.find(key)? + key.len();
  let end = html[at..].find('"')?;
  Some(html[at..at + end].to_string())
}
fn reply(status: StatusCode, ty: &str, body: Vec<u8>) -> Response<Vec<u8>> {
  Response::builder()
    .status(status)
    .header(header::CONTENT_TYPE, ty)
    .header("x-content-type-options", "nosniff")
    .header(header::CACHE_CONTROL, "no-store")
    .body(body)
    .unwrap_or_else(|_| Response::new(Vec::new()))
}
fn serve(root: &Path, req: &Request<Vec<u8>>) -> Response<Vec<u8>> {
  let host = req.uri().host().unwrap_or("");
  if host != "localhost" && host != "app.localhost" {
    return reply(StatusCode::NOT_FOUND, "text/plain", Vec::new());
  }
  let path = req.uri().path();
  if req.method() == "POST" {
    if path != "/__publish" {
      return reply(StatusCode::METHOD_NOT_ALLOWED, "text/plain", Vec::new());
    }
    let r = publish::forward(req.body());
    return reply(StatusCode::from_u16(r.status).unwrap_or(StatusCode::BAD_GATEWAY), &r.ty, r.body);
  }
  let Some(mut rel) = decode(path.trim_start_matches('/')) else {
    return reply(StatusCode::NOT_FOUND, "text/plain", Vec::new());
  };
  if rel.is_empty() {
    rel = "index.html".into();
  }
  if !allowed(&rel) {
    return reply(StatusCode::NOT_FOUND, "text/plain", Vec::new());
  }
  match std::fs::read(root.join(&rel)) {
    Ok(body) => {
      let mut r = reply(StatusCode::OK, mime(&rel), body);
      if rel == "index.html" {
        if let Some(csp) = csp_of(&String::from_utf8_lossy(r.body())) {
          if let Ok(v) = csp.parse() {
            r.headers_mut().insert(header::CONTENT_SECURITY_POLICY, v);
          }
        }
      }
      r
    }
    Err(_) => reply(StatusCode::NOT_FOUND, "text/plain", Vec::new()),
  }
}

// SECTION: logs
fn log<R: Runtime>(app: &AppHandle<R>, line: &str) {
  if let Ok(dir) = app.path().app_log_dir() {
    let _ = std::fs::create_dir_all(&dir);
    if let Ok(mut f) = std::fs::OpenOptions::new().create(true).append(true).open(dir.join("pixiwyg.log")) {
      let secs = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0);
      let _ = writeln!(f, "[{secs}] {line}");
    }
  }
}

// SECTION: windows
fn label(kind: &str) -> String {
  format!("{kind}-{}", SEQ.fetch_add(1, Ordering::Relaxed))
}
// RULE: a preview asks for its page's size in window.open's features; it's honoured, clamped to sane bounds.
fn clamp_size(f: &tauri::webview::NewWindowFeatures) -> (f64, f64) {
  match f.size() {
    Some(s) => (s.width.clamp(320.0, 8000.0), s.height.clamp(200.0, 8000.0)),
    None => (1100.0, 850.0),
  }
}
fn guard_navigation<R: Runtime>(app: AppHandle<R>) -> impl Fn(&Url) -> bool + Send + 'static {
  move |url: &Url| {
    if own(url) {
      return true;
    }
    if web(url) {
      let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
    false
  }
}
// RULE: files the page saves (projects, exports, backups) go to Downloads, never over an existing file; the page's
//   status line says where.
fn downloads<R: Runtime>(app: AppHandle<R>) -> impl Fn(tauri::Webview<R>, DownloadEvent<'_>) -> bool + Send + Sync + 'static {
  move |webview, event| {
    match event {
      DownloadEvent::Requested { destination, .. } => {
        let name = destination.file_name().map(|n| n.to_owned()).unwrap_or_else(|| "pixiwyg-download".into());
        let dir = app.path().download_dir().or_else(|_| app.path().home_dir()).unwrap_or_else(|_| PathBuf::from("."));
        let mut target = dir.join(&name);
        let (stem, ext) = {
          let p = Path::new(&name);
          (p.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default(), p.extension().map(|e| format!(".{}", e.to_string_lossy())).unwrap_or_default())
        };
        let mut k = 2;
        while target.exists() {
          target = dir.join(format!("{stem} ({k}){ext}"));
          k += 1;
        }
        *destination = target;
      }
      DownloadEvent::Finished { path, success, .. } => {
        let msg = match (success, path) {
          (true, Some(p)) => format!("Saved to {}", p.display()),
          _ => "The file could not be saved".to_string(),
        };
        let _ = webview.eval(format!("document.getElementById('status').textContent={}", serde_json::to_string(&msg).unwrap_or_default()));
      }
      _ => {}
    }
    true
  }
}
fn new_window<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
  let hidden = std::env::var("PIXIWYG_HIDDEN").as_deref() == Ok("1");
  let a = app.clone();
  let mut b = WebviewWindowBuilder::new(app, label("main"), WebviewUrl::CustomProtocol(app_url("index.html")))
    .title("PIXIWYG")
    .inner_size(1440.0, 900.0)
    .min_inner_size(900.0, 600.0)
    .background_color(tauri::window::Color(0xa6, 0xa2, 0xd2, 0xff))
    .visible(false)
    .on_navigation(guard_navigation(app.clone()))
    .on_download(downloads(app.clone()))
    .on_new_window(move |url, features| open_window(&a, url, features))
    .on_page_load(move |w, p| {
      if p.event() == PageLoadEvent::Finished && !hidden {
        let _ = w.show();
      }
    });
  // INVARIANT: PIXIWYG_USER_DATA points tests (or anyone) at a scratch profile, away from real projects.
  if let Ok(d) = std::env::var("PIXIWYG_USER_DATA") {
    b = b.data_directory(PathBuf::from(d));
  }
  b.build()?;
  Ok(())
}
// SAFETY: only the page's own blob: documents open, in windows related to it (so they can read its blob), with the
//   same navigation lock and no further windows. A #pdf= blob opens the print dialog (Print to File makes the PDF).
fn open_window<R: Runtime>(app: &AppHandle<R>, url: Url, features: tauri::webview::NewWindowFeatures) -> NewWindowResponse<R> {
  if url.scheme() != "blob" {
    if web(&url) {
      let _ = app.opener().open_url(url.as_str(), None::<&str>);
    }
    return NewWindowResponse::Deny;
  }
  let pdf = url.fragment().map(|f| f.starts_with("pdf=")).unwrap_or(false);
  let (w, h) = if pdf { (1000.0, 1400.0) } else { clamp_size(&features) };
  let built = WebviewWindowBuilder::new(app, label(if pdf { "print" } else { "preview" }), WebviewUrl::External("about:blank".parse().expect("about:blank")))
    .window_features(features)
    .inner_size(w, h)
    .title(if pdf { "PIXIWYG · Print" } else { "PIXIWYG" })
    .on_navigation(guard_navigation(app.clone()))
    .on_new_window(|_, _| NewWindowResponse::Deny)
    .on_page_load(move |win, p| {
      if pdf && p.event() == PageLoadEvent::Finished && win.url().map(|u| u.scheme() == "blob").unwrap_or(false) {
        let _ = win.print();
      }
    })
    .build();
  match built {
    Ok(window) => {
      let _ = window.remove_menu();
      NewWindowResponse::Create { window }
    }
    Err(e) => {
      log(app, &format!("window: {e}"));
      NewWindowResponse::Deny
    }
  }
}

// SECTION: menu
// RULE: undo, redo and zoom belong to the page, so the menu leaves those keys alone; cut/copy/paste stay for macOS.
fn menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
  let new = MenuItem::with_id(app, "new-window", "New Window", true, Some("CmdOrCtrl+Shift+N"))?;
  let logs = MenuItem::with_id(app, "open-logs", "Open Log Folder", true, None::<&str>)?;
  let ver = MenuItem::with_id(app, "version", format!("PIXIWYG {}", app.package_info().version), false, None::<&str>)?;
  let file = Submenu::with_items(app, "File", true, &[&new, &PredefinedMenuItem::separator(app)?, &PredefinedMenuItem::quit(app, None)?])?;
  let edit = Submenu::with_items(app, "Edit", true, &[&PredefinedMenuItem::cut(app, None)?, &PredefinedMenuItem::copy(app, None)?, &PredefinedMenuItem::paste(app, None)?, &PredefinedMenuItem::select_all(app, None)?])?;
  let view = Submenu::with_items(app, "View", true, &[&PredefinedMenuItem::fullscreen(app, None)?])?;
  let help = Submenu::with_items(app, "Help", true, &[&logs, &ver])?;
  Menu::with_items(app, &[&file, &edit, &view, &help])
}

fn main() {
  let choice = backend::apply();
  tauri::Builder::default()
    // INVARIANT: a second launch opens another window; the page's one-window-per-project lock expects that.
    .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
      let _ = new_window(app);
    }))
    .plugin(tauri_plugin_opener::init())
    .register_asynchronous_uri_scheme_protocol("app", |ctx, req, responder| {
      let root = root(ctx.app_handle());
      // PERF: publishing can take a while; the request is answered off the main thread.
      std::thread::spawn(move || responder.respond(serve(&root, &req)));
    })
    .setup(move |app| {
      let h = app.handle().clone();
      app.set_menu(menu(&h)?)?;
      app.on_menu_event(|app, ev| match ev.id().as_ref() {
        "new-window" => {
          let _ = new_window(app);
        }
        "open-logs" => {
          if let Ok(dir) = app.path().app_log_dir() {
            let _ = std::fs::create_dir_all(&dir);
            let _ = app.opener().open_path(dir.to_string_lossy(), None::<&str>);
          }
        }
        _ => {}
      });
      let info = h.package_info();
      log(&h, &format!("started {} (Tauri {}) on {}-{}{}", info.version, tauri::VERSION, std::env::consts::OS, std::env::consts::ARCH,
        choice.as_ref().map(|c| format!(", {} ({}){}", c.backend, c.reason, if c.no_dmabuf { ", DMA-BUF renderer off (NVIDIA)" } else { "" })).unwrap_or_default()));
      new_window(&h)?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("PIXIWYG could not start");
}

#[cfg(test)]
mod tests {
  use super::*;
  fn get(path: &str) -> Response<Vec<u8>> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
    serve(&root, &Request::builder().uri(format!("app://localhost{path}")).body(Vec::new()).unwrap())
  }
  #[test]
  fn serves_the_page_with_its_own_csp() {
    let r = get("/index.html");
    assert_eq!(r.status(), StatusCode::OK);
    let csp = r.headers().get(header::CONTENT_SECURITY_POLICY).expect("csp header").to_str().unwrap().to_string();
    assert!(csp.contains("script-src 'self' 'sha256-") && csp.contains("worker-src 'none'"));
    assert_eq!(get("/").status(), StatusCode::OK);
    assert_eq!(get("/lib/98.css").status(), StatusCode::OK);
  }
  #[test]
  fn nothing_else_is_reachable() {
    for p in ["/tools/csp.js", "/lib/../index.html", "/lib/%2e%2e/index.html", "/tauri/Cargo.toml", "/lib/", "/lib/sub/x.css", "/.git/config"] {
      assert_eq!(get(p).status(), StatusCode::NOT_FOUND, "{p}");
    }
    let other = serve(Path::new("."), &Request::builder().uri("app://elsewhere/index.html").body(Vec::new()).unwrap());
    assert_eq!(other.status(), StatusCode::NOT_FOUND);
  }
  #[test]
  fn only_our_pages_are_ours() {
    for u in ["app://localhost/index.html", "blob:app://localhost/1234", "http://app.localhost/x", "about:blank"] {
      assert!(own(&u.parse().unwrap()), "{u}");
    }
    for u in ["https://example.com/", "file:///etc/passwd", "about:config"] {
      assert!(!own(&u.parse().unwrap()), "{u}");
    }
    assert!(web(&"https://example.com/".parse().unwrap()));
  }
}

// SECTION: PIXIWYG Android shell (Tauri mobile)
// SAFETY: the page, lib/ and examples/ are embedded in the app (build.frontendDist in tauri.android.conf.json, staged
//   by npm run web) and served from http://tauri.localhost with the page's own stamped CSP meta tag. No IPC commands
//   are exposed; navigation never leaves the app and web links open in the browser, as on the desktop.
// INVARIANT: the desktop binary is src/main.rs and doesn't use this file; Android builds only this library.
#[cfg(mobile)]
#[tauri::mobile_entry_point]
pub fn run() {
  use tauri::{Url, WebviewUrl, WebviewWindowBuilder};
  use tauri_plugin_opener::OpenerExt;
  // RULE: a page of ours: the app origin, its blob: documents, or a blank page.
  fn own(url: &Url) -> bool {
    match url.scheme() {
      "blob" => true,
      "http" | "https" => url.host_str() == Some("tauri.localhost"),
      "about" => url.as_str() == "about:blank",
      _ => false,
    }
  }
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .setup(|app| {
      let h = app.handle().clone();
      WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
        .on_navigation(move |url| {
          if own(url) {
            return true;
          }
          if matches!(url.scheme(), "http" | "https") {
            let _ = h.opener().open_url(url.as_str(), None::<&str>);
          }
          false
        })
        .build()?;
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("PIXIWYG could not start");
}

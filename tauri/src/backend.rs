// SECTION: Linux display backend (Wayland or X11), chosen from the session so nobody has to pass a flag.
// RULE: for WebKitGTK, in this order:
//   1. PIXIWYG_BACKEND=wayland|x11 wins (PIXIWYG_WAYLAND=1 still means wayland); a GDK_BACKEND set by the user is left.
//   2. No Wayland session (WAYLAND_DISPLAY / XDG_SESSION_TYPE) -> x11.
//   3. A Wayland session -> wayland, KDE included (the repaint bug that once kept Chromium on X there isn't WebKit's).
//   4. NVIDIA's proprietary driver: WebKit's DMA-BUF renderer is turned off (blank or flickering windows otherwise),
//      unless WEBKIT_DISABLE_DMABUF_RENDERER is already set.
// INVARIANT: runs before GTK starts; GDK reads GDK_BACKEND once, at init.
use std::collections::HashMap;

#[derive(Debug, PartialEq, Eq)]
pub struct Choice {
  pub backend: &'static str,
  pub reason: &'static str,
  pub no_dmabuf: bool,
}

// FORMAT: pick(env, nvidia) is pure, so tests can feed it any environment.
pub fn pick(env: &HashMap<String, String>, nvidia: bool) -> Choice {
  let get = |k: &str| env.get(k).map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
  let no_dmabuf = nvidia && get("WEBKIT_DISABLE_DMABUF_RENDERER").is_none();
  if let Some(o) = get("PIXIWYG_BACKEND").map(|v| v.to_lowercase()) {
    if o == "wayland" {
      return Choice { backend: "wayland", reason: "PIXIWYG_BACKEND", no_dmabuf };
    }
    if o == "x11" {
      return Choice { backend: "x11", reason: "PIXIWYG_BACKEND", no_dmabuf };
    }
  }
  if get("PIXIWYG_WAYLAND").as_deref() == Some("1") {
    return Choice { backend: "wayland", reason: "PIXIWYG_WAYLAND=1", no_dmabuf };
  }
  let wayland = get("WAYLAND_DISPLAY").is_some() || get("XDG_SESSION_TYPE").map(|v| v.to_lowercase()).as_deref() == Some("wayland");
  if !wayland {
    let reason = if get("DISPLAY").is_some() { "X11 session" } else { "no Wayland session" };
    return Choice { backend: "x11", reason, no_dmabuf };
  }
  Choice { backend: "wayland", reason: "Wayland session", no_dmabuf }
}

// RULE: the proprietary driver announces itself in /proc; nouveau and the open kernel modules' userspace don't need this.
fn nvidia_proprietary() -> bool {
  std::path::Path::new("/proc/driver/nvidia/version").exists()
}

// SAFETY: set_var is only sound before other threads read the environment; this runs first thing in main.
pub fn apply() -> Option<Choice> {
  if !cfg!(target_os = "linux") {
    return None;
  }
  let env: HashMap<String, String> = std::env::vars().collect();
  let c = pick(&env, nvidia_proprietary());
  let user_gdk = env.get("GDK_BACKEND").map(|v| !v.is_empty()).unwrap_or(false);
  let explicit = c.reason.starts_with("PIXIWYG");
  unsafe {
    if explicit || !user_gdk {
      std::env::set_var("GDK_BACKEND", c.backend);
    }
    if c.no_dmabuf {
      std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
  }
  Some(c)
}

#[cfg(test)]
mod tests {
  use super::*;
  fn env(pairs: &[(&str, &str)]) -> HashMap<String, String> {
    pairs.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect()
  }
  #[test]
  fn wayland_session_uses_wayland() {
    assert_eq!(pick(&env(&[("WAYLAND_DISPLAY", "wayland-0"), ("DISPLAY", ":0")]), false).backend, "wayland");
    assert_eq!(pick(&env(&[("XDG_SESSION_TYPE", "wayland")]), false).backend, "wayland");
  }
  #[test]
  fn x11_session_uses_x11() {
    assert_eq!(pick(&env(&[("DISPLAY", ":0"), ("XDG_SESSION_TYPE", "x11")]), false), Choice { backend: "x11", reason: "X11 session", no_dmabuf: false });
  }
  #[test]
  fn kde_wayland_stays_native_in_webkit() {
    assert_eq!(pick(&env(&[("WAYLAND_DISPLAY", "wayland-0"), ("DISPLAY", ":0"), ("XDG_CURRENT_DESKTOP", "KDE")]), false).backend, "wayland");
  }
  #[test]
  fn overrides_win() {
    assert_eq!(pick(&env(&[("WAYLAND_DISPLAY", "w"), ("PIXIWYG_BACKEND", "X11")]), false).backend, "x11");
    assert_eq!(pick(&env(&[("DISPLAY", ":0"), ("PIXIWYG_WAYLAND", "1")]), false).backend, "wayland");
  }
  #[test]
  fn nvidia_turns_off_dmabuf_unless_already_set() {
    assert!(pick(&env(&[("WAYLAND_DISPLAY", "w")]), true).no_dmabuf);
    assert!(!pick(&env(&[("WAYLAND_DISPLAY", "w"), ("WEBKIT_DISABLE_DMABUF_RENDERER", "0")]), true).no_dmabuf);
    assert!(!pick(&env(&[("WAYLAND_DISPLAY", "w")]), false).no_dmabuf);
  }
}

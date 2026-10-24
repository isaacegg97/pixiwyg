// SECTION: autopublish forwarder (the same protocol as tools/publish-sock.js)
// TODO: the collecting API is the user's to write. This forwards the page's POST /__publish body, untouched, as
//   POST /publish over HTTP/1.1 on a local Unix socket, and relays the reply.
// FORMAT: socket = $PIXIWYG_PUBLISH_SOCK, else $XDG_RUNTIME_DIR/pixiwyg-publish.sock, else <tmpdir>/pixiwyg-publish.sock.
//   No socket listening -> 503 {"error":"no publisher"}; the page tells the user to start it.
// SAFETY: only same-origin pages reach this; the body is capped (256 MB out, 1 MB back) and never interpreted here.
pub struct Reply {
  pub status: u16,
  pub ty: String,
  pub body: Vec<u8>,
}
#[cfg_attr(not(unix), allow(dead_code))]
const MAX: usize = 256 * 1024 * 1024;
fn json(status: u16, msg: &str) -> Reply {
  Reply { status, ty: "application/json".into(), body: serde_json::json!({ "error": msg }).to_string().into_bytes() }
}

#[cfg(unix)]
pub fn sock_path() -> std::path::PathBuf {
  if let Some(p) = std::env::var_os("PIXIWYG_PUBLISH_SOCK") {
    return p.into();
  }
  let dir = std::env::var_os("XDG_RUNTIME_DIR").map(std::path::PathBuf::from).unwrap_or_else(std::env::temp_dir);
  dir.join("pixiwyg-publish.sock")
}

#[cfg(unix)]
pub fn forward(body: &[u8]) -> Reply {
  use std::io::{ErrorKind, Read, Write};
  use std::os::unix::net::UnixStream;
  use std::time::Duration;
  if body.len() > MAX {
    return json(413, "too large");
  }
  let mut s = match UnixStream::connect(sock_path()) {
    Ok(s) => s,
    Err(e) if matches!(e.kind(), ErrorKind::NotFound | ErrorKind::ConnectionRefused) => return json(503, "no publisher"),
    Err(e) => return json(502, &e.to_string()),
  };
  let _ = s.set_read_timeout(Some(Duration::from_secs(120)));
  let _ = s.set_write_timeout(Some(Duration::from_secs(120)));
  let head = format!("POST /publish HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
  if let Err(e) = s.write_all(head.as_bytes()).and_then(|_| s.write_all(body)) {
    return json(502, &e.to_string());
  }
  let mut raw = Vec::new();
  if let Err(e) = s.take((1 << 20) + 64 * 1024).read_to_end(&mut raw) {
    if raw.is_empty() {
      return json(502, &e.to_string());
    }
  }
  parse(&raw).unwrap_or_else(|| json(502, "bad reply from publisher"))
}

#[cfg(not(unix))]
pub fn forward(_body: &[u8]) -> Reply {
  json(503, "no publisher")
}

// FORMAT: an HTTP/1.1 response: status line, headers, then a body by Content-Length, chunked, or to the end.
#[cfg_attr(not(unix), allow(dead_code))]
fn parse(raw: &[u8]) -> Option<Reply> {
  let split = raw.windows(4).position(|w| w == b"\r\n\r\n")?;
  let head = std::str::from_utf8(&raw[..split]).ok()?;
  let mut rest = raw[split + 4..].to_vec();
  let mut lines = head.split("\r\n");
  let status: u16 = lines.next()?.split_whitespace().nth(1)?.parse().ok()?;
  let (mut ty, mut chunked, mut len) = ("application/octet-stream".to_string(), false, None::<usize>);
  for l in lines {
    if let Some((k, v)) = l.split_once(':') {
      let (k, v) = (k.trim().to_ascii_lowercase(), v.trim());
      match k.as_str() {
        "content-type" => ty = v.to_string(),
        "transfer-encoding" => chunked = v.eq_ignore_ascii_case("chunked"),
        "content-length" => len = v.parse().ok(),
        _ => {}
      }
    }
  }
  if chunked {
    let mut out = Vec::new();
    let mut i = 0;
    loop {
      let nl = rest[i..].windows(2).position(|w| w == b"\r\n")? + i;
      let size = usize::from_str_radix(std::str::from_utf8(&rest[i..nl]).ok()?.split(';').next()?.trim(), 16).ok()?;
      if size == 0 {
        break;
      }
      out.extend_from_slice(rest.get(nl + 2..nl + 2 + size)?);
      i = nl + 2 + size + 2;
    }
    rest = out;
  } else if let Some(n) = len {
    rest.truncate(n);
  }
  rest.truncate(1 << 20);
  Some(Reply { status, ty, body: rest })
}

#[cfg(test)]
mod tests {
  use super::*;
  #[test]
  fn parses_length_and_chunked_replies() {
    let r = parse(b"HTTP/1.1 201 Created\r\nContent-Type: application/json\r\nContent-Length: 11\r\n\r\n{\"ok\":true}extra").unwrap();
    assert_eq!((r.status, r.ty.as_str(), r.body.as_slice()), (201, "application/json", &b"{\"ok\":true}"[..]));
    let c = parse(b"HTTP/1.1 200 OK\r\nTransfer-Encoding: chunked\r\n\r\n4\r\nWiki\r\n5\r\npedia\r\n0\r\n\r\n").unwrap();
    assert_eq!(c.body, b"Wikipedia");
  }
  #[cfg(unix)]
  #[test]
  fn no_socket_is_503() {
    std::env::set_var("PIXIWYG_PUBLISH_SOCK", "/nonexistent/pixiwyg-test.sock");
    assert_eq!(forward(b"{}").status, 503);
  }
}

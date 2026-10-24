#!/usr/bin/env bash
# FORMAT: builds this checkout's desktop app (Tauri) and installs it for the current user on Linux; rerun to upgrade.
#   installs to   ~/.local/opt/pixiwyg/   (bin/pixiwyg beside lib/PIXIWYG/, the layout Tauri finds its files in)
#   command       ~/.local/bin/pixiwyg
#   menu entry    ~/.local/share/applications/pixiwyg.desktop
#   remove        scripts/uninstall-local.sh
# INVARIANT: projects (~/.local/share/app.pixiwyg.desktop) are never touched.
# HACK: built as a .deb and unpacked with ar and tar, so nothing needs root and nothing depends on the distribution.
set -euo pipefail
cd "$(dirname "$0")/.."

dest="$HOME/.local/opt/pixiwyg"
apps="$HOME/.local/share/applications"
icons="$HOME/.local/share/icons/hicolor/512x512/apps"

# SAFETY: swapping files under a running app can crash it.
if pgrep -f "^$dest/bin/pixiwyg" >/dev/null; then
  echo "PIXIWYG is running. Close it, then run this again." >&2; exit 1
fi
command -v cargo >/dev/null || { echo "Needs Rust (cargo): https://rustup.rs" >&2; exit 1; }
command -v ar >/dev/null || { echo "Needs ar (binutils) to unpack the build." >&2; exit 1; }

[ -d node_modules ] || npm ci
node scripts/build.mjs
version="$(node -p "require('./package.json').version")"
echo "Building PIXIWYG $version…"
(cd ../tauri && node ../tools/node_modules/@tauri-apps/cli/tauri.js build --bundles deb >/dev/null)
deb="$(ls -t ../tauri/target/release/bundle/deb/*.deb | head -1)"

# INVARIANT: unpack beside the old install, then swap, so a failed unpack never leaves a half-installed app.
work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
(cd "$work" && ar x "$(realpath "$OLDPWD/$deb")" && mkdir root && tar -xf data.tar.* -C root)
mkdir -p "$(dirname "$dest")" "$HOME/.local/bin" "$apps" "$icons"
rm -rf "$dest.new" "$dest.old"
mv "$work/root/usr" "$dest.new"
[ -d "$dest" ] && mv "$dest" "$dest.old"
mv "$dest.new" "$dest"
rm -rf "$dest.old"

ln -sf "$dest/bin/pixiwyg" "$HOME/.local/bin/pixiwyg"
cp ../tauri/icons/icon.png "$icons/pixiwyg.png"
cat > "$apps/pixiwyg.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=PIXIWYG
GenericName=Zine and page designer
Comment=Paint under it. Style on top of it.
Exec=$dest/bin/pixiwyg %U
Icon=pixiwyg
Terminal=false
Categories=Graphics;Publishing;
StartupWMClass=pixiwyg
X-PIXIWYG-Version=$version
DESKTOP

# COMPAT: refresh whichever menu and icon caches the desktop has.
update-desktop-database "$apps" >/dev/null 2>&1 || true
gtk-update-icon-cache -q "$HOME/.local/share/icons/hicolor" >/dev/null 2>&1 || true
command -v kbuildsycoca6 >/dev/null && kbuildsycoca6 >/dev/null 2>&1 || true
echo "Installed PIXIWYG $version. Run it from the menu, or: pixiwyg"

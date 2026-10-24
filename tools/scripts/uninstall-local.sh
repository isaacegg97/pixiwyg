#!/usr/bin/env bash
# INVARIANT: removes what install-local.sh installed; projects stay unless --delete-projects.
# COMPAT: also removes an older Electron install (same paths); its projects were in ~/.config/PIXIWYG.
set -euo pipefail
rm -rf "$HOME/.local/opt/pixiwyg" "$HOME/.local/opt/pixiwyg.new" "$HOME/.local/opt/pixiwyg.old"
rm -f "$HOME/.local/bin/pixiwyg" "$HOME/.local/share/applications/pixiwyg.desktop" "$HOME/.local/share/icons/hicolor/512x512/apps/pixiwyg.png"
update-desktop-database "$HOME/.local/share/applications" >/dev/null 2>&1 || true
command -v kbuildsycoca6 >/dev/null && kbuildsycoca6 >/dev/null 2>&1 || true
if [ "${1:-}" = "--delete-projects" ]; then
  rm -rf "$HOME/.local/share/app.pixiwyg.desktop" "$HOME/.config/PIXIWYG"; echo "Removed PIXIWYG and its projects."
else
  echo "Removed PIXIWYG. Projects stay in ~/.local/share/app.pixiwyg.desktop (and ~/.config/PIXIWYG from the old Electron app)."
fi

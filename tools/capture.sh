#!/bin/bash

# Applies each theme and takes a screenshot of one workspace.
# The screenshots become <theme>/preview.png and assets/shots/<theme>.webp.
#
#   tools/capture.sh                  capture all themes
#   tools/capture.sh synthwave hacker capture the named themes
#
# Environment:
#   WORKSPACE  workspace to capture (default 7)
#   DELAY      seconds to wait after each theme change (default 4)
#
# The script restores the original theme and workspace when it stops.
# It removes only the theme links that it added.

set -uo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
THEMES_DIR="$HOME/.config/omarchy/themes"
STATE_DIR="$HOME/.local/state/omarchy/theme-backgrounds"
WORKSPACE=${WORKSPACE:-7}
DELAY=${DELAY:-4}
RAW="$ROOT/.capture"

mkdir -p "$RAW" "$ROOT/assets/shots"

original_theme=$(cat "$HOME/.local/state/omarchy/current/theme.name")
original_workspace=$(hyprctl activeworkspace -j | jq -r .id)
monitor=$(hyprctl monitors -j | jq -r '.[] | select(.focused) | .name')
created=()

# Hyprland with a Lua config takes Lua dispatchers. Older configs take the plain form.
focus_workspace() {
  hyprctl dispatch "hl.dsp.focus({ workspace = \"$1\" })" >/dev/null 2>&1 || hyprctl dispatch workspace "$1" >/dev/null 2>&1
}

restore() {
  echo "Restoring theme $original_theme and workspace $original_workspace"
  omarchy theme set "$original_theme" >/dev/null 2>&1
  focus_workspace "$original_workspace"
  for name in "${created[@]}"; do
    rm -f "$THEMES_DIR/$name" "$STATE_DIR/$name"
  done
}
trap restore EXIT

if (( $# > 0 )); then
  slugs=("$@")
else
  slugs=()
  for file in "$ROOT"/*/colors.toml; do
    dir=${file%/colors.toml}
    slugs+=("${dir##*/}")
  done
fi

focus_workspace "$WORKSPACE"

count=0
for slug in "${slugs[@]}"; do
  count=$((count + 1))

  # Use a different link name when the user already has a theme with this name.
  name=$slug
  if [[ -e $THEMES_DIR/$name && $(readlink -f "$THEMES_DIR/$name") != "$ROOT/$slug" ]]; then
    name="$slug-capture"
  fi
  if [[ ! -e $THEMES_DIR/$name ]]; then
    ln -s "$ROOT/$slug" "$THEMES_DIR/$name"
    created+=("$name")
  fi

  echo "[$count/${#slugs[@]}] $slug"
  omarchy theme set "$name" >/dev/null 2>&1
  focus_workspace "$WORKSPACE"
  sleep "$DELAY"

  # Stop when another workspace is visible, so no other window is captured.
  if [[ $(hyprctl activeworkspace -j | jq -r .id) != "$WORKSPACE" ]]; then
    echo "Workspace $WORKSPACE is not active. Stopping." >&2
    exit 1
  fi
  grim -o "$monitor" "$RAW/$slug.png"

  magick "$RAW/$slug.png" -resize 1920x -dither FloydSteinberg -colors 256 "PNG8:$ROOT/$slug/preview.png"
  magick "$RAW/$slug.png" -resize 1440x -quality 82 "$ROOT/assets/shots/$slug.webp"
done

#!/bin/bash

# Installs day themes from this repo into ~/.config/omarchy/themes.
#
# Usage:
#   install.sh [options] <theme>...
#   install.sh [options] --all
#
# Options:
#   --all      install all 100 day themes
#   --list     list the theme names
#   --set      apply the last named theme after the install
#   --link     link to this clone instead of copying the files
#   --force    replace a theme with the same name that this script did not install
#   --update   install again every theme that this script installed
#   --remove   remove the named themes that this script installed
#   -h, --help show this help
#
# Examples:
#   ./install.sh synthwave-day --set
#   ./install.sh --all
#   curl -fsSL https://bjarneo.github.io/100-themes-day/install.sh | bash -s -- synthwave-day --set
#
# Without a clone, the script downloads only the themes that you name.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/bjarneo/100-themes-day}"
THEMES_DIR="${OMARCHY_THEMES_DIR:-$HOME/.config/omarchy/themes}"
MARKER=".100-themes-day"

usage() {
  sed -n '3,24p' "${BASH_SOURCE[0]:-}" 2>/dev/null | sed 's/^# \{0,1\}//' && return
  echo "Usage: install.sh [--all | --list | --update | --remove] [--set] [--link] [--force] <theme>..."
}

say() { printf '%s\n' "$*"; }
warn() { printf '%s\n' "$*" >&2; }
die() { warn "$*"; exit 1; }

# Theme names are folder names. Anything else never reaches a path.
valid_slug() { [[ $1 =~ ^[a-z0-9][a-z0-9-]*$ ]]; }

mode=install
all=0 set=0 link=0 force=0
slugs=()

while (( $# > 0 )); do
  case "$1" in
    --all) all=1 ;;
    --list) mode=list ;;
    --update) mode=update ;;
    --remove) mode=remove ;;
    --set) set=1 ;;
    --link) link=1 ;;
    --force) force=1 ;;
    -h | --help) usage; exit 0 ;;
    -*) die "Unknown option: $1. Run install.sh --help." ;;
    *) valid_slug "$1" || die "Not a theme name: $1"; slugs+=("$1") ;;
  esac
  shift
done

# Use this clone when the script runs from one. Otherwise download the repo.
SOURCE=""
script_dir=""
if [[ -n ${BASH_SOURCE[0]:-} && -f ${BASH_SOURCE[0]} ]]; then
  script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
fi
if [[ -n $script_dir ]] && compgen -G "$script_dir/*/colors.toml" >/dev/null; then
  SOURCE=$script_dir
fi

tmp=""
cleanup() { [[ -n $tmp ]] && rm -rf "$tmp"; }
trap cleanup EXIT

# Lists the themes in the source, one name per line.
available() {
  if [[ -n $SOURCE ]]; then
    for file in "$SOURCE"/*/colors.toml; do
      dir=${file%/colors.toml}
      printf '%s\n' "${dir##*/}"
    done
  else
    git -C "$tmp" ls-tree -r --name-only HEAD | sed -n 's#^\([a-z0-9-]*\)/colors.toml$#\1#p'
  fi
}

# Downloads the named themes when the script has no clone.
fetch() {
  [[ -n $SOURCE ]] && return
  command -v git >/dev/null || die "git is not installed. Install git, then run the script again."
  tmp=$(mktemp -d)
  warn "Downloading from $REPO_URL"
  git clone --quiet --depth 1 --filter=blob:none --sparse "$REPO_URL" "$tmp/repo"
  tmp="$tmp/repo"
  if (( $# > 0 )); then
    git -C "$tmp" sparse-checkout set "$@"
  fi
}

# True when this script installed the theme: a copy with the marker file,
# or a link into a clone of this repo.
installed_by_us() {
  local target="$THEMES_DIR/$1" real
  [[ -f $target/$MARKER ]] && return 0
  [[ -L $target ]] || return 1
  real=$(readlink -f "$target")
  [[ ${real##*/} == "$1" && -f $real/colors.toml && -f ${real%/*}/install.sh ]]
}

install_one() {
  local slug="$1" src="$2" target="$THEMES_DIR/$1"

  if [[ -e $target || -L $target ]]; then
    if ! installed_by_us "$slug" && (( ! force )); then
      warn "Skip $slug: $target already exists. Use --force to replace it."
      return 1
    fi
  fi

  mkdir -p "$THEMES_DIR"

  if (( link )); then
    [[ -n $SOURCE ]] || die "--link needs a clone. Clone $REPO_URL, then run ./install.sh --link."
    rm -rf "${target:?}"
    ln -s "$src" "$target"
    say "Linked $slug"
    return 0
  fi

  # Copy to a temporary folder first, so a failed copy never leaves half a theme.
  local staging="$THEMES_DIR/.$slug.installing"
  rm -rf "${staging:?}"
  mkdir -p "$staging"
  cp -r "$src"/. "$staging"/
  printf 'Installed by install.sh from %s\n' "$REPO_URL" >"$staging/$MARKER"
  rm -rf "${target:?}"
  mv "$staging" "$target"
  say "Installed $slug"
}

case $mode in
  list)
    fetch
    available
    exit 0
    ;;

  remove)
    (( ${#slugs[@]} > 0 )) || die "Name the themes to remove. Example: install.sh --remove synthwave-day"
    for slug in "${slugs[@]}"; do
      target="$THEMES_DIR/$slug"
      if [[ ! -e $target && ! -L $target ]]; then
        warn "Skip $slug: not installed"
      elif installed_by_us "$slug"; then
        rm -rf "${target:?}"
        say "Removed $slug"
      else
        warn "Skip $slug: this script did not install $target"
      fi
    done
    exit 0
    ;;

  update)
    slugs=()
    for marker in "$THEMES_DIR"/*/"$MARKER"; do
      [[ -f $marker ]] || continue
      dir=${marker%/"$MARKER"}
      slugs+=("${dir##*/}")
    done
    (( ${#slugs[@]} > 0 )) || die "No themes from this repo are installed in $THEMES_DIR"
    ;;
esac

if (( all )); then
  if [[ -z $SOURCE ]]; then
    command -v git >/dev/null || die "git is not installed. Install git, then run the script again."
    tmp=$(mktemp -d)
    warn "Downloading all themes from $REPO_URL"
    git clone --quiet --depth 1 "$REPO_URL" "$tmp/repo"
    tmp="$tmp/repo"
  fi
  mapfile -t slugs < <(available)
else
  (( ${#slugs[@]} > 0 )) || { usage; exit 1; }
  fetch "${slugs[@]}"
fi

root=${SOURCE:-$tmp}
count=0
last=""
for slug in "${slugs[@]}"; do
  if [[ ! -f $root/$slug/colors.toml ]]; then
    warn "Skip $slug: no such theme. Run install.sh --list to see the names."
    continue
  fi
  if install_one "$slug" "$root/$slug"; then
    count=$((count + 1))
    last=$slug
  fi
done

say "$count theme(s) in $THEMES_DIR"

if (( set )) && [[ -n $last ]]; then
  if command -v omarchy >/dev/null; then
    omarchy theme set "$last"
  else
    warn "The omarchy command is not available. Run: omarchy theme set $last"
  fi
elif [[ -n $last ]]; then
  say "Apply it with: omarchy theme set $last"
fi

# Lay the flake's skills folder (legacyPackages.skills-folder) in
# plugin/skills/, where it is committed for a git install of the plugin:
# the derived skill without the wrapper a Nix install adds. Run by
# refresh-skill; commit what it changes, which `nix flake check` asks for
# after any change to the fragments, the spec, the golden cases, the CLI
# or the core it bundles.
#
# Copied, keeping each file's executable bit. A file that already matches,
# mode and all, is left alone. A file there that the flake no longer makes
# is named, not deleted, for whoever runs this to remove; `nix flake check`
# fails until it's gone.
set -euo pipefail

root="${PRJ_ROOT:?the dev shell sets PRJ_ROOT to the repository}"
built="$(nix build "$root#skills-folder" --no-link --print-out-paths)"
laid="$root/plugin/skills"
mkdir -p "$laid"

runs() {
  if [ -x "$1" ]; then echo yes; else echo no; fi
}

while IFS= read -r file; do
  if ! cmp --silent "$built/$file" "$laid/$file" || [ "$(runs "$built/$file")" != "$(runs "$laid/$file")" ]; then
    mkdir -p "$(dirname "$laid/$file")"
    if [ -x "$built/$file" ]; then
      install -m u=rwx,go=rx "$built/$file" "$laid/$file"
    else
      install -m u=rw,go=r "$built/$file" "$laid/$file"
    fi
    echo "skill/lay.sh: laid plugin/skills/$file"
  fi
done < <(cd "$built" && find . -type f | sed 's|^\./||' | sort)

while IFS= read -r file; do
  if [ ! -e "$built/$file" ]; then
    echo "skill/lay.sh: plugin/skills/$file is no file the flake lays; delete it and commit that" >&2
  fi
done < <(cd "$laid" && find . -type f | sed 's|^\./||' | sort)

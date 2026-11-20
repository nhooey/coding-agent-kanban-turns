# Lay the flake's bundled runtime libraries ($PLUGIN_VENDOR) in
# plugin/vendor/, where they're committed for the marketplace install, so
# the tests, plugin-test and the marketplace load the same files the build
# ships. Run by the dev shell on entry, and by refresh-vendor; commit what
# it changes, which `nix flake check` asks for.
#
# Copied, not linked: the engine refuses a module whose real path is
# outside the plugin's folder. A file that already matches is left alone.
# A bundle there that the flake no longer makes is named, not deleted, for
# whoever runs this to remove; `nix flake check` fails until it's gone.
vendor="${PLUGIN_VENDOR:?the dev shell sets PLUGIN_VENDOR to the bundled libraries}"
laid="${PRJ_ROOT:?the dev shell sets PRJ_ROOT to the repository}/plugin/vendor"

for file in "$vendor"/*/*; do
  target="$laid/${file#"$vendor"/}"
  if ! cmp --silent "$file" "$target"; then
    mkdir -p "$(dirname "$target")"
    install -m u=rw,go=r "$file" "$target"
  fi
done

# Each bundle sits in a folder of its own, so any file or folder at the top
# of plugin/vendor/ that the flake doesn't make is left over, types alone
# included; inside a bundle's folder, a module or a licence is.
for target in "$laid"/* "$laid"/.[!.]* "$laid"/*/*.js "$laid"/*/LICENSE; do
  if [ -e "$target" ] && [ ! -e "$vendor/${target#"$laid"/}" ]; then
    echo "vendor/lay.sh: $target is no bundle the flake makes; delete it and commit that" >&2
  fi
done

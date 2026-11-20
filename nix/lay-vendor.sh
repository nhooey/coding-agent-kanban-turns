# Lay the flake's bundled runtime libraries ($PLUGIN_VENDOR) in
# plugin/vendor/, where they're committed for the marketplace install, so
# the tests, plugin-test and the marketplace load the same files the build
# ships. Run by the dev shell on entry, and by refresh-vendor; commit what
# it changes, which `nix flake check` asks for.
#
# Copied, not linked: the engine refuses a module whose real path is
# outside the plugin's folder. A file that already matches is left alone,
# and a bundle the flake no longer makes is removed by its name; the types
# beside them are left alone.
vendor="${PLUGIN_VENDOR:?the dev shell sets PLUGIN_VENDOR to the bundled libraries}"
laid="$PRJ_ROOT/plugin/vendor"

for file in "$vendor"/*; do
  target="$laid/$(basename "$file")"
  if ! cmp -s "$file" "$target"; then
    install -m 0644 "$file" "$target"
  fi
done

for target in "$laid"/*.js "$laid"/*.LICENSE; do
  if [ -e "$target" ] && [ ! -e "$vendor/$(basename "$target")" ]; then
    rm -- "$target"
  fi
done

# Lay the flake's bundled runtime libraries ($PLUGIN_VENDOR) in
# plugin/vendor/, where the built plugin carries them, so the tests and
# plugin-test load the same files the build ships. Run by the dev shell on
# entry.
#
# Copied, not linked: the engine refuses a module whose real path is
# outside the plugin's folder. A file that already matches is left alone.
for file in "$PLUGIN_VENDOR"/*; do
  target="$PRJ_ROOT/plugin/vendor/$(basename "$file")"
  if ! cmp -s "$file" "$target"; then
    install -m 0644 "$file" "$target"
  fi
done

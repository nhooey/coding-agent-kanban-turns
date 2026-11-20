# Check that plugin/vendor/'s committed bundles ($committed) are the
# flake's ($bundled) byte for byte, with none left over that the flake no
# longer makes: the marketplace installs the committed files, and the
# build, the checks and the dev shell lay the flake's.
refresh="run refresh-vendor in the dev shell, then commit plugin/vendor/"
status=0

for file in "$bundled"/*; do
  name="$(basename "$file")"
  if ! cmp -s "$file" "$committed/$name"; then
    echo "plugin/vendor/$name is not the flake's bundle; $refresh" >&2
    status=1
  fi
done

for file in "$committed"/*.js "$committed"/*.LICENSE; do
  name="$(basename "$file")"
  if [ -e "$file" ] && [ ! -e "$bundled/$name" ]; then
    echo "plugin/vendor/$name is no bundle the flake makes; $refresh" >&2
    status=1
  fi
done

if [ "$status" -ne 0 ]; then
  exit "$status"
fi
touch "$out"

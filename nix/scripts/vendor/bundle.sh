# Bundle the plugin's runtime libraries from the flake's node_modules
# ($nodeModules) into $out, one ES module file each in a folder of its own,
# for plugin/vendor/.
#
# The engine loads only the plugin's own files, so each library goes in as
# a file of the plugin's, which src/config/config.ts imports by a relative
# path. Each file's licence goes beside it, as LICENSE.
#
# esbuild names each source file in a comment, by its path from the
# working folder: run from inside node_modules, those paths start at the
# package's name, so no store path is written into a bundle, where it would
# tie the bundle to this build and keep node_modules in the plugin's
# closure.
mkdir -p "$out/yaml"
cd "$nodeModules"

esbuild yaml/browser/index.js \
  --bundle --format=esm --platform=neutral --log-level=warning \
  --outfile="$out/yaml/yaml.js"
cp yaml/LICENSE "$out/yaml/LICENSE"

if grep --recursive --files-with-matches "$NIX_STORE" "$out"; then
  echo "vendor/bundle.sh: a store path is left in the files above" >&2
  exit 1
fi

# Bundle the plugin's runtime libraries from the flake's node_modules
# ($nodeModules) into $out, one ES module file each, for plugin/vendor/.
#
# The engine loads only the plugin's own files, so each library goes in as
# a file of the plugin's, which src/config.ts imports by a relative path.
# Each file's licence goes beside it.
mkdir -p "$out"

esbuild "$nodeModules/yaml/browser/index.js" \
  --bundle --format=esm --platform=neutral --log-level=warning \
  --outfile="$out/yaml.js"
cp "$nodeModules/yaml/LICENSE" "$out/yaml.LICENSE"

esbuild "$nodeModules/jsonc-parser/lib/esm/main.js" \
  --bundle --format=esm --platform=neutral --log-level=warning \
  --outfile="$out/jsonc-parser.js"
cp "$nodeModules/jsonc-parser/LICENSE.md" "$out/jsonc-parser.LICENSE"

# Bundle the kanban CLI, plugin/cli/kanban.ts, with the core it imports and
# vendor/'s YAML parser, into one ES module, $out/bin/kanban.js, that runs
# under Node 20 or later with no node_modules: what the derived skill runs
# where Node is on the path.
# The YAML parser's licence goes beside it, in share/licenses/yaml/.
#
# $src is plugin/'s cli/, src/, types/ and vendor/. The plugin's defaults
# file goes in as BUNDLED_DEFAULTS, $bundledDefaults being its text as a
# JSON string, since kanban.js runs with no plugin folder beside it. Its
# `#!/usr/bin/env node` line is kept as it is, so it finds whichever Node
# the machine running it has.
#
# esbuild names each source file in a comment by its path from the working
# folder, so the bundle is built from inside $src, and no store path is
# written into it; the derivation's empty allowedReferences holds it to
# that.
mkdir -p "$out/bin" "$out/share/licenses/yaml"
cd "$src"

esbuild cli/kanban.ts \
  --bundle --format=esm --platform=node --target=node20 --log-level=warning \
  --define:BUNDLED_DEFAULTS="$bundledDefaults" \
  --outfile="$out/bin/kanban.js"
chmod +x "$out/bin/kanban.js"
cp vendor/yaml/LICENSE "$out/share/licenses/yaml/LICENSE"

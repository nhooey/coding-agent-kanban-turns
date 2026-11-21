# Build the skill derived from the plugin, $out, a skill folder, as
# plugin/skills/ commits it: SKILL.md and its worked examples in
# examples/, which plugin/tools/skill/build.ts writes from the prose
# fragments, the spec and the golden cases; and, in scripts/, the kanban
# CLI the skill runs, kanban.js ($kanbanJs), with the YAML parser's
# licence, which it bundles, in licenses/yaml/.
#
# $src is plugin/'s cli/, spec/, src/, tools/, types/ and vendor/, with
# package.json for its module type; tools/ reads the cases with the npm
# YAML parser and schema checker, $nodeModules.
cp -R "$src" plugin
chmod -R u+w plugin
ln -s "$nodeModules" plugin/node_modules
node plugin/tools/skill/build.ts "$out"

mkdir -p "$out/scripts" "$out/licenses/yaml"
cp "$kanbanJs/bin/kanban.js" "$out/scripts/kanban.js"
cp "$kanbanJs/share/licenses/yaml/LICENSE" "$out/licenses/yaml/LICENSE"

# Build the standalone kanban binary, $out/bin/kanban: a Node single
# executable application, the flake's Node with kanban.js ($kanbanJs) put
# inside it, as sea.json ($seaConfig) says. It runs with no Node installed,
# but not with no Nix store: the libraries Node links to (ICU, OpenSSL,
# libuv and the rest) stay in the store, in its closure, so it runs where
# that closure is, as packages.plugin carries it.
#
# Node carries its own install prefix, $node, as
# process.config.variables.node_prefix, twice: in the config.gypi text it
# is built with, and in the startup snapshot made from it. The bundled CLI
# never reads it, so the prefix is cut out, keeping Node's own package out
# of the closure, as the derivation's disallowedReferences holds it. Cutting
# it changes bytes inside the snapshot, which works because V8's release
# builds don't verify the snapshot's checksum; should a later Node verify
# it, the binary fails at start, and checks.cli, which runs it, fails too.
#
# On macOS, changing the binary breaks its signature, and the kernel kills
# a binary whose signature doesn't hold, so it is signed again, ad hoc,
# last, where $signs is set, as it is only there.
cp "$kanbanJs/bin/kanban.js" kanban.js
cp "$seaConfig" sea.json
node --build-sea sea.json
chmod u+w kanban
remove-references-to -t "$node" kanban

if [ -n "$signs" ]; then
  codesign -f -s - kanban
fi

mkdir -p "$out/bin" "$out/share/licenses/yaml"
mv kanban "$out/bin/kanban"
cp "$kanbanJs/share/licenses/yaml/LICENSE" "$out/share/licenses/yaml/LICENSE"

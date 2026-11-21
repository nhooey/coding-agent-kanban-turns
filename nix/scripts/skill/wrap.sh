# Build the skill a Nix install carries, $out: the skill's files ($files),
# with scripts/kanban beside scripts/kanban.js, a wrapper that runs it
# with the Nix store's node ($node, nodejs-slim) under $shell, for where
# no Node is on the path. The wrapper finds kanban.js beside itself, by
# the path it was run by ($0), so it runs wherever the folder is copied,
# as packages.plugin copies it into skills/. It is run by that path, as
# the skill's scripts section says: a symlink to it in another folder
# would look for kanban.js beside the symlink. Resolving the link would
# take readlink -f or realpath, which not every system's shell has.
cp -R "$files" "$out"
chmod -R u+w "$out"
printf '%s\n' \
  "#!$shell" \
  "# The kanban CLI, scripts/kanban.js beside this, run by the Nix store's node." \
  "# Run it by its own path, not through a symlink in another folder." \
  'case $0 in */*) here=${0%/*} ;; *) here=. ;; esac' \
  "exec $node/bin/node \"\$here/kanban.js\" \"\$@\"" \
  >"$out/scripts/kanban"
chmod a+x "$out/scripts/kanban"

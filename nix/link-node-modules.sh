# Link plugin/node_modules to the flake's build of the plugin's npm
# dependencies ($PLUGIN_NODE_MODULES), so `npm test` and `tsc` find
# TypeScript with no `npm ci`. Run by the dev shell on entry.
#
# Only a link into the Nix store is replaced, or no node_modules at all: a
# node_modules a developer installed by hand is left alone, with a note.
link="$PRJ_ROOT/plugin/node_modules"
if [ -L "$link" ]; then
  case "$(readlink "$link")" in
    "$NIX_STORE"/* | /nix/store/*) ln -sfn "$PLUGIN_NODE_MODULES" "$link" ;;
  esac
elif [ ! -e "$link" ]; then
  ln -s "$PLUGIN_NODE_MODULES" "$link"
else
  echo "plugin/node_modules is a local install; remove it to use the flake's" >&2
fi

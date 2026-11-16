#!/usr/bin/env bash
# Validate the mod and run its engine-driven tests (mod-tests/) in Claude
# Code's own test runner.
#
#   bash mod/tools/plugin-test.sh
#
# `claude plugin test <folder>` runs every *.test.ts and *.test.tsx under
# the folder, and test/ holds the core's Node tests, which import node:test
# and won't load in the mod's runtime. So the plugin's own files are copied
# to a scratch folder and the runner pointed at that: the manifest, the
# hooks, the core they import, the defaults file, the state contract and
# the engine-driven tests. Nothing is installed and no settings are touched.
set -euo pipefail

mod="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/kanban-answers-test.XXXXXX")"
trap 'rm -rf "$work"' EXIT

mkdir -p "$work/.claude-plugin"
cp "$mod/.claude-plugin/plugin.json" "$work/.claude-plugin/"
for dir in hooks src types defaults mod-tests; do
  if [ -d "$mod/$dir" ]; then
    cp -R "$mod/$dir" "$work/"
  fi
done

claude plugin validate "$work"
claude plugin test "$work"

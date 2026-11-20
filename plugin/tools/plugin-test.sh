#!/usr/bin/env bash
# Validate the plugin and run its engine-driven tests (test/engine/) in
# Claude Code's own test runner.
#
#   bash plugin/tools/plugin-test.sh
#
# `claude plugin test <folder>` runs every *.test.ts and *.test.tsx under
# the folder, and test/unit/ holds the core's Node tests, which import
# node:test and won't load in the plugin's runtime. So the plugin's own files
# are copied to a scratch folder and the runner pointed at that: the
# manifest, the hooks, the core they import, the defaults file, the state
# contract, the bundled parsers the dev shell lays in vendor/ and the
# engine-driven tests, test/engine/ alone of test/.
# Nothing is installed and no settings are touched.
set -euo pipefail

plugin="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
work="$(mktemp -d "${TMPDIR:-/tmp}/kanban-turns-test.XXXXXX")"
trap 'rm -rf "$work"' EXIT

mkdir -p "$work/.claude-plugin"
cp "$plugin/.claude-plugin/plugin.json" "$work/.claude-plugin/"
for dir in hooks src types defaults vendor; do
  if [ -d "$plugin/$dir" ]; then
    cp -R "$plugin/$dir" "$work/"
  fi
done
mkdir -p "$work/test"
cp -R "$plugin/test/engine" "$work/test/"

claude plugin validate "$work"
claude plugin test "$work"

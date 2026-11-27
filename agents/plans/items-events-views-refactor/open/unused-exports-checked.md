---
title: Every file and export is used, and a check fails the build on one that isn't
state: proposed
kind: implementation
part-of: items-events-views-refactor
needs: [hooks-split-by-concern]
touches: [plugin/src/, plugin/hooks/, plugin/cli/, plugin/tools/, plugin/test/, plugin/package.json, plugin/package-lock.json, flake.nix, AGENTS.md]
---

# Every file and export is used, and a check fails the build on one that isn't

The core exports functions freely, since every pure function has a test, and a test's import keeps an export looking alive after its last caller is gone.
The item model replaces most of the core, so much of it loses its callers one node at a time.
A check that knows which exports the plugin itself reaches says, at each step, what the step has orphaned.

- **The check.**
  A well-known tool for unused files and exports, knip unless a better fit is found, runs in `nix flake check`.
  Its entry points are the plugin's own: `plugin/hooks/register.tsx`, `plugin/cli/kanban.ts`, the build steps under `plugin/tools/`, and the tests.
- **Reached by a test alone is unused.**
  A second pass takes the tests out of the entry points and lists every export that only a test reaches.
  Each is deleted with its test, or named in the tool's configuration with the reason it stays, such as a function a node of the items-events-views plan calls.
- **What it finds is removed:** the dead exports, the files nothing imports, and the dependencies in `plugin/package.json` nothing uses.
- **It holds from then on.**
  A node that takes a function's last caller away removes the function in the same commit, or the build fails.
  [reply-prose-readers-retired](../../items-events-views/open/reply-prose-readers-retired.md) ends with the configuration listing no exception.

Checks:

- the check runs in `nix flake check` and passes;
- a test of its configuration finds it failing on a fixture module nothing imports and on a fixture export only a test imports;
- every exception in its configuration has a reason, and names the node that removes it;
- `tests`, `typecheck`, `typecheck-plugin` and `plugin-test` pass.

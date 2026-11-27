---
title: No test compares the core with a copy of code it replaced
state: approved
kind: implementation
part-of: items-events-views-refactor
touches: [plugin/test/oracle/, plugin/test/unit/, plugin/test/fixtures/, plugin/tsconfig.json, AGENTS.md, README.md]
---

# No test compares the core with a copy of code it replaced

`plugin/test/oracle/` holds 13 modules, about 3,400 lines, which 10 differential test files and 2 others read: each a copy of code as it stood before a refactor, kept so a differential test could drive the old and the new through the same inputs.
Every one of those refactors is merged.
An oracle of code that's gone tests nothing the person wants kept, has to compile against every later change to the types, and would have to be rewritten or deleted the moment the item model changes what it mirrors.

## What goes

- **The oracles:** every module under `plugin/test/oracle/`, the old reading of the transcript, the old Submit, refresh and settings handlers, the settlers' chain, the facts read again per reader, the reply's readers, the helpers' copies, the subject key, the raised items and the config.
- **The differential tests** that only compare the core with them: the `*-differential.test.ts` files, and the comparisons in `neutral-turns.test.ts` and `settings-shape.test.ts`.
- **The fixtures only they use,** such as the model of the hooks' interpreter in `plugin/test/fixtures/pane-model.ts` and the random events that drive both sides.
- **The docs' account of them** in `AGENTS.md` and `README.md`.

## What stays true

- **No behaviour loses its only test.**
  Where a differential test is the one place a behaviour is checked, a unit or property test of the code itself is written first, stating the behaviour and not the equality.
- **A differential test is scaffolding.**
  A later refactor may still drive old against new while it moves, as [pane-view-state](../../items-events-views/open/pane-view-state.md) does, and the oracle goes in the commit that finishes the move, never left on the default branch.

Checks:

- `plugin/test/oracle/` doesn't exist, no test file's name holds `differential`, and no test imports a copy of replaced code;
- every fixture module under `plugin/test/fixtures/` is imported by a test;
- for each deleted differential test, the commit message names the unit or property test that holds its behaviour, or says the behaviour went with the code;
- `tests` and `typecheck` pass, and `nix flake check` passes.

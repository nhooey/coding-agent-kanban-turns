---
title: The core's folders are the model's layers, and a check holds every import to one direction
state: proposed
kind: implementation
part-of: items-events-views-refactor
needs: [compatibility-code-deleted, refactor-oracles-deleted]
touches: [plugin/src/, plugin/hooks/, plugin/cli/, plugin/tools/, plugin/test/, plugin/package.json, plugin/package-lock.json, flake.nix, AGENTS.md, README.md]
---

# The core's folders are the model's layers, and a check holds every import to one direction

The item model of [items-events-views](../../items-events-views/open/items-events-views.md) keeps 4 layers apart: harness entities, artefacts, items and views.
The core's folders are `transcript/`, `items/`, `pane/`, `lint/`, `protocol/`, `config/`, `text/` and `json/`, which name what the code reads and not which layer it is, and nothing stops a module importing from any other: `items/roll-up.ts` imports from `pane/`, and `transcript/claude-code.ts` from `items/`.
The folders become the layers before the model's modules are written, so each lands in its layer and a wrong import fails the build on the day it's written.

## The layers

| Folder               | Holds                                                                                                      | May import                           |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `src/protocol/`      | The module the spec compiles to, the rules derived from it, the prose and the tools' schemas               | the support folders                  |
| `src/harness/`       | The neutral turns, the Claude Code adapter that builds them, and the harness's entities and their statuses | `protocol/`                          |
| `src/artefacts/`     | What lives outside the session, a pull request or a CI run, and how its status is read                     | `protocol/`                          |
| `src/items/`         | The item, the event, the fold, the reference grammar and the derived fields                                | `protocol/`, `harness/`, `artefacts/` |
| `src/views/`         | The renderer, the tree, the count line, a reply's references, and the view state with its step             | every layer above it in this table   |
| `src/config/`, `src/text/`, `src/json/` | Support: the settings, text in a terminal, JSON read safely                             | each other                           |
| `hooks/`, `cli/`, `tools/` | The edges: effects, the engine's elements, the build steps                                           | any of the above                     |

- **Imports go one way,** from views towards protocol, and never back: no layer imports one below it in the table, `harness/` and `artefacts/` don't import each other, and nothing in `src/` imports from `hooks/`, `cli/` or `tools/`.
- **Every layer may import the support folders,** which import no layer.
- **`src/` has no effects:** no module there imports `claude-code`, a Node built-in or the clock.
- **The types are shared.**
  `plugin/types/index.d.ts` is imported by every layer, and holds no code.

## What it does

- **The folders are renamed and their modules sorted.**
  `transcript/` becomes `harness/`, and `pane/` becomes `views/`; `lint/` moves into `harness/`, beside the reply's readers it uses, until [reply-prose-readers-retired](../../items-events-views/open/reply-prose-readers-retired.md) takes it out; `src/artefacts/` begins with the pull request's reference and the `gh` call's arguments, out of `items/outstanding.ts`.
  The tests' folders under `plugin/test/unit/` follow.
  The nodes of the items-events-views plan name today's paths in their `touches`; each reads as its layer's folder.
- **The two wrong-way imports go.**
  `items/roll-up.ts` takes the subscript digits from the protocol's rules, not from the pane's sections; and the adapter builds turns without calling the items' reader, which reads the turns it's given.
  The second sets the rule the model keeps: the harness layer gives turns, and the items layer reads events out of them.
- **A check holds it.**
  A well-known dependency checker, dependency-cruiser unless a better fit is found, runs in `nix flake check` with the table above as its rules, and fails on an import the wrong way, a cycle between modules, or an effect imported into `src/`.
  It lists no exception.

## Refactored as it goes, not here

- **`items/outstanding.ts`,** 1,100 lines of settlers, facts and the roll-up's inputs, isn't split: [reply-prose-readers-retired](../../items-events-views/open/reply-prose-readers-retired.md) deletes it, bar what this node moves to `artefacts/`.
- **`views/pane-state.ts`** is split by [pane-view-state](../../items-events-views/open/pane-view-state.md) as its last atoms move in.
- **`tools/spec/load.ts`** is split by section by [item-model-in-spec](../../items-events-views/open/item-model-in-spec.md).

Checks:

- `plugin/src/` holds the folders in the table and no other, and `plugin/test/unit/` mirrors them;
- the dependency check passes in `nix flake check` with no exception listed, and a test of its rules finds it failing on a fixture import from `items/` into `views/`, from `harness/` into `items/`, and of `claude-code` into `src/`;
- no behaviour changes: `tests`, `typecheck`, `typecheck-plugin` and `plugin-test` pass, with the test files changed only in their import paths;
- `AGENTS.md`'s layout section and `README.md`'s file table name the layers.

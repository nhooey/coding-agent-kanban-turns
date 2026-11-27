---
title: The plugin's code is one module per layer with imports one way, effects only in the hooks, and nothing kept for what came before or left unused
state: approved
kind: end-state
---

# The plugin's code is one module per layer with imports one way, effects only in the hooks, and nothing kept for what came before or left unused

This is the ground the item model of [items-events-views](../../items-events-views/open/items-events-views.md) is built on, cleared before that plan's nodes start.
The plugin has one user, so the status quo is ignored: nothing is kept because it's there.
The design both plans rest on is the report [The ideal work model for the kanban mod](../../../reports/2026-11-27-ideal-work-model.md), whose section 9.2 holds the person's rule for this one.

In the plugin's code:

- **One module per layer.**
  The core, `plugin/src/`, is a folder per layer of the model, harness entities, artefacts, items and views, over the protocol's rules, with the support folders beside them.
- **Imports go one way.**
  A layer imports only the layers it's built on, from views towards the protocol, and never back; the core imports nothing from the hooks, the CLI or the build steps.
- **Effects only in `hooks/`.**
  The core has no I/O, no clock and no import of the engine.
  A hooks module maps a value the core returns onto the engine's elements, or runs one effect, and decides nothing.
- **`register.tsx` is wiring.**
  It registers each hook, tool and command by name, and holds nothing else.
- **No compatibility code.**
  There is no warning for a retired setting, no alias for an older name, no option kind kept for older replies, and no conversion of a stored shape.
- **No unused code.**
  Every file and export is reached by the plugin itself, and the tests hold no copy of code that was replaced.

## Checks

- **One module per layer.**
  `plugin/src/` holds `protocol/`, `harness/`, `artefacts/`, `items/` and `views/`, with the support folders `config/`, `text/` and `json/`, and no other; `plugin/test/unit/` mirrors them.
- **No import in the wrong direction.**
  A dependency check in `nix flake check` finds every import going one way, as [core-folders-are-layers](core-folders-are-layers.md)'s table says, and no cycle between modules.
  It lists no exception, and a test of its rules finds it failing on a fixture import the wrong way.
- **Effects only in `hooks/`.**
  The same check finds no module of `plugin/src/` importing `claude-code`, a Node built-in or the clock, and none importing from `plugin/hooks/`, `plugin/cli/` or `plugin/tools/`.
  No hooks module holds a condition that isn't about the engine's API.
- **`register.tsx` reduced to wiring.**
  A test parses `plugin/hooks/register.tsx` and finds imports and registrations alone: no element, no atom, no effect and no function body other than the registering one.
  No module under `plugin/hooks/` is over 400 lines.
- **No compatibility code.**
  A search of `plugin/` outside the generated files finds no `RETIRED`, no `aliases` key, no `taught` and no `untaught`, and no code that converts a value an older build stored.
  A settings file with a key the plugin doesn't read is refused as unknown.
- **No unused exports.**
  A check in `nix flake check` finds no file, export or dependency unused, and no export reached by a test alone.
  Every exception it lists has a reason and names the node of the items-events-views plan that removes it; that plan's end state holds the list to none.
- **No oracle of replaced code.**
  `plugin/test/oracle/` doesn't exist, and no test file's name holds `differential`.
- **No behaviour changes.**
  The plugin does what it did before, bar what the compatibility code did: the engine tests pass unchanged, and `tests`, `typecheck`, `typecheck-plugin` and `plugin-test` pass.

## Its parts

Each `needs` the ones before it that it builds on:

1. [compatibility-code-deleted](compatibility-code-deleted.md): the retired settings' warnings, the aliases and the untaught option kind go.
2. [refactor-oracles-deleted](../closed/refactor-oracles-deleted.md): the tests' copies of replaced code go.
3. [core-folders-are-layers](core-folders-are-layers.md), after both: the core's folders are the layers, and a check holds the imports one way.
4. [hooks-split-by-concern](hooks-split-by-concern.md), after that: `register.tsx` is a module per concern.
5. [unused-exports-checked](unused-exports-checked.md), last: a check fails the build on an unused file or export.

The first two delete, so the moves that follow carry less; the layers come before the hooks' split, so a condition moved out of a hook lands in its layer; and the unused-exports check comes last, over the files as they then stand.

## What changes for the person

Nothing, bar what the compatibility code did:

- a settings file that still holds a retired key, such as `pane.hints`, is refused as a file with an unknown key is, with no word on what to set instead;
- a list an older reply wrote under an earlier header, such as `Unfinished` or `To do`, is no longer read as a list;
- an option an older reply drew with 👍 or 👎 is no longer read as an option.

## What it leaves to the model's plan

What is better refactored by the node that rewrites it stays in [items-events-views](../../items-events-views/open/items-events-views.md), named in that node under **Refactored as it goes**:

- the spec's build step, `tools/spec/load.ts`, split by section, in [item-model-in-spec](../../items-events-views/open/item-model-in-spec.md);
- the pane's state module, split by part, in [pane-view-state](../../items-events-views/open/pane-view-state.md);
- the `gh` reader's move to the artefacts layer, in [harness-observations-as-events](../../items-events-views/open/harness-observations-as-events.md);
- the 1,100 lines of settlers in `items/outstanding.ts`, which aren't tidied at all: [reply-prose-readers-retired](../../items-events-views/open/reply-prose-readers-retired.md) deletes them, with the lists and their readers.

## What the model's plan waits on

| Node of items-events-views                                                                       | Needs                                                     | Why                                                    |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------ |
| [item-model-in-spec](../../items-events-views/open/item-model-in-spec.md)                         | [compatibility-code-deleted](compatibility-code-deleted.md) | the spec it extends has no alias and no untaught kind  |
| [item-event-reducer](../../items-events-views/open/item-event-reducer.md)                         | [core-folders-are-layers](core-folders-are-layers.md)     | the fold lands in the items layer, under the check     |
| [item-tool-declares-events](../../items-events-views/open/item-tool-declares-events.md)           | [hooks-split-by-concern](hooks-split-by-concern.md)       | the tool's handler lands in the tools' module          |
| [item-renderer-densities](../../items-events-views/open/item-renderer-densities.md)               | [hooks-split-by-concern](hooks-split-by-concern.md)       | the renderer's elements land in a module of their own  |
| [reply-prose-readers-retired](../../items-events-views/open/reply-prose-readers-retired.md)       | [unused-exports-checked](unused-exports-checked.md)       | the check says what the deletion orphans               |

## Open questions

| #   | Question                                             | Options                                                                        | Recommendation                                                                                                                                                         |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Which tools check the layers and the unused exports? | dependency-cruiser and knip; an ESLint rule set; a script of the plugin's own  | dependency-cruiser and knip, each well known and doing one job, as the style rule asks. The nodes name them as the default, and the implementer may pick a better fit. |

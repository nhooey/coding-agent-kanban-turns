---
title: The hooks are a module per concern, and `register.tsx` only registers them
state: approved
kind: implementation
part-of: items-events-views-refactor
needs: [core-folders-are-layers]
touches: [plugin/hooks/, plugin/src/views/, plugin/test/unit/, plugin/test/engine/, plugin/tsconfig.plugin.json, flake.nix, AGENTS.md, README.md]
---

# The hooks are a module per concern, and `register.tsx` only registers them

`plugin/hooks/register.tsx` is one file of 2,277 lines and 74 top-level declarations: the atoms, the effects' interpreter, the pane's elements, a reply's drawing, the line above the prompt, the tools and their rows, the instructions, the turn's-end lint, the commands and the registration itself.
Almost every node of the [items-events-views](../../items-events-views/open/items-events-views.md) plan changes the hooks, so as one file it's where their work would collide, and where a decision can hide among elements.
It's split before they start, so the item tool, the renderer and the tree each land in a file of their own, and the old pane's files are deleted whole when the tree replaces them.

## What is true when it's done

- **One module per concern** under `plugin/hooks/`:

  | Module            | Holds                                                                    |
  | ----------------- | ------------------------------------------------------------------------ |
  | `register.tsx`    | The registration alone: each hook, tool and command, by name             |
  | `state.ts`        | The atoms, and `dispatch`                                                |
  | `effects.ts`      | The interpreter that runs each effect `step` returns                     |
  | `pane.tsx`        | The pane's elements                                                      |
  | `reply.tsx`       | A reply's drawing and the boxes under it                                 |
  | `prompt-line.tsx` | The line above the prompt                                                |
  | `tools.tsx`       | The tools' handlers and their rows                                       |
  | `instructions.ts` | What reaches the agent's context, and the turn's-end lint's note         |
  | `commands.ts`     | The slash commands                                                       |
  | `settings.ts`     | The settings files' read                                                 |

- **`register.tsx` is wiring.**
  It imports the modules and registers what they export, and holds no element, no atom, no effect and no function with a decision in it.
- **A hooks module maps or runs, and decides nothing.**
  Each maps what a pure function of the core returns onto the engine's elements, or runs one effect and dispatches its result.
  A condition found there that isn't about the engine's API moves into the core, as a pure function with a test.
- **The table that picks an answer's view by a list's feedback,** `ANSWER_VIEWS`, moves with the reply's and the pane's elements, and goes when [item-renderer-densities](../../items-events-views/open/item-renderer-densities.md) draws every control by one function.
- **Nothing changes from outside.**
  The hooks, tools and commands register under the same names, in the same order.

Checks:

- `plugin/hooks/register.tsx` holds imports and registrations alone: a test parses it and finds no JSX element, no `atom(` and no function body other than the registering one;
- no module under `plugin/hooks/` is over 400 lines;
- the dependency check finds no cycle among the hooks' modules, and none imported by `plugin/src/`;
- the engine tests in `plugin/test/engine/` pass unchanged, and `typecheck-plugin` and `plugin-test` pass in the dev shell;
- each condition moved into the core has a unit test, named in the commit message;
- `AGENTS.md`'s line on `hooks/` and `README.md`'s file table name the modules.

---
title: The derived skill teaches the item model and declares events through the CLI, built from the same spec, fragments and cases
state: approved
kind: implementation
part-of: items-events-views
needs: [item-tool-declares-events, reply-refers-to-items]
touches: [plugin/cli/, plugin/tools/skill/render.ts, plugin/tools/skill/build.ts, plugin/src/transcript/claude-code.ts, plugin/spec/fragments/, plugin/spec/cases/, plugin/skills/, plugin/test/unit/cli/, plugin/test/built/, README.md, AGENTS.md]
---

# The derived skill teaches the item model and declares events through the CLI, built from the same spec, fragments and cases

The plugin carries a skill built from it, the fallback where its hooks don't load and the whole protocol for a harness that loads skills and no plugins.
It follows the item model as it follows every change: nothing in it is written by hand.

- **`SKILL.md`** is the instructions' fragments, filled in from the spec, with the CLI in place of the plugin's tools: the item model, when to raise an item and how to change it, how a reply refers to items, and how the person answers.
  Its frontmatter's description says the same, and names no list.
- **The CLI declares events.**
  `kanban item` takes the item tool's input, as JSON or as arguments, folds the session's log, steps each event through [the fold](item-event-reducer.md) and prints what the tool's result says: each accepted item's line with its id, and each refusal with its rule.
  It exits 0 when every event is accepted, and 1 when one is refused.
- **The log stays in the transcript.**
  For each accepted event the CLI prints one marked line of JSON, and the Claude Code adapter reads those lines from the command's result into the turn's `events`, as it reads the item tool's calls (open question 10 in [the end state](items-events-views.md)).
  The CLI writes no file, so a rewind, a fork or a resume moves the items there too.
  A harness that gives neutral turns passes their `events` itself.
- **The CLI reads the board.**
  `kanban board` prints every item that isn't closed, at line density, grouped by the first facet, as text; `--json` gives the items.
  `kanban turn-id` stays.
- **With no plugin, the agent prints what the plugin would draw.**
  A reply refers to items by id there too.
  Since nothing draws the references, the skill has the agent close its reply on the lines `kanban board` gives for the items that await the person, copied as printed.
  This is the one place prose restates items, and the copy comes from the fold.
- **The examples** are built from the golden cases not marked `example: false`: each a log, the replies that refer to it, and the items it folds to.
- **Built by the flake, and held to it.**
  `packages.plugin` carries the skill under `skills/`, `packages.skill-standalone` is the same folder, the committed copy in `plugin/skills/` is held to the flake's build, and two builds of one commit are the same.
- **The old skill's retirement is its own node,** [kanban-skill-retired](../../plugin-sole-source/open/kanban-skill-retired.md), which this one neither waits on nor changes.

Checks:

- unit tests in `plugin/test/unit/cli/` for `item` and `board`: an accepted event, a refused one and its exit code, and the marked line the adapter reads back into the same event;
- `plugin/test/built/` runs the built `kanban.js` on every golden case;
- a test that the rendered `SKILL.md` names no list and no retired command, and teaches every verb and kind the spec holds;
- `nix flake check` builds the plugin with the skill, and finds the committed skill the same as the flake's;
- in a session with the skill and no plugin hooks, an item declared through `kanban item` is on `kanban board`, and an answer typed as `12.B` closes it.

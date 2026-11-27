---
title: Every tool the plugin registers draws its call as one line, its name and a short summary of its result, by one rule
state: approved
kind: implementation
part-of: items-events-views-refactor
needs: [hooks-split-by-concern]
touches: [plugin/hooks/, plugin/src/protocol/, plugin/src/views/, plugin/test/unit/, plugin/test/engine/, AGENTS.md, README.md]
---

# Every tool the plugin registers draws its call as one line, its name and a short summary of its result, by one rule

The engine's row for a tool call prints the call's input.
A `kanban_lint` call's input is a whole draft reply, about 40 lines, so the transcript shows the reply twice, once as the tool's input and once as the reply.
Only `kanban_options` has a row of its own, a case in the `ToolUse` and `ToolResult` hooks that names that one tool.
One rule draws every tool's row, so a tool added later, such as the item tool of [item-tool-declares-events](../../items-events-views/open/item-tool-declares-events.md), gets a compact row by being registered.

## What is true when it's done

- **One rule for every tool.**
  In the transcript's compact view, a call to any tool the plugin registers is one line: the tool's name and a short summary of its result, such as `kanban_lint · 2 findings` or `kanban_outstanding · 3 open`.
  The line holds none of the call's input.
- **The engine's full row stays where it says more:** a call that ended in an error, a call that was interrupted, and the expanded view, ctrl+o.
- **Where the engine draws a result apart from its call's row,** such as the view after a compaction, the result's line draws nothing in the compact view, since the row holds the summary.
- **No tool has a case of its own.**
  The `ToolUse` and `ToolResult` hooks ask whether the tool is one of the plugin's, never which, and the case for `kanban_options` alone goes.
  `kanban_options` draws its one line as the others do, and its items are drawn under the reply as before.
- **Each tool's summary comes from the tool's own definition.**
  A tool's definition holds one pure function from its result to its summary, which gives the result's first line or a summary the tool declares.
  The rule that picks the row, and each tool's summary, are pure functions of the core with a test each; the hooks map what they return onto the engine's elements.

Checks:

- an engine test finds that each registered tool's compact row is one line and holds no text of its input;
- an engine test finds that an error, an interrupted call and ctrl+o each draw the engine's full row;
- a test finds no tool's name in the `ToolUse` and `ToolResult` hooks, and a tool registered in a fixture with no row of its own draws the one line;
- each tool's summary function has a unit test, and so does the rule that picks the row;
- `typecheck-plugin` and `plugin-test` pass in the dev shell;
- `README.md` says how a tool call is drawn.

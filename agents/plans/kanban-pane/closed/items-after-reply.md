---
title: A reply's Decide items are drawn with their buttons directly under the reply, and the tool row above it draws nothing
state: implemented
kind: implementation
part-of: kanban-pane
needs: [pane-lists-raised-items]
touches: [plugin/hooks/register.tsx, plugin/src/links.ts, plugin/plugin-tests/]
---

# A reply's Decide items are drawn with their buttons directly under the reply, and the tool row above it draws nothing

- **The reply carries them.** The `AssistantMessage` block whose text holds the items' summaries, as `linkedQuestions` matches them, draws its Markdown with the question links, then those items' boxes, drawn as the pane draws them, settled ones dimmed.
- **The tool row steps aside.** In its plain view, as `isPlainToolRow` tells it, the `kanban_options` `ToolUse` row draws an empty `Box`, as `ToolResult` does; expanded, failed, interrupted or with no items, the engine draws it.
- **A question link goes to the pane.** A press on an item's summary in the reply opens the pane with the keyboard and scrolls it to that item, where the engine allows it.

---
title: The tool row draws every item with its list's controls
state: approved
kind: implementation
part-of: kanban-answers-in-transcript
needs: [kanban-mod-reads-transcript, kanban-mod-instructions]
touches:
  [
    plugins/coding-agent-kanban-answers/hooks/register.tsx,
    plugins/coding-agent-kanban-answers/hooks/answers.ts,
  ]
---

# The tool row draws every item with its list's controls

- The `ToolUse` hook for `kanban_items` draws one border per item, keyed by its ref, `9efb08a1.Todo.1`, so the band can scroll to it.
- `itemView` splits by list: the Decide view it has now, a Todo view, a Review view and a plain view for Pending and Waiting, sharing the notes field and the dimmed settled state.
- A Decide option is a row Box: a one-column Box, `width={1}` and `alignSelf="stretch"`, so it runs the option's full height, then the option's lines in a column. The bar has no `backgroundColor` until the pointer is on the option, `hover: { scope, backgroundColor }`; a picked option shows its picked glyph instead, and only a picked 👍 or 👎, which has no other glyph, keeps the bar coloured. Ink has no one-sided border, so the bar is this Box rather than a border. The picked glyph replaces 🔘 or 🔲 in the name line, and the `backgroundColor` and `inverse` highlights on the option's lines go.
- A Todo item's border opens on a 🔲. An absolutely placed ✅ sits over it, drawn `display: "none"` with `hover: { display: "flex" }`, so the pointer on the 🔲 shows the ✅ without moving anything. A click puts `done` in the basket and draws the ✅ in place of the 🔲 for good; a click on the ✅ takes the entry out and brings the 🔲 back.
- Review's 🔗 opens the link with the engine's own link handling; Todo's command is copied with the engine's clipboard call, where the surface has one.
- Clicks go to the basket (`kanban-answers-basket`), not to the prompt draft.

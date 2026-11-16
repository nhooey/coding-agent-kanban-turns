---
title: The tool row draws the turn's Decide items with their buttons, marked by a bar
state: approved
kind: implementation
part-of: kanban-answers-in-transcript
needs: [kanban-mod-instructions]
touches: [mod/hooks/register.tsx, mod/src/items.ts, mod/src/answers.ts]
---

# The tool row draws the turn's Decide items with their buttons, marked by a bar

- The `ToolUse` hook for `kanban_options` draws one border per Decide item, keyed by its ref, `9efb08a1.Decide.2`.
- A Decide option is a row Box: a one-column Box, `width={1}` and `alignSelf="stretch"`, so it runs the option's full height, then the option's lines in a column. The bar has no `backgroundColor` until the pointer is on the option, `hover: { scope, backgroundColor }`; a picked option shows its picked glyph instead, and only a picked 👍 or 👎, which has no other glyph, keeps the bar coloured. Ink has no one-sided border, so the bar is this Box rather than a border. The picked glyph replaces 🔘 or 🔲 in the name line, and the `backgroundColor` and `inverse` highlights on the option's lines go.
- Clicks go to the basket (`kanban-answers-basket`), not to the prompt draft.
- A settled item's border dims and its buttons do nothing.

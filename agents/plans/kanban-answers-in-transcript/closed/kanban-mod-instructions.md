---
title: The mod tells the agent to call its tool before a reply with Decide items
state: implemented
kind: implementation
part-of: kanban-mod-own-repository
needs: [kanban-mod-split]
touches: [mod/hooks/register.tsx, mod/src/instructions.ts]
implemented-by: "Close the plan node for the mod's own tool instructions"
---

# The mod tells the agent to call its tool before a reply with Decide items

- A `prompt.context` hook adds the mod's instructions to each turn: before writing a final response that holds Decide items, call `kanban_options` once, so their buttons sit just above the reply; its input is `{"items": [...]}`, one entry per Decide item of that response, with the turn id, the item's number and summary, its kind (`radio`, `checkbox` or `binary`, from its glyphs) and each option's letter, name, consequence and ➕ and ➖ lines as `pros` and `cons`. The final response is written exactly as it would be without the tool.
- This is the paragraph the kanban skill's "Buttons for the options" section held; the skill no longer carries it, so the mod is where an agent learns of the tool.
- The instructions are a TypeScript string in `src/instructions.ts`, with a test that the hook adds them, and that they name the tool the mod registers.
- The turn-response format itself stays in the skill; the mod adds only what concerns its own tool.

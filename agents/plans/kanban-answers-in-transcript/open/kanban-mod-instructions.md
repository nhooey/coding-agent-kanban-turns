---
title: The mod tells the agent the turn-response format and where the items go
state: approved
kind: implementation
part-of: kanban-mod-own-repository
needs: [kanban-mod-split]
touches: [hooks/register.tsx, hooks/instructions.ts]
---

# The mod tells the agent the turn-response format and where the items go

- A `prompt.context` hook adds the mod's instructions to each turn: the progress-update line, the 8 lists and what each holds, the shape of a Decide item, and the rule that every item goes in one `kanban_items` call before the final response, whose text keeps only what isn't an item.
- The instructions are a TypeScript string in `hooks/instructions.ts`, written from the skill's SKILL.md and trimmed to what the agent writes; what the mod draws itself, such as the 📌 roll-up, the 🔖 tags and the header underlines, is left out.
- If the kanban skill is loaded anyway, a `skill.prompt` hook for `coding-agent-kanban-turn-responses` replaces its text with one line saying the mod handles turn responses, so the two never both apply.

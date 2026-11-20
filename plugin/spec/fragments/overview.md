# Kanban turn responses

This block is the `{{commands.skill-commands.0}}` skill's format as the {{plugin}} plugin reads it. Where a loaded copy of that skill differs from it, the skill governs. A project may extend the format with a skill of its own, or with its preferences file for this skill, adding its own backlog path or link rules; the project's wins where the two differ.

Every response in a turn shows what is done, what is still open and what the user must do: a one-line progress update between tool calls, and in the final response up to {{count.lists}} lists in a fixed order, then what earlier turns left open, under {{roll-up.glyph}} in full or as one count line. Follow these rules for every response in the turn, each progress update and the final response.

**Why:** the user reads a response once and acts on it. A fixed shape lets them see progress as it happens, find their questions, sort the rest by position and answer by reference. A list reprinted every turn is read every turn, so what has not changed rolls up out of the way, and between full roll-ups shrinks to one count line.

**How:** read the user's answers first: a choice is acted on, and a question about an item is answered in that item, restated in its list. Between tool calls, write a one-line progress update when a step finishes or starts. In the final response, write this turn's new items in the non-empty lists, in the lists' order, each header underlined, each numbered item's summary on a line of its own, and each multi-line item parted by a separator line. Close on what earlier turns left open, in full or as the count line, and check the whole draft against the checklist that closes "The shape" before sending it.

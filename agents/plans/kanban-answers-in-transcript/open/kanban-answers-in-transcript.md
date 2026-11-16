---
title: Every kanban item is answered where it sits in the transcript, and sent in one prompt
state: approved
kind: end-state
part-of: kanban-mod-own-repository
---

# Every kanban item is answered where it sits in the transcript, and sent in one prompt

With the coding-agent-kanban-answers mod loaded:

- **The band is the one global interface; the items stay in the transcript.** The band above the prompt lists and steps through what is open; the items themselves, and every interaction with them, stay where they were printed.
- **The reply holds no items.** With the mod's tool in the agent's listing, the final response is only what isn't an item: its opening prose, and any table or explanation that belongs to no item. Every list item, the 📌 roll-up and the count line go to the tool row and the band instead, so nothing is printed twice and the mod never rewrites the reply.
- **One row holds the turn's items.** The tool row just above a final response, the one that printed `Drew buttons for 1 Decide items above the final response`, draws every item of the turn's 8 lists, Done, Pending, Logged, Waiting, Answers, Review, Todo and Decide, in that order, each in its own border with the controls its list calls for. The engine's line for the call shows only in ctrl+o or when the call failed.
- **Each list has its own controls.**

  | List                  | Controls                                                                                                                                                                                                                  |
  | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | Decide                | the options, one or many by kind; a notes field                                                                                                                                                                           |
  | Todo                  | a 🔲 before the summary: the pointer on it shows ✅ in its place, a click marks the item done, and the ✅ stays until a second click takes it back; ⏭️ not now; a notes field; a command item's command copied by a click |
  | Review                | 🔗 open, which opens the link; 👀 looked; a notes field for a comment                                                                                                                                                     |
  | Pending, Waiting      | none to answer; a notes field, for a word on the work                                                                                                                                                                     |
  | Done, Logged, Answers | none: shown, to be read                                                                                                                                                                                                   |

- **An option is marked by a bar, not a background.** Each Decide option, its name line and every ➕, ➖ and note line under it, has a one-column bar down its left side for its whole height. The bar shows only while the pointer is anywhere on the option. A click swaps the option's glyph for its picked glyph, 🔘 for 🔵 and 🔲 for 🟦, which stays until a second click on the same option unpicks it and brings the 🔘 or 🔲 back. A picked 👍 or 👎 keeps its glyph and is marked by the bar's colour staying on. No line of the option changes its background.
- **Answers gather in the mod, not the prompt.** A click or a note adds to a basket the mod keeps; nothing is written into the prompt draft and nothing is sent until Submit.
- **A short navigator above the prompt.** In place of today's band, a few lines: a header, `🧠 4 open`, with ⏪, ⏩ and `📨 Submit (n)`; then the outstanding items, every open Pending, Waiting, Review, Todo and Decide item of this and earlier turns, the ones the 📌 roll-up names, one short line each, grouped by list, each opening on a dot, `●` once the basket answers it, `○` until then, the shown item's ringed. A click on an item's line, or ⏪ and ⏩, scrolls the transcript to that item's border in its row, wherever in the transcript it is. When the list is longer than the rows the navigator has, it scrolls inside itself.
- **Submit sends one prompt.** Each basket entry becomes one line, `9efb08a1.Decide.2.B: note`, `9efb08a1.Todo.1: done`, `9efb08a1.Review.1: looked, comment`, after any text already in the prompt draft, submitted as one prompt; the basket empties.
- **The mod reads every one of those lines.** A Todo or Review item answered by reference is settled as a Decide item is, so the band's dots and the next turn agree.
- **Settled items dim.** Once a refresh finds an item no longer open, its border dims and its controls do nothing.
- **Without the mod, the skill applies.** An agent without the mod uses the kanban skill, whose replies carry their lists as they do today; every answer can still be typed by reference.

Checks: the mod's repository's checks pass with a test for each bullet above, and the mod's own tests cover the Todo and Review answers.

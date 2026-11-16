---
title: Kanban items stay in the reply; the band holds the status, Submit and the answers waiting to be sent
state: approved
kind: end-state
part-of: kanban-mod-own-repository
---

# Kanban items stay in the reply; the band holds the status, Submit and the answers waiting to be sent

With the coding-agent-kanban-answers mod loaded:

- **The reply keeps its items.** The agent writes its turn response as the `coding-agent-kanban-turn-responses` skill says, every list in the reply's text, and `reassess` restates every open item in the latest reply. The mod never rewrites the reply and never prints an item a second time.
- **Decide items get buttons.** Before a reply with Decide items, the agent calls the mod's `kanban_options` tool; the tool row just above the reply draws each Decide item's options as buttons, with a notes field.
- **An option is marked by a bar, not a background.** Each Decide option, its name line and every ➕, ➖ and note line under it, has a one-column bar down its left side for its whole height. The bar shows only while the pointer is anywhere on the option. A click swaps the option's glyph for its picked glyph, 🔘 for 🔵 and 🔲 for 🟦, which stays until a second click on the same option unpicks it. A picked 👍 or 👎 keeps its glyph and is marked by the bar's colour staying on. No line of the option changes its background.
- **Answers gather in the mod, not the prompt.** A click or a note adds to a basket the mod keeps; nothing is written into the prompt draft and nothing is sent until Submit.
- **The band shows the status and the basket.** Above the prompt: a header with the open counts, as the skill's count line names them, `🚧 1 · 🤔 2 · 🔍 1 · 🧠 3`, and `📨 Submit (n)`; under it one line per basket entry, `9efb08a1.Decide.2.B: note ✖`, the ✖ taking that entry out.
- **Submit sends one prompt.** Each basket entry becomes one line, `9efb08a1.Decide.2.B: note`, after any text already in the prompt draft, submitted as one prompt; the basket empties.
- **Settled items dim.** Once the mod finds a Decide item answered, its buttons dim and do nothing.
- **Without the mod, the skill alone applies.** Every answer can still be typed by reference.

Checks: the mod's repository's checks pass with a test for each bullet above.

---
title: Kanban items stay in the reply, with the Decide buttons under it and in the pane
state: approved
kind: end-state
part-of: plugin-sole-source
---

# Kanban items stay in the reply, with the Decide buttons under it and in the pane

With the coding-agent-kanban-turns plugin loaded:

- **The reply keeps its items.** The agent writes its turn response as the `coding-agent-kanban-turn-responses` skill says, every list in the reply's text, and `reassess` restates every open item in the latest reply. The plugin never rewrites the reply's text.
- **Decide items get buttons.** Before a reply with Decide items, the agent calls the plugin's `kanban_options` tool; the plugin draws each Decide item's options as buttons, with a notes field, directly under the reply and in the pane, as [kanban-pane](../../kanban-pane/closed/kanban-pane.md) says. Both copies read their picks from the prompt draft, so a click in either shows in both.
- **An option is marked by a bar.** Each Decide option, its name line and every ➕, ➖ and note line under it, has a one-column bar down its left side for its whole height, which lights while the pointer is anywhere on the option.
- **A click writes the draft.** A click or a note writes the item's reference, on a line of its own, into the prompt draft, and sends nothing.
- **Settled items dim.** Once the plugin finds a Decide item answered, its buttons dim and do nothing.
- **Without the plugin, the skill alone applies.** Every answer can still be typed by reference.

Checks: the plugin's repository's checks pass with a test for each bullet above.

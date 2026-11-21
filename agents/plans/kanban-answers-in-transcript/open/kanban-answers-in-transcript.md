---
title: A reply's Decide items are answered by buttons drawn in its Decide list's place and in the pane, and by reference through the skill inside the plugin where the hooks don't load
state: approved
kind: end-state
part-of: plugin-sole-source
needs: [derived-skill-package]
---

# A reply's Decide items are answered by buttons drawn in its Decide list's place and in the pane, and by reference through the skill inside the plugin where the hooks don't load

With the coding-agent-kanban-turns plugin loaded:

- **The stored reply keeps its items.** The agent writes its turn response as the plugin's instructions say ([prompt-context-hook-runs](../../plugin-sole-source/closed/prompt-context-hook-runs.md)), every list in the reply's text, and `reassess` restates every open item in the latest reply. The plugin never rewrites the stored reply, so ctrl+o shows it as written.
- **Decide items are drawn as buttons.** Before a reply with Decide items, the agent calls the plugin's `kanban_options` tool. Where the reply's Decide list is intact and its items match the call's, the reply draws each item as a box with its options as buttons in the list's place; otherwise it draws the reply whole, its questions as links, with the boxes under it. The pane draws the same boxes, as [kanban-pane](../../kanban-pane/closed/kanban-pane.md) says. Both copies read their picks from the prompt draft, so a click in either shows in both.
- **An option is marked by a bar.** Each Decide option, its name line and every ➕, ➖ and note line under it, has a one-column bar down its left side for its whole height, which lights while the pointer is anywhere on the option.
- **A click writes the draft.** A click or a note writes the item's reference, on a line of its own, into the prompt draft, and sends nothing.
- **Done items stay answerable.** Once the plugin finds a Decide item answered, its box is dimmed, says what made it Done and keeps the sent options' `☑️`, and its options still pick, writing a fresh reference into the draft.
- **The skill inside the plugin is the fallback** ([derived-skill-package](../../plugin-sole-source/closed/derived-skill-package.md)). The plugin ships the derived skill, which teaches the format and reads typed answers when the plugin's hooks fail to load, and the same skill is `packages.skill-standalone` for a harness with no plugins. In either, every answer can still be typed by reference.

All but the last bullet are true on master (#36, #40). The last waits on [derived-skill-package](../../plugin-sole-source/closed/derived-skill-package.md), so the node stays open until that lands.

Checks: the plugin's repository's checks pass with a test for each bullet above.

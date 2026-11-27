---
title: A reply's Decide items are answered by buttons drawn in its Decide list's place and in the pane, and by reference through the skill inside the plugin where the hooks don't load
state: implemented
kind: end-state
part-of: plugin-sole-source
needs: [derived-skill-package]
implemented-by: kanban-answers-in-transcript
---

# A reply's Decide items are answered by buttons drawn in its Decide list's place and in the pane, and by reference through the skill inside the plugin where the hooks don't load

With the coding-agent-kanban-turns plugin loaded:

- **The stored reply keeps its items.** The agent writes its turn response as the plugin's instructions say ([prompt-context-hook-runs](../../plugin-sole-source/closed/prompt-context-hook-runs.md)), every list in the reply's text, and `reassess` restates every open item in the latest reply. The plugin never rewrites the stored reply, so ctrl+o shows it as written.
- **Decide items are drawn as buttons.** Before a reply with Decide items, the agent calls the plugin's `kanban_options` tool. Where the reply's Decide list is intact and its items match the call's, the reply draws each item as a box with its options as buttons in the list's place; otherwise it draws the reply whole, its questions as links, with the boxes under it. The pane draws the same boxes, as [kanban-pane](../../kanban-pane/closed/kanban-pane.md) says. Both copies read their picks from the prompt draft, so a click in either shows in both.
- **An option is marked by a bar.** Each Decide option, its name line and every ➕, ➖ and note line under it, has a one-column bar down its left side for its whole height, which lights while the pointer is anywhere on the option.
- **A click writes the draft.** A click or a note writes the item's reference, on a line of its own, into the prompt draft, and sends nothing.
- **Done items stay answerable.** Once the plugin finds a Decide item answered, its box is dimmed, says what made it Done and keeps the sent options' `☑️`, and its options still pick, writing a fresh reference into the draft.
- **The skill inside the plugin is the fallback** ([derived-skill-package](../../plugin-sole-source/closed/derived-skill-package.md)). The plugin ships the derived skill, which teaches the format and reads typed answers when the plugin's hooks fail to load, and the same skill is `packages.skill-standalone` for a harness with no plugins. In either, every answer can still be typed by reference.

Checks: the plugin's repository's checks pass with a test for each bullet above:

- **The stored reply:** `test/engine/tools.test.tsx`'s turn's end passes the answer down as written, its lint findings beneath it; `test/engine/pane.test.tsx`'s context teaches every list's header; `test/unit/protocol/instructions.test.ts:103` finds every fragment in the instructions, among them the one saying `reassess` restates every open item.
- **The buttons:** `test/engine/pane.test.tsx` cuts an intact Decide list out for its boxes, draws a list it can't find under the reply's text, and shows a pick in a reply's box in the pane's and the other way round, both following the person's own edits of the prompt box; `test/unit/protocol/instructions.test.ts` says when to call `kanban_options`.
- **The bar:** `test/engine/pane.test.tsx` lights an option's gutter beside each of its lines, its name, ➕ and ➖ lines, under the pointer, and gives a Done item's lines the settled bar alone.
- **A click:** `test/engine/pane.test.tsx` builds the draft from the options and the notes field, and sends nothing.
- **Done items:** `test/engine/pane.test.tsx` says what made an item Done, keeps its `☑️` and its options at full strength, and lets a Done item's options in a reply still pick.
- **The fallback:** `checks.plugin` finds the skill in `packages.plugin`, the same as `packages.skill-standalone`, and `checks.skill` holds `plugin/skills/` to the build; `test/unit/protocol/skill.test.ts` finds every fragment, the answers by reference among them, in SKILL.md; `test/unit/cli/golden-cases.test.ts` runs every golden case through the CLI with no `kanban_options` call, as a turn where only the skill loads has none, and gets what it expects.

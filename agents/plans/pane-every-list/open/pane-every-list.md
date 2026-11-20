---
title: The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references
state: approved
kind: end-state
---

# The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references

With the coding-agent-kanban-turns plugin loaded:

- **Every list, not only Decide.** The pane and the boxes under a reply hold the items of all 9 lists the agent writes: ✅ Done, 🚧 Pending, 📝 Logged, ⏳ Waiting, ❓ Answers, 🔑 Authorizations, 🔍 Review, 👉 Todo and 🧠 Decide. Each item's box carries its list's actions, and each action writes the item's reference with a word the spec names as settling the item:

  | List                                       | Actions                                                                                             |
  | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
  | 👉 Todo                                    | Done (`Todo.2: done`), Won't do (`: skip`), Note                                                    |
  | 🔍 Review                                  | Reviewed (`: reviewed`), Merge it (`: merge`, which asks the agent to merge), Skip (`: skip`), Note |
  | ⏳ Waiting                                 | Stop waiting (`: stop`), Note                                                                       |
  | 🔑 Authorizations                          | Allow (`: allow`), Deny (`: deny`), Note                                                            |
  | 🧠 Decide                                  | its options, and Note                                                                               |
  | 🚧 Pending, ✅ Done, 📝 Logged, ❓ Answers | Note only                                                                                           |

- **One scrolling list, newest turn first.** The pane is one list grouped by turn, then by list in the spec's order, then by state, Open before Done, each group under its own header. A turn's header carries its id and its index relative to the latest turn, such as `── 9efb08a1 ₋₃ ──`. Each list's Done items fold under that list's own `▸ Done (n)` toggle within the turn.
- **A turn reads as one block.** Each turn's item boxes sit inside one outline, in the pane and under a reply, each item's box whole inside it.
- **↑ ↓ by item, ◀ ▶ by turn.** `↑ Previous` and `↓ Next` move the focus ring item by item. `◀ Turn` and `▶ Turn` jump it to the turn section above or below with an item the filters leave visible, skipping turns whose items they all hide, and scroll the pane there. They don't page. Each is a setting under `keys`.
- **Filters.** A row under the header row holds one toggle per list, one for Done items, and an **Only show this turn** checkbox, off by default, which draws only the turn ◀ and ▶ last reached, so they swap which turn that is. Every toggle is on and the checkbox off by default; a toggle that's off shows how many items it hides across every turn. **Set default** keeps the current set, the checkbox among it, in the plugin's `$.store`, across sessions on this machine, and **Reset** puts every toggle back on and the checkbox off.
- **Done, in the UI's words.** An item settled any way, by an answer, a merged pull request, a `reassess`, a stopped wait, is Done, in its group's Done section. **Submit** moves the items it answers into their Done sections at once, and the transcript read at the turn's end keeps each there or puts it back. A Done section is collapsed to one header row with its count, `▸ Done (n)`, and expands on a click. A Done item's box stays dimmed, says what made it Done, and its actions still write the draft.
- **Hidden means not drawn.** A filtered-out item or section makes no elements and takes no layout; its count shows on its filter's toggle.
- **Long lists stay fast.** The pane draws only the groups and items in or near its scroll window, with spacer rows of the right height for the rest, so a session with 2000 Done items and 20 open ones scrolls and refreshes without visible lag.
- **The ✅ Done list.** Every turn's section holds its own ✅ Done list items, under that list's header, each with its Note button.
- **Boxes in the reply.** A reply's list found intact is cut out and drawn as its items' boxes in its place, as a Decide list is; one that isn't is drawn whole, with the boxes under the reply.
- **Grouped answers with context.** The buttons write the draft's answers grouped by turn and list, each item line with its context in parentheses, which every reader skips, and a note after `: `:

  ```text
  coding-agent-kanban-turns:
  9efb08a1.Decide
    1.A (Which cache to keep → Disk)
    2.A,C (Cleanups to start → Logs, Temp files): start with logs
  9efb08a1.Todo
    3 (Rotate the deploy token): done
  ```

  The plugin, and the skill derived from it, read the settling words and this syntax from the spec, `plugin/spec/kanban.yaml`, and a plain reference, such as `9efb08a1.Decide.2.B` or `Todo.3: done`, still settles its item.
- **The spec is the only statement of the rules.** The settling words and the grouped syntax are written in the spec alone ([kanban-skill-list-answers](kanban-skill-list-answers.md)), and no other repository states them.

Checks:

- the repository's checks pass, `typecheck-plugin` and `plugin-test` among them, with an engine test in `plugin/plugin-tests/` for each bullet above;
- a test renders a session of 2000 Done items and 20 open ones and finds only the scroll window's items in the rendered tree;
- the spec's golden cases pass, with cases for the grouped example above and for a plain reference;
- in a live session, an answer written by each list's actions settles its item in the pane, under the reply and in the next reply's 📌 count line.

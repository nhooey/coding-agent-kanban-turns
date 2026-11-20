---
title: The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references
state: approved
kind: end-state
---

# The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references

With the coding-agent-kanban-turns plugin loaded, beside the `coding-agent-kanban-turn-responses` skill:

- **Every list, not only Decide.** The pane and the boxes under a reply hold the items of all 9 lists the skill writes: ✅ Done, 🚧 Pending, 📝 Logged, ⏳ Waiting, ❓ Answers, 🔑 Authorizations, 🔍 Review, 👉 Todo and 🧠 Decide. Each item's box carries its list's actions, and each action writes the item's reference with a word the skill reads as settling the item:

  | List                                       | Actions                                                                                             |
  | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
  | 👉 Todo                                    | Done (`Todo.2: done`), Won't do (`: skip`), Note                                                    |
  | 🔍 Review                                  | Reviewed (`: reviewed`), Merge it (`: merge`, which asks the agent to merge), Skip (`: skip`), Note |
  | ⏳ Waiting                                 | Stop waiting (`: stop`), Note                                                                       |
  | 🔑 Authorizations                          | Allow (`: allow`), Deny (`: deny`), Note                                                            |
  | 🧠 Decide                                  | its options, and Note                                                                               |
  | 🚧 Pending, ✅ Done, 📝 Logged, ❓ Answers | Note only                                                                                           |

- **One scrolling list, newest turn first.** The pane is one list grouped by turn, then by list in the skill's order, then by state, Open before Done, each group under its own header. A turn's header carries its id and its index relative to the latest turn, such as `9efb08a1 ₋3`.
- **◀ ▶ scroll between turns.** ◀ and ▶ scroll the pane to the previous or next turn section with an item the filters leave visible, skipping turns whose items they all hide. They don't page.
- **Filters.** A row at the top holds one toggle per list, one for Done items, and an **Only show this turn** checkbox, off by default, which draws only the turn ◀ and ▶ last reached, so they swap which turn that is. Every toggle is on and the checkbox off by default; a toggle that's off shows how many items it hides across every turn. **Set default** keeps the current set, the checkbox among it, in the plugin's `$.store`, across sessions on this machine, and **Reset** puts every toggle back on and the checkbox off.
- **Done, in the UI's words.** An item settled any way, by an answer, a merged pull request, a `reassess`, a stopped wait, is Done, in its group's Done section. **Submit** moves the items it answers into their Done sections at once, and the transcript read at the turn's end keeps each there or puts it back. A Done section is collapsed to one header row with its count, and expands on a click.
- **Hidden means not drawn.** A filtered-out item or section makes no elements and takes no layout; its count shows on its filter's toggle.
- **Long lists stay fast.** The pane draws only the groups and items in or near its scroll window, with spacer rows of the right height for the rest, so a session with 2000 Done items and 20 open ones scrolls and refreshes without visible lag.
- **The ✅ Done list.** The pane holds only the latest turn's ✅ Done items. Earlier turns' ✅ Done items stay under their replies, each with its Note button.
- **Grouped answers with context.** The buttons write the draft's answers grouped by turn and list, each item line with its context in parentheses, which every reader skips, and a note after `: `:

  ```text
  coding-agent-kanban-turns@nix-pinned:
  9efb08a1.Decide
    1.A (Which cache to keep → Disk)
    2.A,C (Cleanups to start → Logs, Temp files): start with logs
  9efb08a1.Todo
    3 (Rotate the deploy token): done
  ```

  The plugin's reader and the skill's `reply_turns.py` and `outstanding.py` read this syntax, and a plain reference, such as `9efb08a1.Decide.2.B` or `Todo.3: done`, still settles its item.
- **The shared rules stay in step.** The settling words and the grouped syntax are rules the plugin and the skill share, as `AGENTS.md`'s "Rules shared with the kanban skill" says, so the skill in `coding-agent-skills` states them too.

Checks:

- the repository's checks pass, `typecheck-plugin` and `plugin-test` among them, with an engine test in `plugin/plugin-tests/` for each bullet above;
- a test renders a session of 2000 Done items and 20 open ones and finds only the scroll window's items in the rendered tree;
- the skill's tests in `coding-agent-skills` pass, with cases for the grouped example above and for a plain reference;
- in a live session, an answer written by each list's actions settles its item in the pane, under the reply and in the next reply's 📌 count line.

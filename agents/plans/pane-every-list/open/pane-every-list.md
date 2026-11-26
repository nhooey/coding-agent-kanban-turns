---
title: The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references
state: approved
kind: end-state
---

# The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references

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

- **One scrolling list, by state, then turn, then list.** The pane is one list grouped by state, then by turn, newest first, then by list in the spec's order ([pane-turn-sections](pane-turn-sections.md)). The states are three branches, in this order: Open, the items that need the person and that the draft doesn't answer; Queued, the ones the draft answers, not yet sent; and Done. Each branch sits under its own toggle with its count, `▾ Open (n)`, `▾ Queued (n)` and `▸ Done (n)`, Done collapsed at first; within a branch, each turn's group sits under its turn's header, and each list's items under their list's header. A turn's header, in each branch, carries its id, its index relative to the latest turn and its item count there, such as `▾ ── 9efb08a1 ₋₃ (2) ──`, and folds that turn in that branch alone. An item moving between branches changes only the counts, never a fold.
- **A turn reads as one block.** Each turn's item boxes in a branch sit inside one outline, in the pane and under a reply, each item's box whole inside it.
- **↑ ↓ by stop, ◀ ▶ by turn.** `↑ Previous` and `↓ Next` move the focus ring stop by stop: each branch's header, each turn's header and each item. `◀ Turn` and `▶ Turn` jump it to the next turn's header up or down with an item the filters leave visible, across the branches in the pane's order, Open's turns, then Queued's, then Done's, skipping turns whose items they all hide and the turns of a collapsed branch, and scroll the pane there ([pane-turn-navigation](pane-turn-navigation.md)). They don't page. Each is a setting under `keys`.
- **Filters.** A row under the header row holds one toggle per list, one for Done items, one each for answered and unanswered Decide items, answered meaning an option chosen or sent, and an **Only show this turn** checkbox, off by default, which draws only the turn ◀ and ▶ last reached, in every branch it has items in, so they swap which turn that is. Every toggle is on and the checkbox off by default; a toggle that's off shows how many items it hides across every turn. **Set default** keeps the current set, the checkbox among it, in the plugin's `$.store`, across sessions on this machine, and **Reset** puts every toggle back on and the checkbox off.
- **Done, in the UI's words.** An item settled any way, by an answer, a merged pull request, a `reassess`, a stopped wait, is Done, in its turn under the Done branch. A pick or a note moves an item from Open to Queued, and undoing it moves the item back; **Submit** moves the items it answers from Queued to Done at once, and the transcript read at the turn's end keeps each there or puts it back. The Done branch is collapsed to one header row with its count, `▸ Done (n)`, and expands on a click. A Done item's box stays dimmed, says what made it Done, and its actions still write the draft.
- **Hidden means not drawn.** A filtered-out item or section makes no elements and takes no layout; its count shows on its filter's toggle.
- **Long lists stay fast.** The pane draws only the groups and items in or near its scroll window, with spacer rows of the right height for the rest, so a session with 2000 Done items and 20 open ones scrolls and refreshes without visible lag.
- **The lists nothing settles.** The items of ✅ Done, 📝 Logged and ❓ Answers need nothing of the person, so they're Done from the start: each sits under its list's header, in its turn under the Done branch, as soon as it's raised, and keeps its Note button. Open holds only items that need the person, so `n of m answered` counts only those.
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

## Already true for Todo items

The pane holds 👉 Todo items beside 🧠 Decide items, end to end:

- each Todo item sits in its turn under Open, Queued or Done, the turn's Todo items before its Decide items, each list under a faint header;
- its box carries `👉 Todo.3` and its summary on the title line, its body, **Done** and **Skip**, and a notes field;
- Done and Skip write plain references, `9efb08a1.Todo.3: done`, a line each, and a note goes after the word or stands alone, settling nothing;
- a word settles a Todo item in the 📌 roll-up and the count line too, as Todo's `settled-by`, `settling-word`, says, and a note alone settles it nowhere.

Still to come: the boxes under a reply, which hold Decide items alone; the other 7 lists; the grouped answers; the filters; turn navigation; and the windowed rendering.

Checks:

- the repository's checks pass, `typecheck-plugin` and `plugin-test` among them, with an engine test in `plugin/test/engine/` for each bullet above;
- a test renders a session of 2000 Done items and 20 open ones and finds only the scroll window's items in the rendered tree;
- the spec's golden cases pass, with cases for the grouped example above and for a plain reference;
- in a live session, an answer written by each list's actions settles its item in the pane, under the reply and in the next reply's 📌 count line.

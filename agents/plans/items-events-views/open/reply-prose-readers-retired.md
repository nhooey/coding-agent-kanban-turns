---
title: No reader takes an item from a reply's prose, and the list readers, the settlers, the roll-up and `kanban_options` are gone
state: proposed
kind: implementation
part-of: items-events-views
needs: [pane-facet-tree, reply-refers-to-items, harness-observations-as-events, derived-skill-follows-items, reassess-holds-items-until-done, unused-exports-checked]
touches: [plugin/src/items/, plugin/src/pane/, plugin/src/transcript/, plugin/src/lint/reply.ts, plugin/src/protocol/, plugin/hooks/register.tsx, plugin/cli/, plugin/spec/kanban.yaml, plugin/spec/kanban.schema.yaml, plugin/spec/fragments/, plugin/spec/cases/, plugin/defaults/config.yaml, plugin/types/index.d.ts, plugin/test/, README.md, AGENTS.md]
---

# No reader takes an item from a reply's prose, and the list readers, the settlers, the roll-up and `kanban_options` are gone

Once the pane, the reply and the observations read the fold, the code that read items out of a reply's text has no caller.
This node deletes it, so the event log is the only source of an item and nothing stays that could disagree with it.

- **The readers.**
  Gone from `plugin/src/`: the read of a reply's lists into items, the settlers by list, the subject key that matched an item across rewordings, the `Frees:` line's read, the raised items and their settlements, the roll-up's draft and its interval, and the cut of a list out of a reply with the match of its summaries.
  `plugin/src/transcript/reply.ts` reads a reply's blocks for its references alone.
- **The pane's old path.**
  Gone: the branches, the turn groups and their stops, and every view text written for a list.
- **The tools.**
  `kanban_options`, `kanban_outstanding` and `kanban_lint` are unregistered: the item tool raises items and gives the board, and the turn's end checks a reply's references.
- **The spec.**
  Gone from `plugin/spec/kanban.yaml`: `lists`, `frees`, `subject`, `roll-up`, `tag` and the `characters` that underline a list's header.
  The option kinds sit under the item's `response`.
  The fragments that taught the lists and the roll-up are gone, and the instructions' and the skill's lists of fragments name none.
- **The CLI.**
  `count`, `rollup`, `due` and `lint` are gone, with the commands [derived-skill-follows-items](derived-skill-follows-items.md) put in their place.
- **The types.**
  `plugin/types/index.d.ts` holds `Item`, `Event`, the view state and the neutral turn, whose `decide` field is gone; `DecideItem`, `TodoItem`, `ListedItem`, `HowSettled` and `Settlement` are gone.
- **The settings.**
  A setting only the old path read is gone from `plugin/defaults/config.yaml`, with no warning kept for it: a user's file that still holds one is refused as a file with any unknown key is.
- **The tests.**
  The old path's unit tests are gone with it; the golden cases are logs and the items they fold to.
- **Nothing is kept for what came before.**
  No reader of an older reply's shape, no alias, no stored shape carried across the change and no fallback to the lists stays: the pane's stored state takes a new shape tag, and what an older build stored is declined.
- **The docs.**
  `README.md` and `AGENTS.md` describe the item model, and neither names a list as a type.
- **A session begun before** shows no item from its old replies, as [the end state](items-events-views.md) settles.

Checks:

- a search of `plugin/` outside `plugin/skills/` and the generated files finds no list's name or glyph, no `Frees`, no 📌 or 🔖, and none of the retired tools' names;
- `plugin/src/` has no function that takes a reply's text and returns an item;
- [unused-exports-checked](../../items-events-views-refactor/open/unused-exports-checked.md)'s check finds no file and no export that only the old path reached, and lists no exception;
- [core-folders-are-layers](../../items-events-views-refactor/open/core-folders-are-layers.md)'s check passes with no exception listed;
- `nix flake check` passes, and `typecheck-plugin` and `plugin-test` pass in the dev shell;
- [the end state](items-events-views.md)'s checks pass.

# Plans

<!-- Written by plans.py overview; edit the nodes, not this file. -->

## In progress (2)

- [Submit works as reviewed, a Reassess toggle adds a reassess line, the draft names the plugin, and settled items show their answer](open/pane-submit-review-fixes.md) `pane-submit-review-fixes`, pane-submit-review-fixes
- [The pane and the boxes under replies share one style, with a header, a footer holding the draft and its buttons, and turn dividers](open/pane-ui-harmonize.md) `pane-ui-harmonize`, pane-ui-harmonize

## Ready (6)

- [Kanban items stay in the reply, with the Decide buttons under it and in the pane](kanban-answers-in-transcript/open/kanban-answers-in-transcript.md) `kanban-answers-in-transcript`, part of [The kanban turns plugin lives in its own repository, in TypeScript only, beside the kanban skill](kanban-answers-in-transcript/open/kanban-mod-own-repository.md)
- [The kanban turns plugin lives in its own repository, in TypeScript only, beside the kanban skill](kanban-answers-in-transcript/open/kanban-mod-own-repository.md) `kanban-mod-own-repository`
- [Each item that blocks other work names the items it frees, by reference](kanban-next-chunk/open/kanban-items-name-what-they-free.md) `kanban-items-name-what-they-free`, part of [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md)
- [The kanban plugin ships the kanban turn responses skill, so a repository needs no skills-devshell copy of it](kanban-plugin-ships-skill/open/kanban-plugin-ships-skill.md) `kanban-plugin-ships-skill`
- [The kanban skill reads each list's settling words and the grouped answer syntax](pane-every-list/open/kanban-skill-list-answers.md) `kanban-skill-list-answers`, part of [The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md)
- [The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md) `pane-every-list`

## Blocked (9)

- [The draft's answers are grouped by turn and list, with context in parentheses, and the plugin reads them back](pane-every-list/open/answers-grouped-by-turn-and-list.md) `answers-grouped-by-turn-and-list`, part of [The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `kanban-skill-list-answers`, `pane-submit-review-fixes`
- [The plugin's core reads every list's items per turn, each with whether it's settled and by what answer](pane-every-list/open/items-of-every-list.md) `items-of-every-list`, part of [The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `kanban-skill-list-answers`, `pane-submit-review-fixes`
- [Each item's box, in the pane and under its reply, carries its list's actions](pane-every-list/open/list-actions.md) `list-actions`, part of [The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `items-of-every-list`, `answers-grouped-by-turn-and-list`, `pane-ui-harmonize`
- [The pane holds only the latest turn's ✅ Done list items, and earlier ones stay under their replies](pane-every-list/open/pane-done-items-latest-reply.md) `pane-done-items-latest-reply`, part of [The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `list-actions`, `pane-turn-navigation`
- [A row at the top of the pane filters its items by list and by state, and can show only one turn](pane-every-list/open/pane-list-filters.md) `pane-list-filters`, part of [The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `items-of-every-list`, `pane-ui-harmonize`
- [Submit moves the items it answers to Done at once, and the turn's end confirms them or puts them back](pane-every-list/open/pane-submit-moves-to-done.md) `pane-submit-moves-to-done`, part of [The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `pane-turn-sections`, `answers-grouped-by-turn-and-list`, `pane-submit-review-fixes`
- [◀ and ▶ scroll the pane between turns with a visible item, and Only show this turn draws just the one they reached](pane-every-list/open/pane-turn-navigation.md) `pane-turn-navigation`, part of [The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `pane-turn-sections`, `pane-list-filters`
- [The pane is one scrolling list, newest turn first, grouped by turn, list and state under headers](pane-every-list/open/pane-turn-sections.md) `pane-turn-sections`, part of [The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `items-of-every-list`, `pane-list-filters`, `pane-ui-harmonize`
- [The pane draws only the items in or near its scroll window, from cached item heights](pane-every-list/open/pane-windowed-render.md) `pane-windowed-render`, part of [The pane and the boxes under replies hold every list's items, grouped by turn, list and state, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `pane-turn-sections`, `pane-turn-navigation`

## Proposed (5)

- [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md) `kanban-next-chunk`
- [The pane and the buttons under a reply draw an item's links as links that open on a click](kanban-next-chunk/open/mod-draws-item-links.md) `mod-draws-item-links`, part of [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md)
- [The plugin keeps every open item as state, and next-chunk and the review queue read it from there](kanban-next-chunk/open/mod-open-items-state.md) `mod-open-items-state`, part of [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md)
- [/next-chunk starts a run of chunks, and the plugin submits the next one when a chunk settles](kanban-next-chunk/open/next-chunk-command.md) `next-chunk-command`, part of [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md)
- [The chunk is picked by a pure function over the open items, what they free and what earlier chunks showed](kanban-next-chunk/open/next-chunk-pick.md) `next-chunk-pick`, part of [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md)

## Closed

19 in [closed/](closed/): 10 implemented, 1 rejected, 1 abandoned, 7 superseded.

# Plans

<!-- Written by plans.py overview; edit the nodes, not this file. -->

## In progress (1)

- [The pane's state is one value that a pure step function moves, and the hooks only dispatch events and run the effects it returns](pane-every-list/open/pane-state-reducer.md) `pane-state-reducer`, part of [The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), pane-state-reducer

## Ready (5)

- [The pane's header row and footer stay in sight while its items scroll](open/pane-controls-stay-visible.md) `pane-controls-stay-visible`
- [A Decide item a later one restates is Done, superseded, and each of the two links to the other](pane-every-list/open/decide-superseded.md) `decide-superseded`, part of [The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md)
- [The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md) `pane-every-list`
- [The coding-agent-kanban-turn-responses skill is retired, and no repository or session installs it](plugin-sole-source/open/kanban-skill-retired.md) `kanban-skill-retired`, part of [The plugin is the only source of the kanban turn-response protocol, and carries a skill derived from it, built deterministically](plugin-sole-source/open/plugin-sole-source.md)
- [The plugin is the only source of the kanban turn-response protocol, and carries a skill derived from it, built deterministically](plugin-sole-source/open/plugin-sole-source.md) `plugin-sole-source`

## Blocked (10)

- [The draft's answers are grouped by turn and list, with context in parentheses, and the plugin reads them back](pane-every-list/open/answers-grouped-by-turn-and-list.md) `answers-grouped-by-turn-and-list`, part of [The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `kanban-skill-list-answers`
- [The plugin's core reads every list's items per turn, each with whether it's settled and by what answer](pane-every-list/open/items-of-every-list.md) `items-of-every-list`, part of [The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `kanban-skill-list-answers`, `pane-state-reducer`
- [The spec holds each list's settling words and the grouped answer syntax](pane-every-list/open/kanban-skill-list-answers.md) `kanban-skill-list-answers`, part of [The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `kanban-skill-retired`
- [Each item's box, in the pane and in its reply, carries its list's actions](pane-every-list/open/list-actions.md) `list-actions`, part of [The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `items-of-every-list`, `answers-grouped-by-turn-and-list`, `pane-state-reducer`
- [A row under the pane's header row hides Decide items by state, answered, unanswered or Done](pane-every-list/open/pane-decide-filters.md) `pane-decide-filters`, part of [The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `pane-state-reducer`
- [A row at the top of the pane filters its items by list and by state, and can show only one turn](pane-every-list/open/pane-list-filters.md) `pane-list-filters`, part of [The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `items-of-every-list`, `pane-state-reducer`, `pane-decide-filters`
- [Submit moves every list's items it settles to the Done branch at once, and the turn's end confirms them or puts them back](pane-every-list/open/pane-submit-moves-to-done.md) `pane-submit-moves-to-done`, part of [The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `pane-turn-sections`, `list-actions`, `answers-grouped-by-turn-and-list`, `pane-state-reducer`
- [◀ and ▶ jump the pane between turns with a visible item, and Only show this turn draws just the one they reached](pane-every-list/open/pane-turn-navigation.md) `pane-turn-navigation`, part of [The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `pane-turn-sections`, `pane-list-filters`, `pane-state-reducer`
- [The pane groups every list's items by state, then turn, then list, each state and turn under a toggle that folds it](pane-every-list/open/pane-turn-sections.md) `pane-turn-sections`, part of [The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `items-of-every-list`, `pane-list-filters`, `pane-state-reducer`
- [The pane draws only the items in or near its scroll window, from cached item heights](pane-every-list/open/pane-windowed-render.md) `pane-windowed-render`, part of [The pane and the boxes under replies hold every list's items, grouped by state, turn and list, filtered, and answered in grouped references](pane-every-list/open/pane-every-list.md), waiting on `pane-turn-sections`, `pane-turn-navigation`, `pane-state-reducer`

## Proposed (5)

- [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md) `kanban-next-chunk`
- [The pane and the buttons under a reply draw an item's links as links that open on a click](kanban-next-chunk/open/mod-draws-item-links.md) `mod-draws-item-links`, part of [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md)
- [The plugin keeps every open item as state, and next-chunk and the review queue read it from there](kanban-next-chunk/open/mod-open-items-state.md) `mod-open-items-state`, part of [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md)
- [/next-chunk starts a run of chunks, and the plugin submits the next one when a chunk settles](kanban-next-chunk/open/next-chunk-command.md) `next-chunk-command`, part of [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md)
- [The chunk is picked by a pure function over the open items, what they free and what earlier chunks showed](kanban-next-chunk/open/next-chunk-pick.md) `next-chunk-pick`, part of [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md)

## Closed

36 in [closed/](closed/): 24 implemented, 1 rejected, 1 abandoned, 10 superseded.

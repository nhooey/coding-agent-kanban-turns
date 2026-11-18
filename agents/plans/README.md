# Plans

<!-- Written by plans.py overview; edit the nodes, not this file. -->

## In progress (1)

- [Move the mod to its own repository with its history, and take it out of coding-agent-skills](kanban-answers-in-transcript/open/kanban-mod-split.md) `kanban-mod-split`, part of [The kanban turns mod lives in its own repository, in TypeScript only, beside the kanban skill](kanban-answers-in-transcript/open/kanban-mod-own-repository.md)

## Ready (4)

- [Kanban items stay in the reply; the band holds the status, the latest Decide buttons, Submit and the answers waiting to be sent](kanban-answers-in-transcript/open/kanban-answers-in-transcript.md) `kanban-answers-in-transcript`, part of [The kanban turns mod lives in its own repository, in TypeScript only, beside the kanban skill](kanban-answers-in-transcript/open/kanban-mod-own-repository.md)
- [The kanban turns mod lives in its own repository, in TypeScript only, beside the kanban skill](kanban-answers-in-transcript/open/kanban-mod-own-repository.md) `kanban-mod-own-repository`
- [A differential property test pins today's band behaviour before the reducer replaces it](mod-refactor-state-machines/open/band-differential-test.md) `band-differential-test`, part of [The mod's state changes are pure transitions, and its hooks only dispatch and draw](mod-refactor-state-machines/open/mod-refactor-state-machines.md)
- [The mod's state changes are pure transitions, and its hooks only dispatch and draw](mod-refactor-state-machines/open/mod-refactor-state-machines.md) `mod-refactor-state-machines`

## Blocked (6)

- [One pure step function moves the band, and hooks dispatch to it](mod-refactor-state-machines/open/band-transitions-reducer.md) `band-transitions-reducer`, part of [The mod's state changes are pure transitions, and its hooks only dispatch and draw](mod-refactor-state-machines/open/mod-refactor-state-machines.md), waiting on `band-differential-test`
- [Answers gather in a basket and go out in one prompt on Submit](kanban-answers-in-transcript/open/kanban-answers-basket.md) `kanban-answers-basket`, part of [Kanban items stay in the reply; the band holds the status, the latest Decide buttons, Submit and the answers waiting to be sent](kanban-answers-in-transcript/open/kanban-answers-in-transcript.md), waiting on `kanban-items-tool-row`
- [The band shows the open counts, the latest reply's Decide buttons and the answers waiting to be submitted](kanban-answers-in-transcript/open/kanban-band-status.md) `kanban-band-status`, part of [Kanban items stay in the reply; the band holds the status, the latest Decide buttons, Submit and the answers waiting to be sent](kanban-answers-in-transcript/open/kanban-answers-in-transcript.md), waiting on `kanban-mod-reads-transcript`, `kanban-items-tool-row`, `kanban-answers-basket`
- [The tool row draws the turn's Decide items with their buttons, marked by a bar](kanban-answers-in-transcript/open/kanban-items-tool-row.md) `kanban-items-tool-row`, part of [Kanban items stay in the reply; the band holds the status, the latest Decide buttons, Submit and the answers waiting to be sent](kanban-answers-in-transcript/open/kanban-answers-in-transcript.md), waiting on `band-transitions-reducer`, `option-button-component`
- [The mod reads the turns, the items and the answers from the transcript in TypeScript](kanban-answers-in-transcript/open/kanban-mod-reads-transcript.md) `kanban-mod-reads-transcript`, part of [The kanban turns mod lives in its own repository, in TypeScript only, beside the kanban skill](kanban-answers-in-transcript/open/kanban-mod-own-repository.md), waiting on `kanban-mod-split`
- [The option buttons are one component that takes callbacks](mod-refactor-state-machines/open/option-button-component.md) `option-button-component`, part of [The mod's state changes are pure transitions, and its hooks only dispatch and draw](mod-refactor-state-machines/open/mod-refactor-state-machines.md), waiting on `band-transitions-reducer`

## Proposed (6)

- [Each item that blocks other work names the items it frees, by reference](kanban-next-chunk/open/kanban-items-name-what-they-free.md) `kanban-items-name-what-they-free`, part of [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md)
- [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md) `kanban-next-chunk`
- [The band and the tool row draw an item's links as links that open on a click](kanban-next-chunk/open/mod-draws-item-links.md) `mod-draws-item-links`, part of [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md)
- [The mod keeps every open item as state, and next-chunk and the review queue read it from there](kanban-next-chunk/open/mod-open-items-state.md) `mod-open-items-state`, part of [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md)
- [/next-chunk starts a run of chunks, and the mod submits the next one when a chunk settles](kanban-next-chunk/open/next-chunk-command.md) `next-chunk-command`, part of [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md)
- [The chunk is picked by a pure function over the open items, what they free and what earlier chunks showed](kanban-next-chunk/open/next-chunk-pick.md) `next-chunk-pick`, part of [next-chunk shows the open items that free the most work, a chunk at a time, until none are open](kanban-next-chunk/open/kanban-next-chunk.md)

## Closed

6 in [closed/](closed/): 4 implemented, 1 rejected, 1 abandoned, 0 superseded.

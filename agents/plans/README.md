# Plans

<!-- Written by plans.py overview; edit the nodes, not this file. -->

## In progress (1)

- [Move the mod to its own repository with its history, and take it out of coding-agent-skills](kanban-answers-in-transcript/open/kanban-mod-split.md) `kanban-mod-split`, part of [The kanban turns mod lives in its own repository, in TypeScript only, beside the kanban skill](kanban-answers-in-transcript/open/kanban-mod-own-repository.md)

## Ready (4)

- [Kanban items stay in the reply; the band holds the status, the latest Decide buttons, Submit and the answers waiting to be sent](kanban-answers-in-transcript/open/kanban-answers-in-transcript.md) `kanban-answers-in-transcript`, part of [The kanban turns mod lives in its own repository, in TypeScript only, beside the kanban skill](kanban-answers-in-transcript/open/kanban-mod-own-repository.md)
- [The kanban turns mod lives in its own repository, in TypeScript only, beside the kanban skill](kanban-answers-in-transcript/open/kanban-mod-own-repository.md) `kanban-mod-own-repository`
- [One pure step function moves the band, and hooks dispatch to it](mod-refactor-state-machines/open/band-transitions-reducer.md) `band-transitions-reducer`, part of [The mod's state changes are pure transitions, and its hooks only dispatch and draw](mod-refactor-state-machines/open/mod-refactor-state-machines.md)
- [The mod's state changes are pure transitions, and its hooks only dispatch and draw](mod-refactor-state-machines/open/mod-refactor-state-machines.md) `mod-refactor-state-machines`

## Blocked (5)

- [Answers gather in a basket and go out in one prompt on Submit](kanban-answers-in-transcript/open/kanban-answers-basket.md) `kanban-answers-basket`, part of [Kanban items stay in the reply; the band holds the status, the latest Decide buttons, Submit and the answers waiting to be sent](kanban-answers-in-transcript/open/kanban-answers-in-transcript.md), waiting on `kanban-items-tool-row`
- [The band shows the open counts, the latest reply's Decide buttons and the answers waiting to be submitted](kanban-answers-in-transcript/open/kanban-band-status.md) `kanban-band-status`, part of [Kanban items stay in the reply; the band holds the status, the latest Decide buttons, Submit and the answers waiting to be sent](kanban-answers-in-transcript/open/kanban-answers-in-transcript.md), waiting on `kanban-mod-reads-transcript`, `kanban-items-tool-row`, `kanban-answers-basket`
- [The tool row draws the turn's Decide items with their buttons, marked by a bar](kanban-answers-in-transcript/open/kanban-items-tool-row.md) `kanban-items-tool-row`, part of [Kanban items stay in the reply; the band holds the status, the latest Decide buttons, Submit and the answers waiting to be sent](kanban-answers-in-transcript/open/kanban-answers-in-transcript.md), waiting on `band-transitions-reducer`, `option-button-component`
- [The mod reads the turns, the items and the answers from the transcript in TypeScript](kanban-answers-in-transcript/open/kanban-mod-reads-transcript.md) `kanban-mod-reads-transcript`, part of [The kanban turns mod lives in its own repository, in TypeScript only, beside the kanban skill](kanban-answers-in-transcript/open/kanban-mod-own-repository.md), waiting on `kanban-mod-split`
- [The option buttons are one component that takes callbacks](mod-refactor-state-machines/open/option-button-component.md) `option-button-component`, part of [The mod's state changes are pure transitions, and its hooks only dispatch and draw](mod-refactor-state-machines/open/mod-refactor-state-machines.md), waiting on `band-transitions-reducer`

## Proposed (0)

None.

## Closed

6 in [closed/](closed/): 4 implemented, 1 rejected, 1 abandoned, 0 superseded.

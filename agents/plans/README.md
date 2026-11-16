# Plans

<!-- Written by plans.py overview; edit the nodes, not this file. -->

## In progress (1)

- [Move the mod to its own repository with its history, and take it out of coding-agent-skills](kanban-answers-in-transcript/open/kanban-mod-split.md) `kanban-mod-split`, part of [The kanban turns mod lives in its own repository, in TypeScript only, beside the kanban skill](kanban-answers-in-transcript/open/kanban-mod-own-repository.md)

## Ready (6)

- [Kanban items stay in the reply; the band holds the status, the latest Decide buttons, Submit and the answers waiting to be sent](kanban-answers-in-transcript/open/kanban-answers-in-transcript.md) `kanban-answers-in-transcript`, part of [The kanban turns mod lives in its own repository, in TypeScript only, beside the kanban skill](kanban-answers-in-transcript/open/kanban-mod-own-repository.md)
- [The kanban turns mod lives in its own repository, in TypeScript only, beside the kanban skill](kanban-answers-in-transcript/open/kanban-mod-own-repository.md) `kanban-mod-own-repository`
- [Running outstanding.py is an argv and a parse in the core around one effect](mod-refactor-state-machines/open/mod-outstanding-in-core.md) `mod-outstanding-in-core`, part of [The mod's state changes are pure transitions, and its hooks only dispatch and draw](mod-refactor-state-machines/open/mod-refactor-state-machines.md)
- [The mod's state changes are pure transitions, and its hooks only dispatch and draw](mod-refactor-state-machines/open/mod-refactor-state-machines.md) `mod-refactor-state-machines`
- [The kanban_options schema and description live beside the instructions that name the tool](mod-refactor-state-machines/open/mod-tool-schema-in-core.md) `mod-tool-schema-in-core`, part of [The mod's state changes are pure transitions, and its hooks only dispatch and draw](mod-refactor-state-machines/open/mod-refactor-state-machines.md)
- [The text and predicates the hooks build live in the core, with tests](mod-refactor-state-machines/open/mod-view-text-in-core.md) `mod-view-text-in-core`, part of [The mod's state changes are pure transitions, and its hooks only dispatch and draw](mod-refactor-state-machines/open/mod-refactor-state-machines.md)

## Blocked (6)

- [One pure step function moves the band, and hooks dispatch to it](mod-refactor-state-machines/open/band-transitions-reducer.md) `band-transitions-reducer`, part of [The mod's state changes are pure transitions, and its hooks only dispatch and draw](mod-refactor-state-machines/open/mod-refactor-state-machines.md), waiting on `mod-view-text-in-core`
- [Answers gather in a basket and go out in one prompt on Submit](kanban-answers-in-transcript/open/kanban-answers-basket.md) `kanban-answers-basket`, part of [Kanban items stay in the reply; the band holds the status, the latest Decide buttons, Submit and the answers waiting to be sent](kanban-answers-in-transcript/open/kanban-answers-in-transcript.md), waiting on `kanban-items-tool-row`
- [The band shows the open counts, the latest reply's Decide buttons and the answers waiting to be submitted](kanban-answers-in-transcript/open/kanban-band-status.md) `kanban-band-status`, part of [Kanban items stay in the reply; the band holds the status, the latest Decide buttons, Submit and the answers waiting to be sent](kanban-answers-in-transcript/open/kanban-answers-in-transcript.md), waiting on `kanban-mod-reads-transcript`, `kanban-items-tool-row`, `kanban-answers-basket`
- [The tool row draws the turn's Decide items with their buttons, marked by a bar](kanban-answers-in-transcript/open/kanban-items-tool-row.md) `kanban-items-tool-row`, part of [Kanban items stay in the reply; the band holds the status, the latest Decide buttons, Submit and the answers waiting to be sent](kanban-answers-in-transcript/open/kanban-answers-in-transcript.md), waiting on `mod-view-text-in-core`, `mod-tool-schema-in-core`, `mod-outstanding-in-core`, `band-transitions-reducer`, `option-button-component`
- [The mod reads the turns, the items and the answers from the transcript in TypeScript](kanban-answers-in-transcript/open/kanban-mod-reads-transcript.md) `kanban-mod-reads-transcript`, part of [The kanban turns mod lives in its own repository, in TypeScript only, beside the kanban skill](kanban-answers-in-transcript/open/kanban-mod-own-repository.md), waiting on `kanban-mod-split`
- [The option buttons are one component that takes callbacks](mod-refactor-state-machines/open/option-button-component.md) `option-button-component`, part of [The mod's state changes are pure transitions, and its hooks only dispatch and draw](mod-refactor-state-machines/open/mod-refactor-state-machines.md), waiting on `band-transitions-reducer`

## Proposed (0)

None.

## Closed

3 in [closed/](closed/): 1 implemented, 1 rejected, 1 abandoned, 0 superseded.

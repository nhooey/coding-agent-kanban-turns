---
title: The mod reads the turns, the items and the answers from the transcript in TypeScript
state: approved
kind: implementation
part-of: kanban-mod-own-repository
needs: [kanban-mod-split]
touches: [hooks/transcript.ts, hooks/outstanding.ts]
---

# The mod reads the turns, the items and the answers from the transcript in TypeScript

- `$.session.messages()` gives the turns: a user prompt, a mid-turn message and a mod-submitted prompt each count as `reply_turns.py` counts them today.
- A turn's items are its `kanban_items` call's input, so nothing is parsed out of Markdown.
- An item is settled by an answer in a later prompt or mid-turn message, by the patterns `outstanding.py` uses, ported with its tests, and by a later `recheck` turn's call replacing it.
- The rules shared with the skill are the ones `kanban-mod-own-repository` lists; the port's tests take the skill's test cases for them.

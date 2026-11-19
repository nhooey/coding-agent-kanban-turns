---
title: /next-chunk starts a run of chunks, and the mod submits the next one when a chunk settles
state: proposed
kind: implementation
part-of: kanban-next-chunk
needs: [next-chunk-pick, mod-draws-item-links]
touches: [mod/hooks/register.tsx, mod/src/chunk.ts, mod/types/index.d.ts]
---

# /next-chunk starts a run of chunks, and the mod submits the next one when a chunk settles

- `/next-chunk` sets a `chunking` atom to the chunk's refs and submits `next-chunk` as a prompt; `/next-chunk stop`, or a prompt of `next-chunk stop`, clears it.
- At each `turn.complete` while `chunking` holds refs, the mod re-reads the open items; once none of the chunk's refs is open, it picks the next chunk and submits `next-chunk` again, or clears `chunking` when nothing is open.
- The mod reads AskUserQuestion's tool results from the transcript as answers to the chunk's Decide items, matched by each question's header. A header holds at most 12 characters, so the agent writes the ref short, `e69d74ed.D1` for `e69d74ed.Decide.1`, and the option labels open on their letters, `A. …`.
- A transition `chunkStep(chunking, event)` in the core holds the start, settle and stop rules, tested as a pure transition with property tests.

---
title: The chunk is picked by a pure function over the open items, what they free and what earlier chunks showed
state: proposed
kind: implementation
part-of: kanban-next-chunk
needs: [kanban-items-name-what-they-free, mod-open-items-state]
touches: [mod/src/chunk.ts, mod/test/chunk.test.ts]
---

# The chunk is picked by a pure function over the open items, what they free and what earlier chunks showed

- `nextChunk(items, shown, size)` in `mod/src/chunk.ts` takes the open items, the refs earlier chunks showed, in the order they showed them, and the size, by default 7, from `mod/defaults/config.jsonc`.
- It returns first every ref in `shown` whose item is still open, in `shown`'s order, then fills up to `size` with the other open items, ranked by how many open items each frees, directly or through others, then oldest first, then by list (Decide, Todo, Review, Pending, Waiting). When more than `size` shown items are still open, it returns them all; it never drops one to fit.
- An item whose freed items are all settled ranks as freeing nothing; a cycle of `Frees` counts each item once.
- The tests, as properties over random item sets and settle sequences:
  - **Idempotent:** with nothing settled in between, `nextChunk` over its own result's refs gives the same chunk.
  - **Sticky:** every ref of the last chunk whose item is still open is in the next chunk, ahead of every new ref.
  - **Leaves only when settled:** a ref leaves the chunk only in a step that settled its item.
  - **Fills:** a chunk is shorter than `size` only when fewer items are open.
- The skill's `outstanding.py` gets a `chunk` subcommand with the same rules and the same test cases. It reads `shown` from the earlier `next-chunk` turns' replies, so the skill alone keeps a chunk.

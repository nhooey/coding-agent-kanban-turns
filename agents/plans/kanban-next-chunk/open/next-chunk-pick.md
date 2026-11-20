---
title: The chunk is picked by a pure function over the open items, what they free and what earlier chunks showed
state: proposed
kind: implementation
part-of: kanban-next-chunk
needs: [kanban-items-name-what-they-free, mod-open-items-state, protocol-spec-data, kanban-cli-adapter, plugin-tools-replace-skill-scripts]
touches: [plugin/spec/kanban.yaml, plugin/spec/cases/, plugin/src/chunk.ts, plugin/test/chunk.test.ts, plugin/cli/, plugin/hooks/register.tsx]
---

# The chunk is picked by a pure function over the open items, what they free and what earlier chunks showed

- **The rules are in the spec.** `plugin/spec/kanban.yaml` holds the `next-chunk` command and its `stop` form, the chunk's size, by default 7, the lists a chunk draws from, and the tie-break order ([protocol-spec-data](../../plugin-sole-source/closed/protocol-spec-data.md)).
- **One pure function.** `nextChunk(items, shown, size)` in `plugin/src/chunk.ts` takes the open items, the refs earlier chunks showed, in the order they showed them, and the size from the spec.
- **What it returns.** First every ref in `shown` whose item is still open, in `shown`'s order, then the other open items up to `size`, ranked by how many open items each frees, directly or through others, then oldest first, then by list in the spec's tie-break order (Decide, Todo, Review, Pending, Waiting). When more than `size` shown items are still open, it returns them all; it never drops one to fit.
- **Freeing.** An item whose freed items are all settled ranks as freeing nothing; a cycle of `Frees` counts each item once.
- **Two edges over it,** both thin:
  - a plugin tool, `kanban_next_chunk`, registered beside `kanban_outstanding` and `kanban_lint` ([plugin-tools-replace-skill-scripts](../../plugin-sole-source/open/plugin-tools-replace-skill-scripts.md)), giving the agent the chunk to print;
  - a CLI subcommand, `chunk` ([kanban-cli-adapter](../../plugin-sole-source/open/kanban-cli-adapter.md)), which works out `shown` from the earlier `next-chunk` turns among its neutral turns, so the derived skill alone keeps a chunk.
- **Tests.** Properties over random item sets and settle sequences:
  - **Idempotent:** with nothing settled in between, `nextChunk` over its own result's refs gives the same chunk.
  - **Sticky:** every ref of the last chunk whose item is still open is in the next chunk, ahead of every new ref.
  - **Leaves only when settled:** a ref leaves the chunk only in a step that settled its item.
  - **Fills:** a chunk is shorter than `size` only when fewer items are open.

  Golden cases in `plugin/spec/cases/` give a transcript's expected chunk, and run through the core, the tool and the CLI.

For Neil to look at afresh, before approving: the size moves from the plugin's settings into the spec; the tool is new, where before the agent would have run a script; and the CLI works out `shown` from the turns, as the skill's script would have.

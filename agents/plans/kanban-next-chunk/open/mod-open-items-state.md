---
title: The plugin keeps every open item as state, and next-chunk and the review queue read it from there
state: proposed
kind: implementation
part-of: kanban-next-chunk
needs: [kanban-mod-reads-transcript, protocol-spec-data, kanban-cli-adapter]
touches: [plugin/spec/kanban.yaml, plugin/src/items.ts, plugin/cli/, plugin/hooks/register.tsx, plugin/types/index.d.ts, plugin/defaults/]
---

# The plugin keeps every open item as state, and next-chunk and the review queue read it from there

- **One copy of the open items.** A `$.state` atom holds every open item of every list the roll-up counts (Pending, Waiting, Review, Todo, Decide), each with its ref, list, summary, links, `frees` and the turn that raised it, and the refs earlier chunks showed. It's updated at each `turn.complete` and each prompt from the turns added since the last update, never by reading the whole transcript again.
- **Readable outside Claude Code.** After each update the plugin writes the atom, as JSON, to one file per session under `$XDG_STATE_HOME/coding-agent-kanban-turns/`, its path a shipped setting in `plugin/defaults/`, by a write to a temporary file and a rename, so a reader never sees half a file. The file names the session and the turn it was written at.
- **The spec defines the file's shape.** `plugin/spec/kanban.yaml` holds the open-items file's schema ([protocol-spec-data](../../plugin-sole-source/open/protocol-spec-data.md)), and the plugin's core writes it. For a tool outside a session with the plugin, the CLI prints the same shape from a transcript or neutral turns ([kanban-cli-adapter](../../plugin-sole-source/open/kanban-cli-adapter.md)).
- **Its readers.** `nextChunk` reads the atom. The `coding-agent-review-queue-in-browser` skill builds its queue from the file's Review and Todo items, and runs the CLI for the same shape when the file is missing or older than the session's last turn.
- **Tests.** The update is a pure function over the atom and the new turns, with a differential test against the full reread over random turn sequences; a test checks the file and the CLI's output against the spec's schema, and an engine test checks the file a session writes.

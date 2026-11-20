---
title: next-chunk shows the open items that free the most work, a chunk at a time, until none are open
state: proposed
kind: end-state
---

# next-chunk shows the open items that free the most work, a chunk at a time, until none are open

With the coding-agent-kanban-turns plugin loaded:

- **One command starts it.** `/next-chunk`, or `next-chunk` typed as a prompt, shows a chunk: the 5 to 7 open items, of any list but Done, Logged and Answers, that free the most other open work. `next-chunk stop`, or `/next-chunk stop`, ends it.
- **A chunk is a reply in the skill's shape.** The agent prints the chunk's items in their own lists, as the `coding-agent-kanban-turn-responses` skill writes them, each with its original reference, so every pull request and document an item names is a link in the terminal.
- **The picker takes only the simple questions.** The AskUserQuestion picker can't show links, so it opens only on the chunk's simple Decide items: ones whose summary and options need nothing opened or read to answer, at most 4 to a call. A Decide item that names a pull request, a document or anything else to open stays in the reply.
- **The plugin's buttons carry the links.** Every Decide item in the chunk, simple or not, gets the plugin's buttons, under the reply and in the pane, and each link in an item's summary, note, options and ➕ and ➖ lines is drawn there as a link that opens on a click. The plugin's buttons are the way to answer an item with links without leaving the terminal reply.
- **A chunk keeps what's still unaddressed.** A new chunk first shows again every item from earlier chunks that is still open, in the order it was shown, and only then fills up to its size with new items. So `next-chunk` run twice in a row shows the same chunk. An item leaves the chunk only when it's settled: a Decide item answered, a Review item reviewed, a Todo item done, a Pending or Waiting item finished.
- **What an item frees is written down.** Each item that blocks other work names the items it frees by reference, so the chunk is picked from those links, not guessed. Items that free the same amount are taken oldest first, Decide before Todo before Review before Pending and Waiting.
- **The next chunk follows by itself.** Once every item in the chunk is settled, by a picker answer, a typed answer or a button, the plugin submits `next-chunk` again, and stops when no item is open or after `next-chunk stop`. An item the user skips in the picker stays open and keeps the chunk from finishing, so the plugin waits.
- **Answers from the picker count.** An AskUserQuestion answer to a Decide item settles it the same as a typed `<turn>.Decide.<n>.<letter>`.
- **Without the plugin, the skill alone runs it.** The skill's `next-chunk` command shows one chunk, and the user types `next-chunk` again for the next.

Checks: the plugin's repository's checks pass with a test for each bullet above; the skill's `scripts/` tests cover the chunk's pick and the picker's answers.

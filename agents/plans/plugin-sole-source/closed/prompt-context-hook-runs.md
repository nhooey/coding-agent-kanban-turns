---
title: The plugin's instructions reach the agent once per conversation, whatever other plugins run before it
state: implemented
kind: implementation
part-of: plugin-sole-source
touches: [plugin/hooks/register.tsx, plugin/src/instructed.ts, plugin/types/index.d.ts, plugin/plugin-tests/, plugin/test/, README.md]
implemented-by: nhooey/coding-agent-kanban-turns#39
---

# The plugin's instructions reach the agent once per conversation, whatever other plugins run before it

- **Why it matters.** Once the old skill is gone ([kanban-skill-retired](../open/kanban-skill-retired.md)), these instructions are the only way the agent learns the turn-response format.
- **Why one hook isn't enough.** Claude Code's built-in cc-plugin-sec-default seats itself outermost on a machine with managed settings, and for Team and Enterprise organizations. Its `prompt.context` hook is `next.to(e, "append")`, which skips the whole `user` tier, so no plugin a person installs gets `prompt.context`. It does the same for `prompt.section`, `prompt.compose`, `prompt.attachment`, `skill.prompt` and `session.compact`. That's its policy, keeping prompt content out of reach of installed plugins, and the engine nests tiers in one fixed order, so no hook order or matcher puts this plugin's `prompt.context` hook back in the chain. It passes `prompt.submit` on with plain `next`.
- **Two routes, one copy.**
  - **`prompt.context`:** the hook adds the `kanbanTurns` block to the context. The transcript keeps it as a `context_sections` attachment.
  - **`prompt.submit`:** the hook adds the same text to the prompt's context. The transcript keeps it as a `hook_additional_context` attachment. A slash command's prompt gets none, and a prompt that doesn't enter leaves the instructions owed.
  - **Whichever runs first adds them, and the other adds none.** Both ask `instructing` in `plugin/src/instructed.ts`. The instructions are owed when no record since the conversation's last boundary carries their text, and no hook has added them under this conversation's key (the transcript's path and how many boundaries it holds), which `$.state` keeps for the moment before the transcript shows them.
  - **What ends a conversation.** A compaction (a `compact_boundary` record) or `/clear` (its command record, at the head of the new transcript) ends one, so the next route to run adds the instructions again.

Checks:

- an engine test in `plugin/plugin-tests/` with a `prepend`-tier hook that sends `prompt.context` on past this plugin, as cc-plugin-sec-default's does: the first prompt's context holds the instructions, and the second's doesn't;
- an engine test where `prompt.context` reaches the plugin: the context holds the `kanbanTurns` block, and the prompt's context gets no second copy;
- the core's tests of `instructing` with no block yet, a block from either route, a block only before a compaction, and `/clear`;
- in a live session with cc-plugin-sec-default and this plugin (`claude -p` under managed settings), the transcript holds one `hook_additional_context` attachment from `prompt.submit` with the instructions, and no `context_sections` copy. `claude --debug`'s log still says `prompt.context bypassed by cc-plugin-sec-default`, as it must.

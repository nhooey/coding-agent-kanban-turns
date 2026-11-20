---
title: The plugin's prompt.context hook adds its block in every session, whatever other plugins run before it
state: approved
kind: implementation
part-of: plugin-sole-source
touches: [plugin/hooks/register.tsx, plugin/plugin-tests/]
---

# The plugin's prompt.context hook adds its block in every session, whatever other plugins run before it

- **The fault.** cc-plugin-sec-default's `prompt.context` hook runs first and passes the event on past this plugin's hook, so the `kanbanTurns` block never reaches the agent.
- **Why it matters.** Once the old skill is gone ([kanban-skill-retired](kanban-skill-retired.md)), this block is the only way the agent learns the turn-response format.
- **The fix** makes this plugin's hook run in every session with cc-plugin-sec-default loaded: through the engine's hook order, a change to cc-plugin-sec-default so it calls `next`, or both. Which one is found when the fault is reproduced, and a change to cc-plugin-sec-default goes to its own repository as its own pull request.

Checks:

- an engine test in `plugin/plugin-tests/` with a `prompt.context` hook ahead of this plugin's, which the context still leaves with the `kanbanTurns` block;
- in a live session with cc-plugin-sec-default and this plugin, the agent's context holds the block, and `claude --debug`'s log has no `prompt.context bypassed by` line for this plugin.

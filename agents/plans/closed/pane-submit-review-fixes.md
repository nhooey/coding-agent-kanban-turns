---
title: Submit works as reviewed, a Reassess toggle adds a reassess line, the draft names the plugin, and settled items show their answer
state: implemented
kind: implementation
implemented-by: "#33"
touches: [plugin/hooks/register.tsx, plugin/src/answers.ts, plugin/src/view.ts, plugin/plugin-tests/]
---

# Submit works as reviewed, a Reassess toggle adds a reassess line, the draft names the plugin, and settled items show their answer

- **Submit's fixes.** The pane's Submit has the fixes its review asked for.
- **Reassess is a toggle.** Turned on, it adds a trailing `reassess` line to the draft; turned off, it takes it out.
- **The draft names the plugin.** The draft's answers open on the line `coding-agent-kanban-turns@nix-pinned:`.
- **A settled item shows its answer.**

Checks: the repository's checks pass, with an engine test in `plugin/plugin-tests/` for each bullet.

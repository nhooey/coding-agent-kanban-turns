---
title: The line above the prompt is the skill's count line and a window button that opens the pane
state: implemented
kind: implementation
part-of: kanban-pane
needs: [pane-lists-raised-items]
touches: [plugin/hooks/register.tsx, plugin/src/counts.ts, plugin/src/view.ts, plugin/src/layout.ts, plugin/defaults/config.jsonc, plugin/types/index.d.ts, plugin/plugin-tests/]
---

# The line above the prompt is the skill's count line and a window button that opens the pane

- **One line.** The `AbovePrompt` hook draws the count line from `outstanding.py render --counts`, then a `🪟 ↗` button that opens the pane with the keyboard; pressing the count line opens it too. With no count line, or while a survey shows, it passes the site on with `next(e)`.
- **No fallback.** `🧠 N open decisions` (`openDecisions`) goes: the line is the skill's count line or nothing.
- **The band goes.** The item drawn above the prompt, its fold to the count line and its view logic (`bandView`, `fitsBand`, `foldedLine`) go with their tests and the settings only they read.

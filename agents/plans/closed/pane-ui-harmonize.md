---
title: The pane and the boxes under replies share one style, with a header, a footer holding the draft and its buttons, and turn dividers
state: implemented
kind: implementation
owner: pane-ui-harmonize
implemented-by: "#36"
touches: [plugin/hooks/register.tsx, plugin/src/view.ts, plugin/src/layout.ts, plugin/defaults/config.jsonc, plugin/plugin-tests/]
---

# The pane and the boxes under replies share one style, with a header, a footer holding the draft and its buttons, and turn dividers

- **Header and footer.** The pane has a header, and a footer holding the draft and its buttons.
- **Turn dividers** part the pane's items by turn.
- **Settled items are collapsed.**
- **Boxes replace the reply's Decide list** under a reply.
- **Keys** reach the pane's buttons, as `plugin/defaults/config.jsonc` sets them.
- **One style** for the pane and the boxes under replies.

Checks: the repository's checks pass, with an engine test in `plugin/plugin-tests/` for each bullet.

---
title: The pane's header row and footer stay in sight while its items scroll
state: approved
kind: end-state
touches: [plugin/hooks/register.tsx, plugin/test/engine/, README.md]
---

# The pane's header row and footer stay in sight while its items scroll

With the coding-agent-kanban-turns plugin loaded:

- **The header row stays.** The pane's header row, `🖥️ Kanban · 📌 <count line>`, `n of m answered`, `↑ Previous`, `↓ Next` and `? Keys`, with whatever later joins it, stays at the pane's top while the person scrolls its items.
- **The footer stays.** The footer, the draft's summary, `🔄 Reassess` and `📤 Submit`, stays at the pane's bottom.
- **Only the items scroll.** The turn headers, items and Done sections between them are the pane's scrolled body, and scrolling moves nothing else.

## Why

The engine scrolls the pane's whole tree, so the global buttons move away as the person scrolls the items. Its `SiteScroll { offset, bodyRows }` is engine-owned, and per the engine's types the pane's hook isn't asked again when the engine scrolls the pane itself on the terminal, so the plugin can't redraw the rows at the window's edges on each scroll.

## How

**An engine feature:** the pane gets a header and a footer the engine draws outside its scrolled body, fixed at the pane's top and bottom. The plugin puts the header row in the one and the footer in the other, and the items in the body.

**This node waits on that feature.** No node models an external dependency, so it's written here: the fixed pane header and footer are asked of Anthropic as feedback on Claude Code, and nothing in this node can start until Claude Code ships it. When it does, an implementation node part of this one moves the two rows there, with an engine test that scrolls the pane and finds both rows still drawn.

**Considered and rejected,** because the layout as designed, controls in the pane's own header and footer, is preferred over a workaround:

- **(a) Move the global buttons to an always-visible site,** such as the line above the prompt, which already shows `🖥️ Kanban · 📌 …`. It keeps them in sight, but splits the pane's controls from the pane.
- **(b) Draw the header and footer at the window's edges from `offset` and `bodyRows`.** Unreliable: the hook isn't asked again on every scroll, so the rows would lag or vanish between redraws.

## Related

[pane-windowed-render](../items-events-views/open/pane-windowed-render.md) reads the same `SiteScroll` to draw only the items in or near the window. With a fixed header and footer, its window is the scrolled body alone, and the two rows sit outside its slice.

Checks: once the engine feature ships, an engine test in `plugin/test/engine/` scrolls a pane taller than its site and finds the header row and the footer drawn at every offset; the README's line that the header row scrolls away with the rest says it stays.

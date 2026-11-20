---
title: The pane draws only the items in or near its scroll window, from cached item heights
state: approved
kind: implementation
part-of: pane-every-list
needs: [pane-turn-sections, pane-turn-navigation]
touches: [plugin/hooks/register.tsx, plugin/src/window.ts, plugin/src/layout.ts, plugin/defaults/config.jsonc, plugin/plugin-tests/, plugin/test/]
---

# The pane draws only the items in or near its scroll window, from cached item heights

- **Windowed.** The pane's render reads the engine's `SiteScroll`, its `offset` and `bodyRows`, and draws only the headers and items in the window or within a margin of it, with a spacer row above and below of the height of what it leaves out. The margin is a setting in `plugin/defaults/config.jsonc`.
- **Heights.** A pure function gives an item's and a header's height in rows at a width, and those heights are cached per item and width, so scrolling and a refresh lay out only items that are new or changed and the window's own.
- **Keys stay reachable.** A turn header ◀ or ▶ scrolls to is drawn, or its offset is known from the heights, so `$.ui.scroll` reaches a turn outside the window.

Checks:

- tests in `plugin/test/` for the heights and for the window's slice, with spacers that add up to the left-out rows;
- a test that renders a session of 2000 Done items and 20 open ones and finds only the window's items in the rendered tree;
- in a live session of that size, scrolling and a refresh show no visible lag.

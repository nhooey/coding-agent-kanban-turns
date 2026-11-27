---
title: The pane draws only the items in or near its scroll window, from cached item heights
state: approved
kind: implementation
part-of: items-events-views
needs: [pane-facet-tree]
touches: [plugin/hooks/register.tsx, plugin/src/pane/window.ts, plugin/src/pane/layout.ts, plugin/defaults/config.yaml, plugin/test/engine/, plugin/test/unit/]
---

# The pane draws only the items in or near its scroll window, from cached item heights

- **Windowed.** The pane's render reads the engine's `SiteScroll`, its `offset` and `bodyRows`, and draws only [the tree](pane-facet-tree.md)'s nodes and items in the window or within a margin of it, with a spacer row above and below of the height of what it leaves out. The margin is a setting in `plugin/defaults/config.yaml`.
- **Only the items are windowed.** The header row and the footer stay whole and outside the window's slice, as [pane-controls-stay-visible](../../open/pane-controls-stay-visible.md) keeps them in sight; the window's `offset` and `bodyRows` count the scrolled body alone.
- **Heights.** A pure function gives an item's and a node's height in rows at a width, and those heights are cached per item and width, so scrolling and a refresh lay out only items that are new or changed and the window's own.
- **Keys stay reachable.** A node a jump scrolls to is drawn, or its offset is known from the heights, so `$.ui.scroll` reaches a node outside the window.

Checks:

- tests in `plugin/test/unit/` for the heights and for the window's slice, with spacers that add up to the left-out rows;
- a test that renders a session of 2000 closed items and 20 open ones, the closed node open, and finds only the window's items in the rendered tree;
- in a live session of that size, scrolling and a refresh show no visible lag.

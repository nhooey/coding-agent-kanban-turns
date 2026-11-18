---
title: The band and the tool row draw an item's links as links that open on a click
state: proposed
kind: implementation
part-of: kanban-next-chunk
touches: [mod/src/layout.ts, mod/hooks/register.tsx, mod/test/layout.test.ts]
---

# The band and the tool row draw an item's links as links that open on a click

- `kanban_options` and `outstanding.py decide --json` keep an item's Markdown links, `[label](url)`, in its summary, note, option names, consequences and ➕ and ➖ lines.
- The layout splits a line into text, code spans and links, as it splits code spans today, and counts a link by its label's width, so `fitsBand` still measures the drawn rows.
- The hooks draw each link with the engine's link element, its label underlined in the theme's link colour; a click opens the URL and doesn't pick the option the link sits in.

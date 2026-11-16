---
title: Answers gather in a basket and go out in one prompt on Submit
state: approved
kind: implementation
part-of: kanban-answers-in-transcript
needs: [kanban-items-tool-row]
touches:
  [
    plugins/coding-agent-kanban-answers/hooks/answers.ts,
    plugins/coding-agent-kanban-answers/types/index.d.ts,
  ]
---

# Answers gather in a basket and go out in one prompt on Submit

- `$.state` holds the basket: one entry per ref, its letters or its verb (`done`, `not now`, `looked`) and its note. A click on another option of a radio or binary item replaces its letter; a click on the option already picked, in any kind of item, unpicks it and takes the letter out, and an entry left with no letter and no note leaves the basket. A Todo's ✅ and a Review's 👀 unpick the same way.
- Submit writes one line per entry with the existing `written` format, puts them after the prompt draft's text, submits with `$.prompt.submit`, and empties the basket. The `prompt.submit` hook already folds the band while the reply runs.
- A prompt the user sends by hand leaves the basket as it is, so a half-built set of answers survives a question in between.
- The pure parts, entry updates and the composed text, live in `answers.ts` with their tests.

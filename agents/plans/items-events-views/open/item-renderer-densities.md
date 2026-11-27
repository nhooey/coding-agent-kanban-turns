---
title: One renderer draws an item as a chip, a line or a card, its marks from the spec and its controls from the transition table
state: approved
kind: implementation
part-of: items-events-views
needs: [item-event-reducer, hooks-split-by-concern]
touches: [plugin/src/pane/, plugin/hooks/register.tsx, plugin/defaults/config.yaml, plugin/src/config/config.ts, plugin/types/index.d.ts, plugin/test/unit/pane/, plugin/test/engine/]
---

# One renderer draws an item as a chip, a line or a card, its marks from the spec and its controls from the transition table

- **One row grammar everywhere.**
  `<state> <kind> #<id> <summary> · <owner> · <status clause>`, such as `○ ? #12 Which loader to keep · you · frees #14`.
- **One visual channel per field.**
  The state is its mark and, for a closed item, dimming; the kind is its glyph, or its preset's where it has one; the owner is the word after the summary, left out under a node that already groups by owner.
  No glyph stands for two fields at once.
- **Three densities of one function.**
  `render(item, density, view)` gives a neutral layout, which the hooks map onto the engine's elements and the tool's result writes as text:
  - a **chip**: the mark, the glyph and the id, with the summary where there's room;
  - a **line**: the row grammar;
  - a **card**: the line, the body, and the controls.

  Each density holds everything the one before it does.
  The pane, a reply's references, the cards under a reply, the tool's row and the count line all call it, so an item looks the same wherever it's drawn.
- **A field is drawn by its type.**
  The summary and the body as text, with their code spans; an actor as its class's label, `you`, `agent` or the external's name; a link as its status clause; a question's `response` as its options.
  The card draws the item's fields, in the item's order, and no field is copied into another shape first.
- **The controls come from the transition table.**
  A card draws one control for each of the spec's `controls` whose event the person may fire on the item, as [the fold](item-event-reducer.md)'s guards say, in the spec's order.
  The guards are asked of the item as the log has it, so a queued item, drawn in the state its pending event gives it, keeps the controls it had, and its pick is changed or taken back with one press.
  A press gives the control's event, and nothing else: the renderer writes no draft and sends nothing.
- **One shape for every control.**
  Each control is a line of its own that opens on its emoji, then its label, and a card's controls are a column of such lines, whatever the item's kind:

  ```text
  ○ ☐ #13 Rotate the deploy token · you
      The old one expires on Friday.
      ✅ Done
      🚫 Skip
      ↪️ To agent
      ✏️ Add a note

  ○ ? #12 Which loader to keep · you · frees #14
      Both are built; this only picks the default.
      🔘 A  Keep the fast loader: it survives restarts
            ➕ faster cold starts
            ➖ disk use
      🔘 B  Keep the small loader: simpler
            ➕ less code
            ➖ slow cold starts
      ✏️ Answer in words
  ```

  A task's Done, Skip and note and a question's options are the same thing drawn the same way: a row per transition the person may fire, laid out by one function that takes a control and never a kind.
  So no kind has a layout of its own, and a kind or a control added to the spec is drawn in this shape with no code changed.
  A control's emoji and label are settings, under `actions` in `plugin/defaults/config.yaml`, keyed by the control's name; an option's emoji is its option kind's, from the spec.
- **What's special, by the spec's `special` entries.**
  - **A question's options.**
    Its `resolve` gives one control per option in place of one for the transition, each in the shape above, with the option's ➕ and ➖ lines under its row as part of the same target.
    A field for an answer in words follows where `picks` allows it, as a note's row follows a task's controls.
  - **An item that blocks the agent** carries that in its status clause, and the tree sorts it first.
  - **An item being reassessed** is drawn dim, at line density, with the clause `being reassessed` and no control, wherever it's drawn ([reassess-holds-items-until-done](reassess-holds-items-until-done.md)).

  The renderer looks each up by its name in a table whose keys are the spec's `special` entries, and has no other branch on what an item is.
- **A pending event is drawn the same everywhere.**
  A control the draft picks, an option or any other, has its emoji turned to the chosen mark, `marks.chosen`, and the item's status clause says what is queued, `queued: B` or `queued: done`.
  Both come from the parse of the draft's text, [the grammar](item-reference-grammar.md)'s `eventsOf`, and from nothing a press stored, so a line the person edits or deletes by hand changes the marks as a press does.
- **Every drawing is live.**
  The renderer takes the item as the fold has it, so an old reply's row for an item since closed is dim and carries its resolution, `answered B`.
- **The status clause** names what the item's links point at, with the target's live state: `blocked by #12`, `blocked by shell b3f1 (running 2m)`, `frees #14`, `PR open, checks passing`.
  A harness entity or an artefact is drawn nowhere else: it gets no row of its own.
- **Marks.**
  A kind's, a preset's and a state's glyph are the protocol's, from the spec; the marks the pane adds, such as the chosen mark, and every colour are settings.

Checks:

- unit tests in `plugin/test/unit/pane/` for each density of a task and a question, open, active and closed, and as text;
- a property test over random items that a card's controls are the transitions the person may fire on it, one control each, and that a closed item offers `reopen` alone;
- a property test over random items of every kind that each control of a card is one row, alone on its line, opening on its emoji, and that a task's rows and a question's come from the one layout function;
- a test that the control's layout function takes a control and its mark, and no item, kind or preset;
- a property test that a card's layout holds its line's, and a line's its chip's;
- a test that the renderer's special-case table has the spec's `special` names as its keys, and no other;
- the fixture spec with other names, and a kind, a state and a control added, is drawn with no code changed;
- engine tests in `plugin/test/engine/` that press a control and read its event, and press an option and read its mark.

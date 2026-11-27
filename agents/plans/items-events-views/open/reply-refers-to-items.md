---
title: A reply refers to items by id, each reference drawn from the events as a link to its item, and its prose restates nothing the events hold
state: proposed
kind: implementation
part-of: items-events-views
needs: [item-tool-declares-events, item-renderer-densities, item-reference-grammar]
touches: [plugin/src/transcript/reply.ts, plugin/src/pane/links.ts, plugin/src/lint/reply.ts, plugin/hooks/register.tsx, plugin/spec/kanban.yaml, plugin/spec/fragments/, plugin/src/protocol/instructions.ts, plugin/test/unit/, plugin/test/engine/, README.md]
---

# A reply refers to items by id, each reference drawn from the events as a link to its item, and its prose restates nothing the events hold

The person chose both outputs: "Keep outputting in both places, with links to the items in the prose, so they appear in the transcript, but can also appear more structured in the pane" (`64b1cbcd.Decide.2`).
The events the item tool takes are the source of truth, the reply shows the items in its prose by their ids, as links, and the pane shows them structured.
This node says how the two stay consistent.

## How the prose and the events stay consistent

| Way                   | What the agent writes in the reply                    | What keeps it true                                                              | Cost                                                                                                                                      |
| --------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Checked               | Each item again in prose: its summary and its options | A lint at the turn's end compares the prose with the events                     | Two sources. The lint finds drift after it's written, and the match is by text, which a summary that runs on into its sentence breaks      |
| Rendered              | No item at all                                        | The plugin draws the turn's items from the events                               | One source, but the prose can't say which item a sentence is about, and the person asked for links in the prose                           |
| Refers, **recommended** | The item's id where the prose speaks of it, `#12`   | The plugin draws the item at the reference, from the events; the id is all the prose holds | One source. The raw text of a reply shows ids alone, so the tool's result carries the items as text for a reader without the plugin |

**The recommendation is the third, with the second's drawing and a narrow form of the first's check:**

- **The prose refers.**
  It names an item by its id and writes none of what the log holds about it: no summary copied, no options, no owner, no state.
  A sentence may say what the item is about in its own words; no reader takes data from it.
- **What's drawn at a reference is rendered.**
  The plugin draws each reference from the fold, so the summary, the state and the options a person sees in the reply are the events', and can't differ from the pane's.
- **The check is of the references alone.**
  There is no item text in the prose to compare, so the turn's end checks only that every reference names an item of the log, and that every item the turn left awaiting the person is referred to.

The first two ways each fail one of the person's two requirements, one source of truth and items in the prose.
The third meets both, and by construction: prose that holds only an id has nothing to contradict the events with.

## What is true when it's done

- **A reference.**
  `#12` in a reply's prose is a reference when the log holds item 12 and it stands outside a link, a code span, a code block and `owner/repo#12` (open question 2 in [the end state](items-events-views.md)).
  A parser over the reply's blocks finds the references, with no regular expression over the raw text.
- **Drawn as a chip, and a link.**
  Each reference is drawn as the item's chip by [the renderer](item-renderer-densities.md), its mark, its glyph, its id and its summary, live: a reference to an item since closed is dim and says how it closed.
  A click opens the pane with the keyboard at the item, every node on its path opened.
- **The cards under a reply.**
  Under a reply's text, the plugin draws the card of each item the reply refers to that the person has a control on and that isn't closed, in the order of their first references, each once.
  Its controls write the draft as the pane's do.
  The stored reply is unchanged, so ctrl+o shows it as written.
- **The digest on the tool's row.**
  The item tool's row draws its own call's events, each as the item's line, grouped by verb, live as every drawing is.
  The transcript so shows events where they happened, and the pane shows state.
- **No list is cut out of a reply,** and no summary is matched to an item: an id names its item exactly, in any turn's reply.
- **The check at the turn's end.**
  With `lint.turn-end` on, the plugin reads the final response's references against the fold and finds:
  - a reference to an item the log doesn't hold;
  - an item this turn's events left open and owned by the person that the response never refers to.

  What it finds is shown beneath the response and goes in the next prompt's context, as the turn's-end lint's findings do.
  The layout rules for lists, headers, underlines and the 📌 roll-up are [reply-prose-readers-retired](reply-prose-readers-retired.md)'s to take out.
- **The instructions.**
  The fragments in `plugin/spec/fragments/` teach the reply's shape from the spec: prose that says what changed, a reference wherever it speaks of an item, every item that awaits the person referred to at least once, a pull request named by a link or with its repository, and no list, roll-up or count line typed by hand.
  The progress updates between tool calls stay as they are.
- **Pure.**
  The references of a reply, the cards under it and the check's findings are pure functions of the reply's text and the items.

Checks:

- unit tests for the references: in a sentence, at a line's start, twice in a reply, inside a link, a code span and `owner/repo#12`, and naming no item;
- unit tests for the cards under a reply, in reference order, each once, a closed item's left out;
- unit tests for the two findings, and a response that refers to every open item of the person's with none;
- a property test over random logs and replies that what a reference draws equals what the pane draws for that item at the same density;
- engine tests in `plugin/test/engine/` that draw a reply's reference as a link, press it and find the pane at the item, press a control on a card under the reply and read the draft, and close the item and find the earlier reply's reference dim;
- `README.md`'s sections on a reply describe the references and the cards.

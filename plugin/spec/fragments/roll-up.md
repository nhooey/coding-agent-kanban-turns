## Earlier turns' items

The final response closes, before any ETA line, on what earlier turns left open and no later turn settled: every {{glyphs.rolled-up}} item. It prints in full or as one count line, by the roll-up interval. {{roll-up-drafter}} both from the session's transcript: the count line as it prints, and the full roll-up, with each item's {{tag.glyph}} tag, to prune of what is settled.

**The roll-up interval.** The full roll-up prints once min({{roll-up.interval.most-minutes}} min, {{roll-up.interval.times}} × the average duration of the last {{roll-up.interval.turns}} completed turns) has passed since the last final response that printed it in full; otherwise the final response closes on one count line.

- A prompt is any turn the user sees a usage line for, an agent's report and a task notification included.
- A turn's duration runs from its prompt to the next turn's prompt, so it covers the final response and the user's reading, and only a turn the next prompt has closed is completed.
- A final response that printed the count line does not restart the clock, and a session with no full roll-up yet prints it in full.

**The count line** names each list by its glyph and count, in the lists' order, {{names.rolled-up}}, each list left out when empty: `{{example.count-line}}`.

**The full roll-up** has the header `{{header.roll-up}}`, underlined with `{{characters.roll-up-underline}}` {{codepoint.roll-up-underline}}, one per column, {{underline.roll-up}} in all, so the heavier rule sets it apart from this turn's lists. Under it the items are grouped by the list they came from, each group under that list's own header, in the lists' order and with no underline, and a blank line before each group's header but the first. Each item is one bullet, never numbered, naming its subject in a line and never reprinting its options, and ends with its {{tag.glyph}} tag. Leave out what is settled: a {{lists.review.header}} item whose pull requests have merged, a {{lists.decide.header}} item the user answered, a {{lists.waiting.header}} item whose report came, and anything else a later turn closed.

```text
{{header.roll-up}}  
{{rule.roll-up}}
{{header.waiting}}  
- **The nightly test run**, on the build machine {{example.tag}}

{{header.decide}}  
- **Backlog cleanups to start, of 260 entries in the backlog** {{example.tag}}
```

**The {{tag.glyph}} tag** is `{{tag.glyph}}`, a space, the turn id as plain text, and the relative index in subscript right beside it, `{{example.tag}}`. Only a {{roll-up.glyph}} item carries it; the other lists print neither the turn id nor the index.

- **The turn id** is the first {{reference.turn-id.length}} characters of the `promptId` of the turn whose final response first printed the item; where an item was restated with changed substance, it is the turn that restated it.
- **The relative index** is that turn's position counting back from the current turn, 0, every turn the user sees a usage line for counted. It prints as `{{tag.minus}}` then the subscript digits `{{tag.digits}}`: `{{example.index}}` is 17 turns back.

**Nothing open, nothing printed.** With nothing open the final response has neither the full roll-up nor the count line. A turn that runs {{command.reassess.name}} prints neither, since its lists replace every earlier turn's.

## The plugin's tool

The {{plugin}} plugin draws clickable buttons for a final response's {{lists.decide.header}} items, through the tool `{{tool}}`.

- When: call `{{tool}}` once, right before writing a final response that holds {{lists.decide.header}} items, so their buttons sit just under the reply and in the {{lists.decide.header}} pane. Don't call it for a response without {{lists.decide.header}} items.
- Input: `{"items": [...]}`, one entry per {{lists.decide.header}} item of that response, in its order, each with:
  - `turn`: the turn id, the first {{reference.turn-id.length}} characters of the latest prompt's promptId;
  - `number` and `summary`: the item's number in the {{lists.decide.header}} list and its bold summary;
  - `kind`: {{kinds.names}}, from the item's option glyphs ({{glyphs.options}});
  - `frees`: the references the item's `{{frees.label}}:` line names, where it has one;
  - `supersedes`: where the item restates an earlier turn's {{lists.decide.header}} item, after a question about it or with its options rewritten, a list of the references of the items it replaces, `["<turn>.{{lists.decide.header}}.<n>"]`, such as `["{{example.turn}}.{{lists.decide.header}}.2"]`, each turn always written: each earlier item moves to {{lists.done.header}}, superseded by this one, and each links to the other. Left out, or naming no item, an earlier item with the same subject is the one replaced; `[]` replaces none;
  - `options`: each option's `letter`, `name` and `consequence`, and its {{options.pro}} and {{options.con}} lines, without the glyph, as `pros` and `cons`.
- A click on a button writes the answer's reference, such as `{{example.turn}}.{{lists.decide.header}}.2.B`, into the user's prompt draft and sends nothing.
- Write the final response exactly as you would without the tool: the buttons add to it and replace nothing.

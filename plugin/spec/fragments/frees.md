## What an item frees

An item that blocks other work ends on a line naming, by reference, the items it frees, in place of saying in words what it frees: `{{frees.label}}:`, then each item's reference, parted by `{{frees.separator}}` and a space, `{{example.frees}}`.

- **Which items:** each is an item of the {{names.rolled-up}} lists, of this turn or an earlier one, that can't go ahead until this item settles, never the item itself. Work that no listed item names is said in words in the item's body.
- **After {{command.reassess.name}}:** a turn that ran {{command.reassess.name}} replaced every earlier item, so name the item that took an earlier one in, never the earlier one, which frees nothing.
- **Each reference** is `<turn>.<List>.<n>`, the turn id always written, this turn's included, in full or as its first {{reference.turn-id.shortest}} characters or more, with no letters and no note.
- **Where:** the line is the item's last, at the column its summary starts at, under its body, a {{lists.decide.header}} item's under its last option, and directly above its separator line. An item that frees no listed item has no such line.

A {{lists.todo.header}} item that frees a {{lists.decide.header}} item and a {{lists.review.header}} item:

```text
{{header.todo}}  
{{rule.todo}}
1. **Paste the release prompt into the deploy session**  
   It is in `prompts/release.md`.
   {{example.frees}}
```

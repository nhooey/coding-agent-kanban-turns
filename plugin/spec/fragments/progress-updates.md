## Progress updates

A progress update is any text the agent writes between tool calls before the final response. It is one line, written only when something has changed: a step finished, a step started, or the plan changed. Each step it names opens on its state emoji, the steps parted by a space, `{{roll-up.count-mark}}` and a space, as the count line's lists are, finished first:

```text
{{lists.done.glyph}} the waiver clauses read{{roll-up.count-separator}}🏃 checking the 2020 resolutions{{roll-up.count-separator}}💤 the limitation sections
```

| Emoji | State |
| --- | --- |
| {{lists.done.glyph}} | done |
| 🏃 | running |
| {{lists.waiting.glyph}} | waiting on other work |
| 👀 | waiting on the user |
| 💤 | not started, nothing in its way |
| ❌ | failed or abandoned, with why in a few words |

{{lists.waiting.glyph}} also heads the {{lists.waiting.header}} list, since both mean waiting on something other than the agent and the user.

A step names its subject, never its category: "the 2020 resolutions", not "the documents". A progress update carries no lists, no {{roll-up.glyph}} roll-up and no decisions; anything that needs the user waits for the final response, unless the work cannot go on without it.

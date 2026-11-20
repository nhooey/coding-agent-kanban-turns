## A {{lists.decide.header}} item

- **Options:** they follow the item's summary and its note, recommended first, each on one line, as `glyph letter. **name**: consequence`. The letter is a capital, {{letters.example}}, never a number or a lower-case letter: an answer like `1.B` then cannot be misread, since the number always names the item and the capital the option, and a typo lands on no option instead of the wrong one. The AskUserQuestion picker, when it opens, lists the same options in the same order.
- **Pros and cons:** every option carries, indented under it, a {{options.pro}} line for what it gains and a {{options.con}} line for what it costs; the recommended option's {{options.pro}} says why. {{lists.done.glyph}} and ❌ are kept for the {{lists.done.header}} header and the done and failed states, so a pro line never reads as finished work.
- **Notes:** a note on the whole item is the line under its summary, and a note on one option goes under that option, in plain lines at its {{options.pro}} and {{options.con}} lines' indent. A note among the options is never a `-` or `1.` list: the option lines are plain lines of the item's paragraph, so a list there captures every line after it, the later options among them, and prints them at its own indent.
- **Each item and option stands alone.** Read with nothing above it, the summary names the thing decided and each option names what it acts on and what it does to it: the entry number and its title in a few words, the file, branch, table or step, the count. A label that only points back, "the 4 gate bugs", "the fix above", "part S", says what it points at in the same line, "entries 0819, 1375, 0988 and 1374, the stale-database and stale-render bugs".

An item's kind is the glyph its options open with:

| Glyph | Kind | Options chosen | Letters |
| --- | --- | --- | --- |
| {{options.kinds.radio.glyph}} | {{kind.radio.name}} | {{options.kinds.radio.picks}} | {{letters.radio}} |
| {{options.kinds.checkbox.glyph}} | {{kind.checkbox.name}} | {{options.kinds.checkbox.picks}}, none included | {{letters.checkbox}} |

A pair of courses answered with a label is a {{kind.radio}} item. A yes-or-no question is a {{kind.radio}} item too, with both answers written as options, {{letters.pair}}, the recommended one first, each naming what it does, never a bare "yes" or "no": with one answer form for every item, `{{lists.decide.header}}.2: B` names an option the same way whatever the question.

A {{lists.decide.header}} list in this shape, a {{kind.checkbox.name}} item and a yes-or-no question as a {{kind.radio.name}} item, its recommended answer first as `A`:

```text
{{header.decide}}  
{{rule.decide}}
1. **Backlog cleanups to start, of 260 entries in the backlog**  
   Any of 2. Note on the whole decision: the figures, the words at issue.
   {{options.kinds.checkbox.glyph}} A. **Entry 1411, the 4 quotation matchers made one**: one matcher for the loader, the render and the checks.
      {{options.pro}} A citation lands or fails the same way everywhere.
      {{options.con}} About 1M tokens, and it waits for `case-law-load`, which edits the same code.
   {{options.kinds.checkbox.glyph}} B. **Entries 0550 and 0455, dead code**: delete `findings_sources.py`.
      {{options.pro}} About 0.1M tokens.
      {{options.con}} Nothing gained but tidiness.
   {{characters.separator}}
2. **Ship the 2.4 release tonight?**  
   The release notes are written and the checks pass.
   {{options.kinds.radio.glyph}} A. **Ship it tonight**: tag `v2.4` and publish.
      {{options.pro}} Users get the tokenizer fix a day sooner.
      {{options.con}} Nobody watches the rollout overnight.
   {{options.kinds.radio.glyph}} B. **Hold it for the morning**: tag and publish at 9.
      {{options.pro}} The rollout is watched.
      {{options.con}} The fix waits a day.
```

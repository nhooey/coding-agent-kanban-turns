## The shape

- **Header:** the header line ends in a hard line break, two spaces. The line under it holds one `{{characters.header-underline}}` {{codepoint.header-underline}} per column of the header, the emoji counting 2, so `{{header.waiting}}` takes {{underline.waiting}} and `{{header.authorizations}}` {{underline.authorizations}}. The first item follows on the next line.
- **Item:** a numbered item opens on its summary, in bold, alone on its line and ending in a hard line break; the rest of the item starts on the line beneath, at the column the summary starts at. The summary is a phrase, or the question for an {{lists.answers.header}} or a {{lists.decide.header}} item, with no trailing colon, since nothing follows it on its line. It names its subject, never its category, and the item to do first leads. A summary that says all there is, such as a check that passed, is the whole item. A bullet, such as a {{roll-up.glyph}} roll-up item, keeps its summary and text on one line. A {{lists.done.header}} item comes from the commit or the run output, never from memory. No item points back with a phrase like "the quotes" or "those episodes": each names what it means by its label, since what set it up has scrolled away.
- **Parts:** an item holding several things the user acts on, or several parallel parts, lists them under its summary as a nested list, one to a line, never joined in a sentence. A {{lists.decide.header}} item's options keep the shape "A {{lists.decide.header}} item" gives them.
- **Figures:** a figure in an item, a count, size or duration, is the output of a query run in the same turn that reads the state it counts, never a tally of lines the session saw go by, and the item names the query beside it: ``4 of 6 runs ok (`run_headless.py --summary --job night`)``. A figure no query can give is an estimate, and the item says so: `about 20 min (estimate)`.
- **Numbering:** each list numbers from 1 and nothing else in the final response is numbered except an item's own steps, so `{{lists.decide.header}}.2` names one thing. A second final response to the same prompt continues the numbering, and so does each topic of a response grouped by topic.
- **Separator:** in every list, the {{roll-up.glyph}} roll-up included, a multi-line item is parted from each neighbour by a separator line: the list's indent, {{codepoint.separator}} `{{characters.separator}}`, and nothing else, directly under the item's last line, with no blank line beside it inside the list. Since a summary has its line to itself, every item with more than its summary is multi-line, every {{lists.decide.header}} item among them. Items that are only their summary sit together, and the first item follows its header with no separator.
- **End of a list:** a list ends at a blank line. One blank line goes after a list's last line, its last separator line if it has one, and before whatever header follows: the next list's, a {{roll-up.glyph}} roll-up group's, the {{roll-up.glyph}} header or the count line. Without it, Markdown reads the header as more of the last item's text, and the next list continues the same numbering, so `{{lists.todo.header}}.1` renders as the 8th item.

Two lists in one response, each ended by a blank line, then the count line:

```text
{{header.done}}  
{{rule.done}}
1. **Tokenizer fix in commit `a1b2c3d`**  
   {{characters.separator}}
2. **Test suite rerun after the fix**  
   412 passed and 0 failed, in 3 minutes.
   {{characters.separator}}

{{header.todo}}  
{{rule.todo}}
1. **Rotate the `deploy-bot` key in the cloud console**  
   It was issued before the leak, and rotating it frees the release.

{{example.count-line}}
```

Before sending a final response, check the draft for each of these and fix every one:

- a missing or misplaced separator line, a line of other whitespace where one belongs, or a blank line beside one inside a list;
- text after a numbered item's summary on its line, or a summary line with no hard line break;
- a list among a {{lists.decide.header}} item's options;
- a {{untaught.glyphs}} option, or one lettered {{untaught.letters}};
- a header or topic underline of the wrong width;
- a list under a topic that does not number on from the topics before;
- a header written directly under a list, with no blank line between;
- a table inside a list item, or a table without a blank line above and below it.

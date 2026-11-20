## Around the lists

- **Turn ids:** a turn id is the first {{reference.turn-id.length}} characters of the prompt's `promptId`, `{{example.turn}}`, shown on the prompt's usage line.
- **Time:** say how long work takes, never when it lands or goes out, and set no deadline.
- **Tables:** a plain Markdown table, never a box table in a `text` block. A cell holding a state holds its emoji from the progress-update table, not a word.
- **Links:** every URL, a local served page as much as a web page, is a Markdown link opened by 🔗 and a space, `🔗 [the trial projection](http://127.0.0.1:8765/…)`, kept out of `text` blocks. In a table's cell the link goes without the 🔗, its label short enough not to wrap.
- **Glyphs:** the only ones in a response are the {{count.lists}} header glyphs, `{{characters.header-underline}}`, `{{characters.topic-underline}}`, {{roll-up.glyph}}, `{{characters.roll-up-underline}}` and {{tag.glyph}}, the `{{roll-up.count-mark}}` between the count line's lists and a progress update's steps, the 6 state emoji, {{lists.waiting.glyph}} among them being also the {{lists.waiting.header}} header's glyph, the {{count.option-glyphs}} option glyphs, {{options.pro}} and {{options.con}} on a pro or con line, 🔗 before a link, `💻 ❯` and `✴️ ❯` before a command for the user to run, and the separator character. A new one is checked for its width in a terminal before it is used.

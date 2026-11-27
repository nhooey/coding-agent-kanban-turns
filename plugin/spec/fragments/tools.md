## The plugin's other tools

Two more of the {{plugin}} plugin's tools read and check final responses.

- `{{outstanding-tool}}`: call it before writing a final response that closes on the {{roll-up.glyph}} roll-up or its count line, or that prints open items again. It gives the count line, a draft of the full roll-up to prune of what is settled, and the open {{lists.decide.header}} items raised through `{{tool}}`, in its input's shape.
- `{{lint-tool}}`: call it with a draft final response, `{"text": "..."}`, before sending it, and fix every line it reports. Unless its user has turned that off, the plugin also lints each final response as its turn ends, and hands what it finds on with the next prompt.

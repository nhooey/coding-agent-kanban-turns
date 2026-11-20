---
title: Golden cases, as YAML, give transcripts with their expected open items, count line and lint findings
state: implemented
kind: implementation
part-of: plugin-sole-source
needs: [protocol-spec-data, neutral-turn-stream]
touches: [plugin/spec/cases/, plugin/tools/spec/cases.ts, plugin/tools/spec/strict.ts, plugin/tools/spec/load.ts, plugin/test/unit/]
implemented-by: protocol-golden-cases
---

# Golden cases, as YAML, give transcripts with their expected open items, count line and lint findings

- **A case is data.** Each case is a YAML file in `plugin/spec/cases/`, read strictly with the same library and schema rules as the spec ([protocol-spec-data](protocol-spec-data.md)), by the one module both use, `plugin/tools/spec/strict.ts`, against its JSON Schema, `case.schema.yaml`, beside the cases. It holds a transcript, as a list of neutral turns ([neutral-turn-stream](neutral-turn-stream.md)), and what the core gives for it:
  - the open items, by reference: the Decide items the `kanban_options` calls raised that nothing settled;
  - the outstanding items: each item of a list that rolls up into 📌 that nothing settled, by its list's header and its summary;
  - the 📌 count line;
  - the command each turn's prompt runs, none where it runs none;
  - the lint findings for each reply, by line and rule, empty for a clean one.
- **A reply's text shows its hard line breaks.** It is a double-quoted scalar, each line ending on `\n\`, so a summary's 2 trailing spaces stand before the `\n` and no editor that strips trailing whitespace drops them.
- **What no schema can state is checked too.** `plugin/tools/spec/cases.ts` refuses:
  - a turn id the reference grammar can't write, or one opening two turns;
  - a command or an option kind the spec doesn't name;
  - an option letter outside the reference grammar's letters, one its kind doesn't take, or one given twice in an item;
  - an item raised twice in a turn;
  - a lint finding past its reply's last line;
  - a reply's line, in the case's source, that doesn't end on `\n\`.
- **A case is a worked example unless it says otherwise.** A case whose replies break a rule on purpose, such as a lint case, says `example: false`; every other case's replies keep the protocol, so the derived skill can show them.
- **Cases cover the spec.** Between them, the cases hold every list and every older name of a list or the roll-up, every option kind, every command and synonym, by a prefix and from a prompt's last line, every skill command, every settling word, the reference grammar's forms and a reply with each lint finding. A test checks each, and each older name is pinned by a case that fails without it.
- **The tests run them.** One test in `plugin/test/unit/protocol/golden-cases.test.ts` runs every case through the core and compares each output with the case's expectation, so a new case needs no new test code. A lint expectation runs through the reply lint ([plugin-tools-replace-skill-scripts](plugin-tools-replace-skill-scripts.md)).
- **The derived skill's examples render from them.** The skill's build ([derived-skill-package](../open/derived-skill-package.md)) turns chosen cases into its worked examples, so an example can't drift from what the plugin does.

Checks: the case runner passes; a case whose expectation is changed by hand fails it.

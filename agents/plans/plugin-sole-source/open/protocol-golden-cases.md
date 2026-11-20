---
title: Golden cases, as YAML, give transcripts with their expected open items, count line and lint findings
state: approved
kind: implementation
part-of: plugin-sole-source
needs: [protocol-spec-data, neutral-turn-stream]
touches: [plugin/spec/cases/, plugin/test/unit/]
---

# Golden cases, as YAML, give transcripts with their expected open items, count line and lint findings

- **A case is data.** Each case is a YAML file in `plugin/spec/cases/`, read strictly with the same library and schema rules as the spec ([protocol-spec-data](../closed/protocol-spec-data.md)), holding a transcript, as a list of neutral turns ([neutral-turn-stream](../closed/neutral-turn-stream.md)), and what the core gives for it:
  - the open items, by reference;
  - the 📌 count line;
  - the lint findings for each reply, empty for a clean one.
- **Cases cover the spec.** Between them, the cases hold every list, every option kind, every command and synonym, every settling word, the reference grammar's forms and a reply with each lint finding.
- **The tests run them.** One test in `plugin/test/unit/` runs every case through the core and compares each output with the case's expectation, so a new case needs no new test code. A lint expectation runs once the lint exists ([plugin-tools-replace-skill-scripts](plugin-tools-replace-skill-scripts.md)).
- **The derived skill's examples render from them.** The skill's build ([derived-skill-package](derived-skill-package.md)) turns chosen cases into its worked examples, so an example can't drift from what the plugin does.

Checks: the case runner passes; a case whose expectation is changed by hand fails it.

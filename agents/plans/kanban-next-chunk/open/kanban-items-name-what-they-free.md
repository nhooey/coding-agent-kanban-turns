---
title: Each item that blocks other work names the items it frees, by reference
state: proposed
kind: implementation
part-of: kanban-next-chunk
---

# Each item that blocks other work names the items it frees, by reference

- A shared rule: an item's last line may be `Frees: <ref>, <ref>`, each ref an item of this or an earlier turn. The skill's Todo items already say "what it frees" in words; this makes it a reference the scripts can read.
- `outstanding.py` reads the line into a `frees` list on each item, and the mod's transcript reader does the same with the same tests.
- `kanban_options` takes an optional `frees` on each Decide item.
- The change comes with a pull request to coding-agent-skills making the same change to the skill, as `AGENTS.md` says of the shared rules.

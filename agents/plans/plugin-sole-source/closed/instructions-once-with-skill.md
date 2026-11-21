---
title: With the plugin's hooks and its skill both loaded, the agent gets the protocol's instructions once
state: implemented
kind: implementation
part-of: plugin-sole-source
needs: [derived-skill-package]
touches: [plugin/src/transcript/instructed.ts, plugin/src/protocol/instructions.ts, plugin/spec/, plugin/skills/, plugin/test/unit/, plugin/test/engine/]
implemented-by: instructions-once-with-skill
---

# With the plugin's hooks and its skill both loaded, the agent gets the protocol's instructions once

The plugin carries the skill as a fallback ([derived-skill-package](derived-skill-package.md)), and both hold the same instructions, so a conversation could get them twice: from the hooks, and from the agent loading the skill. Each side checks for the other.

- **The hooks learn the skill is loaded from the transcript.** `instructing`, in `plugin/src/transcript/instructed.ts`, counts a load of the plugin's skill since the last boundary as carrying the instructions, as it counts a `context_sections` or `hook_additional_context` attachment now. A load is any of:
  - an assistant record's `Skill` tool use naming `coding-agent-kanban-turns:coding-agent-kanban-turn-responses`, whose tool result isn't an error;
  - the command record a user's `/coding-agent-kanban-turns:coding-agent-kanban-turn-responses` leaves, read from its opening tags, never from tags in the middle of a prompt;
  - the `invoked_skills` attachment Claude Code writes after a compaction, one of its `skills` named `coding-agent-kanban-turns:coding-agent-kanban-turn-responses`, outside a sidechain.

  The skill's name is read from the spec, not written in the code. A `/clear` drops the load with the rest of the conversation, and so does a compaction unless its `invoked_skills` attachment puts the skill back; the hooks send the instructions again where nothing after the boundary carries them.
- **The skill defers to the hooks.** The agent sees the skill's description before it loads it, so the description, from a prose fragment, says to load this skill only when the conversation holds no instructions block from the plugin. The instructions block opens with a line naming the skill and saying the block is its format, without its worked examples or its preferences files, so it needn't be loaded.
- **Not a pointer.** The hooks keep sending the instructions themselves, not a line asking the agent to load the skill: an injected block reaches the agent before its first reply, without depending on it choosing to call a tool, and the skill stays the fallback for when the hooks don't run.

Checks:

- a test of `instructing` finds the instructions not owed after a successful `Skill` tool use for the plugin's skill, owed after a failed one or one for another skill, and owed again after a boundary that follows the load;
- the same for the `/coding-agent-kanban-turns:coding-agent-kanban-turn-responses` command record, and none for those tags in the middle of a prompt;
- a test of `instructing` finds the instructions not owed after a compaction whose `invoked_skills` attachment names the plugin's skill, and owed after one naming only other skills;
- an engine test in `plugin/test/engine/` sends a prompt to a conversation whose transcript shows the skill loaded, and the hooks add no instructions;
- a Claude Code session with the plugin loaded writes its first reply in the kanban shape without loading the skill.

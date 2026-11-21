# plugin-skill-command

The plugin's own skill command, the plugin's name, a colon and the skill's, runs the command after it, typed or as the command record Claude Code leaves: a typed `reassess` replaces every earlier item, and an `open` sent as a command record reprints the open Decide item and replaces nothing

## Turn 1, `3a4b5c6d`

The prompt, from the user:

```text
Start on the loader.
```

The final response:

```text
The loader reads its cache twice.

🚧 **Pending:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Rework the loader**  
   It reads the cache twice.

🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **Which cache to keep for the loader**  
   🔘 A. **Keep the disk cache**: it survives restarts.
      ➕ Faster cold starts.
      ➖ Disk use.
   🔘 B. **Keep the memory cache**: simpler.
      ➕ Less code.
      ➖ Slow cold starts.
```

## Turn 2, `4b5c6d7e`

The prompt, from the user:

```text
/coding-agent-kanban-turns:coding-agent-kanban-turn-responses reassess
```

This prompt runs `reassess`.

The final response:

```text
The loader still reads its cache twice; which cache to keep is still open.

🚧 **Pending:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Rework the loader**  
   3 of its 9 tests pass.

🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **Which cache to keep for the loader**  
   🔘 A. **Keep the disk cache**: it survives restarts.
      ➕ Faster cold starts.
      ➖ Disk use.
   🔘 B. **Keep the memory cache**: simpler.
      ➕ Less code.
      ➖ Slow cold starts.
```

## Turn 3, `5c6d7e8f`

The prompt, from the user:

```text
<command-message>coding-agent-kanban-turns:coding-agent-kanban-turn-responses</command-message>
<command-name>/coding-agent-kanban-turns:coding-agent-kanban-turn-responses</command-name>
<command-args>open</command-args>
```

This prompt runs `open`.

The final response:

```text
🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **Which cache to keep for the loader**  
   (from 4b5c6d7e 1)
   🔘 A. **Keep the disk cache**: it survives restarts.
      ➕ Faster cold starts.
      ➖ Disk use.
   🔘 B. **Keep the memory cache**: simpler.
      ➕ Less code.
      ➖ Slow cold starts.
```

## What the plugin's core gives

- **Outstanding under 📌:**
  - Pending: Rework the loader
  - Decide: Which cache to keep for the loader
- **The count line:** `📌 Outstanding: 🚧 1 · 🧠 1`

# commands-by-every-name

Each name of each command runs it, as the prompt's first word, as a prefix no other command shares, or after the skill's slash command; a `reassess` turn's lists replace every earlier item, and it prints no 📌; an `open` turn reprints the open Decide item as written and replaces nothing; and a peer's `reassess` runs nothing

## Turn 1, `6d0f1154`

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

## Turn 2, `7e1a2265`

The prompt, from the user:

```text
recheck
```

This prompt runs `reassess`.

The final response:

```text
The loader no longer keeps a cache, so which cache to keep is moot.

🚧 **Pending:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Rework the loader**  
   It reads the store once; the tests are next.
```

## Turn 3, `8f2b3376`

The prompt, from the user:

```text
Regenerate.
```

This prompt runs `reassess`.

The final response:

```text
🚧 **Pending:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Rework the loader**  
   3 of its 9 tests pass.
```

## Turn 4, `9a3c4487`

The prompt, from the user:

```text
recalculate
```

This prompt runs `reassess`.

The final response:

```text
🚧 **Pending:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Rework the loader**  
   5 of its 9 tests pass.
```

## Turn 5, `a03c4490`

The prompt, from the user:

```text
reassess
```

This prompt runs `reassess`.

The final response:

```text
🚧 **Pending:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Rework the loader**  
   6 of its 9 tests pass.
```

## Turn 6, `ab4d5598`

The prompt, from the user:

```text
reas
```

This prompt runs `reassess`.

The final response:

```text
🚧 **Pending:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Rework the loader**  
   7 of its 9 tests pass.
```

## Turn 7, `bc5e66a9`

The prompt, from the user:

```text
/coding-agent-kanban-turn-responses reassess
```

This prompt runs `reassess`.

The final response:

```text
🚧 **Pending:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Rework the loader**  
   8 of its 9 tests pass.
```

## Turn 8, `cd6f77ba`

The prompt, from the user:

```text
<command-message>reply-block</command-message>
<command-name>/reply-block</command-name>
<command-args>reassess</command-args>
```

This prompt runs `reassess`.

The final response:

```text
The last test fails because the store keeps every snapshot.

🚧 **Pending:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Rework the loader**  
   8 of its 9 tests pass.

🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **Snapshot retention for the store**  
   🔘 A. **A week**: 7 snapshots.
      ➕ Little disk.
      ➖ A short history.
   🔘 B. **A month**: 30 snapshots.
      ➕ A long history.
      ➖ 4 times the disk.
```

## Turn 9, `de7088cb`

The prompt, from the user:

```text
open
```

This prompt runs `open`.

The final response:

```text
🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **Snapshot retention for the store**  
   (from cd6f77ba 1)
   🔘 A. **A week**: 7 snapshots.
      ➕ Little disk.
      ➖ A short history.
   🔘 B. **A month**: 30 snapshots.
      ➕ A long history.
      ➖ 4 times the disk.

📌 Outstanding: 🚧 1 · 🧠 1
```

## Turn 10, `ef8199dc`

The prompt, from the user:

```text
Pending
```

This prompt runs `open`.

The final response:

```text
🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **Snapshot retention for the store**  
   (from cd6f77ba 1)
   🔘 A. **A week**: 7 snapshots.
      ➕ Little disk.
      ➖ A short history.
   🔘 B. **A month**: 30 snapshots.
      ➕ A long history.
      ➖ 4 times the disk.

📌 Outstanding: 🚧 1 · 🧠 1
```

## Turn 11, `f0920aed`

The prompt, from the user:

```text
restate, please
```

This prompt runs `open`.

The final response:

```text
🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **Snapshot retention for the store**  
   (from cd6f77ba 1)
   🔘 A. **A week**: 7 snapshots.
      ➕ Little disk.
      ➖ A short history.
   🔘 B. **A month**: 30 snapshots.
      ➕ A long history.
      ➖ 4 times the disk.

📌 Outstanding: 🚧 1 · 🧠 1
```

## Turn 12, `f1a2b3c4`

The prompt, from the user:

```text
pend
```

This prompt runs `open`.

The final response:

```text
🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **Snapshot retention for the store**  
   (from cd6f77ba 1)
   🔘 A. **A week**: 7 snapshots.
      ➕ Little disk.
      ➖ A short history.
   🔘 B. **A month**: 30 snapshots.
      ➕ A long history.
      ➖ 4 times the disk.

📌 Outstanding: 🚧 1 · 🧠 1
```

## Turn 13, `0193b1fe`

The prompt, from a peer, an agent or another session:

```text
reassess
```

The final response:

```text
Another session's message names `reassess`; the items stay as they were.

📌 Outstanding: 🚧 1 · 🧠 1
```

## What the plugin's core gives

- **Outstanding under 📌:**
  - Pending: Rework the loader
  - Decide: Snapshot retention for the store
- **The count line:** `📌 Outstanding: 🚧 1 · 🧠 1`

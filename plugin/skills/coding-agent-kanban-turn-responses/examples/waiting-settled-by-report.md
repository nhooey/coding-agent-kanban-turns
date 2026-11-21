# waiting-settled-by-report

A report names a Waiting item, by a name it goes by or the item's branch, and settles it; the user's own text naming an item settles nothing

## Turn 1, `7a91bc35`

The prompt, from the user:

```text
Run the watcher and the implementer.
```

The final response:

```text
Three jobs run in the background.

⏳ **Waiting:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Watcher on #143 (`b8a83gfv0`)**
2. **The implementer, on branch `golden-cases-runner`**
3. **The nightly build (`n1ght1y`)**
```

## Turn 2, `8ba2cd46`

The prompt, from the user:

```text
Meanwhile, look at the pane.
```

The final response:

```text
The pane draws its buttons twice, once per refresh.

✅ **Done:**  
▔▔▔▔▔▔▔▔
1. **Watcher on #143, finished**  
   Every check on #143 passed.

📌 Outstanding: ⏳ 2
```

Sent while the turn ran, from a task's notification, naming `b8a83gfv0` as the work it reports on:

```text
<task-notification>
<task-id>b8a83gfv0</task-id>
<status>completed</status>
</task-notification>
```

## Turn 3, `9cb3de57`

The prompt, from a peer, an agent or another session, naming `a48bb9142825233bb` as the work it reports on:

```text
<agent-message from="a48bb9142825233bb">
Pushed branch golden-cases-runner at 1234abc.
</agent-message>
```

The final response:

```text
✅ **Done:**  
▔▔▔▔▔▔▔▔
1. **Branch `golden-cases-runner`, pushed at `1234abc`**

📌 Outstanding: ⏳ 1
```

## Turn 4, `add0ef68`

The prompt, from the user, naming `n1ght1y` as the work it reports on:

```text
The nightly build n1ght1y is done, I think.
```

The final response:

```text
Its log hasn't ended yet, so it still runs.

📌 Outstanding: ⏳ 1
```

## What the plugin's core gives

- **Outstanding under 📌:**
  - Waiting: The nightly build (`n1ght1y`)
- **The count line:** `📌 Outstanding: ⏳ 1`

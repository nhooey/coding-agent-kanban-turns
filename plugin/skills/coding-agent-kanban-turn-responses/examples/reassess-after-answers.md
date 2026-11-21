# reassess-after-answers

A draft the pane's Submit sent, its answers then a `reassess` line, runs `reassess`: the item it answers isn't asked again, and the rechecking turn's lists, the other item worked out afresh among them, replace every earlier item

## Turn 1, `2a4c6e80`

The prompt, from the user:

```text
Bump the lock and tag the release.
```

The final response:

```text
The lock bump is under way.

🚧 **Pending:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Bump the lock**  
   The build runs against the new libraries.

🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **Who signs the release tag**  
   🔘 A. **The release bot**: its SSH key.
      ➕ No prompt.
      ➖ A key to rotate.
   🔘 B. **You**: your SSH key.
      ➕ A person stands behind it.
      ➖ A 1Password prompt.
   ⠀
2. **The release's announcement**  
   🔘 A. **A pull request comment**: on the merged pull request.
      ➕ Where reviewers look.
      ➖ Few read it.
   🔘 B. **The README's top line**: a line of its own.
      ➕ Every reader sees it.
      ➖ It goes stale.
```

## Turn 2, `3b5d7f91`

The prompt, from the user, through the coding-agent-kanban-turns pane:

```text
coding-agent-kanban-turns:
2a4c6e80.Decide.1.A
reassess
```

This prompt runs `reassess`.

The final response:

```text
✅ **Done:**  
▔▔▔▔▔▔▔▔
1. **The release bot signs the tag**

🚧 **Pending:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Bump the lock**  
   The build is green on the new libraries.

🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **The release's announcement**  
   The README's top line is taken by the build badge since the lock bump.
   🔘 A. **A pull request comment**: on the merged pull request.
      ➕ Where reviewers look.
      ➖ Few read it.
   🔘 B. **A CHANGELOG entry**: a file of its own.
      ➕ The usual place.
      ➖ One more file.
```

## What the plugin's core gives

- **Outstanding under 📌:**
  - Pending: Bump the lock
  - Decide: The release's announcement
- **The count line:** `📌 Outstanding: 🚧 1 · 🧠 1`

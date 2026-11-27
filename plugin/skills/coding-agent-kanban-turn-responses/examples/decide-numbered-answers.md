# decide-numbered-answers

A line of numbered answers settles the turn before's items it numbers, and an agent's message giving answers settles nothing

## Turn 1, `3a7c9e21`

The prompt, from the user:

```text
Set up the release.
```

The final response:

```text
The release needs 3 choices first.

🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **The release's version number**  
   🔘 A. **2.4.0**: a minor release.
      ➕ It says the pane is new.
      ➖ Nothing.
   🔘 B. **2.3.1**: a patch release.
      ➕ A smaller notice.
      ➖ It hides the new pane.
   ⠀
2. **Who signs the release tag**  
   🔘 A. **The release bot**: its SSH key.
      ➕ No prompt.
      ➖ A key to rotate.
   🔘 B. **You**: your SSH key.
      ➕ A person stands behind it.
      ➖ A 1Password prompt.
   ⠀
3. **The release's announcement**  
   🔘 A. **A pull request comment**: on the merged pull request.
      ➕ Where reviewers look.
      ➖ Few read it.
   🔘 B. **The README's top line**: a line of its own.
      ➕ Every reader sees it.
      ➖ It goes stale.
```

## Turn 2, `4b8daf32`

The prompt, from the user:

```text
1. A / 3. B
```

The final response:

```text
✅ **Done:**  
▔▔▔▔▔▔▔▔
1. **The release's version, set to 2.4.0**
2. **The README's top line, announcing 2.4.0**

📌 Outstanding: 🧠 1
```

Sent while the turn ran, from a peer, an agent or another session:

```text
<agent-message from="a48bb9142825233bb">
2. A
</agent-message>
```

## What the plugin's core gives

- **Outstanding under 📌:**
  - Decide: Who signs the release tag
- **The count line:** `📌 Outstanding: 🧠 1`

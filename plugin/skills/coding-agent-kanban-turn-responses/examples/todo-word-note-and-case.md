# todo-word-note-and-case

A Todo settling word with a note after it, `done: <note>`, settles its item, as does a word written in capitals, `SKIP`; a note that only mentions a word, `skipping it for now`, settles nothing, so its item stays in the 📌 roll-up and the count line

## Turn 1, `9efb08a1`

The prompt, from the user:

```text
What's left for the release?
```

The final response:

```text
The release builds; 3 things are yours to do.

👉 **Todo:**  
▔▔▔▔▔▔▔▔
1. **Rotate the deploy token**  
   It expires on Friday.
   ⠀
2. **Announce the release in the channel**
3. **Check the staging dashboard**
```

## Turn 2, `b2c3d4e5`

The prompt, from the user:

```text
9efb08a1.Todo.1: done: rotated it this morning
Todo.2: SKIP
Todo.3: skipping it for now
```

The final response:

```text
Noted: the token is rotated and the announcement is off.

📌 Outstanding: 👉 1
```

## What the plugin's core gives

- **Outstanding under 📌:**
  - Todo: Check the staging dashboard
- **The count line:** `📌 Outstanding: 👉 1`

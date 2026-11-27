# todo-settling-words

Todo's settling words after an item's reference, `done` and `skip`, settle their items, and the 📌 roll-up and the count line drop them; a note alone settles nothing, so its item stays

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
9efb08a1.Todo.1: done
Todo.2: skip
Todo.3: the staging one first
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

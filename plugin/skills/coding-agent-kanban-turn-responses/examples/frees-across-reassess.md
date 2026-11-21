# frees-across-reassess

A `reassess` turn's lists replace every earlier item, so a `Frees:` line after it frees only the items of the `reassess` turn and later ones: a reference to an item it replaced frees nothing, and the item that took it in is named instead

## Turn 1, `e5f6a7b8`

The prompt, from the user:

```text
What does the fix wait on?
```

The final response:

```text
The fix waits on two things of yours.

👉 **Todo:**  
▔▔▔▔▔▔▔▔
1. **Rotate the `deploy-bot` key**
2. **Merge the retry fix**
```

## Turn 2, `f6a7b8c9`

The prompt, from the user:

```text
reassess
```

This prompt runs `reassess`.

The final response:

```text
The key is rotated; the fix is still yours to merge.

👉 **Todo:**  
▔▔▔▔▔▔▔▔
1. **Merge the retry fix**  
   Its checks pass on the rotated key.
   Frees: e5f6a7b8.Todo.1
```

## Turn 3, `a7b8c9d0`

The prompt, from the user:

```text
And the deploy?
```

The final response:

```text
The deploy goes out once the fix merges.

👉 **Todo:**  
▔▔▔▔▔▔▔▔
1. **Deploy the retry fix**  
   From the release session, with `prompts/deploy.md`.
   Frees: e5f6a7b8.Todo.2, f6a7b8c9.Todo.1
```

## What the plugin's core gives

- **Outstanding under 📌:**
  - Todo: Merge the retry fix
  - Todo: Deploy the retry fix
- **The count line:** `📌 Outstanding: 👉 2`
- **What frees `a7b8c9d0.Todo.1`:** `f6a7b8c9.Todo.1`

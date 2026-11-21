# frees-shared-prefix

Two turns whose ids share their first 6 characters: a reference by that prefix names the latest of them, at or before the item's own turn, that holds the item, so it names the later turn's Todo item and the earlier turn's Review item; and a Decide item whose reply writes no `Frees:` line frees what the plugin's buttons were given for it

## Turn 1, `abcdef01`

The prompt, from the user:

```text
Where does the loader stand?
```

The final response:

```text
The loader's rework is up for review.

🔍 **Review:**  
▔▔▔▔▔▔▔▔▔▔
1. **o/loader#8 The loader rework**

👉 **Todo:**  
▔▔▔▔▔▔▔▔
1. **Rotate the `loader-bot` key**
```

## Turn 2, `abcdef02`

The prompt, from the user:

```text
And after the review?
```

The final response:

```text
The release follows the review.

👉 **Todo:**  
▔▔▔▔▔▔▔▔
1. **Paste the release prompt**  
   It is in `prompts/release.md`.
   Frees: abcdef.Review.1

🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **Release tonight or in the morning?**  
   🔘 A. **Release tonight**: tag `v2.0` and publish.
      ➕ Users get the rework a day sooner.
      ➖ Nobody watches the rollout overnight.
   🔘 B. **Release at 9**: tag and publish in the morning.
      ➕ The rollout is watched.
      ➖ The rework waits a day.
```

## Turn 3, `1234abcd`

The prompt, from the user:

```text
Then?
```

The final response:

```text
One more step of yours.

👉 **Todo:**  
▔▔▔▔▔▔▔▔
1. **Announce the release**  
   On the project's discussion board.
   Frees: abcdef.Todo.1
```

## What the plugin's core gives

- **Outstanding under 📌:**
  - Review: o/loader#8 The loader rework
  - Todo: Rotate the `loader-bot` key
  - Todo: Paste the release prompt
  - Decide: Release tonight or in the morning?
  - Todo: Announce the release
- **The count line:** `📌 Outstanding: 🔍 1 · 👉 3 · 🧠 1`
- **What frees `abcdef02.Todo.1`:** `abcdef01.Review.1`
- **What frees `1234abcd.Todo.1`:** `abcdef02.Todo.1`

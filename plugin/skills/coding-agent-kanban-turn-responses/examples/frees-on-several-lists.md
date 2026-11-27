# frees-on-several-lists

Items of four lists, Pending, Authorizations, Todo and Decide, end on a `Frees:` line naming items of their own turn, a Decide item's under its last option, and a later turn's names an earlier turn's item by a prefix of its id: each item frees what its line names, by the turn's whole id, and the Decide item's line wins over the `frees` the plugin's buttons were given for it

## Turn 1, `a1b2c3d4`

The prompt, from the user:

```text
Where does the deploy stand?
```

The final response:

```text
The deploy waits on the token, a prompt and one choice.

🚧 **Pending:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Rework the deploy script's retries**  
   It retries 3 times, then gives up.
   Frees: a1b2c3d4.Review.1

⏳ **Waiting:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **The staging run (`b7c8d9e0f`)**

🔑 **Authorizations:**  
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
1. **1Password prompt for the `deploy-bot` token**  
   The prompt stays open for 10 minutes.
   Frees: a1b2c3d4.Waiting.1, a1b2c3d4.Todo.1

🔍 **Review:**  
▔▔▔▔▔▔▔▔▔▔
1. **o/deploy#21 The retry rework**

👉 **Todo:**  
▔▔▔▔▔▔▔▔
1. **Paste the deploy prompt into the release session**  
   It is in `prompts/deploy.md`.
   Frees: a1b2c3d4.Decide.1

🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **Deploy tonight or in the morning?**  
   🔘 A. **Deploy tonight**: tag `v3.1` and publish.
      ➕ Users get the retry fix a day sooner.
      ➖ Nobody watches the rollout overnight.
   🔘 B. **Deploy at 9**: tag and publish in the morning.
      ➕ The rollout is watched.
      ➖ The fix waits a day.
   Frees: a1b2c3d4.Review.1
```

## Turn 2, `b2c3d4e5`

The prompt, from the user:

```text
Go on with the rework.
```

The final response:

```text
The rework retries 5 times now.

👉 **Todo:**  
▔▔▔▔▔▔▔▔
1. **Restart the staging runner**  
   It is stuck on the old image.
   Frees: a1b2c3.Waiting.1
```

## What the plugin's core gives

- **Outstanding under 📌:**
  - Pending: Rework the deploy script's retries
  - Waiting: The staging run (`b7c8d9e0f`)
  - Authorizations: 1Password prompt for the `deploy-bot` token
  - Review: o/deploy#21 The retry rework
  - Todo: Paste the deploy prompt into the release session
  - Decide: Deploy tonight or in the morning?
  - Todo: Restart the staging runner
- **The count line:** `📌 Outstanding: 🚧 1 · ⏳ 1 · 🔑 1 · 🔍 1 · 👉 2 · 🧠 1`
- **What frees `a1b2c3d4.Pending.1`:** `a1b2c3d4.Review.1`
- **What frees `a1b2c3d4.Authorizations.1`:** `a1b2c3d4.Waiting.1`, `a1b2c3d4.Todo.1`
- **What frees `a1b2c3d4.Todo.1`:** `a1b2c3d4.Decide.1`
- **What frees `a1b2c3d4.Decide.1`:** `a1b2c3d4.Review.1`
- **What frees `b2c3d4e5.Todo.1`:** `a1b2c3d4.Waiting.1`

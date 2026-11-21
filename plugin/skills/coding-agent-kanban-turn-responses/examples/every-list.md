# every-list

A reply printing all 9 lists, then a full 📌 roll-up restating two of its items: the lists that roll up count once each, in the spec's order, and Done, Logged and Answers count never

## Turn 1, `1c2d3e4f`

The prompt, from the user:

```text
Where does the release stand?
```

The final response:

```text
The release branch builds; 6 things wait on it.

✅ **Done:**  
▔▔▔▔▔▔▔▔
1. **Tokenizer fix in commit `a1b2c3d`**
   ⠀
2. **Test suite rerun after the fix**  
   412 passed and 0 failed, in 3 minutes.
   ⠀

🚧 **Pending:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Rework the loader**  
   It reads the cache twice.

📝 **Logged:**  
▔▔▔▔▔▔▔▔▔▔
1. **The flaky watcher test, as entry 1502**

⏳ **Waiting:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **The test run (`b8a83gfv0`)**

❓ **Answers:**  
▔▔▔▔▔▔▔▔▔▔▔
1. **Why the build took 9 minutes**  
   The cache missed after the lock bump.

🔑 **Authorizations:**  
▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔
1. **1Password prompt for the merge token**  
   - #12 Fix the loader
   - #13 Bump the lock
   ⠀

🔍 **Review:**  
▔▔▔▔▔▔▔▔▔▔
1. **#14 The README**

👉 **Todo:**  
▔▔▔▔▔▔▔▔
1. **Rotate the `deploy-bot` key in the cloud console**  
   It was issued before the leak.

🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **Ship the release tonight?**  
   🔘 A. **Ship it**: it goes out.
      ➕ Users get it.
      ➖ Risk.
   🔘 B. **Hold it**: it waits.
      ➕ Safety.
      ➖ Delay.
```

## Turn 2, `2d3e4f50`

The prompt, from the user:

```text
Look at the pane's notes field meanwhile.
```

The final response:

```text
The notes field grows to 4 rows.

📌 **Outstanding from previous turns:**  
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚧 **Pending:**  
- **Rework the loader**, which reads the cache twice. 🔖 1c2d3e4f₋₁

⏳ **Waiting:**  
- **The test run (`b8a83gfv0`)** 🔖 1c2d3e4f₋₁

🔑 **Authorizations:**  
- **1Password prompt for the merge token**, for #12 and #13. 🔖 1c2d3e4f₋₁

🔍 **Review:**  
- **#14 The README** 🔖 1c2d3e4f₋₁

👉 **Todo:**  
- **Rotate the `deploy-bot` key in the cloud console** 🔖 1c2d3e4f₋₁

🧠 **Decide:**  
- **Ship the release tonight?** 🔖 1c2d3e4f₋₁
```

## What the plugin's core gives

- **Outstanding under 📌:**
  - Pending: Rework the loader
  - Waiting: The test run (`b8a83gfv0`)
  - Authorizations: 1Password prompt for the merge token
  - Review: #14 The README
  - Todo: Rotate the `deploy-bot` key in the cloud console
  - Decide: Ship the release tonight?
- **The count line:** `📌 Outstanding: 🚧 1 · ⏳ 1 · 🔑 1 · 🔍 1 · 👉 1 · 🧠 1`

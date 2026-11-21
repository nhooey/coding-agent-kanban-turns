# decide-answered-by-reference

Answers naming the turn by its id, or by a prefix of it, settle the Decide items they pick, and the item nobody answered stays open

## Turn 1, `9efb08a1`

The prompt, from the user:

```text
Pick the loader's cache, and what to clean up next.
```

The final response:

```text
The loader reads its cache twice, and the backlog has 3 cleanups ready.

🧠 **Decide:**  
▔▔▔▔▔▔▔▔▔▔
1. **Which cache to keep for the loader**  
   A note on the whole item.
   🔘 A. **Keep the disk cache**: it survives restarts.
      ➕ Faster cold starts.
      ➖ Disk use.
   🔘 B. **Keep the memory cache**: simpler.
      ➕ Less code.
      ➖ Slow cold starts.
   ⠀
2. **Backlog cleanups to start**  
   Any of 3.
   🔲 A. **Entry 1411, the matchers made one**: one function.
      ➕ One behaviour.
      ➖ Tokens.
   🔲 B. **Entries 0550 and 0455, dead code**: delete it.
      ➕ Cheap.
      ➖ Tidiness only.
   🔲 C. **Entry 0712, the stale fixtures**: regenerate them.
      ➕ The tests read today's shapes.
      ➖ A large diff.
   ⠀
3. **Ship the release tonight?**  
   🔘 A. **Ship it**: it goes out.
      ➕ Users get it.
      ➖ Risk.
   🔘 B. **Hold it**: it waits.
      ➕ Safety.
      ➖ Delay.
```

## Turn 2, `b2c3d4e5`

The prompt, from the user:

```text
9efb08a1.Decide.1.A
9efb08.Decide.2: A,C
```

The final response:

```text
✅ **Done:**  
▔▔▔▔▔▔▔▔
1. **The loader keeps only the disk cache**  
   The memory cache is gone, and cold starts read the disk.
   ⠀
2. **Entries 1411 and 0712, cleaned up**  
   The 4 matchers are one function, and the fixtures are regenerated.
   ⠀

📌 Outstanding: 🧠 1
```

## What the plugin's core gives

- **Outstanding under 📌:**
  - Decide: Ship the release tonight?
- **The count line:** `📌 Outstanding: 🧠 1`

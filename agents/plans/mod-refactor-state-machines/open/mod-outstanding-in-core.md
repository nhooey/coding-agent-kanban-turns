---
title: Running outstanding.py is an argv and a parse in the core around one effect
state: approved
kind: implementation
part-of: mod-refactor-state-machines
touches: [mod/hooks/register.tsx, mod/src/outstanding.ts, mod/test/outstanding.test.ts]
---

# Running outstanding.py is an argv and a parse in the core around one effect

- `src/outstanding.ts` holds `outstandingArgv(settings, home, sessionId)`, `foundFrom({ exitCode, stdout, stderr })` and the problem join now in `found` (`register.tsx:143-193`). `register.tsx` keeps only `$.fs.exists` and `$.process.run`.
- The file takes the name `kanban-mod-reads-transcript` plans, so that node swaps the effect for `$.session.messages()` without moving the parse again.

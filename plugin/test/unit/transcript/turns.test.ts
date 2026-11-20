// What the core reads from a turn's texts: a reply's sections, the command a
// prompt runs and where the latest `reassess` starts, on neutral turns; the
// kanban skill's command tests; and a file read in ranges.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  chunkOffsets,
  commandNamed,
  commandOf,
  isOwn,
  isReassessLine,
  isReassessTurn,
  isTopicRule,
  reassessStart,
  reassessStarts,
  sectionsOf,
  textOfChunks,
  wholeEnd,
  withoutDraftHeader,
} from "../../../src/transcript/turns.ts";
import type { Owner } from "../../../types/index.d.ts";
import { turnOf } from "../../fixtures/turns.ts";

/** The user's turns, one a prompt, each its place as its id. */
const prompted = (...prompts: readonly string[]) =>
  prompts.map((prompt, n) => turnOf(String(n + 1).padStart(8, "0"), prompt));

describe("the user's own text", () => {
  test("is a prompt the user typed, or one this plugin submitted for the user, such as its Submit or Reassess", () => {
    expect(isOwn("user")).toBe(true);
    expect(isOwn("this-plugin")).toBe(true);
  });

  test("is no peer's message, task notification, other plugin's prompt or scheduled prompt", () => {
    for (const owner of ["peer", "notification", "other-plugin", "scheduled"] as const satisfies readonly Owner[]) {
      expect(isOwn(owner)).toBe(false);
    }
  });
});

describe("the line naming the plugin", () => {
  test("is taken off the start of a draft, with or without a marketplace", () => {
    expect(withoutDraftHeader("coding-agent-kanban-turns@nix-pinned:\n9efb08a1.Decide.1.A\n")).toBe(
      "9efb08a1.Decide.1.A\n",
    );
    expect(withoutDraftHeader("coding-agent-kanban-turns:\n1. A")).toBe("1. A");
  });

  test("is matched exactly: another plugin's, one with more on its line, or one further down stays", () => {
    for (const text of [
      "other-plugin@x:\n1. A",
      "coding-agent-kanban-turns@x: and more\n1. A",
      "coding-agent-kanban-turnsX:\n1. A",
      "coding-agent-kanban-turns: 1. A",
      "other-mod@market:\n1. A",
      "1. A\ncoding-agent-kanban-turns:\n2. B",
      "go\ncoding-agent-kanban-turns:\n1. A",
    ]) {
      expect(withoutDraftHeader(text)).toBe(text);
    }
  });
});

describe("a file read in ranges", () => {
  test("is read in ranges that cover it", () => {
    expect(chunkOffsets(0, 4)).toEqual([]);
    expect(chunkOffsets(4, 4)).toEqual([0]);
    expect(chunkOffsets(9, 4)).toEqual([0, 4, 8]);
  });

  test("ranges that cut a character join whole, wherever they cut", () => {
    const text = "aé€🧠x€é🧠";
    const bytes = new TextEncoder().encode(text);
    const base64 = (part: Uint8Array) => btoa(String.fromCharCode(...part));
    const cuts = Array.from({ length: bytes.length + 1 }, (_, n) => n);
    for (const first of cuts) {
      for (const second of cuts.filter((n) => n >= first)) {
        const ranges = [bytes.slice(0, first), bytes.slice(first, second), bytes.slice(second)];
        expect(textOfChunks(ranges.map(base64))).toBe(text);
      }
    }
    for (const size of [1, 2, 3]) {
      const ranges = chunkOffsets(bytes.length, size).map((n) => base64(bytes.slice(n, n + size)));
      expect(textOfChunks(ranges)).toBe(text);
    }
    expect(textOfChunks([])).toBe("");
  });

  test("a file cut inside its last character ends in a replacement character", () => {
    const bytes = new TextEncoder().encode("ok🧠");
    expect(textOfChunks([btoa(String.fromCharCode(...bytes.slice(0, 4)))])).toBe("ok�");
  });

  test("the whole characters end before one the end cuts", () => {
    const bytes = new TextEncoder().encode("x🧠");
    expect([1, 2, 3, 4, 5].map((n) => wholeEnd(bytes.slice(0, n)))).toEqual([1, 1, 1, 1, 5]);
    expect(wholeEnd(new TextEncoder().encode("é€"))).toBe(5);
    expect(wholeEnd(new Uint8Array())).toBe(0);
  });

  test("a large file decodes in time linear in it", () => {
    const text = `${"é🧠x".repeat(1_000_000)}\n`;
    const bytes = new TextEncoder().encode(text);
    const size = 1024 * 1024 + 1;
    const ranges = chunkOffsets(bytes.length, size).map((n) => Buffer.from(bytes.subarray(n, n + size)).toString("base64"));
    const started = performance.now();
    expect(textOfChunks(ranges)).toBe(text);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

// A header or a summary alone on its line ends in a hard line break, two spaces.
const BR = "  ";
const REPLY = `Opening prose, in no section.

✅ **Done:**${BR}
▔▔▔▔▔▔▔▔
1. **Fixed the loader**

📋 **To review:**${BR}
- **The pull request**

🧠 **Decisions:**${BR}
1. **Which cache**

Still open from earlier
🧠 **Decide:**${BR}
- **An old one**
`;

describe("sectionsOf", () => {
  test("each header opens a section and the stop line closes one", () => {
    expect(sectionsOf(REPLY)).toEqual([
      { name: "Done", text: "✅ **Done:**  \n▔▔▔▔▔▔▔▔\n1. **Fixed the loader**" },
      { name: "To review", text: "📋 **To review:**  \n- **The pull request**" },
      { name: "Decisions", text: "🧠 **Decisions:**  \n1. **Which cache**" },
      { name: "Decide", text: "🧠 **Decide:**  \n- **An old one**" },
    ]);
  });

  test("a topic header closes the section above it", () => {
    const text =
      "**First topic**  \n═══════════\n🧠 **Decide:**  \n▔▔▔▔▔▔▔▔▔▔\n1. **Merge order**\n\n" +
      "**Second topic**  \n════════════\n🧠 **Decide:**  \n▔▔▔▔▔▔▔▔▔▔\n2. **Retention**\n";
    expect(sectionsOf(text)).toEqual([
      { name: "Decide", text: "🧠 **Decide:**  \n▔▔▔▔▔▔▔▔▔▔\n1. **Merge order**" },
      { name: "Decide", text: "🧠 **Decide:**  \n▔▔▔▔▔▔▔▔▔▔\n2. **Retention**" },
    ]);
  });

  test("a header is matched by name, not glyph", () => {
    expect(sectionsOf("🙃 **Todo:**  \n1. **x**")[0]?.name).toBe("Todo");
    expect(sectionsOf("🙃 **Nothing:**  \n1. **x**")).toEqual([]);
  });

  test("the Authorizations list is a section", () => {
    const text =
      "🔍 **Review:**  \n▔▔▔▔▔▔▔▔▔▔\n1. **#14 The README**\n\n" +
      "🔑 **Authorizations:**  \n▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔\n1. **SSH signing prompt for the push**\n";
    expect(sectionsOf(text).map((s) => s.name)).toEqual([
      "Review",
      "Authorizations",
    ]);
  });

  test("a topic rule is a line of ═ alone", () => {
    expect(isTopicRule("  ═══  ")).toBe(true);
    expect(isTopicRule("══ x")).toBe(false);
    expect(isTopicRule("   ")).toBe(false);
  });
});

describe("commandOf", () => {
  test("each name", () => {
    for (const name of ["reassess", "recheck", "regenerate", "recalculate"]) {
      expect(commandOf(name)).toBe("reassess");
    }
    for (const name of ["open", "pending", "restate"]) {
      expect(commandOf(name)).toBe("open");
    }
  });

  test("a prefix no other command shares", () => {
    for (const [prefix, command] of [
      ["rea", "reassess"],
      ["rec", "reassess"],
      ["regen", "reassess"],
      ["recalc", "reassess"],
      ["reass", "reassess"],
      ["res", "open"],
      ["rest", "open"],
      ["pend", "open"],
      ["o", "open"],
    ] as const) {
      expect(commandOf(prefix)).toBe(command);
    }
  });

  test("a prefix shared with another command names none", () => {
    for (const prefix of ["r", "re", "RE"]) {
      expect(commandOf(prefix)).toBeUndefined();
    }
    expect(commandNamed("")).toBeUndefined();
  });

  test("a word that is no prefix names none", () => {
    for (const text of ["recall the plan", "reading list", "go", "", "opener", "regen2"]) {
      expect(commandOf(text)).toBeUndefined();
    }
  });

  test("the first word decides, case and trailing punctuation aside", () => {
    expect(commandOf("  Reassess, then stop")).toBe("reassess");
    expect(commandOf("restate.")).toBe("open");
  });

  test("the slash command typed", () => {
    expect(commandOf("/coding-agent-kanban-turn-responses regen")).toBe("reassess");
    expect(commandOf("/coding-agent-kanban-turn-responses restate")).toBe("open");
    expect(commandOf("/coding-agent-kanban-turn-responses re")).toBeUndefined();
    expect(commandOf("/other-skill reassess")).toBeUndefined();
  });

  test("the command-name form", () => {
    const sent = (name: string, args: string) =>
      `<command-message>${name}</command-message>\n<command-name>/${name}</command-name>\n<command-args>${args}</command-args>`;
    expect(commandOf(sent("coding-agent-kanban-turn-responses", "recalc"))).toBe("reassess");
    expect(commandOf(sent("coding-agent-kanban-turn-responses", "pending"))).toBe("open");
    expect(commandOf(sent("coding-agent-kanban-turn-responses", "re"))).toBeUndefined();
    expect(commandOf(sent("other-skill", "reassess"))).toBeUndefined();
  });
});

describe("reassessStarts", () => {
  test("gives each turn the latest reassess turn at or before it, else the first", () => {
    expect(reassessStarts(prompted("go", "recheck", "more", "regen", "open"))).toEqual([0, 1, 1, 3, 3]);
    expect(reassessStarts(prompted("go", "open"))).toEqual([0, 0]);
    expect(reassessStarts([])).toEqual([]);
  });

  test("ends on what reassessStart gives for all the turns", () => {
    const turns = prompted("go", "recheck", "more");
    expect(reassessStarts(turns).at(-1)).toBe(reassessStart(turns));
  });
});

describe("isReassessTurn", () => {
  test("is a turn whose prompt, the user's own, runs reassess", () => {
    expect(isReassessTurn(turnOf("00000001", "recheck"))).toBe(true);
    expect(isReassessTurn(turnOf("00000001", "recheck", { owner: "peer" }))).toBe(false);
    expect(isReassessTurn(turnOf("00000001", "open"))).toBe(false);
  });
});

describe("reassessStart", () => {
  test("is the latest reassess turn, else the first", () => {
    expect(reassessStart(prompted("go", "recheck", "more", "regen", "open"))).toBe(3);
    expect(reassessStart(prompted("go", "open"))).toBe(0);
  });

  test("is a turn whose prompt ends on a reassess line, with or without answers", () => {
    for (const prompt of ["coding-agent-kanban-turns:\n9efb08a1.Decide.1.A\nreassess\n\n", "Look at the build again.\nreassess"]) {
      expect(reassessStart(prompted("go", prompt))).toBe(1);
    }
  });

  test("is a turn this plugin's prompt opened, as its Reassess does", () => {
    expect(reassessStart([turnOf("00000001", "go"), turnOf("00000002", "reassess", { owner: "this-plugin" })])).toBe(1);
  });
});

describe("a command on the last line", () => {
  test("a prompt whose last non-blank line names reassess alone reassesses, after any answers", () => {
    for (const prompt of [
      "1. A / 3. Y\nreassess",
      "9efb08a1.Decide.1.A\nRecalc!\n",
      "9efb08a1.Decide.1.A\n9efb08a1.Decide.2: not yet\n  regen  \n\n",
      "Look at the build again.\nreassess",
      "go\nreassess",
      "The agent reported.\n\nrecheck.\n",
    ]) {
      expect(commandOf(prompt)).toBe("reassess");
    }
  });

  test("a trailing reassess with more on its line, or a question, runs nothing", () => {
    for (const prompt of [
      "9efb08a1.Decide.1.A\nplease reassess",
      "9efb08a1.Decide.1.A\nreassess?",
      "9efb08a1.Decide.1.A\nre",
    ]) {
      expect(commandOf(prompt)).toBeUndefined();
    }
  });

  test("only reassess runs from the last line: a trailing open runs nothing", () => {
    for (const name of ["open", "restate", "pending"]) {
      expect(commandOf(`9efb08a1.Decide.1.A\n${name}`)).toBeUndefined();
      expect(commandOf(`Look at the build again.\n${name}`)).toBeUndefined();
    }
  });

  test("the opening word wins over the last line", () => {
    expect(commandOf("restate\n1. A\nreassess")).toBe("open");
  });

  test("the line naming the plugin is left out before the prompt is read for a command", () => {
    for (const header of ["coding-agent-kanban-turns@nix-pinned:", "coding-agent-kanban-turns:"]) {
      expect(commandOf(`${header}\nreassess`)).toBe("reassess");
      expect(commandOf(`${header}\nrestate`)).toBe("open");
      expect(commandOf(`${header}\n2. B\nreassess\n`)).toBe("reassess");
      expect(commandOf(`${header}\n2. B`)).toBeUndefined();
    }
    // Another plugin's header line stays: it is the first word, which names
    // nothing, so `restate` after it runs nothing either.
    expect(commandOf("other-mod@market:\nrestate")).toBeUndefined();
  });

  test("a turn that isn't the user's own, though it ends on reassess, reassesses nothing", () => {
    for (const owner of ["other-plugin", "peer", "notification", "scheduled"] as const satisfies readonly Owner[]) {
      expect(reassessStart([turnOf("00000001", "go"), turnOf("00000002", "1. A\nreassess", { owner })])).toBe(0);
    }
  });

  test("a line is a reassess line when it is only a name of reassess or a prefix no other command shares", () => {
    expect(isReassessLine(" reass ")).toBe(true);
    expect(isReassessLine("RECHECK.")).toBe(true);
    expect(isReassessLine("res")).toBe(false);
    expect(isReassessLine("")).toBe(false);
  });
});

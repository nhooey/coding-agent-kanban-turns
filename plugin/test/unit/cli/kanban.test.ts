// cli/kanban.ts, the CLI's edge, run as a process under Node: it reads the
// arguments, the settings files, the transcript or stdin and the draft, and
// writes what cli/run.ts gives, with its exit code.

import { describe, test } from "node:test";
import { expect } from "expect";
import { mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { APP, USER_FILE } from "../../../src/config/config.ts";
import {
  CLI_ENV,
  ROUTES,
  cliFailures,
  draftFailures,
  goldenCases,
  pluginFile,
  processRunner,
  scratch,
} from "../../fixtures/cli.ts";
import { jsonl, recordsOfTurns } from "../../fixtures/records.ts";
import type { Turn } from "../../../types/index.d.ts";

const CLI = fileURLToPath(pluginFile("cli/kanban.ts"));
const run = processRunner([process.execPath, CLI]);

const turn = (id: string, replies: readonly string[]): Turn => ({
  id,
  prompt: { owner: "user", text: "Go on.", reportNames: undefined },
  replies,
  decide: [],
  messages: [],
});

const PENDING = (n: number) => `🚧 **Pending:**  \n▔▔▔▔▔▔▔▔▔▔▔\n1. **Item ${n}**\n`;

describe("cli/kanban.ts", () => {
  const found = goldenCases().find(({ name }) => name === "decide-answered-by-reference.yaml");

  for (const route of ROUTES) {
    test(`gives a golden case what it expects, through ${route.name}`, () => {
      expect(found).toBeDefined();
      expect(found === undefined ? [] : cliFailures(found.golden, run, route)).toEqual([]);
    });
  }

  test("gives each reply of a golden case, as a draft on stdin, the findings it expects", () => {
    const linted = goldenCases().find(({ name }) => name === "lint-layout-findings.yaml");

    expect(linted).toBeDefined();
    expect(linted === undefined ? [] : draftFailures(linted.golden, run)).toEqual([]);
  });

  test("prints its usage for --help, and exits 0", () => {
    const result = run(["--help"], { stdin: "" });

    expect(result.code).toBe(0);
    expect(result.out).toContain("Usage: kanban <command>");
  });

  test("refuses arguments it can't read with its usage, and exits 2", () => {
    const result = run(["bogus"], { stdin: "" });

    expect(result).toMatchObject({ out: "", code: 2 });
    expect(result.err).toContain('kanban: no command "bogus"');
    expect(result.err).toContain("Usage: kanban <command>");
  });

  test("refuses a transcript it can't read, and exits 2", () => {
    const ran = spawnSync(process.execPath, [CLI, "count", "--transcript", join(scratch(), "none.jsonl")], {
      encoding: "utf8",
      env: CLI_ENV,
    });

    expect(ran.status).toBe(2);
    expect(ran.stderr).toContain("ENOENT");
  });

  test("lints a draft piped in, for --draft -", () => {
    const result = run(["lint", "--draft", "-"], { stdin: "✅ **Done:**  \n▔▔▔▔▔▔▔▔\n1. **A**\n   b\n" });

    expect(result.code).toBe(1);
    expect(result.out).toContain("[no-hard-break]");
  });

  test("reads the user's own settings over the defaults", () => {
    const home = scratch();
    const turns = JSON.stringify(
      Array.from({ length: 5 }, (_, n) => turn(`${n}`.padStart(8, "a"), [PENDING(n)])),
    );

    mkdirSync(join(home, APP));
    writeFileSync(join(home, APP, USER_FILE), "counts:\n  turns: 2\n");
    const ran = spawnSync(process.execPath, [CLI, "count"], {
      input: turns,
      encoding: "utf8",
      env: { ...CLI_ENV, XDG_CONFIG_HOME: home },
    });

    expect(ran.stdout).toBe("📌 Outstanding: 🚧 2\n");
  });

  test("warns of a user file that's there but can't be read, naming it, and uses the defaults", () => {
    const home = scratch();
    const path = join(home, APP, USER_FILE);

    // A folder where the file goes: there, but no file to read.
    mkdirSync(path, { recursive: true });
    const ran = spawnSync(process.execPath, [CLI, "count"], {
      input: "[]",
      encoding: "utf8",
      env: { ...CLI_ENV, XDG_CONFIG_HOME: home },
    });

    expect(ran.status).toBe(0);
    expect(ran.stderr).toContain(`kanban: ${path}: `);
    expect(ran.stderr).toContain("EISDIR");
  });

  describe("in a Claude Code session, named by CLAUDE_CODE_SESSION_ID", () => {
    const home = scratch();
    const project = join(home, ".claude", "projects", "-elsewhere");
    const session = (args: readonly string[], input = "") =>
      spawnSync(process.execPath, [CLI, ...args], {
        input,
        encoding: "utf8",
        cwd: scratch(),
        env: { ...CLI_ENV, HOME: home, XDG_CONFIG_HOME: scratch(), CLAUDE_CODE_SESSION_ID: "s-1" },
      });

    mkdirSync(project, { recursive: true });
    writeFileSync(join(project, "s-1.jsonl"), jsonl(recordsOfTurns([turn("aaaaaaa1", [PENDING(1)])])));

    test("reads the session's transcript with no --transcript, from the one project folder that holds it", () => {
      expect(session(["count"]).stdout).toBe("📌 Outstanding: 🚧 1\n");
    });

    test("reads stdin's turns for --stdin", () => {
      expect(session(["count", "--stdin"], "[]")).toMatchObject({ stdout: "", status: 0 });
    });

    test("tells when the full roll-up is due", () => {
      expect(session(["due"])).toMatchObject({ stdout: "full\n", status: 0 });
    });

    test("finds the transcript under CLAUDE_CONFIG_DIR where it's set, in place of the home's .claude", () => {
      const config = scratch();
      const elsewhere = join(config, "projects", "-other");
      const ran = (env: NodeJS.ProcessEnv) =>
        spawnSync(process.execPath, [CLI, "count"], {
          input: "",
          encoding: "utf8",
          cwd: scratch(),
          env: { ...CLI_ENV, HOME: home, XDG_CONFIG_HOME: scratch(), CLAUDE_CODE_SESSION_ID: "s-2", ...env },
        });

      mkdirSync(elsewhere, { recursive: true });
      writeFileSync(
        join(elsewhere, "s-2.jsonl"),
        jsonl(recordsOfTurns([turn("aaaaaaa1", [PENDING(1)]), turn("aaaaaaa2", [PENDING(2)])])),
      );

      expect(ran({ CLAUDE_CONFIG_DIR: config }).stdout).toBe("📌 Outstanding: 🚧 2\n");
      expect(ran({}).status).toBe(2);
    });
  });
});

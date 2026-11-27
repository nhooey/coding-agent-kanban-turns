#!/usr/bin/env node
// The kanban CLI's edge, the one file of it with effects: it reads the
// arguments, the Claude Code session CLAUDE_CODE_SESSION_ID names, the
// clock, the settings files, the transcript or stdin, and the draft, hands
// them to cli/run.ts, and writes out what comes back. With no --transcript
// in a session, the session's own transcript is found in Claude Code's
// projects folder, under CLAUDE_CONFIG_DIR or the home's .claude, where
// the adapter's sessionTranscriptPath says. The
// flake bundles it with the core into kanban.js, one file that runs under
// Node 20 or later.
//
// The plugin's defaults file is read from beside the plugin's folder when
// this runs from the repository; the bundle has it inlined, as
// BUNDLED_DEFAULTS, since kanban.js runs with no plugin
// folder beside them. The user's own config.yaml is read from where the
// plugin reads it; one that's there but can't be read is a warning naming
// it, and the defaults are used.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import process from "node:process";

import { DEFAULTS_FILE, loaded, userConfigPath } from "../src/config/config.ts";
import type { DefaultsFile } from "../src/config/config.ts";
import {
  projectsFolder,
  sessionTranscriptPath,
  transcriptFile,
} from "../src/transcript/claude-code.ts";
import type { Loaded } from "../types/index.d.ts";
import { SESSION_VARIABLE, answer, refused, requestOf, usageRefusal } from "./run.ts";
import type { Inputs, Request, Result, Source } from "./run.ts";

// The defaults file's text, which the bundle's build defines; none when
// this runs from the repository.
declare const BUNDLED_DEFAULTS: string | undefined;

/** A file's text, or why it can't be read. */
const textAt = (
  path: string | number | URL,
): Readonly<{ text: string } | { problem: string }> => {
  try {
    return { text: readFileSync(path, "utf8") };
  } catch (error) {
    return { problem: error instanceof Error ? error.message : String(error) };
  }
};

/** The defaults file: inlined in the bundle, else beside this folder. */
const defaultsFile = (): DefaultsFile => {
  const path = new URL(`../${DEFAULTS_FILE}`, import.meta.url);
  const read =
    typeof BUNDLED_DEFAULTS === "string" ? { text: BUNDLED_DEFAULTS } : textAt(path);

  return { path: DEFAULTS_FILE, text: "text" in read ? read.text : undefined };
};

/** The settings in effect: the defaults with the user's own file merged over them, a user file that can't be read a warning naming it. */
const settings = (): Loaded => {
  const path = userConfigPath({
    xdgConfigHome: process.env.XDG_CONFIG_HOME,
    home: process.env.HOME,
  });
  const read = path !== undefined && existsSync(path) ? textAt(path) : undefined;
  const user = path !== undefined && read !== undefined && "text" in read
    ? { path, text: read.text }
    : undefined;
  const settled = loaded(defaultsFile(), user);

  return read !== undefined && "problem" in read
    ? { ...settled, problems: [...settled.problems, `${path}: ${read.problem}`] }
    : settled;
};

/** Stdin's file descriptor, read for the turns without a --transcript, and for a `--draft -`. */
const STDIN = 0;

/** The project folders in the projects folder that hold a session's transcript; none where the folder can't be read. */
const holding = (projects: string, session: string): readonly string[] => {
  try {
    return readdirSync(projects).filter((project) =>
      existsSync(`${projects}/${project}/${transcriptFile(session)}`),
    );
  } catch {
    return [];
  }
};

/** Where a source's turns are read from: stdin, a transcript's path, or the session's own transcript, found in Claude Code's projects folder. */
const placeOf = (source: Source): string | number => {
  const projects = projectsFolder(process.env.HOME ?? "", process.env.CLAUDE_CONFIG_DIR);

  return source.from === "stdin"
    ? STDIN
    : source.from === "transcript"
      ? source.path
      : sessionTranscriptPath(projects, process.cwd(), source.session, holding(projects, source.session));
};

/** What the edge reads for a request, or why it can't. */
const inputsFor = (
  request: Request,
): Readonly<{ inputs: Inputs } | { problems: readonly string[] }> => {
  const now = Date.now();

  if (request.help) {
    return { inputs: { turns: undefined, draft: undefined, settings: settings(), now } };
  }
  const source = request.source;
  const turns = source === undefined ? undefined : textAt(placeOf(source));
  const draft =
    request.draft === undefined || source !== undefined
      ? undefined
      : textAt(request.draft === "-" ? STDIN : request.draft);
  const problems = [turns, draft].flatMap((read) =>
    read !== undefined && "problem" in read ? [read.problem] : [],
  );

  return problems.length > 0
    ? { problems }
    : {
        inputs: {
          turns: turns !== undefined && "text" in turns ? turns.text : undefined,
          draft: draft !== undefined && "text" in draft ? draft.text : undefined,
          settings: settings(),
          now,
        },
      };
};

/** What the CLI gives for its arguments. */
const run = (argv: readonly string[]): Result => {
  const request = requestOf(argv, process.env[SESSION_VARIABLE]);
  const read = "value" in request ? inputsFor(request.value) : undefined;

  return "problems" in request
    ? usageRefusal(request.problems)
    : read === undefined || "problems" in read
      ? refused(read?.problems ?? [])
      : answer(request.value, read.inputs);
};

const result = run(process.argv.slice(2));

process.stdout.write(result.out);
process.stderr.write(result.err);
process.exitCode = result.code;

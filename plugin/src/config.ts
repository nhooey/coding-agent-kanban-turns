// The plugin's settings: the shipped defaults file, defaults/config.yaml, with
// the user's own file merged over it. Pure: hooks/settings.ts reads the two
// files and hands their text here.
//
// The defaults file holds every value; this module holds only the shape
// those values must have, so a default is written in one place. Sections
// merge key by key, a scalar or a list replaces, and a key the shape
// doesn't name, or a value of the wrong type, refuses the user's file whole.
// A section the plugin no longer reads is the exception: it is left out with a
// warning, and the rest of the file is used.
//
// The files are YAML, read by the `yaml` package; a user's config.jsonc,
// read only while there's no config.yaml beside it, by `jsonc-parser`. The
// engine loads only the plugin's own files, so the flake bundles each
// library into vendor/ as one ES module, which the dev shell lays there too.

import { parseAllDocuments } from "../vendor/yaml.js";
import {
  parse as parseJsoncText,
  printParseErrorCode,
} from "../vendor/jsonc-parser.js";
import type { ParseError } from "../vendor/jsonc-parser.js";
import type { Json, Loaded, Settings } from "../types/index.d.ts";

/**
 * The type each setting must have: a section is a map of its keys, and a
 * `key` is a string the engine takes as a Button's hotkey.
 */
type Shape =
  | "string"
  | "number"
  | "boolean"
  | "key"
  | { readonly [key: string]: Shape };

/** What the engine takes as a Button's hotkey: one lowercase letter or one digit; it refuses the whole drawing over anything else. */
const HOTKEY = /^[a-z0-9]$/;

/** Every setting the plugin reads, by the type its value must have. */
export const SETTINGS_SHAPE: Shape = {
  counts: { turns: "number", "gh-timeout-ms": "number" },
  keys: {
    dismiss: "key",
    next: "key",
    previous: "key",
    submit: "key",
    reassess: "key",
    help: "key",
  },
  notes: { rows: "number" },
  marks: { sent: "string" },
  colors: {
    border: "string",
    "title-label": "string",
    "title-background": "string",
    code: "string",
    hover: "string",
    settled: "string",
    close: "string",
    kanban: "string",
  },
};

/** The sections and settings the plugin no longer reads, by dotted key, each with what to set instead. */
export const RETIRED: Readonly<Record<string, string>> = {
  outstanding:
    "the plugin reads the transcript itself; counts.turns sets how many turns the count line reads",
  "colors.title":
    "an item's title is now a label on a background, then the summary in plain text; colors.title-label and colors.title-background colour the label",
  "colors.expand":
    "the ↗ beside the count line is gone; colors.kanban colours the 🖥️ Kanban button that opens the pane",
  "colors.close-x":
    "the ✖ is drawn in colors.close, on no background, as every button is",
  pane: "the pane draws no hint row; its ? Keys button, or keys.help, opens a panel listing every key",
};

/** The value at a dotted key's path, or undefined where there is none. */
const at = (value: Json | undefined, path: readonly string[]): Json | undefined =>
  path.reduce<Json | undefined>(
    (inner, key) => (isMap(inner) ? inner[key] : undefined),
    value,
  );

/** The value without the setting at `path`, every section above it kept. */
const without = (value: Json, path: readonly string[]): Json => {
  const [key = "", ...rest] = path;

  return !isMap(value) || !(key in value)
    ? value
    : Object.fromEntries(
        Object.entries(value).flatMap(([name, inner]): [string, Json][] =>
          name !== key
            ? [[name, inner]]
            : rest.length === 0
              ? []
              : [[name, without(inner, rest)]],
        ),
      );
};

/** The file's value without the sections and settings the plugin no longer reads. */
export const withoutRetired = (value: Json): Json =>
  Object.keys(RETIRED).reduce(
    (kept, key) => without(kept, key.split(".")),
    value,
  );

/** A warning for each section or setting the plugin no longer reads that the file still holds. */
export const retiredIn = (value: Json): readonly string[] =>
  Object.entries(RETIRED)
    .filter(([key]) => at(value, key.split(".")) !== undefined)
    .map(([key, instead]) => `${key} is no longer read and is left out: ${instead}`);

/** The folder under $XDG_CONFIG_HOME, or ~/.config, the user's file sits in. */
export const APP = "coding-agent-kanban-turns";

/** The defaults file, from the plugin's own folder. */
export const DEFAULTS_FILE = "defaults/config.yaml";

/** The user's file's names, in the order they're looked for: the first there is read. */
export const USER_FILES = ["config.yaml", "config.jsonc"] as const;

/** A file's value, or why it can't be read. */
type Parsed = Readonly<{ value: Json } | { error: string }>;

/**
 * How a YAML file is read: one document, under YAML 1.2's core schema alone,
 * so `on` and `yes` are strings; a key written twice, a tag the schema
 * doesn't hold, or a `<<` merge refuses it. No warning goes to a console.
 */
const YAML_OPTIONS = {
  version: "1.2",
  schema: "core",
  strict: true,
  uniqueKeys: true,
  merge: false,
  stringKeys: true,
  resolveKnownTags: false,
  prettyErrors: true,
  logLevel: "silent",
} as const;

/** An error's first line, where `prettyErrors` puts its position, without the colon before the excerpt. */
const headline = (message: string): string => {
  const [first = message] = message.split("\n");

  return first.endsWith(":") ? first.slice(0, -1) : first;
};

/** A YAML file's value, an empty file's an empty section, or why it can't be read. */
export const parseYaml = (yaml: string): Parsed => {
  const documents = parseAllDocuments(yaml, YAML_OPTIONS);
  const [document] = documents;
  const errors = documents
    .flatMap((parsed) => [...parsed.errors, ...parsed.warnings])
    .map((error) => headline(error.message));

  try {
    return documents.length > 1
      ? { error: `holds ${documents.length} YAML documents, not one` }
      : errors.length > 0
        ? { error: errors.join("; ") }
        : { value: (document?.toJS() as Json | undefined) ?? {} };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

/** A JSONC file's value, comments and trailing commas allowed, or why it can't be read. */
export const parseJsonc = (jsonc: string): Parsed => {
  // jsonc-parser reports what it couldn't read into the list it's handed.
  const errors: ParseError[] = [];
  const value = parseJsoncText(jsonc, errors, {
    allowTrailingComma: true,
  }) as Json | undefined;

  return errors.length === 0 && value !== undefined
    ? { value }
    : {
        error: errors
          .map(
            (error) =>
              `${printParseErrorCode(error.error)} at offset ${error.offset}`,
          )
          .join("; "),
      };
};

/** Whether the file is the user's old config.jsonc. */
const isJsonc = (file: ConfigFile): boolean => file.path.endsWith(".jsonc");

/** The warning a user's config.jsonc is read with. */
const JSONC_WARNING =
  "JSONC is read only while there's no config.yaml beside it; convert this file to config.yaml";

const isMap = (value: Json | undefined): value is { readonly [key: string]: Json } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const named = (path: readonly string[]): string => path.join(".") || "the file";

const typeName = (value: Json): string =>
  value === null ? "null" : Array.isArray(value) ? "a list" : typeof value;

/**
 * What's wrong with `value` against `shape`: a key the shape doesn't name, a
 * value of the wrong type, and, unless `isSparse`, a key it leaves out.
 */
export const problemsIn = (
  shape: Shape,
  value: Json,
  isSparse: boolean,
  path: readonly string[] = [],
): readonly string[] =>
  shape === "key"
    ? typeof value === "string" && HOTKEY.test(value)
      ? []
      : [
          `${named(path)} is ${typeof value === "string" ? JSON.stringify(value) : typeName(value)}, not one lowercase letter or digit, as the pane's keys must be`,
        ]
    : typeof shape === "string"
    ? typeof value === shape && !Array.isArray(value)
      ? []
      : [`${named(path)} is ${typeName(value)}, not a ${shape}`]
    : !isMap(value)
      ? [`${named(path)} is ${typeName(value)}, not a section`]
      : [
          ...Object.keys(value)
            .filter((key) => !(key in shape))
            .map(
              (key) =>
                `${named([...path, key])} is no setting; the keys here are ${Object.keys(shape).join(", ")}`,
            ),
          ...Object.entries(shape).flatMap(([key, inner]) =>
            value[key] === undefined
              ? isSparse
                ? []
                : [`${named([...path, key])} is missing`]
              : problemsIn(inner, value[key], isSparse, [...path, key]),
          ),
        ];

/** `layer` over `base`: maps merge key by key, anything else replaces. */
export const mergedOver = (base: Json, layer: Json): Json =>
  isMap(base) && isMap(layer)
    ? Object.fromEntries([
        ...Object.entries(base).map(
          ([key, value]): [string, Json] => [
            key,
            layer[key] === undefined ? value : mergedOver(value, layer[key]),
          ],
        ),
        ...Object.entries(layer).filter(([key]) => !(key in base)),
      ])
    : layer;

/** Every setting in `value` by its dotted key, sections walked in order. */
export const leaves = (
  value: Json,
  path: readonly string[] = [],
): readonly (readonly [string, Json])[] =>
  isMap(value)
    ? Object.entries(value).flatMap(([key, inner]) =>
        leaves(inner, [...path, key]),
      )
    : [[path.join("."), value]];

/**
 * Where the user's file may be, in the order it's looked for: under
 * $XDG_CONFIG_HOME when it's set, else ~/.config; nowhere without either.
 */
export const userConfigPaths = (
  env: Readonly<{ xdgConfigHome?: string; home?: string }>,
): readonly string[] => {
  const folder = env.xdgConfigHome
    ? `${env.xdgConfigHome}/${APP}`
    : env.home
      ? `${env.home}/.config/${APP}`
      : undefined;

  return folder === undefined ? [] : USER_FILES.map((name) => `${folder}/${name}`);
};

/** A file the plugin read: where it is, and its text. */
export type ConfigFile = Readonly<{ path: string; text: string }>;

/**
 * A file's value checked against the shape, without the sections the plugin no
 * longer reads, or what's wrong with it; each problem or warning names the
 * file. A config.jsonc is read with a warning to convert it.
 */
const checked = (
  file: ConfigFile,
  isSparse: boolean,
): Readonly<{ value: Json | undefined; problems: readonly string[] }> => {
  const parsed = isJsonc(file) ? parseJsonc(file.text) : parseYaml(file.text);
  const value = "value" in parsed ? withoutRetired(parsed.value) : undefined;
  const warnings = [
    ...(isJsonc(file) ? [JSONC_WARNING] : []),
    ...("value" in parsed ? retiredIn(parsed.value) : []),
  ];
  const problems =
    "error" in parsed
      ? [parsed.error]
      : problemsIn(SETTINGS_SHAPE, value ?? null, isSparse);
  const inFile = (lines: readonly string[]) =>
    lines.map((line) => `${file.path}: ${line}`);

  return problems.length === 0 && value !== undefined
    ? { value, problems: inFile(warnings) }
    : { value: undefined, problems: inFile([...warnings, ...problems]) };
};

const keyOf = ([key]: readonly [string, Json]): string => key;

/** One line per setting in effect, with the file it came from. */
const effectiveLines = (
  merged: Json,
  defaults: ConfigFile,
  user: Readonly<{ value: Json | undefined; path: string }> | undefined,
): readonly string[] => {
  const fromUser = new Set(
    user?.value === undefined ? [] : leaves(user.value).map(keyOf),
  );

  return leaves(merged).map(
    ([key, value]) =>
      `${key} = ${JSON.stringify(value)}  # ${fromUser.has(key) && user ? `user: ${user.path}` : `defaults: ${defaults.path}`}`,
  );
};

/**
 * The pane's keys bound to more than one of its buttons in `value`, one
 * line each, naming the settings: a hotkey two buttons share presses
 * neither, so it's refused as a wrong type is.
 */
export const clashesIn = (value: Json): readonly string[] => {
  const keys = isMap(value) && isMap(value["keys"]) ? Object.entries(value["keys"]) : [];

  return [...new Set(keys.map(([, key]) => key))]
    .map((key) => ({
      key,
      names: keys.filter(([, bound]) => bound === key).map(([name]) => `keys.${name}`),
    }))
    .filter(({ names }) => names.length > 1)
    .map(
      ({ key, names }) =>
        `${names.join(" and ")} are ${names.length === 2 ? "both" : "all"} ${JSON.stringify(key)}; each key presses one button`,
    );
};

/**
 * The settings in effect: the user's file merged over the defaults file
 * when both are sound and bind no key twice, the defaults alone when the
 * user's isn't, and none when the defaults file isn't; each problem names
 * its file.
 */
export const loaded = (
  defaults: ConfigFile,
  user: ConfigFile | undefined,
): Loaded => {
  const base = checked(defaults, false);
  const layer = user === undefined ? undefined : checked(user, true);
  const baseClashes = base.value === undefined ? [] : clashesIn(base.value);
  const sound = baseClashes.length === 0 ? base.value : undefined;
  const over =
    sound === undefined || layer?.value === undefined
      ? undefined
      : mergedOver(sound, layer.value);
  const overClashes = over === undefined ? [] : clashesIn(over);
  const merged = over !== undefined && overClashes.length === 0 ? over : sound;
  const inFile = (path: string, lines: readonly string[]) =>
    lines.map((line) => `${path}: ${line}`);

  return {
    settings: merged === undefined ? null : (merged as Settings),
    effective:
      merged === undefined
        ? []
        : effectiveLines(
            merged,
            defaults,
            user && layer && merged === over
              ? { value: layer.value, path: user.path }
              : undefined,
          ),
    problems: [
      ...base.problems,
      ...inFile(defaults.path, baseClashes),
      ...(layer?.problems ?? []),
      ...inFile(user?.path ?? "", overClashes),
    ],
  };
};

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
// The files are YAML, read by the `yaml` package. The engine loads only the
// plugin's own files, so the flake bundles the library into vendor/ as one ES
// module, committed there.

import { parseAllDocuments } from "../../vendor/yaml/yaml.js";
import type { ParsedDocument } from "../../vendor/yaml/yaml.js";
import type { Json, Loaded, Settings } from "../../types/index.d.ts";

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
  pane: { "close-when-all-submitted": "boolean" },
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
  "pane.hints":
    "the pane draws no hint row; its ? Keys button, or keys.help, opens a panel listing every key",
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

  return !isMap(value) || !Object.hasOwn(value, key)
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
export const USER_FILES = ["config.yaml"] as const;

/** A file's value, or why it can't be read. */
type Parsed = Readonly<{ value: Json } | { error: string }>;

/**
 * How a YAML file is read: one document, under YAML 1.2's core schema alone,
 * whatever its `%YAML` directive says, so `on` and `yes` are strings; a key
 * written twice or a tag the schema doesn't hold refuses it, and `<<` is an
 * ordinary key, which no setting is. A `__proto__` key is an ordinary key
 * too. No warning goes to a console.
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

/**
 * A document's value, an empty one's (nothing, or comments alone, after a
 * `---` or before a `...`) an empty section, or why it can't be resolved,
 * such as an alias to no anchor.
 */
const valueOf = (document: ParsedDocument | undefined): Parsed => {
  try {
    return { value: (document?.toJS() as Json | null | undefined) ?? {} };
  } catch (error) {
    return {
      error: headline(error instanceof Error ? error.message : String(error)),
    };
  }
};

/**
 * A YAML file's value, a file with no document or an empty one an empty
 * section, or why it can't be read: what the stream or its document got
 * wrong, said before any value is resolved, or more than one document.
 */
export const parseYaml = (yaml: string): Parsed => {
  const documents = parseAllDocuments(yaml, YAML_OPTIONS);
  const errors = [
    ...(documents.errors ?? []),
    ...(documents.warnings ?? []),
    ...documents.flatMap((parsed) => [...parsed.errors, ...parsed.warnings]),
  ].map((error) => headline(error.message));

  return errors.length > 0
    ? { error: errors.join("; ") }
    : documents.length > 1
      ? { error: `holds ${documents.length} YAML documents, not one` }
      : valueOf(documents[0]);
};

const isMap = (value: Json | undefined): value is { readonly [key: string]: Json } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const named = (path: readonly string[]): string => path.join(".") || "the file";

const typeName = (value: Json): string =>
  value === null ? "null" : Array.isArray(value) ? "a list" : typeof value;

/** What a scalar setting of `shape` must be, as its problem says it. */
const WANTED: Readonly<Record<"string" | "number" | "boolean", string>> = {
  string: "a string",
  number: "a number",
  boolean: "true or false",
};

/** How to make `value` the string a setting wants: quotes, when YAML read a scalar as a number or a boolean. */
const quoting = (
  shape: "string" | "number" | "boolean",
  value: Json,
): string =>
  shape === "string" && (typeof value === "number" || typeof value === "boolean")
    ? "; quote it"
    : "";

/** A number YAML reads but no setting takes, as YAML writes it: `.inf`, `-.inf` or `.nan`. */
const unfinite = (value: number): string =>
  Number.isNaN(value) ? ".nan" : value > 0 ? ".inf" : "-.inf";

/** What's wrong with a scalar setting's value. */
const scalarProblems = (
  shape: "string" | "number" | "boolean",
  value: Json,
  path: readonly string[],
): readonly string[] =>
  typeof value !== shape
    ? [
        `${named(path)} is ${typeName(value)}, not ${WANTED[shape]}${quoting(shape, value)}`,
      ]
    : typeof value === "number" && !Number.isFinite(value)
      ? [`${named(path)} is ${unfinite(value)}, not a finite number`]
      : [];

/** The value with each section the shape names that's null, as a section with every key commented out reads, empty. */
const nullSectionsEmptied = (shape: Shape, value: Json): Json =>
  typeof shape === "string" || !isMap(value)
    ? value
    : Object.fromEntries(
        Object.entries(value).map(([key, inner]): [string, Json] => {
          const section = Object.hasOwn(shape, key) ? shape[key] : undefined;

          return [
            key,
            section !== undefined && typeof section !== "string" && inner === null
              ? {}
              : section === undefined
                ? inner
                : nullSectionsEmptied(section, inner),
          ];
        }),
      );

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
    ? scalarProblems(shape, value, path)
    : !isMap(value)
      ? [`${named(path)} is ${typeName(value)}, not a section`]
      : [
          ...Object.keys(value)
            // Its own keys alone: `__proto__` or `constructor` is no setting.
            .filter((key) => !Object.hasOwn(shape, key))
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
        ...Object.entries(layer).filter(([key]) => !Object.hasOwn(base, key)),
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
 * A file's value checked against the shape, a null section read as an empty
 * one, without the sections the plugin no longer reads, or what's wrong with
 * it: each problem, a section or setting left out among them, names the file.
 * Reading a file gives no warnings of its own.
 */
const checked = (
  file: ConfigFile,
  isSparse: boolean,
): Readonly<{
  value: Json | undefined;
  problems: readonly string[];
  warnings: readonly string[];
}> => {
  const parsed = parseYaml(file.text);
  const read =
    "value" in parsed ? nullSectionsEmptied(SETTINGS_SHAPE, parsed.value) : undefined;
  const value = read === undefined ? undefined : withoutRetired(read);
  const leftOut = read === undefined ? [] : retiredIn(read);
  const problems =
    "error" in parsed
      ? [parsed.error]
      : problemsIn(SETTINGS_SHAPE, value ?? null, isSparse);
  const inFile = (lines: readonly string[]) =>
    lines.map((line) => `${file.path}: ${line}`);
  const warnings: readonly string[] = [];

  return problems.length === 0 && value !== undefined
    ? { value, problems: inFile(leftOut), warnings }
    : { value: undefined, problems: inFile([...leftOut, ...problems]), warnings };
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
    warnings: [...base.warnings, ...(layer?.warnings ?? [])],
  };
};

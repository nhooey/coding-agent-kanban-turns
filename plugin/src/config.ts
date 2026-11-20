// The plugin's settings: the shipped defaults file, defaults/config.jsonc, with
// the user's own file merged over it. Pure: hooks/settings.ts reads the two
// files and hands their text here.
//
// The defaults file holds every value; this module holds only the shape
// those values must have, so a default is written in one place. Sections
// merge key by key, a scalar or a list replaces, and a key the shape
// doesn't name, or a value of the wrong type, refuses the user's file whole.
// A section the plugin no longer reads is the exception: it is left out with a
// warning, and the rest of the file is used.

import type { Json, Loaded, Settings } from "../types/index.d.ts";

/** The type each setting must have: a section is a map of its keys. */
type Shape = "string" | "number" | { readonly [key: string]: Shape };

/** Every setting the plugin reads, by the type its value must have. */
export const SETTINGS_SHAPE: Shape = {
  counts: { turns: "number", "gh-timeout-ms": "number" },
  keys: { dismiss: "string" },
  notes: { rows: "number" },
  colors: {
    border: "string",
    title: "string",
    "title-background": "string",
    code: "string",
    hover: "string",
    settled: "string",
    close: "string",
    "close-x": "string",
    kanban: "string",
  },
};

/** The sections and settings the plugin no longer reads, by dotted key, each with what to set instead. */
export const RETIRED: Readonly<Record<string, string>> = {
  outstanding:
    "the plugin reads the transcript itself; counts.turns sets how many turns the count line reads",
  "colors.expand":
    "the ↗ beside the count line is gone; colors.kanban colours the 🖥️ Kanban button that opens the pane",
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
export const DEFAULTS_FILE = "defaults/config.jsonc";

// A JSON string, kept whole, so what looks like a comment or a comma inside
// one stays.
const STRING = String.raw`"(?:\\.|[^"\\])*"`;
const COMMENT = new RegExp(String.raw`(${STRING})|//[^\n]*|/\*[\s\S]*?\*/`, "g");
const TRAILING_COMMA = new RegExp(String.raw`(${STRING})|,(\s*[}\]])`, "g");

/** JSONC as JSON: each comment and each trailing comma dropped, strings untouched. */
export const jsonOf = (jsonc: string): string =>
  jsonc
    .replace(COMMENT, (_, string?: string) => string ?? "")
    .replace(TRAILING_COMMA, (_, string?: string, close?: string) => string ?? close ?? "");

/** A JSONC file's value, or why it can't be read. */
export const parseJsonc = (
  jsonc: string,
): Readonly<{ value: Json } | { error: string }> => {
  try {
    return { value: JSON.parse(jsonOf(jsonc)) as Json };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
};

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
  typeof shape === "string"
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

/** The user's file: under $XDG_CONFIG_HOME when it's set, else ~/.config; none without either. */
export const userConfigPath = (
  env: Readonly<{ xdgConfigHome?: string; home?: string }>,
): string | undefined =>
  env.xdgConfigHome
    ? `${env.xdgConfigHome}/${APP}/config.jsonc`
    : env.home
      ? `${env.home}/.config/${APP}/config.jsonc`
      : undefined;

/** A file the plugin read: where it is, and its text. */
export type ConfigFile = Readonly<{ path: string; text: string }>;

/**
 * A file's value checked against the shape, without the sections the plugin no
 * longer reads, or what's wrong with it; each problem or warning names the
 * file.
 */
const checked = (
  file: ConfigFile,
  isSparse: boolean,
): Readonly<{ value: Json | undefined; problems: readonly string[] }> => {
  const parsed = parseJsonc(file.text);
  const value = "value" in parsed ? withoutRetired(parsed.value) : undefined;
  const warnings = "value" in parsed ? retiredIn(parsed.value) : [];
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
 * The settings in effect: the user's file merged over the defaults file
 * when both are sound, the defaults alone when the user's isn't, and none
 * when the defaults file isn't; each problem names its file.
 */
export const loaded = (
  defaults: ConfigFile,
  user: ConfigFile | undefined,
): Loaded => {
  const base = checked(defaults, false);
  const layer = user === undefined ? undefined : checked(user, true);
  const merged =
    base.value === undefined
      ? undefined
      : layer?.value === undefined
        ? base.value
        : mergedOver(base.value, layer.value);

  return {
    settings: merged === undefined ? null : (merged as Settings),
    effective:
      merged === undefined
        ? []
        : effectiveLines(
            merged,
            defaults,
            user && layer ? { value: layer.value, path: user.path } : undefined,
          ),
    problems: [...base.problems, ...(layer?.problems ?? [])],
  };
};

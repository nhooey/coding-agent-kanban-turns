// The plugin's settings: the shipped defaults file, defaults/config.yaml, with
// the user's own file merged over it. Pure: hooks/settings.ts reads the two
// files and hands their text here.
//
// The defaults file holds every setting and its value, and gives the shape
// the user's file must have: each setting the type of its default, unless
// KINDS names its section's. Sections merge key by key, a scalar or a list
// replaces, and a key the defaults file doesn't hold, or a value of the
// wrong type, refuses the user's file whole.
//
// The files are YAML, read by the `yaml` package. The engine loads only the
// plugin's own files, so the flake bundles the library into vendor/ as one ES
// module, committed there.

import { parseAllDocuments } from "../../vendor/yaml/yaml.js";
import type { ParsedDocument } from "../../vendor/yaml/yaml.js";
import { isObject } from "../json/fields.ts";
import type { Json, Loaded, Settings } from "../../types/index.d.ts";

/**
 * The type a setting must have: a scalar's; a `key`, a string the engine
 * takes as a Button's hotkey; or a `mark`, a string the pane draws as it is
 * on one line.
 */
export type Kind = "string" | "number" | "boolean" | "key" | "mark";

/** The type each setting must have: a section is a map of its keys. */
export type Shape = Kind | { readonly [key: string]: Shape };

/** What the engine takes as a Button's hotkey: one lowercase letter or one digit; it refuses the whole drawing over anything else. */
const HOTKEY = /^[a-z0-9]$/;

/** What no mark may hold, since it would break the line the mark is drawn on: a control character, or a line or paragraph separator. */
const UNDRAWABLE = /[\p{Cc}\u{2028}\u{2029}]/u;

/**
 * The type of every setting in a section, by the section's dotted key,
 * where the defaults' types don't say it: every pane key is a hotkey, and
 * every setting under `marks`, its buttons' among them, a mark.
 */
const KINDS: Readonly<Record<string, Kind>> = { keys: "key", marks: "mark" };

/** The types a default gives its setting by being one. */
const SCALARS = ["string", "number", "boolean"] as const;

/** The shape a defaults file gives, or why it gives none. */
export type Derived = Readonly<{ shape: Shape } | { problems: readonly string[] }>;

/** The type KINDS names for every setting in the section at `path`, if it names one. */
const kindNamed = (path: readonly string[]): Kind | undefined =>
  Object.hasOwn(KINDS, path.join(".")) ? KINDS[path.join(".")] : undefined;

/** A section's shape, each key's from its default, or every reason its defaults give none. */
const sectionShape = (
  section: { readonly [key: string]: Json },
  path: readonly string[],
  kind: Kind | undefined,
): Derived => {
  const inner = Object.entries(section).map(
    ([key, value]) => [key, shapeAt(value, [...path, key], kind)] as const,
  );
  const problems = [
    ...(inner.length === 0 ? [`${named(path)} holds no settings`] : []),
    ...inner.flatMap(([, each]) => ("problems" in each ? each.problems : [])),
  ];

  return problems.length > 0
    ? { problems }
    : {
        shape: Object.fromEntries(
          inner.flatMap(([key, each]): [string, Shape][] =>
            "shape" in each ? [[key, each.shape]] : [],
          ),
        ),
      };
};

/**
 * The shape a default at `path` gives: a section's, the type KINDS names
 * for its section's settings, or its scalar's type.
 */
const shapeAt = (
  value: Json,
  path: readonly string[],
  kind: Kind | undefined,
): Derived => {
  const sectionKind = kindNamed(path);
  const leaf = kind ?? SCALARS.find((scalar) => typeof value === scalar);

  return isMap(value)
    ? sectionShape(value, path, sectionKind ?? kind)
    : sectionKind !== undefined
      ? { problems: [`${named(path)} is ${typeName(value)}, not the section KINDS names`] }
      : leaf !== undefined
        ? { shape: leaf }
        : {
            problems: [
              `${named(path)} is ${typeName(value)}, so its default gives it no type; write a string, a number, or true or false, or name its section's type in KINDS in src/config/config.ts`,
            ],
          };
};

/**
 * The shape the defaults file's value gives the user's file, or why it
 * gives none: a default that gives no type, a section that holds no
 * settings, or a section KINDS names that the file doesn't hold.
 */
export const shapeOf = (defaults: Json): Derived => {
  const derived: Derived = isMap(defaults)
    ? sectionShape(defaults, [], undefined)
    : { problems: [`${named([])} is ${typeName(defaults)}, not a section`] };
  const unheld = isMap(defaults)
    ? Object.keys(KINDS)
        .filter((key) => at(defaults, key.split(".")) === undefined)
        .map((key) => `${key} is missing, a section KINDS names`)
    : [];
  const problems = [...("problems" in derived ? derived.problems : []), ...unheld];

  return problems.length > 0 ? { problems } : derived;
};

/** The value at a dotted key's path, or undefined where there is none. */
const at = (value: Json | undefined, path: readonly string[]): Json | undefined =>
  path.reduce<Json | undefined>(
    (inner, key) => (isMap(inner) && Object.hasOwn(inner, key) ? inner[key] : undefined),
    value,
  );

/** The folder under $XDG_CONFIG_HOME, or ~/.config, the user's file sits in. */
export const APP = "coding-agent-kanban-turns";

/** The defaults file, from the plugin's own folder. */
export const DEFAULTS_FILE = "defaults/config.yaml";

/** The user's file's name. */
export const USER_FILE = "config.yaml";

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
  isObject(value);

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

/**
 * What's wrong with a mark's value: anything but a string, as a string
 * setting's; an empty string, as YAML reads a bare `>` or `|`, which the
 * pane would draw as nothing; or one holding a control character or a line
 * or paragraph separator.
 */
const markProblems = (value: Json, path: readonly string[]): readonly string[] =>
  typeof value !== "string"
    ? scalarProblems("string", value, path)
    : value === ""
      ? [
          `${named(path)} is "", not a mark; write a glyph, quoted where YAML would read it otherwise, such as ">"`,
        ]
      : UNDRAWABLE.test(value)
        ? [
            `${named(path)} is ${JSON.stringify(value)}, which holds a control character or a line break; a mark is drawn on one line`,
          ]
        : [];

/** The value with each section the shape names that's null, as a section with every key commented out reads, empty. */
export const nullSectionsEmptied = (shape: Shape, value: Json): Json =>
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
    : shape === "mark"
    ? markProblems(value, path)
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
          ...Object.entries(shape).flatMap(([key, inner]) => {
            const set = Object.hasOwn(value, key) ? value[key] : undefined;

            return set === undefined
              ? isSparse
                ? []
                : [`${named([...path, key])} is missing`]
              : problemsIn(inner, set, isSparse, [...path, key]);
          }),
        ];

/** `layer` over `base`: maps merge key by key, anything else replaces. */
export const mergedOver = (base: Json, layer: Json): Json =>
  isMap(base) && isMap(layer)
    ? Object.fromEntries([
        ...Object.entries(base).map(
          ([key, value]): [string, Json] => {
            const set = Object.hasOwn(layer, key) ? layer[key] : undefined;

            return [key, set === undefined ? value : mergedOver(value, set)];
          },
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
 * Where the user's file is: under $XDG_CONFIG_HOME when it's set, else
 * ~/.config; nowhere without either.
 */
export const userConfigPath = (
  env: Readonly<{ xdgConfigHome?: string; home?: string }>,
): string | undefined =>
  env.xdgConfigHome
    ? `${env.xdgConfigHome}/${APP}/${USER_FILE}`
    : env.home
      ? `${env.home}/.config/${APP}/${USER_FILE}`
      : undefined;

/** A file the plugin read: where it is, and its text. */
export type ConfigFile = Readonly<{ path: string; text: string }>;

/** The shipped defaults file: where it is, and its text, or none when it isn't there. */
export type DefaultsFile = Readonly<{ path: string; text: string | undefined }>;

/** Each line, naming the file at `path`. */
const inFile = (path: string, lines: readonly string[]): readonly string[] =>
  lines.map((line) => `${path}: ${line}`);

/**
 * A file's value checked against `shape`, a null section read as an empty
 * one, or what's wrong with it, each problem naming the file.
 */
const checked = (
  shape: Shape,
  path: string,
  parsed: Parsed,
  isSparse: boolean,
): Readonly<{
  value: Json | undefined;
  problems: readonly string[];
}> => {
  const value = "value" in parsed ? nullSectionsEmptied(shape, parsed.value) : undefined;
  const problems =
    "error" in parsed ? [parsed.error] : problemsIn(shape, value ?? null, isSparse);

  return problems.length === 0 && value !== undefined
    ? { value, problems: [] }
    : { value: undefined, problems: inFile(path, problems) };
};

/**
 * The shape the defaults file gives, with its value, or why it gives none:
 * it isn't there, it can't be read, or its defaults give no shape.
 */
const givenBy = (
  defaults: DefaultsFile,
): Readonly<{ shape: Shape; value: Json } | { problems: readonly string[] }> => {
  const parsed: Parsed =
    defaults.text === undefined ? { error: "is missing" } : parseYaml(defaults.text);
  const derived: Derived =
    "value" in parsed ? shapeOf(parsed.value) : { problems: [parsed.error] };

  return "value" in parsed && "shape" in derived
    ? { shape: derived.shape, value: parsed.value }
    : { problems: "problems" in derived ? derived.problems : [] };
};

const keyOf = ([key]: readonly [string, Json]): string => key;

/** One line per setting in effect, with the file it came from. */
const effectiveLines = (
  merged: Json,
  defaults: DefaultsFile,
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

/** Every setting the shape takes as a hotkey, by its path, in the shape's order. */
const hotkeysOf = (
  shape: Shape,
  path: readonly string[] = [],
): readonly (readonly string[])[] =>
  shape === "key"
    ? [path]
    : typeof shape === "string"
      ? []
      : Object.entries(shape).flatMap(([key, inner]) => hotkeysOf(inner, [...path, key]));

/**
 * The pane's keys bound to more than one of its buttons in `value`, one
 * line each, naming the settings, the ones `shape` takes as hotkeys: a
 * hotkey two buttons share presses neither, so it's refused as a wrong
 * type is.
 */
export const clashesIn = (shape: Shape, value: Json): readonly string[] => {
  const keys = hotkeysOf(shape).flatMap((path): (readonly [string, Json])[] => {
    const bound = at(value, path);

    return bound === undefined ? [] : [[path.join("."), bound]];
  });

  return [...new Set(keys.map(([, key]) => key))]
    .map((key) => ({
      key,
      names: keys.filter(([, bound]) => bound === key).map(([name]) => name),
    }))
    .filter(({ names }) => names.length > 1)
    .map(
      ({ key, names }) =>
        `${names.join(" and ")} are ${names.length === 2 ? "both" : "all"} ${JSON.stringify(key)}; each key presses one button`,
    );
};

/**
 * The settings in effect, the defaults file's value given the shape it
 * gives: the user's file merged over it when both are sound and bind no
 * key twice, the defaults alone when the user's isn't, and none when the
 * defaults file isn't. Each problem names its file.
 */
const loadedIn = (
  shape: Shape,
  defaultsValue: Json,
  defaults: DefaultsFile,
  user: ConfigFile | undefined,
): Loaded => {
  const base = checked(shape, defaults.path, { value: defaultsValue }, false);
  const layer =
    user === undefined ? undefined : checked(shape, user.path, parseYaml(user.text), true);
  const baseClashes = base.value === undefined ? [] : clashesIn(shape, base.value);
  const sound = baseClashes.length === 0 ? base.value : undefined;
  const over =
    sound === undefined || layer?.value === undefined
      ? undefined
      : mergedOver(sound, layer.value);
  const overClashes = over === undefined ? [] : clashesIn(shape, over);
  const merged = over !== undefined && overClashes.length === 0 ? over : sound;

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

/**
 * The settings in effect. The defaults file holds every setting, so it
 * gives the shape the user's file is checked against; when it isn't
 * there, can't be read or gives no shape, no settings are in effect and
 * the user's file isn't checked. Each problem names its file.
 */
export const loaded = (
  defaults: DefaultsFile,
  user: ConfigFile | undefined,
): Loaded => {
  const given = givenBy(defaults);

  return "problems" in given
    ? { settings: null, effective: [], problems: inFile(defaults.path, given.problems) }
    : loadedIn(given.shape, given.value, defaults, user);
};

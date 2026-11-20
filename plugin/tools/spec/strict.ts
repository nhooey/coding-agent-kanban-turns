// Reading a data file and its JSON Schema as strictly as the protocol's
// spec: the steps tools/spec/load.ts reads the spec with and
// tools/spec/cases.ts reads a golden case with. Pure: each caller hands in
// the files' text and names the files in what comes back.
//
// Both files are read by src/config/config.ts's `parseYaml`: YAML 1.2's
// core schema, so `no`, `Y` and `N` are strings, and a key written twice
// refuses the file. An empty schema, which checks nothing, is refused. The
// data is then checked against the schema with ajv in strict mode, so a
// plain scalar the core schema reads as a number or a boolean where the
// schema wants a string is refused.

import { Ajv } from "ajv";
import { parseYaml } from "../../src/config/config.ts";
import type { Json } from "../../types/index.d.ts";

/** Which of the two files a problem is in: the schema, or the data it checks. */
export type Where = "schema" | "data";

/** One problem, and the file it's in. */
export type Problem = Readonly<{ in: Where; problem: string }>;

/** The data, read and shaped as its schema says, or every problem with either file. */
export type Strict = Readonly<{ value: Json } | { problems: readonly Problem[] }>;

/** How strictly ajv reads the schema, beyond its strict mode. */
export type StrictOptions = Readonly<{
  /**
   * Whether a `required` key must be spelled out under `properties` too,
   * as ajv's strict mode wants; false lets a schema require keys of a map,
   * whose values `additionalProperties` shapes.
   */
  strictRequired: boolean;
}>;

/** Each value `values` holds more than once, once, in the order it first repeats. */
export const repeated = <T>(values: readonly T[]): readonly T[] => [
  ...new Set(values.filter((value, n) => values.indexOf(value) !== n)),
];

/** Whether a schema is empty, `{}`, as an empty file reads, so it checks nothing. */
export const isEmptySchema = (schema: Json): boolean =>
  typeof schema === "object" &&
  schema !== null &&
  Object.keys(schema).length === 0;

/** An error's message, whatever was thrown. */
export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * What's wrong with `value` against `schema`, one problem per error: in the
 * data, by its path in it, or in the schema, where ajv can't compile it.
 */
export const schemaProblems = (
  schema: Json,
  value: Json,
  options: StrictOptions,
): readonly Problem[] => {
  try {
    const validate = new Ajv({
      allErrors: true,
      strict: true,
      strictRequired: options.strictRequired,
    }).compile(schema as object);

    return validate(value)
      ? []
      : (validate.errors ?? []).map((error) => {
          const extra: unknown = error.params["additionalProperty"];

          return {
            in: "data",
            problem: `${error.instancePath || "/"} ${error.message ?? "is wrong"}${typeof extra === "string" ? `: ${extra}` : ""}`,
          };
        });
  } catch (error) {
    return [{ in: "schema", problem: messageOf(error) }];
  }
};

/**
 * The data in `text`, read strictly and checked against the schema in
 * `schemaText`, or every problem with either: first what keeps either file
 * from being read, an empty schema among them; then, once both read, what
 * the schema finds wrong with the data.
 */
export const strictlyRead = (
  text: string,
  schemaText: string,
  options: StrictOptions,
): Strict => {
  const schema = parseYaml(schemaText);
  const data = parseYaml(text);
  const unread: readonly Problem[] = [
    ...("error" in schema
      ? [{ in: "schema", problem: schema.error } as const]
      : isEmptySchema(schema.value)
        ? [{ in: "schema", problem: "is empty, so it checks nothing" } as const]
        : []),
    ...("error" in data ? [{ in: "data", problem: data.error } as const] : []),
  ];
  const unshaped =
    unread.length === 0 && "value" in schema && "value" in data
      ? schemaProblems(schema.value, data.value, options)
      : [];
  const problems = [...unread, ...unshaped];

  return problems.length === 0 && "value" in data
    ? { value: data.value }
    : { problems };
};

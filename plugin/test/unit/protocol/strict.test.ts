// Reading a data file and its schema strictly, tools/spec/strict.ts: what
// both the spec's build step and the golden cases' reader stand on.

import { describe, test } from "node:test";
import { expect } from "expect";

import {
  isEmptySchema,
  messageOf,
  repeated,
  schemaProblems,
  strictlyRead,
} from "../../../tools/spec/strict.ts";

const SCHEMA = `type: object
additionalProperties: false
required: [name]
properties:
  name: { type: string }
`;

const STRICT = { strictRequired: true } as const;

describe("strictlyRead", () => {
  test("reads data its schema holds", () => {
    expect(strictlyRead("name: loader\n", SCHEMA, STRICT)).toEqual({
      value: { name: "loader" },
    });
  });

  test("reads yes, no, Y and N as strings, as YAML 1.2 does", () => {
    expect(strictlyRead("name: no\n", SCHEMA, STRICT)).toEqual({
      value: { name: "no" },
    });
  });

  test("refuses a key written twice, in the data", () => {
    expect(strictlyRead("name: a\nname: b\n", SCHEMA, STRICT)).toEqual({
      problems: [
        { in: "data", problem: "Map keys must be unique at line 2, column 1" },
      ],
    });
  });

  test("refuses a scalar YAML 1.2 types as a number where the schema wants a string, by its path", () => {
    expect(strictlyRead("name: 1.10\n", SCHEMA, STRICT)).toEqual({
      problems: [{ in: "data", problem: "/name must be string" }],
    });
  });

  test("refuses a key the schema doesn't name, naming the key", () => {
    expect(strictlyRead("name: a\ncolour: red\n", SCHEMA, STRICT)).toEqual({
      problems: [
        {
          in: "data",
          problem: "/ must NOT have additional properties: colour",
        },
      ],
    });
  });

  test("refuses an empty schema, which checks nothing, in the schema", () => {
    expect(strictlyRead("name: a\n", "", STRICT)).toEqual({
      problems: [{ in: "schema", problem: "is empty, so it checks nothing" }],
    });
  });

  test("names both files where neither reads, and checks the data against no schema", () => {
    const result = strictlyRead("name: [\n", "type: [\n", STRICT);

    expect("problems" in result ? result.problems.map((p) => p.in) : []).toEqual([
      "schema",
      "data",
    ]);
  });

  test("puts a schema ajv can't compile in the schema", () => {
    expect(strictlyRead("name: a\n", "type: nope\n", STRICT)).toEqual({
      problems: [
        {
          in: "schema",
          problem:
            "schema is invalid: data/type must be equal to one of the allowed values, data/type must be array, data/type must match a schema in anyOf",
        },
      ],
    });
  });
});

describe("schemaProblems", () => {
  // A map whose keys the schema requires, its values shaped by additionalProperties.
  const MAP = { type: "object", required: ["decide"], additionalProperties: { type: "string" } };

  test("strictRequired refuses a required key not spelled out under properties, in the schema", () => {
    expect(schemaProblems(MAP, { decide: "x" }, { strictRequired: true })).toEqual([
      { in: "schema", problem: expect.stringContaining("required property") },
    ]);
  });

  test("without strictRequired, a schema requires keys of a map", () => {
    expect(schemaProblems(MAP, { decide: "x" }, { strictRequired: false })).toEqual([]);
    expect(schemaProblems(MAP, {}, { strictRequired: false })).toEqual([
      { in: "data", problem: "/ must have required property 'decide'" },
    ]);
  });
});

describe("the helpers", () => {
  test("repeated gives each value held more than once, once, in the order it first repeats", () => {
    expect(repeated(["a", "b", "b", "a", "a", "c"])).toEqual(["b", "a"]);
    expect(repeated([1, 2, 2])).toEqual([2]);
  });

  test("isEmptySchema holds for {} alone", () => {
    expect(isEmptySchema({})).toBe(true);
    expect(isEmptySchema({ type: "object" })).toBe(false);
    expect(isEmptySchema(null)).toBe(false);
  });

  test("messageOf gives an error's message, or whatever was thrown as text", () => {
    expect(messageOf(new Error("broke"))).toBe("broke");
    expect(messageOf("broke")).toBe("broke");
  });
});

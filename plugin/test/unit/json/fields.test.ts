import { describe, test } from "node:test";
import { expect } from "expect";

import { field, isObject, parsedJson } from "../../../src/json/fields.ts";

describe("isObject", () => {
  test("holds for an object with fields, or none", () => {
    expect(isObject({ a: 1 })).toBe(true);
    expect(isObject({})).toBe(true);
  });

  test("fails for null, an array and a scalar", () => {
    expect(isObject(null)).toBe(false);
    expect(isObject(undefined)).toBe(false);
    expect(isObject([1, 2])).toBe(false);
    expect(isObject("a")).toBe(false);
    expect(isObject(1)).toBe(false);
  });
});

describe("field", () => {
  test("an object's field by name, undefined where it has none", () => {
    expect(field({ a: 1 }, "a")).toBe(1);
    expect(field({ a: 1 }, "b")).toBeUndefined();
  });

  test("undefined for a value that is no object", () => {
    expect(field(null, "a")).toBeUndefined();
    expect(field(["x"], "0")).toBeUndefined();
    expect(field("abc", "length")).toBeUndefined();
  });
});

describe("parsedJson", () => {
  test("the value JSON text holds", () => {
    expect(parsedJson('{"a":[1,"b"]}')).toEqual({ a: [1, "b"] });
    expect(parsedJson("null")).toBeNull();
    expect(parsedJson(" 3 ")).toBe(3);
  });

  test("undefined for text that is no JSON, such as a line cut short", () => {
    expect(parsedJson('{"a":')).toBeUndefined();
    expect(parsedJson("")).toBeUndefined();
  });
});

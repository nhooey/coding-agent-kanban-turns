// What the core reads JSON input with, input it never typed itself: a
// transcript's records, a tool call's input, a GitHub response and a
// settings file. Whether a value is an object, a field of it, and JSON text
// parsed without a throw. No `$`, no I/O.

/** An object's fields by name, their values not yet looked at. */
export type Fields = Readonly<Record<string, unknown>>;

/** Whether a value is an object with fields, not `null` and not an array. */
export const isObject = (value: unknown): value is Fields =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A value's field by name, where the value is an object; else `undefined`. */
export const field = (value: unknown, key: string): unknown =>
  isObject(value) ? value[key] : undefined;

/** The value JSON text holds; `undefined` where the text is no JSON. */
export const parsedJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
};

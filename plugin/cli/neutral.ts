// The neutral adapter: turns a harness with no adapter here writes itself,
// as a JSON list of `Turn` (types/index.d.ts), read back into the turns the
// core reads. It is how the CLI reads stdin. No I/O: cli/kanban.ts reads
// the text and hands it here.
//
// A turn's `replies`, `decide` and `messages` may be left out, each read as
// none, and so may its `unanswered`, read as answered, and a message's
// `reportNames`. A Decide item is read as the `kanban_options` tool takes
// it: it may leave out its `turn`, then the turn's own id, and its `kind`,
// then radio; any `ref` and `list` it gives are dropped and worked out
// afresh. Anything else out of shape is a problem, naming where it is, and
// no turns are read:
//
// - a turn id the spec's reference grammar can't write, in a turn or an
//   item, or one opening two turns;
// - a field the shape doesn't name, in a turn, a message, an item or an
//   option;
// - a field of the wrong type: an item's `number` that isn't a whole number
//   1 or more, a `note`, `frees`, `supersedes`, `pros`, `cons` or `notes`
//   that isn't a list of strings, or a `glyph` or `consequence` that isn't a string;
// - an option kind the spec doesn't name, or an option letter outside the
//   grammar's letters, one its kind doesn't take, or one given twice.

import { itemsOf } from "../src/items/items.ts";
import { field, isObject, parsedJson } from "../src/json/fields.ts";
import { isOptionLetter, isTurnId } from "../src/protocol/rules.ts";
import { SPEC } from "../src/protocol/spec.ts";
import type {
  DecideItem,
  DecideOption,
  Message,
  Owner,
  Turn,
} from "../types/index.d.ts";

/** A value read from the JSON, or every problem with it, each naming where it is. */
export type Got<T> = Readonly<{ value: T } | { problems: readonly string[] }>;

/** Every owner `Owner` names, so a new one fails the type-check until it's here. */
const OWNERS: Readonly<Record<Owner, true>> = {
  user: true,
  "this-plugin": true,
  "other-plugin": true,
  peer: true,
  notification: true,
  scheduled: true,
};

// The fields of each shape, keyed by the type's own keys, so a field added
// to the type fails the type-check until it's here.
const TURN_FIELDS: Readonly<Record<keyof Turn, true>> = {
  id: true,
  prompt: true,
  replies: true,
  decide: true,
  messages: true,
  unanswered: true,
  promptedAt: true,
  answeredAt: true,
};
const MESSAGE_FIELDS: Readonly<Record<keyof Message, true>> = {
  owner: true,
  text: true,
  reportNames: true,
};
const ITEM_FIELDS: Readonly<Record<keyof DecideItem, true>> = {
  turn: true,
  list: true,
  number: true,
  summary: true,
  kind: true,
  ref: true,
  note: true,
  options: true,
  frees: true,
  supersedes: true,
};
const OPTION_FIELDS: Readonly<Record<keyof DecideOption, true>> = {
  letter: true,
  name: true,
  glyph: true,
  consequence: true,
  pros: true,
  cons: true,
  notes: true,
};

const KINDS: Readonly<Record<string, Readonly<{ letters: object }>>> =
  SPEC.options.kinds;

const isOwner = (value: unknown): value is Owner =>
  typeof value === "string" && Object.hasOwn(OWNERS, value);

const isStrings = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((each) => typeof each === "string");

const TURN_ID = SPEC.reference["turn-id"];

/** What a field must be: a test, and what the test asks for, as a problem says it. */
type Check = Readonly<{ is: (value: unknown) => boolean; what: string }>;

const STRING: Check = { is: (value) => typeof value === "string", what: "a string" };
const STRINGS: Check = { is: isStrings, what: "a list of strings" };
// An ISO 8601 date and time with its zone, as a transcript writes one:
// `2026-11-16T20:06:00.270Z` or `2026-11-16T21:06+01:00`. Matched before
// it's parsed, since Date.parse also takes forms ISO 8601 doesn't write,
// and reads a time with no zone as local.
const ISO_TIME =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

const TIME: Check = {
  is: (value) =>
    typeof value === "string" && ISO_TIME.test(value) && !Number.isNaN(Date.parse(value)),
  what: "an ISO 8601 time",
};

// A turn's times, each left out where it's unknown.
const TURN_CHECKS: Readonly<Partial<Record<keyof Turn, Check>>> = {
  promptedAt: TIME,
  answeredAt: TIME,
};

// The fields of an item and an option whose type kanban_options' own
// reading doesn't check, and what each must be where it's given.
const ITEM_CHECKS: Readonly<Partial<Record<keyof DecideItem, Check>>> = {
  turn: {
    is: (value) => typeof value === "string" && isTurnId(value),
    what: `a turn's id: ${TURN_ID.length} characters of ${TURN_ID.alphabet}`,
  },
  number: {
    is: (value) => Number.isSafeInteger(value) && Number(value) > 0,
    what: "a whole number, 1 or more",
  },
  note: STRINGS,
  frees: STRINGS,
  supersedes: STRINGS,
};
const OPTION_CHECKS: Readonly<Partial<Record<keyof DecideOption, Check>>> = {
  glyph: STRING,
  consequence: STRING,
  pros: STRINGS,
  cons: STRINGS,
  notes: STRINGS,
};

/** A problem for each field `checks` names that `value` gives, at `where`, but not as its check asks; one left out is none. */
const typeProblems = (
  value: unknown,
  checks: Readonly<Partial<Record<string, Check>>>,
  where: string,
): readonly string[] =>
  Object.entries(checks).flatMap(([key, check]) => {
    const got = field(value, key);

    return got === undefined || check === undefined || check.is(got)
      ? []
      : [`${where}.${key} isn't ${check.what}: ${JSON.stringify(got)}`];
  });

/** The problems of every `Got` among `parts`. */
const problemsOf = (parts: readonly Got<unknown>[]): readonly string[] =>
  parts.flatMap((part) => ("problems" in part ? part.problems : []));

/** The values that come more than once in `values`, each once, in the order they first repeat. */
const repeated = <T>(values: readonly T[]): readonly T[] => [
  ...new Set(values.filter((value, n) => values.indexOf(value) !== n)),
];

/** A problem for each of an object's fields that `fields` doesn't name, at `where`, the shape called `shape`. */
const unknownFields = (
  value: unknown,
  fields: Readonly<Record<string, true>>,
  where: string,
  shape: string,
): readonly string[] =>
  isObject(value)
    ? Object.keys(value)
        .filter((key) => !Object.hasOwn(fields, key))
        .map((key) => `${where}.${key} is no field of ${shape}`)
    : [];

/** A list at `where`, none where it's left out. */
const listAt = (value: unknown, where: string): Got<readonly unknown[]> =>
  value === undefined
    ? { value: [] }
    : Array.isArray(value)
      ? { value }
      : { problems: [`${where} isn't a list`] };

/** A message at `where`: its owner, its text and the names it goes by where it's a report. */
export const messageAt = (value: unknown, where: string): Got<Message> => {
  const owner = field(value, "owner");
  const text = field(value, "text");
  const names = field(value, "reportNames");
  const problems = !isObject(value)
    ? [`${where} isn't an object`]
    : [
        ...unknownFields(value, MESSAGE_FIELDS, where, "a message"),
        ...(isOwner(owner)
          ? []
          : [`${where}.owner isn't one of ${Object.keys(OWNERS).join(", ")}`]),
        ...(typeof text === "string" ? [] : [`${where}.text isn't a string`]),
        ...(names === undefined || isStrings(names)
          ? []
          : [`${where}.reportNames isn't a list of strings`]),
      ];

  return problems.length > 0 || !isOwner(owner) || typeof text !== "string"
    ? { problems }
    : {
        value: { owner, text, reportNames: isStrings(names) ? names : undefined },
      };
};

/** What's wrong with one option's fields and letter, at `at`, among a `kindName` item's, which take the letters `taken`, or any where none. */
const optionProblems = (
  option: unknown,
  at: string,
  kindName: unknown,
  taken: readonly string[],
): readonly string[] => {
  const letter = field(option, "letter");
  const { first, last } = SPEC.reference.letters;

  return [
    ...unknownFields(option, OPTION_FIELDS, at, "an option"),
    ...typeProblems(option, OPTION_CHECKS, at),
    ...(typeof letter !== "string"
      ? []
      : !isOptionLetter(letter)
        ? [`${at}.letter ${JSON.stringify(letter)} isn't one of ${first} to ${last}`]
        : taken.length > 0 && !taken.includes(letter)
          ? [`${at}.letter ${letter} isn't one a ${String(kindName)} item takes: ${taken.join(", ")}`]
          : []),
  ];
};

/** What's wrong with a Decide item's kind and its options, at `where`, that kanban_options' own reading lets through. */
const kindProblems = (value: unknown, where: string): readonly string[] => {
  const kindName = field(value, "kind");
  const kind = typeof kindName === "string" && Object.hasOwn(KINDS, kindName) ? KINDS[kindName] : undefined;
  const taken = Object.keys(kind?.letters ?? {});
  const options = field(value, "options");
  const listed: readonly unknown[] = Array.isArray(options) ? options : [];
  const letters = listed.flatMap((option) => {
    const letter = field(option, "letter");

    return typeof letter === "string" ? [letter] : [];
  });

  return [
    ...(kindName === undefined || kind !== undefined
      ? []
      : [
          `${where}.kind names no option kind of the spec: ${JSON.stringify(kindName)}; give one of ${Object.keys(KINDS).join(", ")}`,
        ]),
    ...listed.flatMap((option, n) =>
      optionProblems(option, `${where}.options[${n}]`, kindName, taken),
    ),
    ...repeated(letters).map(
      (letter) => `${where}.options give the letter ${letter} more than once`,
    ),
  ];
};

/**
 * The Decide item at `where` of the turn `id`, its turn the turn's own where
 * it gives none, and its `ref` and `list` dropped, so the core works them
 * out afresh, as it does for a `kanban_options` call's.
 */
const itemAt = (value: unknown, id: string, where: string): Got<DecideItem> => {
  const { ref: _ref, list: _list, ...given } = isObject(value) ? value : {};
  const [item] = itemsOf({ items: [isObject(value) ? { turn: id, ...given } : value] });
  const problems = [
    ...unknownFields(value, ITEM_FIELDS, where, "a Decide item"),
    ...typeProblems(value, ITEM_CHECKS, where),
    ...(item === undefined
      ? [
          `${where} isn't a Decide item as kanban_options takes one: a number, a summary and options, each with a letter and a name`,
        ]
      : []),
    ...kindProblems(value, where),
  ];

  return problems.length > 0 || item === undefined ? { problems } : { value: item };
};

/** Each of a list's elements read by `read`, or every problem with them. */
const eachAt = <T>(
  list: Got<readonly unknown[]>,
  where: string,
  read: (value: unknown, at: string) => Got<T>,
): Got<readonly T[]> => {
  const reads =
    "value" in list ? list.value.map((value, n) => read(value, `${where}[${n}]`)) : [];
  const problems = "problems" in list ? list.problems : problemsOf(reads);

  return problems.length > 0
    ? { problems }
    : { value: reads.flatMap((each) => ("value" in each ? [each.value] : [])) };
};

/** The turn at `where`. */
export const turnAt = (value: unknown, where: string): Got<Turn> => {
  const id = field(value, "id");
  const name = typeof id === "string" ? id : "";
  const unanswered = field(value, "unanswered");
  const prompt = messageAt(field(value, "prompt"), `${where}.prompt`);
  const replies = listAt(field(value, "replies"), `${where}.replies`);
  const decide = eachAt(
    listAt(field(value, "decide"), `${where}.decide`),
    `${where}.decide`,
    (item, at) => itemAt(item, name, at),
  );
  const messages = eachAt(
    listAt(field(value, "messages"), `${where}.messages`),
    `${where}.messages`,
    messageAt,
  );
  const problems = !isObject(value)
    ? [`${where} isn't an object`]
    : [
        ...unknownFields(value, TURN_FIELDS, where, "a turn"),
        ...(typeof id === "string" && isTurnId(id)
          ? []
          : [
              `${where}.id ${JSON.stringify(id)} isn't a turn's id: ${TURN_ID.length} characters of ${TURN_ID.alphabet}`,
            ]),
        ...problemsOf([prompt, replies, decide, messages]),
        ...("value" in replies && !isStrings(replies.value)
          ? [`${where}.replies isn't a list of strings`]
          : []),
        ...(unanswered === undefined || typeof unanswered === "boolean"
          ? []
          : [`${where}.unanswered isn't true or false`]),
        ...typeProblems(value, TURN_CHECKS, where),
      ];
  const promptedAt = field(value, "promptedAt");
  const answeredAt = field(value, "answeredAt");

  return problems.length > 0 ||
    !("value" in prompt) ||
    !("value" in replies) ||
    !isStrings(replies.value) ||
    !("value" in decide) ||
    !("value" in messages)
    ? { problems }
    : {
        value: {
          id: name,
          prompt: prompt.value,
          replies: replies.value,
          decide: decide.value,
          messages: messages.value,
          ...(unanswered === true ? { unanswered } : {}),
          ...(typeof promptedAt === "string" ? { promptedAt } : {}),
          ...(typeof answeredAt === "string" ? { answeredAt } : {}),
        },
      };
};

/** A problem for each turn whose id an earlier turn already opened, by its place. */
const repeatedIds = (turns: readonly Turn[]): readonly string[] =>
  turns.flatMap((turn, n) => {
    const first = turns.findIndex((other) => other.id === turn.id);

    return first === n
      ? []
      : [`turns[${n}].id ${turn.id} opens a second turn, as turns[${first}].id does`];
  });

/** The neutral turns a JSON text holds, oldest first, or every problem with it. */
export const turnsOfJson = (text: string): Got<readonly Turn[]> => {
  const value = parsedJson(text);
  const turns = Array.isArray(value) ? eachAt({ value }, "turns", turnAt) : undefined;
  const repeats = turns !== undefined && "value" in turns ? repeatedIds(turns.value) : [];

  return value === undefined
    ? { problems: ["the input isn't JSON"] }
    : turns === undefined
      ? { problems: ["the input isn't a JSON list of turns"] }
      : repeats.length > 0
        ? { problems: repeats }
        : turns;
};

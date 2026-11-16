// Clickable answers to the kanban turn responses' Decide items: a band above
// the prompt that walks the open items one at a time, the same buttons on the
// row of the `kanban_options` tool the agent calls before its reply, and two
// ways to bring a dismissed band back: the 🧠 it leaves in its place, and the
// /answers command. A click writes the
// item's reference into the prompt draft and never sends it; Reassess alone
// sends a prompt, the skill's `reassess` command.
//
// An item is drawn as the skill writes it: its summary, its note, then each
// option as `glyph letter. name: consequence` with its ➕ and ➖ lines indented
// under it, inside a rounded border. Only the option the draft picks gets a
// background.

import { atom, read, update } from "claude-code";
import type { EngineInterface, Register } from "claude-code";

import { choose, lettersFor, noteFor, withNote } from "../src/answers.ts";
import {
  afterChoice,
  away,
  back,
  dismissed,
  drawnByTool,
  drawnMark,
  emptyBand,
  header,
  movedOn,
  nextPosition,
  prevPosition,
  progressMarks,
  refreshed,
  reopened,
  shownAt,
  shownItem,
  skipped,
} from "../src/band.ts";
import { glyphOf, itemsOf, refOf } from "../src/items.ts";
import { codeSpans, fitsBand } from "../src/layout.ts";
import { itemOfLink, linkedQuestions } from "../src/links.ts";
import type { Band, DecideItem } from "../types/index.d.ts";

const TOOL = "kanban_options";
const TOOL_CALLED = "mcp__coding-agent-kanban-answers__kanban_options";
const REASSESS = "reassess";
// The pane that holds the item, and its title.
const PANE = { id: "kanban-answers", title: "🧠 Decide" } as const;
const SCRIPT =
  "skills/coding-agent-kanban-turn-responses/scripts/outstanding.py";
// Hotkeys for the band's controls, pressed while the band holds the keys
// (ctrl+x tab or a click).
const KEYS = { prev: "h", skip: "j", next: "l", dismiss: "q" } as const;

// Theme colours, so each part keeps its contrast in light and dark themes.
const COLOR = {
  border: "promptBorder",
  title: "claude",
  code: "permission",
  chosen: "diffAddedWord",
} as const;
// Columns an option sits in from its summary, and its ➕ and ➖ lines from it.
const INDENT = 3;

// Change the tag when Band's fields change: it declines what an earlier
// version stored, which outlives a reload.
const band = atom(
  { plugin: "coding-agent-kanban-answers", key: "band" } as const,
  emptyBand,
  {
    shape: "band-2",
  },
);
const draft = atom(
  { plugin: "coding-agent-kanban-answers", key: "draft" } as const,
  "",
);

const ITEM_SCHEMA = {
  type: "object",
  required: ["turn", "number", "summary", "kind", "options"],
  properties: {
    turn: {
      type: "string",
      description:
        "The turn id, the first 8 characters of this turn's promptId.",
    },
    list: { type: "string", enum: ["Decide"] },
    number: {
      type: "integer",
      description: "The item number in the Decide list.",
    },
    summary: { type: "string", description: "The item's bold summary." },
    kind: { type: "string", enum: ["radio", "checkbox", "binary"] },
    ref: {
      type: "string",
      description: "`<turn>.Decide.<number>`; filled in when left out.",
    },
    options: {
      type: "array",
      items: {
        type: "object",
        required: ["letter", "name"],
        properties: {
          letter: {
            type: "string",
            description: "The capital letter, A, B, C, or Y and N.",
          },
          name: { type: "string", description: "The option's bold name." },
          consequence: {
            type: "string",
            description: "What follows the name after its colon.",
          },
          pros: {
            type: "array",
            items: { type: "string" },
            description: "The option's ➕ lines, without the ➕.",
          },
          cons: {
            type: "array",
            items: { type: "string" },
            description: "The option's ➖ lines, without the ➖.",
          },
        },
      },
    },
  },
} as const;

const TOOL_DESCRIPTION = [
  "Draws clickable buttons for this turn's Decide items in the transcript, just above the final response.",
  "Call it once, right before writing the final response, with every Decide item that response will hold, in the shape `outstanding.py decide --json` prints.",
  "A click writes the item's reference into the user's prompt draft; nothing is sent.",
].join(" ");

/**
 * The skill's `outstanding.py` in the repository this plugin was loaded from,
 * never an installed copy, which can lag behind the plugin.
 */
const scriptPath = async ($: EngineInterface): Promise<string | undefined> => {
  const repository = $.plugin.root.split("/").slice(0, -2).join("/");
  const path = `${repository}/${SCRIPT}`;

  return (await $.fs.exists(path)) ? path : undefined;
};

/** Runs `outstanding.py decide --json` over this session's transcript: the open items, or why there are none. */
const openItems = async (
  $: EngineInterface,
): Promise<{ items: readonly DecideItem[]; problem: string }> => {
  const cwd = await $.session.cwd();
  const session = await $.session.id();
  const script = await scriptPath($);

  if (script === undefined) {
    return {
      items: [],
      problem: `the plugin is not loaded from a coding-agent-skills checkout, so ${SCRIPT} is not beside it`,
    };
  }

  const ran = await $.process.run(
    ["python3", "-I", script, "--session", session, "decide", "--json"],
    { cwd, timeoutMs: 20_000 },
  );

  return ran.exitCode === 0
    ? { items: itemsOf(JSON.parse(ran.stdout || '{"items": []}')), problem: "" }
    : {
        items: [],
        problem:
          ran.stderr.trim().split("\n").at(-1) ?? "outstanding.py failed",
      };
};

const refresh = async ($: EngineInterface): Promise<void> => {
  const found = await openItems($).catch((error: unknown) => ({
    items: [] as readonly DecideItem[],
    problem: String(error),
  }));
  const text = await read($, draft);
  await update($, band, (b) => ({
    ...refreshed(b, found.items, text),
    problem: found.problem,
  }));
};

/**
 * Rewrites the prompt draft with `edit`, and moves the band with `move`
 * once the draft holds the edit: the one way a click or a note reaches the
 * draft.
 */
const rewriteDraft = async (
  $: EngineInterface,
  edit: (text: string) => string,
  move: (b: Band, text: string) => Band,
): Promise<void> => {
  const box = await $.prompt.read();
  const text = edit(box.text);
  await $.prompt.fill({ text, mode: "replace" });
  await update($, draft, () => text);
  await update($, band, (b) => move(b, text));
};

/** Writes the draft with the item's answer for `letter`, and moves the band on when it shows that item. */
const answer = ($: EngineInterface, item: DecideItem, letter: string) =>
  rewriteDraft(
    $,
    (text) => choose(text, item, letter),
    (b, text) => afterChoice(b, item, text),
  );

/** Writes the item's note into the draft, on a line of its own, and moves the band on as an answer does. */
const note = ($: EngineInterface, item: DecideItem, said: string) =>
  rewriteDraft(
    $,
    (text) => withNote(text, item, said),
    (b, text) => movedOn(b, item, text),
  );

/** /answers and the 🧠 above the prompt: re-reads the open items and shows them at the first unanswered one. */
const reopen = async ($: EngineInterface): Promise<void> => {
  await refresh($);
  const text = await read($, draft);
  await update($, band, (b) => reopened(b, text));
};

/** A question's link pressed: the band, shown again, at its item. */
const showItem = async ($: EngineInterface, href: string): Promise<void> => {
  const text = await read($, draft);
  await update($, band, (b) => shownAt(b, itemOfLink(b.items, href), text));
};

/** Opens the pane with the keyboard in it, so its hotkeys work at once. */
const openPane = ($: EngineInterface) => $.ui.open({ ...PANE, focus: true });

const isPaneShown = async ($: EngineInterface): Promise<boolean> =>
  (await $.ui.panes()).some((pane) => pane.id === PANE.id && pane.isShown);

/** ❌: puts the items away until a reply raises a new one, and closes the pane. */
const dismiss = async ($: EngineInterface): Promise<void> => {
  await update($, band, dismissed);
  await $.ui.close({ id: PANE.id });
};

/** A submitted prompt: folds the band and closes the pane until the reply ends. */
const stepAway = async ($: EngineInterface): Promise<void> => {
  await update($, band, away);
  await $.ui.close({ id: PANE.id });
};

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    const started = await next(e);
    await $.command.register({
      name: "answers",
      description:
        "Show the kanban Decide items again, at the first unanswered one",
    });
    await $.tool.register({
      name: TOOL,
      description: TOOL_DESCRIPTION,
      isDeferred: false,
      inputSchema: {
        type: "object",
        required: ["items"],
        properties: { items: { type: "array", items: ITEM_SCHEMA } },
      },
    });
    void refresh($);

    return started;
  });

  on("command.run", { command: "answers" }, async ($) => {
    await reopen($);
    await openPane($);
    const shown = await read($, band);

    return {
      text:
        shown.items.length === 0
          ? `No open Decide items${shown.problem ? `: ${shown.problem}` : ""}.`
          : `Decide pane opened: ${shown.items.length} open Decide items.`,
    };
  });

  on("tool.call", { tool: TOOL_CALLED }, async ($, e) => {
    const items = itemsOf(e);
    await update($, band, (b) => drawnByTool(b, items));

    return {
      result: `Drew buttons for ${items.length} Decide items above the final response: ${items
        .map(refOf)
        .join(", ")}.`,
    };
  }).catch(() => ({
    result: "The buttons could not be drawn; the reply reads as before.",
  }));

  on("turn.complete", async ($, e, next) => {
    const done = await next(e);

    if (e.agentId === undefined) {
      await refresh($);
      await update($, band, back);
    }

    return done;
  });

  // While the reply to a prompt runs, the band folds to its 🧠 and the pane
  // closes; the reply's end shows the band again if an item is still open.
  on("prompt.submit", async ($, e, next) => {
    const submitted = await next(e);

    if (submitted.drop === undefined) {
      await stepAway($);
    }

    return submitted;
  });

  on("prompt.change", async ($, e, next) => {
    const changed = await next(e);
    await update($, draft, () => e.text);

    return changed;
  });

  // Above the prompt: the item itself when every open item fits the band's
  // rows and the pane isn't showing them; else a 🧠 that brings them back,
  // and, for items too tall, a button that opens the pane. Drawing is pure,
  // so the band can't open the pane by itself.
  on("ui.render", { component: "AbovePrompt" }, async ($, e, next) => {
    const b = await read($, band);
    const item = shownItem(b);
    const seen = { rows: e.props.maxRows, columns: e.props.bodyColumns };

    if (e.props.hasSurvey || item === undefined) {
      return next(e);
    }

    const elements = $.ui.resolve(e);
    const { Box, Button, Text } = elements;
    const fits = fitsBand(b.items, seen);

    if (!b.isDismissed && !b.isAway && fits && !(await isPaneShown($))) {
      return fullView($, elements, b, item, await read($, draft));
    }

    return (
      <Box>
        <Button key="reopen" label="🧠" plain onPress={() => reopen($)} />
        <Text dimColor>
          {" "}
          {b.items.length} open{" "}
          {b.items.length === 1 ? "decision" : "decisions"}
          {fits ? "" : ", too tall for here "}
        </Text>
        {fits ? null : (
          <Button
            key="open-pane"
            label="Open in a pane"
            plain
            dimColor
            onPress={() => openPane($)}
          >
            🪟 <Text underline>Open in a pane</Text>
          </Button>
        )}
      </Box>
    );
  });

  // A reply's Decide questions: each open item's summary line becomes a link
  // that opens the band, or the pane when the band is folded, at that item.
  on("ui.render", { component: "AssistantMessage" }, async ($, e, next) => {
    const b = await read($, band);
    const linked = linkedQuestions(e.props.text, b.items);

    if (linked.hrefs.length === 0) {
      return next(e);
    }

    const { Markdown } = $.ui.resolve(e);

    return (
      <Markdown
        key="kanban-questions"
        text={linked.text}
        pressableLinks={linked.hrefs}
        onLinkPress={(link) => showItem($, link.href)}
      />
    );
  });

  // The pane: the controls on top, then the item, drawn in full.
  on("ui.render", { component: "Pane", requestId: PANE.id }, async ($, e) => {
    const b = await read($, band);
    const elements = $.ui.resolve(e);
    const item = shownItem(b);

    return item === undefined ? (
      <elements.Text dimColor>
        No open Decide items{b.problem ? `: ${b.problem}` : ""}.
      </elements.Text>
    ) : (
      fullView($, elements, b, item, await read($, draft))
    );
  });

  // Where the engine draws the result apart from the call's row, such as the
  // view after a compaction, the result line repeats the buttons: keep it for
  // ctrl+o and for an error only.
  on("ui.render", { component: "ToolResult" }, async ($, e, next) => {
    if (
      e.props.tool !== TOOL_CALLED ||
      e.props.isExpanded ||
      e.props.isErrored
    ) {
      return next(e);
    }
    const { Box } = $.ui.resolve(e);

    return <Box />;
  });

  on("ui.render", { component: "ToolUse" }, async ($, e, next) => {
    if (e.props.tool !== TOOL_CALLED) {
      return next(e);
    }

    // The engine's row prints the call's input JSON and its result line above
    // the buttons, which repeat both. Keep it only where it says more: ctrl+o,
    // an error, an interrupted call, or a call that drew no items.
    const items = itemsOf(e.props.input);
    const isPlain =
      !e.props.isExpanded &&
      !e.props.isErrored &&
      !e.props.isInterrupted &&
      items.length > 0;
    if (!isPlain) {
      return next(e);
    }
    const b = await read($, band);
    const text = await read($, draft);
    const { Box, Button, Text, Input } = $.ui.resolve(e);

    return (
      <Box flexDirection="column">
        {items.map((item) => {
          const isSettled = b.settledRefs.includes(refOf(item));

          return (
            <Box
              key={refOf(item)}
              flexDirection="column"
              borderStyle="round"
              borderColor={COLOR.border}
              borderDimColor={isSettled}
              paddingX={1}
            >
              {itemView({ Box, Button, Text, Input }, item, {
                title: `🧠 Decide.${item.number} · ${item.summary}${isSettled ? " (settled)" : ""}`,
                chosen: isSettled ? [] : lettersFor(text, item),
                note: isSettled ? "" : noteFor(text, item),
                isSettled,
                keyOf: (letter) => `${refOf(item)}.${letter}`,
                onPick: (letter) =>
                  isSettled ? undefined : answer($, item, letter),
                onNote: (said) => (isSettled ? undefined : note($, item, said)),
              })}
            </Box>
          );
        })}
      </Box>
    );
  });
};

/** The controls, then the shown item in full, in a rounded border: the band's and the pane's drawing alike. */
const fullView = (
  $: EngineInterface,
  elements: Elements,
  b: Band,
  item: DecideItem,
  text: string,
) => {
  const { Box, Button, Text, Input } = elements;
  const move = (position: (b: Band) => number) => () =>
    update($, band, (current) => ({
      ...current,
      position: position(current),
    }));
  // A control's emoji, then its word underlined, so it reads as a link.
  const control = (
    key: string,
    emoji: string,
    word: string,
    onPress: () => unknown,
    hotkey?: string,
  ) => (
    <Button
      key={key}
      label={word}
      plain
      dimColor
      {...(hotkey ? { hotkey } : {})}
      onPress={onPress}
    >
      {emoji} <Text underline>{word}</Text>
    </Button>
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={COLOR.border}
      paddingX={1}
    >
      <Box marginBottom={1} flexWrap="wrap" columnGap={2}>
        {control("prev", "⏪", "Prev", move(prevPosition), KEYS.prev)}
        {control(
          "skip",
          "⏭️",
          "Skip",
          move((current) => skipped(current, text)),
          KEYS.skip,
        )}
        {control("next", "⏩", "Next", move(nextPosition), KEYS.next)}
        {control("reassess", "🔄", "Reassess", async () => {
          // The plugin's own submit skips its `prompt.submit` hook.
          await $.prompt.submit({ text: REASSESS });
          await stepAway($);
        })}
        <Button
          key="dismiss"
          label="❌"
          plain
          dimColor
          role="dismiss"
          hotkey={KEYS.dismiss}
          onPress={() => dismiss($)}
        />
        <Box columnGap={1}>
          {progressMarks(b, text).map(({ mark, isShown }, n) => (
            <Button
              key={`mark-${n}`}
              plain
              dimColor={!isShown}
              onPress={move(() => n)}
            >
              <Text color={isShown ? COLOR.title : undefined} bold={isShown}>
                {drawnMark(mark, isShown)}
              </Text>
            </Button>
          ))}
        </Box>
      </Box>
      {itemView({ Box, Button, Text, Input }, item, {
        title: header(b),
        chosen: lettersFor(text, item),
        note: noteFor(text, item),
        keyOf: (letter) => `option-${letter}`,
        onPick: (letter) => answer($, item, letter),
        onNote: (said) => note($, item, said),
      })}
    </Box>
  );
};

/** The elements an item is drawn with, from the surface's table. */
type Elements = Pick<
  ReturnType<EngineInterface["ui"]["resolve"]>,
  "Box" | "Button" | "Text" | "Input"
>;

/**
 * One Decide item as the skill writes it: the title, the note, and each
 * option a plain button reading `glyph letter. name: consequence`, its ➕ and
 * ➖ lines indented under it, always in full.
 */
const itemView = (
  elements: Elements,
  item: DecideItem,
  view: {
    title: string;
    chosen: readonly string[];
    note: string;
    isSettled?: boolean;
    keyOf: (letter: string) => string;
    onPick: (letter: string) => unknown;
    onNote: (note: string) => unknown;
  },
) => {
  const { Box, Button, Input, Text } = elements;
  const dim = view.isSettled === true;
  const inline = (
    line: string,
    key: string,
    props: Record<string, unknown> = {},
  ) =>
    codeSpans(line).map((part, n) => (
      <Text
        key={`${key}-${n}`}
        {...props}
        {...(part.isCode ? { color: COLOR.code } : {})}
      >
        {part.text}
      </Text>
    ));
  const lines = (
    prefix: string,
    texts: readonly string[] | undefined,
    background: string | undefined,
    key: string,
  ) =>
    (texts ?? []).map((line, n) => (
      <Box key={`${key}-${n}`} marginLeft={INDENT}>
        <Text
          dimColor={dim}
          {...(background ? { backgroundColor: background } : {})}
          wrap="wrap"
        >
          {prefix ? `${prefix} ` : ""}
          {inline(line, `${key}-${n}`)}
        </Text>
      </Box>
    ));

  return (
    <Box flexDirection="column">
      <Text
        bold={!dim}
        dimColor={dim}
        color={dim ? undefined : COLOR.title}
        wrap="wrap"
      >
        {inline(view.title, "title")}
      </Text>
      {lines("", item.note, undefined, "note")}
      {item.options.map((option) => {
        const isChosen = view.chosen.includes(option.letter);
        const pick = isChosen ? { backgroundColor: COLOR.chosen } : {};
        const key = view.keyOf(option.letter);
        // A Button holds only text, so each of the option's lines is a button
        // of its own that picks it, and the lines light up together on hover.
        const press = {
          plain: true,
          dimColor: dim,
          hover: { scope: key, inverse: true },
          onPress: () => view.onPick(option.letter),
        } as const;
        const under = (
          prefix: string,
          texts: readonly string[] | undefined,
          part: string,
        ) =>
          (texts ?? []).map((line, n) => (
            <Box key={`${key}-${part}-${n}-box`} marginLeft={INDENT}>
              <Button key={`${key}-${part}-${n}`} label={line} {...press}>
                <Text {...pick}>{prefix ? `${prefix} ` : ""}</Text>
                {inline(line, `${key}-${part}-${n}`, pick)}
              </Button>
            </Box>
          ));

        return (
          <Box key={`${key}-box`} flexDirection="column" marginLeft={INDENT}>
            <Button key={key} label={option.name} {...press}>
              <Text {...pick}>
                {glyphOf(item, option.letter)} {option.letter}.{" "}
              </Text>
              {inline(option.name, `${option.letter}-name`, {
                ...pick,
                bold: true,
              })}
              {option.consequence ? <Text {...pick}>: </Text> : null}
              {option.consequence
                ? inline(option.consequence, `${option.letter}-then`, pick)
                : null}
            </Button>
            {under("➕", option.pros, "pro")}
            {under("➖", option.cons, "con")}
            {under("", option.notes, "note")}
          </Box>
        );
      })}
      {dim ? null : (
        <Box key={`${view.keyOf("notes")}-box`} marginLeft={INDENT}>
          <Input
            key={view.keyOf("notes")}
            label="✏️ "
            placeholder="Notes, or an answer in your own words"
            submitLabel="add to the draft"
            value={view.note}
            onSubmit={(said) => view.onNote(said)}
          />
        </Box>
      )}
    </Box>
  );
};

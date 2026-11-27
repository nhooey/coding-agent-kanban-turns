// How an item's text is laid out: the pane's fixed layout, `LAYOUT`, and an
// item's code spans. The cells a line's lead takes are src/text/cells.ts's.
// The marks a user may change are settings, in defaults/config.yaml's
// `marks`; the protocol's glyphs and separators are the spec's.

/**
 * The pane's fixed layout: its spacing, the border style and notes floor it
 * draws with, and the characters that part or frame its own lines. Widths,
 * gaps and padding are terminal cells; margins and the notes floor are rows.
 *
 * A value is fixed here, not a setting, when it shapes how the pane's lines
 * fit together rather than standing for something a user reads: changing it
 * would only shift the layout, or break it, as an indent narrower than the
 * gutter would. A value that stands for a state or a button, a mark such as
 * ✅ or 📤, is a setting under `marks`, which a user may redraw for their
 * terminal without changing what a line says. `divider` and `rule` are
 * fixed by the first test: they part or frame the pane's own text, as a
 * space does, and stand for no state or button. A separator the protocol
 * writes, such as the count line's, is the spec's.
 */
export const LAYOUT = {
  /** Columns an option sits in from its item's summary, and its ➕ and ➖ lines from the option. */
  indent: 3,
  /**
   * The column left of an option's lines that lights while the pointer is
   * over the option, or stays lit beside an answered option once its item
   * is Done: it comes out of the option's indent, so its text stays put.
   */
  gutter: 1,
  /**
   * The blank cells between the gutter and an option's mark, so the bar
   * stands apart from the mark; they come out of the indent with the
   * gutter.
   */
  gutterGap: 1,
  /** The cells between an item's label and its summary on its title line. */
  titleGap: 1,
  /** The cells between a label and the text after it, on a Done line or in the keys panel. */
  labelGap: 2,
  /** The cells either side of an item's text inside its border. */
  boxPadding: 1,
  /** The border an item's box is drawn with. */
  border: "round",
  /**
   * The rows left blank under the header and the keys panel, above each
   * turn's section but the first while items are open, and above the
   * footer.
   */
  blockGap: 1,
  /** The cells between the controls in the header and the footer, and between each row's two groups. */
  controlGap: 2,
  /**
   * The fewest rows the notes field is drawn, the one floor on the
   * `notes.rows` setting: a setting of fewer draws this many, and the
   * settings' check takes any number.
   */
  fewestNoteRows: 1,
  /**
   * What parts the pieces of the pane's own lines: a Done line's summary
   * from what made it Done, an answer's letters from its note, and the
   * footer's counts. The line above the prompt carries on the count line,
   * so it parts its pieces by the spec's `roll-up.count-separator` instead.
   */
  divider: " · ",
  /** What a turn's header sits between, `── 9efb08a1 ₋₃ ──`. */
  rule: "──",
} as const;

/** A line split at its backticks: even parts are prose, odd parts code. */
export const codeSpans = (
  line: string,
): readonly { text: string; isCode: boolean }[] =>
  line
    .split("`")
    .map((text, n) => ({
      text: text.replaceAll("**", ""),
      isCode: n % 2 === 1,
    }))
    .filter((part) => part.text !== "");

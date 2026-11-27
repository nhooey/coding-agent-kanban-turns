// The keys Claude Code itself gives a pane, which the plugin binds to no
// button of its own but names in the panel `? Keys` opens.

/** Each of the engine's keys for a pane, as the keys panel writes it. */
export const ENGINE_KEYS = {
  /** Moves the focus ring between the pane's buttons and fields. */
  move: "↑ ↓ tab",
  /** Presses the button the ring is on. */
  press: "enter",
  /** Gives the keyboard back to the prompt and, as the pane opens with `closeOnEscape`, closes it. */
  escape: "esc",
  /** Closes the pane, as the close mark in its frame's top right does. */
  close: "ctrl+x x",
} as const;

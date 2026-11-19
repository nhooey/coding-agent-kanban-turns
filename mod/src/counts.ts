// The line the band folds to: the kanban skill's count line, as
// `outstanding.py render --counts` prints it, such as
// `📌 Outstanding: 🚧 2 · 🤔 2 · 🔍 2 · 👉 2 · 🧠 3`, or the open Decide
// items counted when the script gives none. No `$`, no I/O: register.tsx
// runs the script and draws the line.

/** The argv that prints this session's count line. */
export const countsArgv = (
  python: string,
  script: string,
  session: string,
): readonly string[] => [
  python,
  "-I",
  script,
  "--session",
  session,
  "render",
  "--counts",
];

/** The count line a run printed: its first line that isn't blank, or none when the run failed. */
export const countsOf = (
  ran: Readonly<{ exitCode: number; stdout: string }>,
): string =>
  ran.exitCode === 0
    ? (ran.stdout
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line !== "") ?? "")
    : "";

/** The open Decide items counted, `🧠 3 open decisions`; empty with none open. */
export const openDecisions = (open: number): string =>
  open === 0 ? "" : `🧠 ${open} open ${open === 1 ? "decision" : "decisions"}`;

/** The folded line: the count line, or, when the script gave none, the open Decide items counted. */
export const foldedLine = (counts: string, open: number): string =>
  counts !== "" ? counts : openDecisions(open);

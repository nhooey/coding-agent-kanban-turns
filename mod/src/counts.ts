// The line above the prompt: the kanban skill's count line, as
// `outstanding.py render --counts` prints it, such as
// `📌 Outstanding: 🚧 2 · 🤔 2 · 🔍 2 · 👉 2 · 🧠 3`. No `$`, no I/O:
// register.tsx runs the script and draws the line.

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

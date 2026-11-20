// Neutral turns for the core's tests, built directly, with no harness's
// records between.

import type { Message, Owner, Turn } from "../../types/index.d.ts";

/** A message: the user's unless `owner` says otherwise, and no report unless `reportNames` names it. */
export const said = (
  text: string,
  owner: Owner = "user",
  reportNames: readonly string[] | undefined = undefined,
): Message => ({ owner, text, reportNames });

/** What a test may set on a turn: its prompt's owner and report names, and anything else a turn holds. */
type Fields = Partial<Omit<Turn, "id" | "prompt">> &
  Partial<Pick<Message, "owner" | "reportNames">>;

/** A turn with id `id` and prompt `prompt`: the user's, with no replies, Decide items or messages, unless `fields` says otherwise. */
export const turnOf = (
  id: string,
  prompt: string,
  { owner = "user", reportNames, ...rest }: Fields = {},
): Turn => ({
  id,
  prompt: said(prompt, owner, reportNames),
  replies: [],
  decide: [],
  messages: [],
  ...rest,
});

/** The turns, each with a blank id given one by its place. */
export const numbered = (turns: readonly Turn[]): readonly Turn[] =>
  turns.map((turn, n) =>
    turn.id === "" ? { ...turn, id: String(n).padStart(8, "0") } : turn,
  );

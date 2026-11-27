import { describe, test } from "node:test";
import { expect } from "expect";

import {
  isMergeKnown,
  mergedOfResponse,
  mergedQuery,
  pullRequestsOf,
} from "../../../src/artefacts/pull-requests.ts";
import { pullRequestsToAsk } from "../../../src/items/outstanding.ts";
import type { Turn } from "../../../types/index.d.ts";
import { REVIEW_REPLY } from "../../fixtures/review.ts";
import { turnOf } from "../../fixtures/turns.ts";

const FIRST = "9efb08a1";
const SECOND = "b2c3d4e5";
const WINDOW = 20;

/** One turn of the user's: its id, its prompt, and its replies. */
const turn = (id: string, text: string, ...replies: readonly string[]): Turn =>
  turnOf(id, text, { replies });

describe("a settled Review item", () => {
  const reviewed = () => [turn(FIRST, "go", REVIEW_REPLY), turn(SECOND, "more", "Prose.")];

  test("the pull requests an item names", () => {
    expect(pullRequestsOf(REVIEW_REPLY)).toEqual(["nhooey/kanban#21", "nhooey/kanban#22"]);
  });

  test("GitHub is asked about the Review items' pull requests, in one gh call", () => {
    const refs = pullRequestsToAsk(reviewed(), WINDOW);
    expect(refs).toEqual(["nhooey/kanban#21", "nhooey/kanban#22"]);
    const { ordered, argv } = mergedQuery(refs);
    expect(ordered).toEqual(refs);
    expect(argv.slice(0, 4)).toEqual(["gh", "api", "graphql", "-f"]);
    expect(argv[4]).toContain('pr0: repository(owner: "nhooey", name: "kanban") { pullRequest(number: 21)');
    expect(argv[4]).toContain("pr1: repository(owner: \"nhooey\", name: \"kanban\") { pullRequest(number: 22) { state } }");
    expect(argv.slice(5)).toEqual(["--hostname", "github.com"]);
  });

  test("the GraphQL response names the merged ones", () => {
    const ordered = ["nhooey/kanban#21", "nhooey/kanban#22", "nhooey/kanban#24"];
    const response = JSON.stringify({
      data: {
        pr0: { pullRequest: { state: "MERGED" } },
        pr1: { pullRequest: { state: "OPEN" } },
        pr2: null,
      },
    });
    expect([...mergedOfResponse(ordered, response)]).toEqual(["nhooey/kanban#21"]);
    for (const broken of ["", "not json", "[]", '{"data": null}']) {
      expect([...mergedOfResponse(ordered, broken)]).toEqual([]);
    }
  });

  test("the merges are known only where the response's data answers for every pull request asked", () => {
    const ordered = ["nhooey/kanban#21", "nhooey/kanban#22"];
    const answered = {
      pr0: { pullRequest: { state: "MERGED" } },
      pr1: { pullRequest: { state: "OPEN" } },
    };
    expect(isMergeKnown(ordered, JSON.stringify({ data: answered }))).toBe(true);
    expect(isMergeKnown(ordered, JSON.stringify({ data: { pr0: answered.pr0, pr1: null } }))).toBe(false);
    expect(
      isMergeKnown(ordered, JSON.stringify({ errors: [{ message: "Bad credentials" }] })),
    ).toBe(false);
    for (const broken of ["", "not json", "[]", '{"data": null}']) {
      expect(isMergeKnown(ordered, broken)).toBe(false);
    }
    expect(isMergeKnown([], "")).toBe(true);
  });
});

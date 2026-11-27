// Pull requests, which live outside the session: the reference an item
// names one by, the one `gh` call that asks which merged, and how its
// answer is read. No `$`, no I/O: the hooks run the call and hand its
// output here.

import { isObject, parsedJson } from "../json/fields.ts";

// A pull request an item names with its repository: a GitHub URL, or
// `owner/repo#N`. A bare `#N` names no repository, so it is never looked up.
// The host every pull request read here is on, as the URLs below match it;
// `gh` asks it whatever host its own settings default to.
const GITHUB_HOST = "github.com";
const PULL_URL =
  /https?:\/\/github\.com\/([\p{L}\p{N}_.-]+)\/([\p{L}\p{N}_.-]+)\/pull\/(\d+)/gu;
const PULL_REF =
  /(?<![\p{L}\p{N}_./-])([\p{L}\p{N}_.-]+)\/([\p{L}\p{N}_.-]+)#(\d+)(?![\p{L}\p{N}_])/gu;

/** Each pull request the text names with its repository, as `owner/repo#N`, lowercased, once each, sorted. */
export const pullRequestsOf = (text: string): readonly string[] =>
  [
    ...new Set(
      [...text.matchAll(PULL_URL), ...text.matchAll(PULL_REF)].map((m) =>
        `${m[1]}/${m[2]}#${m[3]}`.toLowerCase(),
      ),
    ),
  ].sort();

/** The one `gh api graphql` call that asks which of `refs` merged: its argument vector, and the refs in the order its `pr<n>` aliases name them. */
export const mergedQuery = (
  refs: readonly string[],
): Readonly<{ ordered: readonly string[]; argv: readonly string[] }> => {
  const ordered = [...new Set(refs)].sort();
  const query = ordered
    .map((ref, n) => {
      const [repo = "", number = ""] = ref.split("#");
      const [owner = "", name = ""] = repo.split("/");

      return `pr${n}: repository(owner: "${owner}", name: "${name}") { pullRequest(number: ${number}) { state } }`;
    })
    .join(" ");

  return {
    ordered,
    argv: [
      "gh",
      "api",
      "graphql",
      "-f",
      `query=query { ${query} }`,
      "--hostname",
      GITHUB_HOST,
    ],
  };
};

/** A GraphQL response's `data`, its answers by alias; none where the response is no JSON object or holds no `data`. */
const dataOf = (response: string): Readonly<Record<string, unknown>> => {
  const body = parsedJson(response);

  return isObject(body) && isObject(body.data) ? body.data : {};
};

/**
 * Whether a GraphQL response, aliased `pr<n>` after each pull request's
 * place in `ordered`, says which of them merged: its `data` holds an entry
 * for every one. A `gh` that failed, timed out or answered with errors
 * alone leaves the merges unknown; nothing asked leaves nothing unknown.
 */
export const isMergeKnown = (
  ordered: readonly string[],
  response: string,
): boolean => {
  const data = dataOf(response);

  return ordered.every((_, n) => isObject(data[`pr${n}`]));
};

/**
 * The pull requests a GraphQL response, aliased `pr<n>` after their place in
 * `ordered`, reports merged; none where the response is no JSON object. A
 * GraphQL error, such as one pull request that doesn't exist, exits non-zero
 * but still answers for the others.
 */
export const mergedOfResponse = (
  ordered: readonly string[],
  response: string,
): ReadonlySet<string> => {
  const data = dataOf(response);
  const stateOf = (key: string): unknown => {
    const value = data[key];
    const pull = isObject(value) ? value.pullRequest : undefined;

    return isObject(pull) ? pull.state : undefined;
  };

  return new Set(ordered.filter((_, n) => stateOf(`pr${n}`) === "MERGED"));
};

// The part of vendor/jsonc-parser.js that src/config.ts calls: the
// `jsonc-parser` package, bundled into one ES module by the flake
// (nix/bundle-vendor.sh), which the dev shell lays here. Self-contained, as
// the built plugin carries no node_modules to resolve the package's own types
// from; test/vendor-types.ts holds these to the package's own.

/** What the parser couldn't read, by its code, and where. */
export interface ParseError {
  error: number;
  offset: number;
  length: number;
}

/** What the parser lets through. */
export interface ParseOptions {
  disallowComments?: boolean;
  allowTrailingComma?: boolean;
  allowEmptyContent?: boolean;
}

/** The value of JSON with comments, each error put into `errors`. */
export declare function parse(
  text: string,
  errors?: ParseError[],
  options?: ParseOptions,
): unknown;

/** An error code's name, such as `CommaExpected`. */
export declare function printParseErrorCode(code: number): string;

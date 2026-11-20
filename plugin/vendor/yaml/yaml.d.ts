// The part of vendor/yaml/yaml.js that src/config/config.ts calls: the `yaml`
// package, bundled into one ES module by the flake
// (nix/scripts/vendor/bundle.sh), which the dev shell lays here.
// Self-contained, as the built plugin carries no node_modules to resolve the
// package's own types from; test/types/vendor-types.ts holds these to the
// package's own.

/** An error or warning the parser found: its message says where. */
export interface YAMLError {
  readonly message: string;
}

/** One document of a YAML stream. */
export interface ParsedDocument {
  readonly errors: readonly YAMLError[];
  readonly warnings: readonly YAMLError[];
  /** The document's value as plain data. */
  toJS(): unknown;
}

/** The options src/config/config.ts reads with. */
export interface Options {
  readonly version?: "1.1" | "1.2" | "next";
  readonly schema?: string;
  readonly strict?: boolean;
  readonly uniqueKeys?: boolean;
  readonly merge?: boolean;
  readonly stringKeys?: boolean;
  readonly resolveKnownTags?: boolean;
  readonly prettyErrors?: boolean;
  readonly logLevel?: "silent" | "error" | "warn" | "debug";
}

/**
 * Every document of a stream. A stream with none still carries what its
 * directives and markers got wrong, such as an unknown `%YAML` version.
 */
export type ParsedStream = readonly ParsedDocument[] &
  Readonly<{
    errors?: readonly YAMLError[];
    warnings?: readonly YAMLError[];
  }>;

/** Every document in `source`, each with its errors and warnings. */
export declare function parseAllDocuments(
  source: string,
  options?: Options,
): ParsedStream;

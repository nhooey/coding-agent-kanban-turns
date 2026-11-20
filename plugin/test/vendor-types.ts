// The types vendor/ declares for its bundled parsers, held to the packages'
// own: each function the core calls is the package's, so `npm run
// typecheck` fails where the two drift apart. Types only; nothing runs.

import type * as JsoncPackage from "jsonc-parser";
import type * as YamlPackage from "yaml";

import type * as Jsonc from "../vendor/jsonc-parser.js";
import type * as Yaml from "../vendor/yaml.js";

/** `Package`, which only type-checks where it fits where `Declared` is asked for. */
type Fits<Package extends Declared, Declared> = Package;

export type YamlFits = Fits<
  typeof YamlPackage.parseAllDocuments,
  typeof Yaml.parseAllDocuments
>;
export type JsoncParseFits = Fits<typeof JsoncPackage.parse, typeof Jsonc.parse>;
export type JsoncPrintFits = Fits<
  typeof JsoncPackage.printParseErrorCode,
  typeof Jsonc.printParseErrorCode
>;

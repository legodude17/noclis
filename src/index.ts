import CLI from "./CLI.js";
import CLIBuilder from "./CLIBuilder.js";

/**
 * Create a CLI app.
 * @public
 */
export default function createCLI<
  C extends string,
  O extends object,
  A extends object
>(builder: (cli: CLIBuilder) => CLIBuilder<C, O, A>) {
  return new CLI(builder(new CLIBuilder()));
}

export type { default as CLIBuilder } from "./CLIBuilder.js";
export type { default as ArgumentBuilder } from "./ArgumentBuilder.js";
export type { default as CommandBuilder } from "./CommandBuilder.js";
export type { default as OptionBuilder } from "./OptionBuilder.js";
export type { OptionType } from "./types.js";

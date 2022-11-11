/**
 * A CLI framework.
 *
 * @remarks
 * The main export here ({@link createCLI}) takes a builder and returns an app,
 * which is then used to define how your CLI reacts to commands, and eventually run it.
 *
 * @example
 * A simple example
 * ```
 * const cli = createCLI(cli => cli.command(c => c.name("run")));
 *
 * cli.on("run", () => console.log("Ran!"));
 *
 * cli.run();
 * ```
 *
 * @packageDocumentation
 */
import CLI from "./CLI.js";
import CLIBuilder from "./CLIBuilder.js";

/**
 * Create a CLI app.
 *
 * @param builder - A function to build your CLI scheme, takes and returns a {@link CLIBuilder}.
 *
 * @example
 * ```
 * createCLI(cli => cli.command(...).command(...).config({...}));
 * ```
 *
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
export type { default as CLI } from "./CLI.js";
export type { default as App } from "./App.js";
export type {
  OptionType,
  Argument,
  Option,
  Command,
  PromptOption,
  OptionTypes,
  ParseSpec
} from "./types.js";
export { default as _defaultTypeMap } from "./optionTypes.js";
export type { CLIConfig } from "./CLIConfig.js";

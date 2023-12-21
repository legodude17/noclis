import type { Promisable } from "type-fest";
import type { Option, OptionType, OptionTypes } from "./types.js";
import type { PromptOptions } from "./prompt/types.js";

/**
 * Builds a `--` option
 * @public
 */
export default class OptionBuilder<N extends string = never, T = boolean> {
  #item: Option;

  /**
   * Create a builder
   * @internal
   */
  constructor(item: Partial<Option>) {
    this.#item = {
      name: "",
      type: "boolean",
      array: false,
      required: false,
      choices: [],
      alias: [],
      config: true,
      cli: true,
      help: true
    };
    Object.assign(this.#item, item ?? {});
  }

  /**
   * Create an Option object from this builder
   * @internal
   */
  create(): Option {
    return Object.assign({}, this.#item);
  }

  /**
   * Set the name of this option
   *
   * @public
   */
  name<Name extends string>(name: Name): OptionBuilder<Name, T> {
    this.#item.name = name;
    return this;
  }

  /**
   * Set the description of this option
   *
   * @public
   */
  desc(desc: string) {
    this.#item.description = desc;
    return this;
  }
  /**
   * Set the description of this option
   *
   * @public
   */
  describe(describe: string) {
    this.#item.description = describe;
    return this;
  }
  /**
   * Set the description of this option
   *
   * @public
   */
  description(description: string) {
    this.#item.description = description;
    return this;
  }

  /**
   * Set the other names this option can be provided by.
   *
   * @remarks
   * If this option's {@link "type"} is set to `"boolean"` and one of these is a single letter,
   * then it will automatically be interpreted as a flag.
   *
   * @example
   * For example:
   * ```
   * (...).alias("a").type("boolean");
   * (...).alias("b").type("boolean");
   * ```
   * Will allow the user of your CLI to provide `-ab` and set both to true.
   *
   * @public
   */
  alias(...alias: string[]) {
    this.#item.alias = [...this.#item.alias, ...alias];
    return this;
  }

  /**
   * Set the valid choices for this option
   *
   * @public
   */
  choices(...choices: T[]) {
    this.#item.choices = [...this.#item.choices, ...choices];
    return this;
  }

  /**
   * Set if this option is interpreted as an array or not
   *
   * @public
   */
  array(): OptionBuilder<N, T extends unknown[] ? T : T[]>;
  array(array: true): OptionBuilder<N, T extends unknown[] ? T : T[]>;
  array(array: false): OptionBuilder<N, T extends Array<infer U> ? U : T>;
  array(array = true): OptionBuilder<N, unknown> {
    this.#item.array = array ?? true;
    return this;
  }

  /**
   * Set if this option is required or not
   *
   * @public
   */
  required(req = true) {
    this.#item.required = req;
    return this;
  }

  /**
   * Set the type of this option.
   * Accepts either a {@link OptionType} or a function that converts a string
   *
   * @public
   */
  type<Type>(
    convert: (str: string) => Promisable<Type>
  ): OptionBuilder<N, T extends unknown[] ? Type[] : Type>;
  type<Type extends OptionType>(
    type: Type
  ): OptionBuilder<
    N,
    T extends unknown[] ? OptionTypes[Type][] : OptionTypes[Type]
  >;
  type(
    type: OptionType | ((str: string) => Promisable<unknown>)
  ): OptionBuilder<N, unknown> {
    this.#item.type = type;
    return this;
  }

  /**
   * Set the default value for this option if not provided.
   *
   * @public
   */
  default(val: T | ((arg: Record<string, unknown>) => T)) {
    this.#item.default = val;
    return this;
  }

  /**
   * Shortcut to set {@link OptionBuilder.cli}, {@link OptionBuilder.config}, and {@link OptionBuilder.help} at once.
   *
   * @beta
   */
  where(cli = true, config = true, help = true) {
    this.#item.cli = cli;
    this.#item.config = config;
    this.#item.help = help;
    return this;
  }

  /**
   * Set if this option can be provided in the cli.
   *
   * @public
   */
  cli(val = true) {
    this.#item.cli = val;
    return this;
  }

  /**
   * Set if this option can be provided in config files.
   *
   * @public
   */
  config(val = true) {
    this.#item.config = val;
    return this;
  }

  /**
   * Set if this option will appear in help messages.
   *
   * @public
   */
  help(val = true) {
    this.#item.help = val;
    return this;
  }

  /**
   * Set the prompt for this option. If it is not provided and interactive mode is set,
   * then noclis will prompt the user for the option with this prompt.
   *
   * @public
   */
  prompt(prompt?: PromptOptions) {
    this.#item.prompt = prompt;
    return this;
  }
}

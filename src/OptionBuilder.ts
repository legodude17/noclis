import type { Promisable } from "type-fest";
import type { Option, OptionType, OptionTypes, PromptOption } from "./types.js";

/**
 * Builds a `--` option
 * @public
 */
export default class OptionBuilder<N extends string = never, T = boolean> {
  #item: Option;

  /* @internal */
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

  /* @internal */
  create(): Option {
    return Object.assign({}, this.#item);
  }

  name<Name extends string>(name: Name): OptionBuilder<Name, T> {
    this.#item.name = name;
    return this;
  }

  desc(desc: string) {
    this.#item.description = desc;
    return this;
  }
  describe(describe: string) {
    this.#item.description = describe;
    return this;
  }
  description(description: string) {
    this.#item.description = description;
    return this;
  }

  alias(...alias: string[]) {
    this.#item.alias = [...this.#item.alias, ...alias];
    return this;
  }

  choices(...choices: T[]) {
    this.#item.choices = [...this.#item.choices, ...choices];
    return this;
  }

  array(): OptionBuilder<N, T extends unknown[] ? T : T[]>;
  array(array: true): OptionBuilder<N, T extends unknown[] ? T : T[]>;
  array(array: false): OptionBuilder<N, T extends Array<infer U> ? U : T>;
  array(array = true): OptionBuilder<N, unknown> {
    this.#item.array = array ?? true;
    return this;
  }

  required(req = true) {
    this.#item.required = req;
    return this;
  }

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

  default(val: T) {
    this.#item.default = val;
    return this;
  }

  where(cli = true, config = true, help = true) {
    this.#item.cli = cli;
    this.#item.config = config;
    this.#item.help = help;
    return this;
  }

  cli(val = true) {
    this.#item.cli = val;
    return this;
  }

  config(val = true) {
    this.#item.config = val;
    return this;
  }

  help(val = true) {
    this.#item.help = val;
    return this;
  }

  prompt(prompt?: PromptOption) {
    this.#item.prompt = prompt;
    return this;
  }
}

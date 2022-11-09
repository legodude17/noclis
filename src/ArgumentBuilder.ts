import type { Promisable } from "type-fest";
import type {
  Argument,
  OptionType,
  OptionTypes,
  PromptOption
} from "./types.js";

/**
 * Builds a positional argument
 * @public
 */
export default class ArgumentBuilder<N extends string = never, T = boolean> {
  #item: Argument;

  /* @internal */
  constructor(item: Partial<Argument>) {
    this.#item = {
      name: "",
      type: "boolean",
      array: false,
      required: false,
      choices: []
    };
    Object.assign(this.#item, item);
  }

  /* @internal */
  create(): Argument {
    return Object.assign({}, this.#item);
  }

  name<Name extends string>(name: Name): ArgumentBuilder<Name, T> {
    return new ArgumentBuilder(Object.assign(this.#item, { name }));
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

  type<Type>(
    convert: (str: string) => Promisable<Type>
  ): ArgumentBuilder<N, T extends unknown[] ? Type[] : Type>;
  type<Type extends OptionType>(
    type: Type
  ): ArgumentBuilder<
    N,
    T extends unknown[] ? OptionTypes[Type][] : OptionTypes[Type]
  >;
  type(
    type: OptionType | ((str: string) => Promisable<unknown>)
  ): ArgumentBuilder<N, unknown> {
    this.#item.type = type;
    return this;
  }

  choices(...choices: T[]) {
    this.#item.choices = [...this.#item.choices, ...choices];
    return this;
  }

  required(required = true) {
    this.#item.required = required;
    return this;
  }

  array(): ArgumentBuilder<N, T extends unknown[] ? T : T[]>;
  array(array: true): ArgumentBuilder<N, T extends unknown[] ? T : T[]>;
  array(array: false): ArgumentBuilder<N, T extends Array<infer U> ? U : T>;
  array(array = true): ArgumentBuilder<N, unknown> {
    this.#item.array = array;
    return this;
  }

  min(min: number) {
    this.#item.min = min;
    return this;
  }

  max(max: number) {
    this.#item.max = max;
    return this;
  }

  order(order: number) {
    this.#item.order = order;
    return this;
  }

  default(val: T) {
    this.#item.default = val;
    return this;
  }

  prompt(prompt?: PromptOption) {
    this.#item.prompt = prompt;
    return this;
  }
}

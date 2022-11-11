import type { Except, Promisable } from "type-fest";
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

  /**
   * Create a builder
   *
   * @param item - An base to start from
   *
   * @internal
   */
  constructor(item: Partial<Argument> = {}) {
    this.#item = {
      name: "",
      type: "boolean",
      array: false,
      required: false,
      choices: []
    };
    Object.assign(this.#item, item);
  }

  /**
   * Create an Argument from this builder
   *
   * @internal
   */
  create(): Argument {
    return Object.assign({}, this.#item);
  }

  /**
   * Set the name of this argument
   *
   * @public
   */
  name<Name extends string>(name: Name): ArgumentBuilder<Name, T> {
    return new ArgumentBuilder(Object.assign(this.#item, { name }));
  }

  /**
   * Set the description of this argument
   *
   * @public
   */
  desc(desc: string) {
    this.#item.description = desc;
    return this;
  }
  /**
   * Set the description of this argument
   *
   * @public
   */
  describe(describe: string) {
    this.#item.description = describe;
    return this;
  }
  /**
   * Set the description of this argument
   *
   * @public
   */
  description(description: string) {
    this.#item.description = description;
    return this;
  }

  /**
   * Set the type of this argument.
   * Accepts either a {@link OptionType} or a function that converts a string
   *
   * @public
   */
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

  /**
   * Set the valid choices for this argument.
   *
   * @public
   */
  choices(...choices: T[]) {
    this.#item.choices = [...this.#item.choices, ...choices];
    return this;
  }

  /**
   * Set if this argument is required or not
   *
   * @public
   */
  required(required = true) {
    this.#item.required = required;
    return this;
  }

  /**
   * Set if this argument is interpreted as an array or not
   *
   * @public
   */
  array(): ArgumentBuilder<N, T extends unknown[] ? T : T[]>;
  array(array: true): ArgumentBuilder<N, T extends unknown[] ? T : T[]>;
  array(array: false): ArgumentBuilder<N, T extends Array<infer U> ? U : T>;
  array(array = true): ArgumentBuilder<N, unknown> {
    this.#item.array = array;
    return this;
  }

  /**
   * Sets the minimum number of values that can be provided
   *
   * @remarks
   * Only applicable if this argument is in array mode
   *
   * @public
   */
  min(min: number) {
    this.#item.min = min;
    return this;
  }

  /**
   * Sets the maximum number of values that can be provided
   *
   * @remarks
   * Only applicable if this argument is in array mode
   *
   * @public
   */
  max(max: number) {
    this.#item.max = max;
    return this;
  }

  /**
   * Sets the order of this argument. Arguments with higher order are first. Default if not set is 0.
   *
   * @remarks
   * This determines which argument is expected first when invoking the CLI.
   * While the parser will attempt to determine which are provided based on types,
   * it is better to have an intelligent ordering on creation.
   *
   * @public
   */
  order(order: number) {
    this.#item.order = order;
    return this;
  }

  /**
   * Set the default value for this argument if not provided.
   *
   * @public
   */
  default(val: T) {
    this.#item.default = val;
    return this;
  }

  /**
   * Set the prompt for this argument. If it is not provided and interactive mode is set,
   * then noclis will prompt the user for the argument with this prompt.
   *
   * @remarks
   * {@link PromptOption.name} is not allowed, as that is set to the argument name automatically.
   *
   * @public
   */
  prompt(prompt?: Except<PromptOption, "name">) {
    this.#item.prompt = prompt;
    return this;
  }
}

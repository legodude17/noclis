import type { EmptyObject } from "type-fest";
import ArgumentBuilder from "./ArgumentBuilder.js";
import OptionBuilder from "./OptionBuilder.js";
import type { Command } from "./types.js";

/**
 * Builds a command
 * @public
 */
export default class CommandBuilder<
  N extends string = never,
  C extends string = never,
  O extends object = EmptyObject,
  A extends object = EmptyObject
> {
  #item: Command;

  /* @internal */
  constructor(item?: Partial<Command>) {
    this.#item = {
      name: "",
      description: "",
      children: [],
      options: [],
      alias: [],
      args: []
    };
    Object.assign(this.#item, item ?? {});
  }

  /* @internal */
  create(): Command {
    return Object.assign({}, this.#item);
  }

  name<Name extends string>(name: Name): CommandBuilder<Name, C, O, A> {
    return new CommandBuilder(Object.assign(this.#item, { name }));
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

  command<
    R extends string,
    CC extends string,
    CO extends object,
    CA extends object
  >(
    builder: (command: CommandBuilder) => CommandBuilder<R, CC, CO, CA>
  ): CommandBuilder<N, C | R | CC, O & CO, A & CA> {
    this.#item.children.push(builder(new CommandBuilder({})).create());
    return this;
  }

  option<Name extends string, Value>(
    builder: (option: OptionBuilder) => OptionBuilder<Name, Value>
  ): CommandBuilder<N, C, O & { [K in Name]: Value }, A> {
    this.#item.options.push(builder(new OptionBuilder({})).create());
    return this;
  }

  argument<Name extends string, Value>(
    builder: (argument: ArgumentBuilder) => ArgumentBuilder<Name, Value>
  ): CommandBuilder<N, C, O, A & { [K in Name]: Value }> {
    this.#item.args.push(builder(new ArgumentBuilder({})).create());
    return this;
  }
}

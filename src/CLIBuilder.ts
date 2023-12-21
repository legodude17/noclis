import type { Argument, Command, Option, ParseSpec } from "./types.js";
import type { EmptyObject } from "type-fest";
import CommandBuilder from "./CommandBuilder.js";
import OptionBuilder from "./OptionBuilder.js";
import ArgumentBuilder from "./ArgumentBuilder.js";
import { DEFAULT_CONFIG } from "./CLIConfig.js";
import type { CLIConfig } from "./CLIConfig.js";

/**
 * Main class for designing the shape of the CLI
 * @public
 */
export default class CLIBuilder<
  C extends string = never,
  O extends object = EmptyObject,
  A extends object = EmptyObject
> {
  #commands: Command[] = [];

  #options: Option[] = [];

  #arguments: Argument[] = [];

  #config: CLIConfig = Object.assign({}, DEFAULT_CONFIG);

  #frozen = false;

  /* @internal */
  get parseSpec(): ParseSpec {
    this.#frozen = true;
    return {
      commands: this.#commands,
      config: this.#config,
      options: this.#options,
      arguments: this.#arguments
    };
  }

  #assertUnfrozen(op: keyof this) {
    if (this.#frozen) {
      const match = String(this[op])
        .split("\n")[0]
        ?.match(
          /(?:function *[\w#]* *\(((?:[\w#]+,? *)*)\))|(?:\(?((?:[\w#]+,? *)*)\)? *=>)/
        );
      throw new Error(
        `Cannot run .${String(op)}(${
          match?.[1] ?? match?.[2] ?? ""
        }) while frozen`
      );
    }
  }

  /**
   * Create a new command
   *
   * @public
   */
  command<
    N extends string,
    CC extends string,
    CO extends object,
    CA extends object
  >(
    builder: (command: CommandBuilder) => CommandBuilder<N, CC, CO, CA>
  ): CLIBuilder<C | N | CC, O & CO, A & CA> {
    this.#assertUnfrozen("command");
    this.#commands.push(builder(new CommandBuilder({})).create());
    return this;
  }

  /**
   * Create a global option
   *
   * @public
   */
  option<Name extends string, Value>(
    builder: (option: OptionBuilder) => OptionBuilder<Name, Value>
  ): CLIBuilder<C, O & { [K in Name]: Value }, A> {
    this.#assertUnfrozen("option");
    this.#options.push(builder(new OptionBuilder({})).create());
    return this;
  }

  /**
   * Create a global argument
   *
   * @public
   */
  argument<Name extends string, Value>(
    builder: (argument: ArgumentBuilder) => ArgumentBuilder<Name, Value>
  ): CLIBuilder<C, O, A & { [K in Name]: Value }> {
    this.#assertUnfrozen("argument");
    this.#arguments.push(builder(new ArgumentBuilder({})).create());
    return this;
  }

  /**
   * Set or get configuration.
   *
   * @remarks
   * Invoking with no arguments will get the full config object.
   * Invoking with a single object will copy it shallowly onto the config.
   * Invoking with a single string will get that string from the config.
   * Invoking with a string and a value will set that string to that value.
   *
   * @public
   */
  config(): CLIConfig;
  config(object: Partial<CLIConfig>): this;
  config<Key extends keyof CLIConfig>(key: Key, value: CLIConfig[Key]): this;
  config<Key extends keyof CLIConfig>(key: Key): CLIConfig[Key];
  config(
    object?: Partial<CLIConfig> | keyof CLIConfig,
    value?: CLIConfig[keyof CLIConfig]
  ) {
    if (object == undefined) {
      return Object.assign({}, this.#config);
    } else if (typeof object === "object") {
      this.#assertUnfrozen("config");
      Object.assign(this.#config, object);
    } else if (value == undefined) {
      return this.#config[object];
    } else {
      this.#assertUnfrozen("config");
      Object.assign(this.#config, { [object]: value });
    }
    return this;
  }
}

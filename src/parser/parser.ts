import type {
  Argument,
  Argv,
  Command,
  Option,
  OptionType,
  ParseResult,
  ParseSpec
} from "../types.js";
import {
  CountError,
  DemandError,
  InvalidTypeError,
  NotFoundError,
  ParseError
} from "./errors.js";
import { normalizeArgv, tokenizeArgv } from "./tokenizer.js";
import typers from "../optionTypes.js";
import CLI from "../CLI.js";
import type { Promisable } from "type-fest";
import { camelcase } from "../util/strings.js";

export interface ParseState {
  commands: Command[];
  options: Option[];
  arguments: Argument[];
  commandPath: string[];
  sawDoubleDash: boolean;
  canGetCommands: boolean;
  argumentIndex: number;
  pos: number;
  arg: string;
  opt?: string;
  help: boolean;
}

const DEFAULT_STATE: ParseState = {
  commands: [],
  options: [],
  arguments: [],
  commandPath: [],
  sawDoubleDash: false,
  canGetCommands: true,
  argumentIndex: 0,
  pos: 0,
  arg: "",
  help: false
};

export default class Parser {
  argv: string[];
  spec: ParseSpec;
  #state: ParseState;
  #result: ParseResult<
    string,
    Record<string, unknown>,
    Record<string, unknown>
  >;

  constructor(spec: ParseSpec) {
    this.spec = spec;
    this.argv = [];
    this.#state = Object.assign({} as ParseState, DEFAULT_STATE);
    this.#result = {
      arguments: {},
      options: {},
      commandPath: [],
      help: false
    };
  }

  #makeParseError(message: string, offset = 0) {
    return new ParseError(
      message,
      this.argv.indexOf(this.#state.arg),
      this.argv,
      this.#state.pos + offset
    );
  }

  #updateState(arg: string) {
    this.#state.pos += this.#state.arg.length;
    this.#state.arg = arg;
  }

  #loadCommandData() {
    const command = this.#getCommand();
    this.#state.commands = [...(command?.children ?? this.spec.commands)];
    this.#state.options = [
      ...this.spec.options,
      ...(command?.options ?? [])
    ].filter(opt => opt.cli);
    this.#state.arguments = [...(command?.args ?? this.spec.arguments)];
  }

  #getCommand(): Command | undefined {
    if (this.#state.commandPath.length === 0) return;
    let i = 0;
    let command: Command | undefined;
    let commands: Command[] | undefined = [...this.spec.commands];
    do {
      const name = this.#state.commandPath[i];
      if (name === "help") return CLI.helpCommand;
      command = commands?.find(c => c.name === name);
      commands = command?.children;
    } while (++i < this.#state.commandPath.length && command && commands);
    return command;
  }

  #getItem(name: string, type: "option"): Option;
  #getItem(name: string, type: "command"): Command;
  #getItem(name: string, type: "option" | "command"): Option | Command {
    if (name === "h" || name === "help") {
      return type === "option" ? CLI.helpOption : CLI.helpCommand;
    }

    const items = this.#getItems(`${type}s`);
    const item = items.find((x: Command | Option) => {
      return (
        x.name === name ||
        x.name === camelcase(name) ||
        (x.alias?.includes(name) ?? false) ||
        (x.alias?.includes(camelcase(name)) ?? false)
      );
    });
    if (!item) throw new NotFoundError(type, name, this.#state);
    return item;
  }

  #hasItem(name: string, type: "option" | "command"): boolean {
    if (name === "h" || name === "help") return true;
    return this.#getItems(`${type}s`).some(
      (x: Command | Option) =>
        x.name === name || (x.alias?.includes(name) ?? false)
    );
  }

  #getItems(key: "options" | "commands"): (Option | Command)[] {
    return this.#state[key];
  }

  async #getVal(
    str: string,
    type: OptionType | ((str: string) => Promisable<unknown>)
  ): Promise<unknown> {
    return await (typeof type === "string"
      ? typers[type].coerce(str)
      : type(str));
  }

  async #processArgument(): Promise<void> {
    this.#state.canGetCommands = false;
    if (this.#state.help && this.#tryGetCommand()) return;
    let curArg = this.#state.arguments[this.#state.argumentIndex];
    if (!curArg) {
      if (this.#state.argumentIndex) {
        curArg = this.#state.arguments[this.#state.argumentIndex - 1]!;
        const value = this.#result.arguments[curArg.name];
        const error = Array.isArray(value)
          ? new CountError(
              "argument",
              curArg.name,
              value.length + 1,
              [curArg.min ?? 0, curArg.max ?? Number.POSITIVE_INFINITY],
              this.#state
            )
          : new CountError("argument", curArg.name, 2, [1, 1], this.#state);
        throw error;
      } else {
        throw this.#makeParseError("Unexpected argument", 1);
      }
    }
    if (await this.#verify(curArg, this.#state.arg)) {
      if (await this.#setArgument(curArg, this.#state.arg))
        this.#state.argumentIndex++;
    } else {
      this.#state.argumentIndex++;
      if (this.#state.argumentIndex > this.#state.arguments.length - 1) {
        throw new TypeError(`No argument can accept ${this.#state.arg}`);
      }
      return this.#processArgument();
    }
  }

  async #setOption(option: Option, value: string) {
    if (option.name === "help") {
      this.#result.help = true;
      this.#state.help = true;
    } else if (option.array) {
      const current = this.#result.options[option.name];
      this.#result.options[option.name] = [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ...(Array.isArray(current) ? current : []),
        ...(await Promise.all(
          value.split(/, /g).map(str => this.#getVal(str, option.type))
        ))
      ];
    } else {
      if (this.#result.options[option.name]) {
        throw new CountError("option", option.name, 2, [1, 1], this.#state);
      }
      this.#result.options[option.name] = await this.#getVal(
        value,
        option.type
      );
    }
  }

  async #setArgument(arg: Argument, value: string): Promise<boolean> {
    const val = await this.#getVal(value, arg.type);
    if (arg.array) {
      const current = this.#result.arguments[arg.name];
      const array = [
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        ...(Array.isArray(current) ? current : []),
        val
      ];
      this.#result.arguments[arg.name] = array;
      return array.length > arg.max!;
    } else {
      this.#result.arguments[arg.name] = val;
      return true;
    }
  }

  async #verify(obj: Option | Argument, value: string): Promise<boolean> {
    return (
      (typeof obj.type === "function" ||
        (await typers[obj.type].validate(value))) &&
      (obj.choices.length === 0 ||
        obj.choices.includes(await this.#getVal(value, obj.type)))
    );
  }

  async #processOpt() {
    if (this.#state.opt) {
      const option = this.#getItem(this.#state.opt, "option");
      if (option.type === "boolean") {
        await this.#setOption(option, "true");
      } else {
        throw this.#makeParseError(
          `Unexpected ${this.#state.arg ? "value" : "end of input"}`
        );
      }
      delete this.#state.opt;
    }
  }

  #tryGetCommand() {
    if (
      (this.#state.canGetCommands || this.#state.help) &&
      this.#hasItem(this.#state.arg, "command")
    ) {
      const command = this.#getItem(this.#state.arg, "command");
      if (command.name === "help") {
        this.#state.help = true;
        this.#result.help = true;
      } else {
        this.#state.commandPath.push(command.name);
      }
      if (!this.#state.help) this.#loadCommandData();
      return true;
    } else if (
      this.spec.config.requireCommand &&
      this.#state.commandPath.length === 0
    ) {
      throw new NotFoundError("command", this.#state.arg, this.#state);
    } else {
      return false;
    }
  }

  #verifyAll() {
    for (const arg of this.#state.arguments) {
      if (
        !this.#result.arguments[arg.name] &&
        (arg.required || (arg.min ?? 0) > 0)
      ) {
        throw new DemandError("argument", this.#state, arg.name);
      }
      if (arg.array) {
        const arr = this.#result.arguments[arg.name];
        if (!Array.isArray(arr))
          throw new InvalidTypeError(
            "argument",
            arg,
            arr?.toString() ?? "undefined",
            this.#state
          );
        const min = arg.min ?? 0;
        const max = arg.max ?? Number.POSITIVE_INFINITY;
        if (arr.length < min || arr.length > max) {
          throw new CountError(
            "argument",
            arg.name,
            arr.length,
            [min, max],
            this.#state
          );
        }
      }
    }
    for (const opt of this.#state.options) {
      if (!this.#result.options[opt.name] && opt.required) {
        throw new DemandError("option", this.#state, opt.name);
      }
    }
    if (
      this.spec.config.requireCommand &&
      this.#result.commandPath.length === 0
    ) {
      throw new DemandError("command", this.#state);
    }
  }

  async parse(argv: Argv) {
    this.argv = tokenizeArgv(normalizeArgv(argv).trim());
    this.#result = {
      commandPath: [],
      arguments: {},
      options: {},
      help: false
    };
    if (this.argv.length === 0) {
      if (this.spec.config.requireCommand)
        throw new DemandError("command", this.#state);
      return this.#result;
    }
    Object.assign(this.#state, DEFAULT_STATE);
    this.#loadCommandData();
    for (const arg of this.argv) {
      this.#updateState(arg);
      if (arg === "-") {
        const argument = this.#state.arguments[this.#state.argumentIndex];
        const option =
          this.#state.opt && this.#getItem(this.#state.opt, "option");
        if (option) {
          if (option.type === "stream") {
            await this.#setOption(option, arg);
            delete this.#state.opt;
          } else {
            throw this.#makeParseError("Unexpected token");
          }
        } else if (argument && argument.type === "stream") {
          if (await this.#setArgument(argument, arg))
            this.#state.argumentIndex++;
        } else {
          throw this.#makeParseError("Unexpected token");
        }

        this.#state.canGetCommands = false;
      } else if (this.spec.config.useDoubleDash && /^-{2,}$/.test(arg)) {
        await this.#processOpt();
        this.#state.sawDoubleDash = true;
        this.#state.canGetCommands = false;
        /*if (!this.spec.config.stripDoubleDash) {
          this.#processArgument();
        }*/
      } else if (!this.#state.sawDoubleDash && arg.startsWith("-")) {
        this.#state.canGetCommands = false;
        await this.#processOpt();
        const opt = arg.replace(/^-*/, "");
        if (arg.startsWith("--")) {
          if (arg.includes("=")) {
            const [key, value] = opt.split("=");
            if (!key) {
              throw this.#makeParseError("Unexpected token", 1);
            }
            if (!value) {
              throw this.#makeParseError(
                "Unexpected space",
                2 + key.length + 1
              );
            }
            const option = this.#getItem(key, "option");
            if (await this.#verify(option, value)) {
              await this.#setOption(option, value);
            } else {
              throw new InvalidTypeError("option", option, value, this.#state);
            }
          } else if (opt.startsWith(this.spec.config.noPrefix)) {
            let val = true;
            let str = opt;
            while (str.startsWith(this.spec.config.noPrefix)) {
              val = !val;
              str = str.slice(this.spec.config.noPrefix.length);
            }
            const option = this.#getItem(str, "option");
            if (option.type !== "boolean") {
              throw new TypeError(
                this.spec.config.noPrefix +
                  ' can only be applied to options of type "boolean"'
              );
            }
            await this.#setOption(option, val ? "true" : "false");
          } else {
            this.#state.opt = opt;
          }
        } else {
          for (const letter of opt) {
            const option = this.#getItem(letter, "option");
            if (option.type != "boolean") {
              throw new TypeError(`Flag ${opt} does have type "boolean".`);
            }
            await this.#setOption(option, "true");
          }
        }
      } else if (this.#state.opt) {
        const option = this.#getItem(this.#state.opt, "option");
        if (await this.#verify(option, arg)) {
          await this.#setOption(option, arg);
        } else if (option.type === "boolean") {
          this.#result.options[option.name] = true;
          await this.#processArgument();
        } else if (option.array && this.#result.options[option.name]) {
          delete this.#state.opt;
        } else {
          throw new InvalidTypeError("option", option, arg, this.#state);
        }
        if (!option.array) delete this.#state.opt;
      } else if (!this.#tryGetCommand()) {
        await this.#processArgument();
      }
    }
    this.#updateState("");
    await this.#processOpt();
    this.#result.commandPath = this.#state.commandPath;
    return this.#result;
  }

  verify(result: ParseResult) {
    this.#result = result as ParseResult<
      string,
      Record<string, unknown>,
      Record<string, unknown>
    >;
    this.#state.commandPath = this.#result.commandPath;
    this.#loadCommandData();
    return this.#verifyAll();
  }
}

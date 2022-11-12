import type CLIBuilder from "./CLIBuilder.js";
import type {
  Argv,
  Command,
  Handler,
  HandlerFunction,
  HandlerPath,
  Option,
  ParseResult,
  ParseSpec,
  PromptOption,
  Task
} from "./types.js";
import { oneline, stringify, usage } from "./usage.js";
import logger, { LogLevel } from "proc-log";
import App from "./App.js";
import supports from "supports-color";
import { extname, join } from "node:path";
import { homedir } from "node:os";
import type { ColorSupportLevel } from "chalk";
import type { Task as TaskC } from "./logging/Task.js";
import type { DemandError, NotFoundError } from "./parser/errors.js";
import { distance } from "fastest-levenshtein";
import { indent } from "./util/strings.js";
import ci from "@npmcli/ci-detect";
import typers from "./optionTypes.js";
import Parser from "./parser/parser.js";
import Enquirer from "enquirer";
import { readFile, writeFile } from "node:fs/promises";
import { cwd } from "node:process";

type AddOpts = {
  version: boolean;
  color: boolean;
  logLevel: LogLevel;
  colorLevel: ColorSupportLevel;
  logDir: string;
  maxLogsPerFile: number;
  maxLogFiles: number;
  interactive: boolean;
  ci: boolean;
  config: string;
  global: boolean;
};

type O<Oin extends object> = Oin & AddOpts;

function isIterable<T>(obj: object): obj is Iterable<T> {
  return typeof (obj as never)[Symbol.iterator] === "function";
}

function isAsyncIterable<T>(obj: object): obj is AsyncIterable<T> {
  return typeof (obj as never)[Symbol.asyncIterator] === "function";
}

function getCommmandOptions(commands: Command[]): Option[] {
  return [
    ...commands.flatMap(com => com.options),
    ...commands.flatMap(com => getCommmandOptions(com.children))
  ];
}

/**
 * A CLI
 *
 * @public
 */
export default class CLI<
  Cin extends string,
  Oin extends object,
  Ain extends object
> extends App {
  #builder: CLIBuilder<Cin, O<Oin>, Ain>;
  #handlers: Handler<Cin, Oin, Ain>[] = [];
  #parser: Parser;

  /**
   * Create a CLI
   *
   * @internal
   */
  constructor(builder: CLIBuilder<Cin, Oin, Ain>) {
    super(builder.config());
    this.#builder = builder
      .option(opt =>
        opt
          .name("version")
          .describe("Output version information")
          .alias("v")
          .type("boolean")
      )
      .option(opt =>
        opt
          .name("color")
          .describe("Allow using colors")
          .type("boolean")
          .default(supports.stderr !== false && supports.stdout !== false)
      )
      .option(opt =>
        opt
          .name("colorLevel")
          .describe(
            "Level of color to output.\n  0 = No Color\n  1 = 16 colors\n  2 = 256 colors\n  3 = 16 million colors (TrueColor)"
          )
          .type(
            (str: string): ColorSupportLevel =>
              Number.parseInt(str) as ColorSupportLevel
          )
          .choices(0, 1, 2, 3)
          .default(supports.stdout ? supports.stdout.level : 0)
      )
      .option(opt =>
        opt
          .name("logDir")
          .alias("logs")
          .describe("Directory to put logs in")
          .type("string")
          .default(join(homedir(), ".logs"))
          .help(false)
      )
      .option(opt =>
        opt
          .name("logLevel")
          .describe("Log level to use")
          .alias("level")
          .type((str: string): LogLevel => str as LogLevel)
          // eslint-disable-next-line import/no-named-as-default-member
          .choices(...logger.LEVELS)
          .default("notice")
      )
      .option(opt =>
        opt.name("maxLogsPerFile").type("number").default(50_000).help(false)
      )
      .option(opt =>
        opt.name("maxLogFiles").type("number").default(5).help(false)
      )
      .option(opt => opt.name("ci").type("boolean").default(!!ci()).help(false))
      .option(opt =>
        opt
          .name("interactive")
          .alias("i")
          .type("boolean")
          .default(false)
          .config(false)
      )
      .option(opt => opt.name("config").alias("c").type("path").default(""))
      .command(command =>
        command
          .name("config")
          .desc("Get or set configuration")
          .command(c =>
            c
              .name("get")
              .describe("Get a config option")
              .argument(arg =>
                arg
                  .name("name")
                  .desc("Name of the config option to get")
                  .type("string")
                  .required()
              )
          )
          .command(c =>
            c
              .name("set")
              .describe("Set a config option")
              .argument(arg =>
                arg
                  .name("name")
                  .desc("Config option to set")
                  .type("string")
                  .required()
              )
              .argument(arg =>
                arg
                  .name("value")
                  .desc("Value to set it to")
                  .type("string")
                  .required()
              )
              .option(opt =>
                opt
                  .name("global")
                  .alias("g")
                  .desc("Set global confiuration")
                  .type("boolean")
                  .default(false)
                  .config(false)
              )
          )
          .command(c =>
            c.name("list").alias("ls").describe("List configuration")
          )
          .command(c =>
            c
              .name("setup")
              .alias("set-all")
              .describe("Set configuration from flags or prompts")
              .option(opt =>
                opt
                  .name("global")
                  .alias("g")
                  .desc("Set global confiuration")
                  .type("boolean")
                  .default(false)
                  .config(false)
              )
          )
          .requireSubcommand()
      );
    this.#parser = new Parser(this.#builder.parseSpec);
  }

  /**
   * @internal
   */
  static get helpOption(): Option {
    return {
      name: "help",
      alias: ["h"],
      type: "boolean",
      description: "Output help information",
      default: false,
      array: false,
      choices: [],
      required: false,
      config: false,
      cli: true,
      help: true
    };
  }

  /**
   * @internal
   */
  static get helpCommand(): Command {
    return {
      name: "help",
      description: "Output help information",
      alias: [],
      children: [],
      options: [],
      args: [],
      requireSubcommand: false
    };
  }
  /**
   * @internal
   */
  get parseSpec(): ParseSpec {
    const spec = this.#builder.parseSpec;
    return {
      commands: [...spec.commands, CLI.helpCommand],
      options: [...spec.options, CLI.helpOption],
      arguments: [...spec.arguments],
      config: spec.config
    };
  }

  /**
   * Set a handler for a particalr path of commands.
   *
   * @param path - Path of commands. Either a single command or an array. Can use wildcards (`*` and `**`)
   * @param handler - Handler function. Return anything that can be run as a task, or nothing!
   *
   * @remarks
   * Path can either be:
   * 1. A single command. This will invoke the handler when that command is used,
   * passing the subcommand path to it's `path` parameter.
   * 2. A single star. This will match any one-level command, passing it to `path`.
   * 3. Two stars (`**`). This will match anything, passing it to `path`.
   * 4. An array of the above. Any command name will be matched and removed from
   * the passed path, single stars match a single level, and double stars match
   * any number of levels.
   *
   * Your hanlder function can return void, in which case execution will finish when
   * it's done. However, it can also return a task. This can be any of the following:
   * 1. An object with properties `name`, `key`, and `handler`, which will be a
   * task named `name` with key `key` and which will run `handler`. `handler` can
   * also return further tasks, which will be nested.
   * 2. A function, which will be run, and it's `displayName` or `name` will be used
   * as the task name. This function can also return further tasks, which will be
   * nested under it.
   * 3. An iterable of tasks, which will be run in series. This means you can use
   * a generator (`function *`)!
   * 4. An async iterable of tasks, which will be run in series. This means you
   * can use an async generator (`async function*`)!
   * 5. An array of tasks. The first level of the array will be run in series,
   * but the second level (if present) will be run concurrently.
   * Note: this also means you can specify concurrent runs for any given set of
   * tasks by wrapping them in another level of `[]`.
   *
   * @public
   */
  on(handler: HandlerFunction<Cin, Oin, Ain>): void;
  on(path: HandlerPath<Cin>, handler: HandlerFunction<Cin, Oin, Ain>): void;
  on(
    path: HandlerPath<Cin> | HandlerFunction<Cin, Oin, Ain>,
    handler?: HandlerFunction<Cin, Oin, Ain>
  ): void {
    if (typeof path === "function") {
      this.#handlers.push({ path: "**", handler: path });
    } else if (typeof handler === "function") {
      this.#handlers.push({ path, handler });
    }
  }

  /**
   * Run the CLI.
   *
   * @param argv - argv, will be parsed according to the builder. Defaults to
   * `process.argv.slice(2)`.
   *
   * @returns `true`, if execution completed successfully, `false` if not.
   * Errors are outputed directly to the user of your CLI.
   *
   * @public
   */
  async run(argv: Argv = process.argv.slice(2)): Promise<boolean> {
    let result: ParseResult<Cin, O<Oin>, Ain>,
      options: O<Oin>,
      cliOptions: Record<string, unknown>;
    const spec = [
      ...this.parseSpec.options,
      ...getCommmandOptions(this.parseSpec.commands)
    ];
    try {
      result = (await this.#parser.parse(argv)) as ParseResult<
        Cin,
        O<Oin>,
        Ain
      >;
      cliOptions = result.options;
      result.options = options = await this.config(result.options, spec);
      const args = [
        ...this.parseSpec.arguments,
        ...(this.parseSpec.commands.find(
          c => c.name === result.commandPath[result.commandPath.length - 1]
        )?.args ?? [])
      ];
      const argObj = result.arguments as Record<string, unknown>;
      if (options.interactive) {
        const prompts: PromptOption[] = [];
        const enquirer = new Enquirer(undefined, argObj);
        for (const arg of args) {
          if (arg.prompt && !argObj[arg.name]) {
            prompts.push(Object.assign({}, arg.prompt, { name: arg.name }));
          }
        }
        Object.assign(result.arguments, await enquirer.prompt(prompts));
      }
      for (const arg of args) {
        if (!argObj[arg.name])
          // @ts-expect-error Need to add prop
          result.arguments[arg.name] =
            arg.default ??
            (typeof arg.type === "string"
              ? typers[arg.type].default
              : arg.type(""));
      }
      if (!result.help) this.#parser.verify(result);
    } catch (error) {
      if (error instanceof Error) {
        const cli = this.#builder.config("name");
        switch (error.name) {
          case "ParseError": {
            console.error(`${cli}: ${error.toString()}`);
            return false;
          }
          case "CountError": {
            console.error(`${cli}: ${error.message}`);
            return false;
          }
          case "DemandError": {
            console.error(`${cli}: ${error.message}`);
            const err = error as DemandError;
            switch (err.type) {
              case "command": {
                console.error(indent("Possible commands:", 4));
                console.error(
                  indent(err.context.commands.map(c => c.name).join(", "), 8)
                );
                break;
              }
              case "argument":
              case "option": {
                console.error("Usage:");
                console.error(
                  indent(
                    oneline(
                      [cli, ...err.context.commandPath].join(" "),
                      "",
                      err.context.arguments,
                      err.context.options,
                      this.#builder.config()
                    ),
                    4
                  )
                );
                break;
              }
            }
            return false;
          }
          case "NotFoundError": {
            console.error(`${cli}: ${error.message}`);
            const err = error as NotFoundError;
            switch (err.type) {
              case "command": {
                const close = err.context.commands.filter(
                  cmd =>
                    distance(err.item, cmd.name) < err.item.length * 0.4 &&
                    cmd.name !== err.item
                );
                if (close.length === 1) {
                  const cmd = close[0]!;
                  console.error(`Did you mean ${cmd.name}?`);
                  console.error(
                    `    ${oneline(
                      [cli, ...err.context.commandPath].join(" "),
                      cmd.name,
                      cmd.args,
                      cmd.options,
                      this.#builder.config()
                    )}`
                  );
                } else if (close.length > 0) {
                  console.error("Did you mean one of these?");
                  for (const cmd of close) {
                    console.error(
                      `   ${cli} ${err.context.commandPath.join(" ")} ${
                        cmd.name
                      }${cmd.description ? `: ${cmd.description}` : ""}`
                    );
                  }
                } else {
                  console.error(
                    usage(this.parseSpec, this.#builder.config(), {
                      header: false,
                      doArgs: false,
                      doOptions: false
                    })
                  );
                }
                break;
              }
              case "argument":
              case "option": {
                console.error("Usage:");
                console.error(
                  indent(
                    oneline(
                      [cli, ...err.context.commandPath].join(" "),
                      "",
                      err.context.arguments,
                      err.context.options,
                      this.#builder.config()
                    ),
                    4
                  )
                );
                break;
              }
            }
            return false;
          }
          case "InvalidTypeError": {
            console.error(error.message);
            return false;
          }
          case "TypeError": {
            console.error(error.message);
            return false;
          }
        }
      }
      throw new TypeError("Unexpected throw while parsing", {
        cause: error
      });
    }
    if (result.options.color === false) {
      result.options.colorLevel = 0;
    }
    if (result.help) {
      const path = result.commandPath;
      if (path.length === 0) {
        console.error(usage(this.parseSpec, this.#builder.config()));
        return true;
      }
      const spec = this.#builder.parseSpec;
      let current: Command | undefined;
      // @ts-expect-error Doesn't recongize the filtering
      const commands: Command[] = path
        .map(
          p =>
            (current = (current?.children ?? spec.commands).find(
              v => v.name === p || v.alias.includes(p)
            ))
        )
        .filter(Boolean);
      if (commands.length !== path.length) {
        console.error(`Command not found: ${path.join(" ")}`);
        return false;
      }
      console.error(
        usage.command(
          commands.pop()!,
          this.#builder.config(),
          this.#builder.config("name") +
            " " +
            commands.map(c => c.name).join(" ")
        )
      );
      return true;
    }
    if (result.options.version) {
      const { name, version } = this.#builder.config();
      console.log(`${name} v${version}`);
      return true;
    }
    if (result.commandPath[0] === "config") {
      const setConfig = async (toSet: Record<string, unknown>) => {
        const cli = this.#builder.config("name");
        let file = `.${cli}rc.json`;
        if (options.config && extname(options.config) === ".json") {
          file = options.config;
        } else if (options.global) {
          file = join(homedir(), file);
        } else {
          file = join(cwd(), file);
        }
        let obj: Record<string, unknown>;
        try {
          obj = JSON.parse(await readFile(file, "utf8")) as Record<
            string,
            unknown
          >;
        } catch {
          obj = {};
        }
        this.log.info("Writing to ", file);
        Object.assign(obj, toSet);
        await writeFile(file, JSON.stringify(obj), "utf8");
      };
      switch (result.commandPath[1]) {
        case "get": {
          console.log(
            (result.options as Record<string, unknown>)[
              (result.arguments as { name: string }).name
            ]
          );
          break;
        }
        case "set": {
          const name = (result.arguments as { name: string }).name;
          const value = (result.arguments as { value: string }).value;
          const opt = spec.find(o => o.name === name);
          if (!opt) {
            console.error("Cannot find option", name);
            return false;
          }
          await setConfig({ [name]: value });
          break;
        }
        case "list": {
          for (const [key, value] of Object.entries(options)) {
            console.log(`${key} = ${stringify(value)}`);
          }
          break;
        }
        case "set-all":
        case "setup": {
          const prompts: PromptOption[] = [];
          const toSet: Record<string, unknown> = {};
          const enquirer = new Enquirer({
            ...result.arguments,
            ...result.options
          });
          for (const opt of spec) {
            if (opt.config) {
              toSet[opt.name] = cliOptions[opt.name];
              if (opt.prompt) {
                prompts.push(
                  Object.assign({ initial: toSet[opt.name] }, opt.prompt, {
                    name: opt.name
                  })
                );
              }
            }
          }
          Object.assign(toSet, await enquirer.prompt(prompts));
          await setConfig(toSet);
          break;
        }
        default: {
          return false;
        }
      }
      return true;
    }
    const runTask = async (
      task: Task<Oin, Ain>,
      parent?: TaskC
    ): Promise<void> => {
      if (!task) {
        return;
      } else if (typeof task === "function") {
        const taskObj =
          task.displayName || task.name
            ? parent
              ? parent.task(task.displayName ?? task.name)
              : this.task(task.displayName ?? task.name)
            : parent ?? this.task("");
        taskObj.start();
        await runTask(await task(taskObj, result.arguments, options), taskObj);
        taskObj.complete();
      } else if (Array.isArray(task)) {
        for (const inner of task) {
          await (Array.isArray(inner)
            ? Promise.all(
                (inner as Task<Oin, Ain>[]).map(i => runTask(i, parent))
              )
            : runTask(inner, parent));
        }
      } else if (isIterable(task)) {
        for (const inner of task) {
          await runTask(inner, parent);
        }
      } else if (isAsyncIterable(task)) {
        for await (const inner of task) {
          await runTask(inner, parent);
        }
      } else if (typeof task.handler === "function") {
        const taskObj = parent
          ? parent.task(task.name, task.key)
          : this.task(task.name, task.key);
        taskObj.start();
        await runTask(
          await task.handler(taskObj, result.arguments, options),
          taskObj
        );
        taskObj.complete();
      }
    };
    for (const handler of this.#handlers) {
      const resultPath: Cin[] = [];
      if (this.#checkPaths(handler.path, result.commandPath, resultPath)) {
        try {
          this.start();
          await runTask(
            await handler.handler(result.arguments, options, resultPath, this)
          );
          this.stop();
          return true;
        } catch (error) {
          console.error(error);
          return false;
        }
      }
    }
    console.error(`No handler found for: ${result.commandPath.join(" ")}`);
    return false;
  }

  #checkPaths(
    handler: HandlerPath<Cin>,
    command: Cin[],
    result: Cin[]
  ): boolean {
    if (Array.isArray(handler)) {
      for (const [i, element] of handler.entries()) {
        if (i >= command.length || element === "**") {
          result.push(...command.slice(i));
          return true;
        }
        if (element === "*") {
          result.push(command[i]!);
        }
        if (element !== command[i]) {
          break;
        }
      }
      return false;
    }
    if (handler === "**") {
      result.push(...command);
      return true;
    }
    if (handler === command[0]) {
      result.push(...command.slice(1));
      return true;
    }
    if (command.length === 1 && handler === "*") {
      result.push(command[0]!);
      return true;
    }
    return false;
  }
}
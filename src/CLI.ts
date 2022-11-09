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
import { oneline, usage } from "./usage.js";
import logger, { LogLevel } from "proc-log";
import App from "./App.js";
import supports from "supports-color";
import { join } from "node:path";
import { homedir } from "node:os";
import type { ColorSupportLevel } from "chalk";
import type { Task as TaskC } from "./logging/Task.js";
import type { NotFoundError } from "./parser/errors.js";
import { distance } from "fastest-levenshtein";
import { indent } from "./util/strings.js";
import ci from "@npmcli/ci-detect";
import enquirer from "enquirer";
import typers from "./optionTypes.js";
import Parser from "./parser/parser.js";

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

export default class CLI<
  Cin extends string,
  Oin extends object,
  Ain extends object
> extends App {
  #builder: CLIBuilder<Cin, O<Oin>, Ain>;
  #handlers: Handler<Cin, Oin, Ain>[] = [];
  #parser: Parser;

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
      );
    this.#parser = new Parser(this.#builder.parseSpec);
  }

  /** @internal */
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

  /** @internal */
  static get helpCommand(): Command {
    return {
      name: "help",
      description: "Output help information",
      alias: [],
      children: [],
      options: [],
      args: []
    };
  }

  get parseSpec(): ParseSpec {
    const spec = this.#builder.parseSpec;
    return {
      commands: [...spec.commands, CLI.helpCommand],
      options: [...spec.options, CLI.helpOption],
      arguments: [...spec.arguments],
      config: spec.config
    };
  }

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

  async run(argv: Argv = process.argv.slice(2)): Promise<boolean> {
    let result: ParseResult<Cin, O<Oin>, Ain>, options: O<Oin>;
    try {
      result = (await this.#parser.parse(argv)) as ParseResult<
        Cin,
        O<Oin>,
        Ain
      >;
      const spec = [
        ...this.parseSpec.options,
        ...getCommmandOptions(this.parseSpec.commands)
      ];
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
                    console.log(
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
              case "option": {
                console.error("Usage:");
                let current: Command | undefined;
                // @ts-expect-error Doesn't recongize the filtering
                const commands: Command[] = err.context.commandPath
                  .map(
                    p =>
                      (current = (
                        current?.children ?? this.parseSpec.commands
                      ).find(v => v.name === p || v.alias.includes(p)))
                  )
                  .filter(Boolean);
                console.error(
                  indent(
                    usage.command(
                      commands.pop()!,
                      this.#builder.config(),
                      this.#builder.config("name") +
                        " " +
                        commands.map(c => c.name).join(" ")
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
      console.log(
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

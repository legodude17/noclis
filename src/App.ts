import type { LogLevel, Logger } from "./logging/createLogger.js";
import Display from "./logging/Display.js";
import LogFile from "./logging/LogFile.js";
import loadConfig, { getDefaults, loadConfigFile } from "./config/config.js";
import type { Option } from "./types.js";
import { Task } from "./logging/Task.js";
import createLogger from "./logging/createLogger.js";
import type { CLIConfig } from "./CLIConfig.js";
import enquirer from "enquirer";

export interface AppOptions {
  color: boolean;
  logLevel: LogLevel;
  logDir: string;
  maxLogsPerFile: number;
  maxLogFiles: number;
  interactive: boolean;
  ci: boolean;
  config: string;
}

/**
 * The base CLI App class, handles logging and config.
 *
 * @public
 */
export default class App {
  #cliConfig: CLIConfig;
  #options?: AppOptions;
  #name: string;
  #display?: Display;
  #logFile?: LogFile;
  log: Logger;
  #running: boolean = false;

  /**
   * Create an APP
   *
   * @internal
   */
  constructor(config: CLIConfig) {
    this.#name = config.name;
    this.#cliConfig = config;
    this.log = createLogger(this.#name);
  }

  /**
   * Load config from files and CLI
   *
   * @param options - Options parsed from CLI.
   * @param spec - All possible options, used for loading config
   *
   * @internal
   */
  async config<O extends Record<string, unknown> & AppOptions>(
    options: O,
    spec: Option[],
    context: Record<string, unknown>
  ): Promise<O> {
    const result = options.config
      ? (Object.assign(
          getDefaults(spec, context),
          await loadConfigFile(options.config, this.#name, spec)
        ) as O)
      : await loadConfig<O>(this.#name, spec, context, options, {
          interactive: options.interactive
        });
    this.#options = result;
    this.#display = new Display(this.#name, {
      color: result.color,
      logLevel: result.logLevel,
      logFormat: this.#cliConfig.logFormat,
      progressFormat: this.#cliConfig.progressFormat,
      logLevels: this.#cliConfig.logLevels,
      interactive: result.interactive,
      term: !result.ci
    });
    this.#logFile = new LogFile(this.#options);
    return result;
  }

  /**
   * Begin intercepting logging and begin displaying
   *
   * @internal
   */
  start() {
    this.#display!.start();
    this.#logFile!.start().catch(this.#errorHandler.bind(this));
    this.#running = true;
  }

  /**
   * Stop intercepting logging and finish the display.
   *
   * @internal
   */
  stop() {
    this.#running = false;
    this.#logFile!.stop();
    this.#display!.stop();
  }

  /**
   * Create a new top-level {@link Task}
   *
   * @remarks
   * If you want a sub-task, use {@link Task.task}
   *
   * @public
   */
  task(name: string, key?: string) {
    return new Task(name, key ?? name);
  }

  /**
   * Name a function.
   * Function names are used for task names if no other option is available,
   * so this is provided for convenience.
   *
   * @public
   */
  // eslint-disable-next-line @typescript-eslint/ban-types
  name<T extends Function>(fn: T, name: string): T & { displayName: string } {
    const newFn = fn as T & { displayName: string };
    newFn.displayName = name;
    return newFn;
  }

  /**
   * Set the current task.
   * This is used to infer logging prefixes when it doesn't match a task.
   *
   * @internal
   */
  setCurTask(key?: string) {
    this.#display!.curLog = key;
  }

  #errorHandler(e: Error) {
    process.exitCode = 1;
    console.error(e);
  }

  /**
   * Run a prompt. Alias for {@link enquirer.prompt}.
   *
   * @public
   */
  async prompt(
    ...args: Parameters<typeof enquirer.prompt>
  ): ReturnType<typeof enquirer.prompt> {
    if (this.#options?.interactive) {
      if (this.#running) this.#display?.renderer.stop();
      const result = enquirer.prompt(...args);
      if (this.#running) this.#display?.renderer.start();
      return result;
    } else {
      const obj: Record<string, unknown> = {};
      const state = {};
      const enq = new enquirer(undefined, state);
      for (const p of args.flat()) {
        const promptObj = typeof p === "function" ? p.call(enq) : p;
        const name =
          typeof promptObj.name === "function"
            ? promptObj.name()
            : promptObj.name;
        const initial =
          typeof promptObj.initial === "function"
            ? await (promptObj.initial as (state: object) => unknown)(state)
            : (promptObj.initial as unknown);
        obj[name] = initial;
      }
      return obj;
    }
  }
}

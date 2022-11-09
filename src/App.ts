import type { LogLevel } from "proc-log";
import type { ColorSupportLevel } from "chalk";
import Display from "./logging/Display.js";
import LogFile from "./logging/LogFile.js";
import loadConfig from "./config/config.js";
import type { Option } from "./types.js";
import { Task } from "./logging/Task.js";
import createLogger, { Logger } from "./logging/createLogger.js";
import type { CLIConfig } from "./CLIConfig.js";
import enquirer from "enquirer";

export interface AppOptions {
  colorLevel: ColorSupportLevel;
  logLevel: LogLevel;
  logDir: string;
  maxLogsPerFile: number;
  maxLogFiles: number;
  interactive: boolean;
  ci: boolean;
}

export default class App {
  #cliConfig: CLIConfig;
  #options?: AppOptions;
  #name: string;
  #display?: Display;
  #logFile?: LogFile;
  log: Logger;

  constructor(config: CLIConfig) {
    this.#name = config.name;
    this.#cliConfig = config;
    this.log = createLogger(this.#name);
  }

  async config<O extends Record<string, unknown> & AppOptions>(
    options: O,
    spec: Option[]
  ): Promise<O> {
    const result = await loadConfig<O>(this.#name, spec, options, {
      interactive: options.interactive
    });
    this.#options = result;
    this.#display = new Display(this.#name, {
      colorLevel: result.colorLevel,
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

  start() {
    this.#display!.start();
    this.#logFile!.start().catch(this.#errorHandler.bind(this));
  }

  stop() {
    this.#logFile!.stop();
    this.#display!.stop();
  }

  task(name: string, key?: string) {
    return new Task(name, key ?? name);
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  name<T extends Function>(fn: T, name: string): T & { displayName: string } {
    const newFn = fn as T & { displayName: string };
    newFn.displayName = name;
    return newFn;
  }

  #errorHandler(e: Error) {
    process.exitCode = 1;
    console.error(e);
  }

  prompt(
    ...args: Parameters<typeof enquirer.prompt>
  ): ReturnType<typeof enquirer.prompt> {
    return enquirer.prompt(...args);
  }
}

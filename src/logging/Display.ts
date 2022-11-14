import { createClient, Client } from "proggy";
import type { LogLevel } from "proc-log";
import logger from "proc-log";
import util from "node:util";
import { createTask, TaskEvent, TaskInfo } from "./Task.js";
import { format } from "../util/time.js";
import figures, { replaceSymbols } from "figures";
import stripAnsi from "strip-ansi";
import chalk from "chalk";
import type { ColorSupportLevel } from "chalk";
import type { ProgressData } from "./progress.js";
import logUpdate from "log-update";
import render from "./render.js";

export interface DisplayOptions {
  colorLevel: ColorSupportLevel;
  logLevel: LogLevel;
  logFormat: string;
  logLevels: { [K in LogLevel]: string };
  progressFormat: string;
  interactive: boolean;
  term: boolean;
}

export default class Display {
  #client: Client;
  #allTasks: Map<string, TaskInfo> = new Map();
  #tasks: string[] = [];
  #progress: ProgressData[] = [];
  #options: DisplayOptions;
  #name: string;
  #ms = 0;
  #id?: ReturnType<typeof setInterval>;
  constructor(name: string, options: DisplayOptions) {
    this.#name = name;
    this.#options = options;
    this.#client = createClient();
    chalk.level = options.colorLevel;
  }

  start() {
    this.#client.start();
    process.on("log", this.#logHandler.bind(this));
    this.#client.on("progress", this.#progressHandler.bind(this));
    process.on("task", this.#taskHandler.bind(this));
    this.#id = setInterval(this.#render.bind(this), 10);
  }

  stop() {
    this.#client.stop();
    clearInterval(this.#id);
    this.#render();
    logUpdate.done();
  }

  get level() {
    return logger.LEVELS.indexOf(this.#options.logLevel);
  }

  #sanitize(str: string) {
    return replaceSymbols(stripAnsi(str));
  }

  #output(string: string, toTerm = true) {
    process.emit(
      // @ts-expect-error This binding is wrong
      "output",
      `${this.#name} ${this.#sanitize(string)}`
    );
    if (toTerm) process.stderr.write(string + "\n");
  }

  #render() {
    logUpdate(render(this.#tasks, this.#options, this.#ms, this.#allTasks));
    this.#ms += 10;
  }

  #logHandler(
    level: LogLevel,
    prefix: string,
    message: string,
    ...args: unknown[]
  ) {
    prefix = this.#sanitize(prefix);
    const shouldPrint = logger.LEVELS.indexOf(level) <= this.level;
    const l = this.#options.logLevels[level];
    const m = util.format(message, ...args);
    const context = {
      message
    };
    let log = this.#options.logFormat.replace(/{(\w+)}/g, (_, key: string) => {
      if (key.includes(".")) {
        const arr = key.split(".");
        if (arr.length === 2 && arr[0] === "figure")
          return figures[arr[1] as keyof typeof figures];
      }
      return context[key as keyof typeof context];
    });
    if (!this.#options.term) log = this.#sanitize(log);
    if (this.#allTasks.has(prefix)) {
      if (!this.#options.term) {
        this.#output(`${l} [${prefix}] ${log}`, shouldPrint);
      } else {
        this.#output(`${level.toUpperCase()} [${prefix}] ${m}`, false);
      }
      this.#getTask(prefix).messages.push(l + " " + log);
    } else {
      this.#output(`${l} [${prefix}] ${log}`, shouldPrint);
    }
  }

  #progressHandler(key: string, data: ProgressData) {
    const arr = data.parent
      ? this.#getTask(data.parent).progress
      : this.#progress;
    let idx = arr.findIndex(p => p.key === key);
    if (idx === -1) {
      idx = arr.length;
      arr.push(data);
    } else {
      arr[idx] = data;
    }
    this.#output(
      `${data.parent ? `[${data.parent}] ` : ""}${data.name}: ${
        data.actualValue
      } / ${data.actualTotal} ${data.done ? figures.tick : figures.circle}`,
      !this.#options.term
    );
  }

  #getTask(key: string) {
    const res = this.#allTasks.get(key);
    if (!res) throw new TypeError("No task with key " + key);
    return res;
  }

  #taskHandler(type: TaskEvent, key: string, ...args: unknown[]) {
    switch (type) {
      case "create": {
        if (this.#allTasks.has(key))
          throw new TypeError("Duplicate task of key " + key);
        const parent = args[1] as string | undefined;
        if (parent) {
          this.#getTask(parent).subtasks.push(key);
        } else this.#tasks.push(key);
        const task = createTask(args[0] as string, key);
        task.parent = parent;
        this.#allTasks.set(key, task);
        this.#output(
          `[${task.parent ?? this.#name}] ${type} ${task.name}`,
          !this.#options.term
        );
        return;
      }
      case "start": {
        const task = this.#getTask(key);
        task.status = "RUNNING";
        task.startTime = process.hrtime.bigint();
        break;
      }
      case "skip": {
        this.#getTask(key).status = "SKIPPED";
        break;
      }
      case "error": {
        const task = this.#getTask(key);
        if (typeof args[0] === "string") {
          task.messages.push(args[0]);
        } else if (args[0] instanceof Error) {
          task.messages.push(args[0].message);
        }
        task.endTime = process.hrtime.bigint();
        task.status = "ERRORED";
        break;
      }
      case "complete": {
        const task = this.#getTask(key);
        task.endTime = process.hrtime.bigint();
        task.status = "COMPLETE";
        this.#output(
          `${task.name} ${type} in (${format(
            task.endTime - task.startTime,
            2
          )})`,
          !this.#options.term
        );
        return;
      }
      case "output": {
        const task = this.#getTask(key);
        const m = args[0] as string;
        task.messages.push(m);
        this.#output(`${task.name}: ${m}`, !this.#options.term);
      }
    }
    this.#output(`${type} ${this.#getTask(key).name}`, !this.#options.term);
  }
}

import type { Logger } from "./createLogger.js";
import createLogger from "./createLogger.js";
import type { ProgressData } from "./progress.js";
import Progress from "./progress.js";

export type TaskStatus =
  | "SKIPPED"
  | "PENDING"
  | "RUNNING"
  | "COMPLETE"
  | "ERRORED";

export type TaskEvent =
  | "create"
  | "start"
  | "skip"
  | "error"
  | "complete"
  | "output";

export interface TaskInfo {
  messages: string[];
  name: string;
  key: string;
  status: TaskStatus;
  subtasks: string[];
  startTime: bigint;
  endTime: bigint;
  parent: string | undefined;
  progress: ProgressData[];
}

export function createTask(name: string, key: string): TaskInfo {
  return {
    name,
    key,
    messages: [],
    status: "PENDING",
    subtasks: [],
    startTime: 0n,
    endTime: 0n,
    parent: undefined,
    progress: []
  };
}

export class Task {
  name: string;
  key: string;
  log: Logger;
  constructor(name: string, key: string, parent?: string) {
    this.name = name;
    this.key = key;
    this.log = createLogger(key);
    this.#emit("create", name, parent);
  }

  task(name: string, key?: string) {
    return new Task(name, key ?? name, this.key);
  }

  #emit(event: TaskEvent, ...args: unknown[]) {
    // @ts-expect-error Need to emit "task"
    process.emit("task", event, this.key, ...args);
  }

  start() {
    this.#emit("start");
  }

  skip() {
    this.#emit("skip");
  }

  complete(message?: string) {
    if (message) this.#emit("output", message);
    this.#emit("complete");
  }

  error(err?: Error | string | null | undefined) {
    this.#emit("error", err);
  }

  output(str: string) {
    str = str.trim();
    if (str) this.#emit("output", str);
  }

  progress(name: string, total?: number): Progress;
  progress(name: string, key?: string, total?: number): Progress;
  progress(name: string, key?: string | number, total?: number) {
    if (typeof key === "number") {
      total = key;
      key = name;
    }
    return new Progress(name, key, this.key, total);
  }
}

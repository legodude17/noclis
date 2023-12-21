import type { DisplayOptions } from "./Display.js";
import type { TaskInfo } from "./Task.js";
import figures from "figures";
import colors from "ansi-colors";
import spinners from "cli-spinners";
import type { Spinner } from "cli-spinners";
import { format } from "../util/time.js";
import type { ProgressData } from "./progress.js";
import { indent, StringBuilder } from "../util/strings.js";
import ansi from "ansi-escapes";

export default class Renderer {
  #tasks: string[];
  #allTasks: Map<string, TaskInfo>;
  #options: DisplayOptions;
  #ms = 0;
  #id?: ReturnType<typeof setInterval>;
  #prevLines = 0;
  constructor(
    tasks: string[],
    all: Map<string, TaskInfo>,
    options: DisplayOptions
  ) {
    this.#tasks = tasks;
    this.#allTasks = all;
    this.#options = options;
  }

  start() {
    this.#id = setInterval(this.#render.bind(this), 10);
    process.stderr.write(ansi.cursorHide);
  }

  stop() {
    clearInterval(this.#id);
    this.#render();
    this.#prevLines = 0;
    process.stderr.write(ansi.cursorShow);
  }

  #render() {
    const str = this.render();
    process.stderr.write(ansi.eraseLines(this.#prevLines) + str);
    this.#prevLines = str.split("\n").length;
    this.#ms += 10;
  }

  render() {
    return this.#tasks
      .map(t => this.#renderInner(this.#allTasks.get(t)!, 0))
      .join("\n");
  }

  #renderInner(task: TaskInfo, level: number) {
    const builder = new StringBuilder();
    builder.append(
      `${this.#taskIcon(task, this.#ms)} ${colors.bold(task.name)}`
    );
    const message = task.message;
    if (task.status === "COMPLETE" || task.status === "ERRORED") {
      builder.appendSpace();
      builder.appendSpace("-");
      builder.appendSpace(message ?? task.status.toLocaleLowerCase());
      builder.append(colors.gray(format(task.endTime - task.startTime)));
    } else if (task.status === "RUNNING") {
      if (task.subtasks.length === 0) {
        if (task.progress.length > 1) {
          if (message) {
            builder.appendSpace();
            builder.appendSpace("-");
            builder.append(message);
          }
          builder.appendLine();
          builder.indent();
          builder.appendLines(
            task.progress.map(
              p =>
                `${colors.grey(figures.arrowRight)} ${this.#renderProgress(
                  p,
                  task,
                  process.stderr.columns - level / 2
                )}`
            )
          );
          builder.dedent();
        } else if (task.progress.length === 1) {
          builder.appendSpace();
          builder.appendSpace("-");
          builder.append(
            this.#renderProgress(
              task.progress[0]!,
              task,
              process.stderr.columns -
                level -
                builder.length -
                (message?.length ?? 0) -
                10
            )
          );
          if (message) {
            builder.appendSpace();
            builder.append(message);
          }
        } else if (message) {
          builder.appendSpace();
          builder.append(message);
        }
        if (task.messages.length > 0) {
          builder.appendLine();
          builder.indent();
          builder.appendLines(
            task.messages.map(m => `${colors.grey(figures.arrowRight)} ${m}`)
          );
          builder.dedent();
        }
      } else {
        if (message) {
          builder.appendSpace();
          builder.appendSpace("-");
          builder.append(message);
        }
        builder.appendLine();
        builder.append([
          task.subtasks
            .map(t => this.#renderInner(this.#allTasks.get(t)!, level + 4))
            .join("\n")
        ]);
      }
    }
    return indent(builder.toString(), level);
  }

  #renderProgress(progress: ProgressData, parent: TaskInfo, width: number) {
    const context = {
      time: format(process.hrtime.bigint() - parent.startTime, 1),
      bar: this.#renderBar(
        progress.value,
        progress.total,
        width - this.#options.progressFormat.length
      ),
      percent: ((progress.value / progress.total) * 100).toPrecision(3) + "%",
      ...progress
    };
    return this.#options.progressFormat.replaceAll(
      /{(\w+)}/g,
      (_, key: string) => {
        const val = context[key as keyof typeof context];
        switch (typeof val) {
          case "number": {
            return val.toFixed(2);
          }
          case "boolean": {
            return val ? "true" : "false";
          }
          case "undefined": {
            return "";
          }
          case "string": {
            return val;
          }
        }
      }
    );
  }
  #renderBar(value: number, total: number, width: number): string {
    width = Math.round(width);
    const complete = Math.min(Math.round((value / total) * width), width);
    const incomplete = width - complete;
    return `[${"=".repeat(complete)}${"-".repeat(incomplete)}]`;
  }
  #taskIcon(task: TaskInfo, ms: number): string {
    switch (task.status) {
      case "COMPLETE": {
        return colors.green(figures.tick);
      }
      case "ERRORED": {
        return colors.red(figures.cross);
      }
      case "RUNNING": {
        return colors.blue(this.#renderSpinner(spinners.dots, ms));
      }
      case "PENDING": {
        return colors.yellow(figures.pointer);
      }
      case "SKIPPED": {
        return colors.yellow(figures.arrowDown);
      }
    }
  }

  #renderSpinner(spinner: Spinner, ms: number) {
    const frame = Math.round(ms / spinner.interval) % spinner.frames.length;
    return spinner.frames[frame]!;
  }
}

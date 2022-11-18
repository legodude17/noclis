import type { DisplayOptions } from "./Display.js";
import type { TaskInfo } from "./Task.js";
import figures from "figures";
import colors from "ansi-colors";
import spinners, { Spinner } from "cli-spinners";
import { format } from "../util/time.js";
import type { ProgressData } from "./progress.js";
import { indent } from "../util/strings.js";

function renderSpinner(spinner: Spinner, ms: number) {
  const frame = Math.round(ms / spinner.interval) % spinner.frames.length;
  return spinner.frames[frame]!;
}

function taskIcon(task: TaskInfo, ms: number): string {
  switch (task.status) {
    case "COMPLETE": {
      return colors.green(figures.tick);
    }
    case "ERRORED": {
      return colors.red(figures.cross);
    }
    case "RUNNING": {
      return colors.blue(renderSpinner(spinners.dots, ms));
    }
    case "PENDING": {
      return colors.yellow(figures.pointer);
    }
    case "SKIPPED": {
      return colors.yellow(figures.arrowDown);
    }
  }
}

function renderBar(value: number, total: number, width: number): string {
  width = Math.round(width);
  const complete = Math.min(Math.round((value / total) * width), width);
  const incomplete = width - complete;
  return `[${"=".repeat(complete)}${"-".repeat(incomplete)}]`;
}

function renderProgress(
  progress: ProgressData,
  options: DisplayOptions,
  parent: TaskInfo,
  width: number
) {
  const context = {
    time: format(process.hrtime.bigint() - parent.startTime, 1),
    bar: renderBar(
      progress.value,
      progress.total,
      width - options.progressFormat.length
    ),
    percent: ((progress.value / progress.total) * 100).toPrecision(3) + "%",
    ...progress
  };
  return options.progressFormat.replace(/{(\w+)}/g, (_, key: string) => {
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
  });
}

function renderInner(
  task: TaskInfo,
  level: number,
  options: DisplayOptions,
  ms: number,
  all: Map<string, TaskInfo>
): string {
  let string = `${taskIcon(task, ms)} ${colors.bold(task.name)}`;
  const message = task.message;
  if (task.status === "COMPLETE" || task.status === "ERRORED") {
    string += ` - ${message ?? task.status.toLocaleLowerCase()} (${colors.gray(
      format(task.endTime - task.startTime)
    )})`;
  } else if (task.status === "RUNNING") {
    if (task.subtasks.length === 0) {
      if (task.progress.length > 1) {
        if (message)
          string += "\n    " + colors.grey(`${figures.arrowRight} ${message}`);
        string +=
          "\n" +
          task.progress
            .map(
              p =>
                "    " +
                colors.grey(figures.arrowRight) +
                " " +
                renderProgress(
                  p,
                  options,
                  task,
                  process.stderr.columns - level / 2
                )
            )
            .join("\n");
      } else if (task.progress.length === 1) {
        string +=
          " - " +
          renderProgress(
            task.progress[0]!,
            options,
            task,
            process.stderr.columns -
              level -
              string.length -
              (message?.length ?? 0) -
              10
          );
        if (message) string += " " + message;
      } else if (message)
        string += "\n    " + colors.grey(figures.arrowRight + " " + message);
    } else {
      if (message) string += " - " + message;
      string +=
        "\n" +
        task.subtasks
          .map(t => renderInner(all.get(t)!, level + 4, options, ms, all))
          .join("\n");
    }
  }
  return indent(string, level);
}

export default function render(
  tasks: string[],
  options: DisplayOptions,
  ms: number,
  all: Map<string, TaskInfo>
): string {
  return tasks
    .map(t => renderInner(all.get(t)!, 0, options, ms, all))
    .join("\n");
}

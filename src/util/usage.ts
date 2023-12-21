import type { CLIConfig } from "../CLIConfig.js";
import type { Argument, Command, Option, ParseSpec } from "../types.js";
import UI from "./cliui.js";
import { Stream } from "node:stream";
import typers from "../optionTypes.js";
import { dashcase, StringBuilder } from "./strings.js";

export function usage(
  spec: ParseSpec,
  config: CLIConfig,
  {
    header = true,
    doOptions = true,
    doArgs = true,
    usage = true,
    commands = true
  } = {},
  ui = new UI()
) {
  if (header) {
    ui.append(`${config.name} v${config.version}`);
    ui.append("");
  }
  if (usage) ui.append("Usage:");
  if (!config.requireCommand && usage) {
    ui.indent();
    ui.append(oneline(config.name, "", spec.arguments, spec.options, config));
    ui.dedent();
  }
  if (spec.commands.length > 0 && commands) {
    ui.indent();
    ui.append(
      `${config.name} ${wrap("command", config.requireCommand ? "<" : "[")}`
    );
    ui.dedent();
    ui.append("");
    ui.startSection("Commands:");
    for (const command of spec.commands) {
      ui.append(
        command.name,
        command.description || "[No Description Provided]"
      );
    }
    ui.endSection();
  }
  ui.append("");

  if (spec.arguments.length > 0 && doArgs) {
    ui.startSection("Arguments:");
    args(spec.arguments, ui);
    ui.append("");
    ui.endSection();
  }
  if (spec.options.some(opt => opt.cli && opt.help) && doOptions) {
    ui.startSection("Options:");
    options(spec.options, config, ui);
    ui.endSection();
  }
  return ui.toString();
}

usage.options = options;
usage.command = command;
usage.args = args;
usage.line = oneline;

export function oneline(
  program: string,
  command: string,
  args: Argument[],
  options: Option[],
  config: CLIConfig
) {
  const builder = new StringBuilder();
  args.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  builder.append(program);
  builder.newWord();
  builder.append(command);
  builder.newWord();
  let provides: string[];
  builder.append(
    options
      .filter(opt => opt.help && opt.cli && opt.required)
      .map(opt =>
        wrap(
          wrap(
            (provides = optionProvides(opt, config.noPrefix)).join(" | "),
            opt.type === "boolean" || provides.length === 1 ? "" : "("
          ) + (opt.type === "boolean" ? "" : "=value"),
          opt.required ? "<" : "["
        )
      )
      .join(" ")
  );
  builder.newWord();
  builder.append(args.map(arg => argName(arg)).join(" "));
  return builder.toString();
}

function optionProvides(opt: Option, noPrefix: string): string[] {
  return [dashcase(opt.name), ...opt.alias]
    .flatMap(o =>
      opt.type === "boolean" && o.length !== 1 ? [o, noPrefix + o] : [o]
    )
    .sort((a, b) => a.length - b.length)
    .map(v => optName(v));
}

function command(
  command: Command,
  config: CLIConfig,
  programName = "",
  ui = new UI()
) {
  if (command.children.length > 1 && command.args.length === 0) {
    ui.append(
      `${programName ? programName + " " : ""}${command.name} <command>`
    );
  } else {
    ui.append(
      oneline(programName, command.name, command.args, command.options, config)
    );
  }
  ui.append("");
  if (command.alias.length > 0) {
    ui.startSection("Aliases:");
    ui.append(command.alias.join(", "));
    ui.append("");
    ui.endSection();
  }
  if (command.children.length > 0) {
    ui.startSection("Sub-commands:");
    for (const c of command.children) {
      ui.append(c.name, c.description || "[No Description Provided]");
    }
    ui.append("");
    ui.endSection();
  }
  if (command.args.length > 0) {
    ui.startSection("Arguments:");
    args(command.args, ui);
    ui.append("");
    ui.endSection();
  }
  if (command.options.some(opt => opt.cli && opt.help)) {
    ui.append("Options:");
    options(command.options, config, ui);
  }
  return ui.toString();
}

function options(options: Option[], config: CLIConfig, ui: UI) {
  for (const option of options) {
    if (option.cli && option.help)
      ui.append(
        option.name,
        optionProvides(option, config.noPrefix).join(", "),
        option.description || "[No Description Provided]",
        option.required
          ? "[required]"
          : stringify(
              option.default ??
                (typeof option.type === "string"
                  ? typers[option.type].default
                  : option.type(""))
            )
      );
  }
}

function optName(opt: string) {
  return `${opt.length === 1 ? "-" : "--"}${opt}`;
}

function args(args: Argument[], ui: UI) {
  args.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const arg of args) {
    ui.append(
      arg.name,
      arg.description || "[No Description Provided]",
      arg.required
        ? "[required]"
        : stringify(
            arg.default ??
              (typeof arg.type === "string"
                ? typers[arg.type].default
                : arg.type(""))
          )
    );
  }
}

function argName(arg: Argument) {
  return wrap(arg.name + (arg.array ? "..." : ""), arg.required ? "<" : "[");
}

export const braces = {
  "{": "}",
  "[": "]",
  "<": ">",
  "(": ")",
  "": ""
};

export function wrap(str: string, char: keyof typeof braces) {
  return char + str + braces[char];
}

export function stringify(val?: unknown): string {
  if (val === undefined) return "undefined";
  if (val === null) return "null";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "bigint")
    return val.toLocaleString();
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "symbol") return val.toString();
  if (val instanceof Stream) return "[stream]";
  if (val instanceof Date) return val.toLocaleString();
  if (Array.isArray(val))
    return val
      .flat()
      .map(v => stringify(v))
      .join(", ");
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      return val.toString();
    }
  }
  return "[value]";
}

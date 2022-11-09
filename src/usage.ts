import type { CLIConfig } from "./CLIConfig.js";
import type { Argument, Command, Option, ParseSpec } from "./types.js";
import cliui from "cliui";
import { Stream } from "node:stream";
import typers from "./optionTypes.js";
import { dashcase } from "./util/strings.js";

const makeUI = () => cliui({ width: process.stdout.columns });

export function usage(
  spec: ParseSpec,
  config: CLIConfig,
  {
    header = true,
    doOptions = true,
    doArgs = true,
    usage = true,
    commands = true
  } = {}
) {
  const ui = makeUI();
  if (header) {
    ui.div(`${config.name} v${config.version}`);
    ui.div("");
  }
  if (usage) ui.div("Usage:");
  if (!config.requireCommand && usage) {
    ui.div(
      "  " + oneline(config.name, "", spec.arguments, spec.options, config)
    );
  }
  if (spec.commands.length > 0 && commands) {
    ui.div(
      `  ${config.name} ${wrap("command", config.requireCommand ? "<" : "[")}`
    );
    ui.div("");
    ui.div("Commands:");
    for (const command of spec.commands) {
      ui.div(
        { text: command.name, padding: [0, 0, 0, 2], width: 20 },
        command.description || "[No Description Provided]"
      );
    }
  }
  ui.div("");

  if (spec.arguments.length > 0 && doArgs) {
    ui.div("Arguments:");
    ui.div(args(spec.arguments));
    ui.div("");
  }
  if (spec.options.length > 0 && doOptions) {
    ui.div("Options:");
    ui.div(options(spec.options, config));
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
  let text = "";
  function add(str: string) {
    text = text.trim() + " " + str.trim();
  }
  add(program);
  add(command);
  let provides: string[];
  add(
    options
      .filter(opt => opt.help)
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
  add(args.map(arg => argName(arg)).join(" "));
  return text;
}

function optionProvides(opt: Option, noPrefix: string): string[] {
  return [dashcase(opt.name), ...opt.alias]
    .flatMap(o =>
      opt.type === "boolean" && o.length !== 1 ? [o, noPrefix + o] : [o]
    )
    .sort((a, b) => a.length - b.length)
    .map(v => optName(v));
}

function command(command: Command, config: CLIConfig, programName = "") {
  const ui = makeUI();
  if (command.children.length > 1 && command.args.length === 0) {
    ui.div(`${programName ? programName + " " : ""}${command.name} <command>`);
  } else {
    ui.div(
      oneline(programName, command.name, command.args, command.options, config)
    );
  }
  ui.div("");
  if (command.alias.length > 0) {
    ui.div("Aliases:");
    ui.div("  " + command.alias.join(", "));
    ui.div("");
  }
  if (command.children.length > 0) {
    ui.div("Sub-commands:");
    for (const c of command.children) {
      ui.div(
        { text: c.name, padding: [0, 0, 0, 2], width: 20 },
        c.description || "[No Description Provided]"
      );
    }
    ui.div("");
  }
  if (command.args.length > 0) {
    ui.div("Arguments:");
    ui.div(args(command.args));
    ui.div("");
  }
  if (command.options.length > 0) {
    ui.div("Options:");
    ui.div(options(command.options, config));
  }
  return ui.toString();
}

function options(options: Option[], config: CLIConfig, indent = 2) {
  const ui = makeUI();
  for (const option of options) {
    if (option.cli && option.help)
      ui.div(
        { text: option.name, padding: [0, 0, 0, indent], width: 20 },
        optionProvides(option, config.noPrefix).join(", "),
        option.description || "[No Description Provided]",
        {
          text: option.required
            ? "[required]"
            : stringify(
                option.default ??
                  (typeof option.type === "string"
                    ? typers[option.type].default
                    : option.type(""))
              ),
          width: 20,
          padding: [0, 0, 0, 0]
        }
      );
  }
  return ui.toString();
}

function optName(opt: string) {
  return `${opt.length === 1 ? "-" : "--"}${opt}`;
}

function args(args: Argument[], indent = 2) {
  const ui = makeUI();
  for (const arg of args) {
    ui.div(
      { text: arg.name, padding: [0, 0, 0, indent], width: 20 },
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
  return ui.toString();
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
  if (typeof val === "undefined") return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "bigint")
    return val.toLocaleString();
  if (typeof val === "boolean") return val ? "true" : "false";
  if (typeof val === "symbol") return val.toString();
  if (val instanceof Stream) return "[stream]";
  if (val instanceof Date) return val.toLocaleString();
  if (val instanceof Object) return val.toString();
  if (Array.isArray(val))
    return val
      .flat()
      .map(v => stringify(v))
      .join(", ");
  return "[value]";
}

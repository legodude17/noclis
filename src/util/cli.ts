import type { Argument, Command, Option } from "../types.js";
import typers from "../optionTypes.js";

export function defaultFor(
  arg: Option | Argument,
  context: Record<string, unknown>
) {
  if (typeof arg.default === "function")
    return (arg.default as (arg: Record<string, unknown>) => unknown)(context);
  else if (arg.default) return arg.default;
  else if (typeof arg.type === "function") return arg.type("");
  else return typers[arg.type].default;
}

export function getCommmandOptions(commands: Command[]): Option[] {
  return [
    ...commands.flatMap(com => com.options),
    ...commands.flatMap(com => getCommmandOptions(com.children))
  ];
}

import type { Argument, Option, OptionTyper } from "src/types.js";
import type { PromptArgs } from "./types.js";
import { defaultFor } from "../util/cli.js";
import optionTypes from "../optionTypes.js";

export function promptFor(
  arg: Option | Argument,
  context: Record<string, unknown>,
  initial = defaultFor(arg, context, false)
): PromptArgs {
  let typer: OptionTyper<unknown>;
  if (typeof arg.type === "function") {
    const type = arg.type;
    typer = {
      validate: str => type(str) != null,
      coerce: str => type(str),
      default: type(""),
      defaultPrompt: "input"
    };
  } else {
    typer = optionTypes[arg.type];
  }
  // @ts-expect-error This is a mess
  return Object.assign(
    {
      validate: typer.validate,
      result: typer.coerce,
      enabled: "True",
      disabled: "False"
    },
    arg.prompt,
    {
      name: arg.name,
      initial
    }
  );
}

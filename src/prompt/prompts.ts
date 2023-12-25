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

  const promptObj = Object.assign(
    {
      initial,
      type: typer.defaultPrompt
    },
    arg.prompt,
    {
      name: arg.name
    }
  ) as PromptArgs;

  if (promptObj.type === "input") {
    /* eslint-disable @typescript-eslint/unbound-method */
    promptObj.validate ??= typer.validate as (
      str: string
    ) => boolean | Promise<boolean>;
    promptObj.result ??= typer.coerce as (
      str: string
    ) => string | Promise<string>;
    /* eslint-enable @typescript-eslint/unbound-method */
  }

  return promptObj;
}

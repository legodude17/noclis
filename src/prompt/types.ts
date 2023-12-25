import { prompt } from "enquirer";
import type { Except, Promisable, SetOptional } from "type-fest";

type StripArr<T> = T extends Array<infer U> ? U : never;
type StripFunc<T> = T extends () => Promisable<infer U> ? U : never;

export type PromptArgs = StripFunc<StripArr<Parameters<typeof prompt>>>;

interface BasePromptOptions {
  message: string | (() => string) | (() => Promise<string>);
  prefix?: string;
}

interface Choice {
  name: string;
  message?: string;
  value?: unknown;
  hint?: string;
  role?: string;
  enabled?: boolean;
  disabled?: boolean | string;
}

interface ArrayPromptOptions extends BasePromptOptions {
  type:
    | "autocomplete"
    | "editable"
    | "form"
    | "multiselect"
    | "select"
    | "survey"
    | "list"
    | "scale";
  choices: (string | Choice)[];
  maxChoices?: number;
  multiple?: boolean;
  delay?: number;
  separator?: boolean;
  sort?: boolean;
  linebreak?: boolean;
  edgeLength?: number;
  align?: "left" | "right";
  scroll?: boolean;
}

interface BooleanPromptOptions extends BasePromptOptions {
  type: "confirm";
}

interface StringPromptOptions extends BasePromptOptions {
  type: "input" | "invisible" | "list" | "password" | "text";
  multiline?: boolean;
}

interface NumberPromptOptions extends BasePromptOptions {
  type: "numeral";
  min?: number;
  max?: number;
  delay?: number;
  float?: boolean;
  round?: boolean;
  major?: number;
  minor?: number;
}

interface SnippetPromptOptions extends BasePromptOptions {
  type: "snippet";
  newline?: string;
  template?: string;
}

interface SortPromptOptions extends BasePromptOptions {
  type: "sort";
  hint?: string;
  drag?: boolean;
  numbered?: boolean;
}

export type PromptOptions = SetOptional<
  Except<PromptArgs, "name", { requireExactProps: true }>,
  "type"
>;

export type PromptType = (
  | ArrayPromptOptions
  | BooleanPromptOptions
  | StringPromptOptions
  | NumberPromptOptions
  | SnippetPromptOptions
  | SortPromptOptions
)["type"];

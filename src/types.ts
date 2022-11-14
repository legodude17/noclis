import type { Except, Promisable, ValueOf } from "type-fest";
import type { CLIConfig } from "./CLIConfig.js";
import type typers from "./optionTypes.js";
import type { Task as TaskC } from "./logging/Task.js";
import type App from "./App.js";
import type { prompt } from "enquirer";
import type { Readable } from "node:stream";
import type { ChildProcess } from "node:child_process";
import type Minipass from "minipass";

export interface Part {
  name: string;
  description?: string;
}

type StripFuncArray<T> = T extends Array<infer U>
  ? U
  : T extends () => infer U
  ? U
  : T;

export type PromptOption = StripFuncArray<
  StripFuncArray<Parameters<typeof prompt>[0]>
>;

export interface Opt extends Part {
  type: OptionType | ((str: string) => Promisable<unknown>);
  array: boolean;
  choices: unknown[];
  required: boolean;
  min?: number;
  max?: number;
  default?: unknown | undefined;
  prompt?: Except<PromptOption, "name"> | undefined;
}

export interface Argument extends Opt {
  order?: number;
}

export interface Option extends Opt {
  alias: string[];
  config: boolean;
  cli: boolean;
  help: boolean;
}

export interface Command extends Part {
  children: Command[];
  options: Option[];
  alias: string[];
  args: Argument[];
  requireSubcommand: boolean;
}

type Typers = typeof typers;
/**
 * A possible type for an option (or argument)
 * @public
 */
export type OptionType = keyof Typers;
type TyperType<T> = T extends OptionTyper<infer U> ? U : never;
type AllTypes = TyperType<ValueOf<Typers>>;

export type OptionValue = AllTypes | AllTypes[];

export type OptionTypes = {
  [Key in keyof Typers]: TyperType<Typers[Key]>;
};

export type Argv = string[] | string;

export interface OptionTyper<T> {
  validate: (val: string) => Promisable<boolean>;
  coerce: (val: string) => Promisable<T>;
  allowArray?: boolean;
  default: T;
}

export interface ParseSpec {
  commands: Command[];
  options: Option[];
  arguments: Argument[];
  config: CLIConfig;
}

export interface ParseResult<
  C extends string = string,
  O extends object = object,
  A extends object = object
> {
  commandPath: C[];
  options: O;
  arguments: A;
  help: boolean;
}

export type Task<O, A> =
  | {
      (task: TaskC, args: A, options: O): Promisable<
        TaskResult<O, A> | string | void
      >;
      displayName?: string;
    }
  | {
      name: string;
      key?: string;
      handler: (
        task: TaskC,
        args: A,
        options: O
      ) => Promisable<TaskResult<O, A>>;
    };

export type RunnableTask<O, A> =
  | Task<O, A>
  | Task<O, A>[]
  | Task<O, A>[][]
  | Iterable<Task<O, A>>
  | AsyncIterable<Task<O, A>>;

export type TaskResult<O, A> =
  | RunnableTask<O, A>
  | string
  | Readable
  | Minipass.Readable
  | ChildProcess
  | void;

export type HandlerFunction<C extends string, O, A> = (
  args: A,
  options: O,
  path: C[],
  app: App
) => Promisable<RunnableTask<O, A> | void>;

export type HandlerPath<C extends string> = (C | "*" | "**")[] | C | "*" | "**";

export interface Handler<C extends string, O extends object, A extends object> {
  path: HandlerPath<C>;
  handler: HandlerFunction<C, O, A>;
}

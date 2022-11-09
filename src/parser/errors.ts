import type { Promisable } from "type-fest";
import type { OptionType } from "../types.js";
import type { ParseState } from "./parser.js";

export class ParseError extends SyntaxError {
  position: number;
  argv: string[];
  reason: string;
  constructor(
    message: string,
    index: number,
    argv: string[],
    pos: number = argv.slice(0, index).join(" ").length
  ) {
    const reason = message + (argv[index] ? `: ${argv[index]!}` : "");
    super(`${reason} (at position ${pos})`);
    this.reason = reason;
    this.position = pos;
    this.argv = argv;
    this.name = "ParseError";
  }

  override toString() {
    const padding = " ".repeat(this.position);
    return `Invalid input:
  ${this.argv.join(" ")}
  ${padding}↑
  ${padding}${this.reason}`;
  }
}

export interface ErrorWithParseContext {
  type: string;
  item: string;
  context: ParseState;
}

export class CountError extends RangeError implements ErrorWithParseContext {
  type: string;
  item: string;
  context: ParseState;
  constructor(
    type: string,
    name: string,
    actual: number,
    expected: [number, number],
    context: ParseState
  ) {
    super(
      `${
        actual < expected[0]
          ? "Not enough"
          : actual > expected[1]
          ? "Too many"
          : "?????"
      } values provided for ${type} ${name}. Got ${actual}, wanted ${
        expected[0] === expected[1]
          ? expected[0]
          : `between ${expected[0]} and ${expected[1]}`
      }`
    );
    this.name = "CountError";
    this.type = type;
    this.item = name;
    this.context = context;
  }
}

export class DemandError extends TypeError {
  type: string;
  item: string;
  context: ParseState;
  constructor(type: string, context: ParseState, name?: string) {
    super(
      `${type[0]!.toUpperCase()}${type.slice(1)} required${
        name ? `: ${name}` : ""
      }`
    );
    this.name = "DemandError";
    this.type = type;
    this.item = name ?? "";
    this.context = context;
  }
}

export class NotFoundError extends ReferenceError {
  type: string;
  item: string;
  context: ParseState;
  constructor(type: string, name: string, context: ParseState) {
    super(`No such ${type}: ${name}`);
    this.name = "NotFoundError";
    this.type = type;
    this.item = name;
    this.context = context;
  }
}

export class InvalidTypeError extends TypeError {
  type: string;
  item: string;
  context: ParseState;
  constructor(
    type: string,
    arg: {
      type: OptionType | ((str: string) => Promisable<unknown>);
      name: string;
      choices: unknown[];
    },
    value: string,
    context: ParseState
  ) {
    if (arg.choices.length > 0) {
      super(
        `${value} is not a valid input for ${type} ${
          arg.name
        }. Valid inputs: ${arg.choices.join(", ")}`
      );
    } else {
      super(
        `Failed to parse ${value} as ${
          typeof arg.type === "string"
            ? arg.type
            : arg.type.toString().split("\n")[0]!.trim()
        } for ${type} ${arg.name}`
      );
    }
    this.name = "InvalidTypeError";
    this.type = type;
    this.item = arg.name;
    this.context = context;
  }
}

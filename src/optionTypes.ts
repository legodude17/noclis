import type { OptionTyper } from "./types.js";
import { resolve, isAbsolute } from "node:path";
import { globby } from "globby";
import isGlob from "is-glob";

const string: OptionTyper<string> = {
  validate: () => true,
  coerce: str => str,
  default: "",
  defaultPrompt: "input"
};

const number: OptionTyper<number> = {
  validate: str => !Number.isNaN(+str),
  coerce: str => +str,
  default: 0,
  defaultPrompt: "numeral"
};

const trueStrings = new Set<string>();
const falseStrings = new Set<string>();

trueStrings.add("true");
trueStrings.add("yes");
trueStrings.add("y");

falseStrings.add("false");
falseStrings.add("no");
falseStrings.add("n");

const boolean: OptionTyper<boolean> = {
  validate: str => trueStrings.has(str) || falseStrings.has(str),
  coerce: str => trueStrings.has(str),
  default: false,
  defaultPrompt: "confirm"
};

const url: OptionTyper<URL> = {
  validate(str) {
    try {
      new URL(str);
      return true;
    } catch (error) {
      if (error instanceof TypeError) return false;
      throw error;
    }
  },
  coerce: str => new URL(str),
  default: new URL(import.meta.url),
  defaultPrompt: "input"
};

const path: OptionTyper<string | string[]> = {
  validate(str) {
    if (isGlob(str)) return true;
    return isAbsolute(resolve(str));
  },
  coerce(str) {
    if (isGlob(str)) return globby(str);
    return resolve(str);
  },
  default: process.cwd(),
  defaultPrompt: "input"
};

const date: OptionTyper<Date> = {
  validate: str => !Number.isNaN(Date.parse(str)),
  coerce: str => new Date(str),
  default: new Date(),
  defaultPrompt: "input"
};

export default { string, number, boolean, url, path, date };

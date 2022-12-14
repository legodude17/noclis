import type { OptionTyper } from "./types.js";
import { resolve, isAbsolute } from "node:path";
import { globby } from "globby";
import isGlob from "is-glob";

const string: OptionTyper<string> = {
  validate: () => true,
  coerce: str => str,
  default: ""
};

const number: OptionTyper<number> = {
  validate: str => !Number.isNaN(+str),
  coerce: str => +str,
  default: 0
};

const boolean: OptionTyper<boolean> = {
  validate: str => str === "true" || str === "false",
  coerce: str => str === "true",
  default: false
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
  default: new URL(import.meta.url)
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
  default: process.cwd()
};

const date: OptionTyper<Date> = {
  validate: str => !Number.isNaN(Date.parse(str)),
  coerce: str => new Date(str),
  default: new Date()
};

export default { string, number, boolean, url, path, date };

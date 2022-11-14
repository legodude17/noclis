import type { OptionTyper } from "./types.js";
import { resolve } from "node:path";
import { globby } from "globby";
import isGlob from "is-glob";
import type { Stream } from "node:stream";
import { pathExists } from "path-exists";
import { createReadStream } from "node:fs";

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
  async validate(str) {
    if (isGlob(str)) return true;
    return pathExists(resolve(str));
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

const stream: OptionTyper<Stream> = {
  validate: str => str === "-" || pathExists(resolve(str)),
  coerce: str => (str === "-" ? process.stdin : createReadStream(resolve(str))),
  allowArray: false,
  default: process.stdin
};

export default { string, number, boolean, url, path, date, stream };

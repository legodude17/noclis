import type { Option, PromptOption } from "src/types.js";
import os from "node:os";
import path from "node:path";
import defaultLoaders, { Loaders } from "./loaders.js";
import fs from "node:fs/promises";
import typers from "../optionTypes.js";
import Enquirer from "enquirer";
import { stringify } from "../usage.js";

export default async function loadConfig<T extends Record<string, unknown>>(
  name: string,
  spec: Option[],
  base?: T,
  {
    interactive = false,
    curDirectory = process.cwd(),
    stopDirectory = os.homedir(),
    loaders = {}
  }: {
    interactive?: boolean;
    curDirectory?: string;
    stopDirectory?: string;
    loaders?: Loaders;
  } = {}
) {
  curDirectory = path.resolve(curDirectory);
  stopDirectory = path.resolve(stopDirectory);
  const loaded: (object | undefined)[] = [];
  while (curDirectory) {
    curDirectory = path.dirname(curDirectory);
    loaded.push(
      ...(await loadAllConfigFrom(name, curDirectory, spec, loaders))
    );
    if (curDirectory !== stopDirectory) break;
  }
  const defaults = getDefaults(spec);
  const result = Object.assign(
    {},
    ...loaded.filter(l => l != undefined).reverse(),
    base
  ) as T;
  if (interactive) {
    const prompts: PromptOption[] = [];
    const enquirer = new Enquirer({}, result);
    for (const opt of spec) {
      if (opt.prompt && !result[opt.name]) {
        prompts.push(
          Object.assign({ inital: defaults[opt.name] }, opt.prompt, {
            name: opt.name
          })
        );
      }
    }
    Object.assign(result, await enquirer.prompt(prompts));
  }
  return Object.assign(defaults, result);
}

export async function loadAllConfigFrom(
  name: string,
  dir: string,
  spec: Option[],
  loaders: Loaders = {}
) {
  loaders = Object.assign({}, defaultLoaders, loaders);
  const toMatch = new Set(["package.json"]);
  for (const base of [`.${name}rc`, `.${name}.config`]) {
    for (const ext of Object.keys(loaders)) {
      if (ext === "noExt") toMatch.add(base);
      else toMatch.add(base + ext);
    }
  }
  const allFiles = await fs.readdir(dir);
  return await Promise.all(
    allFiles
      .filter(file => toMatch.has(file))
      .map(file => loadConfigFile(file, name, spec, loaders))
  );
}

export async function loadConfigFile(
  file: string,
  name: string,
  spec: Option[],
  loaders: Loaders = {}
) {
  loaders = Object.assign({}, defaultLoaders, loaders);
  const contents = await fs.readFile(file, "utf8");
  let tempResult: object | undefined = {};
  if (path.basename(file) === "package.json") {
    tempResult = (JSON.parse(contents) as Record<string, object>)[name];
  } else {
    const ext = path.extname(file);
    const loader =
      !ext || ext === ".config" || ext === ".cfg"
        ? loaders.noExt
        : loaders[ext];
    tempResult = loader && loader(file, contents);
  }
  const result = (tempResult ?? {}) as Record<string, unknown>;
  for (const key of Object.keys(result)) {
    const opt = spec.find(o => o.name === key);
    if (!opt || !opt.config) delete result[key];
    else {
      result[key] =
        typeof opt.type === "string"
          ? typers[opt.type].coerce(stringify(result[key]))
          : opt.type(stringify(result[key]));
    }
  }
  return result;
}

export function getDefaults(spec: Option[]) {
  const defaults: Record<string, unknown> = {};
  for (const opt of spec) {
    if (opt.config) {
      defaults[opt.name] =
        opt.default ??
        (typeof opt.type === "function"
          ? opt.type("")
          : typers[opt.type].default);
    }
  }
  return defaults;
}

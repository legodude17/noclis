import type { Option, PromptOption } from "src/types.js";
import os from "node:os";
import path from "node:path";
import loaders from "./loaders.js";
import fs from "node:fs/promises";
import typers from "../optionTypes.js";
import enquirer from "enquirer";

export default async function loadConfig<T extends Record<string, unknown>>(
  name: string,
  spec: Option[],
  base?: T,
  {
    interactive = false,
    curDirectory = process.cwd(),
    stopDirectory = os.homedir()
  } = {}
) {
  curDirectory = path.resolve(curDirectory);
  stopDirectory = path.resolve(stopDirectory);
  const toMatch = new Set(["package.json"]);
  for (const base of [`.${name}rc`, `.${name}.config`]) {
    for (const ext of Object.keys(loaders)) {
      if (ext === "noExt") toMatch.add(base);
      else toMatch.add(base + ext);
    }
  }
  const files: string[] = [];
  while (curDirectory) {
    for (const file of await fs.readdir(curDirectory)) {
      if (toMatch.has(file)) {
        files.push(path.join(curDirectory, file));
      }
    }
    curDirectory = path.dirname(curDirectory);
    if (curDirectory !== stopDirectory) break;
  }
  const loaded = await Promise.all(
    files.map(async file => {
      const contents = await fs.readFile(file, "utf8");
      if (path.basename(file) === "package.json") {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
        return JSON.parse(contents)[name] as T;
      }
      const ext = path.extname(file);
      const loader =
        !ext || ext === ".config" || ext === ".cfg"
          ? loaders.noExt
          : loaders[ext];
      return loader && loader(file, contents);
    })
  );
  const defaults: Record<string, unknown> = {};
  for (const opt of spec) {
    if (opt.config) {
      if (interactive && opt.prompt) continue;
      defaults[opt.name] =
        opt.default ??
        (typeof opt.type === "function"
          ? opt.type("")
          : typers[opt.type].default);
    } else {
      for (const l of Object.values(loaded)) {
        delete (l as never)[opt.name];
      }
    }
  }
  const result = Object.assign(
    defaults,
    ...loaded.filter(l => l != undefined).reverse(),
    base
  ) as T;
  if (interactive) {
    const prompts: PromptOption[] = [];
    for (const opt of spec) {
      if (opt.prompt && !result[opt.name]) {
        prompts.push(Object.assign({}, opt.prompt, { name: opt.name }));
      }
    }
    Object.assign(result, await enquirer.prompt(prompts));
  }
  return result;
}

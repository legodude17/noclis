import type { Promisable } from "type-fest";
import { readPackageUp } from "read-pkg-up";
import { dirname } from "node:path";

type Loader = (
  path: string,
  contents: string
) => Promisable<object | undefined>;

export type Loaders = { [k: string]: Loader } & { noExt?: Loader };

let yaml: typeof import("js-yaml"),
  importFresh: typeof import("import-fresh"),
  ini: typeof import("ini");
const loadCJS = async (path: string) => {
  if (!importFresh) {
    const temp = await import("import-fresh");
    importFresh = temp.default;
  }
  return importFresh(path);
};
const loadYaml = async (_: string, content: string) => {
  if (!yaml) yaml = await import("js-yaml");
  return yaml.load(content);
};
const loadINI = async (_: string, content: string) => {
  if (!ini) ini = await import("ini");
  return ini.parse(content);
};
const loadMJS = (path: string) => import(path);
const loadJSON = (_: string, content: string) => JSON.parse(content) as object;
const loaders: Loaders = {
  noExt: (path, content) => {
    if (content.trim()[0] === "{") return loadJSON(path, content);
    else if (content.includes("=")) return loadINI(path, content);
    else return loadYaml(path, content);
  },
  ".json": loadJSON,
  ".yaml": loadYaml,
  ".yml": loadYaml,
  ".ini": loadINI,
  ".js": async (path, contents) => {
    const pkg = await readPackageUp({ cwd: dirname(path) });
    if (pkg?.packageJson?.type === "module") return loadMJS(path);
    else if (pkg?.packageJson?.type === "commonjs") return loadCJS(path);
    else if (
      contents
        .trim()
        .split("\n")
        .some(line => line.startsWith("import") || line.startsWith("export"))
    )
      return loadMJS(path);
    else return loadCJS(path);
  },
  ".cjs": loadCJS,
  ".mjs": loadMJS
};

export default loaders;

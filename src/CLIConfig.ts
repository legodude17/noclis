import colors from "ansi-colors";
import figures from "figures";
import type { LogLevel } from "proc-log";
import { readPackageUpSync } from "read-pkg-up";
import { resolve } from "node:path";
import url from "node:url";

const cwd = resolve("..", url.fileURLToPath(import.meta.url));

console.log(cwd);

const pkgJson = readPackageUpSync({ cwd })?.packageJson;

let name: string | undefined;
const bin = pkgJson?.bin;
if (typeof bin === "object") {
  const scriptName = process.argv.find(v => v.endsWith(".js"));
  if (scriptName) {
    const maybe = Object.entries(bin).find(([, value]) =>
      value.endsWith(scriptName)
    );
    if (maybe) [name] = maybe;
  }
}

export const DEFAULT_CONFIG: CLIConfig = {
  requireCommand: false,
  useDoubleDash: true,
  stripDoubleDash: false,
  noPrefix: "no-",
  name: name ?? pkgJson?.name ?? "",
  version: pkgJson?.version ?? "",
  logFormat: "{message}",
  progressFormat:
    "{name} {bar} {percent} ({actualValue} / {actualTotal}) [{time}]",
  logLevels: {
    error: colors.red(figures.cross),
    warn: colors.yellow(figures.warning),
    info: colors.blue(figures.info),
    notice: colors.blue(figures.star),
    verbose: colors.blue(figures.ellipsis),
    http: colors.magenta(figures.arrowUp),
    silly: colors.magenta(figures.arrowRight)
  }
};

/**
 * Configuration options for the CLI
 * @public
 */
export interface CLIConfig {
  /**
   * Require a command to be entered, and error if one is not. Default: false
   *
   * @public
   */
  requireCommand: boolean;
  /**
   * Automatically detect a `--` and stop parsing options,
   * interpreting everything else as arguments. Default: true
   *
   * @public
   */
  useDoubleDash: boolean;
  /**
   * Strip the `--` from the argv. Only matters if `useDoubleDash` is `true`. Default: false
   *
   * @public
   */
  stripDoubleDash: boolean;
  /**
   * Prefix to use when negating booleans. Default: `no-`.
   *
   * @public
   */
  noPrefix: string;
  /**
   * Name of the CLI. Default: Attempts to get the `bin` name in your `package.json`,
   * if it can't, attempts to get `name` from `package.json`, if that fails, `""`.
   *
   * @public
   */
  name: string;
  /**
   * Version of the CLI. Default: Attempts to get `version` from your `package.json`,
   * if it can't, `""`.
   */
  version: string;
  /**
   * Format for log messages. Default: `"{message}"`
   */
  logFormat: string;
  /**
   * Format for progress bars. Default: `"{name} {bar} {percent} ({actualValue} / {actualTotal}) [{time}]"`
   */
  progressFormat: string;
  /**
   * Format of log levels. Default:
   * error: Red X
   * warn: Yellow warning sign
   * info: Blue info sign
   * notice: Blue star
   * verbose: Blue ellipsis
   * http: Magenta up arrow
   * silly: Magenta right arrow
   */
  logLevels: { [K in LogLevel]: string };
}

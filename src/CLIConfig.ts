import chalk from "chalk";
import figures from "figures";
import type { LogLevel } from "proc-log";
import { readPackageUpSync } from "read-pkg-up";

const pkgJson = readPackageUpSync()?.packageJson;

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
    error: chalk.red(figures.cross),
    warn: chalk.yellow(figures.warning),
    info: chalk.blue(figures.info),
    notice: chalk.blue(figures.star),
    verbose: chalk.blue(figures.ellipsis),
    http: chalk.magenta(figures.arrowUp),
    silly: chalk.magenta(figures.arrowRight)
  }
};

/**
 * Configuration options for the CLI
 * @public
 */
export interface CLIConfig {
  /**
   * Require a command to be entered, and error if one is not.
   */
  requireCommand: boolean;
  /**
   * Automatically detect a `--` and stop parsing options, interpreting everything else as arguments
   */
  useDoubleDash: boolean;
  /**
   * Strip the `--` from the argv. Only matters if `useDoubleDash` is `true`
   */
  stripDoubleDash: boolean;
  /**
   * Prefix to use when negating booleans with `--no-`.
   */
  noPrefix: string;
  /**
   * Name of the CLI
   */
  name: string;
  /**
   * Version of the CLI
   */
  version: string;
  /**
   * Format for log messages
   */
  logFormat: string;
  /**
   * Format for progress bars
   */
  progressFormat: string;
  /**
   * Format of log levels
   */
  logLevels: { [K in LogLevel]: string };
}

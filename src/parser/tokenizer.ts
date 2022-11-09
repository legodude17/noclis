import type { Argv } from "../types.js";

export function normalizeArgv(argv: Argv): string {
  return Array.isArray(argv) ? argv.join(" ") : argv;
}

export function tokenizeArgv(argv: string): string[] {
  const args: string[] = [];
  let i = 0,
    opening = "";
  for (let j = 0; j < argv.length; j++) {
    const c = argv.charAt(j);
    const prevC = argv.charAt(i - 1);
    if (opening) {
      if (c === opening) {
        opening = "";
        continue;
      }
    } else if (c === " ") {
      if (prevC !== " ") i++;
      continue;
    } else if (c === '"' || c === "'") {
      opening = c;
      continue;
    }

    if (argv.charAt(i - 2) === "-" && prevC === "-" && c === "-") continue;

    if (!args[i]) args[i] = "";
    args[i] += c;
  }
  return args;
}

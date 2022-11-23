export function camelcase(str: string) {
  const arr = str.split(/[ -]/g);
  return (
    arr[0]!.toLowerCase() +
    arr
      .slice(1)
      .map(str => str[0]!.toUpperCase() + str.slice(1).toLowerCase())
      .join("")
  );
}

export function dashcase(str: string) {
  let res = "";
  for (const char of str) {
    const lower = char.toLowerCase();
    if (char !== lower) res += "-";
    res += lower;
  }
  return res;
}

export function indent(str: string, level: number): string {
  return str
    .split("\n")
    .map(s => " ".repeat(level) + s)
    .join("\n");
}

export class StringBuilder {
  #strings: string[] = [];
  #level = 0;
  #trim: boolean;
  constructor(trim = true) {
    this.#trim = trim;
  }

  toString() {
    return this.#strings.join("");
  }

  get length() {
    return this.#strings.reduce((acc, cur) => acc + cur.length, 0);
  }

  indent(level = 4) {
    this.#level += level;
  }

  dedent(level = 4) {
    this.#level -= level;
  }

  #process(str: string): string;
  #process(str: string[]): string[];
  #process(str: string | string[]) {
    return Array.isArray(str)
      ? str.map(str => indent(this.#trim ? str.trim() : str, this.#level))
      : indent(this.#trim ? str.trim() : str, this.#level);
  }

  append(arg: string | string[] | StringBuilder) {
    if (Array.isArray(arg)) {
      this.#strings.push(...arg);
    } else if (typeof arg === "string") {
      this.#strings.push(...this.#process(arg));
    } else if (arg.#strings) {
      this.#strings.push(...arg.#strings);
    }
  }

  appendLine(str = "") {
    this.#strings.push(this.#process(str) + "\n");
  }

  appendLines(strs: string[]) {
    this.#strings.push(this.#process(strs.join("\n")));
  }

  appendSpace(str = "") {
    this.#strings.push(this.#process(str) + " ");
  }
}

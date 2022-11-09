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

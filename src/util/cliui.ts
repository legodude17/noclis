import calcWidth from "string-width";
import wrap from "wrap-ansi";
import { maxBy, sum } from "./arrays.js";
import { StringBuilder } from "./strings.js";

interface Row {
  indent: number;
  columns: Column[];
}

interface Column {
  width: number;
  lines: string[];
}

export default class UI {
  #width: number;
  #rows: Row[] = [];
  #indent = 0;
  constructor(width = process.stderr.columns) {
    this.#width = width;
  }

  indent(num = 4) {
    this.#indent += num;
  }

  dedent(num = 4) {
    this.#indent -= num;
  }

  startSection(title: string) {
    this.append(title);
    this.indent();
  }

  endSection() {
    this.dedent();
  }

  append(...strs: string[]) {
    this.#rows.push({
      indent: this.#indent,
      columns: strs.map(str => {
        const lines = str.trim().split("\n");
        return {
          lines,
          width: calcWidth(maxBy(lines, str => calcWidth(str), ""))
        };
      })
    });
  }

  toString() {
    if (this.#rows.length === 0) return "";
    const builder = new StringBuilder(false);
    const groups: Row[][] = [];
    let curGroup: Row[] = [this.#rows[0]!];
    for (const line of this.#rows.slice(1)) {
      if (
        line.columns.length === curGroup[0]!.columns.length &&
        line.indent === curGroup[0]!.indent
      ) {
        curGroup.push(line);
      } else {
        groups.push(curGroup);
        curGroup = [line];
      }
    }
    groups.push(curGroup);
    for (const group of groups) {
      const indent = group[0]?.indent ?? 0;
      let widths: number[] = [],
        width = 0;
      while (
        (width = sum((widths = this.#calcWidths(group))) + indent) > this.#width
      ) {
        const overflow = this.#width - width;
        let idx = 0,
          cur = 0;
        for (const [i, width] of widths.entries()) {
          if (width > cur) {
            idx = i;
            cur = width;
          }
        }
        if (overflow < widths[idx]! / 2) {
          for (const row of group) {
            row.columns[idx]!.lines = row.columns[idx]!.lines.flatMap(line =>
              wrap.default(line, widths[idx]!, { hard: true }).split("\n")
            );
          }
        } else {
          for (const row of group) {
            for (const [i, col] of row.columns.entries()) {
              row.columns[i]!.lines = col.lines.flatMap(line =>
                wrap
                  .default(
                    line,
                    widths[idx]! - Math.floor(overflow / widths.length),
                    { hard: true }
                  )
                  .split("\n")
              );
            }
          }
        }
      }
      if (width < this.#width) {
        widths = widths.map(
          w => w + Math.floor(((this.#width - width) * 0.8) / widths.length)
        );
      }
      for (const row of group) {
        const length = maxBy(
          row.columns,
          col => col.lines.length,
          row.columns[0]!
        ).lines.length;
        for (const [i, col] of row.columns.entries()) {
          while (col.lines.length < length) {
            col.lines.push(" ".repeat(widths[i]!));
          }
          row.columns[i]!.lines = col.lines.map(str => str.padEnd(widths[i]!));
        }
        for (let i = 0; i < length; i++) {
          builder.append(" ".repeat(indent));
          for (const col of row.columns) {
            builder.append(col.lines[i] ?? " ".repeat(widths[i]!));
          }
          builder.appendLine();
        }
      }
    }
    return builder.toString();
  }

  #calcWidths(rows: Row[]) {
    const widths: number[] = [];
    for (const row of rows) {
      for (const [i, c] of row.columns.entries()) {
        widths[i] = Math.max(widths[i] ?? 0, c.width);
      }
    }
    return widths;
  }
}

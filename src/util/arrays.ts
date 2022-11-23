export function makeArray<T>(length: number, fill: T): T[] {
  const res: T[] = [];
  for (let i = 0; i < length; i++) {
    res[i] = fill;
  }
  return res;
}

export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

export function maxBy<T>(
  arr: T[],
  func: (val: T, idx: number) => number,
  fallback: T
): T {
  let idx = 0,
    cur: T = fallback;
  for (const [i, v] of arr.entries()) {
    if (func(v, i) > func(cur, idx)) {
      idx = i;
      cur = v;
    }
  }
  return cur;
}
